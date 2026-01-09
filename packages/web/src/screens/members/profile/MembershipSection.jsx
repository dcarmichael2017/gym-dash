import React from 'react';
import { CreditCard, ChevronRight, Calendar, DollarSign } from 'lucide-react';

export const MembershipSection = ({ membership, onManageBilling }) => {
  const { planName, status, startDate, price, billingRate } = membership || {};
  const isActive = status?.toLowerCase() === 'active';

  const getStatusDisplay = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return { label: 'Active', color: 'text-green-600 bg-green-50 border-green-200' };
      case 'past_due':
        return { label: 'Past Due', color: 'text-red-600 bg-red-50 border-red-200' };
      case 'trialing':
        return { label: 'Trialing', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'cancelled':
      case 'expired':
        return { label: 'Inactive', color: 'text-gray-600 bg-gray-100 border-gray-200' };
      default:
        return { label: 'No Plan', color: 'text-gray-600 bg-gray-100 border-gray-200' };
    }
  };

  const statusDisplay = getStatusDisplay(status);

  const formattedDate = startDate?.toDate ? startDate.toDate().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 px-1">Membership & Billing</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Plan Info */}
        <div className="p-4">
          <div className="flex justify-between items-start pb-4">
            <div>
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">
                Current Plan
              </span>
              <div className="text-lg font-bold text-gray-900">{planName || "No Active Plan"}</div>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusDisplay.color}`}>
              {statusDisplay.label}
            </div>
          </div>
          
          {membership && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm">
                    <DollarSign size={14} className="text-gray-400 shrink-0" />
                    <div>
                        <p className="text-xs text-gray-500">Price</p>
                        <p className="font-medium text-gray-800">${price?.toFixed(2) || '0.00'} / {billingRate || 'month'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <div>
                        <p className="text-xs text-gray-500">Member Since</p>
                        <p className="font-medium text-gray-800">{formattedDate || 'N/A'}</p>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Billing Action */}
        <button 
          onClick={onManageBilling}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-t border-gray-100"
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
