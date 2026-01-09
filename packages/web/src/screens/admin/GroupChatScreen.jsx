import React, { useState } from 'react';
import { UserPlus, Trash2, Send, MoreVertical, PlusCircle, ArrowLeft } from 'lucide-react';

const GroupChatScreen = () => {
    const [activeChat, setActiveChat] = useState(null);

    const ChatList = ({ onSelectChat }) => (
        <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-white h-full">
            <div className="p-4 border-b flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800">Messages</h1>
                <button className="text-blue-600 hover:text-blue-800">
                    <PlusCircle size={22} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {/* Sample Chat Item */}
                <div onClick={() => onSelectChat({ id: 1, name: 'Competition Team' })} className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-600">CT</div>
                    <div>
                        <p className="font-semibold text-gray-800">Competition Team</p>
                        <p className="text-sm text-gray-500 truncate">Jane: Don't forget your mouthguard!</p>
                    </div>
                </div>
                 {/* Sample Chat Item 2 */}
                <div onClick={() => onSelectChat({ id: 2, name: 'Coaches Corner' })} className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600">CC</div>
                    <div>
                        <p className="font-semibold text-gray-800">Coaches Corner</p>
                        <p className="text-sm text-gray-500 truncate">Admin: New schedule is up.</p>
                    </div>
                </div>
            </div>
        </div>
    );

    const ActiveChat = ({ chat, onBack }) => (
        <div className="w-full md:w-2/3 flex flex-col h-full bg-gray-50">
            {/* Chat Header */}
            <div className="p-3 md:p-4 border-b flex justify-between items-center bg-white shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-800">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="font-bold text-lg text-gray-800">{chat.name}</h2>
                        <p className="text-xs text-gray-500">4 Members</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <button className="flex items-center gap-1 text-xs md:text-sm font-medium text-gray-600 hover:text-blue-600">
                        <UserPlus size={16} /> <span className="hidden md:inline">Add Member</span>
                    </button>
                    <button className="text-gray-500 hover:text-gray-800">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {/* Admin Message */}
                <div className="flex flex-row-reverse gap-2 group">
                    <div className="w-8 h-8 rounded-full bg-blue-600 shrink-0 mt-1"></div>
                    <div className="flex items-end gap-2">
                        <button className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                        </button>
                        <div>
                            <p className="font-bold text-sm text-gray-800 text-right">Admin</p>
                            <div className="bg-blue-500 p-2 rounded-lg text-sm text-white inline-block">
                                Yep, see you all there!
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Type a message..."
                        className="w-full p-3 pr-12 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Mobile View */}
            <div className="md:hidden w-full h-full">
                {activeChat ? (
                    <ActiveChat chat={activeChat} onBack={() => setActiveChat(null)} />
                ) : (
                    <ChatList onSelectChat={setActiveChat} />
                )}
            </div>
            {/* Desktop View */}
            <div className="hidden md:flex w-full h-full">
                <ChatList onSelectChat={setActiveChat} />
                {activeChat ? (
                    <ActiveChat chat={activeChat} onBack={() => {}} />
                ) : (
                    <div className="w-2/3 flex items-center justify-center text-gray-500">
                        Select a conversation to start messaging.
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupChatScreen;
