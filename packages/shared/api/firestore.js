import { doc, setDoc, addDoc, collection, updateDoc, getDocs, getDoc, deleteDoc, query, where, writeBatch, arrayUnion, arrayRemove, orderBy, limit, increment, runTransaction } from "firebase/firestore";
import { db } from "./firebaseConfig.js";
import { BOOKING_STATUS, MEMBER_STATUS } from '../constants/strings.js';

// --- AUTH & USER CREATION ---

export const createUserProfile = async (userId, data) => {
  try {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, {
      uid: userId,
      ...data,
      onboardingStep: 'step1_gymDetails',
      createdAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error creating user profile:", error);
    return { success: false, error: error.message };
  }
};

// --- GYM MANAGEMENT ---

export const createGym = async (gymData) => {
  try {
    const userId = gymData.ownerId;
    if (!userId) throw new Error("createGym failed: gymData object must include an ownerId field.");

    const gymRef = await addDoc(collection(db, "gyms"), {
      ...gymData,
      createdAt: new Date(),
    });

    const userRef = doc(db, "users", userId);
    await setDoc(userRef, {
      gymId: gymRef.id,
      role: 'owner'
    }, { merge: true });

    return { success: true, gymId: gymRef.id };
  } catch (error) {
    console.error("Error creating gym:", error);
    return { success: false, error: error.message };
  }
};

export const updateGymDetails = async (gymId, gymData) => {
  try {
    const gymRef = doc(db, "gyms", gymId);
    await updateDoc(gymRef, gymData);
    return { success: true };
  } catch (error) {
    console.error("Error updating gym details:", error);
    return { success: false, error: error.message };
  }
};

export const updateGymBranding = async (gymId, brandingData) => {
  try {
    const gymRef = doc(db, "gyms", gymId);
    await updateDoc(gymRef, brandingData);
    return { success: true };
  } catch (error) {
    console.error("Error updating gym branding:", error);
    return { success: false, error: error.message };
  }
};

export const getGymDetails = async (gymId) => {
  try {
    const gymRef = doc(db, "gyms", gymId);
    const docSnap = await getDoc(gymRef);

    if (docSnap.exists()) {
      return { success: true, gym: { id: docSnap.id, ...docSnap.data() } };
    } else {
      return { success: false, error: "No such gym found!" };
    }
  } catch (error) {
    console.error("Error fetching gym details:", error);
    return { success: false, error: error.message };
  }
};

export const updateUserOnboardingStep = async (userId, newStep) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      onboardingStep: newStep
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating user onboarding step:", error);
    return { success: false, error: error.message };
  }
};

// --- STAFF MANAGEMENT ---

export const addStaffMember = async (gymId, staffData) => {
  try {
    const staffCollectionRef = collection(db, "gyms", gymId, "staff");
    const payload = { ...staffData, createdAt: new Date() };
    const staffDocRef = await addDoc(staffCollectionRef, payload);
    return { success: true, staffMember: { id: staffDocRef.id, ...payload } };
  } catch (error) {
    console.error("Error adding staff member:", error);
    return { success: false, error: error.message };
  }
};

export const updateStaffMember = async (gymId, staffId, staffData) => {
  try {
    const staffDocRef = doc(db, "gyms", gymId, "staff", staffId);
    await updateDoc(staffDocRef, staffData);
    return { success: true };
  } catch (error) {
    console.error("Error updating staff member:", error);
    return { success: false, error: error.message };
  }
};

export const deleteStaffMember = async (gymId, staffId) => {
  try {
    const batch = writeBatch(db);
    const classesRef = collection(db, "gyms", gymId, "classes");
    const q = query(classesRef, where("instructorId", "==", staffId));
    const snapshot = await getDocs(q);

    snapshot.forEach((doc) => {
      batch.update(doc.ref, { instructorId: null });
    });

    const staffRef = doc(db, "gyms", gymId, "staff", staffId);
    batch.delete(staffRef);

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error deleting staff member:", error);
    return { success: false, error: error.message };
  }
};

