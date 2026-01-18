import { doc, addDoc, collection, updateDoc, getDocs, deleteDoc, query, where, writeBatch, arrayUnion, arrayRemove, getDoc, orderBy, setDoc, deleteField, collectionGroup, limit } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

// --- MEMBER MANAGEMENT ---

export const logMembershipHistory = async (userId, gymId, description, actorId = 'system') => {
  try {
    const logRef = collection(db, 'users', userId, 'membershipHistory');
    await addDoc(logRef, {
      gymId,
      description,
      actorId,
      createdAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error logging membership history:", error);
    return { success: false, error: error.message };
  }
};

export const getMembershipHistory = async (userId, gymId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    const historyRef = collection(db, 'users', userId, 'membershipHistory');
    const q = query(
      historyRef,
      where("gymId", "==", gymId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, history };

  } catch (error) {
    console.error('[getMembershipHistory] Error:', error.message);

    if (error.code === 'permission-denied') {
      console.error('[getMembershipHistory] Permission denied - check Firestore rules');
    }

    return { success: false, error: error.message };
  }
}

export const getGymMembers = async (gymId) => {
  try {
    const membershipsRef = collectionGroup(db, "memberships");

    const q = query(
      membershipsRef,
      where("gymId", "==", gymId)
    );

    const snapshot = await getDocs(q);

    // Extract parent user IDs from the paths
    const userIds = snapshot.docs.map(doc => {
      const pathParts = doc.ref.path.split('/');
      return pathParts[1]; // userId is at index 1
    });

    const uniqueUserIds = [...new Set(userIds)];

    // Fetch user documents AND their membership data
    const members = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          // Fetch the membership subcollection document
          const membershipRef = doc(db, "users", userId, "memberships", gymId);
          const membershipSnap = await getDoc(membershipRef);

          return {
            id: userSnap.id,
            ...userSnap.data(),
            // Add membership data from subcollection
            currentMembership: membershipSnap.exists() ? membershipSnap.data() : null
          };
        }
        return null;
      })
    );

    const validMembers = members.filter(m => m !== null);

    return { success: true, members: validMembers };
  } catch (error) {
    console.error("getGymMembers error:", error);
    return { success: false, error: error.message };
  }
};

