import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword // Import sign-in function
} from "firebase/auth";
// Import the core app object from our stable config file
import { auth } from "./firebaseConfig.js";

export const signUpWithEmail = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Sign up error:", error);
    return { success: false, error: error.message };
  }
};

// --- NEW FUNCTION ---
// Signs in an existing user
export const signInWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: error.message };
  }
};

