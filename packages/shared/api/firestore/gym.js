import { doc, setDoc, addDoc, collection, updateDoc, getDocs, getDoc, query, where, limit, arrayUnion } from "firebase/firestore";
import { db } from "../firebaseConfig";

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

export const searchGyms = async (searchTerm = '') => {
  try {
    const gymsRef = collection(db, "gyms");
    let q;

    if (searchTerm) {
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

export const joinGym = async (userId, gymId, gymName) => {
  try {
    const userRef = doc(db, "users", userId);

    const newMembership = {
      gymId: gymId,
      gymName: gymName, 
      role: 'member',
      status: 'prospect', 
      joinedAt: new Date()
    };

    await updateDoc(userRef, {
      memberships: arrayUnion(newMembership),
      lastActiveGymId: gymId, 
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
    const updatedMemberships = (userData.memberships || []).filter(m => m.gymId !== gymId);

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

// --- WAIVER & LEGAL ---

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
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    const memberships = userData.memberships || [];

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

    await setDoc(legalRef, payload, { merge: true });

    const historyRef = doc(db, "gyms", gymId, "settings", "legal", "history", `v${nextVersion}`);
    await setDoc(historyRef, payload);

    return { success: true, version: nextVersion };
  } catch (error) {
    console.error("Error updating legal settings:", error);
    return { success: false, error: error.message };
  }
};

export const getLegalSettings = async (gymId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "settings", "legal");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    }
    return { success: true, data: {} }; 
  } catch (error) {
    console.error("Error fetching legal settings:", error);
    return { success: false, error: error.message };
  }
};

export const getLegalHistory = async (gymId) => {
  try {
    const historyRef = collection(db, "gyms", gymId, "settings", "legal", "history");
    const q = query(historyRef, orderBy("version", "desc")); 
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