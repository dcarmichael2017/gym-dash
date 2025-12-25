import React, { useMemo, useState, useEffect } from 'react';
import { Clock, User, CheckCircle, AlertCircle, Hourglass, CheckSquare, Search, Filter, X } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../../../context/GymContext'; 

const MemberScheduleList = ({ classes, theme, onBook, counts = {}, userBookings = {} }) => {
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
        // --- LOGIC UPDATE START ---
        // 1. Check Recurring: Matches Day AND Not Cancelled
        const isRecurringMatch = cls.days && cls.days.map(d => d.toLowerCase()).includes(dayName);
        const isNotCancelled = !cls.cancelledDates || !cls.cancelledDates.includes(dateString);
        
        // 2. Check Single Event: Explicit Date Match
        const isSingleEventMatch = cls.frequency === 'Single Event' && cls.startDate === dateString;

        // 3. Combine Logic: (Recurring & Valid) OR (Single Event)
        if ((isRecurringMatch && isNotCancelled && cls.frequency !== 'Single Event') || isSingleEventMatch) {
        // --- LOGIC UPDATE END ---

          const instanceId = `${cls.id}_${dateString}`;
          const currentCount = counts[instanceId] || 0;
          const bookingData = userBookings[instanceId];
          const userState = bookingData?.status || null; 
          const checkedInAt = bookingData?.checkedInAt || null;
          const maxCap = parseInt(cls.maxCapacity) || 999;
          const isFull = currentCount >= maxCap;

          sessions.push({
            ...cls,
            instanceId,
            dateString,
            dateObj: new Date(targetDate),
            dayLabel: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayName.charAt(0).toUpperCase() + dayName.slice(1),
            userStatus: userState,
            checkedInAt: checkedInAt,
            isFull: isFull,
            currentCount: currentCount,
            resolvedInstructorName: getInstructorName(cls) 
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
        
        {/* Search Input */}
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

        {/* Instructor Chips */}
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
              
              // Badge Logic
              let badge = null;
              let btnText = "Book";
              let btnStyle = { backgroundColor: theme.primaryColor, color: 'white' };
              let containerClass = "border-gray-100 hover:border-blue-200";

              if (session.userStatus === 'attended') {
                 const timeStr = formatCheckInTime(session.checkedInAt);
                 const label = timeStr ? `Checked in: ${timeStr}` : 'Attended';
                 badge = (
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckSquare size={10}/> {label}
                    </span>
                 );
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
                            <h4 className={`font-bold ${session.userStatus === 'attended' ? 'text-gray-500' : 'text-gray-900'}`}>
                                {session.name}
                            </h4>
                            {badge}
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
                        if (session.userStatus !== 'attended') onBook(session);
                    }}
                    disabled={session.userStatus === 'attended'}
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