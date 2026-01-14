import React, { useState, useEffect } from 'react';
import { CreditCard, ChevronRight, Calendar, DollarSign, RefreshCw, Clock, XCircle } from 'lucide-react';
import { useConfirm } from '../../../context/ConfirmationContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { getMembershipTiers, cancelUserMembership, getMembershipHistory, logMembershipHistory } from '../../../../../shared/api/firestore';
import { auth, db } from '../../../../../shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';

export const MembershipSection = ({ membership, onManageBilling }) => {
  const { confirm } = useConfirm();
  const [isCancelling, setIsCancelling] = useState(false);
  const [liveMembership, setLiveMembership] = useState(membership);
  const [tiers, setTiers] = useState([]);
  const { currentGym } = useGym();
  const [membershipHistory, setMembershipHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    const user = auth.currentUser;
    if (user && currentGym?.id) {
        setLoadingHistory(true);
        const res = await getMembershipHistory(user.uid, currentGym.id);
        if (res.success) {
            setMembershipHistory(res.history);
        }
        setLoadingHistory(false);
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
      fetchHistory();
    }
  }, [currentGym?.id]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !currentGym?.id) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentGymMembership = (userData.memberships || []).find(m => m.gymId === currentGym.id);
        setLiveMembership(currentGymMembership);
      } else {
        setLiveMembership(null);
      }
    });

    return () => unsub();
  }, [currentGym?.id]);

  const { 
    planName, 
    status, 
    startDate, 
    trialEndDate, // ✅ Receive trial end date
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

  const getStatusDisplay = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return { label: 'Active', color: 'text-green-700 bg-green-50 border-green-200' };
      case 'trialing': return { label: 'Free Trial', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      case 'past_due': return { label: 'Past Due', color: 'text-red-700 bg-red-50 border-red-200' };
      default: return { label: 'Inactive', color: 'text-gray-500 bg-gray-50 border-gray-200' };
    }
  };

  const statusDisplay = getStatusDisplay(status);
  const dateOpts = { year: 'numeric', month: 'short', day: 'numeric' };

  // Helper to parse dates
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
        try {
            const user = auth.currentUser;
            if (!user || !currentGym?.id) throw new Error("User or gym not found.");

            const result = await cancelUserMembership(user.uid, currentGym.id);
            if (result.success) {
                await logMembershipHistory(user.uid, currentGym.id, 'Member scheduled cancellation.', user.uid);
                fetchHistory();
            } else {
                throw new Error(result.error || "Failed to schedule cancellation.");
            }
        } catch (error) {
            console.error("Failed to cancel membership:", error);
        } finally {
            setIsCancelling(false);
        }
    }
  };

  // --- Logic: Determine the next billing date ---
  const getNextBillingDate = () => {
    const now = new Date();
    
    // 1. If currently in trial, the next billing date IS the trial end date
    if (isTrialing && trialEndObj) {
        return trialEndObj;
    }

    // 2. If active, calculate next cycle based on start date
    // (If the user converted from a trial, the 'startDate' should theoretically update to the trial end date, 
    // or you calculate cycles relative to trialEndObj if it exists)
    const anchorDate = trialEndObj || startObj; 
    
    if (!anchorDate || !isActive) return null;

    let nextDate = new Date(anchorDate);
    // Loop until we find a date in the future
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
      <h3 className="text-sm font-bold text-gray-900 px-1">Membership & Billing</h3>
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
          onClick={onManageBilling}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-t border-gray-100 group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isActive || isTrialing ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' : 'bg-gray-100 text-gray-400'
            }`}>
              <CreditCard size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Payment Method</p>
              <p className="text-xs text-gray-500">
                {isTrialing 
                    ? 'Add card before trial ends' 
                    : isActive 
                        ? 'Update card or view invoices' 
                        : 'Add a payment method'
                }
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
        </button>

        {/* Cancellation Section */}
        {cancelAtPeriodEnd ? (
            <div className="p-4 bg-yellow-50 border-t border-yellow-100 text-center">
                <p className="text-xs text-yellow-800 font-semibold">
                    Your membership is set to cancel and will not renew. Access ends after {nextBillingDate?.toLocaleDateString('en-US', dateOpts) || 'your billing cycle end date'}.
                </p>
            </div>
        ) : (isActive || isTrialing) && (
             <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-center">
                 <button 
                     onClick={handleCancel} 
                     disabled={isCancelling}
                     className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 mx-auto"
                 >
                     <XCircle size={14} />
                     {isCancelling ? 'Cancelling...' : 'Cancel Membership'}
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
                                {log.createdAt ? new Date(log.createdAt.toDate()).toLocaleString([], {dateStyle:'short', timeStyle:'short'}) : 'Unknown Date'}
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
