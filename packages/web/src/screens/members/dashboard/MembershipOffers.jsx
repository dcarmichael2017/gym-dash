import React, { useEffect, useState } from 'react';
import { Check, Loader2, CreditCard } from 'lucide-react';
import { getMembershipTiers } from '../../../../../../packages/shared/api/firestore';
import { useGym } from '../../../context/GymContext';

const MembershipOffers = () => {
  const { currentGym } = useGym();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- THEME ---
  const theme = currentGym?.theme || { primaryColor: '#2563eb' };

  useEffect(() => {
    const fetchTiers = async () => {
      if (currentGym?.id) {
        const result = await getMembershipTiers(currentGym.id);
        if (result.success) {
            // Filter only active plans
            setTiers(result.tiers.filter(t => t.active !== false));
        }
      }
      setLoading(false);
    };
    fetchTiers();
  }, [currentGym?.id]);

  if (loading) return (
    <div className="py-4 text-center">
        <Loader2 className="animate-spin inline" style={{ color: theme.primaryColor }} />
    </div>
  );
  
  if (tiers.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-3">Available Memberships</h3>
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
        {tiers.map((tier) => (
            <div key={tier.id} className="min-w-[260px] bg-white border border-gray-200 rounded-2xl p-5 shadow-sm snap-center flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                    <h4 className="font-bold text-lg text-gray-900">{tier.name}</h4>
                    
                    {/* Dynamic Price Color */}
                    <p className="text-2xl font-bold mt-2" style={{ color: theme.primaryColor }}>
                        ${tier.price}<span className="text-sm text-gray-400 font-normal">/{tier.interval || 'mo'}</span>
                    </p>
                    
                    <ul className="mt-4 space-y-2">
                        <li className="text-xs text-gray-500 flex items-center gap-2">
                            <Check size={14} className="text-green-500" /> {tier.sessionsPerWeek ? `${tier.sessionsPerWeek} Sessions/wk` : 'Unlimited Sessions'}
                        </li>
                    </ul>
                </div>

                {/* Dynamic Button Background */}
                <button 
                    className="mt-4 w-full text-white py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm"
                    style={{ backgroundColor: theme.primaryColor }}
                >
                    <CreditCard size={14} /> Buy Now
                </button>
            </div>
        ))}
      </div>
    </div>
  );
};

export default MembershipOffers;