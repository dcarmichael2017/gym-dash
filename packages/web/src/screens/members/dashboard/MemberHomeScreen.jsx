import React, { useState, useEffect } from 'react';
import { LogOut, Search, MapPin, ArrowRight, Loader2, ChevronLeft, ChevronDown } from 'lucide-react'; 
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';
import { signWaiver, disconnectGym, getGymWaiver } from '../../../../../../packages/shared/api/firestore';

// --- SUB-COMPONENTS ---
import MembershipOffers from './MembershipOffers';
import NextClassCard from './NextClassCard';
import WaiverModal from './WaiverModal';
import GymSwitcherSheet from './GymSwitcherSheet';
import GymSearch from './GymSearch'; 

const MemberHomeScreen = () => {
  const { currentGym, memberships } = useGym();

  if (!currentGym) {
      return <GymSearch onJoinSuccess={() => setIsAddingGym(false)} />;
  }

  const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };

  // --- LOCAL STATE ---
  const [showGymSwitcher, setShowGymSwitcher] = useState(false);
  const [isAddingGym, setIsAddingGym] = useState(false); 

  // --- WAIVER STATE ---
  const [waiverEnforced, setWaiverEnforced] = useState(false);
  const [currentWaiverVersion, setCurrentWaiverVersion] = useState(1);
  const [checkingWaiver, setCheckingWaiver] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // --- DERIVED STATE ---
  const currentMembership = memberships?.find(m => m.gymId === currentGym?.id);
  
  // Consolidating Guest/Prospect logic
  const isFreeMember = !currentMembership || 
                       currentMembership.status === 'prospect' || 
                       currentMembership.status === 'guest';
                       
  const isActiveMember = currentMembership?.status === 'active' || 
                         currentMembership?.status === 'trialing';

  // --- HELPERS FOR STATUS UI ---
  const getDisplayName = (status) => {
    const s = status?.toLowerCase();
    if (!s || s === 'prospect' || s === 'guest') return 'FREE MEMBER';
    if (s === 'active') return 'ACTIVE MEMBER';
    if (s === 'trialing') return 'TRIAL PERIOD';
    if (s === 'past_due') return 'PAYMENT FAILED';
    if (s === 'expired' || s === 'cancelled') return 'FORMER MEMBER';
    return status.toUpperCase();
  };

  const getBadgeStyles = (status) => {
    const s = status?.toLowerCase();
    if (s === 'active') return 'bg-green-100 text-green-700';
    if (s === 'past_due') return 'bg-red-100 text-red-700';
    if (s === 'trialing') return 'bg-blue-100 text-blue-700';
    if (s === 'expired' || s === 'cancelled') return 'bg-orange-100 text-orange-700';
    // Default for Free Member (using theme primary with low opacity)
    return `text-[${theme.primaryColor}]`; 
  };

  // --- EFFECT: CHECK WAIVER ---
  useEffect(() => {
    const checkSettings = async () => {
        if (currentGym?.id) {
            setCheckingWaiver(true);
            setIsDismissed(false); 
            const res = await getGymWaiver(currentGym.id);
            setWaiverEnforced(res.success ? res.enforceWaiver : true);
            setCurrentWaiverVersion(res.version || 1);
            setCheckingWaiver(false);
        } else {
            setCheckingWaiver(false);
        }
    };
    checkSettings();
  }, [currentGym?.id]);

  // --- GATEKEEPER LOGIC ---
  const userSignedVersion = currentMembership?.waiverSignedVersion || 0;
  const isOutdated = currentMembership?.waiverSigned && userSignedVersion < currentWaiverVersion;
  const isNotSigned = currentMembership && !currentMembership.waiverSigned;
  const showWaiverModal = !isDismissed && !checkingWaiver && waiverEnforced && (isNotSigned || isOutdated);

  // --- HANDLERS ---
  const handleWaiverSign = async () => {
      const user = auth.currentUser;
      if (user && currentGym) {
          await signWaiver(user.uid, currentGym.id, currentWaiverVersion);
      }
  };

  const handleWaiverDecline = async () => {
      if (isOutdated) { setIsDismissed(true); return; }
      const user = auth.currentUser;
      if (user && currentGym) {
          await disconnectGym(user.uid, currentGym.id);
      }
  };

  const handleAddGymClick = () => {
      setShowGymSwitcher(false);
      setIsAddingGym(true);
  };

  // --- RENDER LOGIC ---

  // If no gym is selected OR user specifically wants to add a gym -> Show Search
  if (!currentGym || isAddingGym) {
      return (
          <GymSearch 
            // Only allow canceling if they actually have a gym to go back to
            onCancel={currentGym ? () => setIsAddingGym(false) : null} 
            onJoinSuccess={() => setIsAddingGym(false)}
          />
      );
  }

  return (
    <div className="p-6 space-y-6 pb-24 relative">
      
      {showWaiverModal && (
          <WaiverModal 
              gymId={currentGym.id} 
              gymName={currentGym.name} 
              theme={theme}
              onAccept={handleWaiverSign}
              onDecline={handleWaiverDecline}
              targetVersion={currentWaiverVersion}
              isUpdate={isOutdated}
              lastSignedVersion={userSignedVersion}
          />
      )}

      <GymSwitcherSheet 
          isOpen={showGymSwitcher} 
          onClose={() => setShowGymSwitcher(false)} 
          onAddGym={handleAddGymClick}
      />

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
           <button 
              onClick={() => setShowGymSwitcher(true)}
              className="group flex items-center gap-2 hover:bg-gray-100 -ml-2 px-2 py-1 rounded-lg transition-colors"
           >
               <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 text-left">
                 {currentGym.name} 
                 <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
               </h1>
           </button>
           
           <div className="flex items-center gap-1 mt-1 px-1">
                <p className="text-gray-500 text-sm flex items-center gap-1">
                    <MapPin size={12}/> {currentGym?.city || "My Location"}
                </p>
                
                {/* DYNAMIC STATUS BADGE */}
                <span 
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ml-2 whitespace-nowrap ${getBadgeStyles(currentMembership?.status)}`}
                    style={isFreeMember ? { backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor } : {}}
                >
                    {getDisplayName(currentMembership?.status)}
                </span>
           </div>
        </div>
      </div>

      <NextClassCard hasActiveMembership={isActiveMember} />

      {isFreeMember && (
          <MembershipOffers />
      )}

      {/* STATS GRID */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-28">
            <div>
                <div className="text-2xl font-bold text-gray-800">
                    {currentMembership?.attendanceCounts?.total || 0}
                </div>
                <div className="text-xs text-gray-500 font-medium">Classes Attended</div>
            </div>
            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                <div 
                    className="h-full rounded-full" 
                    style={{ width: '20%', backgroundColor: theme.primaryColor }} 
                ></div>
            </div>
         </div>
         
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-28">
            <div>
                <div className="text-2xl font-bold text-gray-800">
                     White
                </div>
                <div className="text-xs text-gray-500 font-medium">Current Rank</div>
            </div>
            <div className="h-2 w-full bg-gray-100 border border-gray-300 rounded mt-2 relative">
                 <div className="absolute right-4 top-0 bottom-0 w-4 bg-black"></div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MemberHomeScreen;