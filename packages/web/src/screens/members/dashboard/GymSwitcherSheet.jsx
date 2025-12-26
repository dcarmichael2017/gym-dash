import React, { useState } from 'react';
import { X, Check, Plus, MoreVertical, EyeOff, Archive, RotateCcw } from 'lucide-react';
import { useGym } from '../../../context/GymContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../../../../packages/shared/api/firebaseConfig';

const GymSwitcherSheet = ({ isOpen, onClose, onAddGym }) => {
  const { memberships, currentGym, switchGym } = useGym();
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);

  if (!isOpen) return null;

  const filteredGyms = memberships.filter(m => showArchived ? m.isHidden : !m.isHidden);

  const handleGymSelect = (gymId, isHidden) => {
    if (isHidden) return;
    switchGym(gymId);
    onClose();
  };

  const toggleHideGym = async (e, gymId, currentHiddenStatus, status) => {
    e.stopPropagation();
    setMenuOpenId(null);

    const s = status?.toLowerCase();
    const isLocked = s === 'active' || s === 'past_due';
    
    if (isLocked && !currentHiddenStatus) {
      alert("You cannot hide a gym with an active or past-due membership.");
      return;
    }

    try {
      const user = auth.currentUser;
      const userRef = doc(db, 'users', user.uid);
      const updatedMemberships = memberships.map(m => 
        m.gymId === gymId ? { ...m, isHidden: !currentHiddenStatus } : m
      );

      await updateDoc(userRef, { memberships: updatedMemberships });
      
      if (!currentHiddenStatus && gymId === currentGym?.id) {
         const nextGym = memberships.find(m => m.gymId !== gymId && !m.isHidden);
         if (nextGym) switchGym(nextGym.gymId);
      }
    } catch (err) {
      console.error("Failed to update gym visibility", err);
    }
  };

  const getDisplayName = (status) => {
    const s = status?.toLowerCase();
    if (s === 'prospect' || s === 'guest') return 'Free Member';
    if (s === 'active') return 'Active Member';
    if (s === 'trialing') return 'Trial Period';
    if (s === 'past_due') return 'Payment Failed';
    if (s === 'expired' || s === 'cancelled') return 'Former Member';
    return status;
  };

  const getBadgeStyles = (status) => {
    const s = status?.toLowerCase();
    if (s === 'active') return 'bg-green-100 text-green-700';
    if (s === 'past_due') return 'bg-red-100 text-red-700';
    if (s === 'trialing') return 'bg-blue-100 text-blue-700';
    if (s === 'expired' || s === 'cancelled') return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl relative z-10 animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 text-xl">
                {showArchived ? "Archived Gyms" : "My Gyms"}
            </h3>
            {showArchived && (
                <button 
                    onClick={() => setShowArchived(false)}
                    className="text-xs text-blue-600 font-bold flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full"
                >
                    <RotateCcw size={12}/> Back
                </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 flex-1 min-h-0 space-y-3 pb-32">
          {filteredGyms.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                  <Archive size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{showArchived ? "No archived gyms found." : "No gyms joined yet."}</p>
              </div>
          ) : (
            filteredGyms.map((mem) => {
                const isCurrent = mem.gymId === currentGym?.id;
                const displayStatus = getDisplayName(mem.status);

                return (
                <div 
                    key={mem.gymId}
                    onClick={() => handleGymSelect(mem.gymId, mem.isHidden)}
                    className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                    isCurrent 
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
                    isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                    {mem.gymName?.[0] || "?"}
                    </div>

                    <div className="flex-1 min-w-0">
                    <h4 className={`font-bold truncate ${isCurrent ? 'text-blue-900' : 'text-gray-900'}`}>
                        {mem.gymName}
                    </h4>
                    <div className="flex items-center gap-2 text-xs mt-1">
                        <span className={`px-2 py-0.5 rounded-md font-medium capitalize ${getBadgeStyles(mem.status)}`}>
                        {displayStatus}
                        </span>
                    </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isCurrent && <Check size={20} className="text-blue-600 shrink-0" />}
                        
                        <div className="relative">
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setMenuOpenId(menuOpenId === mem.gymId ? null : mem.gymId); 
                                }}
                                className={`p-2 rounded-full transition-colors ${menuOpenId === mem.gymId ? 'bg-gray-200 text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
                            >
                                <MoreVertical size={20} />
                            </button>

                            {menuOpenId === mem.gymId && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[60] py-1.5 animate-in fade-in zoom-in-95 duration-100">
                                    <button 
                                        onClick={(e) => toggleHideGym(e, mem.gymId, mem.isHidden, mem.status)}
                                        className="w-full text-left px-4 py-3 text-sm font-semibold flex items-center gap-3 hover:bg-gray-50 text-gray-700 active:bg-gray-100"
                                    >
                                        {mem.isHidden ? <RotateCcw size={18} className="text-blue-600"/> : <EyeOff size={18} className="text-gray-400" />}
                                        {mem.isHidden ? "Unhide Gym" : "Hide from Dashboard"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                );
            })
          )}
        </div>

        <div className="p-6 bg-white border-t border-gray-100 rounded-b-3xl">
          {!showArchived && (
            <button 
              onClick={() => setShowArchived(true)}
              className="w-full py-2 mb-3 text-sm text-gray-400 font-semibold flex items-center justify-center gap-2 hover:text-gray-600 transition-colors"
            >
              <Archive size={16} /> View Archived Gyms
            </button>
          )}

          <button 
            onClick={onAddGym}
            className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg shadow-gray-200"
          >
            <Plus size={20} /> Join Another Gym
          </button>
        </div>
      </div>
    </div>
  );
};

export default GymSwitcherSheet;