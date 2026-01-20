import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// ============================================================
// COMMUNITY POSTS - ADMIN OPERATIONS
// ============================================================

/**
 * Create a new community post (admin only)
 * @param {string} gymId - The gym ID
 * @param {object} postData - Post data { content, allowComments, isPinned, imageUrl, creatorId, creatorName, creatorRole }
 * @returns {Promise<{success: boolean, postId?: string, error?: string}>}
 */
export const createCommunityPost = async (gymId, postData) => {
  try {
    const { content, allowComments = true, isPinned = false, imageUrl = null, creatorId, creatorName, creatorRole } = postData;

    if (!gymId || !content || !creatorId) {
      return { success: false, error: "Missing required fields" };
    }

    const postsRef = collection(db, "gyms", gymId, "communityPosts");
    const newPostRef = await addDoc(postsRef, {
      content: content.trim(),
      allowComments,
      isPinned,
      imageUrl,
      creatorId,
      creatorName: creatorName || "Admin",
      creatorRole: creatorRole || "staff",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      editedAt: null,
      commentCount: 0,
      lastCommentAt: null
    });

    return { success: true, postId: newPostRef.id };
  } catch (error) {
    console.error("Error creating community post:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing community post (admin only)
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @param {object} updates - Fields to update { content, allowComments, isPinned, imageUrl }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateCommunityPost = async (gymId, postId, updates) => {
  try {
    const postRef = doc(db, "gyms", gymId, "communityPosts", postId);

    const updateData = {
      updatedAt: serverTimestamp()
    };

    // Only include fields that are being updated
    if (updates.content !== undefined) {
      updateData.content = updates.content.trim();
      updateData.editedAt = serverTimestamp();
    }
    if (updates.allowComments !== undefined) {
      updateData.allowComments = updates.allowComments;
    }
    if (updates.isPinned !== undefined) {
      updateData.isPinned = updates.isPinned;
    }
    if (updates.imageUrl !== undefined) {
      updateData.imageUrl = updates.imageUrl;
    }

    await updateDoc(postRef, updateData);

    return { success: true };
  } catch (error) {
    console.error("Error updating community post:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a community post and all its comments (admin only)
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteCommunityPost = async (gymId, postId) => {
  try {
    // Delete all comments first
    const commentsRef = collection(db, "gyms", gymId, "communityPosts", postId, "comments");
    const commentsSnap = await getDocs(commentsRef);

    const deletePromises = commentsSnap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete the post
    const postRef = doc(db, "gyms", gymId, "communityPosts", postId);
    await deleteDoc(postRef);

    return { success: true };
  } catch (error) {
    console.error("Error deleting community post:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle comments on/off for a post (admin only)
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @param {boolean} allowComments - Whether to allow comments
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const togglePostComments = async (gymId, postId, allowComments) => {
  try {
    const postRef = doc(db, "gyms", gymId, "communityPosts", postId);
    await updateDoc(postRef, {
      allowComments,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error toggling post comments:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle pin status for a post (admin only)
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @param {boolean} isPinned - Whether to pin the post
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const togglePostPin = async (gymId, postId, isPinned) => {
  try {
    const postRef = doc(db, "gyms", gymId, "communityPosts", postId);
    await updateDoc(postRef, {
      isPinned,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error toggling post pin:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// COMMENTS - MEMBER & ADMIN OPERATIONS
// ============================================================

/**
 * Add a comment to a post (members and admin)
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @param {object} commentData - { authorId, authorName, authorRole, text }
 * @returns {Promise<{success: boolean, commentId?: string, error?: string}>}
 */
export const addComment = async (gymId, postId, commentData) => {
  try {
    const { authorId, authorName, authorRole, text } = commentData;

    if (!text || text.trim() === "") {
      return { success: false, error: "Comment cannot be empty" };
    }

    // Add comment to comments subcollection
    const commentsRef = collection(db, "gyms", gymId, "communityPosts", postId, "comments");
    const newCommentRef = await addDoc(commentsRef, {
      authorId,
      authorName: authorName || "Member",
      authorRole: authorRole || "member",
      text: text.trim(),
      createdAt: serverTimestamp(),
      editedAt: null,
      deletedAt: null,
      deletedBy: null
    });

    // Update post with comment count and last comment time
    const postRef = doc(db, "gyms", gymId, "communityPosts", postId);
    await updateDoc(postRef, {
      commentCount: increment(1),
      lastCommentAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { success: true, commentId: newCommentRef.id };
  } catch (error) {
    console.error("Error adding comment:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a comment (soft delete - admin can delete any, users can delete their own)
 * Uses a transaction to prevent race conditions and ensure count never goes below 0
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @param {string} commentId - The comment ID
 * @param {string} deleterId - User ID of person deleting
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteComment = async (gymId, postId, commentId, deleterId) => {
  try {
    const commentRef = doc(db, "gyms", gymId, "communityPosts", postId, "comments", commentId);
    const postRef = doc(db, "gyms", gymId, "communityPosts", postId);

    await runTransaction(db, async (transaction) => {
      // Read the comment first to check if it's already deleted
      const commentSnap = await transaction.get(commentRef);
      if (!commentSnap.exists()) {
        throw new Error("Comment not found");
      }

      const commentData = commentSnap.data();
      if (commentData.deletedAt) {
        // Already deleted, skip to prevent double-decrement
        return;
      }

      // Read the post to get current count
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) {
        throw new Error("Post not found");
      }

      const postData = postSnap.data();
      const currentCount = postData.commentCount || 0;
      // Ensure count never goes below 0
      const newCount = Math.max(0, currentCount - 1);

      // Soft delete the comment
      transaction.update(commentRef, {
        deletedAt: serverTimestamp(),
        deletedBy: deleterId
      });

      // Update post with safe count
      transaction.update(postRef, {
        commentCount: newCount,
        updatedAt: serverTimestamp()
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting comment:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// READING / QUERYING
// ============================================================

/**
 * Get all community posts for a gym
 * @param {string} gymId - The gym ID
 * @param {number} limit - Maximum number of posts to fetch (default 50)
 * @returns {Promise<{success: boolean, posts?: Array, error?: string}>}
 */
export const getCommunityPosts = async (gymId, limit = 50) => {
  try {
    const postsRef = collection(db, "gyms", gymId, "communityPosts");
    const q = query(
      postsRef,
      orderBy("createdAt", "desc"),
      firestoreLimit(limit)
    );
    const snapshot = await getDocs(q);

    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort: pinned posts first, then by createdAt
    posts.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0; // Keep original order (by createdAt desc) for same pin status
    });

    return { success: true, posts };
  } catch (error) {
    console.error("Error getting community posts:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a single post by ID
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @returns {Promise<{success: boolean, post?: object, error?: string}>}
 */
export const getCommunityPost = async (gymId, postId) => {
  try {
    const postRef = doc(db, "gyms", gymId, "communityPosts", postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      return { success: false, error: "Post not found" };
    }

    return {
      success: true,
      post: { id: postSnap.id, ...postSnap.data() }
    };
  } catch (error) {
    console.error("Error getting community post:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get comments for a post
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @returns {Promise<{success: boolean, comments?: Array, error?: string}>}
 */
export const getPostComments = async (gymId, postId) => {
  try {
    const commentsRef = collection(db, "gyms", gymId, "communityPosts", postId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);

    const comments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, comments };
  } catch (error) {
    console.error("Error getting post comments:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get the latest post for a gym (for dashboard widget preview)
 * @param {string} gymId - The gym ID
 * @returns {Promise<{success: boolean, post?: object, error?: string}>}
 */
export const getLatestCommunityPost = async (gymId) => {
  try {
    const postsRef = collection(db, "gyms", gymId, "communityPosts");
    const q = query(
      postsRef,
      orderBy("createdAt", "desc"),
      firestoreLimit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, post: null };
    }

    const postDoc = snapshot.docs[0];
    return {
      success: true,
      post: { id: postDoc.id, ...postDoc.data() }
    };
  } catch (error) {
    console.error("Error getting latest community post:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================

/**
 * Subscribe to real-time community posts updates
 * @param {string} gymId - The gym ID
 * @param {function} callback - Callback function to receive updates
 * @returns {function} Unsubscribe function
 */
export const subscribeToCommunityPosts = (gymId, callback) => {
  try {
    const postsRef = collection(db, "gyms", gymId, "communityPosts");
    const q = query(postsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort: pinned posts first, then by createdAt (already desc from query)
      posts.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });

      callback(posts);
    }, (error) => {
      console.error("Error in community posts subscription:", error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to community posts:", error);
    return () => {};
  }
};

/**
 * Subscribe to real-time comments for a post
 * @param {string} gymId - The gym ID
 * @param {string} postId - The post ID
 * @param {function} callback - Callback function to receive updates
 * @returns {function} Unsubscribe function
 */
export const subscribeToPostComments = (gymId, postId, callback) => {
  try {
    const commentsRef = collection(db, "gyms", gymId, "communityPosts", postId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(comments);
    }, (error) => {
      console.error("Error in comments subscription:", error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to comments:", error);
    return () => {};
  }
};

/**
 * Subscribe to the latest community post (for dashboard widget)
 * @param {string} gymId - The gym ID
 * @param {function} callback - Callback function to receive updates
 * @returns {function} Unsubscribe function
 */
export const subscribeToLatestPost = (gymId, callback) => {
  try {
    const postsRef = collection(db, "gyms", gymId, "communityPosts");
    const q = query(
      postsRef,
      orderBy("createdAt", "desc"),
      firestoreLimit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }
      const postDoc = snapshot.docs[0];
      callback({ id: postDoc.id, ...postDoc.data() });
    }, (error) => {
      console.error("Error in latest post subscription:", error);
      callback(null);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to latest post:", error);
    return () => {};
  }
};
