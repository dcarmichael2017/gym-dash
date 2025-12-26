import React from 'react';
import { User, Mail, Phone, LogOut, Edit2, Check, X, Loader2 } from 'lucide-react';
import { useMemberProfile } from './useMemberProfile';
import { ProfileField } from './ProfileFields';
import { MembershipSection } from './MembershipSection';
import { LegalSection } from './LegalSection';
import WaiverModal from '../dashboard/WaiverModal';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';

const MemberProfileScreen = () => {
    const {
        user, formData, setFormData, isEditing, setIsEditing, loading,
        showWaiverModal, setShowWaiverModal, currentWaiverVersion,
        handleUpdateProfile, handleCancel, handleWaiverSign, formatPhoneNumber,
        getStatusDisplay, currentGym, memberships, showSuccess
    } = useMemberProfile();

    const theme = currentGym?.theme || { primaryColor: '#2563eb' };
    const myMembership = memberships?.find(m => m.gymId === currentGym?.id);
    const statusBadge = getStatusDisplay(myMembership?.status || 'guest');
    
    const hasWaiver = myMembership?.waiverSigned === true;
    const userSignedVersion = myMembership?.waiverSignedVersion || 0;
    const isOutdated = hasWaiver && userSignedVersion < currentWaiverVersion;

    return (
        <div className="pb-32 bg-gray-50 min-h-screen relative">
            
            {/* SUCCESS TOAST */}
            {showSuccess && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
                        <div className="bg-green-500 rounded-full p-1">
                            <Check size={14} className="text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-bold">Profile updated successfully</span>
                    </div>
                </div>
            )}

            {showWaiverModal && (
                <WaiverModal
                    gymId={currentGym.id} gymName={currentGym.name} theme={theme}
                    onAccept={handleWaiverSign} onDecline={() => setShowWaiverModal(false)}
                    onClose={() => setShowWaiverModal(false)}
                    viewOnly={hasWaiver && !isOutdated}
                    targetVersion={hasWaiver && !isOutdated ? userSignedVersion : currentWaiverVersion}
                    lastSignedVersion={userSignedVersion} isUpdate={isOutdated}
                />
            )}

            {/* HEADER */}
            <div className="bg-white p-6 pb-8 rounded-b-[2rem] shadow-sm border-b border-gray-100">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-3xl font-bold text-gray-900 truncate">
                            {formData.displayName || "Member"}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{user?.email}</p>
                        <div className={`mt-3 inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusBadge.color}`}>
                            {statusBadge.label}
                        </div>
                    </div>

                    <div className="flex gap-2 shrink-0 ml-4">
                        {!isEditing ? (
                            <button 
                                onClick={() => setIsEditing(true)} 
                                className="p-2 bg-gray-50 rounded-full text-gray-500 hover:text-gray-900 transition-all"
                            >
                                <Edit2 size={18} />
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleCancel} 
                                    className="p-2 bg-gray-50 rounded-full text-gray-500"
                                >
                                    <X size={18} />
                                </button>
                                <button 
                                    onClick={handleUpdateProfile} 
                                    disabled={loading} 
                                    className="p-2 rounded-full text-white shadow-md flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50" 
                                    style={{ backgroundColor: theme.primaryColor }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <ProfileField 
                        icon={User} 
                        label="Full Name" 
                        value={formData.displayName} 
                        isEditing={isEditing} 
                        editable 
                        onChange={e => setFormData({...formData, displayName: e.target.value})} 
                        placeholder="Your full name"
                    />
                    <ProfileField 
                        icon={Phone} 
                        label="Phone Number" 
                        value={formData.phoneNumber} 
                        isEditing={isEditing} 
                        editable 
                        onChange={e => setFormData({...formData, phoneNumber: formatPhoneNumber(e.target.value)})} 
                        placeholder="(555) 000-0000"
                    />
                    <ProfileField 
                        icon={Mail} 
                        label="Email Address" 
                        value={user?.email} 
                        editable={false} 
                    />
                </div>

                <MembershipSection 
                    planName={myMembership?.planName}
                    status={myMembership?.status}
                    onManageBilling={() => alert("Redirecting to Stripe...")}
                />

                <LegalSection 
                    hasWaiver={hasWaiver}
                    isOutdated={isOutdated}
                    version={userSignedVersion}
                    onOpenWaiver={() => setShowWaiverModal(true)}
                />

                <button 
                    onClick={() => auth.signOut()} 
                    className="w-full py-4 rounded-2xl bg-white text-red-600 font-bold text-sm border border-red-100 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                    <LogOut size={18} /> Sign Out
                </button>
            </div>
        </div>
    );
};

export default MemberProfileScreen;