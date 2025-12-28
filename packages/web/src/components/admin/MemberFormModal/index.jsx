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
  getMembershipTiers,
  getGymDetails
} from '../../../../../shared/api/firestore';
import { uploadStaffPhoto } from '../../../../../shared/api/storage';

// --- SIDEBAR BUTTON COMPONENT ---
const NavItem = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 border-l-4
      ${active
        ? 'bg-white text-blue-600 border-blue-600 shadow-sm'
        : 'text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-900'
      }`}
  >
    <div className="flex items-center gap-3">
      <Icon size={18} className={active ? 'text-blue-600' : 'text-gray-400'} />
      <span>{label}</span>
    </div>
    {active && <ChevronRight size={14} className="text-blue-600" />}
  </button>
);

export const MemberFormModal = ({ isOpen, onClose, gymId, memberData, onSave, allMembers = [], onSelectMember }) => {
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
  const [skipTrial, setSkipTrial] = useState(false);
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
        setSkipTrial(false);
      } else {
        setFormData({
          firstName: '', lastName: '', email: '', phone: '', photoUrl: null,
          // 3. Reset to empty for new members
          emergencyName: '', emergencyPhone: '',
          membershipId: '', ranks: {}
        });
        setCustomPrice('');
        setSkipTrial(false);
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
    let subscriptionStatus = null;
    let trialEndDate = null;

    const isSamePlan = memberData && memberData.membershipId === formData.membershipId;

    if (memberData && isSamePlan) {
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

    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

    const payload = {
      ...formData,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      name: fullName, 
      searchName: fullName.toLowerCase(),
      // 4. Ensure these are explicitly included in payload (though ...formData covers it usually, explicit is safer if you destructured above)
      emergencyName: formData.emergencyName?.trim() || '',
      emergencyPhone: formData.emergencyPhone?.replace(/[^\d]/g, '') || '',
      
      status: subscriptionStatus || 'prospect',
      membershipId: formData.membershipId,
      membershipName: selectedPlan ? selectedPlan.name : null,
      assignedPrice: Number(customPrice),
      subscriptionStatus: subscriptionStatus,
      trialEndDate: trialEndDate,

      programId: null, rankId: null, stripes: null, rankCredits: null
    };

    const isBecomingActive = subscriptionStatus === 'active';
    const wasNotActive = !memberData || (memberData.status !== 'active');
    if (isBecomingActive && wasNotActive) {
      payload.convertedAt = new Date();
    }

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
            <NavItem id="profile" label="Profile & Contact" icon={User} active={activeTab === 'profile'} onClick={setActiveTab} />

            {rankSystems.length > 0 && (
              <NavItem id="ranks" label="Rank Progression" icon={TrendingUp} active={activeTab === 'ranks'} onClick={setActiveTab} />
            )}

            <NavItem id="billing" label="Membership & Billing" icon={CreditCard} active={activeTab === 'billing'} onClick={setActiveTab} />

            {/* Conditional Tabs */}
            {memberData && (
              <>
                <div className="my-2 border-t border-gray-200 mx-4"></div>
                <NavItem id="family" label="Family Linking" icon={Users} active={activeTab === 'family'} onClick={setActiveTab} />
                <NavItem id="history" label="Attendance History" icon={History} active={activeTab === 'history'} onClick={setActiveTab} />
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
                  skipTrial={skipTrial} setSkipTrial={setSkipTrial} tiers={tiers} memberData={memberData}
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
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-all"
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