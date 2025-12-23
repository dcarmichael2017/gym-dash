import React from 'react';
import { X, Calendar, Clock } from 'lucide-react';

export const SessionHeader = ({ session, onClose }) => {
    const formattedDate = (() => {
        if (!session?.dateStr) return '';
        const [y, m, d] = session.dateStr.split('-').map(Number);
        const localDate = new Date(y, m - 1, d);
        return localDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    })();

    const isCancelled = session?.isCancelled;

    return (
        <div className={`p-6 border-b border-gray-100 ${isCancelled ? 'bg-red-50' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className={`font-bold text-xl ${isCancelled ? 'text-red-800 line-through' : 'text-gray-900'}`}>
                        {session?.className || 'Class Details'}
                    </h3>
                    {isCancelled && <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Cancelled</span>}
                    
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                        <Calendar size={14} />
                        {formattedDate}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-0.5">
                        <Clock size={14} />
                        {session?.time} ({session?.duration} min)
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};