import React, { useState, useEffect } from 'react';
import {
  X, User, CreditCard, Users, History, TrendingUp, ChevronRight
} from 'lucide-react';

// --- Tab Imports ---
import { MemberProfileTab } from './MemberProfileTab';
import { MemberBillingTab } from './MemberBillingTab';
import { MemberHistoryTab } from './MemberHistoryTab';
import { MemberFamilyTab } from './MemberFamilyTab';
import { MemberRankTab } from './MemberRankTab';

// --- API Imports ---
import {
  addManualMember,
  updateMemberProfile,
  updateMemberMembership,
  getMembershipTiers,
  getGymDetails,
  logMembershipHistory
} from '../../../../../shared/api/firestore';
import { auth } from '../../../../../shared/api/firebaseConfig';
import { uploadStaffPhoto } from '../../../../../shared/api/storage';

// --- SIDEBAR BUTTON COMPONENT ---
const NavItem = ({ id, label, icon: Icon, active, onClick, primaryColor }) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 border-l-4
      ${active ? 'bg-white shadow-sm' : 'text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-900'}`}
    style={active ? { color: primaryColor, borderColor: primaryColor } : {}}
  >
    <div className="flex items-center gap-3">
      <Icon size={18} style={{ color: active ? primaryColor : '#9ca3af' }} />
      <span>{label}</span>
    </div>
    {active && <ChevronRight size={14} style={{ color: primaryColor }} />}
  </button>
);

export const MemberFormModal = ({ isOpen, onClose, gymId, memberData, onSave, allMembers = [], onSelectMember, theme }) => {
  const primaryColor = theme?.primaryColor || '#2563eb';
  const [activeTab, setActiveTab] = useState('profile');

  // --- MASTER FORM STATE ---
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    // 1. Initialize empty state for new fields
    emergencyName: '',
    emergencyPhone: '',
    membershipId: '',
    ranks: {}
  });

  // --- UI STATE ---
  const [customPrice, setCustomPrice] = useState('');
  const [trialOverrideDays, setTrialOverrideDays] = useState('0');
  const [photoFile, setPhotoFile] = useState(null);

  // --- DATA LOADING STATE ---
  const [loading, setLoading] = useState(false);
  const [rankSystems, setRankSystems] = useState([]);
  const [tiers, setTiers] = useState([]);

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    if (isOpen && gymId) {
      const initData = async () => {
        const tierRes = await getMembershipTiers(gymId);
        if (tierRes.success) setTiers(tierRes.tiers);

        const gymRes = await getGymDetails(gymId);
        if (gymRes.success && gymRes.gym.grading?.programs) {
          setRankSystems(gymRes.gym.grading.programs);
        } else {
          setRankSystems([]);
        }
      };
      initData();
    }
  }, [isOpen, gymId]);

  // --- 2. POPULATE FORM ---
  useEffect(() => {
    if (isOpen) {
      if (memberData) {
        let initialRanks = memberData.ranks || {};
        // Migration Logic
        if (!memberData.ranks && memberData.programId) {
          initialRanks[memberData.programId] = {
            rankId: memberData.rankId,
            stripes: memberData.stripes || 0,
            credits: memberData.rankCredits || memberData.attendanceCount || 0
          };
        }

        setFormData({
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          phoneNumber: memberData.phoneNumber || '',
          // 2. Load existing data if available
          emergencyName: memberData.emergencyName || '',
          emergencyPhone: memberData.emergencyPhone || '',
          membershipId: memberData.membershipId || '',
          ranks: initialRanks
        });
        setCustomPrice(memberData.assignedPrice || '');
        setTrialOverrideDays('0');
      } else {
        setFormData({
          firstName: '', lastName: '', email: '', phone: '', photoUrl: null,
          // 3. Reset to empty for new members
          emergencyName: '', emergencyPhone: '',
          membershipId: '', ranks: {}
        });
        setCustomPrice('');
        setTrialOverrideDays('0');
      }
      setPhotoFile(null);
      setActiveTab('profile');
    }
  }, [isOpen, memberData]);

  // --- 3. SUBMIT HANDLER ---
const handleSubmit = async (e) => {
  e.preventDefault();

  if (!formData.firstName || !formData.lastName || !formData.email) {
    setActiveTab('profile');
    alert("Please fill out First Name, Last Name, and Email.");
    return;
  }

  setLoading(true);

  let finalPhotoUrl = formData.photoUrl;
  if (photoFile) {
    const uploadRes = await uploadStaffPhoto(gymId, photoFile);
    if (uploadRes.success) finalPhotoUrl = uploadRes.url;
  }

  const selectedPlan = tiers.find(t => t.id === formData.membershipId);
  const finalPrice = customPrice !== '' ? Number(customPrice) : (selectedPlan ? Number(selectedPlan.price) : 0);
  let subscriptionStatus = null;
  let trialEndDate = null;
  let startDate = formData.startDate ? new Date(formData.startDate) : new Date();

  // --- STATUS LOGIC ---
  if (!formData.membershipId) {
    subscriptionStatus = 'prospect'; 
    trialEndDate = null;
  } else {
    const trialDays = Number(trialOverrideDays) || 0;
    if (selectedPlan?.hasTrial && trialDays > 0) {
      subscriptionStatus = 'trialing';
      const tDate = new Date(startDate);
      tDate.setDate(tDate.getDate() + trialDays);
      trialEndDate = tDate;
    } else {
      subscriptionStatus = 'active';
      trialEndDate = null;
    }
  }

  const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

  // Build change log
  const oldMembership = memberData?.currentMembership;
  const isNewMember = !memberData;
  const changes = [];

  if (isNewMember && formData.membershipId) {
    changes.push(`Assigned '${selectedPlan?.name}' plan.`);
  } else if (!isNewMember && formData.membershipId !== (oldMembership?.membershipId || null)) {
    const newPlanName = selectedPlan?.name || 'No Plan';
    if (!oldMembership?.membershipId) {
      changes.push(`Assigned '${newPlanName}' plan.`);
    } else {
      const oldPlan = tiers.find(t => t.id === oldMembership.membershipId);
      changes.push(`Plan changed from '${oldPlan?.name}' to '${newPlanName}'.`);
    }
  }

  if (!isNewMember && oldMembership && formData.membershipId === oldMembership.membershipId) {
    const oldPrice = oldMembership.assignedPrice ?? oldMembership.price;
    if (finalPrice !== oldPrice) {
      changes.push(`Price adjusted to $${finalPrice.toFixed(2)}.`);
    }
  }
  
  if (subscriptionStatus === 'trialing') {
    const trialDays = Number(trialOverrideDays);
    if (isNewMember || oldMembership?.status !== 'trialing') {
      changes.push(`${changes.length > 0 ? 'with' : 'Started'} a ${trialDays}-day trial.`);
    }
  }

  let logDescription = changes.join(' ');
  if (!isNewMember && logDescription.trim() === '') {
    logDescription = 'Membership details updated by admin.';
  }

  // ✅ FIXED: Separate user profile data from membership data
  const userProfilePayload = {
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    name: fullName,
    searchName: fullName.toLowerCase(),
    email: formData.email,
    phoneNumber: formData.phoneNumber,
    emergencyName: formData.emergencyName?.trim() || '',
    emergencyPhone: formData.emergencyPhone?.replace(/[^\d]/g, '') || '',
    photoUrl: finalPhotoUrl,
    ranks: formData.ranks
  };

  // ✅ FIXED: Membership data goes to SUBCOLLECTION
  const membershipPayload = {
    membershipId: formData.membershipId || null,
    membershipName: selectedPlan?.name || null,
    status: subscriptionStatus,
    price: finalPrice,
    interval: selectedPlan?.interval || 'month',
    startDate: startDate,
    trialEndDate: trialEndDate,
    cancelAtPeriodEnd: false,
    cancelledAt: null, // Clear cancelled date when reactivating
    cancellationReason: null, // Clear cancellation reason when reactivating
    updatedAt: new Date()
  };

  // Only set gymId/gymName on creation or if missing
  if (isNewMember || !oldMembership) {
    const gymRes = await getGymDetails(gymId);
    membershipPayload.gymId = gymId;
    membershipPayload.gymName = gymRes.success ? gymRes.gym.name : '';
    membershipPayload.joinedAt = new Date();
    membershipPayload.createdAt = new Date();
  }

  let result;
  try {
    if (memberData) {
      // ✅ UPDATE EXISTING MEMBER
      // 1. Update user profile
      await updateMemberProfile(memberData.id, userProfilePayload);
      
      // 2. Update membership subcollection
      await updateMemberMembership(memberData.id, gymId, membershipPayload);
      
      result = { success: true };
    } else {
      // ✅ CREATE NEW MEMBER
      result = await addManualMember(gymId, {
        ...userProfilePayload,
        ...membershipPayload
      });
    }

    // Log changes
    if (result.success && logDescription.trim()) {
      const adminId = auth.currentUser?.uid;
      const userId = memberData ? memberData.id : result.member.id;
      await logMembershipHistory(userId, gymId, logDescription, adminId);
    }

  } catch (error) {
    console.error("Error saving member:", error);
    result = { success: false, error: error.message };
  }

  setLoading(false);
  if (result.success) {
    onSave();
    if (!memberData) {
      onClose();
    }
  } else {
    alert("Error: " + result.error);
  }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">

      {/* Container: Widened to max-w-4xl for Sidebar Layout */}
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex h-[700px] max-h-[90vh]">

        {/* --- LEFT SIDEBAR --- */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-6 border-b border-gray-100 mb-2">
            <h3 className="font-bold text-lg text-gray-800 leading-tight">
              {memberData ? 'Edit Member' : 'Add Member'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Manage profile details</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 p-2">
            <NavItem id="profile" label="Profile & Contact" icon={User} active={activeTab === 'profile'} onClick={setActiveTab} primaryColor={primaryColor} />

            {rankSystems.length > 0 && (
              <NavItem id="ranks" label="Rank Progression" icon={TrendingUp} active={activeTab === 'ranks'} onClick={setActiveTab} primaryColor={primaryColor} />
            )}

            <NavItem id="billing" label="Membership & Billing" icon={CreditCard} active={activeTab === 'billing'} onClick={setActiveTab} primaryColor={primaryColor} />

            {/* Conditional Tabs */}
            {memberData && (
              <>
                <div className="my-2 border-t border-gray-200 mx-4"></div>
                <NavItem id="family" label="Family Linking" icon={Users} active={activeTab === 'family'} onClick={setActiveTab} primaryColor={primaryColor} />
                <NavItem id="history" label="Attendance History" icon={History} active={activeTab === 'history'} onClick={setActiveTab} primaryColor={primaryColor} />
              </>
            )}
          </div>
        </div>

        {/* --- RIGHT CONTENT AREA --- */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">

          {/* Content Header (Mobile Title / Close) */}
          <div className="h-16 border-b border-gray-100 flex justify-between items-center px-6 shrink-0">
            <h2 className="font-bold text-xl text-gray-800 capitalize">
              {activeTab === 'ranks' ? 'Rank Progression' : activeTab}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-8">
            <form id="memberForm" onSubmit={handleSubmit} className="h-full">
              {activeTab === 'profile' && (
                <MemberProfileTab
                  formData={formData} setFormData={setFormData}
                  handleFileChange={(e) => setPhotoFile(e.target.files[0])} photoFile={photoFile}
                />
              )}

              {activeTab === 'ranks' && (
                <MemberRankTab
                  formData={formData} setFormData={setFormData} rankSystems={rankSystems}
                />
              )}

              {activeTab === 'billing' && (
                <MemberBillingTab
                  formData={formData} setFormData={setFormData} customPrice={customPrice} setCustomPrice={setCustomPrice}
                  trialOverrideDays={trialOverrideDays} setTrialOverrideDays={setTrialOverrideDays} tiers={tiers} memberData={memberData}
                  gymId={gymId}
                />
              )}

              {activeTab === 'family' && memberData && (
                <MemberFamilyTab
                  memberData={memberData} gymId={gymId} allMembers={allMembers}
                  onSave={onSave} onSelectMember={onSelectMember}
                />
              )}

              {activeTab === 'history' && memberData && (
                <MemberHistoryTab gymId={gymId} memberId={memberData.id} />
              )}
            </form>
          </div>

          {/* Footer Actions */}
          <div className="h-20 border-t border-gray-100 px-8 flex items-center justify-end gap-3 shrink-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Close
            </button>

            {/* Show Save button only on editable tabs */}
            {(activeTab === 'profile' || activeTab === 'billing' || activeTab === 'ranks') && (
              <button
                type="submit"
                form="memberForm"
                disabled={loading}
                className="px-6 py-2.5 text-white rounded-lg hover:opacity-90 font-medium shadow-sm transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
