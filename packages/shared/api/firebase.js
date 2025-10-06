// // This is the new, single source of truth for all Firebase interactions.

// // CRITICAL: Import service modules for their side-effects to ensure registration.
// import 'firebase/auth';
// import 'firebase/firestore';
// import 'firebase/storage';

// import { initializeApp, getApps, getApp } from "firebase/app";
// import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
// import { getFirestore, doc, setDoc, addDoc, collection, updateDoc, getDocs, getDoc, deleteDoc } from "firebase/firestore";
// import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// // --- 1. INITIALIZATION ---
// const firebaseConfig = {
//   apiKey: "AIzaSyB1Gqh9nheKlvHvKz423p7fcMnR-6AwWy8",
//   authDomain: "gymdash-4e911.firebaseapp.com",
//   projectId: "gymdash-4e911",
//   storageBucket: "gymdash-4e911.firebasestorage.app",
//   messagingSenderId: "463663738859",
//   appId: "1:463663738859:web:bc322e57eb96ae5aafb3ae",
//   measurementId: "G-06K7E6518J"
// };

// const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// const auth = getAuth(app);
// const db = getFirestore(app);
// const storage = getStorage(app);

// console.log("✅ All-in-one Firebase service module initialized.");

// // --- 2. AUTH FUNCTIONS ---
// export const signUpWithEmail = async (email, password) => {
//   try {
//     const userCredential = await createUserWithEmailAndPassword(auth, email, password);
//     return { success: true, user: userCredential.user };
//   } catch (error) {
//     console.error("Sign up error:", error);
//     return { success: false, error: error.message };
//   }
// };

// // --- 3. FIRESTORE FUNCTIONS ---
// export const createUserProfile = async (userId, data) => {
//   try {
//     const userRef = doc(db, "users", userId);
//     await setDoc(userRef, { uid: userId, ...data, createdAt: new Date() });
//     return { success: true };
//   } catch (error) {
//     console.error("Error creating user profile:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const createGym = async (userId, gymData) => {
//   try {
//     const gymRef = await addDoc(collection(db, "gyms"), { ownerId: userId, ...gymData, createdAt: new Date() });
//     const userRef = doc(db, "users", userId);
//     await setDoc(userRef, { gymId: gymRef.id, role: 'owner' }, { merge: true });
//     return { success: true, gymId: gymRef.id };
//   } catch (error) {
//     console.error("Error creating gym:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const updateGymBranding = async (gymId, brandingData) => {
//   try {
//     const gymRef = doc(db, "gyms", gymId);
//     await updateDoc(gymRef, brandingData);
//     return { success: true };
//   } catch (error) {
//     console.error("Error updating gym branding:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const getGymDetails = async (gymId) => {
//   try {
//     const gymRef = doc(db, "gyms", gymId);
//     const docSnap = await getDoc(gymRef);
//     if (docSnap.exists()) {
//       return { success: true, gym: { id: docSnap.id, ...docSnap.data() } };
//     } else {
//       return { success: false, error: "No such gym found!" };
//     }
//   } catch (error) {
//     console.error("Error fetching gym details:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const addStaffMember = async (gymId, staffData) => {
//   try {
//     const staffCollectionRef = collection(db, "gyms", gymId, "staff");
//     const staffDocRef = await addDoc(staffCollectionRef, { ...staffData, createdAt: new Date() });
//     return { success: true, staffMember: { id: staffDocRef.id, ...staffData } };
//   } catch (error) {
//     console.error("Error adding staff member:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const getStaffList = async (gymId) => {
//   try {
//     const staffCollectionRef = collection(db, "gyms", gymId, "staff");
//     const snapshot = await getDocs(staffCollectionRef);
//     const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//     return { success: true, staffList };
//   } catch (error) {
//     console.error("Error fetching staff list:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const createClass = async (gymId, classData) => {
//   try {
//     const classCollectionRef = collection(db, "gyms", gymId, "classes");
//     const classDocRef = await addDoc(classCollectionRef, { ...classData, createdAt: new Date() });
//     return { success: true, classData: { id: classDocRef.id, ...classData } };
//   } catch (error) {
//     console.error("Error creating class:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const getClasses = async (gymId) => {
//   try {
//     const classCollectionRef = collection(db, "gyms", gymId, "classes");
//     const snapshot = await getDocs(classCollectionRef);
//     const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//     return { success: true, classList };
//   } catch (error) {
//     console.error("Error fetching class list:", error);
//     return { success: false, error: error.message };
//   }
// };

// export const deleteClass = async (gymId, classId) => {
//   try {
//     const classDocRef = doc(db, "gyms", gymId, "classes", classId);
//     await deleteDoc(classDocRef);
//     return { success: true };
//   } catch (error) {
//     console.error("Error deleting class:", error);
//     return { success: false, error: error.message };
//   }
// };


// // --- 4. STORAGE FUNCTIONS ---
// export const uploadLogo = async (gymId, file) => {
//   if (!file) return null;
//   try {
//     const timestamp = Date.now();
//     const storageRef = ref(storage, `logos/${gymId}_${timestamp}_${file.name}`);
//     const snapshot = await uploadBytes(storageRef, file);
//     const downloadURL = await getDownloadURL(snapshot.ref);
//     return { success: true, url: downloadURL };
//   } catch (error) {
//     console.error("Error uploading logo:", error);
//     return { success: false, error: error.message };
//   }
// };
