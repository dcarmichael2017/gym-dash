// /packages/shared/api/storage.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// Import the already-initialized storage service from our new central file
import { storage } from "./firebaseConfig.js";

// Uploads a gym logo and returns the public URL
export const uploadLogo = async (gymId, file) => {
  if (!file) return null;

  try {
    // Create a storage reference, e.g., 'logos/gymId_timestamp_filename'
    const timestamp = Date.now();
    const storageRef = ref(storage, `logos/${gymId}_${timestamp}_${file.name}`);

    // 'file' comes from the Blob or File API
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return { success: true, url: downloadURL };
  } catch (error) {
    console.error("Error uploading logo:", error);
    return { success: false, error: error.message };
  }
};

export const uploadStaffPhoto = async (gymId, file) => {
  try {
    // Generate a unique filename using timestamp to avoid caching issues
    const filename = `staff_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `gyms/${gymId}/staff/${filename}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return { success: true, url: downloadURL };
  } catch (error) {
    console.error("Error uploading staff photo:", error);
    return { success: false, error: error.message };
  }
};
