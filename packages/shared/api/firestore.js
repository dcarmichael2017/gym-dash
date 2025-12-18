import { doc, setDoc, addDoc, collection, updateDoc, getDocs, getDoc, deleteDoc, query, where, writeBatch, arrayUnion, arrayRemove, orderBy, limit, increment } from "firebase/firestore";
import { db } from "./firebaseConfig.js";

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
    // ANALYTICS LOGIC: If adding as active immediately, set convertedAt
    const isStartingActive = memberData.status === 'active';

    const userRef = await addDoc(collection(db, "users"), {
      ...memberData,
      gymId: gymId,
      role: 'member',
      source: 'admin_manual',
      createdAt: new Date(),
      // Track conversion immediately if they skip trial
      convertedAt: isStartingActive ? new Date() : null,
      status: memberData.status || 'prospect',
      waiverSigned: false,
      payerId: memberData.payerId || null
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
 * 2. BOOK: Add a member to the roster
 * UPDATED: Handles re-booking a previously cancelled member.
 */
export const bookMember = async (gymId, classData, member) => {
  try {
    const attendanceRef = collection(db, "gyms", gymId, "attendance");

    const [year, month, day] = classData.dateString.split('-').map(Number);
    const [hours, minutes] = classData.time.split(':').map(Number);
    const classDateObj = new Date(year, month - 1, day, hours, minutes);

    // A. Check if record exists (Booked, Attended, OR Cancelled)
    const q = query(
      attendanceRef,
      where("classId", "==", classData.id),
      where("dateString", "==", classData.dateString),
      where("memberId", "==", member.id)
    );

    const existingSnapshot = await getDocs(q);

    // B. Handle Existing Record
    if (!existingSnapshot.empty) {
      const docSnap = existingSnapshot.docs[0];
      const existingData = docSnap.data();

      // SCENARIO 1: They are cancelled -> Resurrect them
      if (existingData.status === 'cancelled') {
        await updateDoc(docSnap.ref, {
          status: 'booked',
          cancelledAt: null, // Clear the timestamp
          updatedAt: new Date()
        });
        // Return the updated object so UI can use it
        return { success: true, booking: { id: docSnap.id, ...existingData, status: 'booked' } };
      }

      // SCENARIO 2: They are already booked/attended
      return { success: false, error: "Member is already in this class." };
    }

    // C. Create New Record (Standard Path)

    const newBooking = {
      classId: classData.id,
      className: classData.name,
      instructorName: classData.instructorName || null,
      dateString: classData.dateString,
      classTime: classData.time,
      classTimestamp: classDateObj, // Ensure this Date object is valid

      memberId: member.id,
      // CRITICAL: Ensure this is reading the 'name' property we fixed in the Modal
      memberName: member.name || "Unknown Member",
      memberPhoto: member.photoUrl || null,

      status: 'booked',
      createdAt: new Date()
    };

    const docRef = await addDoc(attendanceRef, newBooking);
    // Return the FULL object so the UI updates instantly with the name
    return { success: true, booking: { id: docRef.id, ...newBooking } };

  } catch (error) {
    console.error("Booking error:", error);
    return { success: false, error: error.message };
  }
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
      status: 'attended',
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
 * 4. CANCEL BOOKING: Mark a booking as cancelled
 * We update the status instead of deleting to keep a record.
 */
export const cancelBooking = async (gymId, attendanceId) => {
  try {
    const attRef = doc(db, "gyms", gymId, "attendance", attendanceId);
    await updateDoc(attRef, {
      status: 'cancelled',
      cancelledAt: new Date()
    });
    return { success: true };
  } catch (error) {
    console.error("Error cancelling booking:", error);
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