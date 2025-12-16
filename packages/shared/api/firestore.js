import { doc, setDoc, addDoc, collection, updateDoc, getDocs, getDoc, deleteDoc, query, where, writeBatch, arrayUnion, arrayRemove } from "firebase/firestore";
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
      orderBy("createdAt", "desc"),
      limit(20) // Only fetch last 20 for the modal
    );
    
    const snapshot = await getDocs(q);
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, history };
  } catch (error) {
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