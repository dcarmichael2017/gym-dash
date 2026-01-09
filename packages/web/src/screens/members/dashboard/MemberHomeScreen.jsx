import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Search, MapPin, ArrowRight, Loader2, ChevronLeft, ChevronDown, History, XCircle, Calendar, Clock, User, Users, MessageSquare } from 'lucide-react';
import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';
import { signWaiver, disconnectGym, getGymWaiver, getMemberAttendanceHistory } from '../../../../../../packages/shared/api/firestore';
import { doc, getDoc } from 'firebase/firestore';

// --- SUB-COMPONENTS ---
import MembershipOffers from './MembershipOffers';
import NextClassCard from './NextClassCard';
import WaiverModal from './WaiverModal';
import GymSwitcherSheet from './GymSwitcherSheet';
import GymSearch from './GymSearch';
import StatsOverView from './StatsOverView';

const MemberHomeScreen = () => {
  const { currentGym, memberships } = useGym();
  const user = auth.currentUser;

  if (!currentGym) {
      return <GymSearch onJoinSuccess={() => setIsAddingGym(false)} />;
  }

  const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };

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

  // --- DERIVED STATE ---
  const currentMembership = memberships?.find(m => m.gymId === currentGym?.id);
  
  // Consolidating Guest/Prospect logic
  const isFreeMember = !currentMembership || 
                       currentMembership.status === 'prospect' || 
                       currentMembership.status === 'guest';
                       
  const isActiveMember = currentMembership?.status === 'active' || 
                         currentMembership?.status === 'trialing';

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
    // Default for Free Member (using theme primary with low opacity)
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
    const checkSettings = async () => {
        if (currentGym?.id) {
            setCheckingWaiver(true);
            setIsDismissed(false); 
            const res = await getGymWaiver(currentGym.id);
            setWaiverEnforced(res.success ? res.enforceWaiver : true);
            setCurrentWaiverVersion(res.version || 1);
            setCheckingWaiver(false);
        } else {
            setCheckingWaiver(false);
        }
    };
    checkSettings();
  }, [currentGym?.id]);

  // --- GATEKEEPER LOGIC ---
  const userSignedVersion = currentMembership?.waiverSignedVersion || 0;
  const isOutdated = currentMembership?.waiverSigned && userSignedVersion < currentWaiverVersion;
  const isNotSigned = currentMembership && !currentMembership.waiverSigned;
  const showWaiverModal = !isDismissed && !checkingWaiver && waiverEnforced && (isNotSigned || isOutdated);

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
          await disconnectGym(user.uid, currentGym.id);
      }
  };

  const handleAddGymClick = () => {
      setShowGymSwitcher(false);
      setIsAddingGym(true);
  };

  // --- RENDER LOGIC ---

  // If no gym is selected OR user specifically wants to add a gym -> Show Search
  if (!currentGym || isAddingGym) {
      return (
          <GymSearch 
            // Only allow canceling if they actually have a gym to go back to
            onCancel={currentGym ? () => setIsAddingGym(false) : null} 
            onJoinSuccess={() => setIsAddingGym(false)}
          />
      );
  }

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

    const isFiltered = selectedProgram || selectedClass;
    const clearFilters = () => {
        setSelectedProgram('');
        setSelectedClass('');
    };

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
                          <XCircle size={22}/>
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
                                      <li key={record.id} className={`bg-gray-50 p-3 rounded-lg border border-gray-200 ${isCancelled ? 'opacity-60' : ''}`}>
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
              gymId={currentGym.id} 
              gymName={currentGym.name} 
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
                 {currentGym.name} 
                 <ChevronDown size={20} className="text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
               </h1>
           </button>
           
           <div className="flex items-center gap-1 mt-1 px-1">
                <p className="text-gray-500 text-sm flex items-center gap-1">
                    <MapPin size={12}/> {currentGym?.city || "My Location"}
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

      <StatsOverView 
          user={userDoc}
          gym={currentGym}
          attendanceHistory={attendanceHistory}
          loading={loading}
          onClick={() => setShowHistoryModal(true)}
      />

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
          <div className="bg-purple-100 p-3 rounded-full">
            <MessageSquare className="text-purple-600" size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-800">Group Chat</p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              1 unread message
            </p>
          </div>
        </Link>
      </div>

      {isFreeMember && (
          <MembershipOffers />
      )}
    </div>
  );
};

export default MemberHomeScreen;
