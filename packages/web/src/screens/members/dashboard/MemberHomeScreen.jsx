import React, { useState, useEffect } from 'react';
import { LogOut, Search, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';
import { searchGyms, joinGym } from '../../../../../../packages/shared/api/firestore';

// --- SUB-COMPONENTS ---
import MembershipOffers from './MembershipOffers';
import NextClassCard from './NextClassCard';

const MemberHomeScreen = () => {
  const { currentGym, memberships } = useGym();
  
  // --- THEME ---
  // Default to standard blue if not set
  const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };

  // Local State for Search (Gym Finder)
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [gymsList, setGymsList] = useState([]);
  const [joiningGymId, setJoiningGymId] = useState(null);

  // --- DERIVED STATE: USER STATUS ---
  const currentMembership = memberships?.find(m => m.gymId === currentGym?.id);
  const isProspect = !currentMembership || currentMembership.status === 'prospect' || currentMembership.status === 'guest';
  const isActiveMember = currentMembership?.status === 'active' || currentMembership?.status === 'trialing';

  // --- 1. ZERO STATE: FIND A GYM ---
  if (!currentGym && memberships.length === 0) {
    
    useEffect(() => {
        const fetchGyms = async () => {
            setIsSearching(true);
            const result = await searchGyms(searchTerm);
            if (result.success) setGymsList(result.gyms);
            setIsSearching(false);
        };
        // Debounce logic is ideal here, but basic effect works for MVP
        fetchGyms();
    }, [searchTerm]);

    const handleJoin = async (gym) => {
        setJoiningGymId(gym.id);
        const user = auth.currentUser;
        if (!user) return;

        const result = await joinGym(user.uid, gym.id, gym.name);
        if (result.success) {
            window.location.reload(); 
        }
        setJoiningGymId(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 safe-top">
             <div className="mb-8 mt-4">
                <h1 className="text-3xl font-bold text-gray-900">Find your Gym</h1>
                <p className="text-gray-500 mt-2">Search for your gym to get started.</p>
             </div>

             <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-gray-400 h-5 w-5" />
                <input 
                    type="text" 
                    placeholder="Search by gym name..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 h-12 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
             </div>

             <div className="space-y-4 pb-20">
                {isSearching ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : gymsList.length > 0 ? (
                    gymsList.map(gym => {
                        // Extract gym specific theme if available, else fallback
                        const gymThemeColor = gym.theme?.primaryColor || '#2563eb';

                        return (
                            <div key={gym.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 transition-all hover:shadow-md">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className="h-12 w-12 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
                                            {gym.logoUrl ? (
                                                <img src={gym.logoUrl} className="h-full w-full object-contain p-1" alt={gym.name} />
                                            ) : (
                                                <span className="text-xl font-bold text-gray-300">{gym.name[0]}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{gym.name}</h3>
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                <MapPin size={12} /> {gym.city || "Location N/A"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-gray-600 line-clamp-2">
                                    {gym.description || "No description available."}
                                </p>

                                <button 
                                    onClick={() => handleJoin(gym)}
                                    disabled={joiningGymId === gym.id}
                                    style={{ backgroundColor: gymThemeColor }}
                                    className="mt-2 w-full text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm hover:opacity-90"
                                >
                                    {joiningGymId === gym.id ? <Loader2 className="animate-spin" size={16}/> : <>Connect <ArrowRight size={16} /></>}
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-gray-400 py-10">No gyms found.</div>
                )}
             </div>
        </div>
    );
  }

  // --- 2. DASHBOARD STATE ---
  return (
    <div className="p-6 space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">
             {isActiveMember ? "Welcome Back" : "Hello Guest"}
           </h1>
           <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                <MapPin size={12}/> {currentGym?.name || "My Gym"}
                {isProspect && (
                    <span 
                        className="text-[10px] font-bold px-2 py-0.5 rounded ml-2"
                        style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                    >
                        GUEST
                    </span>
                )}
           </p>
        </div>
        
        {/* Only show logout here if desired, usually handled by Sidebar now */}
        {/* <button onClick={() => auth.signOut()} className="text-gray-400 hover:text-red-600">
           <LogOut size={20} />
        </button> */}
      </div>

      {/* COMPONENT: NEXT CLASS */}
      <NextClassCard hasActiveMembership={isActiveMember} />

      {/* COMPONENT: MEMBERSHIP OFFERS */}
      {isProspect && (
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
                    style={{ width: '20%', backgroundColor: theme.primaryColor }} // Example progress
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
            {/* Rank Belt Visualization (Placeholder) */}
            <div className="h-2 w-full bg-gray-100 border border-gray-300 rounded mt-2 relative">
                 <div className="absolute right-4 top-0 bottom-0 w-4 bg-black"></div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MemberHomeScreen;