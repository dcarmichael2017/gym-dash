import React, { useMemo, useState, useEffect } from 'react';
import { Clock, User, CheckCircle, AlertCircle, Hourglass, CheckSquare, Search, Filter, X, Coins, ShieldCheck, Lock, Tag } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext';

const MemberScheduleList = ({ classes, theme, onBook, counts = {}, userBookings = {}, userCredits = 0, memberships = [] }) => {
  const { currentGym } = useGym();
  
  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('All');
  const [instructorMap, setInstructorMap] = useState({}); 

  // --- 1. FETCH INSTRUCTORS ---
  useEffect(() => {
    const fetchStaff = async () => {
      if (!currentGym?.id) return;
      try {
        const staffRef = collection(db, 'gyms', currentGym.id, 'staff');
        const snapshot = await getDocs(staffRef);
        const map = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          map[doc.id] = data.name || "Instructor"; 
        });
        setInstructorMap(map);
      } catch (err) {
        console.error("Error fetching staff for schedule:", err);
      }
    };
    fetchStaff();
  }, [currentGym?.id]);

  // --- HELPERS ---
  const getInstructorName = (session) => {
    if (session.instructorName) return session.instructorName;
    if (session.instructorId && instructorMap[session.instructorId]) return instructorMap[session.instructorId];
    return "Instructor";
  };

  const formatCheckInTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return timeStr;
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr} at ${timeStr}`;
  };

  // --- 2. PREPARE DATA ---
  const upcomingSessions = useMemo(() => {
    const sessions = [];
    const today = new Date();
    const now = new Date(); 
    const DAYS_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    for (let i = 0; i < 14; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dayName = DAYS_MAP[targetDate.getDay()];
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      classes.forEach(cls => {
        // --- GHOST & VISIBILITY CHECKS ---
        if (cls.recurrenceEndDate && dateString > cls.recurrenceEndDate) {
          return; // Ghost Clause: Do not render past end date.
        }
        
        const instanceId = `${cls.id}_${dateString}`;
        const bookingData = userBookings[instanceId];
        const userState = bookingData?.status || null;

        if (cls.visibility === 'admin' && !userState) {
          return; // Visibility Check: Hide empty admin-only slots from members.
        }

        // --- LOGIC 1: Date Matching ---
        const isRecurringMatch = cls.days && cls.days.map(d => d.toLowerCase()).includes(dayName);
        const isNotCancelled = !cls.cancelledDates || !cls.cancelledDates.includes(dateString);
        const isSingleEventMatch = cls.frequency === 'Single Event' && cls.startDate === dateString;

        if ((isRecurringMatch && isNotCancelled && cls.frequency !== 'Single Event') || isSingleEventMatch) {
          
          // --- LOGIC 2: Time Filtering ---
          const [hours, minutes] = cls.time.split(':').map(Number);
          const sessionStart = new Date(targetDate);
          sessionStart.setHours(hours, minutes, 0, 0);

          const durationMinutes = parseInt(cls.duration) || 60;
          const sessionEnd = new Date(sessionStart.getTime() + durationMinutes * 60000);

          if (now > sessionEnd) {
             return; 
          }

          // --- LOGIC 3: Data Mapping ---
          const currentCount = counts[instanceId] || 0;
          
          const bookingType = bookingData?.bookingType || null;
          const checkedInAt = bookingData?.checkedInAt || null;
          
          const maxCap = parseInt(cls.maxCapacity) || 999;
          const isFull = currentCount >= maxCap;

          // --- ✅ LOGIC 4: Booking Window Check ---
          let isLocked = false;
          let openDate = null;
          const rules = cls.bookingRules || {};
          
          // Only check if not already booked/waitlisted
          if (!userState && rules.bookingWindowDays) {
             const windowDays = parseInt(rules.bookingWindowDays);
             // Calculate when it opens (Class Date minus Window Days)
             const openDateObj = new Date(targetDate);
             openDateObj.setDate(targetDate.getDate() - windowDays);
             openDateObj.setHours(0,0,0,0); // Set to beginning of that day

             // Logic: If Today is BEFORE the open date, it is locked
             const todayMidnight = new Date();
             todayMidnight.setHours(0,0,0,0);

             if (todayMidnight < openDateObj) {
                isLocked = true;
                openDate = openDateObj;
             }
          }

          sessions.push({
            ...cls,
            instanceId,
            dateString,
            dateObj: new Date(targetDate),
            dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayName.charAt(0).toUpperCase() + dayName.slice(1),
            userStatus: userState,
            bookingType: bookingType,
            checkedInAt: checkedInAt,
            isFull: isFull,
            currentCount: currentCount,
            resolvedInstructorName: getInstructorName(cls),
            isLocked: isLocked, // <--- New Prop
            openDate: openDate  // <--- New Prop
          });
        }
      });
    }

    return sessions.sort((a, b) => {
        if (a.dateString !== b.dateString) return a.dateObj - b.dateObj;
        return a.time.localeCompare(b.time);
    });
  }, [classes, counts, userBookings, instructorMap]); 

  // --- 3. EXTRACT INSTRUCTORS FOR FILTER ---
  const instructors = useMemo(() => {
     const unique = new Set(['All']);
     upcomingSessions.forEach(s => {
        if (s.resolvedInstructorName) unique.add(s.resolvedInstructorName);
     });
     return Array.from(unique);
  }, [upcomingSessions]);

  // --- 4. APPLY FILTERS ---
  const filteredSessions = useMemo(() => {
    return upcomingSessions.filter(session => {
        const matchesSearch = session.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesInstructor = selectedInstructor === 'All' || session.resolvedInstructorName === selectedInstructor;
        return matchesSearch && matchesInstructor;
    });
  }, [upcomingSessions, searchQuery, selectedInstructor]);

  // --- 5. GROUP BY DATE ---
  const groupedSessions = filteredSessions.reduce((acc, session) => {
    const key = `${session.dayLabel}, ${session.dateObj.toLocaleDateString(undefined, {month:'short', day:'numeric'})}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(session);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      
      {/* --- FILTER BAR --- */}
      <div className="space-y-3 sticky top-0 bg-gray-50 pt-2 pb-4 z-20 -mx-4 px-4 shadow-sm border-b border-gray-100/50 backdrop-blur-sm bg-gray-50/95">
        
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
                type="text" 
                placeholder="Search classes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X size={14} />
                </button>
            )}
        </div>

        {instructors.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {instructors.map(inst => (
                    <button
                        key={inst}
                        onClick={() => setSelectedInstructor(inst)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            selectedInstructor === inst 
                            ? 'bg-gray-800 text-white border-gray-800' 
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        {inst}
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* --- LIST CONTENT --- */}
      {Object.entries(groupedSessions).map(([dateLabel, sessions]) => (
        <div key={dateLabel} className="relative">
          <h3 className="sticky top-[105px] z-10 bg-gray-50/95 backdrop-blur-sm py-2 text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-transparent ml-1 w-full">
            {dateLabel}
          </h3>

          <div className="space-y-3 mt-2">
            {sessions.map((session) => {
              
              // --- BADGE & STATE LOGIC ---
              let badge = null;
              let paymentBadge = null;
              let requirementBadge = null; // ✅ NEW: Booking requirement badge
              let btnText = "Book";
              let btnStyle = { backgroundColor: theme.primaryColor, color: 'white' };
              let containerClass = "border-gray-100 hover:border-blue-200";

              // ✅ NEW: Determine booking requirements (only if not already booked)
              if (!session.userStatus) {
                const myMembership = memberships.find(m => m.gymId === currentGym.id);
                const userTierId = myMembership?.membershipId;
                const creditCost = parseInt(session.creditCost) || 1;

                // Check if class is credit-only
                if (session.dropInEnabled && session.allowedMembershipIds?.length > 0) {
                  const isMembershipIncluded = userTierId && session.allowedMembershipIds.includes(userTierId);

                  if (!isMembershipIncluded) {
                    // Credit-only class
                    requirementBadge = (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <Coins size={10} /> {creditCost} Credit{creditCost !== 1 ? 's' : ''}
                      </span>
                    );
                  }
                } else if (session.dropInEnabled && (!session.allowedMembershipIds || session.allowedMembershipIds.length === 0)) {
                  // Drop-in only class
                  requirementBadge = (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <Coins size={10} /> {creditCost} Credit{creditCost !== 1 ? 's' : ''}
                    </span>
                  );
                } else if (session.allowedMembershipIds && session.allowedMembershipIds.length > 0 && !session.dropInEnabled) {
                  // Membership-only class
                  const hasRequiredMembership = userTierId && session.allowedMembershipIds.includes(userTierId);
                  if (!hasRequiredMembership) {
                    requirementBadge = (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <ShieldCheck size={10} /> Membership Required
                      </span>
                    );
                  }
                }
              }

              // 1. Status Badges
              if (session.userStatus === 'attended') {
                 // ... existing logic ...
                 const timeStr = formatCheckInTime(session.checkedInAt);
                 const label = timeStr ? `Checked in: ${timeStr}` : 'Attended';
                 badge = <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1"><CheckSquare size={10}/> {label}</span>;
                 btnText = "Completed";
                 btnStyle = { backgroundColor: '#f3f4f6', color: '#9ca3af', cursor: 'default' };
                 containerClass = "border-gray-200 bg-gray-50/50 opacity-75"; 
              } else if (session.userStatus === 'booked') {
                 badge = <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle size={10}/> Booked</span>;
                 btnText = "Manage";
                 btnStyle = { backgroundColor: '#f3f4f6', color: '#374151' };
                 containerClass = "border-green-200 ring-1 ring-green-100 bg-green-50/10";
              } else if (session.userStatus === 'waitlisted') {
                 badge = <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded flex items-center gap-1"><Hourglass size={10}/> Waitlisted</span>;
                 btnText = "Manage";
                 btnStyle = { backgroundColor: '#f3f4f6', color: '#374151' };
                 containerClass = "border-orange-200 bg-orange-50/10";
              } else if (session.isFull) {
                 badge = <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10}/> Full</span>;
                 btnText = "Waitlist";
                 btnStyle = { backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' };
              } else if (session.isLocked) {
                 // ✅ NEW LOCKED STATE
                 badge = <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1"><Lock size={10}/> Opens Soon</span>;
                 // Calculate formatted date for button
                 const openDateStr = session.openDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                 btnText = `Opens ${openDateStr}`;
                 btnStyle = { backgroundColor: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed' };
                 containerClass = "border-gray-200 bg-gray-50/30";
              }

              // 2. Payment Badges (Only show if booked/attended)
              if (session.userStatus === 'booked' || session.userStatus === 'attended') {
                  if (session.bookingType === 'credit') {
                      paymentBadge = <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded flex items-center gap-1 ml-1"><Coins size={10}/> Credit</span>;
                  } else if (session.bookingType === 'comp' || session.bookingType === 'admin_comp') {
                      paymentBadge = <span className="text-[10px] font-bold text-gray-600 bg-gray-200 border border-gray-300 px-2 py-0.5 rounded flex items-center gap-1 ml-1"><ShieldCheck size={10}/> Comp</span>;
                  }
              }

              return (
                <div 
                  key={session.instanceId} 
                  className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-all ${containerClass}`}
                >
                  <div className="flex gap-4 items-start">
                    <div className="flex flex-col items-center justify-center min-w-[60px] border-r border-gray-100 pr-4 py-1">
                        <span className="text-sm font-bold text-gray-900">{session.time}</span>
                        <span className="text-[10px] text-gray-400 font-medium">{session.duration}m</span>
                    </div>

                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className={`font-bold ${session.userStatus === 'attended' || session.isLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                                {session.name}
                            </h4>
                            {badge}
                            {paymentBadge}
                            {requirementBadge} {/* ✅ Display requirement badge */}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <User size={12} /> {session.resolvedInstructorName}
                            </span>
                        </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                        if (session.userStatus !== 'attended' && !session.isLocked) onBook(session);
                    }}
                    disabled={session.userStatus === 'attended' || session.isLocked}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-transform active:scale-95 w-full sm:w-auto"
                    style={btnStyle}
                  >
                    {btnText}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {upcomingSessions.length === 0 && (
         <div className="text-center text-gray-400 py-10 flex flex-col items-center gap-2">
            <Filter size={32} className="opacity-20" />
            <span>No classes found matching your filters.</span>
            <button 
                onClick={() => { setSearchQuery(''); setSelectedInstructor('All'); }}
                className="text-blue-500 text-sm font-bold"
            >
                Clear Filters
            </button>
         </div>
      )}
    </div>
  );
};

export default MemberScheduleList;
