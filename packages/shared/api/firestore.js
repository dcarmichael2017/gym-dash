// /packages/shared/api/firestore.js

import { doc, setDoc, addDoc, collection, updateDoc, getDocs, getDoc, deleteDoc } from "firebase/firestore";
// Import the already-initialized db service from our new central file
import { db } from "./firebaseConfig.js";

// Creates a new user document in the 'users' collection
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

// Creates a new gym and links it to the owner
export const createGym = async (gymData) => {
  try {
    // 1. Extract the ownerId from the gymData object.
    // This is required for Step 2 (updating the user).
    const userId = gymData.ownerId;

    // Safety check to ensure the frontend is sending the required data
    if (!userId) {
      throw new Error("createGym failed: gymData object must include an ownerId field.");
    }

    // 2. Create a new document in the 'gyms' collection
    // We spread the entire gymData object, which already includes the
    // ownerId, thus satisfying the security rule.
    const gymRef = await addDoc(collection(db, "gyms"), {
      ...gymData,
      createdAt: new Date(),
    });

    // 3. Update the user's profile to link them to the new gym
    const userRef = doc(db, "users", userId); // Use the extracted userId
    await setDoc(userRef, {
      gymId: gymRef.id, // The ID of the newly created gym document
      role: 'owner'
    }, { merge: true }); // merge: true prevents overwriting the whole user doc

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

// Fetches the details for a single gym document
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

// Adds a new staff member to a gym's staff sub-collection
export const addStaffMember = async (gymId, staffData) => {
  try {
    const staffCollectionRef = collection(db, "gyms", gymId, "staff");
    const staffDocRef = await addDoc(staffCollectionRef, {
      ...staffData,
      createdAt: new Date(),
    });
    // Return the full staff object including the new ID
    return { success: true, staffMember: { id: staffDocRef.id, ...staffData } };
  } catch (error) {
    console.error("Error adding staff member:", error);
    return { success: false, error: error.message };
  }
};

// Deletes a staff member
export const deleteStaffMember = async (gymId, staffId) => {
  try {
    const staffDocRef = doc(db, "gyms", gymId, "staff", staffId);
    await deleteDoc(staffDocRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting staff member:", error);
    return { success: false, error: error.message };
  }
};

// Fetches all staff members for a given gym
export const getStaffList = async (gymId) => {
  try {
    const staffCollectionRef = collection(db, "gyms", gymId, "staff");
    const snapshot = await getDocs(staffCollectionRef);
    const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, staffList };
  } catch (error) {
    console.error("Error fetching staff list:", error);
    return { success: false, error: error.message };
  }
};

// Adds a new class to a gym's classes sub-collection
export const createClass = async (gymId, classData) => {
  try {
    const classCollectionRef = collection(db, "gyms", gymId, "classes");
    const classDocRef = await addDoc(classCollectionRef, {
      ...classData,
      createdAt: new Date(),
    });
    return { success: true, classData: { id: classDocRef.id, ...classData } };
  } catch (error) {
    console.error("Error creating class:", error);
    return { success: false, error: error.message };
  }
};

// Fetches all classes for a given gym
export const getClasses = async (gymId) => {
    try {
      const classCollectionRef = collection(db, "gyms", gymId, "classes");
      const snapshot = await getDocs(classCollectionRef);
      const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { success: true, classList };
    } catch (error) {
      console.error("Error fetching class list:", error);
      return { success: false, error: error.message };
    }
};

// Deletes a class from a gym's schedule
export const deleteClass = async (gymId, classId) => {
  try {
    const classDocRef = doc(db, "gyms", gymId, "classes", classId);
    await deleteDoc(classDocRef);
    return { success: true };
  } catch (error) {
    console.error("Error deleting class:", error);
    return { success: false, error: error.message };
  }
};

