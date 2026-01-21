import React, { useState } from 'react';
import { Check, Shield, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { createSubscriptionCheckout } from '@shared/api/firestore/memberships';
import { useGym } from '../../../../context/GymContext';

const MembershipListTab = ({ tiers, theme }) => {
  const { currentGym } = useGym();
  const [loadingTierId, setLoadingTierId] = useState(null);
  const [error, setError] = useState(null);

  const handleSelectPlan = async (tier) => {
    if (!currentGym?.id) {
      setError('Unable to process checkout. Please try again.');
      return;
    }

    // Check if tier is ready for Stripe checkout
    if (!tier.stripePriceId) {
      setError('This plan is not available for online purchase. Please contact the gym.');
      return;
    }

    setLoadingTierId(tier.id);
    setError(null);

    try {
      const result = await createSubscriptionCheckout(currentGym.id, tier.id);

      if (result.success && result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        setError(result.error || 'Failed to start checkout. Please try again.');
        setLoadingTierId(null);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoadingTierId(null);
    }
  };

  if (tiers.length === 0) {
    return (
        <div className="text-center py-10 opacity-50">
            <Shield size={48} className="mx-auto mb-2" />
            <p>No memberships available for purchase online.</p>
        </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 hover:underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier) => {
          const isLoading = loadingTierId === tier.id;
          const isDisabled = loadingTierId !== null;

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
                        <span className="text-sm text-gray-400 font-medium">
                           / {tier.interval}
                        </span>
                     </div>
                  </div>
               </div>

               {/* Free Trial Badge */}
               {tier.hasTrial && (
                   <div className="mb-4 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-bold w-fit">
                       <Sparkles size={12} fill="currentColor" />
                       {tier.trialDays}-Day Free Trial
                   </div>
               )}

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

               {/* Initiation Fee Info */}
               {tier.initiationFee > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-center gap-2 text-xs text-gray-500">
                     <AlertCircle size={12} /> ${tier.initiationFee} Signup Fee
                  </div>
               )}

               <button
                  onClick={() => handleSelectPlan(tier)}
                  disabled={isDisabled}
                  className="w-full py-3 rounded-xl font-bold text-white shadow-sm transition-all mt-auto flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: isDisabled ? '#9CA3AF' : theme.primaryColor }}
               >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    tier.hasTrial ? 'Start Free Trial' : 'Select Plan'
                  )}
               </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MembershipListTab;