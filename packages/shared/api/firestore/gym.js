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

    // ✅ FIX: Always set BOTH gymId (legacy) AND gymIds (new standard)
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, {
      gymId: gymRef.id,
      [`gymIds.${gymRef.id}`]: true,  // ✅ NEW: Multi-gym support
      lastActiveGymId: gymRef.id,     // ✅ NEW: Track active gym
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
    const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
    await updateDoc(membershipRef, { 
      waiverSigned: true,
      waiverSignedAt: new Date(),
      waiverSignedVersion: version,
      updatedAt: new Date()
    });
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
