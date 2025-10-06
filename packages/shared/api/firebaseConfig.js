// /packages/shared/api/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB1Gqh9nheKlvHvKz423p7fcMnR-6AwWy8",
  authDomain: "gymdash-4e911.firebaseapp.com",
  projectId: "gymdash-4e911",
  storageBucket: "gymdash-4e911.firebasestorage.app",
  messagingSenderId: "463663738859",
  appId: "1:463663738859:web:bc322e57eb96ae5aafb3ae",
  measurementId: "G-06K7E6518J"
};

// Initialize Firebase app
export const app = initializeApp(firebaseConfig);

// Initialize and export services directly
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);