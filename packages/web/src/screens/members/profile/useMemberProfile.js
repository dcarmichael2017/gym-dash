import { useState, useEffect } from 'react';
import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { signWaiver, getGymWaiver } from '../../../../../../packages/shared/api/firestore';
import { useGym } from '../../../context/GymContext';
import { useConfirm } from '../../../context/ConfirmationContext'; // Import your context hook

export const useMemberProfile = () => {
    const { currentGym, memberships } = useGym();
    const { confirm } = useConfirm(); // Pull the confirm function
    const [user, setUser] = useState(auth.currentUser);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showWaiverModal, setShowWaiverModal] = useState(false);
    const [currentWaiverVersion, setCurrentWaiverVersion] = useState(1);
    const [formData, setFormData] = useState({ displayName: '', phoneNumber: '' });
    const [initialData, setInitialData] = useState({ displayName: '', phoneNumber: '' });
    const [showSuccess, setShowSuccess] = useState(false);

    // ... formatPhoneNumber and stripPhoneNumber helpers remain the same ...
    const formatPhoneNumber = (value) => {
        if (!value) return "";
        const phoneNumber = value.replace(/[^\d]/g, '');
        const len = phoneNumber.length;
        if (len < 4) return phoneNumber;
        if (len < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    };

    const stripPhoneNumber = (value) => value ? value.replace(/[^\d]/g, '') : '';

    useEffect(() => {
        const fetchUserData = async () => {
            if (!user) return;
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                const fetched = {
                    displayName: data.name || user.displayName || '',
                    phoneNumber: formatPhoneNumber(data.phoneNumber || '')
                };
                setFormData(fetched);
                setInitialData(fetched);
            }
        };
        fetchUserData();
    }, [user]);

    useEffect(() => {
        const fetchVersion = async () => {
            if (currentGym?.id) {
                const res = await getGymWaiver(currentGym.id);
                if (res.success) setCurrentWaiverVersion(res.version || 1);
            }
        };
        fetchVersion();
    }, [currentGym?.id]);

    const handleUpdateProfile = async () => {
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                name: formData.displayName,
                phoneNumber: stripPhoneNumber(formData.phoneNumber),
                updatedAt: new Date()
            });

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: formData.displayName });
            }

            setInitialData(formData);
            setIsEditing(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error(error);
            alert("Failed to update profile.");
        }
        setLoading(false);
    };

    // --- UPDATED LOGIC USING YOUR CONTEXT ---
    const handleCancel = async () => {
        const hasChanges = formData.displayName !== initialData.displayName || 
                           formData.phoneNumber !== initialData.phoneNumber;

        if (hasChanges) {
            const confirmed = await confirm({
                title: "Discard Changes?",
                message: "You have unsaved changes. Are you sure you want to discard them?",
                type: "danger", // This will trigger your red icon/theme
                confirmText: "Discard",
                cancelText: "Keep Editing"
            });

            if (confirmed) {
                setFormData(initialData);
                setIsEditing(false);
            }
        } else {
            setIsEditing(false);
        }
    };

    const handleWaiverSign = async () => {
        if (user && currentGym) {
            await signWaiver(user.uid, currentGym.id, currentWaiverVersion);
            setShowWaiverModal(false);
        }
    };

    const getStatusDisplay = (status) => {
        const s = status?.toLowerCase();
        if (s === 'active') return { label: 'Active Member', color: 'bg-green-100 text-green-700 border-green-200' };
        if (s === 'trialing') return { label: 'Trial Period', color: 'bg-blue-100 text-blue-700 border-blue-200' };
        if (s === 'past_due') return { label: 'Payment Failed', color: 'bg-red-100 text-red-700 border-red-200' };
        if (s === 'expired' || s === 'cancelled') return { label: 'Former Member', color: 'bg-orange-100 text-orange-700 border-orange-200' };
        return { label: 'Free Member', color: 'bg-gray-100 text-gray-500 border-gray-200' };
    };

    return {
        user, formData, setFormData, isEditing, setIsEditing, loading,
        showWaiverModal, setShowWaiverModal, currentWaiverVersion,
        handleUpdateProfile, handleCancel, handleWaiverSign, formatPhoneNumber,
        getStatusDisplay, currentGym, memberships, showSuccess
    };
};