// packages/web/src/components/MemberFormModal.jsx

import React, { useState, useEffect } from 'react';
import {
    X, User, Mail, Phone, Camera, CreditCard, Tag, AlertCircle, Link as LinkIcon
} from 'lucide-react';
import {
    addManualMember,
    updateMemberProfile,
    getMembershipTiers,
} from '../../../shared/api/firestore';
import { uploadStaffPhoto } from '../../../shared/api/storage';
import { MemberFamilyTab } from './MemberFamilyTab';

export const MemberFormModal = ({ isOpen, onClose, gymId, memberData, onSave, allMembers = [], onSelectMember }) => {
    const [activeTab, setActiveTab] = useState('profile');

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', phone: '', photoUrl: null, membershipId: ''
    });
    const [tiers, setTiers] = useState([]);
    const [photoFile, setPhotoFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [skipTrial, setSkipTrial] = useState(false);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (isOpen && gymId) {
            const fetchTiers = async () => {
                const res = await getMembershipTiers(gymId);
                if (res.success) setTiers(res.tiers);
            };
            fetchTiers();
        }
    }, [isOpen, gymId]);

    // Reset Tab only on Open
    useEffect(() => {
        if (isOpen) {
            setActiveTab('profile');
            setPhotoFile(null);
        }
    }, [isOpen]);

    // Sync Form Data on Change
    useEffect(() => {
        if (isOpen) {
            if (memberData) {
                setFormData({
                    firstName: memberData.firstName || '',
                    lastName: memberData.lastName || '',
                    email: memberData.email || '',
                    phone: memberData.phone || '',
                    photoUrl: memberData.photoUrl || null,
                    membershipId: memberData.membershipId || ''
                });
                setSkipTrial(false);
            } else {
                setFormData({ firstName: '', lastName: '', email: '', phone: '', photoUrl: null, membershipId: '' });
                setSkipTrial(false);
            }
        }
    }, [isOpen, memberData]);

    const selectedPlan = tiers.find(t => t.id === formData.membershipId);
    const isSamePlan = memberData && memberData.membershipId === formData.membershipId;
    const showTrialOption = selectedPlan?.hasTrial && !isSamePlan;

    const handleFileChange = (e) => {
        if (e.target.files[0]) setPhotoFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.firstName || !formData.lastName || !formData.email) return;
        setLoading(true);
        
        let finalPhotoUrl = formData.photoUrl;
        if (photoFile) {
            const uploadRes = await uploadStaffPhoto(gymId, photoFile);
            if (uploadRes.success) finalPhotoUrl = uploadRes.url;
        }

        // Status Logic
        let subscriptionStatus = null;
        let trialEndDate = null;
        if (isSamePlan) {
            subscriptionStatus = memberData.subscriptionStatus;
            trialEndDate = memberData.trialEndDate || null;
        } else if (formData.membershipId && selectedPlan) {
            if (selectedPlan.hasTrial && !skipTrial) {
                subscriptionStatus = 'trialing';
                const date = new Date();
                date.setDate(date.getDate() + (selectedPlan.trialDays || 7));
                trialEndDate = date;
            } else {
                subscriptionStatus = 'active';
            }
        }

        const payload = {
            ...formData,
            photoUrl: finalPhotoUrl,
            searchName: `${formData.firstName} ${formData.lastName}`.toLowerCase(),
            status: subscriptionStatus || 'prospect',
            membershipName: selectedPlan ? selectedPlan.name : null,
            subscriptionStatus: subscriptionStatus,
            trialEndDate: trialEndDate
        };

        let result;
        if (memberData) {
            result = await updateMemberProfile(memberData.id, payload);
        } else {
            result = await addManualMember(gymId, payload);
        }
        setLoading(false);
        if (result.success) { onSave(); onClose(); }
        else { alert("Error: " + result.error); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="border-b border-gray-100 bg-gray-50 shrink-0">
                    <div className="px-6 py-4 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-800">
                            {memberData ? 'Edit Member' : 'Add New Member'}
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {memberData && (
                        <div className="flex px-6 space-x-6">
                            <button onClick={() => setActiveTab('profile')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Profile</button>
                            <button onClick={() => setActiveTab('family')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'family' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Family</button>
                        </div>
                    )}
                </div>

                {/* Body Content */}
                <div className="overflow-y-auto p-6">

                    {/* === PROFILE TAB === */}
                    {activeTab === 'profile' && (
                        <form id="memberForm" onSubmit={handleSubmit} className="space-y-6">
                            
                            {memberData?.payerId && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2 rounded-full">
                                            <LinkIcon className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-blue-900">Dependent Profile</p>
                                            <p className="text-xs text-blue-700">
                                                Billing and memberships are managed by the Head of Household.
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setActiveTab('family')} 
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 underline shrink-0 ml-2"
                                    >
                                        View Family
                                    </button>
                                </div>
                            )}

                            {/* Photo Upload UI */}
                            <div className="flex flex-col items-center">
                                <div className="relative group cursor-pointer">
                                    <div className="h-24 w-24 rounded-full bg-gray-100 overflow-hidden border-2 border-gray-200 flex items-center justify-center">
                                        {photoFile ? (
                                            <img src={URL.createObjectURL(photoFile)} className="h-full w-full object-cover" />
                                        ) : formData.photoUrl ? (
                                            <img src={formData.photoUrl} className="h-full w-full object-cover" />
                                        ) : (
                                            <User className="h-10 w-10 text-gray-400" />
                                        )}
                                    </div>
                                    <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                                        <Camera className="h-6 w-6" />
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Click to upload photo</p>
                            </div>

                            {/* Basic Inputs */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">First Name</label>
                                    <input required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Last Name</label>
                                    <input required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Phone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Assign Membership</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <select value={formData.membershipId} onChange={e => setFormData({ ...formData, membershipId: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white">
                                            <option value="">-- No Membership --</option>
                                            {tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name} (${tier.price})</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Trial Logic */}
                            {showTrialOption && (
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-1">
                                    <div className="flex items-start gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="skipTrial"
                                            checked={skipTrial} 
                                            onChange={e => setSkipTrial(e.target.checked)} 
                                            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" 
                                        />
                                        <div>
                                            <label htmlFor="skipTrial" className="block text-sm font-bold text-blue-800 cursor-pointer">
                                                Skip {selectedPlan.trialDays}-Day Free Trial?
                                            </label>
                                            <p className="text-xs text-blue-600 mt-0.5">
                                                {skipTrial 
                                                    ? "Member will be marked ACTIVE immediately. Billing starts today." 
                                                    : "Member will be marked TRIALING. Billing starts automatically when trial ends."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Discount Code */}
                            {formData.membershipId && (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase">Discount Code</label>
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
                                    </div>
                                    <div className="relative opacity-60">
                                        <Tag className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <input 
                                            disabled
                                            placeholder="SUMMER2025"
                                            className="w-full pl-9 p-2.5 border border-gray-200 bg-gray-50 rounded-lg outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Prospect Alert */}
                            {!formData.membershipId && (
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800 text-xs flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p>Without a membership, this user will be labeled as a <b>Prospect</b>. They won't be able to book classes unless Drop-ins are enabled.</p>
                                </div>
                            )}

                        </form>
                    )}

                    {/* === FAMILY TAB (Refactored) === */}
                    {activeTab === 'family' && (
                        <MemberFamilyTab 
                            memberData={memberData}
                            gymId={gymId}
                            allMembers={allMembers}
                            onSave={onSave}
                            onSelectMember={onSelectMember}
                        />
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                    {activeTab === 'profile' && (
                        <button type="submit" form="memberForm" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                            {loading ? 'Saving...' : (memberData ? 'Save Profile' : 'Add Member')}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};