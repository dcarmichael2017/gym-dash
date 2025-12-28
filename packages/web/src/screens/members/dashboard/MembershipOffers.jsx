import React, { useEffect, useState } from 'react';
import { Check, Loader2, CreditCard, ShieldAlert, Phone, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; 
import { getMembershipTiers } from '../../../../../../packages/shared/api/firestore';
import { useGym } from '../../../context/GymContext';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';

const MembershipOffers = () => {
  const navigate = useNavigate();
  const { currentGym, memberships } = useGym();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- THEME ---
  const theme = currentGym?.theme || { primaryColor: '#2563eb' };

  useEffect(() => {
    const fetchTiers = async () => {
      if (currentGym?.id) {
        const result = await getMembershipTiers(currentGym.id);
        if (result.success) {
            
            // --- VISIBILITY LOGIC ---
            const myMembership = memberships.find(m => m.gymId === currentGym.id);
            const isOwner = currentGym.ownerId === auth.currentUser?.uid;
            const isStaff = myMembership?.role === 'staff' || myMembership?.role === 'coach' || myMembership?.role === 'admin';

            const visibleTiers = result.tiers.filter(t => {
                if (t.active === false) return false;
                const level = t.visibility || 'public';
                if (isOwner) return true;
                if (isStaff) return level !== 'admin';
                return level === 'public';
            });

            setTiers(visibleTiers);
        }
      }
      setLoading(false);
    };
    fetchTiers();
  }, [currentGym?.id, memberships]);

  if (loading) return (
    <div className="py-4 text-center">
        <Loader2 className="animate-spin inline" style={{ color: theme.primaryColor }} />
    </div>
  );
  
  // --- EMPTY STATE ---
  if (tiers.length === 0) {
    return (
        <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Available Memberships</h3>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center">
                <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <ShieldAlert size={24} />
                </div>
                <h4 className="font-bold text-gray-900">No Online Plans Available</h4>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                    This gym currently has no membership plans available for online purchase.
                </p>
                <button className="text-sm font-bold text-blue-600 flex items-center justify-center gap-2 mx-auto">
                    <Phone size={14} /> Contact Staff to Join
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-end mb-3 px-1">
          <h3 className="text-lg font-bold text-gray-900">Available Memberships</h3>
          <button 
            onClick={() => navigate('/members/memberships')}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            See All
          </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
        {tiers.map((tier) => {
            // LOGIC: Show max 2 features
            const featuresPreview = tier.features && tier.features.length > 0 
                ? tier.features.slice(0, 2) 
                : [];
            const remainingCount = (tier.features?.length || 0) - 2;

            return (
                <div 
                    key={tier.id} 
                    onClick={() => navigate('/members/memberships')}
                    className="min-w-[260px] bg-white border border-gray-200 rounded-2xl p-5 shadow-sm snap-center flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all relative overflow-hidden cursor-pointer group"
                >
                    
                    {/* Internal Badge */}
                    {tier.visibility !== 'public' && (
                        <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                            INTERNAL
                        </div>
                    )}

                    <div>
                        <h4 className="font-bold text-lg text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                            {tier.name}
                        </h4>
                        
                        <p className="text-2xl font-bold mt-2" style={{ color: theme.primaryColor }}>
                            ${tier.price}<span className="text-sm text-gray-400 font-normal">/{tier.interval === 'one_time' ? 'once' : (tier.interval || 'mo')}</span>
                        </p>

                        {/* Free Trial Badge */}
                        {tier.hasTrial && (
                            <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold w-fit">
                                <Sparkles size={12} fill="currentColor" /> 
                                {tier.trialDays}-Day Free Trial
                            </div>
                        )}
                        
                        {/* Only Render List if Features Exist */}
                        {featuresPreview.length > 0 && (
                            <ul className="mt-4 space-y-2">
                                {featuresPreview.map((feat, idx) => (
                                    <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                                        <Check size={14} className="text-green-500 shrink-0 mt-0.5" /> 
                                        <span className="line-clamp-1">{feat}</span>
                                    </li>
                                ))}
                                {remainingCount > 0 && (
                                    <li className="text-[10px] font-bold text-blue-500 pl-6">
                                        + {remainingCount} more benefits
                                    </li>
                                )}
                            </ul>
                        )}
                        
                        {/* Fallback to Description if no features, but still show something so card isn't empty */}
                        {featuresPreview.length === 0 && tier.description && (
                             <p className="mt-4 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                {tier.description}
                             </p>
                        )}
                    </div>

                    <button 
                        className="mt-4 w-full text-white py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm"
                        style={{ backgroundColor: theme.primaryColor }}
                    >
                        <CreditCard size={14} /> {tier.hasTrial ? 'Start Trial' : 'Buy Now'}
                    </button>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default MembershipOffers;