import React, { useState, useEffect } from 'react';
import { CreditCard, ChevronRight, Calendar, DollarSign, RefreshCw, Clock, XCircle, Bug, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useConfirm } from '../../../context/ConfirmationContext';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { getMembershipTiers, cancelUserMembership, logMembershipHistory, runPermissionDiagnostics, createCustomerPortalSession, cancelMemberSubscription, reactivateSubscription } from '../../../../../shared/api/firestore';
import { auth, db } from '../../../../../shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';

export const MembershipSection = ({ membership, onManageBilling }) => {
  const { confirm } = useConfirm();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [liveMembership, setLiveMembership] = useState(membership);
  const [tiers, setTiers] = useState([]);
  const { currentGym } = useGym();
  const [membershipHistory, setMembershipHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // ✅ NEW: Add diagnostic handler
  const handleRunDiagnostic = async () => {
    if (currentGym?.id) {
      console.log("🔍 Running diagnostic from member side...");
      await runPermissionDiagnostics(currentGym.id);
    } else {
      console.error("No current gym ID available for diagnostic");
    }
  };

  // Handle opening Stripe Customer Portal
  const handleManageBilling = async () => {
    if (!currentGym?.id) {
      setPortalError('Unable to open billing portal.');
      return;
    }

    // Check if user has Stripe customer ID
    if (!liveMembership?.stripeCustomerId) {
      // Fallback to the original onManageBilling prop if no Stripe subscription
      if (onManageBilling) {
        onManageBilling();
      } else {
        setPortalError('No billing information found. Subscribe to a plan first.');
      }
      return;
    }

    setIsOpeningPortal(true);
    setPortalError(null);

    try {
      const result = await createCustomerPortalSession(currentGym.id);

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setPortalError(result.error || 'Failed to open billing portal.');
        setIsOpeningPortal(false);
      }
    } catch (err) {
      console.error('Portal error:', err);
      setPortalError('An unexpected error occurred.');
      setIsOpeningPortal(false);
    }
  };

  useEffect(() => {
    if (currentGym?.id) {
      const fetchTiers = async () => {
        const res = await getMembershipTiers(currentGym.id);
        if (res.success) {
          setTiers(res.tiers);
        }
      };
      fetchTiers();
    }
  }, [currentGym?.id]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !currentGym?.id) {
      setMembershipHistory([]);
      return;
    }

    setLoadingHistory(true);
    const historyRef = collection(db, 'users', user.uid, 'membershipHistory');
    const q = query(historyRef, where('gymId', '==', currentGym.id), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembershipHistory(history);
      setLoadingHistory(false);
    }, (error) => {
      console.error("Error fetching membership history:", error);
      setLoadingHistory(false);
    });

    return () => unsub();
  }, [currentGym?.id]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !currentGym?.id) return;

    // Listen directly to the membership subcollection document
    const membershipRef = doc(db, 'users', user.uid, 'memberships', currentGym.id);

    const unsub = onSnapshot(membershipRef, (snap) => {
      if (snap.exists()) {
        setLiveMembership({ id: snap.id, ...snap.data() });
      } else {
        setLiveMembership(null);
      }
    }, (error) => {
      console.error("Error fetching membership:", error);
      setLiveMembership(null);
    });

    return () => unsub();
  }, [currentGym?.id]);

  const {
    planName,
    status,
    startDate,
    trialEndDate,
    price,
    assignedPrice,
    interval = 'month',
    cancelAtPeriodEnd,
    membershipId
  } = liveMembership || {};

  const currentTier = tiers.find(t => t.id === membershipId);
  const displayPlanName = planName || currentTier?.name;
  const displayPrice = assignedPrice ?? price;
  const isTrialing = status?.toLowerCase() === 'trialing';
  const isActive = status?.toLowerCase() === 'active';
  const isPastDue = status?.toLowerCase() === 'past_due';

  const getStatusDisplay = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return { label: 'Active', color: 'text-green-700 bg-green-50 border-green-200', tooltip: null };
      case 'trialing': return { label: 'Free Trial', color: 'text-blue-700 bg-blue-50 border-blue-200', tooltip: null };
      case 'past_due': return { label: 'Past Due', color: 'text-red-700 bg-red-50 border-red-200', tooltip: null };
      case 'inactive': return {
        label: 'Inactive',
        color: 'text-red-700 bg-red-50 border-red-200',
        tooltip: 'Your gym access has been disabled by the gym administrator. Please contact the gym owner or staff for assistance.'
      };
      default: return { label: 'Inactive', color: 'text-gray-500 bg-gray-50 border-gray-200', tooltip: null };
    }
  };

  const statusDisplay = getStatusDisplay(status);
  const dateOpts = { year: 'numeric', month: 'short', day: 'numeric' };

  const parseDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal.toDate) return dateVal.toDate();
    if (dateVal instanceof Date) return dateVal;
    return new Date(dateVal);
  };

  const startObj = parseDate(startDate);
  const trialEndObj = parseDate(trialEndDate);

  const handleCancel = async () => {
    const nextBillingDateStr = getNextBillingDate()?.toLocaleDateString('en-US', dateOpts) || 'the end of the current period';
    const isConfirmed = await confirm({
      title: 'Cancel Membership?',
      message: `This will prevent your membership from auto-renewing. You will still have access until ${nextBillingDateStr}. Are you sure?`,
      confirmText: "Yes, Cancel",
      cancelText: "Keep Membership",
      type: 'danger'
    });

    if (isConfirmed) {
      setIsCancelling(true);
      setActionError(null);
      try {
        const user = auth.currentUser;
        if (!user || !currentGym?.id) throw new Error("User or gym not found.");

        // Use Stripe-based cancellation if there's a subscription
        if (liveMembership?.stripeSubscriptionId) {
          const result = await cancelMemberSubscription(currentGym.id, false); // false = cancel at period end
          if (!result.success) {
            throw new Error(result.error || "Failed to schedule cancellation.");
          }
        } else {
          // Fallback to local cancellation for non-Stripe memberships
          const result = await cancelUserMembership(user.uid, currentGym.id);
          if (result.success) {
            await logMembershipHistory(user.uid, currentGym.id, 'Member scheduled cancellation.', user.uid);
          } else {
            throw new Error(result.error || "Failed to schedule cancellation.");
          }
        }
      } catch (error) {
        console.error("Failed to cancel membership:", error);
        setActionError(error.message || "Failed to cancel membership.");
      } finally {
        setIsCancelling(false);
      }
    }
  };

  const handleReactivate = async () => {
    const isConfirmed = await confirm({
      title: 'Reactivate Membership?',
      message: 'This will restore your membership and it will continue to renew automatically. Would you like to reactivate?',
      confirmText: "Yes, Reactivate",
      cancelText: "Keep Cancelled",
      type: 'info'
    });

    if (isConfirmed) {
      setIsReactivating(true);
      setActionError(null);
      try {
        if (!currentGym?.id) throw new Error("Gym not found.");

        const result = await reactivateSubscription(currentGym.id);
        if (!result.success) {
          throw new Error(result.error || "Failed to reactivate subscription.");
        }
      } catch (error) {
        console.error("Failed to reactivate membership:", error);
        setActionError(error.message || "Failed to reactivate membership.");
      } finally {
        setIsReactivating(false);
      }
    }
  };

  const getNextBillingDate = () => {
    const now = new Date();

    if (isTrialing && trialEndObj) {
      return trialEndObj;
    }

    const anchorDate = trialEndObj || startObj;

    if (!anchorDate || !isActive) return null;

    let nextDate = new Date(anchorDate);
    while (nextDate <= now) {
      if (interval === 'week') nextDate.setDate(nextDate.getDate() + 7);
      else if (interval === 'year') nextDate.setFullYear(nextDate.getFullYear() + 1);
      else nextDate.setMonth(nextDate.getMonth() + 1);
    }
    return nextDate;
  };

  const nextBillingDate = getNextBillingDate();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-gray-900">Membership & Billing</h3>
        {/* ✅ NEW: Debug button (only show in development) */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={handleRunDiagnostic}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
            title="Run permission diagnostic"
          >
            <Bug size={12} />
            Debug
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-gray-50">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Current Plan</span>
              <div className="text-lg font-bold text-gray-900 leading-tight">{displayPlanName || "No Plan"}</div>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusDisplay.color}`}>
              {statusDisplay.label}
            </div>
          </div>
          {liveMembership && (
            <div className="text-sm text-gray-500 font-medium">
              ${parseFloat(displayPrice || 0).toFixed(2)} / {interval}
            </div>
          )}
        </div>

        {/* Inactive Status Alert */}
        {statusDisplay.tooltip && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div className="text-xs text-red-900">
                <p className="font-bold mb-1">Access Disabled</p>
                <p>{statusDisplay.tooltip}</p>
              </div>
            </div>
          </div>
        )}

        {/* Past Due Payment Warning */}
        {isPastDue && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-red-900 font-bold mb-1">Payment Failed</p>
                <p className="text-xs text-red-700 mb-2">
                  Your last payment didn't go through. Please update your payment method to keep your membership active.
                </p>
                <button
                  onClick={handleManageBilling}
                  disabled={isOpeningPortal}
                  className="text-xs font-bold text-red-700 hover:text-red-900 underline flex items-center gap-1"
                >
                  {isOpeningPortal ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Opening...
                    </>
                  ) : (
                    'Update Payment Method →'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Error Message */}
        {actionError && (
          <div className="p-3 bg-red-50 border-b border-red-100">
            <p className="text-xs text-red-600">{actionError}</p>
          </div>
        )}

        {/* Dates Grid */}
        {liveMembership && (
          <div className="grid grid-cols-2 divide-x divide-gray-50 bg-gray-50/50">
            <div className="p-3 flex flex-col justify-center items-center text-center">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={12} className="text-blue-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Started</span>
              </div>
              <p className="text-xs font-semibold text-gray-700">
                {startObj ? startObj.toLocaleDateString('en-US', dateOpts) : 'N/A'}
              </p>
            </div>

            <div className="p-3 flex flex-col justify-center items-center text-center">
              <div className="flex items-center gap-1.5 mb-1">
                {isTrialing ? <Clock size={12} className="text-orange-500" /> : <RefreshCw size={12} className="text-green-500" />}
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  {isTrialing ? 'Trial Ends' : 'Renews'}
                </span>
              </div>
              <p className={`text-xs font-semibold ${isTrialing ? 'text-orange-600' : 'text-gray-700'}`}>
                {nextBillingDate
                  ? nextBillingDate.toLocaleDateString('en-US', dateOpts)
                  : '—'
                }
              </p>
            </div>
          </div>
        )}

        {/* Billing Action */}
        <button
          onClick={handleManageBilling}
          disabled={isOpeningPortal}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-t border-gray-100 group disabled:opacity-60 disabled:cursor-wait"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isActive || isTrialing ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' : 'bg-gray-100 text-gray-400'
              }`}>
              {isOpeningPortal ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">
                {isOpeningPortal ? 'Opening Billing Portal...' : 'Payment Method'}
              </p>
              <p className="text-xs text-gray-500">
                {isTrialing
                  ? 'Add card before trial ends'
                  : isActive && liveMembership?.stripeSubscriptionId
                    ? 'Update card or view invoices'
                    : isActive
                      ? 'View billing details'
                      : 'Add a payment method'
                }
              </p>
            </div>
          </div>
          {liveMembership?.stripeSubscriptionId ? (
            <ExternalLink size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
          ) : (
            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
          )}
        </button>

        {/* Portal Error Message */}
        {portalError && (
          <div className="px-4 py-3 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-600">{portalError}</p>
          </div>
        )}

        {/* Cancellation Section */}
        {cancelAtPeriodEnd ? (
          <div className="p-4 bg-yellow-50 border-t border-yellow-100">
            <p className="text-xs text-yellow-800 font-semibold text-center mb-3">
              Your membership is set to cancel and will not renew. Access ends after {nextBillingDate?.toLocaleDateString('en-US', dateOpts) || 'your billing cycle end date'}.
            </p>
            {liveMembership?.stripeSubscriptionId && (
              <button
                onClick={handleReactivate}
                disabled={isReactivating}
                className="w-full py-2.5 bg-yellow-600 text-white text-xs font-bold rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isReactivating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Reactivating...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Reactivate Membership
                  </>
                )}
              </button>
            )}
          </div>
        ) : (isActive || isTrialing) && (
          <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-center">
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 mx-auto"
            >
              {isCancelling ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle size={14} />
                  Cancel Membership
                </>
              )}
            </button>
          </div>
        )}

        {/* History Section */}
        {membershipHistory.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Recent History</h4>
            <div className="space-y-2">
              {membershipHistory.slice(0, 3).map(log => (
                <div key={log.id} className="text-xs text-gray-600">
                  <p className="font-medium">{log.description}</p>
                  <p className="text-gray-400 text-[10px]">
                    {log.createdAt ? new Date(log.createdAt.toDate()).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown Date'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};