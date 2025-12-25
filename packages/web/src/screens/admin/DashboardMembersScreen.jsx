import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Plus, Search, Filter, User, AlertTriangle 
} from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getGymMembers, deleteMember, archiveMember } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/common/FullScreenLoader';

// --- UPDATE THIS IMPORT ---
// Since you created a folder named MemberFormModal with an index.jsx inside, 
// this path works automatically.
import { MemberFormModal } from '../../components/admin/MemberFormModal'; 

import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { MemberTableRow } from '../../components/admin/MemberTableRow'; 

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
      type: null, // 'delete', 'archive', or 'blocked'
      memberId: null,
      memberName: '',
      dependents: [] 
  });

  // --- ACTIONS ---

  const handleNavigateToProfile = (memberId) => {
      // 1. Close warning
      setActionModal({ isOpen: false, type: null, memberId: null, memberName: '', dependents: [] });
      // 2. Find and edit member
      const memberToEdit = members.find(m => m.id === memberId);
      if (memberToEdit) {
          setSelectedMember(memberToEdit);
          setIsModalOpen(true);
      }
  };

  const fetchMembers = async (gId) => {
    const result = await getGymMembers(gId);
    if (result.success) {
      setMembers(result.members);
      // Refresh current modal data if open
      if (selectedMember) {
        const freshProfile = result.members.find(m => m.id === selectedMember.id);
        if (freshProfile) setSelectedMember(freshProfile);
      }
    }
  };

  const handleEdit = (member) => {
      setSelectedMember(member);
      setIsModalOpen(true);
  };

  const handleAdd = () => {
      setSelectedMember(null);
      setIsModalOpen(true);
  };

  const handleDeleteClick = (member) => {
      // 1. Check for dependents (Blocker)
      if (member.dependents && member.dependents.length > 0) {
          const dependentList = member.dependents.map(depId => {
              const depProfile = members.find(m => m.id === depId);
              return {
                  id: depId,
                  name: depProfile ? `${depProfile.firstName} ${depProfile.lastName}` : 'Unknown Member'
              };
          });

          setActionModal({
              isOpen: true,
              type: 'blocked',
              memberId: member.id,
              memberName: `${member.firstName} ${member.lastName}`,
              dependents: dependentList
          });
          return; 
      }

      // 2. Determine Action (Delete vs Archive)
      const isSafeToDelete = member.status === 'archived' || member.status === 'trialing' || !member.status || member.status === 'prospect';
      
      setActionModal({
          isOpen: true,
          type: isSafeToDelete ? 'delete' : 'archive',
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`
      });
  };

  const executeAction = async () => {
      if (!actionModal.memberId) return;

      if (actionModal.type === 'delete') {
          await deleteMember(actionModal.memberId);
      } else if (actionModal.type === 'archive') {
          await archiveMember(actionModal.memberId, "Admin Dashboard Action");
      }

      await fetchMembers(gymId);
      setActionModal({ isOpen: false, type: null, memberId: null, memberName: '' });
  };

  // --- EFFECTS ---

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

  useEffect(() => {
    let result = members;
    if (!showArchived) result = result.filter(m => m.status !== 'archived');
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
             <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
             Show Archived
           </label>
           <button className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 bg-white">
             <Filter className="h-4 w-4 mr-2" /> Filter
           </button>
        </div>
      </div>

      {/* Members List */}
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
                <MemberTableRow 
                    key={member.id} 
                    member={member} 
                    allMembers={members} 
                    onEdit={handleEdit} 
                    onDelete={handleDeleteClick} 
                />
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

      {/* Modals */}
      <MemberFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gymId={gymId}
        memberData={selectedMember}
        onSave={() => fetchMembers(gymId)}
        allMembers={members}
        onSelectMember={setSelectedMember}
      />

      {(actionModal.type === 'delete' || actionModal.type === 'archive') && actionModal.isOpen && (
          <ConfirmationModal 
            isOpen={actionModal.isOpen}
            onClose={() => setActionModal({ ...actionModal, isOpen: false })}
            onConfirm={executeAction}
            title={actionModal.type === 'delete' ? "Delete Member?" : "Archive Member?"}
            message={
                actionModal.type === 'delete' 
                ? `Are you sure you want to permanently delete ${actionModal.memberName}? This cannot be undone.` 
                : `This active member will be moved to the archive. We will record the cancellation date for your analytics. Continue?`
            }
            confirmText={actionModal.type === 'delete' ? "Delete Forever" : "Archive Member"}
            isDestructive={true}
          />
      )}

      {actionModal.type === 'blocked' && actionModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="bg-red-100 p-3 rounded-full shrink-0">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">Cannot Delete Member</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                <b>{actionModal.memberName}</b> is the Head of Household for the following members. You must unlink them first.
                            </p>

                            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-100">
                                {actionModal.dependents.map(dep => (
                                    <button
                                        key={dep.id}
                                        onClick={() => handleNavigateToProfile(dep.id)}
                                        className="w-full text-left px-4 py-3 text-sm flex justify-between items-center hover:bg-blue-50 transition-colors group"
                                    >
                                        <span className="font-medium text-gray-700 group-hover:text-blue-700">
                                            {dep.name}
                                        </span>
                                        <span className="text-xs text-blue-600 font-bold opacity-0 group-hover:opacity-100">
                                            Edit & Unlink →
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-end">
                    <button 
                        onClick={() => setActionModal({ ...actionModal, isOpen: false })}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100"
                    >
                        Okay, I understand
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default DashboardMembersScreen;