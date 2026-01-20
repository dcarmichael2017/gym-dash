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
  where,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  deleteField,
  Timestamp
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

    // Create members map with joinedAt timestamps
    // Members can only see messages sent after they joined
    const now = new Date();
    const membersMap = {};
    memberIds.forEach(id => {
      membersMap[id] = { joinedAt: now };
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
 * Stores a joinedAt timestamp so the member can only see messages sent after joining
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} userId - User ID to add
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const addChatMember = async (gymId, groupId, userId) => {
  try {
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    await updateDoc(groupRef, {
      [`members.${userId}`]: { joinedAt: new Date() },
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
    // Fetch all groups and filter client-side to support both legacy and new member format
    const q = query(chatGroupsRef, orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);

    const allGroups = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter to groups where user is a member (supports both formats)
    const groups = allGroups.filter(g => {
      const memberData = g.members?.[userId];
      return memberData === true || (memberData && memberData.joinedAt);
    });

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
 * @param {object} media - Optional media attachment { type, url, width, height, size }
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendMessage = async (gymId, groupId, senderId, senderName, senderRole, text, media = null) => {
  try {
    // Either text or media must be provided
    const hasText = text && text.trim() !== "";
    const hasMedia = media && media.url;

    if (!hasText && !hasMedia) {
      return { success: false, error: "Message must have text or media" };
    }

    // Build message object
    const messageData = {
      senderId,
      senderName,
      senderRole,
      text: hasText ? text.trim() : "",
      timestamp: serverTimestamp(),
      deletedAt: null,
      deletedBy: null
    };

    // Add media if present
    if (hasMedia) {
      messageData.media = {
        type: media.type || 'image',
        url: media.url,
        width: media.width || 0,
        height: media.height || 0,
        size: media.size || 0
      };
    }

    // Add message to messages subcollection
    const messagesRef = collection(db, "gyms", gymId, "chatGroups", groupId, "messages");
    const newMessageRef = await addDoc(messagesRef, messageData);

    // Build preview text for the group list
    let previewText = hasText ? text.trim().substring(0, 100) : '';
    if (hasMedia && !hasText) {
      previewText = media.type === 'gif' ? '📎 Sent a GIF' : '📷 Sent an image';
    } else if (hasMedia && hasText) {
      previewText = `📷 ${text.trim().substring(0, 80)}`;
    }

    // Update group with last message info
    const groupRef = doc(db, "gyms", gymId, "chatGroups", groupId);
    await updateDoc(groupRef, {
      lastMessageAt: serverTimestamp(),
      lastMessageText: previewText,
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

    // Always fetch all groups and filter client-side for members
    // This supports both legacy format (members.userId = true) and
    // new format (members.userId = { joinedAt })
    const q = query(chatGroupsRef, orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let groups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // If userId provided, filter to only groups they're a member of
      if (userId) {
        groups = groups.filter(g => {
          const memberData = g.members?.[userId];
          // Support both legacy (true) and new format ({ joinedAt })
          return memberData === true || (memberData && memberData.joinedAt);
        });
      }

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
    // Support both old format (true) and new format ({ joinedAt })
    const memberData = groupData.members?.[userId];
    const isMember = memberData === true || (memberData && memberData.joinedAt);

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

/**
 * Get the joinedAt timestamp for a member in a chat group
 * Returns null if the user is not a member or if using legacy format
 * @param {object} group - Chat group data
 * @param {string} userId - User ID to check
 * @returns {Date|null} The joinedAt date or null
 */
export const getMemberJoinedAt = (group, userId) => {
  const memberData = group?.members?.[userId];
  if (!memberData) return null;

  // Legacy format: members[userId] = true (no joinedAt restriction)
  if (memberData === true) return null;

  // New format: members[userId] = { joinedAt: timestamp }
  if (memberData.joinedAt) {
    return memberData.joinedAt.toDate
      ? memberData.joinedAt.toDate()
      : new Date(memberData.joinedAt);
  }

  return null;
};

/**
 * Filter messages to only show those sent after the user joined the chat
 * This ensures users who are removed and re-added cannot see old messages
 * @param {array} messages - Array of messages
 * @param {object} group - Chat group data
 * @param {string} userId - User ID to filter for
 * @returns {array} Filtered messages the user is allowed to see
 */
export const filterMessagesForMember = (messages, group, userId) => {
  if (!messages || messages.length === 0) return [];

  const joinedAt = getMemberJoinedAt(group, userId);

  // If no joinedAt (legacy format or admin), show all messages
  if (!joinedAt) return messages;

  // Filter to only show messages sent after the user joined
  return messages.filter(msg => {
    const msgTime = msg.timestamp?.toDate
      ? msg.timestamp.toDate()
      : new Date(msg.timestamp);
    return msgTime >= joinedAt;
  });
};

/**
 * Check if a user is a member (helper that handles both legacy and new format)
 * @param {object} group - Chat group data
 * @param {string} userId - User ID to check
 * @returns {boolean} Whether the user is a member
 */
export const isMember = (group, userId) => {
  const memberData = group?.members?.[userId];
  // Support both legacy (true) and new format ({ joinedAt })
  return memberData === true || (memberData && memberData.joinedAt);
};

/**
 * Get member count from a group (handles both legacy and new format)
 * @param {object} group - Chat group data
 * @returns {number} Number of members
 */
export const getMemberCount = (group) => {
  if (!group?.members) return 0;
  return Object.keys(group.members).length;
};

// ============================================================================
// STORAGE GOVERNANCE FUNCTIONS
// ============================================================================

/**
 * Get messages with media that are older than the retention period
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {number} retentionDays - Number of days to retain media (default 30)
 * @returns {Promise<{success: boolean, messages?: Array, error?: string}>}
 */
export const getExpiredMediaMessages = async (gymId, groupId, retentionDays = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    const messagesRef = collection(db, "gyms", gymId, "chatGroups", groupId, "messages");
    const q = query(
      messagesRef,
      where("timestamp", "<", cutoffTimestamp),
      orderBy("timestamp", "asc")
    );

    const snapshot = await getDocs(q);

    // Filter to only messages with media
    const expiredMediaMessages = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(msg => msg.media && msg.media.url && !msg.deletedAt);

    return { success: true, messages: expiredMediaMessages };
  } catch (error) {
    console.error("Error getting expired media messages:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Soft-delete media from a message (removes media but keeps text)
 * Used for storage governance to clean up old media
 * @param {string} gymId - The gym ID
 * @param {string} groupId - The chat group ID
 * @param {string} messageId - The message ID
 * @returns {Promise<{success: boolean, mediaUrl?: string, error?: string}>}
 */
export const removeMediaFromMessage = async (gymId, groupId, messageId) => {
  try {
    const messageRef = doc(db, "gyms", gymId, "chatGroups", groupId, "messages", messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      return { success: false, error: "Message not found" };
    }

    const messageData = messageSnap.data();
    const mediaUrl = messageData.media?.url;

    // Update message to remove media but keep text
    await updateDoc(messageRef, {
      media: deleteField(),
      mediaExpired: true,
      mediaExpiredAt: serverTimestamp()
    });

    return { success: true, mediaUrl };
  } catch (error) {
    console.error("Error removing media from message:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all chat groups for a gym (for batch cleanup operations)
 * @param {string} gymId - The gym ID
 * @returns {Promise<{success: boolean, groups?: Array, error?: string}>}
 */
export const getAllChatGroupIds = async (gymId) => {
  try {
    const chatGroupsRef = collection(db, "gyms", gymId, "chatGroups");
    const snapshot = await getDocs(chatGroupsRef);

    const groupIds = snapshot.docs.map(doc => doc.id);
    return { success: true, groupIds };
  } catch (error) {
    console.error("Error getting chat group IDs:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get storage governance settings for a gym
 * @param {string} gymId - The gym ID
 * @returns {Promise<{success: boolean, settings?: object, error?: string}>}
 */
export const getStorageGovernanceSettings = async (gymId) => {
  try {
    const gymRef = doc(db, "gyms", gymId);
    const gymSnap = await getDoc(gymRef);

    if (!gymSnap.exists()) {
      return { success: false, error: "Gym not found" };
    }

    const gymData = gymSnap.data();
    const settings = {
      chatMediaRetentionDays: gymData.chatMediaRetentionDays ?? 30,
      communityMediaRetentionDays: gymData.communityMediaRetentionDays ?? 90,
      maxStoragePerTierMB: gymData.maxStoragePerTierMB ?? {
        free: 500,
        basic: 2000,
        pro: 10000,
        enterprise: -1 // unlimited
      },
      currentTier: gymData.subscriptionTier ?? 'free'
    };

    return { success: true, settings };
  } catch (error) {
    console.error("Error getting storage governance settings:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Update storage governance settings for a gym
 * @param {string} gymId - The gym ID
 * @param {object} settings - Settings to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateStorageGovernanceSettings = async (gymId, settings) => {
  try {
    const gymRef = doc(db, "gyms", gymId);

    const updateData = {};
    if (settings.chatMediaRetentionDays !== undefined) {
      updateData.chatMediaRetentionDays = settings.chatMediaRetentionDays;
    }
    if (settings.communityMediaRetentionDays !== undefined) {
      updateData.communityMediaRetentionDays = settings.communityMediaRetentionDays;
    }

    await updateDoc(gymRef, updateData);

    return { success: true };
  } catch (error) {
    console.error("Error updating storage governance settings:", error);
    return { success: false, error: error.message };
  }
};
