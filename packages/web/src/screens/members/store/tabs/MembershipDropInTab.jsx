import React from 'react';
import { Check, Ticket, AlertCircle } from 'lucide-react';

const MembershipDropInTab = ({ tiers, theme }) => {
  const handleSelectPlan = (tier) => {
    alert(`Redirecting to checkout for: ${tier.name} ($${tier.price})`);
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
                    <span className="text-sm text-gray-400 font-medium"> one-time</span>
                 </div>
              </div>
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
              className="w-full py-3 rounded-xl font-bold text-white shadow-sm transition-transform active:scale-95 mt-auto"
              style={{ backgroundColor: theme.primaryColor }}
           >
              Buy Pack
           </button>
        </div>
      ))}
    </div>
  );
};

export default MembershipDropInTab;