import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Plus, Search, Filter, User, MoreVertical, 
  Link as LinkIcon, Users,
  CheckCircle2, XCircle, Clock, Trash2, Edit2, Archive
} from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getGymMembers, deleteMember, updateMemberProfile } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';
import { MemberFormModal } from '../../components/MemberFormModal'; // IMPORT MODAL
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

const DashboardMembersScreen = () => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [gymId, setGymId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  
  // Delete/Archive State
  const [actionModal, setActionModal] = useState({ 
      isOpen: false, 
      type: null, // 'delete' or 'archive'
      memberId: null,
      memberName: ''
  });

  const fetchMembers = async (gId) => {
    const result = await getGymMembers(gId);
    if (result.success) {
      setMembers(result.members);
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
          await fetchMembers(gId);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    initData();
  }, []);

  // --- Filtering Logic ---
  useEffect(() => {
    let result = members;

    // Filter Archived
    if (!showArchived) {
        result = result.filter(m => m.status !== 'archived');
    }

    // Filter Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(m => 
        (m.firstName && m.firstName.toLowerCase().includes(lowerTerm)) ||
        (m.lastName && m.lastName.toLowerCase().includes(lowerTerm)) ||
        (m.email && m.email.toLowerCase().includes(lowerTerm))
      );
    }
    setFilteredMembers(result);
  }, [searchTerm, members, showArchived]);

  // --- Actions ---

  const handleEdit = (member) => {
      setSelectedMember(member);
      setIsModalOpen(true);
  };

  const handleAdd = () => {
      setSelectedMember(null);
      setIsModalOpen(true);
  };

  const handleDeleteClick = (member) => {
      // Logic: If active, suggest Archive. If already archived or trialing, allow Delete.
      const isSafeToDelete = member.status === 'archived' || member.status === 'trialing' || !member.status;
      
      if (isSafeToDelete) {
          setActionModal({
              isOpen: true,
              type: 'delete',
              memberId: member.id,
              memberName: `${member.firstName} ${member.lastName}`
          });
      } else {
          // Force Archive path for active users
          setActionModal({
              isOpen: true,
              type: 'archive',
              memberId: member.id,
              memberName: `${member.firstName} ${member.lastName}`
          });
      }
  };

  const executeAction = async () => {
      if (!actionModal.memberId) return;

      if (actionModal.type === 'delete') {
          await deleteMember(actionModal.memberId);
      } else if (actionModal.type === 'archive') {
          await updateMemberProfile(actionModal.memberId, { status: 'archived' });
      }

      // Refresh
      await fetchMembers(gymId);
      setActionModal({ isOpen: false, type: null, memberId: null, memberName: '' });
  };

  // --- Status Badge Helper ---
  const getStatusBadge = (status) => {
    switch(status) {
      case 'active': return <span className="flex items-center text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full w-fit"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</span>;
      case 'trialing': return <span className="flex items-center text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full w-fit"><Clock className="w-3 h-3 mr-1"/> Trial</span>;
      case 'past_due': return <span className="flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full w-fit"><XCircle className="w-3 h-3 mr-1"/> Past Due</span>;
      case 'archived': return <span className="flex items-center text-xs font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded-full w-fit"><Archive className="w-3 h-3 mr-1"/> Archived</span>;
      default: return <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full w-fit">Inactive</span>;
    }
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Members</h2>
          <p className="text-gray-500">Manage your students and families.</p>
        </div>
        <button 
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5 mr-2" /> Add Member
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
           <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={showArchived} 
                onChange={e => setShowArchived(e.target.checked)} 
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              Show Archived
           </label>
           <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 bg-white">
             <Filter className="h-4 w-4 mr-2" /> Filter
           </button>
        </div>
      </div>

      {/* Members List (Table) */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Family</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <tr key={member.id} onClick={() => handleEdit(member)} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 overflow-hidden">
                        {member.photoUrl ? (
                          <img src={member.photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (member.firstName?.[0] || 'U')
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(member.status || 'inactive')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {member.membershipName || <span className="text-gray-400 italic">None</span>}
                  </td>
                  <td className="px-6 py-4">
                    {/* Family Indicators */}
                    {member.payerId ? (
                        <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md w-fit">
                            <LinkIcon className="h-3 w-3 mr-1" /> Dependent
                        </div>
                    ) : member.dependents && member.dependents.length > 0 ? (
                        <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit border border-blue-100">
                            <Users className="h-3 w-3 mr-1" /> Head of Household
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                        <button 
                            onClick={() => handleEdit(member)}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                        >
                            <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                            onClick={() => handleDeleteClick(member)}
                            className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                        >
                            {member.status === 'active' ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <User className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-lg font-medium text-gray-500">No members found</p>
                    <p className="text-sm">Try adding a new member or adjusting filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODALS --- */}
      <MemberFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gymId={gymId}
        memberData={selectedMember}
        onSave={() => fetchMembers(gymId)}
      />

      <ConfirmationModal 
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ ...actionModal, isOpen: false })}
        onConfirm={executeAction}
        title={actionModal.type === 'delete' ? "Delete Member?" : "Archive Member?"}
        message={
            actionModal.type === 'delete' 
            ? `Are you sure you want to permanently delete ${actionModal.memberName}? This cannot be undone.` 
            : `This active member will be moved to the archive. They will lose access to the app. Continue?`
        }
        confirmText={actionModal.type === 'delete' ? "Delete Forever" : "Archive Member"}
        isDestructive={true}
      />
    </div>
  );
};

export default DashboardMembersScreen;