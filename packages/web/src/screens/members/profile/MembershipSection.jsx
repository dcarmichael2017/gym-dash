import React from 'react';
import { CreditCard, ChevronRight } from 'lucide-react';

export const MembershipSection = ({ planName, status, onManageBilling }) => {
  const isActive = status?.toLowerCase() === 'active';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 px-1">Membership & Billing</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Plan Info */}
        <div className="p-4 border-b border-gray-50">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">
            Current Plan
          </span>
          <div className="text-lg font-bold text-gray-900">{planName || "No Active Plan"}</div>
          {isActive && (
            <div className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
              • Active Subscription
            </div>
          )}
        </div>

        {/* Billing Action */}
        <button 
          onClick={onManageBilling}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
            }`}>
              <CreditCard size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">Payment Method</p>
              <p className="text-xs text-gray-500">
                {isActive ? 'Manage Card & Invoices' : 'Add Payment Method'}
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
};