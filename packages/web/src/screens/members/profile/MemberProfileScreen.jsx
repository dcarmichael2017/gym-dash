import React, { useState, useEffect } from 'react';
import {
    User, Mail, Phone, CreditCard, LogOut, ChevronRight,
    ShieldCheck, AlertTriangle, FileText, Edit2, Check, X,
    Loader2, CheckCircle, RefreshCw
} from 'lucide-react';

import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { useGym } from '../../../context/GymContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { signWaiver, getGymWaiver } from '../../../../../../packages/shared/api/firestore';
import WaiverModal from '../dashboard/WaiverModal';

// --- UTILS: Formatting Helpers ---
const formatPhoneNumber = (value) => {
    if (!value) return "";
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;

    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const stripPhoneNumber = (value) => {
    return value ? value.replace(/[^\d]/g, '') : '';
};

// --- SUB-COMPONENT: Profile Field ---
const ProfileField = ({ icon: Icon, label, value, onChange, isEditing, editable, placeholder }) => (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-50 last:border-0">
        <div className="flex items-center gap-3 overflow-hidden w-full">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                <Icon size={16} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
                {editable && isEditing ? (
                    <input
                        type="text"
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        maxLength={label === "Phone Number" ? 14 : 50}
                        className="font-medium text-gray-900 border-b border-blue-300 focus:outline-none focus:border-blue-600 w-full bg-transparent py-0.5"
                    />
                ) : (
                    <span className="font-medium text-gray-900 truncate block h-6 flex items-center">
                        {value || <span className="text-gray-300 font-normal italic">Not set</span>}
                    </span>
                )}
            </div>
        </div>
    </div>
);

const MemberProfileScreen = () => {
    const { currentGym, memberships } = useGym();
    const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };

    // --- STATE ---
    const [user, setUser] = useState(auth.currentUser);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showWaiverModal, setShowWaiverModal] = useState(false);
    const [currentWaiverVersion, setCurrentWaiverVersion] = useState(1);

    // Local Form State (Removed photoURL)
    const [formData, setFormData] = useState({
        displayName: '',
        phoneNumber: ''
    });

    // --- EFFECT 1: FETCH DATA ---
    useEffect(() => {
        const fetchUserData = async () => {
            if (!user) return;
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setFormData({
                        displayName: data.name || user.displayName || '',
                        phoneNumber: formatPhoneNumber(data.phoneNumber || '')
                    });
                } else {
                    setFormData({
                        displayName: user.displayName || '',
                        phoneNumber: ''
                    });
                }
            } catch (e) {
                console.error("Error fetching user profile:", e);
            }
        };
        fetchUserData();
    }, [user]);

    // --- EFFECT 2: WAIVER ---
    useEffect(() => {
        const fetchVersion = async () => {
            if (currentGym?.id) {
                const res = await getGymWaiver(currentGym.id);
                if (res.success) setCurrentWaiverVersion(res.version || 1);
            }
        };
        fetchVersion();
    }, [currentGym?.id]);

    // Derived Logic
    const myMembership = memberships?.find(m => m.gymId === currentGym?.id);
    const planName = myMembership?.planName || "No Active Plan";
    const rawStatus = myMembership?.status || "guest";
    const hasWaiver = myMembership?.waiverSigned === true;
    const userSignedVersion = myMembership?.waiverSignedVersion || 0;
    const isOutdated = hasWaiver && userSignedVersion < currentWaiverVersion;

    // --- HANDLERS ---
    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData(prev => ({ ...prev, phoneNumber: formatted }));
    };

    const handleUpdateProfile = async () => {
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const rawPhone = stripPhoneNumber(formData.phoneNumber);

            await updateDoc(userRef, {
                name: formData.displayName,
                phoneNumber: rawPhone,
                updatedAt: new Date()
            });

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: formData.displayName
                });
            }

            setUser(prev => ({
                ...prev,
                displayName: formData.displayName
            }));

            setIsEditing(false);
        } catch (error) {
            console.error("Profile update failed", error);
            alert("Failed to update profile.");
        }
        setLoading(false);
    };

    const handleSignOut = async () => {
        await auth.signOut();
        window.location.href = '/';
    };

    const handleManageBilling = () => {
        alert("This will redirect to the Stripe Customer Portal.");
    };

    const handleWaiverSign = async () => {
        if (user && currentGym) {
            await signWaiver(user.uid, currentGym.id, currentWaiverVersion);
            setShowWaiverModal(false);
        }
    };

    // --- HELPER: STATUS LABEL ---

    const getStatusDisplay = (status) => {

        switch (status) {

            case 'active': return { label: 'Active Member', color: 'bg-green-100 text-green-700 border-green-200' };

            case 'trialing': return { label: 'Trial Period', color: 'bg-blue-100 text-blue-700 border-blue-200' };

            case 'past_due': return { label: 'Payment Failed', color: 'bg-red-100 text-red-700 border-red-200' };

            default: return { label: 'Guest Account', color: 'bg-gray-100 text-gray-500 border-gray-200' };

        }

    };



    const statusBadge = getStatusDisplay(rawStatus);

    return (
        <div className="pb-24 safe-top bg-gray-50 min-h-screen">

            {/* WAIVER MODAL */}
            {showWaiverModal && (
                <WaiverModal
                    gymId={currentGym.id}
                    gymName={currentGym.name}
                    theme={theme}
                    onAccept={handleWaiverSign}
                    onDecline={() => setShowWaiverModal(false)}
                    onClose={() => setShowWaiverModal(false)}
                    viewOnly={hasWaiver && !isOutdated}
                    targetVersion={hasWaiver && !isOutdated ? userSignedVersion : currentWaiverVersion}
                    lastSignedVersion={userSignedVersion}
                    isUpdate={isOutdated}
                />
            )}

            {/* --- HEADER --- */}
            <div className="bg-white p-6 pb-8 rounded-b-[2rem] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-current to-transparent opacity-50" style={{ color: theme.primaryColor }}></div>

                {/* TOP ROW: TITLE & EDIT BUTTON */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-xl font-bold text-gray-400 uppercase tracking-wider text-[10px]">Account Details</h1>
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all">
                            <Edit2 size={18} />
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="p-2 bg-gray-50 rounded-full text-gray-500">
                                <X size={18} />
                            </button>
                            <button onClick={handleUpdateProfile} disabled={loading} className="p-2 rounded-full text-white shadow-md flex items-center justify-center transition-transform active:scale-95" style={{ backgroundColor: theme.primaryColor }}>
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            </button>
                        </div>
                    )}
                </div>

                {/* MAIN INFO (No Image) */}
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-1">{formData.displayName || user?.displayName || "Member"}</h2>
                    <p className="text-sm text-gray-500 font-medium">{user?.email}</p>

                    <div className="flex gap-2 mt-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${statusBadge.color}`}>{statusBadge.label}</span>
                        {isOutdated && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-yellow-50 text-yellow-700 border border-yellow-100 flex items-center gap-1"><AlertTriangle size={10} /> Update Terms</span>}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* --- PERSONAL DETAILS --- */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 px-1">Personal Details</h3>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <ProfileField
                            icon={User}
                            label="Full Name"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            isEditing={isEditing}
                            editable
                            placeholder="Your Full Name"
                        />

                        <ProfileField
                            icon={Phone}
                            label="Phone Number"
                            value={formData.phoneNumber}
                            onChange={handlePhoneChange}
                            isEditing={isEditing}
                            editable
                            placeholder="(555) 123-4567"
                        />

                        <ProfileField
                            icon={Mail}
                            label="Email"
                            value={user?.email}
                            isEditing={isEditing}
                            editable={false}
                        />
                    </div>
                </div>

                {/* --- MEMBERSHIP SECTION --- */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 px-1">Membership & Billing</h3>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-50">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Current Plan</span>
                            </div>
                            <div className="text-lg font-bold text-gray-900">{planName}</div>
                            {rawStatus === 'active' && <div className="text-xs text-gray-500 mt-1">Active Subscription</div>}
                        </div>

                        <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer" onClick={handleManageBilling}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${rawStatus === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <CreditCard size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Payment Method</p>
                                    <p className="text-xs text-gray-500">{rawStatus === 'active' ? 'Manage Card' : 'Add Payment Method'}</p>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* --- LEGAL SECTION --- */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 px-1">Legal Documents</h3>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <button onClick={() => setShowWaiverModal(true)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasWaiver && !isOutdated ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {isOutdated ? <RefreshCw size={16} /> : <FileText size={16} />}
                                </div>
                                <span className="text-sm font-medium text-gray-700">Liability Waiver</span>
                            </div>
                            {hasWaiver && !isOutdated ? <div className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle size={14} /> Accepted v{userSignedVersion}</div> : <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-100">Sign Now</div>}
                        </button>
                    </div>
                </div>

                {/* --- SIGN OUT --- */}
                <button onClick={handleSignOut} className="w-full py-4 rounded-xl border border-red-100 bg-white text-red-600 font-bold text-sm shadow-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                    <LogOut size={16} /> Sign Out
                </button>

                <p className="text-center text-xs text-gray-300 pt-4 pb-8">GymDash • {currentGym?.name}</p>
            </div>
        </div>
    );
};

export default MemberProfileScreen;