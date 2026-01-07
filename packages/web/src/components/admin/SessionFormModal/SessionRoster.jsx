import React, { useMemo } from 'react';
import { User, Check, Trash2, CheckCircle, List, Plus, Search, AlertTriangle, Clock, History } from 'lucide-react';
import { BOOKING_STATUS } from '../../../../../shared/constants/strings';
import { useConfirm } from '../../../context/ConfirmationContext.jsx';

export const SessionRoster = ({
    roster,
    gymId,
    isAdding,
    setIsAdding,
    searchTerm,
    setSearchTerm,
    searchResults,
    membersLoading,
    onAddMember,
    onCheckIn,
    onRemove,
    isSessionCancelled,
    classData
}) => {

    const { confirm } = useConfirm();

    // --- CHECK IF CLASS IS IN THE PAST ---
    const isClassOver = useMemo(() => {
        const dateStr = classData?.dateString || classData?.dateStr;
        const timeStr = classData?.time;

        if (!dateStr || !timeStr) return false;

        try {
            const [h, m] = timeStr.split(':').map(Number);
            const [Y, M, D] = dateStr.split('-').map(Number);
            
            const classStartObj = new Date(Y, M - 1, D, h, m);
            const duration = parseInt(classData.duration) || 60;
            const cutoffTime = new Date(classStartObj.getTime() + duration * 60000);
            const now = new Date();
            
            return now > cutoffTime;
        } catch (e) {
            console.error("Error in class over check:", e);
            return false;
        }
    }, [classData]);

    const handleAdminRemove = async (record) => {
        const now = new Date();
        const startTime = record.classTimestamp?.toDate ? record.classTimestamp.toDate() : new Date(record.classTimestamp);
        const duration = parseInt(classData.duration) || 60;
        const endTime = new Date(startTime.getTime() + duration * 60000);

        // Determine Time Context Message
        let timeMessage = "";
        let isFuture = false;

        if (now < startTime) {
            isFuture = true;
            const diff = Math.ceil((startTime - now) / 60000);
            timeMessage = `Class starts in ${diff} min${diff !== 1 ? 's' : ''}`;
        } else if (now >= startTime && now <= endTime) {
            const diff = Math.ceil((endTime - now) / 60000);
            timeMessage = `Class is Live (Ends in ${diff} min${diff !== 1 ? 's' : ''})`;
        } else {
            const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            timeMessage = `Class was on ${dateStr} at ${timeStr}`;
        }

        const minutesUntilStart = Math.floor((startTime - now) / 60000);
        const windowLimit = classData?.cancellationWindow ? parseInt(classData.cancellationWindow) : 120;
        const isLateCancel = minutesUntilStart < windowLimit;
        
        const isWaitlisted = record.status === BOOKING_STATUS.WAITLISTED;
        const costUsed = record.costUsed || 0;
        const paidWithCredit = costUsed > 0;

        let refundPolicy = null;

        // --- SCENARIO A: WAITLIST REMOVAL ---
        if (isWaitlisted) {
            const ok = await confirm({
                title: "Remove from Waitlist?",
                message: `${record.memberName} is on the waitlist.`,
                confirmText: "Remove Member"
            });
            // ✅ FIX: Stop execution if clicked outside
            if (ok === null) return; 
            if (!ok) return;
            refundPolicy = 'refund'; 
        }

        // --- SCENARIO B: PAID WITH CREDIT ---
        else if (paidWithCredit) {
            if (isLateCancel) {
                const title = isFuture ? "Late Cancellation" : "Retroactive Removal";
                
                const proceed = await confirm({
                    title: title,
                    message: `${timeMessage}. Remove ${record.memberName}?`,
                    confirmText: "Yes, Remove",
                    cancelText: "No, Keep Member",
                    type: 'danger'
                });

                // ✅ FIX: Stop execution if clicked outside
                if (proceed === null) return; 
                if (!proceed) return;

                const shouldRefund = await confirm({
                    title: "Credit Policy",
                    message: `User spent ${costUsed} credit(s). Refund or Forfeit?`,
                    confirmText: "Refund Credit",
                    cancelText: "Forfeit Credit",
                    type: 'warning'
                });

                // ✅ FIX: Stop execution if clicked outside (don't forfeit accidentally)
                if (shouldRefund === null) return;

                refundPolicy = shouldRefund ? 'refund' : 'forfeit';

            } else {
                const ok = await confirm({
                    title: "Remove Member?",
                    message: (
                        <div>
                            <p>Remove <strong>{record.memberName}</strong> from class?</p>
                            <p className="text-xs text-gray-500 mb-2">{timeMessage}</p>
                            <p className="mt-2 text-sm text-green-600 font-bold flex items-center gap-1">
                                <CheckCircle size={14} /> Safe Window: Credit will be refunded.
                            </p>
                        </div>
                    ),
                    confirmText: "Remove & Refund"
                });
                
                // ✅ FIX: Stop execution if clicked outside
                if (ok === null) return;
                if (!ok) return;
                refundPolicy = 'refund';
            }
        }

        // --- SCENARIO C: MEMBERSHIP / COMP ---
        else {
            const ok = await confirm({
                title: "Remove Member?",
                message: (
                    <div>
                        <p>Remove <strong>{record.memberName}</strong>?</p>
                        <p className="text-xs text-gray-500 mb-2">{timeMessage}</p>
                        <p className="mt-2 text-xs text-gray-500">
                            Booked via Membership/Comp. No credits will be refunded.
                        </p>
                    </div>
                ),
                confirmText: "Yes, Remove"
            });
            
            // ✅ FIX: Stop execution if clicked outside
            if (ok === null) return;
            if (!ok) return;
            refundPolicy = 'refund'; 
        }

        onRemove(record.id, refundPolicy);
    };

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

    const renderRow = (record, isWaitlistRow = false, rank = null) => {
        const isAttended = record.status === BOOKING_STATUS.ATTENDED;
        const displayName = record.memberName || `${record.firstName} ${record.lastName}`;
        const initial = displayName ? displayName.charAt(0) : '?';
        const isDropIn = record.bookingType === 'credit' || record.bookingType === 'drop-in';

        return (
            <li key={record.id} className={`flex items-center justify-between p-2.5 rounded-lg transition-colors border group ${isWaitlistRow ? 'bg-orange-50 border-orange-100' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isWaitlistRow ? 'bg-orange-200 text-orange-800' : (isAttended ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600')}`}>
                        {isWaitlistRow ? `#${rank}` : initial}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-800">{displayName}</p>
                        <div className="flex gap-2 items-center">
                            <p className="text-[10px] text-gray-400 uppercase font-bold">{record.status}</p>
                            {isDropIn && (
                                <span className="text-[10px] text-purple-600 font-bold bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200">
                                    CREDIT
                                </span>
                            )}
                            {record.bookingType === 'comp' && (
                                <span className="text-[10px] text-gray-600 font-bold bg-gray-200 px-1.5 py-0.5 rounded border border-gray-300">
                                    COMP
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {!isSessionCancelled && (
                    <div className="flex items-center gap-2">
                        {!isWaitlistRow && !isAttended && (
                            <button onClick={() => onCheckIn(record.id, record.memberId)} className="text-xs font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded shadow-sm hover:border-green-300 hover:text-green-600 flex items-center gap-1">
                                <Check size={12} /> Check In
                            </button>
                        )}
                        {isAttended && <span className="text-green-500"><CheckCircle size={18} /></span>}
                        <button
                            onClick={() => handleAdminRemove(record)}
                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"
                            title="Remove"
                        >
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
                    <>
                        {!isClassOver && (
                            <button onClick={() => setIsAdding(!isAdding)} className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${isAdding ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}>
                                {isAdding ? <User size={14} /> : <Plus size={14} />}
                                {isAdding ? 'Close' : 'Add Member'}
                            </button>
                        )}
                        {isClassOver && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1.5 rounded flex items-center gap-1">
                                    <Clock size={12} /> Ended
                                </span>
                                <button 
                                    onClick={() => setIsAdding(!isAdding)} 
                                    className={`text-[10px] font-bold border border-orange-200 text-orange-700 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-orange-50 transition-all ${isAdding ? 'bg-orange-100 ring-2 ring-orange-200' : ''}`}
                                >
                                    <History size={12} /> 
                                    {isAdding ? 'Close' : 'Adjust Roster'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {isAdding && (
                <div className={`mb-4 p-3 rounded-lg border animate-in slide-in-from-top-2 ${isClassOver ? 'bg-orange-50/50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                    {isClassOver && (
                        <div className="flex items-start gap-2 mb-2 pb-2 border-b border-orange-200/50">
                            <AlertTriangle size={14} className="text-orange-500 mt-0.5" />
                            <p className="text-xs text-orange-800 leading-tight">
                                <strong>Retroactive Adjustment:</strong> You are editing a past class. 
                                Members added now will be charged immediately if applicable.
                            </p>
                        </div>
                    )}
                    <div className="relative">
                        <Search className={`absolute left-3 top-2.5 h-4 w-4 ${isClassOver ? 'text-orange-400' : 'text-blue-400'}`} />
                        <input 
                            autoFocus 
                            type="text" 
                            placeholder={membersLoading ? "Loading..." : "Search by name..."} 
                            disabled={membersLoading} 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className={`w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none ${isClassOver ? 'border-orange-200 focus:ring-orange-200' : 'border-blue-200'}`} 
                        />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-white rounded-md border border-gray-200 shadow-sm max-h-60 overflow-y-auto z-10">
                            {searchResults.map(member => {
                                const activeMembership = (member.memberships || []).find(m => 
                                    m.gymId === gymId && ['active', 'trialing'].includes(m.status)
                                );
                                const displayLabel = activeMembership ? (activeMembership.membershipName || 'Active Member') : 'Free Member';
                                const credits = parseInt(member.classCredits) || 0;

                                return (
                                    <button key={member.id} onClick={() => onAddMember(member)} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex justify-between items-center group border-b border-gray-50 last:border-0">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-700">{member.name || `${member.firstName} ${member.lastName}`}</span>
                                                <span className={`text-xs ${activeMembership ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>({displayLabel})</span>
                                            </div>
                                            <span className="text-xs text-gray-500 mt-0.5"><span className={credits > 0 ? "text-green-600 font-bold" : "text-gray-400"}>{credits} Credit{credits !== 1 ? 's' : ''}</span> available</span>
                                        </div>
                                        <div className="bg-white rounded-full p-1 text-blue-500 opacity-0 group-hover:opacity-100 shadow-sm border border-blue-100 transition-all"><Plus size={14} /></div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

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