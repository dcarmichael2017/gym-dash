import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Plus, 
  CreditCard, 
  Trash2, 
  Edit2, 
  CheckCircle2,
  Clock,
  Users, 
  UserCheck, 
  Hourglass,
  Coins
} from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { 
  getMembershipTiers, 
  deleteMembershipTier,
  getGymMembers
} from '../../../../shared/api/firestore';

import { FullScreenLoader } from '../../components/layout/FullScreenLoader';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { MembershipFormModal } from '../../components/MembershipFormModal';
import { TierMembersModal } from '../../components/TierMembersModal'; // IMPORT NEW MODAL

const DashboardMembershipsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [tiers, setTiers] = useState([]);
  
  // Stats & Data
  const [memberStats, setMemberStats] = useState({});
  const [allMembers, setAllMembers] = useState([]); // Store raw list for the modal

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, tierId: null });
  
  // View Members Modal State
  const [viewMembersModal, setViewMembersModal] = useState({ 
      isOpen: false, 
      tierName: '', 
      members: [] 
  });

  // --- Data Fetching ---
  const refreshData = async (gId) => {
    const [tiersRes, membersRes] = await Promise.all([
        getMembershipTiers(gId),
        getGymMembers(gId)
    ]);

    if (tiersRes.success) setTiers(tiersRes.tiers);

    if (membersRes.success) {
        setAllMembers(membersRes.members); // Save the raw list

        const stats = {};
        // Init stats
        if (tiersRes.success) {
            tiersRes.tiers.forEach(t => {
                stats[t.id] = { active: 0, trialing: 0 };
            });
        }
        // Calculate counts
        membersRes.members.forEach(member => {
            if (member.membershipId && stats[member.membershipId]) {
                if (member.subscriptionStatus === 'trialing') {
                    stats[member.membershipId].trialing++;
                } else if (member.subscriptionStatus === 'active') {
                    stats[member.membershipId].active++;
                }
            }
        });
        setMemberStats(stats);
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().gymId) {
          const gId = userSnap.data().gymId;
          setGymId(gId);
          await refreshData(gId);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    initData();
  }, []);

  // --- Handlers ---
  const openAddModal = () => {
    setSelectedTier(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tier) => {
    setSelectedTier(tier);
    setIsModalOpen(true);
  };

  const openViewMembers = (tier) => {
      // Filter the full list based on the clicked tier
      const tierMembers = allMembers.filter(m => m.membershipId === tier.id);
      setViewMembersModal({
          isOpen: true,
          tierName: tier.name,
          members: tierMembers
      });
  };

  const handleDelete = async () => {
    if (!deleteModal.tierId) return;
    const result = await deleteMembershipTier(gymId, deleteModal.tierId);
    if (result.success) {
      setTiers(prev => prev.filter(t => t.id !== deleteModal.tierId));
      setDeleteModal({ isOpen: false, tierId: null });
    }
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Memberships</h2>
          <p className="text-gray-500">Create plans and track active subscriptions.</p>
        </div>
        <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="h-5 w-5 mr-2" /> Create Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tiers.map(tier => {
          const stats = memberStats[tier.id] || { active: 0, trialing: 0 };
          
          return (
            <div key={tier.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative group">
              
              {/* Card Header */}
              <div className="p-6 border-b border-gray-100 bg-gray-50 relative">
                 <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-xl text-gray-800">{tier.name}</h3>
                 </div>
                 <div className="flex items-baseline text-gray-900">
                   <span className="text-3xl font-extrabold tracking-tight">${tier.price}</span>
                   <span className="ml-1 text-sm font-medium text-gray-500">
                     /{tier.interval === 'one_time' ? 'once' : tier.interval}
                   </span>
                 </div>

                 {/* Display Initiation Fee if exists */}
                 {tier.initiationFee > 0 && (
                     <div className="flex items-center mt-2 text-xs font-medium text-gray-500">
                        <Coins className="h-3 w-3 mr-1 text-gray-400" />
                        + ${tier.initiationFee} Signup Fee
                     </div>
                 )}
                 
                 {/* Trial Badge */}
                 {tier.hasTrial && (
                   <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center uppercase tracking-wide">
                      <Clock className="h-3 w-3 mr-1" />
                      {tier.trialDays} Day Trial
                   </div>
                 )}
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-green-50 border border-green-100 p-2 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-green-700">{stats.active}</span>
                        <div className="flex items-center text-xs text-green-600 uppercase font-bold tracking-wide mt-1">
                            <UserCheck className="h-3 w-3 mr-1" /> Active
                        </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-2 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-orange-700">{stats.trialing}</span>
                        <div className="flex items-center text-xs text-orange-600 uppercase font-bold tracking-wide mt-1">
                            <Hourglass className="h-3 w-3 mr-1" /> Trialing
                        </div>
                    </div>
                </div>

                <p className="text-gray-600 text-sm mb-6 flex-1 line-clamp-2">
                  {tier.description || "No description provided."}
                </p>

                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                  <button 
                    onClick={() => openEditModal(tier)}
                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
                  >
                    <Edit2 className="h-4 w-4 mr-2" /> Edit
                  </button>
                  
                  <button 
                    onClick={() => openViewMembers(tier)} 
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent"
                    title="View Member List"
                  >
                    <Users className="h-5 w-5" />
                  </button>

                  <button 
                    onClick={() => setDeleteModal({ isOpen: true, tierId: tier.id })}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent"
                    title="Delete Plan"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {tiers.length === 0 && (
          <div className="col-span-full py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No membership plans found.</p>
            <button onClick={openAddModal} className="text-blue-600 text-sm hover:underline mt-1">Create your first plan</button>
          </div>
        )}
      </div>

      <MembershipFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gymId={gymId}
        tierData={selectedTier}
        onSave={() => refreshData(gymId)}
      />

      <TierMembersModal 
        isOpen={viewMembersModal.isOpen}
        onClose={() => setViewMembersModal({...viewMembersModal, isOpen: false})}
        tierName={viewMembersModal.tierName}
        members={viewMembersModal.members}
      />

      <ConfirmationModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, tierId: null })}
        onConfirm={handleDelete}
        title="Delete Plan"
        message="Are you sure you want to delete this membership plan?"
        confirmText="Delete Plan"
        isDestructive={true}
      />
    </div>
  );
};

export default DashboardMembershipsScreen;