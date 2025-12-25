import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, List, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGym } from '../../../context/GymContext';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';
import { 
  getClasses, 
  bookMember, 
  cancelBooking,
  getWeeklyAttendanceCounts, 
  getMemberSchedule // You might need to create this simple query helper
} from '../../../../../../packages/shared/api/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore'; // Import needed for inline query
import { db } from '../../../../../../packages/shared/api/firebaseConfig';

import MemberScheduleList from './MemberScheduleList';
import MemberCalendarView from './MemberCalendarView';
import BookingModal from './BookingModal';

const MemberScheduleScreen = () => {
  const { currentGym, memberships } = useGym();
  const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };
  
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [weekStart, setWeekStart] = useState(new Date());
  
  // --- NEW STATE FOR STATUSES ---
  const [counts, setCounts] = useState({}); // { "classId_date": 5 }
  const [userBookings, setUserBookings] = useState({}); // { "classId_date": { status: 'booked', id: 'attendanceDocId' } }

  const [selectedClass, setSelectedClass] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    if (!currentGym) return;
    setLoading(true);

    // 1. Get Class Definitions
    const classRes = await getClasses(currentGym.id);
    if (classRes.success) setClasses(classRes.classList);

    // 2. Define Time Range for Data (Current Week)
    const startStr = weekStart.toISOString().split('T')[0];
    const endObj = new Date(weekStart);
    endObj.setDate(weekStart.getDate() + 7);
    const endStr = endObj.toISOString().split('T')[0];

    // 3. Get Capacity Counts
    const countRes = await getWeeklyAttendanceCounts(currentGym.id, startStr, endStr);
    if (countRes.success) setCounts(countRes.counts);

    // 4. Get Current User's Status (Inline query for MVP)
    if (auth.currentUser) {
       const attRef = collection(db, "gyms", currentGym.id, "attendance");
       const q = query(
          attRef,
          where("memberId", "==", auth.currentUser.uid),
          where("dateString", ">=", startStr),
          where("dateString", "<=", endStr),
          where("status", "in", ["booked", "waitlisted", "attended"]) // Don't fetch cancelled
       );
       const snap = await getDocs(q);
       const bookingMap = {};
       snap.forEach(doc => {
          const data = doc.data();
          const key = `${data.classId}_${data.dateString}`;
          bookingMap[key] = { status: data.status, id: doc.id, checkedInAt: data.checkedInAt }; // Save Status and Doc ID (for cancelling)
       });
       setUserBookings(bookingMap);
    }

    setLoading(false);
  }, [currentGym, weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- HANDLERS ---
  const handleClassClick = (classInstance) => {
    // Inject current status into the instance before opening modal
    const bookingKey = `${classInstance.id}_${classInstance.dateString}`;
    const userState = userBookings[bookingKey];
    const currentCount = counts[bookingKey] || 0;

    setSelectedClass({
      ...classInstance,
      userStatus: userState?.status || null, // 'booked', 'waitlisted', or null
      attendanceId: userState?.id || null,   // Needed to cancel
      currentCount: currentCount
    });
    setIsBookingModalOpen(true);
  };

  const processBooking = async (classInstance) => {
    if (!auth.currentUser) return { success: false, error: "Not logged in" };

    const currentUserProfile = {
      id: auth.currentUser.uid,
      name: auth.currentUser.displayName || "Member",
      photoUrl: auth.currentUser.photoURL,
      memberships: memberships, 
      status: memberships.find(m => m.gymId === currentGym.id)?.status || 'prospect'
    };

    const result = await bookMember(currentGym.id, classInstance, currentUserProfile);
    if (result.success) fetchData(); // Refresh UI
    return result;
  };

  const processCancellation = async (attendanceId) => {
    const result = await cancelBooking(currentGym.id, attendanceId);
    if (result.success) fetchData(); // Refresh UI
    return result;
  };

  const changeWeek = (direction) => {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newDate);
  };

  if (loading && classes.length === 0) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="pb-24 safe-top">
      <div className="sticky top-0 bg-white z-30 px-6 py-4 border-b border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
              <List size={20} />
            </button>
            <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
              <Calendar size={20} />
            </button>
          </div>
        </div>
        {viewMode === 'calendar' && (
          <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mb-2">
            <button onClick={() => changeWeek('prev')} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft size={20}/></button>
            <span className="font-semibold text-sm">Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <button onClick={() => changeWeek('next')} className="p-1 hover:bg-gray-200 rounded"><ChevronRight size={20}/></button>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 min-h-[80vh]">
        {viewMode === 'list' ? (
          <MemberScheduleList 
            classes={classes} 
            theme={theme} 
            onBook={handleClassClick}
            counts={counts}
            userBookings={userBookings}
          />
        ) : (
          <MemberCalendarView 
            classes={classes} 
            weekStart={weekStart} 
            theme={theme}
            onBook={handleClassClick}
            counts={counts}
            userBookings={userBookings}
          />
        )}
      </div>

      {isBookingModalOpen && selectedClass && (
        <BookingModal 
          classInstance={selectedClass}
          onClose={() => setIsBookingModalOpen(false)}
          onConfirm={processBooking}
          onCancel={processCancellation}
          theme={theme}
        />
      )}
    </div>
  );
};

export default MemberScheduleScreen;