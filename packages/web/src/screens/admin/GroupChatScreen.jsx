import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Trash2, Send, PlusCircle, ArrowLeft, Users, X, MessageSquare } from 'lucide-react';
import {
  subscribeToChatGroups,
  subscribeToMessages,
  sendMessage,
  deleteMessage,
  createChatGroup,
  deleteChatGroup,
  addChatMember,
  removeChatMember,
  getGymMembers,
  markChatAsRead
} from '@shared/api/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@shared/api/firebaseConfig';
import { useConfirm } from '../../context/ConfirmationContext';
import { ProfilePopup } from '../../components/common/ProfilePopup';
import { MemberFormModal } from '../../components/admin/MemberFormModal';

// ============================================================================
// HELPER FUNCTIONS (Moved outside components to prevent recreation)
// ============================================================================

const getMemberCount = (group) => {
  if (!group.members) return 0;
  return Object.keys(group.members).length;
};

const getInitials = (name) => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

// ============================================================================
// CHAT LIST COMPONENT (Moved outside to prevent recreation)
// ============================================================================

const ChatList = ({ chatGroups, onSelectChat, onCreateGroup }) => (
  <div className="w-full flex flex-col bg-white h-full">
    <div className="p-4 border-b bg-white sticky top-0 z-10 flex justify-between items-center">
      <h1 className="text-xl font-bold text-gray-800">Group Chats</h1>
      <button
        onClick={onCreateGroup}
        className="text-blue-600 hover:text-blue-800 active:scale-95 transition-transform"
        title="Create New Group Chat"
      >
        <PlusCircle size={22} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto">
      {chatGroups.length === 0 ? (
        <div className="p-8 text-center">
          <div className="flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-sm text-gray-500 mb-2">No group chats yet</p>
            <p className="text-xs text-gray-400">Click the + button to create one</p>
          </div>
        </div>
      ) : (
        chatGroups.map((group) => (
          <div
            key={group.id}
            onClick={() => onSelectChat(group)}
            className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 active:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-600 shrink-0">
              {getInitials(group.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-800 truncate">{group.name}</p>
                {group.lastMessageAt && (
                  <p className="text-xs text-gray-400 ml-2 shrink-0">
                    {formatTimestamp(group.lastMessageAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 truncate">
                  {group.lastMessageText || 'No messages yet'}
                </p>
                <p className="text-xs text-gray-500 ml-2 shrink-0">{getMemberCount(group)} members</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// ============================================================================
// ACTIVE CHAT COMPONENT (Moved outside to prevent recreation)
// ============================================================================

const ActiveChat = ({
  chat,
  messages,
  messageText,
  onMessageChange,
  onSendMessage,
  onDeleteMessage,
  onBack,
  onAddMember,
  onManageMembers,
  onDeleteGroup,
  onViewMemberProfile,
  messagesEndRef
}) => {
  const user = auth.currentUser;

  return (
    <div className="w-full flex flex-col h-full bg-gray-50">
      {/* Chat Header */}
      <div className="p-3 md:p-4 border-b flex justify-between items-center bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-800 active:scale-95 transition-transform p-1"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-lg text-gray-800 truncate">{chat.name}</h2>
            <p className="text-xs text-gray-500">{getMemberCount(chat)} Members</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            onClick={onAddMember}
            className="flex items-center gap-1 text-xs md:text-sm font-medium text-gray-600 hover:text-blue-600 active:scale-95 transition-transform"
            title="Add Member"
          >
            <UserPlus size={16} /> <span className="hidden md:inline">Add</span>
          </button>
          <button
            onClick={onManageMembers}
            className="text-gray-600 hover:text-blue-600 active:scale-95 transition-transform"
            title="Manage Members"
          >
            <Users size={18} />
          </button>
          <button
            onClick={onDeleteGroup}
            className="text-gray-500 hover:text-red-600 active:scale-95 transition-transform"
            title="Delete Group"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages
            .filter((msg) => !msg.deletedAt)
            .map((msg) => {
              const isCurrentUser = msg.senderId === user?.uid;
              const isAdmin = ['owner', 'staff', 'coach'].includes(msg.senderRole);

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 group ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 mt-1 flex items-center justify-center text-white text-xs font-bold ${
                      isAdmin ? 'bg-blue-600' : 'bg-gray-400'
                    }`}
                  >
                    {getInitials(msg.senderName)}
                  </div>
                  <div className={`flex items-start gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="flex flex-col">
                      <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {isCurrentUser ? (
                          <p className="font-bold text-xs text-gray-800">You</p>
                        ) : (
                          <ProfilePopup
                            name={msg.senderName}
                            senderId={msg.senderId}
                            senderRole={msg.senderRole}
                            isAdmin={true}
                            onAdminClick={onViewMemberProfile}
                          />
                        )}
                        {isAdmin && !isCurrentUser && (
                          <span className="text-xs text-blue-600 font-medium">Admin</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>
                      <div
                        className={`p-3 rounded-lg text-sm inline-block max-w-md ${
                          isCurrentUser
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-6 active:scale-95"
                      title="Delete Message"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="p-4 bg-white border-t sticky bottom-0">
        <div className="relative">
          <input
            type="text"
            value={messageText}
            onChange={(e) => onMessageChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
            placeholder="Type a message..."
            className="w-full p-3 pr-12 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />
          <button
            onClick={onSendMessage}
            disabled={!messageText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GroupChatScreen = () => {
  const { confirm } = useConfirm();
  const [gymId, setGymId] = useState(null);
  const [chatGroups, setChatGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [selectedMemberForModal, setSelectedMemberForModal] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const messagesEndRef = useRef(null);
  const prevMessageCountRef = useRef(0);

  // Fetch user profile and gymId
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setUserProfile(userData);
        if (userData.gymId) {
          setGymId(userData.gymId);
        }
      }
    };

    fetchUserData();
  }, []);

  // Subscribe to chat groups
  useEffect(() => {
    if (!gymId) return;

    const unsubscribe = subscribeToChatGroups(gymId, null, (groups) => {
      setChatGroups(groups);
    });

    return () => unsubscribe();
  }, [gymId]);

  // Fetch all members for the member modal
  useEffect(() => {
    if (!gymId) return;

    const fetchMembers = async () => {
      const result = await getGymMembers(gymId);
      if (result.success) {
        setAllMembers(result.members);
      }
    };

    fetchMembers();
  }, [gymId]);

  // Subscribe to messages for active chat
  useEffect(() => {
    if (!gymId || !activeChat?.id) return;

    const unsubscribe = subscribeToMessages(gymId, activeChat.id, (msgs) => {
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [gymId, activeChat?.id]);

  // Auto-scroll to bottom only when NEW messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMessageCountRef.current = messages.length;
    } else {
      prevMessageCountRef.current = messages.length;
    }
  }, [messages]);

  // Mark chat as read when viewing (admin tracking)
  useEffect(() => {
    const user = auth.currentUser;
    if (!gymId || !activeChat?.id || !user?.uid) return;

    const timer = setTimeout(() => {
      markChatAsRead(gymId, activeChat.id, user.uid);
    }, 1000);

    return () => clearTimeout(timer);
  }, [gymId, activeChat?.id]);

  const handleSendMessage = async () => {
    const user = auth.currentUser;
    if (!messageText.trim() || !gymId || !activeChat?.id || !user || !userProfile) return;

    const result = await sendMessage(
      gymId,
      activeChat.id,
      user.uid,
      `${userProfile.firstName} ${userProfile.lastName}`,
      userProfile.role || 'staff',
      messageText
    );

    if (result.success) {
      setMessageText('');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const user = auth.currentUser;
    if (!gymId || !activeChat?.id || !user) return;

    const confirmed = await confirm({
      title: 'Delete Message?',
      message: 'This message will be permanently deleted.',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      await deleteMessage(gymId, activeChat.id, messageId, user.uid);
    }
  };

  const handleDeleteGroup = async () => {
    if (!gymId || !activeChat?.id) return;

    const confirmed = await confirm({
      title: 'Delete Group Chat?',
      message: 'All messages will be permanently deleted. This cannot be undone.',
      type: 'danger',
      confirmText: 'Delete Group',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      const result = await deleteChatGroup(gymId, activeChat.id);

      if (result.success) {
        setActiveChat(null);
        setMessages([]);
      }
    }
  };

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    setMessages([]); // Clear old messages while loading
  };

  const handleBack = () => {
    setActiveChat(null);
    setMessages([]);
  };

  const handleViewMemberProfile = async (memberId) => {
    // Find member in allMembers list, or fetch if not found
    let member = allMembers.find(m => m.id === memberId);

    if (!member) {
      // Fetch member data directly
      const userRef = doc(db, 'users', memberId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        member = { id: memberId, ...userSnap.data() };
      }
    }

    if (member) {
      setSelectedMemberForModal(member);
      setShowMemberModal(true);
    }
  };

  const handleMemberModalSave = async () => {
    // Refresh members list after save
    const result = await getGymMembers(gymId);
    if (result.success) {
      setAllMembers(result.members);
    }
  };

  return (
    <>
      <div className="flex h-[calc(100vh-120px)] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {activeChat ? (
          <ActiveChat
            chat={activeChat}
            messages={messages}
            messageText={messageText}
            onMessageChange={setMessageText}
            onSendMessage={handleSendMessage}
            onDeleteMessage={handleDeleteMessage}
            onBack={handleBack}
            onViewMemberProfile={handleViewMemberProfile}
            onAddMember={() => setShowAddMemberModal(true)}
            onManageMembers={() => setShowManageMembersModal(true)}
            onDeleteGroup={handleDeleteGroup}
            messagesEndRef={messagesEndRef}
          />
        ) : (
          <ChatList
            chatGroups={chatGroups}
            onSelectChat={handleSelectChat}
            onCreateGroup={() => setShowCreateModal(true)}
          />
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          gymId={gymId}
          creatorId={auth.currentUser?.uid}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && activeChat && (
        <AddMemberModal
          gymId={gymId}
          groupId={activeChat.id}
          existingMembers={activeChat.members || {}}
          onClose={() => setShowAddMemberModal(false)}
        />
      )}

      {/* Manage Members Modal */}
      {showManageMembersModal && activeChat && (
        <ManageMembersModal
          gymId={gymId}
          groupId={activeChat.id}
          members={activeChat.members || {}}
          onClose={() => setShowManageMembersModal(false)}
        />
      )}

      {/* Member Profile Modal */}
      <MemberFormModal
        isOpen={showMemberModal}
        onClose={() => {
          setShowMemberModal(false);
          setSelectedMemberForModal(null);
        }}
        gymId={gymId}
        memberData={selectedMemberForModal}
        onSave={handleMemberModalSave}
        allMembers={allMembers}
        onSelectMember={(member) => setSelectedMemberForModal(member)}
      />
    </>
  );
};

// ============================================================================
// MODAL COMPONENTS
// ============================================================================

// Create Group Modal Component
const CreateGroupModal = ({ gymId, creatorId, onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!gymId) {
        console.log('[CreateGroupModal] No gymId provided');
        return;
      }

      try {
        setLoading(true);
        console.log('[CreateGroupModal] Fetching members for gymId:', gymId);

        const result = await getGymMembers(gymId);

        console.log('[CreateGroupModal] getGymMembers result:', result);

        if (result.success) {
          console.log('[CreateGroupModal] Members fetched:', result.members.length);
          setAvailableMembers(result.members);
        } else {
          console.error('[CreateGroupModal] Error from API:', result.error);
          alert(`Error loading members: ${result.error}`);
        }
      } catch (error) {
        console.error('[CreateGroupModal] Exception:', error);
        alert(`Error loading members: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [gymId]);

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert('Please enter a group name and select at least one member');
      return;
    }

    try {
      setCreating(true);
      console.log('Creating group:', { gymId, groupName, selectedMembers, creatorId });
      const result = await createChatGroup(gymId, groupName, selectedMembers, creatorId);

      if (result.success) {
        console.log('Group created successfully:', result.groupId);
        onClose();
      } else {
        console.error('Error creating group:', result.error);
        alert(`Error creating group: ${result.error}`);
      }
    } catch (error) {
      console.error('Exception creating group:', error);
      alert(`Error creating group: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const toggleMember = (memberId) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMembers.length === availableMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(availableMembers.map(m => m.id));
    }
  };

  const allSelected = availableMembers.length > 0 && selectedMembers.length === availableMembers.length;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Create Group Chat</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 active:scale-95 transition-transform">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Competition Team"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Members ({selectedMembers.length} of {availableMembers.length} selected)
              </label>
              {availableMembers.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium active:scale-95 transition-transform"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-500">Loading members...</p>
              </div>
            ) : availableMembers.length === 0 ? (
              <div className="flex items-center justify-center py-8 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-500">No members found in this gym</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {availableMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm flex-1">
                      {member.firstName} {member.lastName}
                    </span>
                    {['owner', 'staff', 'coach'].includes(member.role) && (
                      <span className="text-xs text-blue-600">Admin</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg active:scale-95 transition-transform"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedMembers.length === 0 || creating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Member Modal Component
const AddMemberModal = ({ gymId, groupId, existingMembers, onClose }) => {
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const result = await getGymMembers(gymId);
      if (result.success) {
        const nonMembers = result.members.filter(m => !existingMembers[m.id]);
        setAvailableMembers(nonMembers);
      }
    };
    fetchMembers();
  }, [gymId, existingMembers]);

  const handleAddMember = async (memberId) => {
    setLoading(true);
    const result = await addChatMember(gymId, groupId, memberId);
    if (result.success) {
      onClose();
    } else {
      alert(`Error adding member: ${result.error}`);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Add Member</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 active:scale-95 transition-transform">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {availableMembers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">All members are already in this group.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-sm">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                  <button
                    onClick={() => handleAddMember(member.id)}
                    disabled={loading}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:bg-gray-300 active:scale-95 transition-transform"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg active:scale-95 transition-transform"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Manage Members Modal Component
const ManageMembersModal = ({ gymId, groupId, members, onClose }) => {
  const [memberDetails, setMemberDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberDetails = async () => {
      const memberIds = Object.keys(members);
      const details = await Promise.all(
        memberIds.map(async (id) => {
          const userRef = doc(db, 'users', id);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            return { id, ...userSnap.data() };
          }
          return { id, firstName: 'Unknown', lastName: 'User' };
        })
      );
      setMemberDetails(details);
      setLoading(false);
    };

    fetchMemberDetails();
  }, [members]);

  const handleRemoveMember = async (memberId) => {
    const result = await removeChatMember(gymId, groupId, memberId);
    if (result.success) {
      setMemberDetails((prev) => prev.filter((m) => m.id !== memberId));
    } else {
      alert(`Error removing member: ${result.error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Members</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 active:scale-95 transition-transform">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading members...</p>
          ) : (
            <div className="space-y-2">
              {memberDetails.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-gray-500">{member.email || 'No email'}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800 active:scale-95 transition-transform"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg active:scale-95 transition-transform"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChatScreen;
