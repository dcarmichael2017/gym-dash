import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Calendar } from 'lucide-react';

export const QuickActionsWidget = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Quick Actions</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Manage Schedule */}
            <button 
              onClick={() => navigate('/dashboard/schedule')}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
            >
              <div className="flex items-start gap-4">
                 <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-white group-hover:shadow-sm transition-all">
                    <Calendar size={20} />
                 </div>
                 <div>
                    <h4 className="font-medium text-gray-800">Manage Schedule</h4>
                    <p className="text-xs text-gray-500 mt-1">Add or edit your class times</p>
                 </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
            </button>

            {/* Manage Staff */}
            <button 
              onClick={() => navigate('/dashboard/staff')} 
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
            >
              <div className="flex items-start gap-4">
                 <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-white group-hover:shadow-sm transition-all">
                    <Briefcase size={20} />
                 </div>
                 <div>
                    <h4 className="font-medium text-gray-800">Manage Staff</h4>
                    <p className="text-xs text-gray-500 mt-1">Add instructors to your gym</p>
                 </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
            </button>

        </div>
      </div>
    </div>
  );
};