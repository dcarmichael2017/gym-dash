import React, { useState } from 'react';
import { Check, Ticket, AlertCircle, Loader2 } from 'lucide-react';
import { useGym } from '../../../../context/GymContext';
import { createClassPackCheckout } from '../../../../../../../packages/shared/api/firestore';

const MembershipDropInTab = ({ tiers, theme }) => {
  const { currentGym } = useGym();
  const [loadingPackId, setLoadingPackId] = useState(null);
  const [error, setError] = useState(null);

  const handleSelectPlan = async (tier) => {
    if (!currentGym?.id) {
      setError('Unable to process checkout. Please try again.');
      return;
    }

    // Check if pack is synced to Stripe
    if (!tier.stripePriceId) {
      setError('This pack is not available for online purchase. Please contact the gym.');
      return;
    }

    setLoadingPackId(tier.id);
    setError(null);

    try {
      const result = await createClassPackCheckout(currentGym.id, tier.id);

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || 'Failed to start checkout. Please try again.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoadingPackId(null);
    }
  };

  if (tiers.length === 0) {
    return (
        <div className="text-center py-10 opacity-50">
            <Ticket size={48} className="mx-auto mb-2" />
            <p>No class packs available for purchase online.</p>
        </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier) => {
          const isLoading = loadingPackId === tier.id;
          const isAvailable = tier.stripePriceId;

          return (
            <div
              key={tier.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden transition-all hover:shadow-md flex flex-col"
            >
               {/* Internal Badge */}
               {tier.visibility !== 'public' && (
                   <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                       INTERNAL
                   </div>
               )}

               <div className="flex justify-between items-start mb-2">
                  <div>
                     <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                     <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold" style={{ color: theme.primaryColor }}>${tier.price}</span>
                        <span className="text-sm text-gray-400 font-medium"> one-time</span>
                     </div>
                  </div>
                  {/* Credits Badge */}
                  {tier.credits > 0 && (
                    <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      {tier.credits} {tier.credits === 1 ? 'Credit' : 'Credits'}
                    </div>
                  )}
               </div>

               {/* Description */}
               {tier.description && (
                   <p className="text-sm text-gray-500 mb-4 leading-relaxed border-b border-gray-50 pb-4">
                       {tier.description}
                   </p>
               )}

               {/* Features List */}
               {tier.features && tier.features.length > 0 && (
                   <div className="mb-6 flex-1">
                       <ul className="space-y-2">
                           {tier.features.map((feature, idx) => (
                               <li key={idx} className="text-sm text-gray-600 flex items-start gap-2.5">
                                   <div className="mt-0.5 bg-green-100 rounded-full p-0.5 shrink-0">
                                       <Check size={10} className="text-green-600" strokeWidth={4} />
                                   </div>
                                   <span className="leading-tight">{feature}</span>
                               </li>
                           ))}
                       </ul>
                   </div>
               )}

               <button
                  onClick={() => handleSelectPlan(tier)}
                  disabled={isLoading || !isAvailable}
                  className="w-full py-3 rounded-xl font-bold text-white shadow-sm transition-all active:scale-95 mt-auto disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: theme.primaryColor }}
               >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : !isAvailable ? (
                    'Contact Gym to Purchase'
                  ) : (
                    'Buy Pack'
                  )}
               </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MembershipDropInTab;