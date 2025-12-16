import React, { useState, useEffect } from 'react';
import {
  X, User, Mail, Phone, Camera, CreditCard, Tag, AlertCircle, 
  Link as LinkIcon, DollarSign, Award, Users, History, Calendar
} from 'lucide-react';
import {
  addManualMember,
  updateMemberProfile,
  getMembershipTiers,
  getGymDetails,
  getMemberAttendance
} from '../../../shared/api/firestore';
import { uploadStaffPhoto } from '../../../shared/api/storage';
import { MemberFamilyTab } from './MemberFamilyTab';

export const MemberFormModal = ({ isOpen, onClose, gymId, memberData, onSave, allMembers = [], onSelectMember }) => {
  const [activeTab, setActiveTab] = useState('profile');

  const [history, setHistory] = useState([]);

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    firstName: '', 
    lastName: '', 
    email: '', 
    phone: '', 
    photoUrl: null, 
    // Rank Data
    programId: '', 
    rankId: '',
    stripes: 0,
    // Membership Data
    membershipId: '',
  });
  
  const [customPrice, setCustomPrice] = useState(''); 
  const [tiers, setTiers] = useState([]);
  const [rankSystems, setRankSystems] = useState([]); 
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [skipTrial, setSkipTrial] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (isOpen && gymId) {
      const initData = async () => {
        const tierRes = await getMembershipTiers(gymId);
        if (tierRes.success) setTiers(tierRes.tiers);

        const gymRes = await getGymDetails(gymId);
        if (gymRes.success && gymRes.gym.grading?.programs) {
            setRankSystems(gymRes.gym.grading.programs);
        }
      };
      initData();
    }
  }, [isOpen, gymId]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('profile');
      setPhotoFile(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (memberData) {
        setFormData({
          firstName: memberData.firstName || '',
          lastName: memberData.lastName || '',
          email: memberData.email || '',
          phone: memberData.phone || '',
          photoUrl: memberData.photoUrl || null,
          membershipId: memberData.membershipId || '',
          programId: memberData.programId || '',
          rankId: memberData.rankId || '',
          stripes: memberData.stripes || 0,
        });
        setCustomPrice(memberData.assignedPrice || ''); 
        setSkipTrial(false);
      } else {
        setFormData({ 
            firstName: '', lastName: '', email: '', phone: '', photoUrl: null, 
            membershipId: '', programId: '', rankId: '', stripes: 0
        });
        setCustomPrice('');
        setSkipTrial(false);
      }
    }
  }, [isOpen, memberData]);

  useEffect(() => {
    if (activeTab === 'history' && memberData?.id) {
        const fetchHistory = async () => {
            const res = await getMemberAttendance(gymId, memberData.id);
            if (res.success) setHistory(res.history);
        };
        fetchHistory();
    }
  }, [activeTab, memberData, gymId]);

  const selectedPlan = tiers.find(t => t.id === formData.membershipId);
  const selectedProgram = rankSystems.find(p => p.id === formData.programId);
  const selectedRank = selectedProgram?.ranks.find(r => r.id === formData.rankId);
  
  // --- HANDLERS ---

  const handlePlanChange = (e) => {
    const newPlanId = e.target.value;
    setFormData({ ...formData, membershipId: newPlanId }); 
    const plan = tiers.find(t => t.id === newPlanId);
    if (plan) setCustomPrice(plan.price);
    else setCustomPrice('');
  };

  const handleProgramChange = (e) => {
    setFormData({ ...formData, programId: e.target.value, rankId: '', stripes: 0 });
  };

  const handleRankChange = (e) => {
    setFormData({ ...formData, rankId: e.target.value, stripes: 0 }); 
  };

  const isSamePlan = memberData && memberData.membershipId === formData.membershipId;
  const showTrialOption = selectedPlan?.hasTrial && !isSamePlan;

  const handleFileChange = (e) => {
    if (e.target.files[0]) setPhotoFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Manual Validation because fields might be hidden in other tabs
    if (!formData.firstName || !formData.lastName || !formData.email) {
        setActiveTab('profile'); // Switch to profile so they can see the error
        alert("Please fill out First Name, Last Name, and Email.");
        return;
    }

    setLoading(true);
    
    let finalPhotoUrl = formData.photoUrl;
    if (photoFile) {
      const uploadRes = await uploadStaffPhoto(gymId, photoFile);
      if (uploadRes.success) finalPhotoUrl = uploadRes.url;
    }

    let subscriptionStatus = null;
    let trialEndDate = null;
    
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

    // --- AUTO-BASELINE LOGIC ---
    let autoCredits = memberData?.rankCredits || 0; 
    const rankChanged = !memberData || memberData.rankId !== formData.rankId;
    const stripesChanged = !memberData || memberData.stripes !== formData.stripes;

    if ((rankChanged || stripesChanged) && selectedRank && selectedProgram) {
       let baseReq = parseInt(selectedRank.classesRequired) || 0;
       let stripeBonus = 0;
       const stripes = parseInt(formData.stripes) || 0;

       if (stripes > 0) {
           const rankIndex = selectedProgram.ranks.findIndex(r => r.id === selectedRank.id);
           const nextRank = selectedProgram.ranks[rankIndex + 1];

           if (nextRank) {
               const nextReq = parseInt(nextRank.classesRequired) || 0;
               const gap = Math.max(0, nextReq - baseReq);
               const perStripe = gap / ((parseInt(selectedRank.maxStripes) || 4) + 1);
               stripeBonus = Math.round(perStripe * stripes);
           }
       }
       autoCredits = baseReq + stripeBonus;
    }

    const payload = {
      ...formData,
      photoUrl: finalPhotoUrl,
      searchName: `${formData.firstName} ${formData.lastName}`.toLowerCase(),
      status: subscriptionStatus || 'prospect',
      
      membershipId: formData.membershipId, 
      membershipName: selectedPlan ? selectedPlan.name : null,
      assignedPrice: Number(customPrice),

      subscriptionStatus: subscriptionStatus,
      trialEndDate: trialEndDate,

      stripes: parseInt(formData.stripes) || 0,
      rankCredits: autoCredits
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
      {/* ADDED h-[700px] FOR CONSISTENCY */}
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-[700px] max-h-[90vh]">

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

          <div className="flex px-6 space-x-6 overflow-x-auto">
            <button onClick={() => setActiveTab('profile')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <User size={16} /> Profile
            </button>
            <button onClick={() => setActiveTab('billing')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'billing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <CreditCard size={16} /> Membership
            </button>
            
            {/* Only show Family & History for existing members */}
            {memberData && (
                <>
                    <button onClick={() => setActiveTab('family')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'family' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <Users size={16} /> Family
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <History size={16} /> History
                    </button>
                </>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-6 flex-1">
          <form id="memberForm" onSubmit={handleSubmit} className="space-y-6">

            {/* === TAB 1: PROFILE (Demographics + Rank) === */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                {/* Photo Upload */}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">First Name</label>
                    <input required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Last Name</label>
                    <input required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Phone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                </div>

                {/* Rank Section moved to Profile */}
                {rankSystems.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                            <Award className="h-4 w-4" /> Rank & Progression
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-indigo-700 mb-1">Program</label>
                                <select 
                                    value={formData.programId}
                                    onChange={handleProgramChange}
                                    className="w-full p-2 border border-indigo-200 rounded-lg bg-white text-sm"
                                >
                                    <option value="">-- No Rank --</option>
                                    {rankSystems.map(prog => <option key={prog.id} value={prog.id}>{prog.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-indigo-700 mb-1">Rank / Belt</label>
                                <select 
                                    value={formData.rankId}
                                    onChange={handleRankChange}
                                    disabled={!formData.programId}
                                    className="w-full p-2 border border-indigo-200 rounded-lg bg-white text-sm disabled:opacity-50"
                                >
                                    <option value="">-- Select --</option>
                                    {selectedProgram?.ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Stripe Slider */}
                        {selectedRank && selectedRank.maxStripes > 0 && (
                            <div className="pt-2 border-t border-indigo-100 space-y-3">
                                <div className="flex items-center gap-4">
                                    <label className="text-xs font-semibold text-indigo-700">Stripes:</label>
                                    <div className="flex gap-2">
                                        {[...Array(parseInt(selectedRank.maxStripes) + 1)].map((_, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setFormData({...formData, stripes: i})}
                                                className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                                                    formData.stripes === i ? 'bg-indigo-600 text-white' : 'bg-white border border-indigo-200 text-indigo-400'
                                                }`}
                                            >
                                                {i}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
              </div>
            )}

            {/* === TAB 2: MEMBERSHIP (Billing) === */}
            {activeTab === 'billing' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                
                {/* Dependent Warning */}
                {memberData?.payerId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-full">
                                <LinkIcon className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-blue-900">Dependent Profile</p>
                                <p className="text-xs text-blue-700">
                                    Billing is managed by the Head of Household.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Membership Plan</label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select 
                            value={formData.membershipId} 
                            onChange={handlePlanChange} 
                            className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- No Membership --</option>
                            {tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                    </div>
                </div>

                {formData.membershipId && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                             <h4 className="text-sm font-bold text-gray-700">Payment Details</h4>
                             {selectedPlan && (
                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                                    Standard: ${selectedPlan.price}/{selectedPlan.interval}
                                </span>
                             )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Custom Rate ($)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                                    <input 
                                        type="number" 
                                        value={customPrice} 
                                        onChange={e => setCustomPrice(e.target.value)} 
                                        className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Discount Code</label>
                                 <div className="relative opacity-60">
                                    <Tag className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input 
                                        disabled
                                        placeholder="SUMMER20"
                                        className="w-full pl-9 p-2.5 border border-gray-200 bg-gray-100 rounded-lg cursor-not-allowed"
                                    />
                                 </div>
                            </div>
                        </div>

                        {/* Trial Logic */}
                        {showTrialOption && (
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
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
                    </div>
                )}

                {!formData.membershipId && (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800 text-xs flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>Without a membership, this user will be labeled as a <b>Prospect</b>. They won't be able to book classes unless Drop-ins are enabled.</p>
                    </div>
                )}
              </div>
            )}

          </form>

          {/* === TAB 3: FAMILY === */}
          {activeTab === 'family' && (
            <MemberFamilyTab 
                memberData={memberData}
                gymId={gymId}
                allMembers={allMembers}
                onSave={onSave}
                onSelectMember={onSelectMember}
            />
          )}

          {/* === TAB 4: HISTORY === */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800">Class History</h4>
                    <span className="text-xs text-gray-500">Last 20 Visits</span>
                </div>
                
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Class</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-4 py-8 text-center text-gray-400">
                                        <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                        <p>No attendance records found.</p>
                                    </td>
                                </tr>
                            ) : (
                                history.map(record => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-600">
                                            {record.createdAt?.toDate().toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {record.className}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                record.status === 'attended' ? 'bg-green-100 text-green-700' :
                                                record.status === 'no-show' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {record.status.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
            {/* Show Save on Profile and Billing tabs only */}
            {(activeTab === 'profile' || activeTab === 'billing') && (
                <button type="submit" form="memberForm" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                    {loading ? 'Saving...' : (memberData ? 'Save Profile' : 'Add Member')}
                </button>
            )}
        </div>

      </div>
    </div>
  );
};