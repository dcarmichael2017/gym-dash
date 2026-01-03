import { doc, collection, getDoc, getDocs, updateDoc, query, where, limit, orderBy, increment, runTransaction } from "firebase/firestore";
import { db } from "../firebaseConfig"; // Adjust path as needed
import { BOOKING_STATUS } from '../../constants/strings'; // Adjust path
import { createCreditLog } from './credits'; // Import helper from credits module

// --- BOOKING ENGINE ---

/**
 * 2. BOOK: Add a member to the roster (With Weekly Limits Enforced)
 */
export const bookMember = async (gymId, classInfo, member, options = {}) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // OPTIMIZATION: Composite Key ID
      const bookingId = `${classInfo.id}_${classInfo.dateString}_${member.id}`;
      const attendanceRef = doc(db, "gyms", gymId, "attendance", bookingId);

      // A. Fetch Data
      const classDocRef = doc(db, "gyms", gymId, "classes", classInfo.id);
      const userDocRef = doc(db, "users", member.id);

      const classSnap = await transaction.get(classDocRef);
      const userSnap = await transaction.get(userDocRef);
      const bookingSnap = await transaction.get(attendanceRef);

      if (!classSnap.exists()) throw "Class does not exist.";
      if (!userSnap.exists()) throw "User does not exist.";

      const classData = classSnap.data();
      const userData = userSnap.data();

      // B. Check Existing Booking
      if (bookingSnap.exists()) {
        const existingData = bookingSnap.data();
        if (existingData.status !== BOOKING_STATUS.CANCELLED) {
          throw "Member is already booked in this class.";
        }
      }

      // C. Run Gatekeeper
      let gatekeeper = canUserBook(classData, userData, gymId);

      if (!gatekeeper.allowed && !options.force) {
        throw gatekeeper.reason;
      }

      // --- NEW: WEEKLY LIMIT CHECK ---
      if (gatekeeper.type === 'membership') {
        const userMembership = (userData.memberships || []).find(m => m.gymId === gymId);

        if (userMembership && userMembership.membershipId) {
          const tierRef = doc(db, "gyms", gymId, "membershipTiers", userMembership.membershipId);
          const tierSnap = await transaction.get(tierRef);

          if (tierSnap.exists()) {
            const tierData = tierSnap.data();
            const weeklyLimit = tierData.weeklyLimit;

            if (!isNaN(weeklyLimit) && weeklyLimit > 0) {
              const { start, end } = getWeekRange(classInfo.dateString);
              
              // Note: Queries in transactions usually require an index.
              const historyRef = collection(db, "gyms", gymId, "attendance");
              const historyQuery = query(
                historyRef,
                where("memberId", "==", member.id),
                where("dateString", ">=", start),
                where("dateString", "<=", end),
                where("status", "in", [BOOKING_STATUS.BOOKED, BOOKING_STATUS.ATTENDED])
              );
              const historySnap = await getDocs(historyQuery);
              const classesThisWeek = historySnap.size;

              if (classesThisWeek >= weeklyLimit && !options.force) {
                // Fallback to credits?
                const creditCost = parseInt(classData.creditCost) || 0;
                const userCredits = parseInt(userData.classCredits) || 0;

                if (classData.dropInEnabled && creditCost > 0 && userCredits >= creditCost) {
                  gatekeeper = {
                    allowed: true,
                    type: 'credit',
                    cost: creditCost,
                    reason: `Weekly Limit Reached (${classesThisWeek}/${weeklyLimit}). Using Credits.`
                  };
                } else {
                  throw `Weekly booking limit reached (${classesThisWeek}/${weeklyLimit}).`;
                }
              }
            }
          }
        }
      }

      // D. CAPACITY & WAITLIST CHECK
      const attendanceCollection = collection(db, "gyms", gymId, "attendance");
      const rosterQuery = query(
        attendanceCollection,
        where("classId", "==", classInfo.id),
        where("dateString", "==", classInfo.dateString),
        where("status", "in", [BOOKING_STATUS.BOOKED, BOOKING_STATUS.ATTENDED])
      );
      const rosterSnap = await getDocs(rosterQuery);
      const currentCount = rosterSnap.size;
      const maxCapacity = parseInt(classData.maxCapacity) || 999;

      const waitlistQuery = query(
        attendanceCollection,
        where("classId", "==", classInfo.id),
        where("dateString", "==", classInfo.dateString),
        where("status", "==", BOOKING_STATUS.WAITLISTED)
      );
      const waitlistSnap = await getDocs(waitlistQuery);
      const waitlistCount = waitlistSnap.size;

      let finalStatus = BOOKING_STATUS.BOOKED;
      if (!options.force) {
        if (currentCount >= maxCapacity || waitlistCount > 0) {
          finalStatus = BOOKING_STATUS.WAITLISTED;
        }
      }

      // E. CREDIT DEDUCTION
      let costUsed = 0;
      if (gatekeeper.type === 'credit') {
        if (!options.force) {
          transaction.update(userDocRef, { classCredits: increment(-gatekeeper.cost) });
          costUsed = gatekeeper.cost;
          
          createCreditLog(
            transaction, 
            member.id, 
            -gatekeeper.cost, 
            'booking', 
            `Booked: ${classInfo.name} (${classInfo.time})`
          );
        }
      }

      // F. WRITE TO DB
      const timestamp = new Date();
      const [year, month, day] = classInfo.dateString.split('-').map(Number);
      const [hours, minutes] = classInfo.time.split(':').map(Number);
      const sessionDateObj = new Date(year, month - 1, day, hours, minutes);

      const bookingPayload = {
        classId: classInfo.id,
        className: classInfo.name,
        instructorName: classData.instructorName || classInfo.instructorName || null,
        dateString: classInfo.dateString,
        classTime: classInfo.time,
        classTimestamp: sessionDateObj,
        memberId: member.id,
        memberName: member.name || "Unknown Member",
        memberPhoto: member.photoUrl || null,
        status: finalStatus,
        bookedAt: timestamp,
        bookingType: gatekeeper.type,
        costUsed: costUsed
      };

      if (bookingSnap.exists()) {
        transaction.update(attendanceRef, {
          ...bookingPayload,
          cancelledAt: null,
          refunded: false,
          lateCancel: false
        });
        return { success: true, status: finalStatus, recovered: true };
      } else {
        transaction.set(attendanceRef, {
          ...bookingPayload,
          createdAt: timestamp
        });
        return { success: true, status: finalStatus, id: bookingId };
      }
    });

  } catch (error) {
    console.error("Booking transaction failed:", error);
    const msg = typeof error === 'string' ? error : error.message;
    return { success: false, error: msg };
  }
};