export const checkStaffDependencies = async (gymId, staffId) => {
  try {
    const classesRef = collection(db, "gyms", gymId, "classes");
    const q = query(classesRef, where("instructorId", "==", staffId));
    const snapshot = await getDocs(q);
    return { success: true, count: snapshot.size, classes: snapshot.docs.map(d => d.id) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getStaffList = async (gymId) => {
  try {
    const staffCollectionRef = collection(db, "gyms", gymId, "staff");
    const snapshot = await getDocs(staffCollectionRef);
    const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, staffList };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// --- CLASS & SCHEDULE MANAGEMENT ---

export const createClass = async (gymId, classData) => {
  try {
    const classCollectionRef = collection(db, "gyms", gymId, "classes");
    const classDocRef = await addDoc(classCollectionRef, {
      ...classData,
      createdAt: new Date(),
    });
    return { success: true, classData: { id: classDocRef.id, ...classData } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getClasses = async (gymId) => {
  try {
    const classCollectionRef = collection(db, "gyms", gymId, "classes");
    const snapshot = await getDocs(classCollectionRef);
    const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, classList };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteClass = async (gymId, classId) => {
  try {
    const classDocRef = doc(db, "gyms", gymId, "classes", classId);
    await deleteDoc(classDocRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateClass = async (gymId, classId, classData) => {
  try {
    const classRef = doc(db, "gyms", gymId, "classes", classId);
    await updateDoc(classRef, classData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// --- MEMBERSHIP TIERS ---

export const createMembershipTier = async (gymId, tierData) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "membershipTiers");
    const payload = {
      ...tierData,
      stripeProductId: null,
      stripePriceId: null,
      active: true,
      createdAt: new Date()
    };
    const docRef = await addDoc(collectionRef, payload);
    return { success: true, tier: { id: docRef.id, ...payload } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getMembershipTiers = async (gymId) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "membershipTiers");
    const snapshot = await getDocs(collectionRef);
    const tiers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, tiers };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateMembershipTier = async (gymId, tierId, data) => {
  try {
    const docRef = doc(db, "gyms", gymId, "membershipTiers", tierId);
    await updateDoc(docRef, data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteMembershipTier = async (gymId, tierId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "membershipTiers", tierId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// --- MEMBER MANAGEMENT (UPDATED FOR ANALYTICS) ---

export const getGymMembers = async (gymId) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("gymId", "==", gymId),
      where("role", "==", "member")
    );
    const snapshot = await getDocs(q);
    const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, members };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Admin manually adds a member
export const addManualMember = async (gymId, memberData) => {
  try {
    const isStartingActive = memberData.status === 'active';

    // NEW: Create the membership object
    const newMembership = {
      gymId: gymId,
      role: 'member',
      status: memberData.status || 'prospect',
      membershipId: memberData.membershipId || null, // The specific plan for this gym
      joinedAt: new Date()
    };

    const userRef = await addDoc(collection(db, "users"), {
      ...memberData,
      gymId: gymId, // Keep as "Home Gym" for backward compatibility
      role: 'member',
      source: 'admin_manual',
      createdAt: new Date(),
      convertedAt: isStartingActive ? new Date() : null,
      status: memberData.status || 'prospect',
      waiverSigned: false,
      payerId: memberData.payerId || null,

      // --- NEW MULTI-GYM SUPPORT ---
      memberships: [newMembership]
    });

    return { success: true, member: { id: userRef.id, ...memberData } };
  } catch (error) {
    console.error("Error adding manual member:", error);
    return { success: false, error: error.message };
  }
};

// Update a member (Smart Timestamp Logic)
export const updateMemberProfile = async (memberId, data) => {
  try {
    const memberRef = doc(db, "users", memberId);

    // ANALYTICS LOGIC: Intercept status changes
    // We need to fetch current state first to compare, 
    // BUT to save reads, we can usually just blindly merge the timestamp if status is present.
    // However, to be precise, we'll assume the frontend calls this intentionally.

    const payload = { ...data };

    if (data.status === 'active') {
      // If updating to active, ensure convertedAt is set if not already
      // Note: Ideally we check if it was already set, but setting it again updates the "latest conversion"
      // For strictness, you'd check (status == 'trialing' && newStatus == 'active').
      // For MVP, we'll rely on the frontend sending the flag or just setting it.
      // A safer way is using serverTimestamp() or just passing it from frontend.
      // We will leave it to the UI/Logic layer to decide if this is a "New Conversion".
      // BUT, if the data payload doesn't have it, we can add a check in the component.
    }

    if (data.status === 'archived') {
      // Enforce cancelledAt if not provided
      if (!payload.canceledAt) {
        payload.canceledAt = new Date();
      }
    }

    await updateDoc(memberRef, payload);
    return { success: true };
  } catch (error) {
    console.error("Error updating member:", error);
    return { success: false, error: error.message };
  }
};

// NEW: Archive Member (Soft Delete for Analytics)
export const archiveMember = async (memberId, churnReason = "Unknown") => {
  try {
    const memberRef = doc(db, "users", memberId);
    await updateDoc(memberRef, {
      status: 'archived',
      canceledAt: new Date(),
      churnReason: churnReason
    });
    return { success: true };
  } catch (error) {
    console.error("Error archiving member:", error);
    return { success: false, error: error.message };
  }
};

// RENAMED: Hard Delete (For cleaning up prospects/mistakes)
export const deleteMember = async (memberId) => {
  try {
    // Warning: This destroys data. Use archiveMember for real churn.
    await deleteDoc(doc(db, "users", memberId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting member:", error);
    return { success: false, error: error.message };
  }
};

// --- FAMILY / LINKED ACCOUNTS ---

export const searchMembers = async (gymId, searchTerm) => {
  try {
    const usersRef = collection(db, "users");
    const term = searchTerm.toLowerCase().trim();

    const q = query(
      usersRef,
      where("gymId", "==", gymId),
      where("searchName", ">=", term),
      where("searchName", "<=", term + "\uf8ff")
    );

    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const linkFamilyMember = async (dependentId, payerId) => {
  try {
    const batch = writeBatch(db);

    const dependentRef = doc(db, "users", dependentId);
    batch.update(dependentRef, {
      payerId: payerId,
      dependents: []
    });

    const payerRef = doc(db, "users", payerId);
    batch.update(payerRef, {
      dependents: arrayUnion(dependentId)
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const unlinkFamilyMember = async (dependentId, payerId) => {
  try {
    const batch = writeBatch(db);

    const dependentRef = doc(db, "users", dependentId);
    batch.update(dependentRef, {
      payerId: null
    });

    const payerRef = doc(db, "users", payerId);
    batch.update(payerRef, {
      dependents: arrayRemove(dependentId)
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Checks a member into a class.
 * 1. Creates an attendance record.
 * 2. Increments the member's attendance counter for that specific program.
 */
export const recordAttendance = async (gymId, data) => {
  // data = { classId, className, memberId, memberName, programId, date, status }
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Create Reference for new Attendance Record
      const attendanceRef = doc(collection(db, "gyms", gymId, "attendance"));

      // 2. Get User Reference to update their counters
      const userRef = doc(db, "users", data.memberId);

      // 3. Set the Attendance Document
      transaction.set(attendanceRef, {
        ...data,
        createdAt: new Date(),
        status: data.status || 'attended', // 'booked', 'attended', 'no-show'
      });

      // 4. If status is 'attended', increment the user's progress
      if (data.status === 'attended' && data.programId) {
        // We use a map to track attendance per program: attendanceCounts.bjj_adult = 50
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

/**
 * Fetch history for a specific member (for the Profile Modal)
 */
export const getMemberAttendance = async (gymId, memberId) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("memberId", "==", memberId),
      // Sort by when the class actually happens, not when they booked it
      orderBy("classTimestamp", "desc"),
      limit(20)
    );

    const snapshot = await getDocs(q);
    return { success: true, history: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  } catch (error) {
    console.error("History fetch error:", error); // Log this to see index errors!
    return { success: false, error: error.message };
  }
};

/**
 * Fetch roster for a specific class instance (for the Admin Calendar view)
 */
export const getClassRoster = async (gymId, classId, dateString) => {
  // dateString should be "2023-10-27" (YYYY-MM-DD) to group by specific day
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

/**
 * 1. SEARCH: Client-Side filter for better UX (Case insensitive + Substring)
 * FETCHES ALL MEMBERS (Efficient for < 1000 members)
 * If scaling > 1000, you must implement Algolia or TypeSense.
 */
export const searchMembersForBooking = async (gymId, searchTerm) => {
  try {
    const usersRef = collection(db, "users");
    // Fetch ALL active members for this gym
    // In a real app, you might cache this result in Context or Redux to avoid re-fetching on every keystroke
    const q = query(
      usersRef,
      where("gymId", "==", gymId),
      where("role", "==", "member"),
      where("status", "in", ["active", "trialing", "prospect"]) // Only valid people
    );

    const snapshot = await getDocs(q);
    const allMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // NOW FILTER IN MEMORY (This allows "ee" to match "Dee")
    const lowerTerm = searchTerm.toLowerCase();
    const results = allMembers.filter(member =>
      member.name && member.name.toLowerCase().includes(lowerTerm)
    );

    // Limit to top 5 for UI
    return { success: true, members: results.slice(0, 5) };

  } catch (error) {
    console.error("Search error:", error);
    return { success: false, error: error.message };
  }
};

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
      // We start by letting "gatekeeper" decide the default access (Membership vs Credit)
      let gatekeeper = canUserBook(classData, userData, gymId);

      if (!gatekeeper.allowed && !options.force) {
        throw gatekeeper.reason;
      }

      // --- NEW: WEEKLY LIMIT CHECK ---
      // If the user is booking via Membership, check if they have hit their cap.
      if (gatekeeper.type === 'membership') {
        const userMembership = (userData.memberships || []).find(m => m.gymId === gymId);

        if (userMembership && userMembership.membershipId) {
          // We must READ the tier rule inside the transaction to be safe
          const tierRef = doc(db, "gyms", gymId, "membershipTiers", userMembership.membershipId);
          const tierSnap = await transaction.get(tierRef);

          if (tierSnap.exists()) {
            const tierData = tierSnap.data();
            const weeklyLimit = tierData.weeklyLimit;

            if (!isNaN(weeklyLimit) && weeklyLimit > 0) {
              // 1. Calculate Date Range for the requested class
              const { start, end } = getWeekRange(classInfo.dateString);

              // 2. Count existing bookings for this week
              // Note: Queries in transactions require an index usually, but for small collections it works.
              // Ideally, we'd store a counter on the user object, but querying is safer for data integrity.
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

              // 3. ENFORCE LIMIT
              if (classesThisWeek >= weeklyLimit && !options.force) {
                // They hit the limit! Can we fallback to credits?
                const creditCost = parseInt(classData.creditCost) || 0;
                const userCredits = parseInt(userData.classCredits) || 0;

                if (classData.dropInEnabled && creditCost > 0 && userCredits >= creditCost) {
                  // Downgrade to Credit Booking
                  gatekeeper = {
                    allowed: true,
                    type: 'credit',
                    cost: creditCost,
                    reason: `Weekly Limit Reached (${classesThisWeek}/${weeklyLimit}). Using Credits.`
                  };
                } else {
                  // Hard Stop
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

      // E. CREDIT DEDUCTION (If applicable / Downgraded)
      let costUsed = 0;
      if (gatekeeper.type === 'credit') {
        if (!options.force) {
          transaction.update(userDocRef, { classCredits: increment(-gatekeeper.cost) });
          costUsed = gatekeeper.cost;

          // ** LOG THE TRANSACTION **
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

// Helper: Get Date Strings for Start/End of current week (Monday to Sunday)
// Returns { start: "2023-10-23", end: "2023-10-29" }
const getWeekRange = (dateString) => {
  const [y, m, d] = dateString.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);

  // Normalize to Monday
  const day = targetDate.getDay();
  const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);

  const monday = new Date(targetDate);
  monday.setDate(diff);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // Format YYYY-MM-DD
  const format = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return { start: format(monday), end: format(sunday) };
};

/**
 * 3. CHECK-IN: Convert 'booked' to 'attended'
 * AUTOMATION: If Class has a programId AND User has no rank -> Assign Minimum Rank
 */
export const checkInMember = async (gymId, attendanceId, memberId, programId) => {
  try {
    const attRef = doc(db, "gyms", gymId, "attendance", attendanceId);
    const memberRef = doc(db, "users", memberId);

    // 1. Mark Attendance Record as Attended
    await updateDoc(attRef, {
      status: BOOKING_STATUS.ATTENDED,
      checkedInAt: new Date()
    });

    // 2. Prepare Base User Updates
    const userUpdates = {
      attendanceCount: increment(1),
      lastAttended: new Date()
    };

    // 3. --- RANK AUTOMATION LOGIC (UPDATED FOR MULTI-RANK MAP) ---
    if (programId) {
      const userSnap = await getDoc(memberRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const userRanks = userData.ranks || {}; // Access the map

        // SCENARIO A: User is ALREADY in this program
        if (userRanks[programId]) {
          // Increment credits specifically for this program path
          // Firestore Notation for nested map update: "ranks.programId.credits"
          userUpdates[`ranks.${programId}.credits`] = increment(1);
        }

        // SCENARIO B: User is NEW to this program (Assign White Belt)
        else {
          const gymDoc = await getDoc(doc(db, "gyms", gymId));
          if (gymDoc.exists()) {
            const gymData = gymDoc.data();
            const programs = gymData.grading?.programs || [];
            const targetProgram = programs.find(p => p.id === programId);

            if (targetProgram && targetProgram.ranks?.length > 0) {
              const firstRank = targetProgram.ranks[0];

              console.log(`Auto-assigning to ${targetProgram.name}`);

              // Initialize the map entry for this program
              // We use dot notation to update just this key in the map without overwriting others
              userUpdates[`ranks.${programId}`] = {
                rankId: firstRank.id,
                stripes: 0,
                credits: 1 // First class counts!
              };

              // Auto-convert prospect -> active
              if (userData.status === 'prospect') {
                userUpdates.status = 'active';
                userUpdates.convertedAt = new Date();
              }
            }
          }
        }
      }
    }

    // 4. Apply updates
    await updateDoc(memberRef, userUpdates);

    return { success: true };
  } catch (error) {
    console.error("Check-in error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 4. CANCEL BOOKING (Smart Cancel + Refund Logic)
 * Marks a booking as cancelled, refunds credit if applicable, and promotes waitlist.
 */
export const cancelBooking = async (gymId, attendanceId) => {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get the booking to be cancelled
      const attRef = doc(db, "gyms", gymId, "attendance", attendanceId);
      const attSnap = await transaction.get(attRef);

      if (!attSnap.exists()) throw "Booking not found.";
      const data = attSnap.data();

      // 2. Fetch Class Data (To get Cancellation Window Settings)
      const classRef = doc(db, "gyms", gymId, "classes", data.classId);
      const classSnap = await transaction.get(classRef);

      // Default to 120 minutes (2 hours) if not set in class settings
      const cancelWindowMinutes = classSnap.exists() && classSnap.data().cancellationWindow
        ? parseInt(classSnap.data().cancellationWindow)
        : 120;

      // 3. Time Calculation
      const now = new Date();
      const classTime = data.classTimestamp.toDate(); // Ensure Firestore Timestamp conversion
      const diffMs = classTime - now;
      const minutesUntilClass = Math.floor(diffMs / 60000);

      const isWaitlisted = data.status === BOOKING_STATUS.WAITLISTED;
      const isWithinSafeWindow = minutesUntilClass >= cancelWindowMinutes;

      // 4. REFUND LOGIC
      // Rule: Refund if (Waitlisted) OR (Paid with Credit AND Cancelled Early enough)
      let refundApplied = false;
      if (data.bookingType === 'credit' && data.costUsed > 0) {
        if (shouldRefund) {
          const userRef = doc(db, "users", data.memberId);
          transaction.update(userRef, { classCredits: increment(data.costUsed) });
          refundApplied = true;

          // ** LOG THE TRANSACTION **
          createCreditLog(
            transaction, 
            data.memberId, 
            data.costUsed, 
            'refund', 
            `Refund: ${data.className} (${options.isStaff ? 'Admin Cancel' : 'User Cancel'})`
          );
        }
      }

      // 5. Update Status
      const wasTakingSpot = data.status === BOOKING_STATUS.BOOKED || data.status === BOOKING_STATUS.ATTENDED;

      transaction.update(attRef, {
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        refunded: refundApplied,
        lateCancel: !isWithinSafeWindow && !isWaitlisted // Flag for analytics
      });

      // 6. If they were taking a spot, find the next waitlister
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
          // Promote them
          transaction.update(nextInLine.ref, {
            status: BOOKING_STATUS.BOOKED,
            promotedAt: new Date(),
            updatedAt: new Date()
          });
          // Note: We don't charge them here, because we charged them when they joined the waitlist
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return { success: false, error: error.message };
  }
};

// --- 4. NEW: Admin Adjust Credits ---
export const adjustUserCredits = async (userId, amount, reason, adminId) => {
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw "User not found";

      // Update Balance
      transaction.update(userRef, {
        classCredits: increment(amount)
      });

      // Write Log
      createCreditLog(
        transaction,
        userId,
        amount,
        'admin_adjustment',
        reason || 'Admin manual adjustment',
        adminId
      );
    });
    return { success: true };
  } catch (error) {
    console.error("Adjustment failed:", error);
    return { success: false, error: error.message };
  }
};

// --- 5. NEW: Get Credit History ---
export const getUserCreditHistory = async (userId) => {
  try {
    const logsRef = collection(db, "users", userId, "creditLogs");
    const q = query(logsRef, orderBy("createdAt", "desc"), limit(50));
    const snapshot = await getDocs(q);
    
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Helper for date formatting on frontend
      date: doc.data().createdAt?.toDate() 
    }));

    return { success: true, logs };
  } catch (error) {
    console.error("Fetch history failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * NEW: Fetch booking counts for a specific week range
 * Returns a map like: { "classId_2023-10-27": 5, "classId_2023-10-28": 2 }
 */
export const getWeeklyAttendanceCounts = async (gymId, startDateStr, endDateStr) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("dateString", ">=", startDateStr),
      where("dateString", "<=", endDateStr)
    );

    // We fetch the docs to count them. 
    // (Firestore "count()" aggregation is cheaper but harder to group by ID efficiently in one query)
    const snapshot = await getDocs(q);

    const counts = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      // Only count active bookings
      if (['booked', 'attended'].includes(data.status)) {
        // Create a unique key: CLASS_ID + "_" + DATE
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

export const canUserBook = (classData, userData, targetGymId) => {
  // 1. DEFINITIONS
  const allowedPlans = classData.allowedMembershipIds || [];
  const creditCost = parseInt(classData.creditCost) || 0; 
  let credits = parseInt(userData.classCredits) || 0;

  // 2. FIND THE MEMBERSHIP (The "System" Check)
  // Instead of relying on a top-level string, we look for the actual data object
  const relevantMembership = (userData.memberships || []).find(m => m.gymId === targetGymId);

  // Define what statuses grant access. 
  // You might want to include 'past_due' here if you allow grace periods.
  const VALID_ACCESS_STATUSES = ['active', 'trialing']; 

  // 3. CHECK MEMBERSHIP ACCESS
  if (relevantMembership) {
    // Normalize status to lowercase to avoid case-sensitivity bugs
    const memStatus = (relevantMembership.status || '').toLowerCase().trim();
    const planId = relevantMembership.membershipId;

    // A. Does this plan cover this class?
    const planCoversClass = allowedPlans.includes(planId);

    // B. Is the membership in good standing?
    const isGoodStanding = VALID_ACCESS_STATUSES.includes(memStatus);

    if (planCoversClass && isGoodStanding) {
       return { allowed: true, reason: "Membership Access", type: 'membership', cost: 0 };
    }
  }

  // 4. FALLBACK: CREDIT ACCESS / DROP-IN
  // If we reach here, they either don't have a membership, or it's cancelled/wrong plan.
  // We check for "Banned" explicitly on the USER level, but otherwise allow credits.
  
  if (userData.status !== 'banned') { // Only 'banned' hard-stops credits
      
      // Check Credits
      if (creditCost > 0 && credits >= creditCost) {
          return { 
            allowed: true, 
            reason: `${creditCost} Credit(s) applied`, 
            type: 'credit',
            cost: creditCost
          };
      }
      
      // Check Free Drop-in
      if (classData.dropInEnabled && creditCost === 0) {
        return { allowed: true, reason: "Open Registration", type: 'drop-in', cost: 0 };
      }
  }

  // 5. DENIAL
  let denialReason = "Membership required to book.";
  if (relevantMembership && allowedPlans.includes(relevantMembership.membershipId)) {
      // If they have the right plan but wrong status (e.g. Past Due)
      denialReason = `Your membership is currently ${relevantMembership.status}.`;
  } else if (creditCost > 0) {
      denialReason = `Insufficient Credits. (Requires ${creditCost}, you have ${credits})`;
  }

  return { allowed: false, reason: denialReason, type: 'denied', cost: creditCost };
};

/**
 * Calculates how many classes a user has booked/attended in the week of the target date.
 * UPDATE: Now returns the specific class details for UI display.
 */
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
      orderBy("classTimestamp", "asc") // Sort by time so the list looks nice
    );

    const snapshot = await getDocs(q);
    
    // Map the docs to a lightweight array for the UI
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
    
    return { 
      success: true, 
      count: snapshot.size, 
      classes: classes, // <--- New Data Field
      start, 
      end 
    };
  } catch (error) {
    console.error("Error counting weekly classes:", error);
    return { success: false, error: error.message };
  }
};

/**
 * COMPREHENSIVE PRE-FLIGHT CHECK
 * Fetches everything needed to render the Booking Modal.
 * FIX: Now fetches the authoritative Class Document to ensure 'allowedMembershipIds' is present.
 */
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
    // 0. FETCH AUTHORITATIVE CLASS DATA
    // The classInstance passed from props (calendar) might be a summary object.
    // We fetch the full doc to ensure we have the 'allowedMembershipIds' array.
    const classRef = doc(db, 'gyms', gymId, 'classes', classInstanceProp.id);
    const classSnap = await getDoc(classRef);

    // Merge: DB data overrides prop data, but we keep props (like dateString/time) 
    // because the class definition might be generic, but the instance has specific time.
    let authoritativeClassData = { ...classInstanceProp };
    if (classSnap.exists()) {
      const dbData = classSnap.data();
      authoritativeClassData = {
        ...classInstanceProp,
        ...dbData,
        // Ensure we keep the instance-specific date/time from the prop
        dateString: classInstanceProp.dateString,
        time: classInstanceProp.time
      };
    }

    // 1. Fetch Instructor Name if missing
    if (!result.instructorName && authoritativeClassData.instructorId) {
      const staffRef = doc(db, 'gyms', gymId, 'staff', authoritativeClassData.instructorId);
      const snap = await getDoc(staffRef);
      if (snap.exists()) result.instructorName = snap.data().name;
    }

    // 2. Fetch User Profile
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("User profile not found");

    const userData = userSnap.data();
    result.userProfile = userData;

    // 3. Resolve Specific Membership for this Gym
    const userMem = (userData.memberships || []).find(m => m.gymId === gymId);

    // 4. Run Base Eligibility
    // Use the AUTHORITATIVE class data (with the allowed arrays)
    let baseEligibility = canUserBook(authoritativeClassData, userData, gymId);

    // 5. Check Weekly Limits (Dynamic Check)
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
        // Warn but do not fail the whole booking if tier read fails
        console.warn("Could not read membership tier details:", err);
      }
    }

    result.eligibility = baseEligibility;

    // 6. Fetch Upsell Plans (If denied)
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

// (Internal helper to keep code clean)
const createCreditLog = (transaction, userId, amount, type, description, actorId = 'system') => {
  const logRef = doc(collection(db, "users", userId, "creditLogs"));
  transaction.set(logRef, {
    amount: amount, // +1 or -1
    type: type, // 'booking', 'refund', 'admin_adjustment', 'purchase'
    description: description,
    createdAt: new Date(),
    createdBy: actorId
  });
};

/**
 * 5. PROCESS WAITLIST (Batch Promotion)
 * Checks if there is capacity and promotes waitlisted users FIFO.
 * Returns the number of users promoted.
 */
export const processWaitlist = async (gymId, classId, dateString) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const attendanceRef = collection(db, "gyms", gymId, "attendance");

      // 1. Get Class Data for Capacity
      const classDocRef = doc(db, "gyms", gymId, "classes", classId);
      const classSnap = await transaction.get(classDocRef);
      if (!classSnap.exists()) throw "Class not found";
      const maxCapacity = parseInt(classSnap.data().maxCapacity) || 999;

      // 2. Get Current Roster Counts (Need to query via reads)
      // Note: In transactions, queries must be simple. We'll fetch all non-cancelled for this session.
      const q = query(
        attendanceRef,
        where("classId", "==", classId),
        where("dateString", "==", dateString)
      );
      const snapshot = await getDocs(q); // We await this inside to ensure consistency

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

      // 3. Sort Waitlist (FIFO) manually since we fetched all
      waitlist.sort((a, b) => {
        const dateA = a.data.bookedAt?.seconds || 0;
        const dateB = b.data.bookedAt?.seconds || 0;
        return dateA - dateB;
      });

      // 4. Determine how many spots to fill
      let spotsAvailable = maxCapacity - currentActive;
      let promotedCount = 0;

      // 5. Promote Loop
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
          break; // Class full again
        }
      }

      return { success: true, promoted: promotedCount };
    });
  } catch (error) {
    console.error("Process waitlist error:", error);
    return { success: false, error: error.message };
  }
};

export const getClassDetails = async (gymId, classId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "classes", classId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    }
    return { success: false, error: "Class not found" };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fetches list of gyms for the "Find a Gym" screen.
 * For MVP, limits to 20. Later we will add geo-location filtering.
 */
export const searchGyms = async (searchTerm = '') => {
  try {
    const gymsRef = collection(db, "gyms");
    let q;

    if (searchTerm) {
      // Simple name search
      q = query(
        gymsRef,
        where("name", ">=", searchTerm),
        where("name", "<=", searchTerm + "\uf8ff"),
        limit(20)
      );
    } else {
      q = query(gymsRef, limit(20));
    }

    const snapshot = await getDocs(q);
    const gyms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, gyms };
  } catch (error) {
    console.error("Error searching gyms:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Adds a user to a gym's membership list (Guest/Prospect status).
 */
export const joinGym = async (userId, gymId, gymName) => {
  try {
    const userRef = doc(db, "users", userId);

    // Create the membership object
    const newMembership = {
      gymId: gymId,
      gymName: gymName, // Cached for UI
      role: 'member',
      status: 'prospect', // Default to prospect until they pay/sign
      joinedAt: new Date()
    };

    // Atomically add to array and set as active if it's their first
    await updateDoc(userRef, {
      memberships: arrayUnion(newMembership),
      lastActiveGymId: gymId, // Switch them to this gym immediately
      // If they don't have a home gym yet, set it
      // (Note: Firestore can't conditionally set field based on current val in updateDoc easily without transaction, 
      // but for MVP updating 'gymId' here is safe)
      gymId: gymId
    });

    return { success: true };
  } catch (error) {
    console.error("Error joining gym:", error);
    return { success: false, error: error.message };
  }
};

export const disconnectGym = async (userId, gymId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    // Filter OUT the specific gym membership
    const updatedMemberships = (userData.memberships || []).filter(m => m.gymId !== gymId);

    // If they were currently viewing this gym, we should probably clear the lastActiveGymId
    // or let the frontend handle the redirect.
    await updateDoc(userRef, {
      memberships: updatedMemberships,
      gymId: updatedMemberships.length > 0 ? updatedMemberships[0].gymId : null
    });

    return { success: true };
  } catch (error) {
    console.error("Error disconnecting gym:", error);
    return { success: false, error: error.message };
  }
};

/**
 * GET NEXT UPCOMING CLASS (Compatible with Simple Data Model)
 * Works with: { days: ['Monday', 'Wednesday'], time: '18:00' }
 */
export const getNextUpcomingClass = async (gymId) => {
  try {
    const classesRef = collection(db, "gyms", gymId, "classes");
    const snapshot = await getDocs(classesRef);
    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (classes.length === 0) return { success: true, nextClass: null };

    const now = new Date();
    const currentDayIndex = now.getDay(); // 0=Sun, 1=Mon...
    const currentTimeValue = now.getHours() * 60 + now.getMinutes();

    const DAYS_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let upcomingInstances = [];

    classes.forEach(cls => {
      // --- 1. HANDLE SIMPLE MODEL (days array + single time) ---
      if (cls.days && Array.isArray(cls.days) && cls.time) {

        const [h, m] = cls.time.split(':').map(Number);
        const classTimeValue = h * 60 + m;

        cls.days.forEach(dayName => {
          const dayIndex = DAYS_MAP.indexOf(dayName.toLowerCase().trim());
          if (dayIndex === -1) return;

          let daysUntil = dayIndex - currentDayIndex;

          if (daysUntil < 0) {
            daysUntil += 7; // Next week
          } else if (daysUntil === 0) {
            // It's today! Has the time passed?
            if (classTimeValue < currentTimeValue) {
              daysUntil = 7; // Move to next week
            }
          }

          // Create the instance date
          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + daysUntil);
          targetDate.setHours(h, m, 0, 0);

          upcomingInstances.push({
            ...cls,
            instanceDate: targetDate,
            startTime: cls.time,
            duration: cls.duration || 60
          });
        });
      }

      // --- 2. HANDLE COMPLEX MODEL (schedule array - Legacy/Future support) ---
      else if (cls.schedule && Array.isArray(cls.schedule)) {
        // ... (Keep existing logic if you plan to support complex schedules later)
        cls.schedule.forEach(slot => {
          if (!slot.active) return;
          const dayIndex = DAYS_MAP.indexOf((slot.day || "").toLowerCase());
          if (dayIndex === -1 || !slot.startTime) return;

          const [h, m] = slot.startTime.split(':').map(Number);
          const slotTime = h * 60 + m;

          let daysUntil = dayIndex - currentDayIndex;
          if (daysUntil < 0) daysUntil += 7;
          else if (daysUntil === 0 && slotTime < currentTimeValue) daysUntil = 7;

          const targetDate = new Date(now);
          targetDate.setDate(now.getDate() + daysUntil);
          targetDate.setHours(h, m, 0, 0);

          upcomingInstances.push({
            ...cls,
            instanceDate: targetDate,
            startTime: slot.startTime,
            duration: slot.duration || 60
          });
        });
      }
    });

    // Sort by Date (Soonest first)
    upcomingInstances.sort((a, b) => a.instanceDate - b.instanceDate);

    // console.log("Next Class Winner:", upcomingInstances[0]);

    return { success: true, nextClass: upcomingInstances[0] || null };

  } catch (error) {
    console.error("Error fetching next class:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch a member's schedule for a specific date range.
 * Returns a map for easy lookup: { "classId_dateString": { status: 'booked', id: 'attID' } }
 */
export const getMemberSchedule = async (gymId, memberId, startDate, endDate) => {
  try {
    const attRef = collection(db, "gyms", gymId, "attendance");
    const q = query(
      attRef,
      where("memberId", "==", memberId),
      where("dateString", ">=", startDate),
      where("dateString", "<=", endDate),
      where("status", "in", ["booked", "waitlisted", "attended"]) // Ignore cancelled
    );

    const snapshot = await getDocs(q);
    const scheduleMap = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      // Key format matches what we generate in the UI
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

// --- WAIVER & COMPLIANCE ---
export const getGymWaiver = async (gymId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "settings", "legal");
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        success: true,
        waiverText: data.waiverText || "No waiver text configured.",
        tosText: data.tosText || "No terms of service configured.",
        enforceWaiver: data.enforceWaiverSignature !== false,
        version: data.version || 1,
        updatedAt: data.updatedAt || null
      };
    }

    return {
      success: true,
      waiverText: "Standard Liability Waiver...",
      tosText: "Standard Terms...",
      enforceWaiver: true,
      version: 1
    };
  } catch (error) {
    console.error("Error fetching waiver:", error);
    return { success: false, error: error.message };
  }
};

export const signWaiver = async (userId, gymId, version = 1) => {
  try {
    const userRef = doc(db, "users", userId);
    // We have to read-modify-write the array because Firestore can't update a specific object in an array easily
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    const memberships = userData.memberships || [];

    // Find and update the specific membership
    const updatedMemberships = memberships.map(m => {
      if (m.gymId === gymId) {
        return {
          ...m,
          waiverSigned: true,
          waiverSignedAt: new Date(),
          waiverSignedVersion: version
        };
      }
      return m;
    });

    await updateDoc(userRef, { memberships: updatedMemberships });
    return { success: true };
  } catch (error) {
    console.error("Error signing waiver:", error);
    return { success: false, error: error.message };
  }
};

export const updateLegalSettings = async (gymId, data) => {
  try {
    const legalRef = doc(db, "gyms", gymId, "settings", "legal");

    // 1. Determine Version
    const snap = await getDoc(legalRef);
    let nextVersion = 1;
    if (snap.exists()) {
      nextVersion = (snap.data().version || 0) + 1;
    }

    const timestamp = new Date();
    const payload = {
      ...data,
      version: nextVersion,
      updatedAt: timestamp
    };

    // 2. Update Main Document
    await setDoc(legalRef, payload, { merge: true });

    // 3. Save Snapshot to History Subcollection
    // Path: gyms/{gymId}/settings/legal/history/{version}
    const historyRef = doc(db, "gyms", gymId, "settings", "legal", "history", `v${nextVersion}`);
    await setDoc(historyRef, payload);

    return { success: true, version: nextVersion };
  } catch (error) {
    console.error("Error updating legal settings:", error);
    return { success: false, error: error.message };
  }
};

// --- LEGAL SETTINGS READER (ADMIN) ---
export const getLegalSettings = async (gymId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "settings", "legal");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    }
    return { success: true, data: {} }; // Return empty obj if not set yet
  } catch (error) {
    console.error("Error fetching legal settings:", error);
    return { success: false, error: error.message };
  }
};

export const getLegalHistory = async (gymId) => {
  try {
    const historyRef = collection(db, "gyms", gymId, "settings", "legal", "history");
    const q = query(historyRef, orderBy("version", "desc")); // Newest first
    const querySnapshot = await getDocs(q);

    const history = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, history };
  } catch (error) {
    console.error("Error fetching legal history:", error);
    return { success: false, error: error.message };
  }
};