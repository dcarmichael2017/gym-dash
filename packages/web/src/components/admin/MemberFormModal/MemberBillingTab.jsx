import React, { useState, useEffect } from 'react';
import { CreditCard, Link as LinkIcon, DollarSign, Tag, Coins, Plus, Minus, History, Save, X, ArrowRight, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { auth } from '../../../../../shared/api/firebaseConfig';
import { adjustUserCredits, getUserCreditHistory } from '../../../../../shared/api/firestore';
import { useConfirm } from '../../../context/ConfirmationContext'; 

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
    const { confirm } = useConfirm();
    
    // --- Current State Analysis ---
    const selectedPlan = tiers.find(t => t.id === formData.membershipId);
    const isSamePlan = memberData && memberData.membershipId === formData.membershipId;
    const showTrialOption = selectedPlan?.hasTrial && !isSamePlan;

    // Determine effective price for display/logic
    // If user is editing price, show that. If blank/new plan, show plan default.
    const displayPrice = customPrice !== '' ? customPrice : (selectedPlan?.price || '');

    // --- Credits State (Existing) ---
    const [showCreditHistory, setShowCreditHistory] = useState(false);
    const [creditHistory, setCreditHistory] = useState([]);
    const [pendingChange, setPendingChange] = useState(0); 
    const [adjustReason, setAdjustReason] = useState('');
    const [loadingCredits, setLoadingCredits] = useState(false);
    const [displayCredits, setDisplayCredits] = useState(memberData?.classCredits || 0);

    useEffect(() => {
        if (memberData?.classCredits !== undefined) {
            setDisplayCredits(memberData.classCredits);
        }
    }, [memberData?.classCredits]);

    const loadHistory = async () => {
        if (memberData?.id) {
            const res = await getUserCreditHistory(memberData.id);
            if (res.success) setCreditHistory(res.logs);
        }
    };

    useEffect(() => {
        if (showCreditHistory) loadHistory();
    }, [showCreditHistory, memberData?.id]);

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
        
        // Auto-fill price if picking a new plan
        if (plan) setCustomPrice(plan.price);
        else setCustomPrice('');
    };

    // --- DATE FORMATTER ---
    const formatDate = (dateVal) => {
        if (!dateVal) return 'N/A';
        const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // ... [Credit Handlers remain the same] ...
    const handleSaveCredits = async () => {
        // ... (Keep existing implementation) ...
        if (!memberData?.id || pendingChange === 0) return;
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
        const result = await adjustUserCredits(memberData.id, pendingChange, reason, adminId);
        if (result.success) {
            setDisplayCredits(finalBalance);
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

            {/* --- 1. CURRENT SUBSCRIPTION SNAPSHOT (NEW) --- */}
            {memberData?.membershipId && (
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Current Active Plan</p>
                            <h3 className="text-2xl font-bold">{memberData.membershipName || 'Unknown Plan'}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-medium text-white/90">
                                    ${memberData.price}/{memberData.interval || 'mo'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                    memberData.status === 'active' ? 'bg-green-500 text-white' : 
                                    memberData.status === 'trialing' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                    {memberData.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                <Calendar size={10} /> Started
                            </p>
                            <p className="text-sm font-medium">{formatDate(memberData.startDate)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                {memberData.status === 'trialing' ? <RefreshCw size={10} /> : <RefreshCw size={10} />} 
                                {memberData.status === 'trialing' ? 'Trial Ends' : 'Renews'}
                            </p>
                            <p className="text-sm font-medium">
                                {memberData.status === 'trialing' 
                                    ? formatDate(memberData.trialEndDate) 
                                    : 'Auto-Renew' // Or calculate next billing date if needed
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 2. EDIT SUBSCRIPTION FORM --- */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">
                        {memberData?.membershipId ? 'Modify Subscription' : 'Assign Membership'}
                    </label>
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
                                            value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                                            onChange={(e) => setFormData({...formData, startDate: new Date(e.target.value)})}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Trial Logic Visualization */}
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-900">
                                            {(skipTrial || !showTrialOption) ? 'Immediate Activation' : 'Start with Free Trial'}
                                        </h4>
                                        <p className="text-xs text-blue-700 mt-0.5">
                                            {(skipTrial || !showTrialOption) 
                                                ? `Billing will start on ${new Date().toLocaleDateString()}.`
                                                : `${selectedPlan.trialDays}-day trial. Billing starts ${new Date(Date.now() + (selectedPlan.trialDays * 86400000)).toLocaleDateString()}.`
                                            }
                                        </p>
                                    </div>
                                    {showTrialOption && (
                                        <div className="flex items-center gap-2">
                                            <label htmlFor="skipTrial" className="text-xs font-bold text-blue-800 cursor-pointer">Skip Trial</label>
                                            <input
                                                type="checkbox"
                                                id="skipTrial"
                                                checked={skipTrial}
                                                onChange={e => setSkipTrial(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
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
                                                <span className="font-semibold text-gray-700">{log.description || log.type}</span>
                                                <span className="text-[10px] text-gray-400">
                                                    {log.date ? new Date(log.date.toDate()).toLocaleString([], {dateStyle:'short', timeStyle:'short'}) : 'Unknown Date'}
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
        </div>
    );
};