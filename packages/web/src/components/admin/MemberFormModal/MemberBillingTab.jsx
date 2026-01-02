import React, { useState, useEffect } from 'react';
import { CreditCard, Link as LinkIcon, DollarSign, Tag, Coins, Plus, Minus, History, Save, X, ArrowRight } from 'lucide-react';
import { auth } from '../../../../../shared/api/firebaseConfig';
import { adjustUserCredits, getUserCreditHistory } from '../../../../../shared/api/firestore';
import { useConfirm } from '../../../context/ConfirmationContext'; // Adjust path as needed

export const MemberBillingTab = ({
    formData,
    setFormData,
    customPrice,
    setCustomPrice,
    skipTrial,
    setSkipTrial,
    tiers,
    memberData
}) => {
    // --- Contexts & Derived State ---
    const { confirm } = useConfirm();
    const selectedPlan = tiers.find(t => t.id === formData.membershipId);
    const isSamePlan = memberData && memberData.membershipId === formData.membershipId;
    const showTrialOption = selectedPlan?.hasTrial && !isSamePlan;

    // --- Credits State ---
    const [showCreditHistory, setShowCreditHistory] = useState(false);
    const [creditHistory, setCreditHistory] = useState([]);
    
    // Logic: We track "pendingChange" separate from the actual current credits
    const [pendingChange, setPendingChange] = useState(0); 
    const [adjustReason, setAdjustReason] = useState('');
    const [loadingCredits, setLoadingCredits] = useState(false);
    
    // We use a local state for display to update UI immediately after save, 
    // even if memberData prop hasn't refreshed from the server yet.
    const [displayCredits, setDisplayCredits] = useState(memberData?.classCredits || 0);

    // Sync local display if prop updates from outside
    useEffect(() => {
        if (memberData?.classCredits !== undefined) {
            setDisplayCredits(memberData.classCredits);
        }
    }, [memberData?.classCredits]);

    // --- Fetch History ---
    const loadHistory = async () => {
        if (memberData?.id) {
            const res = await getUserCreditHistory(memberData.id);
            if (res.success) setCreditHistory(res.logs);
        }
    };

    useEffect(() => {
        if (showCreditHistory) loadHistory();
    }, [showCreditHistory, memberData?.id]);

    // --- Handlers ---

    const handlePlanChange = (e) => {
        const newPlanId = e.target.value;
        const plan = tiers.find(t => t.id === newPlanId);
        setFormData(prev => ({ ...prev, membershipId: newPlanId }));
        if (plan) setCustomPrice(plan.price);
        else setCustomPrice('');
    };

    const handleSaveCredits = async () => {
        if (!memberData?.id || pendingChange === 0) return;

        // 1. Trigger Confirmation Modal
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

        // 2. Execute API Call
        setLoadingCredits(true);
        const adminId = auth.currentUser?.uid || 'admin';
        const defaultReason = pendingChange > 0 ? 'Admin added credits' : 'Admin deducted credits';
        const reason = adjustReason.trim() || defaultReason;

        const result = await adjustUserCredits(memberData.id, pendingChange, reason, adminId);

        if (result.success) {
            // Update local state visuals
            setDisplayCredits(finalBalance);
            setPendingChange(0);
            setAdjustReason('');
            
            // Refresh history if visible
            if (showCreditHistory) loadHistory();
        } else {
            // Fallback to alert for API errors (rare)
            window.alert(`Error: ${result.error}`);
        }
        setLoadingCredits(false);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">

            {/* --- SECTION 1: CLASS CREDITS MANAGEMENT --- */}
            {memberData && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Header */}
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
                            {/* Deduct Button */}
                            <button 
                                type="button"
                                onClick={() => setPendingChange(prev => prev - 1)}
                                className="w-12 h-12 rounded-full bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 flex items-center justify-center transition-colors active:scale-95"
                            >
                                <Minus size={24} />
                            </button>

                            {/* Center Display */}
                            <div className="flex flex-col items-center min-w-[100px]">
                                <span className="text-4xl font-black text-gray-900 leading-none">
                                    {displayCredits}
                                </span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                                    Current Balance
                                </span>
                            </div>

                            {/* Add Button */}
                            <button 
                                type="button"
                                onClick={() => setPendingChange(prev => prev + 1)}
                                className="w-12 h-12 rounded-full bg-gray-100 hover:bg-green-50 text-gray-600 hover:text-green-600 flex items-center justify-center transition-colors active:scale-95"
                            >
                                <Plus size={24} />
                            </button>
                        </div>

                        {/* Pending Changes Area (Visible only when changed) */}
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
                                    <button 
                                        type="button" 
                                        onClick={() => { setPendingChange(0); setAdjustReason(''); }}
                                        className="text-xs text-gray-500 hover:text-gray-800 underline"
                                    >
                                        Cancel
                                    </button>
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

                        {/* TRANSACTION LOG */}
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
                                                    <span className="font-semibold text-gray-700">{log.description || log.type}</span>
                                                    <span className="text-[10px] text-gray-400">
                                                        {log.date ? log.date.toLocaleDateString() + ' ' + log.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown Date'}
                                                    </span>
                                                </div>
                                                <div className={`font-mono font-bold px-2 py-1 rounded ${
                                                    log.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
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
            )}

            {/* --- SECTION 2: MEMBERSHIP PLANS (Existing) --- */}
            {memberData?.payerId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <LinkIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-blue-900">Dependent Profile</p>
                            <p className="text-xs text-blue-700">
                                Billing is managed by the Head of Household.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Membership Plan</label>
                <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <select
                        value={formData.membershipId}
                        onChange={handlePlanChange}
                        className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- No Membership --</option>
                        {tiers.map(tier => (
                            <option key={tier.id} value={tier.id}>{tier.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {formData.membershipId && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700">Payment Details</h4>
                        {selectedPlan && (
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                                Standard: ${selectedPlan.price}/{selectedPlan.interval}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Custom Rate ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                                <input
                                    type="number"
                                    value={customPrice}
                                    onChange={e => setCustomPrice(e.target.value)}
                                    className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Discount Code</label>
                            <div className="relative opacity-60">
                                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    disabled
                                    placeholder="SUMMER20"
                                    className="w-full pl-9 p-2.5 border border-gray-200 bg-gray-100 rounded-lg cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status Preview */}
                    {formData.membershipId && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700">Subscription Status</h4>
                                    <p className="text-xs text-gray-500">
                                        {memberData?.status === 'prospect' && isSamePlan
                                            ? "System will upgrade this user to ACTIVE on save."
                                            : "Determined by plan selection."}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide 
                                    ${(skipTrial || !showTrialOption) ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {(skipTrial || !showTrialOption) ? 'Active' : 'Trialing'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trial Checkbox */}
                    {showTrialOption && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="skipTrial"
                                    checked={skipTrial}
                                    onChange={e => setSkipTrial(e.target.checked)}
                                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <div>
                                    <label htmlFor="skipTrial" className="block text-sm font-bold text-blue-800 cursor-pointer">
                                        Skip {selectedPlan.trialDays}-Day Free Trial?
                                    </label>
                                    <p className="text-xs text-blue-600 mt-0.5">
                                        {skipTrial
                                            ? "Member will be marked ACTIVE immediately. Billing starts today."
                                            : "Member will be marked TRIALING. Billing starts automatically when trial ends."
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};