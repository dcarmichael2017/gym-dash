import React from 'react';

const MemberScheduleScreen = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Schedule</h1>
      
      {/* Fake Feed */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-gray-800">BJJ All Levels</h3>
                    <p className="text-sm text-gray-500">6:00 PM - 7:30 PM</p>
                    <p className="text-xs text-blue-600 font-medium mt-1">Instr. Prof. Dave</p>
                </div>
                <button className="bg-gray-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold">
                    Book
                </button>
            </div>
        ))}
      </div>
    </div>
  );
};

export default MemberScheduleScreen;