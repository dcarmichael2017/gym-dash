import React, { useState } from 'react';
import { Check, Shield, AlertCircle, Sparkles, Loader2, ArrowUp, ArrowDown, X } from 'lucide-react';
import { createSubscriptionCheckout, changeSubscriptionPlan } from '@shared/api/firestore/memberships';
import { useGym } from '../../../../context/GymContext';

const MembershipListTab = ({ tiers, theme, currentMembership }) => {
  const { currentGym } = useGym();
  const [loadingTierId, setLoadingTierId] = useState(null);
  const [error, setError] = useState(null);
  const [planChangePreview, setPlanChangePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  // Check if member has an active subscription
  const hasActiveSubscription = currentMembership?.stripeSubscriptionId &&
    (currentMembership?.status === 'active' || currentMembership?.status === 'trialing');
  const currentTierId = currentMembership?.membershipId;

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

  const handlePlanChangePreview = async (tier) => {
    if (!currentGym?.id) {
      setError('Unable to preview plan change. Please try again.');
      return;
    }

    setLoadingPreview(true);
    setLoadingTierId(tier.id);
    setError(null);

    try {
      const result = await changeSubscriptionPlan(currentGym.id, tier.id, true);

      if (result.success && result.preview) {
        setPlanChangePreview({
          tierId: tier.id,
          tierName: tier.name,
          ...result.preview
        });
      } else {
        setError(result.error || 'Failed to preview plan change. Please try again.');
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoadingPreview(false);
      setLoadingTierId(null);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!planChangePreview || !currentGym?.id) return;

    setChangingPlan(true);
    setError(null);

    try {
      const result = await changeSubscriptionPlan(currentGym.id, planChangePreview.tierId, false);

      if (result.success) {
        setPlanChangePreview(null);
        // The membership will update via real-time listener
      } else {
        setError(result.error || 'Failed to change plan. Please try again.');
      }
    } catch (err) {
      console.error('Plan change error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setChangingPlan(false);
    }
  };

  const getPlanAction = (tier) => {
    if (!hasActiveSubscription) return 'select';
    if (tier.id === currentTierId) return 'current';

    const currentTier = tiers.find(t => t.id === currentTierId);
    if (!currentTier) return 'select';

    // Compare prices to determine upgrade/downgrade
    if (tier.price > currentTier.price) return 'upgrade';
    return 'downgrade';
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

      {/* Plan Change Preview Modal */}
      {planChangePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPlanChangePreview(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">Change Plan</h3>
              <button
                onClick={() => setPlanChangePreview(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* New Plan Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Switching to</p>
                <p className="text-lg font-bold text-gray-900">{planChangePreview.newPlanName}</p>
                <p className="text-sm" style={{ color: theme.primaryColor }}>
                  ${planChangePreview.newPlanPrice} / {planChangePreview.newPlanInterval}
                </p>
              </div>

              {/* Proration Details */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                {planChangePreview.immediateCharge > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Prorated charge</span>
                    <span className="font-bold text-gray-900">
                      ${planChangePreview.immediateCharge.toFixed(2)}
                    </span>
                  </div>
                )}
                {planChangePreview.credit > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Credit applied</span>
                    <span className="font-bold text-green-600">
                      -${planChangePreview.credit.toFixed(2)}
                    </span>
                  </div>
                )}
                {planChangePreview.immediateCharge === 0 && planChangePreview.credit === 0 && (
                  <p className="text-sm text-gray-500">No immediate charge - takes effect at next billing</p>
                )}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Next billing: {new Date(planChangePreview.nextBillingDate).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPlanChangePreview(null)}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPlanChange}
                  disabled={changingPlan}
                  className="flex-1 py-3 px-4 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {changingPlan ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Changing...
                    </>
                  ) : (
                    'Confirm Change'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier) => {
          const isLoading = loadingTierId === tier.id;
          const isDisabled = loadingTierId !== null;
          const planAction = getPlanAction(tier);
          const isCurrent = planAction === 'current';
          const isUpgrade = planAction === 'upgrade';
          const isDowngrade = planAction === 'downgrade';

          return (
            <div
              key={tier.id}
              className={`bg-white rounded-2xl p-6 shadow-sm border relative overflow-hidden transition-all hover:shadow-md flex flex-col ${
                isCurrent ? 'border-2' : 'border-gray-100'
              }`}
              style={isCurrent ? { borderColor: theme.primaryColor } : {}}
            >
               {/* Current Plan Badge */}
               {isCurrent && (
                   <div
                     className="absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg"
                     style={{ backgroundColor: theme.primaryColor }}
                   >
                       CURRENT PLAN
                   </div>
               )}

               {/* Internal Badge */}
               {tier.visibility !== 'public' && !isCurrent && (
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
               {tier.hasTrial && !hasActiveSubscription && (
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
               {tier.initiationFee > 0 && !hasActiveSubscription && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-center gap-2 text-xs text-gray-500">
                     <AlertCircle size={12} /> ${tier.initiationFee} Signup Fee
                  </div>
               )}

               {/* Action Button */}
               {isCurrent ? (
                  <div className="w-full py-3 rounded-xl font-bold text-center bg-gray-100 text-gray-500 mt-auto">
                     Your Current Plan
                  </div>
               ) : (
                  <button
                    onClick={() => {
                      if (hasActiveSubscription) {
                        handlePlanChangePreview(tier);
                      } else {
                        handleSelectPlan(tier);
                      }
                    }}
                    disabled={isDisabled}
                    className="w-full py-3 rounded-xl font-bold text-white shadow-sm transition-all mt-auto flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: isDisabled ? '#9CA3AF' : theme.primaryColor }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {loadingPreview ? 'Loading...' : 'Processing...'}
                      </>
                    ) : isUpgrade ? (
                      <>
                        <ArrowUp size={16} />
                        Upgrade
                      </>
                    ) : isDowngrade ? (
                      <>
                        <ArrowDown size={16} />
                        Downgrade
                      </>
                    ) : (
                      tier.hasTrial ? 'Start Free Trial' : 'Select Plan'
                    )}
                  </button>
               )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MembershipListTab;
