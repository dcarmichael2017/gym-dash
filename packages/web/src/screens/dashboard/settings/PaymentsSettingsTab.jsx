import React from 'react';
import { CreditCard } from 'lucide-react';

export const PaymentsSettingsTab = ({ stripeId }) => {
  return (
    <div className="text-center py-8">
        <div className="inline-flex h-16 w-16 bg-green-100 items-center justify-center rounded-full mb-4">
            <CreditCard className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-800">Stripe Connection</h3>
        
        {stripeId ? (
            <div className="mt-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ● Active & Connected
                </span>
                <p className="text-gray-500 text-sm mt-4">Account ID: <span className="font-mono">{stripeId}</span></p>
                <p className="text-xs text-gray-400 mt-2">To update banking details, visit your Stripe Dashboard.</p>
            </div>
        ) : (
            <div className="mt-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    ● Not Connected
                </span>
            </div>
        )}
    </div>
  );
};