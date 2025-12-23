import React from 'react';
import { User, Users } from 'lucide-react';

export const SessionStats = ({ session, activeCount, waitlistCount, liveCapacity }) => {
    const isFull = activeCount >= liveCapacity;
    const capacityText = liveCapacity === 0 || liveCapacity === 999 ? '∞' : liveCapacity;

    return (
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="block text-xs font-bold text-gray-400 uppercase">Instructor</span>
                <div className="flex items-center gap-2 mt-1">
                    <User size={16} className="text-gray-500" />
                    <span className="font-medium text-gray-800">{session?.instructorName || 'None'}</span>
                </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="block text-xs font-bold text-gray-400 uppercase">Capacity</span>
                <div className="flex items-center gap-2 mt-1">
                    <Users size={16} className="text-gray-500" />
                    <span className={`font-medium ${isFull ? 'text-red-600' : 'text-gray-800'}`}>
                        {activeCount} / {capacityText}
                    </span>
                    {waitlistCount > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold ml-auto">
                            +{waitlistCount} Waitlist
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};