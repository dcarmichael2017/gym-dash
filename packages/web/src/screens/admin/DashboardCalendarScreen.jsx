import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getClasses, getStaffList, getGymDetails, getWeeklyAttendanceCounts, updateClass } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/common/FullScreenLoader';
import { WeeklyCalendarView } from '../../components/admin/WeeklyCalendarView';
import { SessionDetailsModal } from '../../components/admin/SessionDetailsModal';

const DashboardCalendarScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  
  // Data
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [bookingCounts, setBookingCounts] = useState({});
  const [gymData, setGymData] = useState(null);

  // View State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [slideDirection, setSlideDirection] = useState('next');
  
  // Modal State
  const [selectedSession, setSelectedSession] = useState(null);

  // --- HELPERS ---
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getWeekRange = (date) => {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
        startStr: start.toISOString().split('T')[0],
        endStr: end.toISOString().split('T')[0]
    };
  };

  const startOfWeek = getStartOfWeek(currentDate);

  const navigateWeek = (direction) => {
    setSlideDirection(direction > 0 ? 'next' : 'prev');
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setSlideDirection(today > currentDate ? 'next' : 'prev');
    setCurrentDate(today);
  };

  const getInstructorName = (id) => {
    const staff = staffList.find(s => s.id === id);
    return staff ? staff.name : 'Unassigned';
  };

  // --- DATA FETCHING ---
  const refreshData = async (gId = gymId) => {
    if (!gId) return;
    try {
      const { startStr, endStr } = getWeekRange(currentDate);
      const [classRes, staffRes, gymRes, countsRes] = await Promise.all([
        getClasses(gId),
        getStaffList(gId),
        getGymDetails(gId),
        getWeeklyAttendanceCounts(gId, startStr, endStr) 
      ]);

      if (classRes.success) setClasses(classRes.classList);
      if (staffRes.success) setStaffList(staffRes.staffList);
      if (gymRes.success) setGymData(gymRes.gym);
      if (countsRes.success) setBookingCounts(countsRes.counts);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.data()?.gymId) {
          setGymId(userSnap.data().gymId);
          await refreshData(userSnap.data().gymId);
        }
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (gymId) refreshData(gymId);
  }, [currentDate, gymId]);

  // --- HANDLERS ---
  const handleSessionClick = (sessionData) => {
    const parentClass = classes.find(c => c.id === sessionData.classId);
    setSelectedSession({
        ...sessionData,
        programId: parentClass?.programId || null,
        instructorName: getInstructorName(parentClass?.instructorId) 
    });
  };

  const handleCancelSession = async (classId, dateStr, affectedUsers, isRestore) => {
    try {
        const targetClass = classes.find(c => c.id === classId);
        if (!targetClass) return;

        let newCancelledDates = targetClass.cancelledDates || [];
        if (isRestore) {
            newCancelledDates = newCancelledDates.filter(d => d !== dateStr);
        } else {
            if (!newCancelledDates.includes(dateStr)) newCancelledDates.push(dateStr);
        }

        const result = await updateClass(gymId, classId, { cancelledDates: newCancelledDates });
        if (result.success) {
            await refreshData(gymId);
            // Update local modal state if open
            if (selectedSession && selectedSession.classId === classId && selectedSession.dateStr === dateStr) {
                setSelectedSession(prev => ({ ...prev, isCancelled: !isRestore }));
            }
        }
    } catch (error) { console.error(error); }
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Calendar</h2>
          <p className="text-gray-500">View upcoming sessions & attendance</p>
        </div>

        <div className="flex gap-3">
            {/* Date Nav */}
            <div className="bg-white border border-gray-200 p-1 rounded-lg flex items-center gap-1">
                <button onClick={() => navigateWeek(-1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ChevronLeft size={20} /></button>
                <button onClick={goToToday} className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded">Today</button>
                <button onClick={() => navigateWeek(1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ChevronRight size={20} /></button>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                <span className="px-2 text-sm font-semibold text-gray-800">
                    {startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                    {' - '}
                    {new Date(new Date(startOfWeek).setDate(startOfWeek.getDate() + 6)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
            </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <WeeklyCalendarView
            classes={classes}
            staffList={staffList}
            currentWeekStart={startOfWeek}
            slideDirection={slideDirection} 
            bookingCounts={bookingCounts}
            onEditClass={handleSessionClick}
            onCreateSession={() => {}} // Create disabled on this screen
            onCancelSession={() => {}} 
        />
      </div>

      <SessionDetailsModal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        gymId={gymId}
        onEditSeries={() => {
            alert("To edit schedule settings, please go to the 'Classes' page.");
            setSelectedSession(null);
        }}
        onCancelSession={handleCancelSession}
        onRosterChange={() => refreshData(gymId)}
      />
    </div>
  );
};

export default DashboardCalendarScreen;