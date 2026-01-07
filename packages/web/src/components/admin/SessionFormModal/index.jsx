import React, { useState, useEffect } from 'react';
import { Edit2, Ban, CheckCircle, List, AlertCircle, Loader2 } from 'lucide-react';
import { useConfirm } from '../../../context/ConfirmationContext.jsx';
import { getClassRoster, bookMember, checkInMember, getGymMembers, cancelBooking, processWaitlist, getClassDetails, checkBookingEligibility } from '../../../../../shared/api/firestore';
import { BOOKING_STATUS } from '../../../../../shared/constants/strings';

import { SessionHeader } from './SessionHeader';
import { SessionStats } from './SessionStats';
import { WaitlistBanner } from './WaitlistBanner';
import { SessionRoster } from './SessionRoster';

export const SessionDetailsModal = ({ isOpen, onClose, session, gymId, onEditSeries, onCancelSession, onRosterChange }) => {
    const dialog = useConfirm();

    const [roster, setRoster] = useState([]);
    const [liveCapacity, setLiveCapacity] = useState(session?.maxCapacity || 20);

    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [allMembers, setAllMembers] = useState([]);
    const [membersLoaded, setMembersLoaded] = useState(false);
    const [membersLoading, setMembersLoading] = useState(false);

    const [fetchedClassData, setFetchedClassData] = useState(null);

    const refreshRoster = async () => {
        setLoading(true);
        try {
            const [rosterRes, classRes] = await Promise.all([
                getClassRoster(gymId, session.classId, session.dateStr),
                getClassDetails(gymId, session.classId)
            ]);

            if (rosterRes.success) setRoster(rosterRes.roster);

            if (classRes.success && classRes.data) {
                setFetchedClassData(classRes.data);
                const cap = parseInt(classRes.data.maxCapacity);
                setLiveCapacity(isNaN(cap) ? 20 : cap);
            } else {
                setLiveCapacity(session?.maxCapacity || 20);
            }
        } catch (err) {
            console.error("Failed to refresh session", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen && session) {
            refreshRoster();
            setIsAdding(false);
            setSearchTerm("");
        }
    }, [isOpen, session]);

    useEffect(() => {
        if (isAdding && !membersLoaded && !membersLoading) {
            const loadMembers = async () => {
                setMembersLoading(true);
                const res = await getGymMembers(gymId);
                if (res.success) {
                    setAllMembers(res.members);
                    setMembersLoaded(true);
                }
                setMembersLoading(false);
            };
            loadMembers();
        }
    }, [isAdding, membersLoaded, membersLoading, gymId]);

    const updateLocalMemberCredits = (memberId, adjustment) => {
        setAllMembers(prevMembers =>
            prevMembers.map(m => {
                if (m.id === memberId) {
                    const current = parseInt(m.classCredits) || 0;
                    return { ...m, classCredits: Math.max(0, current + adjustment) };
                }
                return m;
            })
        );
    };

    const renderUsageBar = (used, limit) => {
        if (!limit || limit <= 0) return null;
        const percentage = Math.min((used / limit) * 100, 100);
        const isCapped = used >= limit;

        return (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs uppercase font-bold text-gray-600 flex items-center gap-1">
                        <List size={10} /> Weekly Progress
                    </span>
                    <span className={`text-xs font-bold ${isCapped ? 'text-orange-600' : 'text-blue-600'}`}>
                        {used} / {limit}
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${isCapped ? 'bg-orange-500' : 'bg-blue-600'}`}
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
                {isCapped && (
                    <p className="text-[10px] text-orange-600 mt-2 font-medium">
                        Member has reached their weekly limit.
                    </p>
                )}
            </div>
        );
    };

    const handleAddMember = async (member) => {
        let finalName = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || "Unknown Member";

        const classInstance = {
            id: session.classId,
            classId: session.classId,
            name: session.className,
            instructorName: session.instructorName,
            dateString: session.dateStr,
            time: session.time,
            ...(fetchedClassData || {})
        };

        const userCredits = parseInt(member.classCredits) || 0;
        const eligibilityRes = await checkBookingEligibility(gymId, member.id, classInstance);

        let eligibility = { allowed: false, type: 'drop-in', cost: 1, reason: 'Error checking' };
        let weeklyUsage = null;

        if (eligibilityRes.success) {
            eligibility = eligibilityRes.data.eligibility;
            weeklyUsage = eligibilityRes.data.weeklyUsage;
        }

        const classCreditCost = eligibility.cost > 0 ? eligibility.cost : 1;

        let isStandardBooking = false;
        let isCreditBooking = false;
        let limitReached = false;

        if (eligibility.allowed && eligibility.type === 'membership') {
            isStandardBooking = true;
        }
        else if (eligibility.type === 'credit' || (eligibility.reason && eligibility.reason.includes('Weekly limit'))) {
            isCreditBooking = true;
            if (weeklyUsage && weeklyUsage.limit > 0 && weeklyUsage.used >= weeklyUsage.limit) {
                limitReached = true;
            }
        }
        else if (eligibility.type === 'drop-in' && eligibility.cost === 0) {
            isStandardBooking = true;
        }
        else {
            isCreditBooking = true;
        }

        let waiveCost = false;
        let shouldProceed = true;

        if (isStandardBooking) {
            waiveCost = false;
        }
        else if (isCreditBooking) {
            if (userCredits >= classCreditCost) {
                const message = (
                    <div className="space-y-3">
                        {limitReached ? (
                            <>
                                <div className="flex items-center gap-2 text-orange-700 font-bold bg-orange-50 p-2 rounded border border-orange-100">
                                    <AlertCircle size={16} /> Limit Reached
                                </div>
                                {weeklyUsage && renderUsageBar(weeklyUsage.used, weeklyUsage.limit)}
                                <p className="text-sm text-gray-700">
                                    Switching to credit booking.
                                    <br />This class costs <strong>{classCreditCost} Credit(s)</strong>.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-gray-700">
                                {finalName} does not have a valid membership for this class.
                                <br />Cost: <strong>{classCreditCost} Credit(s)</strong>.
                            </p>
                        )}
                        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100 flex justify-between">
                            <span>Current Balance:</span>
                            <span className="font-bold text-gray-900">{userCredits} Credits</span>
                        </div>
                    </div>
                );

                const useCredits = await dialog.confirm({
                    title: limitReached ? "Weekly Limit Reached" : "Confirm Payment",
                    message: message,
                    confirmText: `Charge ${classCreditCost} Credit(s)`,
                    cancelText: "No / Admin Options",
                    type: limitReached ? 'warning' : 'info'
                });

                // ✅ FIX: If clicked outside (null), stop everything.
                if (useCredits === null) return; 

                if (useCredits) {
                    waiveCost = false;
                } else {
                    const bookFree = await dialog.confirm({
                        title: "Admin Override",
                        message: "You declined to charge credits. Do you want to book this member for FREE?",
                        confirmText: "Yes, Book Free",
                        cancelText: "Cancel Booking",
                        type: 'danger'
                    });

                    // ✅ FIX: If clicked outside, stop.
                    if (bookFree === null) return;

                    if (bookFree) waiveCost = true;
                    else shouldProceed = false;
                }
            }
            else {
                const forceBook = await dialog.confirm({
                    title: "Insufficient Credits",
                    message: (
                        <div className="space-y-3">
                            {limitReached && weeklyUsage && renderUsageBar(weeklyUsage.used, weeklyUsage.limit)}
                            <div className="p-2 bg-red-50 border border-red-100 rounded">
                                <p className="text-sm text-red-800 font-bold mb-1">Cannot pay normally.</p>
                                <ul className="text-xs text-red-700 list-disc list-inside">
                                    {limitReached && <li>Status: Weekly Limit Reached</li>}
                                    <li>Balance: {userCredits}</li>
                                    <li>Cost: {classCreditCost}</li>
                                </ul>
                            </div>
                            <p className="text-sm">Do you want to comp this booking?</p>
                        </div>
                    ),
                    confirmText: "Book Free (Comp)",
                    cancelText: "Cancel",
                    type: 'danger'
                });

                // ✅ FIX: If clicked outside, stop.
                if (forceBook === null) return;

                if (forceBook) waiveCost = true;
                else shouldProceed = false;
            }
        }

        if (!shouldProceed) return;

        const effectiveLimit = liveCapacity === 0 ? 999 : liveCapacity;
        const currentActive = roster.filter(r => r.status === BOOKING_STATUS.BOOKED || r.status === BOOKING_STATUS.ATTENDED).length;

        let forceCapacity = false;
        if (currentActive >= effectiveLimit) {
            const capacityResult = await dialog.confirm({
                title: "Class is Full",
                message: `${finalName} cannot be added normally (${currentActive}/${liveCapacity}). Force add?`,
                confirmText: "Force Overbook",
                cancelText: "Add to Waitlist",
                type: 'confirm'
            });

            // ✅ FIX: If clicked outside, stop.
            if (capacityResult === null) return;
            
            forceCapacity = capacityResult;
        }

        let finalBookingType = 'membership'; 

        if (waiveCost) {
            finalBookingType = 'comp';
        } else if (isCreditBooking) {
            finalBookingType = 'credit';
        }

        setLoading(true);

        const res = await bookMember(gymId, classInstance, { ...member, name: finalName }, {
            force: forceCapacity,
            bookingType: finalBookingType,
            waiveCost: waiveCost,
            creditCostOverride: classCreditCost,
            isStaff: true
        });

        setLoading(false);

        if (res.success) {
            if (finalBookingType === 'credit' && !waiveCost) {
                updateLocalMemberCredits(member.id, -classCreditCost);
            }
            refreshRoster();
            await dialog.alert({ title: "Success", message: "Member Added" });
        } else {
            await dialog.alert({ title: "Error", message: res.error, type: 'danger' });
        }
    };

    const handleCheckIn = async (attId, memId) => {
        setRoster(prev => prev.map(r => r.id === attId ? { ...r, status: BOOKING_STATUS.ATTENDED } : r));
        const res = await checkInMember(gymId, attId, memId, session.programId);
        if (!res.success) {
            await dialog.alert({ title: "Error", message: res.error, type: 'danger' });
            refreshRoster();
        }
    };

    const handleRemove = async (attId, refundPolicy) => {
        setLoading(true);
        const record = roster.find(r => r.id === attId);
        const res = await cancelBooking(gymId, attId, {
            isStaff: true,
            refundPolicy: refundPolicy
        });

        if (res.success) {
            if (refundPolicy === 'refund' && record && record.costUsed > 0) {
                updateLocalMemberCredits(record.memberId, record.costUsed);
            }
            await refreshRoster();
            if (onRosterChange) onRosterChange();
        } else {
            await dialog.alert({ title: "Error", message: res.error });
        }
        setLoading(false);
    };

    const handleProcessWaitlist = async () => {
        setLoading(true);
        const res = await processWaitlist(gymId, session.classId, session.dateStr);
        setLoading(false);
        if (res.success) {
            await dialog.alert({ title: "Success", message: `Promoted ${res.promoted} members from the waitlist.` });
            refreshRoster();
            if (onRosterChange) onRosterChange();
        } else {
            await dialog.alert({ title: "Error", message: res.error, type: 'danger' });
        }
    };

    const handleCancelSession = async () => {
        const isConfirmed = await dialog.confirm({
            title: "Cancel Class Session?",
            message: "This will cancel the class for everyone booked. This action cannot be undone.",
            confirmText: "Yes, Cancel Session",
            type: 'danger'
        });

        // ✅ FIX: If clicked outside, stop.
        if (isConfirmed === null) return;

        if (isConfirmed) {
            await onCancelSession(session.classId, session.dateStr, roster);
            onClose();
        }
    };

    const handleRestoreSession = () => {
        onCancelSession(session.classId, session.dateStr, roster, true);
    };

    if (!isOpen || !session) return null;

    const activeCount = roster.filter(r => r.status === BOOKING_STATUS.BOOKED || r.status === BOOKING_STATUS.ATTENDED).length;
    const waitlistCount = roster.filter(r => r.status === BOOKING_STATUS.WAITLISTED).length;

    const bookedMemberIds = new Set(
        roster.filter(r => r.status !== BOOKING_STATUS.CANCELLED).map(r => r.memberId)
    );

    const filteredMembers = allMembers
        .filter(m => {
            if (bookedMemberIds.has(m.id)) return false;
            const name = m.name || `${m.firstName} ${m.lastName}`;
            return name.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .slice(0, 5);

    return (
        // ✅ FIX 1: Add onClick={onClose} to outer div (Backdrop)
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200"
            onClick={onClose}
        >
            {/* ✅ FIX 2: Stop propagation so clicking the card doesn't close it */}
            <div 
                className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative"
                onClick={(e) => e.stopPropagation()}
            >
                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                        <p className="text-sm font-medium text-gray-600">Processing...</p>
                    </div>
                )}

                <SessionHeader session={session} onClose={onClose} />

                <div className="p-6 overflow-y-auto flex-1">
                    <SessionStats
                        session={session}
                        activeCount={activeCount}
                        waitlistCount={waitlistCount}
                        liveCapacity={liveCapacity}
                    />

                    {!session.isCancelled && (
                        <WaitlistBanner
                            activeCount={activeCount}
                            waitlistCount={waitlistCount}
                            liveCapacity={liveCapacity}
                            onProcess={handleProcessWaitlist}
                        />
                    )}

                    <SessionRoster
                        roster={roster}
                        gymId={gymId}
                        isAdding={isAdding}
                        setIsAdding={setIsAdding}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchResults={filteredMembers}
                        membersLoading={membersLoading}
                        onAddMember={handleAddMember}
                        onCheckIn={handleCheckIn}
                        onRemove={handleRemove}
                        isSessionCancelled={session.isCancelled}
                        classData={{
                            ...(fetchedClassData || session),
                            dateString: session.dateStr || session.dateString
                        }}
                    />
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <button onClick={() => onEditSeries(session.classId)} className="text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-2">
                        <Edit2 size={16} /> Edit Series
                    </button>

                    {!session.isCancelled ? (
                        <button onClick={handleCancelSession} className="text-sm text-red-600 hover:text-red-800 font-bold flex items-center gap-2">
                            <Ban size={16} /> Cancel Session
                        </button>
                    ) : (
                        <button onClick={handleRestoreSession} className="text-sm text-green-600 hover:text-green-800 font-bold flex items-center gap-2">
                            <CheckCircle size={16} /> Restore Session
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};