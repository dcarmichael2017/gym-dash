import React from 'react';
import { CreditCard, Edit2, Users, Trash2, Coins, Clock, UserCheck, Hourglass, CalendarRange } from 'lucide-react';

const RecurringPlansTab = ({ tiers, memberStats, onEdit, onViewMembers, onDelete, onAdd }) => {

  if (tiers.length === 0) {
    return (
      <div className="py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No recurring plans found.</p>
        <button onClick={onAdd} className="text-blue-600 text-sm hover:underline mt-1">Create your first plan</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tiers.map(tier => {
        const stats = memberStats[tier.id] || { active: 0, trialing: 0 };
        const hasLimit = tier.weeklyLimit && tier.weeklyLimit > 0;

        return (
          <div key={tier.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative group">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50 relative">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-xl text-gray-800">{tier.name}</h3>
              </div>
              <div className="flex items-baseline text-gray-900">
                <span className="text-3xl font-extrabold tracking-tight">
                  ${tier.price === 0 ? '0' : tier.price}
                </span>
                <span className="ml-1 text-sm font-medium text-gray-500">/{tier.interval}</span>
              </div>

              {/* Limits Badge */}
              <div className={`mt-3 inline-flex items-center text-xs font-bold px-2 py-1 rounded-md ${hasLimit ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                <CalendarRange size={12} className="mr-1.5" />
                {hasLimit ? `${tier.weeklyLimit} Classes / Week` : 'Unlimited Access'}
              </div>

              {tier.initiationFee > 0 && (
                <div className="flex items-center mt-2 text-xs font-medium text-gray-500">
                  <Coins className="h-3 w-3 mr-1 text-gray-400" /> + ${tier.initiationFee} Signup Fee
                </div>
              )}
              {tier.hasTrial && (
                <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center uppercase tracking-wide">
                  <Clock className="h-3 w-3 mr-1" /> {tier.trialDays} Day Trial
                </div>
              )}
            </div>

            {/* Stats & Body */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-green-50 border border-green-100 p-2 rounded-lg flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-green-700">{stats.active}</span>
                  <div className="flex items-center text-xs text-green-600 uppercase font-bold tracking-wide mt-1"><UserCheck className="h-3 w-3 mr-1" /> Active</div>
                </div>
                <div className="bg-orange-50 border border-orange-100 p-2 rounded-lg flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-orange-700">{stats.trialing}</span>
                  <div className="flex items-center text-xs text-orange-600 uppercase font-bold tracking-wide mt-1"><Hourglass className="h-3 w-3 mr-1" /> Trialing</div>
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                <button onClick={() => onEdit(tier)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center"><Edit2 className="h-4 w-4 mr-2" /> Edit</button>
                <button onClick={() => onViewMembers(tier)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Users className="h-5 w-5" /></button>
                <button onClick={() => onDelete(tier.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecurringPlansTab;