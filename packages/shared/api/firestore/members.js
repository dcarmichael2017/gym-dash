import { doc, addDoc, collection, updateDoc, getDocs, deleteDoc, query, where, writeBatch, arrayUnion, arrayRemove, getDoc, orderBy } from "firebase/firestore";
import { db } from "../firebaseConfig";

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
        const historyRef = collection(db, 'users', userId, 'membershipHistory');
        const q = query(
            historyRef,
            where("gymId", "==", gymId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, history };
    } catch (error) {
        console.error("Error fetching membership history:", error);
        return { success: false, error: error.message };
    }
}

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

export const cancelUserMembership = async (userId, gymId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found.");
    }

    const userData = userSnap.data();
    const memberships = userData.memberships || [];
    
    let membershipUpdated = false;
    const updatedMemberships = memberships.map(mem => {
      // Find the membership for the current gym to cancel.
      if (mem.gymId === gymId) {
        membershipUpdated = true;
        // Set the flag to indicate cancellation at period end.
        return { ...mem, cancelAtPeriodEnd: true };
      }
      return mem;
    });

    if (!membershipUpdated) {
        // This case should ideally not be hit if called from a valid context.
        throw new Error("No active membership found for this gym.");
    }
    
    // Update the entire memberships array on the user's document.
    await updateDoc(userRef, { memberships: updatedMemberships });
    
    return { success: true };
  } catch (error) {
    console.error("Error cancelling membership:", error);
    return { success: false, error: error.message };
  }
};

export const adminCancelUserMembership = async (userId, gymId, reason = "Cancelled by admin") => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("User not found.");

    const userData = userSnap.data();
    const memberships = userData.memberships || [];
    
    const updatedMemberships = memberships.map(mem => {
      if (mem.gymId === gymId) {
        return { 
          ...mem, 
          status: 'prospect',
          membershipId: null,
          membershipName: null,
          price: 0,
          assignedPrice: null,
          cancelAtPeriodEnd: false,
          cancellationReason: reason,
          cancelledAt: new Date().toISOString()
        };
      }
      return mem;
    });

    await updateDoc(userRef, { 
        memberships: updatedMemberships,
        status: 'prospect',
        membershipId: null,
        membershipName: null,
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
    const isStartingActive = memberData.status === 'active';

    const newMembership = {
      gymId: gymId,
      role: 'member',
      status: memberData.status || 'prospect',
      membershipId: memberData.membershipId || null, 
      joinedAt: new Date()
    };

    const userRef = await addDoc(collection(db, "users"), {
      ...memberData,
      gymId: gymId,
      role: 'member',
      source: 'admin_manual',
      createdAt: new Date(),
      convertedAt: isStartingActive ? new Date() : null,
      status: memberData.status || 'prospect',
      waiverSigned: false,
      payerId: memberData.payerId || null,
      memberships: [newMembership]
    });

    return { success: true, member: { id: userRef.id, ...memberData } };
  } catch (error) {
    console.error("Error adding manual member:", error);
    return { success: false, error: error.message };
  }
};

export const updateMemberProfile = async (memberId, data) => {
  try {
    const memberRef = doc(db, "users", memberId);
    const payload = { ...data };

    if (data.status === 'archived') {
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

export const searchMembersForBooking = async (gymId, searchTerm) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("gymId", "==", gymId),
      where("role", "==", "member"),
      where("status", "in", ["active", "trialing", "prospect"]) 
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
