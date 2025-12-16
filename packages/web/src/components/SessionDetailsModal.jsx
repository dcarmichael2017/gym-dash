import React, { useState, useEffect } from 'react';
import { X, Clock, User, Users, Calendar, AlertTriangle, Ban, Edit2, CheckCircle } from 'lucide-react';
import { getClassRoster, updateClass } from '../../../shared/api/firestore';

export const SessionDetailsModal = ({ isOpen, onClose, session, gymId, onEditSeries, onCancelSession }) => {
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);

    useEffect(() => {
        if (isOpen && session) {
            // Fetch roster for this specific date
            // Note: You need to implement getClassRoster to filter by date string
            const fetchRoster = async () => {
                setLoading(true);
                const res = await getClassRoster(gymId, session.classId, session.dateStr);
                if (res.success) setRoster(res.roster);
                setLoading(false);
            };
            fetchRoster();
            setCancelConfirm(false);
        }
    }, [isOpen, session, gymId]);

    if (!isOpen || !session) return null;

    const handleCancel = async () => {
        if (!cancelConfirm) {
            setCancelConfirm(true);
            return;
        }
        
        // Execute Cancellation
        await onCancelSession(session.classId, session.dateStr, roster); 
        // Note: onCancelSession passed from parent handles the API call and notifications logic
        onClose();
    };

    const isCancelled = session.isCancelled;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className={`p-6 border-b border-gray-100 ${isCancelled ? 'bg-red-50' : 'bg-white'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className={`font-bold text-xl ${isCancelled ? 'text-red-800 line-through' : 'text-gray-900'}`}>
                                {session.className}
                            </h3>
                            {isCancelled && <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Cancelled</span>}
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                <Calendar size={14} />
                                {new Date(session.dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-0.5">
                                <Clock size={14} />
                                {session.time} ({session.duration} min)
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <span className="block text-xs font-bold text-gray-400 uppercase">Instructor</span>
                            <div className="flex items-center gap-2 mt-1">
                                <User size={16} className="text-gray-500" />
                                <span className="font-medium text-gray-800">{session.instructorName || 'None'}</span>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <span className="block text-xs font-bold text-gray-400 uppercase">Capacity</span>
                            <div className="flex items-center gap-2 mt-1">
                                <Users size={16} className="text-gray-500" />
                                <span className="font-medium text-gray-800">
                                    {roster.length} / {session.maxCapacity || '∞'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Roster Preview */}
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm mb-3">Registered Members ({roster.length})</h4>
                        {loading ? (
                            <p className="text-sm text-gray-400 italic">Loading roster...</p>
                        ) : roster.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No one registered yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {roster.map(member => (
                                    <li key={member.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                            {member.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{member.name}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <button 
                        onClick={() => onEditSeries(session.classId)}
                        className="text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2"
                    >
                        <Edit2 size={16} /> Edit Series
                    </button>

                    {!isCancelled ? (
                        cancelConfirm ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-red-600 font-bold mr-2">
                                    {roster.length > 0 ? `Notify ${roster.length} users?` : "Are you sure?"}
                                </span>
                                <button 
                                    onClick={() => setCancelConfirm(false)}
                                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                                >
                                    No
                                </button>
                                <button 
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                                >
                                    Yes, Cancel
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={handleCancel}
                                className="text-sm text-red-600 hover:text-red-800 font-bold flex items-center gap-2"
                            >
                                <Ban size={16} /> Cancel Session
                            </button>
                        )
                    ) : (
                         <button 
                            onClick={() => onCancelSession(session.classId, session.dateStr, roster, true)} // Restore
                            className="text-sm text-green-600 hover:text-green-800 font-bold flex items-center gap-2"
                        >
                            <CheckCircle size={16} /> Restore Session
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};