import React, { useMemo } from 'react';
import { User, Check, Trash2, CheckCircle, List, Plus, Search } from 'lucide-react';
import { BOOKING_STATUS } from '../../../../../shared/constants/strings';

export const SessionRoster = ({
    roster,
    isAdding,
    setIsAdding,
    searchTerm,
    setSearchTerm,
    searchResults,
    membersLoading,
    onAddMember,
    onCheckIn,
    onRemove,
    isSessionCancelled
}) => {

    const { activeMembers, waitlistedMembers } = useMemo(() => {
        const active = [];
        const waitlist = [];
        roster.forEach(r => {
            if (r.status === BOOKING_STATUS.CANCELLED) return;
            if (r.status === BOOKING_STATUS.WAITLISTED) waitlist.push(r);
            else active.push(r);
        });

        waitlist.sort((a, b) => {
            const dateA = a.bookedAt?.seconds || a.createdAt?.seconds || 0;
            const dateB = b.bookedAt?.seconds || b.createdAt?.seconds || 0;
            return dateA - dateB;
        });

        return { activeMembers: active, waitlistedMembers: waitlist };
    }, [roster]);

    const renderRow = (record, isWaitlist = false, rank = null) => {
        const isAttended = record.status === BOOKING_STATUS.ATTENDED;

        const displayName = record.memberName || `${record.firstName} ${record.lastName}`;
        const initial = displayName ? displayName.charAt(0) : '?';
        return (
            <li key={record.id} className={`flex items-center justify-between p-2.5 rounded-lg transition-colors border group ${isWaitlist ? 'bg-orange-50 border-orange-100' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isWaitlist ? 'bg-orange-200 text-orange-800' : (isAttended ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600')}`}>
                        {isWaitlist ? `#${rank}` : initial}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-800">{displayName}</p>
                        <div className="flex gap-2">
                            <p className="text-[10px] text-gray-400 uppercase font-bold">{record.status}</p>
                            {record.bookingType === 'drop-in' && <span className="text-[10px] text-purple-600 font-bold bg-purple-100 px-1 rounded">DROP-IN</span>}
                        </div>
                    </div>
                </div>
                {!isSessionCancelled && (
                    <div className="flex items-center gap-2">
                        {!isWaitlist && !isAttended && (
                            <button onClick={() => onCheckIn(record.id, record.memberId)} className="text-xs font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded shadow-sm hover:border-green-300 hover:text-green-600 flex items-center gap-1">
                                <Check size={12} /> Check In
                            </button>
                        )}
                        {isAttended && <span className="text-green-500"><CheckCircle size={18} /></span>}
                        <button onClick={() => onRemove(record.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded" title="Remove">
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </li>
        );
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-800 text-sm">Roster ({activeMembers.length})</h4>
                {!isSessionCancelled && (
                    <button onClick={() => setIsAdding(!isAdding)} className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${isAdding ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}>
                        {isAdding ? <User size={14} /> : <Plus size={14} />}
                        {isAdding ? 'Close' : 'Add Member'}
                    </button>
                )}
            </div>

            {/* SEARCH UI */}
            {isAdding && (
                <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in slide-in-from-top-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-blue-400 h-4 w-4" />
                        <input autoFocus type="text" placeholder={membersLoading ? "Loading..." : "Search by name..."} disabled={membersLoading} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-blue-200 rounded-md text-sm outline-none" />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-white rounded-md border border-gray-200 shadow-sm max-h-40 overflow-y-auto">
                            {searchResults.map(member => (
                                <button key={member.id} onClick={() => onAddMember(member)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center group">
                                    <span className="font-medium text-gray-700">{member.name || `${member.firstName} ${member.lastName}`}</span>
                                    <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* LISTS */}
            <div className="mt-4">
                {activeMembers.length > 0 && <ul className="space-y-2 mb-4">{activeMembers.map(r => renderRow(r, false))}</ul>}

                {waitlistedMembers.length > 0 && (
                    <div className="border-t border-gray-100 pt-3">
                        <h5 className="text-xs font-bold text-orange-600 uppercase mb-2 flex items-center gap-1"><List size={12} /> Waitlist</h5>
                        <ul className="space-y-2">{waitlistedMembers.map((r, i) => renderRow(r, true, i + 1))}</ul>
                    </div>
                )}

                {activeMembers.length === 0 && waitlistedMembers.length === 0 && (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200"><p className="text-sm text-gray-400">Class is empty.</p></div>
                )}
            </div>
        </div>
    );
};