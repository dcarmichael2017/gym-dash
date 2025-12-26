import React from 'react';
import { FileText, CheckCircle, RefreshCw } from 'lucide-react';

export const LegalSection = ({ hasWaiver, isOutdated, version, onOpenWaiver }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900 px-1">Legal Documents</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button 
          onClick={onOpenWaiver} 
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              hasWaiver && !isOutdated ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
            }`}>
              {isOutdated ? <RefreshCw size={18} /> : <FileText size={18} />}
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900 block">Liability Waiver</span>
              <span className="text-xs text-gray-500">Gym Terms & Conditions</span>
            </div>
          </div>

          {hasWaiver && !isOutdated ? (
            <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
              <CheckCircle size={14} /> v{version}
            </div>
          ) : (
            <div className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100 animate-pulse">
              Sign Now
            </div>
          )}
        </button>
      </div>
    </div>
  );
};