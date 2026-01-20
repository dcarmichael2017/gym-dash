import React, { useState, useEffect, useRef } from 'react';
import {
    UserCircle,
    Trash2,
    Edit,
    Lock,
    Unlock,
    Send,
    Pin,
    PinOff,
    X,
    Loader2,
    MessageSquare,
    Image as ImageIcon,
    Crop
} from 'lucide-react';
import {
    subscribeToCommunityPosts,
    subscribeToPostComments,
    createCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
    togglePostComments,
    togglePostPin,
    addComment,
    deleteComment
} from '@shared/api/firestore';
import { uploadCommunityPostImage } from '@shared/api/storage';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@shared/api/firebaseConfig';
import { useConfirm } from '../../context/ConfirmationContext';
import ImageCropModal from '../../components/common/ImageCropModal';

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

const PostComment = ({ comment, onDelete, isAdmin, theme }) => {
    if (comment.deletedAt) return null;

    const isAdminComment = ['owner', 'staff', 'coach'].includes(comment.authorRole);

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
                    <div className="flex items-center gap-2">
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
            {isAdmin && (
                <button
                    onClick={() => onDelete(comment.id)}
                    className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Delete comment"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );
};

// ============================================================================
// SINGLE POST COMPONENT
// ============================================================================

const CommunityPost = ({
    post,
    gymId,
    userProfile,
    theme,
    onEdit,
    onDelete,
    onToggleComments,
    onTogglePin
}) => {
    const { confirm } = useConfirm();
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Subscribe to comments when expanded
    useEffect(() => {
        if (!showComments || !gymId || !post.id) return;

        const unsubscribe = subscribeToPostComments(gymId, post.id, (newComments) => {
            setComments(newComments);
        });

        return () => unsubscribe();
    }, [gymId, post.id, showComments]);

    const handleSubmitComment = async () => {
        const user = auth.currentUser;
        if (!commentText.trim() || !user || !userProfile || submitting) return;

        setSubmitting(true);
        const result = await addComment(gymId, post.id, {
            authorId: user.uid,
            authorName: `${userProfile.firstName} ${userProfile.lastName}`,
            authorRole: userProfile.role || 'staff',
            text: commentText
        });

        if (result.success) {
            setCommentText('');
        }
        setSubmitting(false);
    };

    const handleDeleteComment = async (commentId) => {
        const user = auth.currentUser;
        const confirmed = await confirm({
            title: 'Delete Comment?',
            message: 'This comment will be permanently deleted.',
            type: 'danger',
            confirmText: 'Delete',
            cancelText: 'Cancel'
        });

        if (confirmed) {
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
                            <div className="flex items-center gap-2">
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

                    {/* Admin Controls */}
                    <div className="flex items-center gap-2 text-gray-500">
                        <button
                            onClick={() => onEdit(post)}
                            className="hover:text-blue-600 transition-colors p-1"
                            title="Edit post"
                        >
                            <Edit size={16} />
                        </button>
                        <button
                            onClick={() => onTogglePin(post)}
                            className={`transition-colors p-1 ${post.isPinned ? 'text-amber-500 hover:text-amber-600' : 'hover:text-amber-500'}`}
                            title={post.isPinned ? 'Unpin post' : 'Pin post'}
                        >
                            {post.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                        </button>
                        <button
                            onClick={() => onToggleComments(post)}
                            className={`transition-colors p-1 ${post.allowComments ? 'hover:text-red-600' : 'text-red-500 hover:text-green-600'}`}
                            title={post.allowComments ? 'Disable comments' : 'Enable comments'}
                        >
                            {post.allowComments ? <Unlock size={16} /> : <Lock size={16} />}
                        </button>
                        <button
                            onClick={() => onDelete(post)}
                            className="hover:text-red-600 transition-colors p-1"
                            title="Delete post"
                        >
                            <Trash2 size={16} />
                        </button>
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
                                            onDelete={handleDeleteComment}
                                            isAdmin={true}
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
                                style={{ backgroundColor: theme.primaryColor }}
                            >
                                {getInitials(userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin')}
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
// EDIT POST MODAL
// ============================================================================

const EditPostModal = ({ post, gymId, onClose }) => {
    const [content, setContent] = useState(post.content);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!content.trim()) return;

        setSaving(true);
        const result = await updateCommunityPost(gymId, post.id, { content });

        if (result.success) {
            onClose();
        } else {
            alert(`Error updating post: ${result.error}`);
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">Edit Post</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows="6"
                        placeholder="What's on your mind?"
                        autoFocus
                    />
                </div>

                <div className="p-4 border-t flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!content.trim() || saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CommunityFeedScreen = () => {
    const { confirm } = useConfirm();
    const [gymId, setGymId] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState({ primaryColor: '#2563eb', secondaryColor: '#4f46e5' });

    // Create post state
    const [newPostContent, setNewPostContent] = useState('');
    const [allowComments, setAllowComments] = useState(true);
    const [isPinned, setIsPinned] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showCropModal, setShowCropModal] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);
    const fileInputRef = useRef(null);

    // Edit modal state
    const [editingPost, setEditingPost] = useState(null);

    // Fetch user profile, gymId, and gym theme
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
                    // Fetch gym theme
                    const gymRef = doc(db, 'gyms', userData.gymId);
                    const gymSnap = await getDoc(gymRef);
                    if (gymSnap.exists() && gymSnap.data().theme) {
                        setTheme(gymSnap.data().theme);
                    }
                }
            }
        };

        fetchUserData();
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

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 10MB for original, will be compressed after crop)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image must be less than 10MB');
            return;
        }

        // Open crop modal instead of setting image directly
        setImageToCrop(file);
        setShowCropModal(true);

        // Reset file input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCropComplete = (croppedFile) => {
        setSelectedImage(croppedFile);
        setImagePreview(URL.createObjectURL(croppedFile));
        setShowCropModal(false);
        setImageToCrop(null);
    };

    const handleCropCancel = () => {
        setShowCropModal(false);
        setImageToCrop(null);
    };

    const clearSelectedImage = () => {
        setSelectedImage(null);
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCreatePost = async () => {
        const user = auth.currentUser;
        if (!newPostContent.trim() || !user || !userProfile || creating) return;

        setCreating(true);

        let imageUrl = null;

        // Upload image if selected
        if (selectedImage) {
            setUploadingImage(true);
            const uploadResult = await uploadCommunityPostImage(gymId, selectedImage);
            setUploadingImage(false);

            if (!uploadResult.success) {
                alert(`Error uploading image: ${uploadResult.error}`);
                setCreating(false);
                return;
            }
            imageUrl = uploadResult.url;
        }

        const result = await createCommunityPost(gymId, {
            content: newPostContent,
            allowComments,
            isPinned,
            imageUrl,
            creatorId: user.uid,
            creatorName: `${userProfile.firstName} ${userProfile.lastName}`,
            creatorRole: userProfile.role || 'staff'
        });

        if (result.success) {
            setNewPostContent('');
            setAllowComments(true);
            setIsPinned(false);
            clearSelectedImage();
        } else {
            alert(`Error creating post: ${result.error}`);
        }
        setCreating(false);
    };

    const handleDeletePost = async (post) => {
        const confirmed = await confirm({
            title: 'Delete Post?',
            message: 'This post and all its comments will be permanently deleted. This cannot be undone.',
            type: 'danger',
            confirmText: 'Delete Post',
            cancelText: 'Cancel'
        });

        if (confirmed) {
            await deleteCommunityPost(gymId, post.id);
        }
    };

    const handleToggleComments = async (post) => {
        await togglePostComments(gymId, post.id, !post.allowComments);
    };

    const handleTogglePin = async (post) => {
        await togglePostPin(gymId, post.id, !post.isPinned);
    };

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
                {/* Create Post Form */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
                    <h2 className="font-bold text-lg mb-2">Create a New Post</h2>
                    <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows="4"
                        placeholder="Share an update with your members..."
                        disabled={creating}
                    />

                    {/* Image Preview */}
                    {imagePreview && (
                        <div className="mt-3 relative inline-block">
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="max-h-48 rounded-lg border border-gray-200"
                            />
                            <button
                                onClick={clearSelectedImage}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                disabled={creating}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-4 text-gray-500">
                            {/* Image Upload Button */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageSelect}
                                accept="image/*"
                                className="hidden"
                                disabled={creating}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                                    selectedImage ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'
                                }`}
                                disabled={creating}
                                title={selectedImage ? 'Replace image' : 'Add image with crop'}
                            >
                                {selectedImage ? <ImageIcon size={16} /> : <Crop size={16} />}
                                {selectedImage ? 'Change' : 'Add Image'}
                            </button>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="allowComments"
                                    checked={allowComments}
                                    onChange={() => setAllowComments(!allowComments)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    disabled={creating}
                                />
                                <label htmlFor="allowComments" className="text-xs font-medium text-gray-600">
                                    Allow Comments
                                </label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isPinned"
                                    checked={isPinned}
                                    onChange={() => setIsPinned(!isPinned)}
                                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    disabled={creating}
                                />
                                <label htmlFor="isPinned" className="text-xs font-medium text-gray-600 flex items-center gap-1">
                                    <Pin size={12} /> Pin Post
                                </label>
                            </div>
                        </div>
                        <button
                            onClick={handleCreatePost}
                            disabled={!newPostContent.trim() || creating}
                            className="text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-opacity"
                            style={{ backgroundColor: !newPostContent.trim() || creating ? undefined : theme.primaryColor }}
                        >
                            {creating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    {uploadingImage ? 'Uploading...' : 'Posting...'}
                                </>
                            ) : (
                                <>
                                    <Send size={16} /> Post
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Feed of Posts */}
                <div className="space-y-6">
                    {posts.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 mb-2">No posts yet</p>
                            <p className="text-sm text-gray-400">Create your first post to share updates with your members.</p>
                        </div>
                    ) : (
                        posts.map(post => (
                            <CommunityPost
                                key={post.id}
                                post={post}
                                gymId={gymId}
                                userProfile={userProfile}
                                theme={theme}
                                onEdit={setEditingPost}
                                onDelete={handleDeletePost}
                                onToggleComments={handleToggleComments}
                                onTogglePin={handleTogglePin}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Edit Post Modal */}
            {editingPost && (
                <EditPostModal
                    post={editingPost}
                    gymId={gymId}
                    onClose={() => setEditingPost(null)}
                />
            )}

            {/* Image Crop Modal */}
            {showCropModal && imageToCrop && (
                <ImageCropModal
                    image={imageToCrop}
                    onCropComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                    defaultAspect="4:3"
                    allowAspectChange={true}
                    primaryColor={theme.primaryColor}
                />
            )}
        </div>
    );
};

export default CommunityFeedScreen;
