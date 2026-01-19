import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  deleteField
} from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Create a new chat group for a gym
 * @param {string} gymId - The gym ID
 * @param {string} groupName - Name of the chat group
 * @param {string[]} memberIds - Array of user IDs to add as members
 * @param {string} creatorId - User ID of the creator (admin/staff)
 * @returns {Promise<{success: boolean, groupId?: string, error?: string}>}
 */
export const createChatGroup = async (gymId, groupName, memberIds, creatorId) => {
  try {
    if (!gymId || !groupName || !creatorId) {
      return { success: false, error: "Missing required fields" };
    }

    // Create members map from array
    const membersMap = {};
    memberIds.forEach(id => {
      membersMap[id] = true;
    });

    const chatGroupsRef = collection(db, "gyms", gymId, "chatGroups");
    const newGroupRef = await addDoc(chatGroupsRef, {
      name: groupName,
      createdBy: creatorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      members: membersMap,
      lastMessageAt: null,
      lastMessageText: "",
      lastMessageSender: ""
    });

    return { success: true, groupId: newGroupRef.id };
  } catch (error) {
    console.error("Error creating chat group:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a chat group and all its messages
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteChatGroup = async (gymId, groupId) => {
  try {
    // Delete all messages first
    const messagesRef = collection(db, "gyms", gymId, "chatGroups", groupId, "messages");
    const messagesSnap = await getDocs(messagesRef);

    const deletePromises = messagesSnap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete the group
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    await deleteDoc(groupRef);

    return { success: true };
  } catch (error) {
    console.error("Error deleting chat group:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Add a member to a chat group
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} userId - User ID to add
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const addChatMember = async (gymId, groupId, userId) => {
  try {
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    await updateDoc(groupRef, {
      [`members.${userId}`]: true,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error adding chat member:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove a member from a chat group
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} userId - User ID to remove
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removeChatMember = async (gymId, groupId, userId) => {
  try {
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    await updateDoc(groupRef, {
      [`members.${userId}`]: deleteField(),
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error removing chat member:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all chat groups for a gym (admin view)
 * @param {string} gymId - The gym ID
 * @returns {Promise<{success: boolean, groups?: Array, error?: string}>}
 */
export const getAllChatGroups = async (gymId) => {
  try {
    const chatGroupsRef = collection(db, "gyms", gymId, "chatGroups");
    const q = query(chatGroupsRef, orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);

    const groups = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, groups };
  } catch (error) {
    console.error("Error getting chat groups:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get chat groups for a specific user (member view)
 * @param {string} gymId - The gym ID
 * @param {string} userId - The user ID
 * @returns {Promise<{success: boolean, groups?: Array, error?: string}>}
 */
export const getUserChatGroups = async (gymId, userId) => {
  try {
    const chatGroupsRef = collection(db, "gyms", gymId, "chatGroups");
    const q = query(
      chatGroupsRef,
      where(`members.${userId}`, "==", true),
      orderBy("updatedAt", "desc")
    );
    const snapshot = await getDocs(q);

    const groups = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, groups };
  } catch (error) {
    console.error("Error getting user chat groups:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a message to a chat group
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} senderId - User ID of sender
 * @param {string} senderName - Name of sender
 * @param {string} senderRole - Role of sender
 * @param {string} text - Message text
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendMessage = async (gymId, groupId, senderId, senderName, senderRole, text) => {
  try {
    if (!text || text.trim() === "") {
      return { success: false, error: "Message cannot be empty" };
    }

    // Add message to messages subcollection
    const messagesRef = collection(db, "gyms", gymId, "chatGroups", groupId, "messages");
    const newMessageRef = await addDoc(messagesRef, {
      senderId,
      senderName,
      senderRole,
      text: text.trim(),
      timestamp: serverTimestamp(),
      deletedAt: null,
      deletedBy: null
    });

    // Update group with last message info
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    await updateDoc(groupRef, {
      lastMessageAt: serverTimestamp(),
      lastMessageText: text.trim().substring(0, 100), // Truncate for preview
      lastMessageSender: senderName,
      updatedAt: serverTimestamp()
    });

    return { success: true, messageId: newMessageRef.id };
  } catch (error) {
    console.error("Error sending message:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a message (soft delete)
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} messageId - The message ID
 * @param {string} deleterId - User ID of person deleting
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteMessage = async (gymId, groupId, messageId, deleterId) => {
  try {
    const messageRef = doc(db, "gyms", gymId, "chatGroups", groupId, "messages", messageId);
    await updateDoc(messageRef, {
      deletedAt: serverTimestamp(),
      deletedBy: deleterId
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting message:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get messages for a chat group
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {number} limit - Maximum number of messages to fetch
 * @returns {Promise<{success: boolean, messages?: Array, error?: string}>}
 */
export const getChatMessages = async (gymId, groupId, limit = 100) => {
  try {
    const messagesRef = collection(db, "gyms", gymId, "chatGroups", groupId, "messages");
    const q = query(
      messagesRef,
      orderBy("timestamp", "desc"),
      firestoreLimit(limit)
    );
    const snapshot = await getDocs(q);

    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse(); // Reverse to show oldest first

    return { success: true, messages };
  } catch (error) {
    console.error("Error getting chat messages:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to real-time chat group updates
 * @param {string} gymId - The gym ID
 * @param {string} userId - User ID (null for admin to see all)
 * @param {function} callback - Callback function to receive updates
 * @returns {function} Unsubscribe function
 */
export const subscribeToChatGroups = (gymId, userId, callback) => {
  try {
    const chatGroupsRef = collection(db, "gyms", gymId, "chatGroups");

    let q;
    if (userId) {
      // Member view: only groups they're in
      q = query(
        chatGroupsRef,
        where(`members.${userId}`, "==", true),
        orderBy("updatedAt", "desc")
      );
    } else {
      // Admin view: all groups
      q = query(chatGroupsRef, orderBy("updatedAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(groups);
    }, (error) => {
      console.error("Error in chat groups subscription:", error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to chat groups:", error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Subscribe to real-time messages in a chat group
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {function} callback - Callback function to receive messages
 * @returns {function} Unsubscribe function
 */
export const subscribeToMessages = (gymId, groupId, callback) => {
  try {
    const messagesRef = collection(db, "gyms", gymId, "chatGroups", groupId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(messages);
    }, (error) => {
      console.error("Error in messages subscription:", error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to messages:", error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Check if a user is a member of a chat group
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} userId - User ID to check
 * @returns {Promise<{success: boolean, isMember?: boolean, error?: string}>}
 */
export const isUserInChatGroup = async (gymId, groupId, userId) => {
  try {
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      return { success: false, error: "Chat group not found" };
    }

    const groupData = groupSnap.data();
    const isMember = groupData.members && groupData.members[userId] === true;

    return { success: true, isMember };
  } catch (error) {
    console.error("Error checking chat membership:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark a chat group as read for a specific user
 * Updates the lastReadAt timestamp to mark all messages as read
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} userId - User ID marking as read
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markChatAsRead = async (gymId, groupId, userId) => {
  try {
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    await updateDoc(groupRef, {
      [`lastReadAt.${userId}`]: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error marking chat as read:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Calculate unread message count for a user in a chat group
 * @param {object} group - Chat group data
 * @param {string} userId - User ID to check
 * @param {array} messages - Array of messages in the group
 * @returns {number} Number of unread messages
 */
export const getUnreadCount = (group, userId, messages) => {
  if (!messages || messages.length === 0) return 0;

  const lastReadAt = group.lastReadAt?.[userId];

  // If never read, all messages are unread
  if (!lastReadAt) return messages.filter(msg => !msg.deletedAt && msg.senderId !== userId).length;

  // Count messages after lastReadAt
  const lastReadTime = lastReadAt.toDate ? lastReadAt.toDate() : new Date(lastReadAt);

  return messages.filter(msg => {
    if (msg.deletedAt || msg.senderId === userId) return false;
    const msgTime = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
    return msgTime > lastReadTime;
  }).length;
};
