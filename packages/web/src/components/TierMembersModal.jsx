import React from 'react';
import { X, User, CheckCircle2, Clock, XCircle } from 'lucide-react';

export const TierMembersModal = ({ isOpen, onClose, tierName, members }) => {
  if (!isOpen) return null;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="flex items-center text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</span>;
      case 'trialing':
        return <span className="flex items-center text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full"><Clock className="w-3 h-3 mr-1"/> Trial</span>;
      case 'past_due':
        return <span className="flex items-center text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full"><XCircle className="w-3 h-3 mr-1"/> Past Due</span>;
      default:
        return <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Inactive</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-gray-800">{tierName}</h3>
            <p className="text-xs text-gray-500">{members.length} member{members.length !== 1 && 's'} assigned</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-0">
          {members.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold mr-3 overflow-hidden border border-blue-100">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (member.firstName?.[0] || 'U')
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{member.firstName} {member.lastName}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(member.subscriptionStatus || member.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <User className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No members in this plan yet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Close
            </button>
        </div>
      </div>
    </div>
  );
};