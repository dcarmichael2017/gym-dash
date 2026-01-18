import React, { useState, useEffect } from 'react';
import { Search, MapPin, ArrowRight, Loader2, X, ChevronLeft } from 'lucide-react';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';
import { searchGyms } from '../../../../../../packages/shared/api/firestore';
import { joinGym } from '../../../../../../packages/shared/api/firestore/members'; // Updated import path

const GymSearch = ({ onCancel, onJoinSuccess }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [gymsList, setGymsList] = useState([]);
  const [joiningGymId, setJoiningGymId] = useState(null);

  // Search Effect
  useEffect(() => {
    const fetchGyms = async () => {
        setIsSearching(true);
        const result = await searchGyms(searchTerm);
        if (result.success) setGymsList(result.gyms);
        setIsSearching(false);
    };
    fetchGyms();
  }, [searchTerm]);

  // Join Handler
  const handleJoin = async (gym) => {
    setJoiningGymId(gym.id);
    const user = auth.currentUser;
    if (!user) return;

    const result = await joinGym(user.uid, gym.id, gym.name);
    if (result.success) {
        if (onJoinSuccess) onJoinSuccess(gym.id);
    }
    setJoiningGymId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 safe-top animate-in fade-in zoom-in duration-200">
         
         {/* Header Row */}
         <div className="mb-8 mt-4 flex justify-between items-start">
            <div>
                {onCancel && (
                    <button onClick={onCancel} className="mb-4 flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors">
                        <ChevronLeft size={20} /> Back
                    </button>
                )}
                <h1 className="text-3xl font-bold text-gray-900">Find your Gym</h1>
                <p className="text-gray-500 mt-2">Search for your gym to get started.</p>
            </div>
         </div>

         {/* Search Input */}
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

         {/* Results List */}
         <div className="space-y-4 pb-20">
            {isSearching ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
            ) : gymsList.length > 0 ? (
                gymsList.map(gym => {
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
};

export default GymSearch;
