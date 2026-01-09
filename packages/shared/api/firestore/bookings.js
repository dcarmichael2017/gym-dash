import { doc, collection, getDoc, getDocs, updateDoc, query, where, limit, orderBy, increment, runTransaction, writeBatch } from "firebase/firestore";
import { db } from "../firebaseConfig"; // Adjust path as needed
import { getFunctions, httpsCallable } from "firebase/functions";
import { deleteClass } from './classes';
import { BOOKING_STATUS } from '../../constants/strings'; // Adjust path
import { createCreditLog } from './credits'; // Import helper from credits module

// --- BOOKING ENGINE ---


/**
 * 2. BOOK: Add a member to the roster
 */
export const bookMember = async (gymId, classInfo, member, options = {}) => {
  try {
    return await runTransaction(db, async (transaction) => {
      // Setup Refs
      const bookingId = `${classInfo.id}_${classInfo.dateString}_${member.id}`;
      const attendanceRef = doc(db, "gyms", gymId, "attendance", bookingId);
      const classDocRef = doc(db, "gyms", gymId, "classes", classInfo.id);
      const userDocRef = doc(db, "users", member.id);

      const [classSnap, userSnap, bookingSnap] = await Promise.all([
        transaction.get(classDocRef),
        transaction.get(userDocRef),
        transaction.get(attendanceRef)
      ]);

      if (!classSnap.exists()) throw "Class does not exist.";
      if (!userSnap.exists()) throw "User does not exist.";

      const classData = classSnap.data();
      const userData = userSnap.data();
      const rules = classData.bookingRules || {}; // ✅ Access the new rules object

      // Check Duplicates
      if (bookingSnap.exists() && bookingSnap.data().status !== BOOKING_STATUS.CANCELLED) {
        throw "Member is already booked.";
      }

      // --- 1. TIME & WINDOW CHECKS (ENFORCING RULES) ---
      const [h, m] = classInfo.time.split(':').map(Number);
      const [Y, M, D] = classInfo.dateString.split('-').map(Number);
      const classStartObj = new Date(Y, M - 1, D, h, m);
      const now = new Date();

      // If the class series has a recurrenceEndDate, and this booking is AFTER it, block it.
      if (classData.recurrenceEndDate) {
        // Compare date strings (YYYY-MM-DD)
        if (classInfo.dateString > classData.recurrenceEndDate) {
           throw "This class series has ended.";
        }
      }

      // A. Booking Window Check (Can I book this far in advance?)
      // ✅ NEW LOGIC
      if (!options.isStaff && !options.force && rules.bookingWindowDays) {
        const windowDays = parseInt(rules.bookingWindowDays);
        const maxBookingDate = new Date();
        maxBookingDate.setDate(maxBookingDate.getDate() + windowDays);
        // Set to end of that day to be generous
        maxBookingDate.setHours(23, 59, 59, 999);

        if (classStartObj > maxBookingDate) {
           const openDate = new Date(classStartObj);
           openDate.setDate(openDate.getDate() - windowDays);
           throw `Booking for this class opens on ${openDate.toLocaleDateString()}.`;
        }
      }

      // B. Late Booking Check (Is it too late to join?)
      const duration = parseInt(classData.duration) || 60;
      const classEndTime = new Date(classStartObj.getTime() + duration * 60000);
      const isRetroactive = now > classEndTime;

      // ✅ UPDATED LOGIC: Use lateBookingMinutes from rules, default to class duration if not set
      let lateMinutes = rules.lateBookingMinutes != null 
        ? parseInt(rules.lateBookingMinutes) 
        : duration; 
      
      const cutoffTime = new Date(classStartObj.getTime() + lateMinutes * 60000);
      const isAllowedLate = options.force || options.isStaff;

      if (now > cutoffTime && !isAllowedLate) throw "Booking closed.";


      // --- COST CALCULATION ---
      let baseCost = 1;
      if (options.creditCostOverride !== undefined) {
        baseCost = parseInt(options.creditCostOverride);
      } else {
        baseCost = parseInt(classData.creditCost);
        if (isNaN(baseCost)) baseCost = 1;
      }

      // --- 2. SOURCE OF FUNDS LOGIC ---
      let bookingType = 'unknown';
      let costUsed = 0;
      let gatekeeper = canUserBook(classData, userData, gymId);

      if (options.bookingType) {
        bookingType = options.bookingType;
        if (bookingType === 'credit') costUsed = baseCost;
        else if (['membership', 'comp', 'admin_comp'].includes(bookingType)) costUsed = 0;
        if (options.waiveCost) costUsed = 0;
      } else if (options.force) {
        if (options.waiveCost) {
          bookingType = 'comp';
          costUsed = 0;
        } else {
          bookingType = 'credit';
          costUsed = baseCost;
        }
      } else {
        if (!gatekeeper.allowed) throw gatekeeper.reason;
        if (gatekeeper.type === 'membership') {
          bookingType = 'membership';
          costUsed = 0;
        } else if (gatekeeper.type === 'credit' || gatekeeper.type === 'drop-in') {
          bookingType = 'credit';
          costUsed = gatekeeper.cost > 0 ? gatekeeper.cost : baseCost;
        }
      }

      // --- 3. DEDUCT CREDITS ---
      if (costUsed > 0) {
        const userCredits = parseInt(userData.classCredits) || 0;
        if (!options.force && userCredits < costUsed) throw "Insufficient credits.";

        if (userCredits >= costUsed) {
          transaction.update(userDocRef, { classCredits: increment(-costUsed) });
          createCreditLog(
            transaction, member.id, -costUsed, 'booking',
            options.isStaff ? `Admin Booked: ${classInfo.name}` : `Booked: ${classInfo.name}`,
            options.force ? 'admin_forced' : 'system'
          );
        } else if (options.force) {
          costUsed = 0;
        } else {
          throw "Insufficient credits.";
        }
      }

      // --- 4. CAPACITY CHECK ---
      let status = BOOKING_STATUS.BOOKED;
      if (!options.force && !isRetroactive) {
        const rosterQuery = query(
          collection(db, "gyms", gymId, "attendance"),
          where("classId", "==", classInfo.id),
          where("dateString", "==", classInfo.dateString),
          where("status", "in", [BOOKING_STATUS.BOOKED, BOOKING_STATUS.ATTENDED])
        );
        const rosterSnap = await getDocs(rosterQuery);
        const maxCap = parseInt(classData.maxCapacity) || 999;
        if (rosterSnap.size >= maxCap) status = BOOKING_STATUS.WAITLISTED;
      }

      if (isRetroactive && status !== BOOKING_STATUS.WAITLISTED) {
        status = BOOKING_STATUS.ATTENDED;
      }

      // --- 5. HANDLE PROGRESSION ---
      const programId = classData.programId || null;

      if (status === BOOKING_STATUS.ATTENDED) {
        const userUpdates = {
          attendanceCount: increment(1),
          lastAttended: new Date()
        };

        if (programId) {
          const userRanks = userData.ranks || {};
          if (userRanks[programId]) {
            userUpdates[`ranks.${programId}.credits`] = increment(1);
          } else {
            const gymDoc = await transaction.get(doc(db, "gyms", gymId));
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
        transaction.update(userDocRef, userUpdates);
      }

      // --- 6. WRITE ATTENDANCE RECORD ---

      // ✅ NEW: Create a clean snapshot of the rules at this moment
      const bookingRulesSnapshot = {
        cancelWindowHours: rules.cancelWindowHours !== undefined ? parseFloat(rules.cancelWindowHours) : 2,
        lateCancelFee: rules.lateCancelFee ? parseFloat(rules.lateCancelFee) : 0,
        lateBookingMinutes: rules.lateBookingMinutes ?? null, // FIX: Ensure value is not undefined
        // ✅ Add cost snapshot for audit trails
        creditCost: baseCost 
      };
      const payload = {
        classId: classInfo.id,
        className: classInfo.name,
        instructorName: classData.instructorName || classInfo.instructorName || null,
        dateString: classInfo.dateString,
        classTime: classInfo.time,
        classTimestamp: classStartObj,
        memberId: member.id,
        memberName: member.name || "Unknown Member",
        memberPhoto: member.photoUrl || null,
        status: status, // Defined in capacity check
        bookedAt: new Date(),
        bookingType: bookingType, // Defined in Cost logic
        costUsed: costUsed,       // Defined in Cost logic
        programId: programId,     // Defined in Progression logic
        checkedInAt: status === BOOKING_STATUS.ATTENDED ? classStartObj : null,
        
        // ✅ SAVE THE SNAPSHOT
        bookingRulesSnapshot: bookingRulesSnapshot 
      };

      if (bookingSnap.exists()) {
        transaction.update(attendanceRef, { ...payload, cancelledAt: null, refunded: false });
      } else {
        transaction.set(attendanceRef, { ...payload, createdAt: new Date() });
      }

      return { success: true, status, recovered: bookingSnap.exists() };
    });
  } catch (error) {
    console.error("Booking failed:", error);
    return { success: false, error: typeof error === 'string' ? error : error.message };
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

      // --- 1. DETERMINE REFUND POLICY ---
      let shouldRefund = false;
      const classRef = doc(db, "gyms", gymId, "classes", data.classId);
      const classSnap = await transaction.get(classRef);
      // We need classData available for fee calculation later if snapshot is missing
      const classData = classSnap.exists() ? classSnap.data() : {}; 

      if (options.refundPolicy) {
        shouldRefund = options.refundPolicy === 'refund';
      } else {
        // Prefer Snapshot, Fallback to Live Class Data
        let cancelHours;
        
        if (data.bookingRulesSnapshot && data.bookingRulesSnapshot.cancelWindowHours !== undefined) {
            cancelHours = parseFloat(data.bookingRulesSnapshot.cancelWindowHours);
        } else {
            const rules = classData.bookingRules || {};
            cancelHours = rules.cancelWindowHours !== undefined ? parseFloat(rules.cancelWindowHours) : 2;
        }
            
        const cancelWindowMin = cancelHours * 60; 

        const now = new Date();
        const classTime = data.classTimestamp.toDate();
        const diffMinutes = Math.floor((classTime - now) / 60000);

        const isWaitlisted = data.status === BOOKING_STATUS.WAITLISTED;
        const isSafeWindow = diffMinutes >= cancelWindowMin;
        const isAdminBypass = options.isStaff === true;

        shouldRefund = isWaitlisted || isSafeWindow || isAdminBypass;
      }

      // --- 2. HANDLE CREDIT REFUNDS ---
      let refundedAmount = 0;
      if (shouldRefund && data.costUsed > 0) {
        const userRef = doc(db, "users", data.memberId);
        transaction.update(userRef, { classCredits: increment(data.costUsed) });
        refundedAmount = data.costUsed;

        createCreditLog(
          transaction,
          data.memberId,
          data.costUsed,
          'refund',
          options.isStaff ? `Admin Refunded: ${data.className}` : `Refund: ${data.className}`,
          options.isStaff ? 'admin_cancel' : 'user_cancel'
        );
      }

      // --- 3. REVERSE PROGRESSION ---
      if (data.status === BOOKING_STATUS.ATTENDED) {
        const userRef = doc(db, "users", data.memberId);
        const userUpdates = {
          attendanceCount: increment(-1)
        };

        let programId = data.programId;
        if (!programId && classSnap.exists()) {
          programId = classSnap.data().programId;
        }

        if (programId) {
          userUpdates[`ranks.${programId}.credits`] = increment(-1);
        }

        transaction.update(userRef, userUpdates);
      }

      // --- 4. UPDATE ATTENDANCE RECORD ---
      const wasTakingSpot = [BOOKING_STATUS.BOOKED, BOOKING_STATUS.ATTENDED].includes(data.status);

      // ✅ FIX: Calculate these variables BEFORE using them in the update object
      const isLateCancel = !shouldRefund && !options.isStaff;
      
      let applicableFee = 0;
      if (isLateCancel) {
          // Check snapshot first, then fallback to live data
          if (data.bookingRulesSnapshot && data.bookingRulesSnapshot.lateCancelFee !== undefined) {
              applicableFee = parseFloat(data.bookingRulesSnapshot.lateCancelFee);
          } else {
              const liveRules = classData.bookingRules || {};
              applicableFee = liveRules.lateCancelFee ? parseFloat(liveRules.lateCancelFee) : 0;
          }
      }

      transaction.update(attRef, {
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        refunded: refundedAmount > 0,
        refundAmount: refundedAmount,
        lateCancel: isLateCancel,       // ✅ Uses the variable defined above
        lateCancelFeeApplied: applicableFee // ✅ Uses the variable defined above
      });

      // --- 5. PROMOTE WAITLIST ---
      if (wasTakingSpot) {
        const q = query(
          collection(db, "gyms", gymId, "attendance"),
          where("classId", "==", data.classId),
          where("dateString", "==", data.dateString),
          where("status", "==", BOOKING_STATUS.WAITLISTED),
          orderBy("bookedAt", "asc"),
          limit(1)
        );
        const waitlistSnap = await getDocs(q);
        if (!waitlistSnap.empty) {
          const nextUser = waitlistSnap.docs[0];
          transaction.update(nextUser.ref, {
            status: BOOKING_STATUS.BOOKED,
            promotedAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Cancel failed:", error);
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
    eligiblePublicPlans: []
  };

  try {
    // 1. Fetch Authoritative Class Data
    const classRef = doc(db, 'gyms', gymId, 'classes', classInstanceProp.id);
    const classSnap = await getDoc(classRef);

    // Merge prop data with DB data (DB takes precedence for rules)
    const classData = classSnap.exists()
      ? { ...classInstanceProp, ...classSnap.data(), id: classInstanceProp.id }
      : classInstanceProp;

    // 2. Fetch User & Membership
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    result.userProfile = userData;

    // 3. Initial Gatekeeper Check
    let baseEligibility = canUserBook(classData, userData, gymId);

    // 4. Deep Membership Check (Weekly Limits)
    if (baseEligibility.type === 'membership') {
      const userMem = (userData.memberships || []).find(m => m.gymId === gymId);

      if (userMem?.membershipId) {
        const tierSnap = await getDoc(doc(db, 'gyms', gymId, 'membershipTiers', userMem.membershipId));

        if (tierSnap.exists()) {
          const tierData = tierSnap.data();
          result.activePlanName = tierData.name;

          const limit = parseInt(tierData.weeklyLimit);

          // Only check usage if a valid limit > 0 exists
          if (!isNaN(limit) && limit > 0) {
            const usageRes = await getWeeklyClassCount(gymId, userId, classData.dateString);

            if (usageRes.success) {
              result.weeklyUsage = {
                used: usageRes.count,
                limit: limit,
                classes: usageRes.classes
              };

              // --- LIMIT REACHED LOGIC ---
              if (usageRes.count >= limit) {
                // Determine if we can fallback to credits
                const creditCost = parseInt(classData.creditCost) || 1;
                const userCredits = parseInt(userData.classCredits) || 0;

                if (classData.dropInEnabled && userCredits >= creditCost) {
                  baseEligibility = {
                    allowed: true,
                    type: 'credit', // Switches type to credit
                    cost: creditCost,
                    reason: `Weekly limit reached (${usageRes.count}/${limit}). Booking via Credit.`
                  };
                } else {
                  baseEligibility = {
                    allowed: false,
                    type: 'denied',
                    cost: creditCost,
                    reason: `Weekly limit of ${limit} classes reached.`
                  };
                }
              }
            }
          }
        }
      }
    }

    result.eligibility = baseEligibility;

    // 5. Populate Public Plans (if denied)
    if (!baseEligibility.allowed && classData.allowedMembershipIds?.length > 0) {
      const q = query(
        collection(db, 'gyms', gymId, 'membershipTiers'),
        where("visibility", "==", "public"),
        where("active", "==", true)
      );
      const tiersSnap = await getDocs(q);
      result.eligiblePublicPlans = tiersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => classData.allowedMembershipIds.includes(p.id));
    }

    return { success: true, data: result };

  } catch (error) {
    console.error("Eligibility Check Error:", error);
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

export const getMemberAttendanceHistory = async (gymId, memberId) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("memberId", "==", memberId),
      orderBy("classTimestamp", "desc")
    );
    const snapshot = await getDocs(q);
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, history };
  } catch (error) {
    console.error("Attendance history fetch error:", error);
    return { success: false, error: error.message };
  }
};

export const getAllBookingsForClass = async (gymId, classId) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(attRef, where("classId", "==", classId), limit(1));
    const snapshot = await getDocs(q);
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, bookings };
  } catch (error) {
    console.error("Error fetching all bookings for class:", error);
    return { success: false, error: error.message };
  }
};

