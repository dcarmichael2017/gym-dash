import React, { useState } from 'react';
import { Send, ArrowLeft } from 'lucide-react';

const GroupChatScreen = () => {
    // In a real app, this would come from props/context and filter based on the user's groups
    const availableChats = [
        { id: 1, name: 'Competition Team', lastMessage: "Jane: Don't forget your mouthguard!" },
    ];

    const [activeChat, setActiveChat] = useState(null);

    const ChatList = ({ chats, onSelectChat }) => (
        <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-white h-full">
            <div className="p-4 border-b">
                <h1 className="text-xl font-bold text-gray-800">Messages</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
                {chats.length > 0 ? chats.map(chat => (
                    <div key={chat.id} onClick={() => onSelectChat(chat)} className="p-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-600">
                            {chat.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">{chat.name}</p>
                            <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                        </div>
                    </div>
                )) : (
                    <div className="p-4 text-center text-sm text-gray-500">
                        You haven't been added to any group chats yet.
                    </div>
                )}
            </div>
        </div>
    );

    const ActiveChat = ({ chat, onBack }) => (
        <div className="w-full flex flex-col h-full bg-gray-50">
            {/* Chat Header */}
            <div className="p-3 md:p-4 border-b flex items-center gap-2 bg-white shadow-sm">
                <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-800">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="font-bold text-lg text-gray-800">{chat.name}</h2>
                    <p className="text-xs text-gray-500">4 Members</p>
                </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                 {/* Other Member Message */}
                 <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-300 shrink-0 mt-1"></div>
                    <div>
                        <p className="font-bold text-sm text-gray-800">John Doe</p>
                        <div className="bg-white p-2 rounded-lg border border-gray-200 text-sm text-gray-700 inline-block">
                            Hey everyone, is practice still on for 6 PM tonight?
                        </div>
                    </div>
                </div>
                {/* Admin Message */}
                <div className="flex gap-2">
                     <div className="w-8 h-8 rounded-full bg-blue-600 shrink-0 mt-1"></div>
                     <div>
                        <p className="font-bold text-sm text-blue-700">Admin</p>
                        <div className="bg-white p-2 rounded-lg border border-gray-200 text-sm text-gray-700 inline-block">
                            Yep, see you all there!
                        </div>
                    </div>
                </div>
                {/* Your Message */}
                <div className="flex flex-row-reverse gap-2 group">
                    <div className="w-8 h-8 rounded-full bg-green-600 shrink-0 mt-1"></div>
                    <div>
                        <p className="font-bold text-sm text-gray-800 text-right">You</p>
                        <div className="bg-green-500 p-2 rounded-lg text-sm text-white inline-block">
                            Don't forget your mouthguard!
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
                    <ChatList chats={availableChats} onSelectChat={setActiveChat} />
                )}
            </div>
            {/* Desktop View (Member layout doesn't use this, but good practice) */}
            <div className="hidden md:flex w-full h-full">
                 <ChatList chats={availableChats} onSelectChat={setActiveChat} />
                {activeChat ? (
                    <ActiveChat chat={activeChat} onBack={() => {}} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        Select a conversation to view messages.
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupChatScreen;
