import React from 'react';

const MemberProfileScreen = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
         <div className="p-4 flex justify-between">
            <span className="text-gray-600">Name</span>
            <span className="font-medium">John Doe</span>
         </div>
         <div className="p-4 flex justify-between">
            <span className="text-gray-600">Email</span>
            <span className="font-medium">john@example.com</span>
         </div>
         <div className="p-4 flex justify-between">
            <span className="text-gray-600">Plan</span>
            <span className="font-medium text-green-600">Unlimited Monthly</span>
         </div>
      </div>
    </div>
  );
};

export default MemberProfileScreen;