export const cancelUserMembership = async (userId, gymId) => {
  try {
    const membershipRef = doc(db, 'users', userId, 'memberships', gymId);

    await updateDoc(membershipRef, {
      cancelAtPeriodEnd: true,
      updatedAt: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error("Error cancelling membership:", error);
    return { success: false, error: error.message };
  }
};

export const adminCancelUserMembership = async (userId, gymId, reason = "Cancelled by admin") => {
  try {
    const membershipRef = doc(db, 'users', userId, 'memberships', gymId);

    await updateDoc(membershipRef, {
      status: 'inactive',
      membershipId: null,
      membershipName: null,
      price: 0,
      cancelAtPeriodEnd: false,
      cancellationReason: reason,
      cancelledAt: new Date(),
      updatedAt: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error("Error cancelling membership for admin:", error);
    return { success: false, error: error.message };
  }
};

// Admin manually adds a member
export const addManualMember = async (gymId, memberData) => {
  try {
    // 1. Create the user document (CLEAN - no membership fields)
    const userRef = await addDoc(collection(db, "users"), {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      name: `${memberData.firstName} ${memberData.lastName}`,
      searchName: `${memberData.firstName} ${memberData.lastName}`.toLowerCase(),
      email: memberData.email,
      phoneNumber: memberData.phoneNumber || '',
      emergencyName: memberData.emergencyName || '',
      emergencyPhone: memberData.emergencyPhone || '',

      // Role & metadata
      role: 'member',
      source: 'admin_manual',
      createdAt: new Date(),

      // Summary fields only (for querying)
      gymIds: { [gymId]: true },  // ✅ Direct object creation works in addDoc
      lastActiveGymId: gymId,

      // Family
      payerId: memberData.payerId || null,
      dependents: [],

      // Other personal fields
      photoUrl: memberData.photoUrl || null,
      programId: memberData.programId || null,
      rankId: memberData.rankId || null,
      ranks: {},
      stripes: null,
      rankCredits: null,
    });

    // 2. Create the membership document in the subcollection
    const membershipRef = doc(db, 'users', userRef.id, 'memberships', gymId);

    const isStartingActive = memberData.status === 'active';
    const hasTrialDays = memberData.trialDays && parseInt(memberData.trialDays) > 0;

    const membershipData = {
      gymId: gymId,
      gymName: memberData.gymName || '',

      // Status
      status: isStartingActive ? 'active' : (hasTrialDays ? 'trialing' : 'prospect'),

      // Plan details
      membershipId: memberData.membershipId || null,
      membershipName: memberData.planName || null,
      price: parseFloat(memberData.customPrice || memberData.price || 0),
      interval: memberData.interval || 'month',

      // Dates
      joinedAt: new Date(),
      startDate: memberData.startDate || new Date(),

      // Waiver
      waiverSigned: false,
      waiverSignedVersion: 0,

      // Billing
      cancelAtPeriodEnd: false,

      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add trial end date if applicable
    if (hasTrialDays) {
      const trialDays = parseInt(memberData.trialDays);
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      membershipData.trialEndDate = trialEndDate.toISOString();
    }

    await setDoc(membershipRef, membershipData);

    // 3. Log the membership creation
    await logMembershipHistory(
      userRef.id,
      gymId,
      `Member manually added by admin with ${membershipData.status} status.`,
      auth.currentUser?.uid || 'system'
    );

    return { success: true, member: { id: userRef.id, ...memberData } };
  } catch (error) {
    console.error("Error adding manual member:", error);
    return { success: false, error: error.message };
  }
};

export const updateMemberProfile = async (memberId, data) => {
  try {
    const memberRef = doc(db, "users", memberId);

    // Only allow updating personal fields, not membership fields
    const allowedFields = {
      firstName: data.firstName,
      lastName: data.lastName,
      name: data.name,
      searchName: data.searchName,
      phoneNumber: data.phoneNumber,
      emergencyName: data.emergencyName,
      emergencyPhone: data.emergencyPhone,
      photoUrl: data.photoUrl,
      programId: data.programId,
      rankId: data.rankId,
    };

    // Remove undefined values
    const payload = Object.fromEntries(
      Object.entries(allowedFields).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(memberRef, payload);
    return { success: true };
  } catch (error) {
    console.error("Error updating member:", error);
    return { success: false, error: error.message };
  }
};

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

export const deleteMember = async (memberId) => {
  try {
    await deleteDoc(doc(db, "users", memberId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting member:", error);
    return { success: false, error: error.message };
  }
};

export const searchMembers = async (gymId, searchTerm) => {
  try {
    const usersRef = collection(db, "users");
    const term = searchTerm.toLowerCase().trim();

    // Query users that have an entry in their gymIds map for the specific gymId
    const q = query(
      usersRef,
      where(`gymIds.${gymId}`, "==", true), // Filter by gym association
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

export const joinGym = async (userId, gymId, gymName) => {
  try {
    const userRef = doc(db, "users", userId);

    // 1. Create the membership document in the subcollection
    const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
    await setDoc(membershipRef, {
      gymId: gymId,
      gymName: gymName,

      status: 'prospect',
      membershipId: null,
      membershipName: null,
      price: 0,
      interval: 'month',

      joinedAt: new Date(),
      startDate: new Date(),

      waiverSigned: false,
      waiverSignedVersion: 0,

      cancelAtPeriodEnd: false,

      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Update summary fields on the parent user document
    // ✅ FIX: Use updateDoc instead of setDoc for nested field paths
    await updateDoc(userRef, {
      [`gymIds.${gymId}`]: true,  // ✅ Now creates proper nested structure
      lastActiveGymId: gymId,
      role: 'member'
    });

    // 3. Log the event
    await logMembershipHistory(userId, gymId, `Joined gym ${gymName}.`, userId);

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
    if (!userSnap.exists()) throw new Error("User not found.");

    const membershipRef = doc(db, "users", userId, "memberships", gymId);

    // 1. Delete the specific membership document from the subcollection
    await deleteDoc(membershipRef);

    // 2. Remove the gymId from the top-level user's gymIds map
    const updates = {
      [`gymIds.${gymId}`]: deleteField()
    };

    // 3. Adjust lastActiveGymId and top-level gymId if they pointed to the disconnected gym
    const userData = userSnap.data();
    if (userData.lastActiveGymId === gymId) {
      updates.lastActiveGymId = null; // Or find another active gym, for now, null
    }
    if (userData.gymId === gymId) {
      updates.gymId = null; // Same logic as above
    }

    await updateDoc(userRef, updates);

    // 4. Log the event
    await logMembershipHistory(userId, gymId, `Disconnected from gym.`, userId);

    return { success: true };
  } catch (error) {
    console.error("Error disconnecting gym:", error);
    return { success: false, error: error.message };
  }
};

export const searchMembersForBooking = async (gymId, searchTerm) => {
  try {
    const usersRef = collection(db, "users");
    // Query users that have an entry in their gymIds map for the specific gymId
    const q = query(
      usersRef,
      where(`gymIds.${gymId}`, "==", true), // Filter by gym association
      where("role", "==", "member"),
      where("status", "in", ["active", "trialing", "prospect"]) // These are top-level statuses, might need refinement if status is only in subcollection
    );

    const snapshot = await getDocs(q);
    const allMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lowerTerm = searchTerm.toLowerCase();
    const results = allMembers.filter(member =>
      member.name && member.name.toLowerCase().includes(lowerTerm)
    );

    return { success: true, members: results.slice(0, 5) };

  } catch (error) {
    console.error("Search error:", error);
    return { success: false, error: error.message };
  }
};

export const updateMemberMembership = async (userId, gymId, membershipData) => {
  try {
    const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
    
    const updates = {
      ...membershipData,
      updatedAt: new Date()
    };
    
    await updateDoc(membershipRef, updates);
    
    // Log the change
    const description = `Membership updated: ${Object.keys(membershipData).join(', ')}`;
    await logMembershipHistory(userId, gymId, description, auth.currentUser?.uid || 'system');
    
    return { success: true };
  } catch (error) {
    console.error("Error updating membership:", error);
    return { success: false, error: error.message };
  }
};

export const runPermissionDiagnostics = async (targetGymId) => {
  console.group("🕵️‍♂️ FIRESTORE PERMISSIONS DIAGNOSTIC v2");
  
  const adminUser = auth.currentUser;
  
  if (!adminUser) {
    console.error("❌ No user logged in to Auth.");
    console.groupEnd();
    return;
  }

  console.log(`👤 Auth User UID: ${adminUser.uid}`);
  console.log(`🎯 Target Gym ID: ${targetGymId}`);

  // --- STEP 1: INSPECT ADMIN PROFILE ---
  try {
    const adminRef = doc(db, "users", adminUser.uid);
    const adminSnap = await getDoc(adminRef);
    
    if (adminSnap.exists()) {
      const data = adminSnap.data();
      console.log("✅ Admin Profile [READ SUCCESS]:");
      console.log("Raw data:", data);
      console.table({
        role: data.role,
        gymId: data.gymId,
        gymIdsKeys: data.gymIds ? Object.keys(data.gymIds).join(", ") : "NONE",
        hasTargetGym: data.gymIds && data.gymIds[targetGymId] ? "YES ✅" : "NO ❌"
      });

      // DIAGNOSIS:
      if (data.role !== 'owner' && data.role !== 'staff' && data.role !== 'coach') {
        console.error("🚨 CRITICAL: Admin 'role' is not recognized by rules.");
      }
      if (data.gymId !== targetGymId) {
        console.warn(`⚠️ WARNING: Admin 'gymId' (${data.gymId}) does not match Target Gym (${targetGymId}).`);
      }
      if (!data.gymIds || !data.gymIds[targetGymId]) {
        console.error("🚨 CRITICAL: Target Gym ID is missing from Admin 'gymIds' map.");
      } else {
        console.log("✅ Admin has correct gymIds setup!");
      }

    } else {
      console.error("❌ Admin Profile Document DOES NOT EXIST. This is fatal.");
    }
  } catch (e) {
    console.error("❌ FAILED to read Admin Profile:", e);
  }

  // --- STEP 2: INSPECT A MEMBERSHIP ---
  console.log("\n--- Testing Membership Subcollection Access ---");
  try {
    const memQuery = query(
      collectionGroup(db, 'memberships'), 
      where('gymId', '==', targetGymId),
      limit(1)
    );
    
    const memSnap = await getDocs(memQuery);
    
    if (memSnap.empty) {
      console.warn("⚠️ Query worked, but returned 0 results. (No members in this gym yet?)");
    } else {
      const memDoc = memSnap.docs[0];
      console.log("✅ Membership Query [READ SUCCESS]");
      console.log("📄 Sample Membership Data:", memDoc.data());
      console.log("📍 Path:", memDoc.ref.path);
      
      // --- STEP 3: INSPECT THE PARENT MEMBER ---
      const parentId = memDoc.ref.path.split('/')[1];
      console.log(`\n--- Testing Parent User Access (UID: ${parentId}) ---`);
      
      try {
        const parentSnap = await getDoc(doc(db, "users", parentId));
        if (parentSnap.exists()) {
           const memberData = parentSnap.data();
           console.log("✅ Parent Member Profile [READ SUCCESS]");
           console.log("Raw member data:", memberData);
           console.table({
             role: memberData.role,
             gymId: memberData.gymId || "NONE",
             gymIdsKeys: memberData.gymIds ? Object.keys(memberData.gymIds).join(", ") : "NONE",
             hasTargetGym: memberData.gymIds && memberData.gymIds[targetGymId] ? "YES ✅" : "NO ❌"
           });
           
           // Additional checks
           if (!memberData.gymIds || !memberData.gymIds[targetGymId]) {
             console.error("🚨 MEMBER ISSUE: Member doesn't have targetGymId in their gymIds map!");
             console.log("This is why managesUser() is failing!");
           }
        } else {
           console.log("⚠️ Parent Profile missing (Data Integrity Issue)");
        }
      } catch (parentErr) {
        console.error("❌ FAILED to read Parent Member Profile.");
        console.error("   Error:", parentErr.message);
        console.error("   This means 'managesUser' or 'allow get' rule failed.");
      }
    }
  } catch (e) {
    console.error("❌ Membership CollectionGroup Query FAILED.");
    console.error("   Error:", e.message);
  }

  console.groupEnd();
};