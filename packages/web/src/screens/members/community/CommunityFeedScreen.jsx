import React, { useState, useEffect } from 'react';
import { Lock, Send, Loader2, MessageSquare, Pin } from 'lucide-react';
import { useGym } from '../../../context/GymContext';
import {
    subscribeToCommunityPosts,
    subscribeToPostComments,
    addComment,
    deleteComment
} from '@shared/api/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@shared/api/firebaseConfig';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatRelativeTime = (timestamp) => {
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
// POST COMMENT COMPONENT
// ============================================================================

const PostComment = ({ comment, currentUserId, onDelete, theme }) => {
    if (comment.deletedAt) return null;

    const isAdminComment = ['owner', 'staff', 'coach'].includes(comment.authorRole);
    const isOwnComment = comment.authorId === currentUserId;

    return (
        <div className="flex items-start gap-3 mt-3 group">
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: isAdminComment ? theme.primaryColor : '#9ca3af' }}
            >
                {getInitials(comment.authorName)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="bg-gray-100 p-2 rounded-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-gray-800">{comment.authorName}</p>
                        {isAdminComment && (
                            <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{ color: theme.primaryColor, backgroundColor: `${theme.primaryColor}20` }}
                            >
                                ADMIN
                            </span>
                        )}
                        <span className="text-xs text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{comment.text}</p>
                </div>
            </div>
            {isOwnComment && (
                <button
                    onClick={() => onDelete(comment.id)}
                    className="text-xs text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                    Delete
                </button>
            )}
        </div>
    );
};

// ============================================================================
// SINGLE POST COMPONENT
// ============================================================================

const CommunityPost = ({ post, gymId, userProfile, theme }) => {
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const user = auth.currentUser;

    // Subscribe to comments when expanded
    useEffect(() => {
        if (!showComments || !gymId || !post.id) return;

        const unsubscribe = subscribeToPostComments(gymId, post.id, (newComments) => {
            setComments(newComments);
        });

        return () => unsubscribe();
    }, [gymId, post.id, showComments]);

    const handleSubmitComment = async () => {
        if (!commentText.trim() || !user || !userProfile || submitting) return;

        setSubmitting(true);
        const result = await addComment(gymId, post.id, {
            authorId: user.uid,
            authorName: `${userProfile.firstName} ${userProfile.lastName}`,
            authorRole: userProfile.role || 'member',
            text: commentText
        });

        if (result.success) {
            setCommentText('');
        }
        setSubmitting(false);
    };

    const handleDeleteOwnComment = async (commentId) => {
        if (!user) return;

        if (window.confirm('Delete your comment?')) {
            await deleteComment(gymId, post.id, commentId, user.uid);
        }
    };

    const isCreatorAdmin = ['owner', 'staff', 'coach'].includes(post.creatorRole);
    const visibleComments = comments.filter(c => !c.deletedAt);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4">
                {/* Post Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: isCreatorAdmin ? theme.primaryColor : '#9ca3af' }}
                        >
                            {getInitials(post.creatorName)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-800">{post.creatorName}</p>
                                {isCreatorAdmin && (
                                    <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                        style={{ color: theme.primaryColor, backgroundColor: `${theme.primaryColor}20` }}
                                    >
                                        ADMIN
                                    </span>
                                )}
                                {post.isPinned && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <Pin size={10} /> PINNED
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">
                                {formatTimestamp(post.createdAt)}
                                {post.editedAt && <span className="ml-1 italic">(edited)</span>}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Post Content */}
                <p className="mt-4 text-gray-700 whitespace-pre-wrap">{post.content}</p>

                {/* Post Image */}
                {post.imageUrl && (
                    <div className="mt-4">
                        <img
                            src={post.imageUrl}
                            alt="Post image"
                            className="w-full rounded-lg max-h-96 object-cover"
                        />
                    </div>
                )}
            </div>

            {/* Comments Section */}
            {post.allowComments ? (
                <>
                    <div className="px-4 pb-2">
                        <button
                            onClick={() => setShowComments(!showComments)}
                            className="text-sm text-gray-500 hover:opacity-80 flex items-center gap-1 transition-colors"
                            style={{ color: showComments ? theme.primaryColor : undefined }}
                        >
                            <MessageSquare size={14} />
                            {post.commentCount || 0} Comment{(post.commentCount || 0) !== 1 ? 's' : ''}
                        </button>
                    </div>

                    {showComments && (
                        <div className="px-4 pb-4">
                            {visibleComments.length > 0 && (
                                <div className="space-y-1">
                                    {visibleComments.map(comment => (
                                        <PostComment
                                            key={comment.id}
                                            comment={comment}
                                            currentUserId={user?.uid}
                                            onDelete={handleDeleteOwnComment}
                                            theme={theme}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Comment Input */}
                    <div className="border-t p-3 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: ['owner', 'staff', 'coach'].includes(userProfile?.role) ? theme.primaryColor : '#9ca3af' }}
                            >
                                {getInitials(userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Me')}
                            </div>
                            <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
                                placeholder="Write a comment..."
                                className="w-full bg-white border border-gray-300 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2"
                                style={{ '--tw-ring-color': theme.primaryColor }}
                                disabled={submitting}
                            />
                            <button
                                onClick={handleSubmitComment}
                                disabled={!commentText.trim() || submitting}
                                className="disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                                style={{ color: commentText.trim() && !submitting ? theme.primaryColor : undefined }}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="px-4 pb-3 border-t bg-gray-50 text-center text-xs text-gray-500 rounded-b-xl">
                    <p className="flex items-center justify-center gap-1.5 py-2">
                        <Lock size={12} /> Comments are disabled for this post.
                    </p>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CommunityFeedScreen = () => {
    const { currentGym } = useGym();
    const [userProfile, setUserProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    const gymId = currentGym?.id;
    const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };

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

    // Subscribe to posts
    useEffect(() => {
        if (!gymId) return;

        setLoading(true);
        const unsubscribe = subscribeToCommunityPosts(gymId, (newPosts) => {
            setPosts(newPosts);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [gymId]);

    if (loading && posts.length === 0) {
        return (
            <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Community Feed</h1>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-gray-400" size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Community Feed</h1>

            <div className="max-w-2xl mx-auto">
                {/* Feed of Posts */}
                <div className="space-y-6">
                    {posts.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 mb-2">No posts yet</p>
                            <p className="text-sm text-gray-400">Check back later for updates from your gym.</p>
                        </div>
                    ) : (
                        posts.map(post => (
                            <CommunityPost
                                key={post.id}
                                post={post}
                                gymId={gymId}
                                userProfile={userProfile}
                                theme={theme}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunityFeedScreen;
