
import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, Pencil, DollarSign, Tag, Coins, Plus, Minus, History, Save, X, ArrowRight, Calendar, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../../../../../shared/api/firebaseConfig';
import { adjustUserCredits, getUserCreditHistory, adminCancelUserMembership, cancelUserMembership, logMembershipHistory, getMembershipHistory } from '../../../../../shared/api/firestore';
import { useConfirm } from '../../../context/ConfirmationContext';
import { useGym } from '../../../context/GymContext'; // ✅ NEW: Import useGym hook

export const MemberBillingTab = ({
    formData,
    setFormData,
    customPrice,
    setCustomPrice,
    trialOverrideDays,
    setTrialOverrideDays,
    tiers,
    memberData,
    gymId
}) => {
    const { confirm } = useConfirm();
    const [liveUserData, setLiveUserData] = useState(null);
    const [currentMembership, setCurrentMembership] = useState(null); // ✅ Separate state
    const [isEditing, setIsEditing] = useState(false);

    // --- Real-time Data Listener ---
    useEffect(() => {
        if (!memberData?.id) return;
        const unsub = onSnapshot(doc(db, 'users', memberData.id), (doc) => {
            setLiveUserData({ id: doc.id, ...doc.data() });
        });
        return () => unsub();
    }, [memberData?.id]);

    useEffect(() => {
        if (!memberData?.id || !gymId) return;

        const membershipRef = doc(db, 'users', memberData.id, 'memberships', gymId);
        const unsub = onSnapshot(membershipRef, (snap) => {
            if (snap.exists()) {
                setCurrentMembership({ id: snap.id, ...snap.data() });
            } else {
                setCurrentMembership(null);
            }
        }, (error) => {
            console.error("Error fetching membership:", error);
            setCurrentMembership(null);
        });

        return () => unsub();
    }, [memberData?.id, gymId]);

    const displayUser = liveUserData || memberData;
    const hasMembership = !!(currentMembership && currentMembership.membershipId);
    const currentTier = hasMembership ? tiers.find(t => t.id === currentMembership.membershipId) : null;
    const displayPlanName = currentMembership?.membershipName || currentTier?.name;
    const userPrice = currentMembership?.price;

    // --- Current State Analysis ---
    const selectedPlan = tiers.find(t => t.id === formData.membershipId);
    const isSamePlan = currentMembership && currentMembership.membershipId === formData.membershipId;
    const showTrialOption = selectedPlan?.hasTrial && (!isSamePlan || currentMembership?.status === 'trialing');

    const displayPrice = customPrice !== '' ? customPrice : (selectedPlan?.price || '');

    const remainingTrialDays = useMemo(() => {
        if (currentMembership?.status !== 'trialing' || !currentMembership.trialEndDate) {
            return null;
        }
        const trialEnd = currentMembership.trialEndDate.toDate ? currentMembership.trialEndDate.toDate() : new Date(currentMembership.trialEndDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (trialEnd < today) return 0;

        const diffTime = trialEnd.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }, [currentMembership]);

    useEffect(() => {
        if (isEditing) {
            if (currentMembership?.status === 'trialing' && remainingTrialDays !== null) {
                setTrialOverrideDays(String(remainingTrialDays));
            } else if (selectedPlan?.hasTrial) {
                setTrialOverrideDays(String(selectedPlan.trialDays || 0));
            } else {
                setTrialOverrideDays('0');
            }
        }
    }, [isEditing, selectedPlan, currentMembership, remainingTrialDays, setTrialOverrideDays]);

    // --- Credits State ---
    const [showCreditHistory, setShowCreditHistory] = useState(false);
    const [creditHistory, setCreditHistory] = useState([]);
    const [pendingChange, setPendingChange] = useState(0);
    const [adjustReason, setAdjustReason] = useState('');
    const [loadingCredits, setLoadingCredits] = useState(false);
    const [displayCredits, setDisplayCredits] = useState(0); // ✅ CHANGE: Initialize to 0

    // --- Membership History State ---
    const [showMembershipHistory, setShowMembershipHistory] = useState(false);
    const [membershipHistory, setMembershipHistory] = useState([]);
    const [loadingMembershipHistory, setLoadingMembershipHistory] = useState(false);
    const [debugInfo, setDebugInfo] = useState(null);

    // ✅ CHANGE: Listen to gym-specific credits from subcollection
    useEffect(() => {
        if (!memberData?.id || !gymId) return;

        const creditRef = doc(db, 'users', memberData.id, 'credits', gymId);
        const unsub = onSnapshot(creditRef, (snap) => {
            if (snap.exists()) {
                setDisplayCredits(snap.data().balance || 0);
            } else {
                setDisplayCredits(0);
            }
        }, (error) => {
            console.error("Error fetching credits:", error);
            setDisplayCredits(0);
        });

        return () => unsub();
    }, [memberData?.id, gymId]);

    // ✅ CHANGE: Load gym-specific credit history
    const loadHistory = async () => {
        if (displayUser?.id && gymId) {
            const res = await getUserCreditHistory(displayUser.id, gymId);
            if (res.success) setCreditHistory(res.logs);
        }
    };

    useEffect(() => {
        const loadMembershipHistory = async () => {
            if (!showMembershipHistory || !displayUser?.id || !gymId) {
                setMembershipHistory([]);
                return;
            }

            setLoadingMembershipHistory(true);

            try {
                const result = await getMembershipHistory(displayUser.id, gymId);

                if (result.success) {
                    setMembershipHistory(result.history);
                } else {
                    console.error('[MemberBillingTab] Error fetching membership history:', result.error);
                    setMembershipHistory([]);
                }
            } catch (error) {
                console.error('[MemberBillingTab] Exception while fetching membership history:', error);
                setMembershipHistory([]);
            } finally {
                setLoadingMembershipHistory(false);
            }
        };

        loadMembershipHistory();
    }, [showMembershipHistory, displayUser?.id, gymId]);

    useEffect(() => {
        if (showCreditHistory) loadHistory();
    }, [showCreditHistory, displayUser?.id, gymId]); // ✅ CHANGE: Added gymId dependency

    const handleEditClick = () => {
        if (!currentMembership) return;
        const priceToEdit = currentMembership.assignedPrice ?? currentMembership.price;
        setCustomPrice(priceToEdit !== undefined ? String(priceToEdit) : '');
        const currentTier = tiers.find(t => t.id === currentMembership.membershipId);
        setFormData(prev => ({
            ...prev,
            membershipId: currentMembership.membershipId,
            planName: currentMembership.planName || currentTier?.name,
            startDate: currentMembership.startDate,
        }));
        setIsEditing(true);
    };

    const handleAdminCancel = async (immediate) => {
        const adminId = auth.currentUser?.uid;
        if (immediate) {
            const isConfirmed = await confirm({
                title: 'Cancel Membership Immediately?',
                message: `This will immediately revoke the member's plan and set their status to inactive. This action cannot be undone.`,
                confirmText: "Yes, Cancel Immediately",
                type: 'danger'
            });
            if (!isConfirmed) return;

            if (displayUser?.id && currentMembership?.gymId) {
                const result = await adminCancelUserMembership(displayUser.id, currentMembership.gymId);
                if (result.success) {
                    await logMembershipHistory(displayUser.id, currentMembership.gymId, 'Membership cancelled immediately by admin.', adminId);
                    setIsEditing(false);
                } else {
                    alert(`Error: ${result.error}`);
                }
            }
        } else {
            const isConfirmed = await confirm({
                title: 'Cancel at End of Period?',
                message: `The member's plan will remain active until the end of the current billing period, then it will not renew.`,
                confirmText: "Yes, Schedule Cancellation",
                type: 'confirm'
            });
            if (!isConfirmed) return;

            if (displayUser?.id && currentMembership?.gymId) {
                const result = await cancelUserMembership(displayUser.id, currentMembership.gymId);
                if (result.success) {
                    await logMembershipHistory(displayUser.id, currentMembership.gymId, 'Membership scheduled to cancel at end of period by admin.', adminId);
                    setIsEditing(false);
                } else {
                    alert(`Error: ${result.error}`);
                }
            }
        }
    };

    const handlePlanChange = (e) => {
        const newPlanId = e.target.value;
        const plan = tiers.find(t => t.id === newPlanId);
        const isNewAssignment = memberData?.membershipId !== newPlanId;

        setFormData(prev => ({
            ...prev,
            membershipId: newPlanId,
            planName: plan ? plan.name : null,
            startDate: isNewAssignment ? new Date() : (prev.startDate || memberData?.startDate),
        }));

        if (plan) setCustomPrice(plan.price);
        else setCustomPrice('');
    };

    const formatDate = (dateVal) => {
        if (!dateVal) return 'N/A';
        const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // ✅ CHANGE: Adjust gym-specific credits
    const handleSaveCredits = async () => {
        if (!memberData?.id || !gymId || pendingChange === 0) return;
        const finalBalance = displayCredits + pendingChange;
        const actionType = pendingChange > 0 ? "Add" : "Deduct";
        const isDanger = pendingChange < 0;
        const isConfirmed = await confirm({
            title: `${actionType} Credits?`,
            message: `You are about to ${actionType.toLowerCase()} ${Math.abs(pendingChange)} credit(s).\nNew Balance: ${finalBalance}`,
            confirmText: "Yes, Update Balance",
            type: isDanger ? 'danger' : 'confirm'
        });
        if (!isConfirmed) return;
        setLoadingCredits(true);
        const adminId = auth.currentUser?.uid || 'admin';
        const defaultReason = pendingChange > 0 ? 'Admin added credits' : 'Admin deducted credits';
        const reason = adjustReason.trim() || defaultReason;
        const result = await adjustUserCredits(displayUser.id, gymId, pendingChange, reason, adminId);
        if (result.success) {
            setPendingChange(0);
            setAdjustReason('');
            if (showCreditHistory) loadHistory();
        } else {
            window.alert(`Error: ${result.error}`);
        }
        setLoadingCredits(false);
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-200">

            {/* --- 1. CURRENT SUBSCRIPTION SNAPSHOT --- */}
            {hasMembership && !isEditing && (
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>

                    <button onClick={handleEditClick} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors z-20">
                        <Pencil size={16} />
                    </button>

                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Current Active Plan</p>
                            <h3 className="text-2xl font-bold">{displayPlanName || 'Unknown Plan'}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-medium text-white/90">
                                    ${parseFloat(userPrice || 0).toFixed(2)}/{currentMembership.interval || 'mo'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${currentMembership.status === 'active' ? 'bg-green-500 text-white' :
                                    currentMembership.status === 'trialing' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                                    }`}>
                                    {currentMembership.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                <Calendar size={10} /> Started
                            </p>
                            <p className="text-sm font-medium">{formatDate(currentMembership.startDate)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                {currentMembership.status === 'trialing' ? <RefreshCw size={10} /> : <RefreshCw size={10} />}
                                {currentMembership.status === 'trialing' ? 'Trial Ends' : 'Renews'}
                            </p>
                            <p className="text-sm font-medium">
                                {currentMembership.status === 'trialing'
                                    ? formatDate(currentMembership.trialEndDate)
                                    : 'Auto-Renew' // Or calculate next billing date if needed
                                }
                            </p>
                        </div>
                    </div>
                    {currentMembership.cancelAtPeriodEnd && (
                        <div className="relative z-10 border-t border-white/10 mt-4 pt-4">
                            <p className="text-xs font-semibold text-yellow-300 text-center">
                                This membership is scheduled to cancel and will not renew.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* --- 2. EDIT SUBSCRIPTION FORM --- */}
            {(isEditing || !hasMembership) && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase">
                            {hasMembership ? 'Modify Subscription' : 'Assign Membership'}
                        </label>
                        {hasMembership && isEditing && (
                            <button type="button" onClick={() => setIsEditing(false)} className="text-xs font-medium text-gray-500 hover:text-gray-800 underline">
                                Cancel Edit
                            </button>
                        )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <select
                                    value={formData.membershipId}
                                    onChange={handlePlanChange}
                                    className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                >
                                    <option value="">-- No Membership --</option>
                                    {tiers.map(tier => (
                                        <option key={tier.id} value={tier.id}>{tier.name} — ${tier.price}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {formData.membershipId && (
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Billing Rate</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-gray-500 font-bold">$</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={customPrice}
                                                onChange={e => setCustomPrice(e.target.value)}
                                                className="w-full pl-7 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900"
                                                placeholder={selectedPlan?.price || "0.00"}
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <span className="text-gray-400 text-xs">/{selectedPlan?.interval || 'mo'}</span>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Leave blank to use default (${selectedPlan?.price})
                                        </p>
                                    </div>

                                    {/* Start Date Override (Optional Power Feature) */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Start Date</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={formData.startDate ? (() => {
                                                    const d = formData.startDate.toDate ? formData.startDate.toDate() : new Date(formData.startDate);
                                                    return d.toISOString().split('T')[0];
                                                })() : ''}
                                                onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Trial Override Input */}
                                {showTrialOption && (
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Trial Days</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={trialOverrideDays}
                                                    onChange={e => setTrialOverrideDays(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900"
                                                    placeholder={selectedPlan?.trialDays || "0"}
                                                />
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400 text-xs">days</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                Set to 0 for immediate activation.
                                            </p>
                                        </div>
                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 h-full flex flex-col justify-center">
                                            <h4 className="text-sm font-bold text-blue-900">
                                                {Number(trialOverrideDays) > 0 ? 'Starts with Free Trial' : 'Immediate Activation'}
                                            </h4>
                                            <p className="text-xs text-blue-700 mt-0.5">
                                                {Number(trialOverrideDays) > 0
                                                    ? `Billing starts ${new Date(Date.now() + (Number(trialOverrideDays) * 86400000)).toLocaleDateString()}.`
                                                    : `Billing will start on ${new Date().toLocaleDateString()}.`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Admin Cancellation Action */}
                        {hasMembership && isEditing && (
                            <div className="p-4 bg-red-50 border-t border-red-200">
                                <label className="block text-xs font-semibold text-red-900 uppercase mb-2 text-center">Cancel Membership</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleAdminCancel(false)}
                                        className="w-full text-center p-2 rounded-lg text-xs font-bold transition-colors bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                    >
                                        Cancel at End of Period
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAdminCancel(true)}
                                        className="w-full text-center p-2 rounded-lg text-xs font-bold transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                                    >
                                        Cancel Immediately
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- MEMBERSHIP HISTORY --- */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2 text-gray-800 font-bold">
                        <History size={18} className="text-blue-500" />
                        <span>Membership History</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowMembershipHistory(!showMembershipHistory)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                        {showMembershipHistory ? 'Hide History' : 'View History'}
                    </button>
                </div>

                {showMembershipHistory && (
                    <div className="p-4 animate-in fade-in">
                        <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                            {loadingMembershipHistory ? (
                                <p className="text-xs text-gray-400 italic text-center">Loading...</p>
                            ) : membershipHistory.length === 0 ? (
                                <p className="text-xs text-gray-400 italic p-2 text-center bg-gray-50 rounded">No history found.</p>
                            ) : (
                                membershipHistory.map((log) => (
                                    <div key={log.id} className="text-xs p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="font-semibold text-gray-800">{log.description}</p>
                                        <span className="text-[10px] text-gray-500">
                                            {log.createdAt ? new Date(log.createdAt.toDate()).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown Date'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* --- 3. CREDITS MANAGEMENT (Existing Code) --- */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2 text-gray-800 font-bold">
                        <Coins size={18} className="text-orange-500" />
                        <span>Class Credits</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCreditHistory(!showCreditHistory)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                        <History size={14} /> {showCreditHistory ? 'Hide History' : 'View History'}
                    </button>
                </div>

                <div className="p-6">
                    {/* Stepper Control Row */}
                    <div className="flex items-center justify-center gap-6 select-none">
                        <button
                            type="button"
                            onClick={() => setPendingChange(prev => prev - 1)}
                            className="w-12 h-12 rounded-full bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 flex items-center justify-center transition-colors active:scale-95"
                        >
                            <Minus size={24} />
                        </button>

                        <div className="flex flex-col items-center min-w-[100px]">
                            <span className="text-4xl font-black text-gray-900 leading-none">
                                {displayCredits}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                                Current Balance
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setPendingChange(prev => prev + 1)}
                            className="w-12 h-12 rounded-full bg-gray-100 hover:bg-green-50 text-gray-600 hover:text-green-600 flex items-center justify-center transition-colors active:scale-95"
                        >
                            <Plus size={24} />
                        </button>
                    </div>

                    {/* Pending Changes Area */}
                    {pendingChange !== 0 && (
                        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`text-sm font-bold px-2 py-0.5 rounded ${pendingChange > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {pendingChange > 0 ? '+' : ''}{pendingChange}
                                    </div>
                                    <ArrowRight size={16} className="text-gray-400" />
                                    <span className="text-sm font-bold text-gray-900">
                                        New Balance: {displayCredits + pendingChange}
                                    </span>
                                </div>
                                <button type="button" onClick={() => { setPendingChange(0); setAdjustReason(''); }} className="text-xs text-gray-500 hover:text-gray-800 underline">Cancel</button>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Reason (e.g., 'Refund for missed class')"
                                    value={adjustReason}
                                    onChange={(e) => setAdjustReason(e.target.value)}
                                    className="flex-1 text-sm p-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveCredits}
                                    disabled={loadingCredits}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {loadingCredits ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Transaction Log */}
                    {showCreditHistory && (
                        <div className="mt-6 pt-4 border-t border-gray-100 animate-in fade-in">
                            <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">Transaction Log</h5>
                            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                {creditHistory.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic p-2 text-center bg-gray-50 rounded">No history found.</p>
                                ) : (
                                    creditHistory.map((log) => (
                                        <div key={log.id} className="group flex justify-between items-center text-xs p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold text-gray-700">{log.reason || log.description || log.type}</span>
                                                <span className="text-[10px] text-gray-400">
                                                    {log.date ? new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown Date'}
                                                </span>
                                            </div>
                                            <div className={`font-mono font-bold px-2 py-1 rounded ${log.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                                }`}>
                                                {log.amount > 0 ? '+' : ''}{log.amount}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