/**
 * 4. CANCEL BOOKING (Smart Cancel + Refund Logic)
 */
export const cancelBooking = async (gymId, attendanceId, options = {}) => {
  try {
    await runTransaction(db, async (transaction) => {
      const attRef = doc(db, "gyms", gymId, "attendance", attendanceId);
      const attSnap = await transaction.get(attRef);

      if (!attSnap.exists()) throw "Booking not found.";
      const data = attSnap.data();

      const classRef = doc(db, "gyms", gymId, "classes", data.classId);
      const classSnap = await transaction.get(classRef);

      const cancelWindowMinutes = classSnap.exists() && classSnap.data().cancellationWindow
        ? parseInt(classSnap.data().cancellationWindow)
        : 120;

      const now = new Date();
      const classTime = data.classTimestamp.toDate();
      const diffMs = classTime - now;
      const minutesUntilClass = Math.floor(diffMs / 60000);

      const isWaitlisted = data.status === BOOKING_STATUS.WAITLISTED;
      const isWithinSafeWindow = minutesUntilClass >= cancelWindowMinutes;

      // REFUND LOGIC: Refund if (Waitlisted) OR (Paid with Credit AND Cancelled Early enough) OR (Admin Override)
      let shouldRefund = isWaitlisted || isWithinSafeWindow || options.isStaff;
      let refundApplied = false;

      if (data.bookingType === 'credit' && data.costUsed > 0) {
        if (shouldRefund) {
          const userRef = doc(db, "users", data.memberId);
          transaction.update(userRef, { classCredits: increment(data.costUsed) });
          refundApplied = true;

          createCreditLog(
            transaction, 
            data.memberId, 
            data.costUsed, 
            'refund', 
            `Refund: ${data.className} (${options.isStaff ? 'Admin Cancel' : 'User Cancel'})`
          );
        }
      }

      const wasTakingSpot = data.status === BOOKING_STATUS.BOOKED || data.status === BOOKING_STATUS.ATTENDED;

      transaction.update(attRef, {
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        refunded: refundApplied,
        lateCancel: !isWithinSafeWindow && !isWaitlisted && !options.isStaff
      });

      if (wasTakingSpot) {
        const attendanceCollection = collection(db, "gyms", gymId, "attendance");
        const q = query(
          attendanceCollection,
          where("classId", "==", data.classId),
          where("dateString", "==", data.dateString),
          where("status", "==", BOOKING_STATUS.WAITLISTED),
          orderBy("bookedAt", "asc"),
          limit(1)
        );

        const waitlistSnap = await getDocs(q);

        if (!waitlistSnap.empty) {
          const nextInLine = waitlistSnap.docs[0];
          transaction.update(nextInLine.ref, {
            status: BOOKING_STATUS.BOOKED,
            promotedAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return { success: false, error: error.message };
  }
};

export const checkBookingEligibility = async (gymId, userId, classInstanceProp) => {
  const result = {
    instructorName: classInstanceProp.resolvedInstructorName || classInstanceProp.instructorName || null,
    userProfile: null,
    eligibility: null,
    activePlanName: '',
    weeklyUsage: null,
    eligiblePublicPlans: [],
    error: null
  };

  try {
    const classRef = doc(db, 'gyms', gymId, 'classes', classInstanceProp.id);
    const classSnap = await getDoc(classRef);

    let authoritativeClassData = { ...classInstanceProp };
    if (classSnap.exists()) {
      const dbData = classSnap.data();
      authoritativeClassData = {
        ...classInstanceProp,
        ...dbData,
        dateString: classInstanceProp.dateString,
        time: classInstanceProp.time
      };
    }

    if (!result.instructorName && authoritativeClassData.instructorId) {
      const staffRef = doc(db, 'gyms', gymId, 'staff', authoritativeClassData.instructorId);
      const snap = await getDoc(staffRef);
      if (snap.exists()) result.instructorName = snap.data().name;
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User profile not found");

    const userData = userSnap.data();
    result.userProfile = userData;

    const userMem = (userData.memberships || []).find(m => m.gymId === gymId);
    let baseEligibility = canUserBook(authoritativeClassData, userData, gymId);

    if (baseEligibility.type === 'membership' && userMem && userMem.membershipId) {
      try {
        const tierRef = doc(db, 'gyms', gymId, 'membershipTiers', userMem.membershipId);
        const tierSnap = await getDoc(tierRef);

        if (tierSnap.exists()) {
          const tierData = tierSnap.data();
          result.activePlanName = tierData.name;
          const limit = tierData.weeklyLimit;

          if (limit && limit > 0) {
            const usageRes = await getWeeklyClassCount(gymId, userId, authoritativeClassData.dateString);

            if (usageRes.success) {
              result.weeklyUsage = { 
                used: usageRes.count, 
                limit: limit, 
                classes: usageRes.classes 
              };

              if (usageRes.count >= limit) {
                const creditCost = parseInt(authoritativeClassData.creditCost) || 0;
                const userCredits = parseInt(userData.classCredits) || 0;

                if (creditCost > 0 && userCredits >= creditCost) {
                  baseEligibility = {
                    allowed: true,
                    type: 'credit',
                    cost: creditCost,
                    reason: `Weekly limit reached (${usageRes.count}/${limit}). Using credits.`
                  };
                } else {
                  baseEligibility = {
                    allowed: false,
                    type: 'denied',
                    reason: `Weekly limit of ${limit} classes reached.`,
                    cost: creditCost
                  };
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not read membership tier details:", err);
      }
    }

    result.eligibility = baseEligibility;

    if (!baseEligibility.allowed && authoritativeClassData.allowedMembershipIds?.length > 0) {
      const tiersRef = collection(db, 'gyms', gymId, 'membershipTiers');
      const q = query(tiersRef, where("visibility", "==", "public"), where("active", "==", true));
      const tiersSnap = await getDocs(q);

      const validPlans = [];
      tiersSnap.forEach(doc => {
        if (authoritativeClassData.allowedMembershipIds.includes(doc.id)) {
          const data = doc.data();
          validPlans.push({
            id: doc.id,
            name: data.name,
            price: data.price,
            interval: data.interval
          });
        }
      });
      result.eligiblePublicPlans = validPlans;
    }

    return { success: true, data: result };

  } catch (error) {
    console.error("Booking Check Error:", error);
    return { success: false, error: error.message };
  }
};

export const canUserBook = (classData, userData, targetGymId) => {
  const allowedPlans = classData.allowedMembershipIds || [];
  const creditCost = parseInt(classData.creditCost) || 0; 
  let credits = parseInt(userData.classCredits) || 0;

  const relevantMembership = (userData.memberships || []).find(m => m.gymId === targetGymId);
  const VALID_ACCESS_STATUSES = ['active', 'trialing']; 

  if (relevantMembership) {
    const memStatus = (relevantMembership.status || '').toLowerCase().trim();
    const planId = relevantMembership.membershipId;
    const planCoversClass = allowedPlans.includes(planId);
    const isGoodStanding = VALID_ACCESS_STATUSES.includes(memStatus);

    if (planCoversClass && isGoodStanding) {
       return { allowed: true, reason: "Membership Access", type: 'membership', cost: 0 };
    }
  }

  if (userData.status !== 'banned') { 
      if (creditCost > 0 && credits >= creditCost) {
          return { 
            allowed: true, 
            reason: `${creditCost} Credit(s) applied`, 
            type: 'credit',
            cost: creditCost
          };
      }
      if (classData.dropInEnabled && creditCost === 0) {
        return { allowed: true, reason: "Open Registration", type: 'drop-in', cost: 0 };
      }
  }

  let denialReason = "Membership required to book.";
  if (relevantMembership && allowedPlans.includes(relevantMembership.membershipId)) {
      denialReason = `Your membership is currently ${relevantMembership.status}.`;
  } else if (creditCost > 0) {
      denialReason = `Insufficient Credits. (Requires ${creditCost}, you have ${credits})`;
  }

  return { allowed: false, reason: denialReason, type: 'denied', cost: creditCost };
};

export const recordAttendance = async (gymId, data) => {
  try {
    await runTransaction(db, async (transaction) => {
      const attendanceRef = doc(collection(db, "gyms", gymId, "attendance"));
      const userRef = doc(db, "users", data.memberId);

      transaction.set(attendanceRef, {
        ...data,
        createdAt: new Date(),
        status: data.status || 'attended', 
      });

      if (data.status === 'attended' && data.programId) {
        transaction.update(userRef, {
          [`attendanceCounts.${data.programId}`]: increment(1),
          lastAttended: new Date()
        });
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Error recording attendance:", error);
    return { success: false, error: error.message };
  }
};

export const checkInMember = async (gymId, attendanceId, memberId, programId) => {
  try {
    const attRef = doc(db, "gyms", gymId, "attendance", attendanceId);
    const memberRef = doc(db, "users", memberId);

    await updateDoc(attRef, {
      status: BOOKING_STATUS.ATTENDED,
      checkedInAt: new Date()
    });

    const userUpdates = {
      attendanceCount: increment(1),
      lastAttended: new Date()
    };

    if (programId) {
      const userSnap = await getDoc(memberRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const userRanks = userData.ranks || {}; 

        if (userRanks[programId]) {
          userUpdates[`ranks.${programId}.credits`] = increment(1);
        } else {
          const gymDoc = await getDoc(doc(db, "gyms", gymId));
          if (gymDoc.exists()) {
            const gymData = gymDoc.data();
            const programs = gymData.grading?.programs || [];
            const targetProgram = programs.find(p => p.id === programId);

            if (targetProgram && targetProgram.ranks?.length > 0) {
              const firstRank = targetProgram.ranks[0];
              userUpdates[`ranks.${programId}`] = {
                rankId: firstRank.id,
                stripes: 0,
                credits: 1 
              };

              if (userData.status === 'prospect') {
                userUpdates.status = 'active';
                userUpdates.convertedAt = new Date();
              }
            }
          }
        }
      }
    }
    await updateDoc(memberRef, userUpdates);
    return { success: true };
  } catch (error) {
    console.error("Check-in error:", error);
    return { success: false, error: error.message };
  }
};

export const processWaitlist = async (gymId, classId, dateString) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const attendanceRef = collection(db, "gyms", gymId, "attendance");
      const classDocRef = doc(db, "gyms", gymId, "classes", classId);
      const classSnap = await transaction.get(classDocRef);
      if (!classSnap.exists()) throw "Class not found";
      const maxCapacity = parseInt(classSnap.data().maxCapacity) || 999;

      const q = query(
        attendanceRef,
        where("classId", "==", classId),
        where("dateString", "==", dateString)
      );
      const snapshot = await getDocs(q); 

      let currentActive = 0;
      let waitlist = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === BOOKING_STATUS.BOOKED || data.status === BOOKING_STATUS.ATTENDED) {
          currentActive++;
        } else if (data.status === BOOKING_STATUS.WAITLISTED) {
          waitlist.push({ ref: doc.ref, data: data });
        }
      });

      waitlist.sort((a, b) => {
        const dateA = a.data.bookedAt?.seconds || 0;
        const dateB = b.data.bookedAt?.seconds || 0;
        return dateA - dateB;
      });

      let spotsAvailable = maxCapacity - currentActive;
      let promotedCount = 0;

      for (const waiter of waitlist) {
        if (spotsAvailable > 0) {
          transaction.update(waiter.ref, {
            status: BOOKING_STATUS.BOOKED,
            promotedAt: new Date(),
            updatedAt: new Date()
          });
          spotsAvailable--;
          promotedCount++;
        } else {
          break; 
        }
      }

      return { success: true, promoted: promotedCount };
    });
  } catch (error) {
    console.error("Process waitlist error:", error);
    return { success: false, error: error.message };
  }
};

// --- DATA FETCHERS ---

export const getMemberAttendance = async (gymId, memberId) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("memberId", "==", memberId),
      orderBy("classTimestamp", "desc"),
      limit(20)
    );
    const snapshot = await getDocs(q);
    return { success: true, history: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    console.error("History fetch error:", error);
    return { success: false, error: error.message };
  }
};

export const getClassRoster = async (gymId, classId, dateString) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("classId", "==", classId),
      where("dateString", "==", dateString)
    );
    const snapshot = await getDocs(q);
    const roster = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, roster };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getWeeklyAttendanceCounts = async (gymId, startDateStr, endDateStr) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("dateString", ">=", startDateStr),
      where("dateString", "<=", endDateStr)
    );

    const snapshot = await getDocs(q);
    const counts = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (['booked', 'attended'].includes(data.status)) {
        const key = `${data.classId}_${data.dateString}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    return { success: true, counts };
  } catch (error) {
    console.error("Error fetching counts:", error);
    return { success: false, error: error.message };
  }
};

export const getWeeklyClassCount = async (gymId, userId, dateString) => {
  try {
    const { start, end } = getWeekRange(dateString);

    const attRef = collection(db, 'gyms', gymId, 'attendance');
    const q = query(
      attRef,
      where("memberId", "==", userId),
      where("dateString", ">=", start),
      where("dateString", "<=", end),
      where("status", "in", ["booked", "attended"]),
      orderBy("classTimestamp", "asc")
    );

    const snapshot = await getDocs(q);
    const classes = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            className: d.className,
            dateString: d.dateString,
            classTime: d.classTime,
            status: d.status
        };
    });
    
    return { success: true, count: snapshot.size, classes: classes, start, end };
  } catch (error) {
    console.error("Error counting weekly classes:", error);
    return { success: false, error: error.message };
  }
};

export const getMemberSchedule = async (gymId, memberId, startDate, endDate) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("memberId", "==", memberId),
      where("dateString", ">=", startDate),
      where("dateString", "<=", endDate),
      where("status", "in", ["booked", "waitlisted", "attended"]) 
    );

    const snapshot = await getDocs(q);
    const scheduleMap = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.classId}_${data.dateString}`;
      scheduleMap[key] = {
        status: data.status,
        id: doc.id
      };
    });

    return { success: true, schedule: scheduleMap };
  } catch (error) {
    console.error("Error fetching member schedule:", error);
    return { success: false, error: error.message };
  }
};

// HELPER: Week Range
const getWeekRange = (dateString) => {
  const [y, m, d] = dateString.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);

  const day = targetDate.getDay();
  const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);

  const monday = new Date(targetDate);
  monday.setDate(diff);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const format = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return { start: format(monday), end: format(sunday) };
};