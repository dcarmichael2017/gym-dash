// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB1Gqh9nheKlvHvKz423p7fcMnR-6AwWy8",
  authDomain: "gymdash-4e911.firebaseapp.com",
  projectId: "gymdash-4e911",
  storageBucket: "gymdash-4e911.firebasestorage.app",
  messagingSenderId: "463663738859",
  appId: "1:463663738859:web:bc322e57eb96ae5aafb3ae",
  measurementId: "G-06K7E6518J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);