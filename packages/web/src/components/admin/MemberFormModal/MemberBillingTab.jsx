// src/features/members/components/MemberFormModal/MemberBillingTab.jsx
import React from 'react';
import { CreditCard, Link as LinkIcon, DollarSign, Tag } from 'lucide-react';

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
    
    // Find selected plan to show details
    const selectedPlan = tiers.find(t => t.id === formData.membershipId);
    
    // Logic: Only show "Trial" option if it's a NEW assignment (not just editing existing plan)
    const isSamePlan = memberData && memberData.membershipId === formData.membershipId;
    const showTrialOption = selectedPlan?.hasTrial && !isSamePlan;

    const handlePlanChange = (e) => {
        const newPlanId = e.target.value;
        const plan = tiers.find(t => t.id === newPlanId);
        
        setFormData(prev => ({ ...prev, membershipId: newPlanId }));
        
        // Auto-fill price if plan selected, otherwise clear custom price
        if (plan) {
            setCustomPrice(plan.price);
        } else {
            setCustomPrice('');
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            
            {/* Dependent Warning */}
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

            {/* Plan Selector */}
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

            {/* Payment Details (Conditional) */}
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