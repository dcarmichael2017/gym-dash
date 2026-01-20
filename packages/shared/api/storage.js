// /packages/shared/api/storage.js
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";
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

/**
 * Upload an image for a community post
 * @param {string} gymId - The gym ID
 * @param {File} file - The image file to upload
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const uploadCommunityPostImage = async (gymId, file) => {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'Image must be less than 5MB' };
    }

    // Generate a unique filename
    const filename = `post_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `gyms/${gymId}/community/${filename}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return { success: true, url: downloadURL };
  } catch (error) {
    console.error("Error uploading community post image:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Upload an image for a chat message
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {File} file - The image/GIF file to upload
 * @returns {Promise<{success: boolean, url?: string, width?: number, height?: number, size?: number, error?: string}>}
 */
export const uploadChatImage = async (gymId, groupId, file) => {
  try {
    // Validate file type (images and GIFs)
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return { success: false, error: 'File must be an image (JPEG, PNG, GIF, or WebP)' };
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'File must be less than 10MB' };
    }

    // Generate a unique filename with timestamp
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`;
    const storageRef = ref(storage, `gyms/${gymId}/chatGroups/${groupId}/media/${filename}`);

    // Get image dimensions before upload
    let width = 0;
    let height = 0;

    if (file.type !== 'image/gif') {
      try {
        const dimensions = await getImageDimensions(file);
        width = dimensions.width;
        height = dimensions.height;
      } catch (dimError) {
        console.warn('Could not get image dimensions:', dimError);
      }
    }

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      url: downloadURL,
      width,
      height,
      size: file.size,
      type: file.type.startsWith('image/gif') ? 'gif' : 'image'
    };
  } catch (error) {
    console.error("Error uploading chat image:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get image dimensions from a file
 * @param {File} file - The image file
 * @returns {Promise<{width: number, height: number}>}
 */
const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Delete a file from Firebase Storage
 * @param {string} url - The download URL of the file to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteStorageFile = async (url) => {
  try {
    // Extract the path from the download URL
    const urlObj = new URL(url);
    const path = decodeURIComponent(urlObj.pathname.split('/o/')[1]?.split('?')[0]);

    if (!path) {
      return { success: false, error: 'Invalid storage URL' };
    }

    const fileRef = ref(storage, path);
    await deleteObject(fileRef);

    return { success: true };
  } catch (error) {
    console.error("Error deleting storage file:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete all media files in a chat group folder
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
export const deleteAllChatGroupMedia = async (gymId, groupId) => {
  try {
    const folderRef = ref(storage, `gyms/${gymId}/chatGroups/${groupId}/media`);
    const result = await listAll(folderRef);

    const deletePromises = result.items.map(item => deleteObject(item));
    await Promise.all(deletePromises);

    return { success: true, deletedCount: result.items.length };
  } catch (error) {
    // Folder might not exist, which is fine
    if (error.code === 'storage/object-not-found') {
      return { success: true, deletedCount: 0 };
    }
    console.error("Error deleting chat group media:", error);
    return { success: false, error: error.message };
  }
};
