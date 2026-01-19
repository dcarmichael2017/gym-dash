import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Search, MapPin, ArrowRight, Loader2, ChevronLeft, ChevronDown, History, XCircle, Calendar, Clock, User, Users, MessageSquare } from 'lucide-react';
import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';
import { signWaiver, getGymWaiver } from '../../../../../../packages/shared/api/firestore/gym';
import { disconnectGym } from '../../../../../../packages/shared/api/firestore/members';
import { getMemberAttendanceHistory } from '../../../../../../packages/shared/api/firestore/bookings';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';

// --- SUB-COMPONENTS ---
import MembershipOffers from './MembershipOffers';
import NextClassCard from './NextClassCard';
import WaiverModal from './WaiverModal';
import GymSwitcherSheet from './GymSwitcherSheet';
import GymSearch from './GymSearch';
import StatsOverView from './StatsOverView';

const MemberHomeScreen = () => {
    // 1. Get isLoading from context to handle the initial auth check delay
    const { currentGym, memberships, isLoading: contextLoading } = useGym();
    const user = auth.currentUser;

    // --- LOCAL STATE ---
    const [showGymSwitcher, setShowGymSwitcher] = useState(false);
    const [isAddingGym, setIsAddingGym] = useState(false);
    const [userDoc, setUserDoc] = useState(null);
    const [loading, setLoading] = useState(true);

    // --- WAIVER STATE ---
    const [waiverEnforced, setWaiverEnforced] = useState(false);
    const [currentWaiverVersion, setCurrentWaiverVersion] = useState(1);
    const [checkingWaiver, setCheckingWaiver] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);

    // --- ATTENDANCE HISTORY MODAL STATE ---
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedClass, setSelectedClass] = useState('');

    // --- CHAT UNREAD COUNT STATE ---
    const [totalUnreadCount, setTotalUnreadCount] = useState(0);

    // Derived state
    const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };
    const currentMembership = memberships?.find(m => m.gymId === currentGym?.id);

    const isFreeMember = !currentMembership ||
        currentMembership.status === 'prospect' ||
        currentMembership.status === 'guest';

    const isActiveMember = currentMembership?.status === 'active' ||
        currentMembership?.status === 'trialing';

    const isInactiveMember = currentMembership?.status === 'inactive';

    // --- HELPERS FOR STATUS UI ---
    const getDisplayName = (status) => {
        const s = status?.toLowerCase();
        if (!s || s === 'prospect' || s === 'guest') return 'FREE MEMBER';
        if (s === 'active') return 'ACTIVE MEMBER';
        if (s === 'trialing') return 'TRIAL PERIOD';
        if (s === 'past_due') return 'PAYMENT FAILED';
        if (s === 'expired' || s === 'cancelled') return 'FORMER MEMBER';
        return status.toUpperCase();
    };

    const getBadgeStyles = (status) => {
        const s = status?.toLowerCase();
        if (s === 'active') return 'bg-green-100 text-green-700';
        if (s === 'past_due') return 'bg-red-100 text-red-700';
        if (s === 'trialing') return 'bg-blue-100 text-blue-700';
        if (s === 'expired' || s === 'cancelled') return 'bg-orange-100 text-orange-700';
        return `text-[${theme.primaryColor}]`;
    };

    // --- EFFECT: FETCH USER DATA & HISTORY ---
    useEffect(() => {
        const fetchData = async () => {
            if (user && currentGym?.id) {
                setLoading(true);
                setHistoryLoading(true);

                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    setUserDoc(userSnap.data());
                }

                const res = await getMemberAttendanceHistory(currentGym.id, user.uid);
                if (res.success) {
                    setAttendanceHistory(res.history);
                }

                setLoading(false);
                setHistoryLoading(false);
            } else {
                setLoading(false);
                setHistoryLoading(false);
            }
        };
        fetchData();
    }, [user, currentGym?.id]);

    // --- EFFECT: CHECK WAIVER ---
    useEffect(() => {
        // If no gym selected, stop checking
        if (!currentGym?.id) {
            setCheckingWaiver(false);
            setWaiverEnforced(false);
            return;
        }

        setCheckingWaiver(true);

        // Create a listener to the specific legal settings document
        const waiverRef = doc(db, "gyms", currentGym.id, "settings", "legal");

        const unsubscribe = onSnapshot(waiverRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                // If doc exists, use its enforce setting (default to true if field missing)
                setWaiverEnforced(data.enforceWaiverSignature !== false);
                setCurrentWaiverVersion(data.version || 1);

                // If a waiver is added/updated, un-dismiss the modal so they see it
                setIsDismissed(false);
            } else {
                // ✅ FIX: If doc DOES NOT exist, do NOT enforce waiver
                setWaiverEnforced(false);
            }
            setCheckingWaiver(false);
        }, (error) => {
            // ✅ FIX: Gracefully handle permission errors by assuming no waiver
            console.warn("Waiver check silent fail:", error.message);
            setWaiverEnforced(false);
            setCheckingWaiver(false);
        });

        // Cleanup listener when gym changes or component unmounts
        return () => unsubscribe();
    }, [currentGym?.id]);

    // --- EFFECT: SUBSCRIBE TO CHAT GROUPS FOR UNREAD COUNT ---
    useEffect(() => {
        if (!currentGym?.id || !user?.uid) {
            setTotalUnreadCount(0);
            return;
        }

        const chatGroupsRef = collection(db, "gyms", currentGym.id, "chatGroups");
        const q = query(
            chatGroupsRef,
            where(`members.${user.uid}`, "==", true),
            orderBy("updatedAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let unread = 0;
            snapshot.docs.forEach(doc => {
                const group = doc.data();
                const lastReadAt = group.lastReadAt?.[user.uid];
                const lastMessageAt = group.lastMessageAt;

                if (!lastMessageAt) return;
                if (!lastReadAt) {
                    // Never read, count as 1 unread per group
                    unread++;
                    return;
                }

                const lastReadTime = lastReadAt.toDate ? lastReadAt.toDate() : new Date(lastReadAt);
                const lastMsgTime = lastMessageAt.toDate ? lastMessageAt.toDate() : new Date(lastMessageAt);

                if (lastMsgTime > lastReadTime) {
                    unread++;
                }
            });
            setTotalUnreadCount(unread);
        }, (error) => {
            console.warn("Chat groups subscription error:", error.message);
            setTotalUnreadCount(0);
        });

        return () => unsubscribe();
    }, [currentGym?.id, user?.uid]);

    // --- Filtering Logic for History Modal ---
    const programs = currentGym?.grading?.programs || [];

    const filteredHistory = useMemo(() => {
        return attendanceHistory.filter(record => {
            let programMatch = true;
            if (selectedProgram) {
                if (selectedProgram === 'none') {
                    programMatch = !record.programId;
                } else {
                    programMatch = record.programId === selectedProgram;
                }
            }
            const classMatch = !selectedClass || record.className === selectedClass;
            return programMatch && classMatch;
        });
    }, [attendanceHistory, selectedProgram, selectedClass]);

    const availableClasses = useMemo(() => {
        const relevantHistory = attendanceHistory.filter(record => {
            if (!selectedProgram) return true;
            if (selectedProgram === 'none') return !record.programId;
            return record.programId === selectedProgram;
        });
        const classCounts = relevantHistory.reduce((acc, record) => {
            acc[record.className] = (acc[record.className] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(classCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [attendanceHistory, selectedProgram]);

    // --- GATEKEEPER LOGIC ---
    const userSignedVersion = currentMembership?.waiverSignedVersion || 0;
    const isOutdated = currentMembership?.waiverSigned && userSignedVersion < currentWaiverVersion;
    const isNotSigned = currentMembership && !currentMembership.waiverSigned;
    const showWaiverModal = currentGym && !isDismissed && !checkingWaiver && waiverEnforced && (isNotSigned || isOutdated);

    // --- HANDLERS ---
    const handleWaiverSign = async () => {
        const user = auth.currentUser;
        if (user && currentGym) {
            await signWaiver(user.uid, currentGym.id, currentWaiverVersion);
        }
    };

    const handleWaiverDecline = async () => {
        if (isOutdated) { setIsDismissed(true); return; }
        const user = auth.currentUser;
        if (user && currentGym) {
            const { success } = await disconnectGym(user.uid, currentGym.id);
            if (success) {
                // Context will automatically detect removal and might set currentGym to null
                // We can also trigger logic if needed
            }
        }
    };

    const handleAddGymClick = () => {
        setShowGymSwitcher(false);
        setIsAddingGym(true);
    };

    const isFiltered = selectedProgram || selectedClass;
    const clearFilters = () => {
        setSelectedProgram('');
        setSelectedClass('');
    };

    // --- RENDER: LOADING STATE ---
    if (contextLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    // --- RENDER: NO GYM / ADD GYM STATE ---
    // If we are finished loading and have no gym (New User) OR user explicitly clicked Add Gym
    if (!currentGym || isAddingGym) {
        return (
            <GymSearch
                // Only show cancel (back) button if they actually have a current gym to go back to
                onCancel={currentGym ? () => setIsAddingGym(false) : null}
                onJoinSuccess={() => setIsAddingGym(false)}
            />
        );
    }

    // --- RENDER: DASHBOARD ---
    return (
        <div className="p-6 space-y-6 pb-24 relative">
            {/* ATTENDANCE HISTORY MODAL */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
                        <div className="p-4 border-b flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <History size={18} className="text-gray-500" />
                                <h3 className="font-bold text-lg text-gray-800">Attendance History</h3>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-800 transition-colors">
                                <XCircle size={22} />
                            </button>
                        </div>

                        <div className="p-3 bg-gray-50/70 border-b">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <select
                                    value={selectedProgram}
                                    onChange={(e) => { setSelectedProgram(e.target.value); setSelectedClass(''); }}
                                    className="w-full bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    disabled={historyLoading || programs.length === 0}
                                >
                                    <option value="">Filter by Program</option>
                                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    <option value="none">Other Classes / Seminars</option>
                                </select>

                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    disabled={historyLoading || availableClasses.length === 0}
                                >
                                    <option value="">Filter by Class</option>
                                    {availableClasses.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                                </select>
                            </div>
                            {isFiltered && (
                                <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline font-semibold mt-2 text-center w-full">
                                    Clear Filters
                                </button>
                            )}
                        </div>

                        <div className="p-2 sm:p-4 overflow-y-auto">
                            {historyLoading ? (
                                <div className="text-center py-16 text-gray-500"><Loader2 className="animate-spin inline-block mb-2" /><p>Loading history...</p></div>
                            ) : filteredHistory.length === 0 ? (
                                <div className="text-center py-16 text-gray-500"><Calendar className="inline-block mb-2" /><p>{isFiltered ? 'No records match your filters.' : 'No attendance records found.'}</p></div>
                            ) : (
                                <ul className="space-y-2">
                                    {filteredHistory.map(record => {
                                        const getPaymentBadge = (record) => {
                                            switch (record.bookingType) {
                                                case 'membership': return { text: 'Membership', style: 'bg-gray-100 text-gray-700 border-gray-200' };
                                                case 'credit': const credits = record.costUsed || 1; return { text: `${credits} Credit${credits !== 1 ? 's' : ''}`, style: 'bg-purple-100 text-purple-800 border-purple-200' };
                                                case 'comp': case 'admin_comp': return { text: 'Admin Comp', style: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
                                                case 'drop-in': return { text: 'Drop-In', style: 'bg-teal-100 text-teal-800 border-teal-200' };
                                                default: return null;
                                            }
                                        };
                                        const paymentBadge = getPaymentBadge(record);
                                        const isAttended = record.status === 'attended';
                                        const isBooked = record.status === 'booked';
                                        const isCancelled = record.status === 'cancelled';
                                        const isNoShow = record.status === 'no-show';
                                        const isWaitlisted = record.status === 'waitlisted';

                                        let badgeStyle = 'bg-gray-100 text-gray-600 border-gray-200';
                                        if (isAttended) badgeStyle = 'bg-green-100 text-green-800 border-green-200';
                                        if (isBooked) badgeStyle = 'bg-blue-100 text-blue-800 border-blue-200';
                                        if (isCancelled || isNoShow) badgeStyle = 'bg-red-100 text-red-800 border-red-200';
                                        if (isWaitlisted) badgeStyle = 'bg-yellow-100 text-yellow-800 border-yellow-200';

                                        return (
                                            <li key={record.id} className={`bg-gray-5 p-3 rounded-lg border border-gray-200 ${isCancelled ? 'opacity-60' : ''}`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <p className={`font-semibold text-sm text-gray-900 ${isCancelled ? 'line-through' : ''}`}>{record.className}</p>
                                                        {record.instructorName && (<p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><User size={12} /> {record.instructorName}</p>)}
                                                    </div>
                                                    <div className="text-right text-xs text-gray-500 shrink-0 ml-2">
                                                        {record.classTimestamp?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        {record.classTime && <div className="flex items-center justify-end gap-1 mt-0.5"><Clock size={10} /> {record.classTime}</div>}
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>{record.status ? record.status.toUpperCase() : 'UNKNOWN'}</span>
                                                    {paymentBadge && (<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${paymentBadge.style}`}>{paymentBadge.text}</span>)}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showWaiverModal && (
                <WaiverModal
                    gymId={currentGym?.id}
                    gymName={currentGym?.name}
                    theme={theme}
                    onAccept={handleWaiverSign}
                    onDecline={handleWaiverDecline}
                    targetVersion={currentWaiverVersion}
                    isUpdate={isOutdated}
                    lastSignedVersion={userSignedVersion}
                />
            )}

            <GymSwitcherSheet
                isOpen={showGymSwitcher}
                onClose={() => setShowGymSwitcher(false)}
                onAddGym={handleAddGymClick}
            />

            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <button
                        onClick={() => setShowGymSwitcher(true)}
                        className="group flex items-center gap-2 hover:bg-gray-100 -ml-2 px-2 py-1 rounded-lg transition-colors"
                    >
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 text-left">
                            {currentGym?.name}
                            <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
                        </h1>
                    </button>

                    <div className="flex items-center gap-1 mt-1 px-1">
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                            <MapPin size={12} /> {currentGym?.city || "My Location"}
                        </p>

                        {/* DYNAMIC STATUS BADGE */}
                        <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ml-2 whitespace-nowrap ${getBadgeStyles(currentMembership?.status)}`}
                            style={isFreeMember ? { backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor } : {}}
                        >
                            {getDisplayName(currentMembership?.status)}
                        </span>
                    </div>
                </div>
            </div>

            <NextClassCard hasActiveMembership={isActiveMember} />

            {/* Hide StatsOverView for inactive members */}
            {!isInactiveMember && (
                <StatsOverView
                    user={userDoc}
                    gym={currentGym}
                    attendanceHistory={attendanceHistory}
                    loading={loading}
                    onClick={() => setShowHistoryModal(true)}
                />
            )}

            {/* Hide Community/Chat widgets for inactive members */}
            {!isInactiveMember && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Community Feed Widget */}
                    <Link to="/members/community" className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4 hover:bg-gray-50 transition-colors">
                        <div className="bg-orange-100 p-3 rounded-full">
                            <Users className="text-orange-600" size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">Community Feed</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Latest: Great job to everyone who competed this weekend!
                            </p>
                        </div>
                    </Link>

                    {/* Group Chat Widget */}
                    <Link to="/members/chat" className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4 hover:bg-gray-50 transition-colors">
                        <div className="bg-purple-100 p-3 rounded-full relative">
                            <MessageSquare className="text-purple-600" size={20} />
                            {totalUnreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                    {totalUnreadCount > 10 ? '10+' : totalUnreadCount}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">Group Chat</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {totalUnreadCount > 0 ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-red-500"></span>
                                        {totalUnreadCount > 10 ? '10+' : totalUnreadCount} unread message{totalUnreadCount !== 1 ? 's' : ''}
                                    </span>
                                ) : (
                                    'View your group conversations'
                                )}
                            </p>
                        </div>
                    </Link>
                </div>
            )}

            {isFreeMember && (
                <MembershipOffers />
            )}
        </div>
    );
};

export default MemberHomeScreen;