import React from 'react';
import { UserCircle, Lock } from 'lucide-react';

const PostComment = ({ author, text }) => (
    <div className="flex items-start gap-3 mt-3">
        <UserCircle className="h-8 w-8 text-gray-400" />
        <div className="flex-1">
            <div className="bg-gray-100 p-2 rounded-lg">
                <p className="font-semibold text-sm text-gray-800">{author}</p>
                <p className="text-sm text-gray-600">{text}</p>
            </div>
        </div>
    </div>
);

const CommunityFeedScreen = () => {
    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Community Feed</h1>

            <div className="max-w-2xl mx-auto">
                {/* Feed of Posts */}
                <div className="space-y-6">
                    {/* Sample Post 1 (Comments Unlocked) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <UserCircle className="h-10 w-10 text-gray-400" />
                                    <div>
                                        <p className="font-bold text-gray-800">Admin</p>
                                        <p className="text-xs text-gray-500">January 9, 2026</p>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-4 text-gray-700">
                                Great job to everyone who competed at the tournament this weekend! Your hard work really paid off.
                                Let's keep that energy going in class this week.
                            </p>
                             <div className="mt-4 bg-gray-200 rounded-lg h-64 flex items-center justify-center text-gray-400">
                                [Image Placeholder]
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <h3 className="font-semibold text-xs uppercase text-gray-500 mb-2">Comments (2)</h3>
                            <PostComment author="John Doe" text="It was an awesome event!" />
                            <PostComment author="Jane Smith" text="Thanks for the support, Coach!" />
                        </div>
                         {/* Member-facing comment input */}
                         <div className="border-t p-3 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <UserCircle className="h-8 w-8 text-gray-400" />
                                <input type="text" placeholder="Write a comment..." className="w-full bg-white border border-gray-300 rounded-full px-4 py-1.5 text-sm" />
                            </div>
                        </div>
                    </div>
                    
                    {/* Sample Post 2 (Comments Locked) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <UserCircle className="h-10 w-10 text-gray-400" />
                                    <div>
                                        <p className="font-bold text-gray-800">Admin</p>
                                        <p className="text-xs text-gray-500">January 7, 2026</p>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-4 text-gray-700">
                                Reminder: The gym will be closed this Monday for the public holiday. Enjoy the long weekend!
                            </p>
                        </div>
                         <div className="px-4 pb-3 border-t bg-gray-50 text-center text-xs text-gray-500 rounded-b-xl">
                            <p className="flex items-center justify-center gap-1.5"><Lock size={12} /> Comments are disabled for this post.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityFeedScreen;
