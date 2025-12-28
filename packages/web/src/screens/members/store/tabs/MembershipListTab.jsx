import React from 'react';
import { Check, Shield, AlertCircle, Sparkles } from 'lucide-react';

const MembershipListTab = ({ tiers, theme }) => {
  const handleSelectPlan = (tier) => {
    alert(`Redirecting to checkout for: ${tier.name} ($${tier.price})`);
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {tiers.map((tier) => (
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
              className="w-full py-3 rounded-xl font-bold text-white shadow-sm transition-transform active:scale-95 mt-auto"
              style={{ backgroundColor: theme.primaryColor }}
           >
              {tier.hasTrial ? 'Start Free Trial' : 'Select Plan'}
           </button>
        </div>
      ))}
    </div>
  );
};

export default MembershipListTab;