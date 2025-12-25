import React from 'react';
import { LogOut } from 'lucide-react';
import { auth } from '../../../../shared/api/firebaseConfig.js';

const MemberHomeScreen = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
           <p className="text-gray-500">Ready to train today?</p>
        </div>
        <button onClick={() => auth.signOut()} className="text-sm text-red-600 font-medium flex items-center gap-1">
           <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Placeholder Widgets */}
      <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
         <h2 className="text-lg font-bold mb-1">Next Class</h2>
         <p className="opacity-90">Today, 6:00 PM • BJJ Fundamentals</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-gray-800">12</div>
            <div className="text-xs text-gray-500">Classes this month</div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-gray-800">White</div>
            <div className="text-xs text-gray-500">Current Rank</div>
         </div>
      </div>
    </div>
  );
};

export default MemberHomeScreen;