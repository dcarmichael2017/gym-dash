import React from 'react';
import { Ticket, Edit2, Trash2 } from 'lucide-react';

const ClassPacksTab = ({ tiers, onEdit, onDelete, onAdd }) => {
  
  if (tiers.length === 0) {
    return (
      <div className="py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No class packs found.</p>
        <button onClick={onAdd} className="text-blue-600 text-sm hover:underline mt-1">Create your first pack</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tiers.map(tier => (
        <div key={tier.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative group">
             {/* Header */}
             <div className="p-6 border-b border-gray-100 bg-gray-50 relative">
                 <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-xl text-gray-800">{tier.name}</h3>
                 </div>
                 <div className="flex items-baseline text-gray-900">
                   <span className="text-3xl font-extrabold tracking-tight">${tier.price}</span>
                   <span className="ml-1 text-sm font-medium text-gray-500"> one-time</span>
                 </div>
                 {tier.credits > 0 && (
                    <div className="absolute top-4 right-4 bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-full flex items-center uppercase tracking-wide">
                        <Ticket className="h-3 w-3 mr-1" /> {tier.credits} Credits
                    </div>
                 )}
             </div>

             {/* Body */}
             <div className="p-6 flex-1 flex flex-col">
                <div className="flex-1 mb-6">
                    <p className="text-gray-600 text-sm line-clamp-3">
                        {tier.description || "No description provided."}
                    </p>
                    {tier.validityDays && (
                        <p className="text-xs text-gray-400 mt-2">Expires {tier.validityDays} days after purchase.</p>
                    )}
                </div>

                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                  <button onClick={() => onEdit(tier)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center"><Edit2 className="h-4 w-4 mr-2" /> Edit</button>
                  <button onClick={() => onDelete(tier.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-5 w-5" /></button>
                </div>
             </div>
        </div>
      ))}
    </div>
  );
};

export default ClassPacksTab;