import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Clock, User, Users, Calendar, Ban, Edit2,
    CheckCircle, Plus, Search, Check, Trash2
} from 'lucide-react';
import { getClassRoster, bookMember, checkInMember, getGymMembers, cancelBooking } from '../../../shared/api/firestore';

export const SessionDetailsModal = ({ isOpen, onClose, session, gymId, onEditSeries, onCancelSession, onRosterChange }) => {
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);

    // --- Search & Add State ---
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Local Cache for "Instant Search"
    const [allMembers, setAllMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [membersLoaded, setMembersLoaded] = useState(false);

    // HELPER: Get only active members for counts
    // We filter out 'cancelled' status for the UI count
    const activeRoster = useMemo(() => {
        return roster.filter(r => r.status !== 'cancelled');
    }, [roster]);

    // HELPER: Time Logic
    const isSessionPast = useMemo(() => {
        if (!session) return false;

        const now = new Date();

        // 1. Parse Class Time "09:30"
        const [hours, minutes] = session.time.split(':').map(Number);

        // 2. Parse Date String "2023-10-27" into local number parts
        const [year, month, day] = session.dateStr.split('-').map(Number);

        // 3. Create the Date object (Local Time)
        const sessionDateTime = new Date(year, month - 1, day);
        sessionDateTime.setHours(hours, minutes, 0, 0); // Sets Start Time

        // 4. Add duration to get End Time (e.g. 10:00 AM)
        // If class is 9am-10am, and it is 10:01am, this returns TRUE
        sessionDateTime.setMinutes(sessionDateTime.getMinutes() + session.duration);

        return now > sessionDateTime;
    }, [session]);

    useEffect(() => {
        if (isOpen && session) {
            refreshRoster();
            setCancelConfirm(false);
            setIsAdding(false);
            setSearchTerm("");
        }
    }, [isOpen, session, gymId]);

    // --- Fetch All Members Logic ---
    useEffect(() => {
        if (isAdding && !membersLoaded && !membersLoading) {
            const fetchAll = async () => {
                setMembersLoading(true);
                const res = await getGymMembers(gymId);
                if (res.success) {
                    setAllMembers(res.members);
                    setMembersLoaded(true);
                } else {
                    console.error("Error fetching members:", res.error);
                }
                setMembersLoading(false);
            };
            fetchAll();
        }
    }, [isAdding, membersLoaded, membersLoading, gymId]);

    // --- Filter Logic ---
    const searchResults = useMemo(() => {
        if (searchTerm.length < 1) return [];
        const lowerTerm = searchTerm.toLowerCase();

        return allMembers
            .filter(member => {
                const fullName = member.name || `${member.firstName || ''} ${member.lastName || ''}`;
                const nameMatches = fullName.toLowerCase().includes(lowerTerm);
                const emailMatches = member.email?.toLowerCase().includes(lowerTerm);

                // Only hide if they are currently ACTIVE in the roster
                const alreadyActive = activeRoster.some(r => r.memberId === member.id);

                return (nameMatches || emailMatches) && !alreadyActive;
            })
            .slice(0, 5);
    }, [searchTerm, allMembers, activeRoster]);


    const refreshRoster = async () => {
        setLoading(true);
        const res = await getClassRoster(gymId, session.classId, session.dateStr);
        if (res.success) setRoster(res.roster);
        setLoading(false);
    };

    // --- Actions ---

    const handleAddMember = async (member) => {
        // 1. SAFELY Calculate the name. 
        // We use (|| '') to ensure we don't get "undefined undefined"
        // We use .trim() to remove extra spaces if one name is missing.
        let finalName = member.name;

        if (!finalName) {
            const first = member.firstName || '';
            const last = member.lastName || '';
            finalName = `${first} ${last}`.trim();
        }

        // Fallback if absolutely no name data exists
        if (!finalName) finalName = "Unknown Member";

        const classInfo = {
            id: session.classId,
            name: session.className,
            instructorName: session.instructorName,
            dateString: session.dateStr,
            time: session.time
        };

        // 2. Pass this robust name to the payload
        const memberPayload = { ...member, name: finalName };

        const res = await bookMember(gymId, classInfo, memberPayload);

        if (res.success) {
            setRoster(prev => {
                const filtered = prev.filter(r => r.memberId !== member.id);
                return [...filtered, res.booking];
            });

            setSearchTerm("");
            if (onRosterChange) onRosterChange();
        } else {
            alert(res.error);
        }
    };

    const handleCheckIn = async (attendanceId, memberId) => {
        // 1. Optimistic Update
        setRoster(prev => prev.map(r =>
            r.id === attendanceId ? { ...r, status: 'attended' } : r
        ));

        console.log(session);
        // 2. API Call
        // PASS session.programId HERE as the 4th argument
        const res = await checkInMember(gymId, attendanceId, memberId, session.programId);

        // 3. Rollback if failed
        if (!res.success) {
            alert("Check-in failed: " + res.error);
            setRoster(prev => prev.map(r =>
                r.id === attendanceId ? { ...r, status: 'booked' } : r
            ));
        }
    };

    const handleRemoveMember = async (attendanceId) => {
        if (!window.confirm("Remove this member from the class?")) return;

        // Optimistic Update: Mark as cancelled locally
        setRoster(prev => prev.map(r =>
            r.id === attendanceId ? { ...r, status: 'cancelled' } : r
        ));

        // Call API
        const res = await cancelBooking(gymId, attendanceId);

        if (res.success) {
            if (onRosterChange) onRosterChange();
        } else {
            alert("Failed to cancel booking");
            refreshRoster(); // Revert
        }
    };

    const handleCancel = async () => {
        if (!cancelConfirm) {
            setCancelConfirm(true);
            return;
        }
        await onCancelSession(session.classId, session.dateStr, roster);
        onClose();
    };

    if (!isOpen || !session) return null;
    const isCancelled = session.isCancelled;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

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
                                {/* FIX: Parse manually to ensure Local Time interpretation */
                                    (() => {
                                        const [y, m, d] = session.dateStr.split('-').map(Number);
                                        // Note: Month is 0-indexed in JS Date
                                        const localDate = new Date(y, m - 1, d);
                                        return localDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                                    })()}
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
                                    {activeRoster.length} / {session.maxCapacity || '∞'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* --- ROSTER HEADER & ADD BUTTON --- */}
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-800 text-sm">Roster ({activeRoster.length})</h4>

                        {/* 1. Only show Add button if session is valid */}
                        {!isCancelled && !isSessionPast && (
                            <button
                                onClick={() => setIsAdding(!isAdding)}
                                // RESTORED CLASSNAME HERE
                                className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${isAdding ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                    }`}
                            >
                                {isAdding ? <X size={14} /> : <Plus size={14} />}
                                {isAdding ? 'Close' : 'Add Member'}
                            </button>
                        )}

                        {/* 2. Show badge if session passed */}
                        {isSessionPast && !isCancelled && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded border border-amber-200">
                                CLASS ENDED
                            </span>
                        )}
                    </div>

                    {/* --- ADD MEMBER SEARCH UI --- */}
                    {isAdding && (
                        <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in slide-in-from-top-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-blue-400 h-4 w-4" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={membersLoading ? "Loading members..." : "Search by name..."}
                                    disabled={membersLoading}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-blue-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                                />
                            </div>

                            {searchResults.length > 0 && (
                                <div className="mt-2 bg-white rounded-md border border-gray-200 shadow-sm max-h-40 overflow-y-auto">
                                    {searchResults.map(member => {
                                        const displayName = member.name || `${member.firstName || ''} ${member.lastName || ''}`;
                                        return (
                                            <button
                                                key={member.id}
                                                onClick={() => handleAddMember(member)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center group"
                                            >
                                                <span className="font-medium text-gray-700">{displayName}</span>
                                                <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {searchTerm.length > 0 && searchResults.length === 0 && !membersLoading && (
                                <p className="text-xs text-gray-400 mt-2 text-center">No matching members.</p>
                            )}
                        </div>
                    )}

                    {/* --- ROSTER LIST --- */}
                    <div>
                        {loading ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">Loading roster...</p>
                        ) : activeRoster.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <p className="text-sm text-gray-400">Class is empty.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {activeRoster.map(record => {
                                    const isAttended = record.status === 'attended';
                                    return (
                                        <li key={record.id} className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAttended ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
                                                    {record.memberName ? record.memberName.charAt(0) : '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{record.memberName}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold">{record.status}</p>
                                                </div>
                                            </div>

                                            {!isCancelled && (
                                                <div className="flex items-center gap-2">
                                                    {!isAttended ? (
                                                        <button
                                                            onClick={() => handleCheckIn(record.id, record.memberId)}
                                                            className="text-xs font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded shadow-sm hover:border-green-300 hover:text-green-600 flex items-center gap-1 transition-all"
                                                        >
                                                            <Check size={12} /> Check In
                                                        </button>
                                                    ) : (
                                                        <span className="text-green-500">
                                                            <CheckCircle size={18} />
                                                        </span>
                                                    )}

                                                    <button
                                                        onClick={() => handleRemoveMember(record.id)}
                                                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title="Remove from class"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <button onClick={() => onEditSeries(session.classId)} className="text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2">
                        <Edit2 size={16} /> Edit Series
                    </button>
                    {!isCancelled ? (
                        cancelConfirm ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-red-600 font-bold mr-2">Confirm cancel?</span>
                                <button onClick={() => setCancelConfirm(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-bold">No</button>
                                <button onClick={handleCancel} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700">Yes</button>
                            </div>
                        ) : (
                            <button onClick={handleCancel} className="text-sm text-red-600 hover:text-red-800 font-bold flex items-center gap-2">
                                <Ban size={16} /> Cancel Session
                            </button>
                        )
                    ) : (
                        <button onClick={() => onCancelSession(session.classId, session.dateStr, roster, true)} className="text-sm text-green-600 hover:text-green-800 font-bold flex items-center gap-2">
                            <CheckCircle size={16} /> Restore Session
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};