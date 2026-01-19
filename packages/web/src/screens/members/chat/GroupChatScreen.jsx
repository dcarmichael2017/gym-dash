import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, MessageSquare } from 'lucide-react';
import { useGym } from '../../../context/GymContext';
import {
  subscribeToChatGroups,
  subscribeToMessages,
  sendMessage,
  markChatAsRead
} from '@shared/api/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@shared/api/firebaseConfig';
import { ProfilePopup } from '../../../components/common/ProfilePopup';

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

const getUnreadCount = (group, userId) => {
  const lastReadAt = group.lastReadAt?.[userId];
  const lastMessageAt = group.lastMessageAt;

  // If no messages yet
  if (!lastMessageAt) return 0;

  // If never read, there's at least one unread message
  if (!lastReadAt) return 1;

  // Compare timestamps
  const lastReadTime = lastReadAt.toDate ? lastReadAt.toDate() : new Date(lastReadAt);
  const lastMsgTime = lastMessageAt.toDate ? lastMessageAt.toDate() : new Date(lastMessageAt);

  // If last message is after last read time, and it's not from the current user
  if (lastMsgTime > lastReadTime && group.lastMessageSender !== userId) {
    return 1; // Simple badge indicator
  }

  return 0;
};

// ============================================================================
// CHAT LIST COMPONENT (Moved outside to prevent recreation)
// ============================================================================

const ChatList = ({ chats, onSelectChat, currentUserId }) => (
  <div className="w-full flex flex-col bg-white h-full">
    <div className="p-4 border-b bg-white sticky top-0 z-10">
      <h1 className="text-xl font-bold text-gray-800">Messages</h1>
    </div>
    <div className="flex-1 overflow-y-auto">
      {chats.length > 0 ? (
        chats.map((chat) => {
          const unreadCount = getUnreadCount(chat, currentUserId);

          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 active:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-600 shrink-0">
                {getInitials(chat.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-gray-800 truncate">{chat.name}</p>
                  {chat.lastMessageAt && (
                    <p className="text-xs text-gray-400 ml-2 shrink-0">
                      {formatTimestamp(chat.lastMessageAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 truncate">
                    {chat.lastMessageText || 'No messages yet'}
                  </p>
                  {unreadCount > 0 && (
                    <div className="ml-2 shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="p-8 text-center">
          <div className="flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-sm text-gray-500 mb-2">No group chats yet</p>
            <p className="text-xs text-gray-400">Your coach will add you to relevant groups</p>
          </div>
        </div>
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
  onBack,
  userProfile,
  messagesEndRef
}) => {
  const user = auth.currentUser;

  return (
    <div className="w-full flex flex-col h-full bg-gray-50">
      {/* Chat Header */}
      <div className="p-3 md:p-4 border-b flex items-center gap-2 bg-white shadow-sm sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-800 active:scale-95 transition-transform p-1"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-lg text-gray-800">{chat.name}</h2>
          <p className="text-xs text-gray-500">{getMemberCount(chat)} Members</p>
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
                  className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 mt-1 flex items-center justify-center text-white text-xs font-bold ${
                      isCurrentUser
                        ? 'bg-green-600'
                        : isAdmin
                        ? 'bg-blue-600'
                        : 'bg-gray-400'
                    }`}
                  >
                    {getInitials(msg.senderName)}
                  </div>
                  <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`flex items-center gap-2 mb-1 ${
                        isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {isCurrentUser ? (
                        <p className="font-bold text-xs text-gray-800">You</p>
                      ) : (
                        <ProfilePopup
                          name={msg.senderName}
                          senderId={msg.senderId}
                          senderRole={msg.senderRole}
                          isAdmin={false}
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
                          ? 'bg-green-500 text-white'
                          : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      {msg.text}
                    </div>
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
  const { currentGym } = useGym();
  const [chatGroups, setChatGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const messagesEndRef = useRef(null);
  const prevMessageCountRef = useRef(0);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile(userSnap.data());
      }
    };

    fetchUserProfile();
  }, []);

  // Subscribe to chat groups (only groups user is in)
  useEffect(() => {
    const user = auth.currentUser;
    if (!currentGym?.id || !user?.uid) return;

    const unsubscribe = subscribeToChatGroups(currentGym.id, user.uid, (groups) => {
      setChatGroups(groups);
    });

    return () => unsubscribe();
  }, [currentGym?.id]);

  // Subscribe to messages for active chat
  useEffect(() => {
    if (!currentGym?.id || !activeChat?.id) return;

    const unsubscribe = subscribeToMessages(currentGym.id, activeChat.id, (msgs) => {
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [currentGym?.id, activeChat?.id]);

  // Auto-scroll to bottom only when NEW messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMessageCountRef.current = messages.length;
    } else {
      prevMessageCountRef.current = messages.length;
    }
  }, [messages]);

  // Mark chat as read when viewing
  useEffect(() => {
    const user = auth.currentUser;
    if (!currentGym?.id || !activeChat?.id || !user?.uid) return;

    // Mark as read after a short delay to ensure user has actually viewed
    const timer = setTimeout(() => {
      markChatAsRead(currentGym.id, activeChat.id, user.uid);
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentGym?.id, activeChat?.id]);

  const handleSendMessage = async () => {
    const user = auth.currentUser;
    if (!messageText.trim() || !currentGym?.id || !activeChat?.id || !user || !userProfile) return;

    const result = await sendMessage(
      currentGym.id,
      activeChat.id,
      user.uid,
      `${userProfile.firstName} ${userProfile.lastName}`,
      userProfile.role || 'member',
      messageText
    );

    if (result.success) {
      setMessageText('');
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

  return (
    <div className="flex h-[calc(100vh-120px)] bg-gray-50">
      {activeChat ? (
        <ActiveChat
          chat={activeChat}
          messages={messages}
          messageText={messageText}
          onMessageChange={setMessageText}
          onSendMessage={handleSendMessage}
          onBack={handleBack}
          userProfile={userProfile}
          messagesEndRef={messagesEndRef}
        />
      ) : (
        <ChatList
          chats={chatGroups}
          onSelectChat={handleSelectChat}
          currentUserId={auth.currentUser?.uid}
        />
      )}
    </div>
  );
};

export default GroupChatScreen;