export const getFutureBookingsForClass = async (gymId, classId, fromDateString) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("classId", "==", classId),
      where("dateString", ">=", fromDateString),
      where("status", "in", ["booked", "waitlisted", "attended"])
    );
    const snapshot = await getDocs(q);
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, bookings };
  } catch (error) {
    console.error("Error fetching future bookings:", error);
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
    
    // 1. Remove the 'status' filter from the query so we fetch CANCELLED bookings too
    const q = query(
      attRef,
      where("memberId", "==", userId),
      where("dateString", ">=", start),
      where("dateString", "<=", end),
      orderBy("classTimestamp", "asc")
    );

    const snapshot = await getDocs(q);
    
    // 2. Filter in memory to determine what counts against the limit
    const classes = [];
    
    snapshot.forEach(doc => {
      const d = doc.data();
      
      // LOGIC: It counts if it is Booked, Attended, OR (Cancelled AND Late Cancel)
      const countsTowardsLimit = 
        d.status === BOOKING_STATUS.BOOKED || 
        d.status === BOOKING_STATUS.ATTENDED || 
        (d.status === BOOKING_STATUS.CANCELLED && d.lateCancel === true);

      if (countsTowardsLimit) {
        classes.push({
          id: doc.id,
          className: d.className,
          dateString: d.dateString,
          classTime: d.classTime,
          status: d.status,
          lateCancel: d.lateCancel // Optional: pass this if you want to show it in UI
        });
      }
    });

    return { success: true, count: classes.length, classes: classes, start, end };
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

      // --- FIX IS HERE ---
      // We map the database fields to the properties the Modal expects
      scheduleMap[key] = {
        status: data.status,
        attendanceId: doc.id, // Use explicit name
        bookingType: data.bookingType, // <--- Now the modal will know it's a credit booking
        cost: data.costUsed,           // <--- Now the modal knows how many credits to refund
        cancellationWindow: data.cancellationWindow // (Optional if you snapshot this on booking)
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

export const migrateClassSeries = async (gymId, { oldClassId, cutoffDateString, newClassData }) => {
  const functions = getFunctions();
  const migrate = httpsCallable(functions, 'migrateClassSeries');
  
  try {
    const result = await migrate({
      gymId,
      oldClassId,
      cutoffDateString,
      newClassData // This can be null if just ghosting
    });
    
    // As requested, return the list of refunded users.
    return { success: true, refundedUserIds: result.data.refundedUserIds || [] };
  } catch (error) {
    console.error("Error migrating class series:", error);
    return { success: false, error: error.message };
  }
};
