import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Plus, Repeat, Ticket, Tag } from 'lucide-react';

import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { getMembershipTiers, deleteMembershipTier, getGymMembers } from '../../../../../../packages/shared/api/firestore';

// Shared Components
import { FullScreenLoader } from '../../../components/common/FullScreenLoader';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { Modal } from '../../../components/common/Modal'; // <--- NEW GENERIC MODAL
import { TierMembersModal } from '../../../components/admin/TierMembersModal';
import { MemberFormModal } from '../../../components/admin/MemberFormModal';

// Specific Forms & Tabs
import RecurringForm from '../../../components/admin/memberships/RecurringForm';
import ClassPackForm from '../../../components/admin/memberships/ClassPackForm';
import RecurringPlansTab from './RecurringPlansTab';
import ClassPacksTab from './ClassPacksTab';
import CouponsTab from './CouponsTab';

const MembershipsScreen = () => {
  const { theme } = useOutletContext() || {};
  const primaryColor = theme?.primaryColor || '#2563eb';

  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState('recurring'); // 'recurring' | 'pack' | 'coupons'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, tierId: null });
  const [viewMembersModal, setViewMembersModal] = useState({ isOpen: false, tierName: '', members: [] });
  const [memberModal, setMemberModal] = useState({ isOpen: false, memberData: null });

  // Data State
  const [memberStats, setMemberStats] = useState({});
  const [allMembers, setAllMembers] = useState([]); 

  const refreshData = async (gId) => {
    // ... (Your existing data fetch logic remains the same) ...
    const [tiersRes, membersRes] = await Promise.all([
        getMembershipTiers(gId),
        getGymMembers(gId)
    ]);

    if (tiersRes.success) setTiers(tiersRes.tiers);

    if (membersRes.success) {
        setAllMembers(membersRes.members);
        const stats = {};
        if (tiersRes.success) {
            tiersRes.tiers.forEach(t => stats[t.id] = { active: 0, trialing: 0 });
        }
        // ✅ FIX: Access membership data from currentMembership subcollection
        membersRes.members.forEach(member => {
            const membership = member.currentMembership;
            if (membership?.membershipId && stats[membership.membershipId]) {
                if (membership.status === 'trialing') stats[membership.membershipId].trialing++;
                else if (membership.status === 'active') stats[membership.membershipId].active++;
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

          // Check if gym has Stripe enabled
          const gymRef = doc(db, 'gyms', gId);
          const gymSnap = await getDoc(gymRef);
          if (gymSnap.exists()) {
            const gymData = gymSnap.data();
            setStripeEnabled(gymData.stripeAccountStatus === 'ACTIVE');
          }

          await refreshData(gId);
        }
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    initData();
  }, []);

  // --- Handlers ---
  const handleOpenAdd = () => {
      setSelectedTier(null); // Clear selection for "Create" mode
      setIsModalOpen(true);
  };

  const handleOpenEdit = (tier) => {
      setSelectedTier(tier); // Set selection for "Edit" mode
      setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteModal.tierId) return;
    const result = await deleteMembershipTier(gymId, deleteModal.tierId);
    if (result.success) {
      setTiers(prev => prev.filter(t => t.id !== deleteModal.tierId));
      setDeleteModal({ isOpen: false, tierId: null });
    }
  };

  const handleMemberClick = (member) => {
    setMemberModal({ isOpen: true, memberData: member });
  };

  // Filter Tiers for View
  const recurringTiers = tiers.filter(t => t.interval !== 'one_time');
  const packTiers = tiers.filter(t => t.interval === 'one_time');

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Memberships</h2>
          <p className="text-gray-500">Manage recurring plans and class packs.</p>
        </div>
        
        {activeTab !== 'coupons' && (
          <button
            onClick={handleOpenAdd}
            className="text-white px-4 py-2 rounded-lg flex items-center hover:opacity-90 transition-colors shadow-sm font-bold text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="h-5 w-5 mr-2" />
            {activeTab === 'recurring' ? 'Create Plan' : 'Create Pack'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('recurring')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'recurring' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            style={activeTab === 'recurring' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
             <Repeat size={16} /> Recurring Plans
          </button>
          <button
            onClick={() => setActiveTab('pack')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'pack' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            style={activeTab === 'pack' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
             <Ticket size={16} /> Class Packs
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'coupons' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            style={activeTab === 'coupons' ? { borderColor: primaryColor, color: primaryColor } : {}}
          >
             <Tag size={16} /> Coupons
          </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'recurring' && (
          <RecurringPlansTab
            tiers={recurringTiers}
            memberStats={memberStats}
            onEdit={handleOpenEdit}
            onViewMembers={(tier) => setViewMembersModal({ isOpen: true, tierName: tier.name, members: allMembers.filter(m => m.currentMembership?.membershipId === tier.id) })}
            onDelete={(id) => setDeleteModal({ isOpen: true, tierId: id })}
            onAdd={handleOpenAdd}
          />
      )}
      {activeTab === 'pack' && (
          <ClassPacksTab
            tiers={packTiers}
            onEdit={handleOpenEdit}
            onDelete={(id) => setDeleteModal({ isOpen: true, tierId: id })}
            onAdd={handleOpenAdd}
          />
      )}
      {activeTab === 'coupons' && (
          <CouponsTab
            gymId={gymId}
            theme={theme}
            stripeEnabled={stripeEnabled}
          />
      )}

      {/* --- SMART MODAL SHELL --- */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={
            selectedTier 
                ? (activeTab === 'recurring' ? 'Edit Recurring Plan' : 'Edit Class Pack')
                : (activeTab === 'recurring' ? 'New Recurring Plan' : 'New Class Pack')
        }
      >
          {/* CONDITIONALLY RENDER FORM BASED ON ACTIVE TAB */}
          {activeTab === 'recurring' ? (
              <RecurringForm
                  gymId={gymId}
                  tierData={selectedTier}
                  onSave={() => refreshData(gymId)}
                  onClose={() => setIsModalOpen(false)}
                  theme={theme}
                  stripeEnabled={stripeEnabled}
              />
          ) : (
              <ClassPackForm
                  gymId={gymId}
                  tierData={selectedTier}
                  onSave={() => refreshData(gymId)}
                  onClose={() => setIsModalOpen(false)}
                  theme={theme}
                  stripeEnabled={stripeEnabled}
              />
          )}
      </Modal>

      {/* Other Modals */}
      <TierMembersModal
        isOpen={viewMembersModal.isOpen}
        onClose={() => setViewMembersModal({...viewMembersModal, isOpen: false})}
        tierName={viewMembersModal.tierName}
        members={viewMembersModal.members}
        onMemberClick={handleMemberClick}
      />

      <MemberFormModal
        isOpen={memberModal.isOpen}
        onClose={() => setMemberModal({ isOpen: false, memberData: null })}
        gymId={gymId}
        memberData={memberModal.memberData}
        onSave={() => refreshData(gymId)}
        allMembers={allMembers}
        onSelectMember={handleMemberClick}
      />

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, tierId: null })}
        onConfirm={handleDelete}
        title="Delete Item"
        message="Are you sure you want to delete this?"
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};

export default MembershipsScreen;