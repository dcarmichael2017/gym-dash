import React, { useState, useEffect } from 'react';
import { Edit2, Ban, CheckCircle } from 'lucide-react';
import { useConfirm } from '../../../../context/ConfirmationContext'; 
import { getClassRoster, bookMember, checkInMember, getGymMembers, cancelBooking, processWaitlist, getClassDetails } from '../../../../../../shared/api/firestore';
import { BOOKING_STATUS } from '../../../../../../shared/constants/strings';

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

    const refreshRoster = async () => {
        setLoading(true);
        try {
            const [rosterRes, classRes] = await Promise.all([
                getClassRoster(gymId, session.classId, session.dateStr),
                getClassDetails(gymId, session.classId)
            ]);

            if (rosterRes.success) setRoster(rosterRes.roster);
            
            if (classRes.success && classRes.data) {
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

    const handleAddMember = async (member) => {
        let finalName = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || "Unknown Member";

        const classInfo = {
            id: session.classId,
            name: session.className,
            instructorName: session.instructorName,
            dateString: session.dateStr,
            time: session.time
        };

        const memberPayload = { ...member, name: finalName };

        const effectiveLimit = liveCapacity === 0 ? 999 : liveCapacity;
        const currentActive = roster.filter(r => r.status === BOOKING_STATUS.BOOKED || r.status === BOOKING_STATUS.ATTENDED).length;
        
        let forceOverbook = false;

        if (currentActive >= effectiveLimit) {
            forceOverbook = await dialog.confirm({
                title: "Class is Full",
                message: `${finalName} cannot be added normally (${currentActive}/${liveCapacity}). How would you like to proceed?`,
                confirmText: "Force Overbook",
                cancelText: "Add to Waitlist",
                type: 'confirm'
            });
        }

        const res = await bookMember(gymId, classInfo, memberPayload, { force: forceOverbook });

        if (res.success) {
            if (res.status === BOOKING_STATUS.WAITLISTED) {
                await dialog.alert({ title: "Added to Waitlist", message: `${finalName} has been added to the waitlist.` });
            } else if (res.status === BOOKING_STATUS.BOOKED && forceOverbook) {
                await dialog.alert({ title: "Overbooked", message: `Successfully overbooked ${finalName} into class.` });
            }
            
            refreshRoster();
            setSearchTerm("");
            if (onRosterChange) onRosterChange();
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

    const handleRemove = async (attId) => {
        const isConfirmed = await dialog.confirm({
            title: "Remove Member?",
            message: "This will remove them from the roster. If a waitlist exists, the next person will be promoted automatically.",
            confirmText: "Remove",
            type: 'danger'
        });

        if (isConfirmed) {
            setLoading(true);
            const res = await cancelBooking(gymId, attId);
            if (res.success) {
                await refreshRoster();
                if (onRosterChange) onRosterChange();
            } else {
                await dialog.alert({ title: "Error", message: res.error });
            }
            setLoading(false);
        }
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

    const filteredMembers = allMembers
        .filter(m => {
            const name = m.name || `${m.firstName} ${m.lastName}`;
            return name.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .slice(0, 5);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                
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