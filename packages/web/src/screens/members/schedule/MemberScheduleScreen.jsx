import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, List, Loader2, ChevronLeft, ChevronRight, Coins, XCircle, AlertCircle } from 'lucide-react';
import { useGym } from '../../../context/GymContext';
import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { 
  getClasses, 
  bookMember, 
  cancelBooking,
  getWeeklyAttendanceCounts 
} from '../../../../../../packages/shared/api/firestore';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore'; 

import MemberScheduleList from './MemberScheduleList';
import MemberCalendarView from './MemberCalendarView';
import BookingModal from './BookingModal';

const MemberScheduleScreen = () => {
  const { currentGym, memberships, credits } = useGym(); // ✅ Get credits from context
  const theme = currentGym?.theme || { primaryColor: '#2563eb', secondaryColor: '#4f46e5' };

  // Check if current member is inactive
  const currentMembership = memberships?.find(m => m.gymId === currentGym?.id);
  const isInactive = currentMembership?.status === 'inactive';

  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [weekStart, setWeekStart] = useState(new Date());

  const [counts, setCounts] = useState({});
  const [userBookings, setUserBookings] = useState({});

  const [selectedClass, setSelectedClass] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    if (!currentGym) return;
    setLoading(true);

    // 1. Get All Classes
    const classRes = await getClasses(currentGym.id);
    
    if (classRes.success) {
        const myMembership = memberships.find(m => m.gymId === currentGym.id);
        const isOwner = currentGym.ownerId === auth.currentUser?.uid;
        const isStaff = myMembership?.role === 'staff' || myMembership?.role === 'coach' || myMembership?.role === 'admin';

        const visibleClasses = classRes.classList.filter(cls => {
            const level = cls.visibility || 'public'; 
            if (isOwner) return true;
            if (isStaff) return level !== 'admin'; 
            return level === 'public';
        });

        setClasses(visibleClasses);
    }

    // 2. Define Time Range
    const getLocalDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const startStr = getLocalDateString(weekStart);
    
    // ✅ FIX: Increased fetch range from 7 to 14 days to match MemberScheduleList loop
    const endObj = new Date(weekStart);
    endObj.setDate(weekStart.getDate() + 14); 
    const endStr = getLocalDateString(endObj);

    // 3. Get Capacity Counts
    const countRes = await getWeeklyAttendanceCounts(currentGym.id, startStr, endStr);
    if (countRes.success) setCounts(countRes.counts);

    // 4. Get Current User's Status
    if (auth.currentUser) {
       const attRef = collection(db, "gyms", currentGym.id, "attendance");
       const q = query(
         attRef,
         where("memberId", "==", auth.currentUser.uid),
         where("dateString", ">=", startStr),
         where("dateString", "<=", endStr),
         where("status", "in", ["booked", "waitlisted", "attended"]) 
       );
       const snap = await getDocs(q);
       const bookingMap = {};
       snap.forEach(doc => {
         const data = doc.data();
         const key = `${data.classId}_${data.dateString}`;
         
         bookingMap[key] = { 
             status: data.status, 
             id: doc.id, 
             checkedInAt: data.checkedInAt,
             bookingType: data.bookingType, 
             cost: data.costUsed,          
             attendanceId: doc.id,
             
             // ✅ ADD THIS LINE: Pass the snapshot to the UI
             bookingRulesSnapshot: data.bookingRulesSnapshot || null 
         }; 
       });
       setUserBookings(bookingMap);
    }

    setLoading(false);
  }, [currentGym, weekStart, memberships]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- HANDLERS ---
  const handleClassClick = (classInstance) => {
    const bookingKey = `${classInstance.id}_${classInstance.dateString}`;
    const userState = userBookings[bookingKey]; 
    const currentCount = counts[bookingKey] || 0;

    setSelectedClass({
      ...classInstance,
      userStatus: userState?.status || null, 
      attendanceId: userState?.id || null, 
      currentCount: currentCount,
      bookingType: userState?.bookingType,
      cost: userState?.cost,
      bookingRulesSnapshot: userState?.bookingRulesSnapshot || null
    });
    setIsBookingModalOpen(true);
  };

  const processBooking = async (classInstance, options = {}) => {
    if (!auth.currentUser) return { success: false, error: "Not logged in" };

    const currentUserProfile = {
      id: auth.currentUser.uid,
      name: auth.currentUser.displayName || "Member",
      photoUrl: auth.currentUser.photoURL,
      memberships: memberships, 
      status: memberships.find(m => m.gymId === currentGym.id)?.status || 'prospect'
    };

    const result = await bookMember(currentGym.id, classInstance, currentUserProfile, options);
    if (result.success) fetchData(); 
    return result;
  };

  const processCancellation = async (attendanceId) => {
    const result = await cancelBooking(currentGym.id, attendanceId);
    if (result.success) fetchData(); 
    return result;
  };

  const changeWeek = (direction) => {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newDate);
  };

  if (loading && classes.length === 0) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" /></div>;

  // Show inactive message if member is inactive
  if (isInactive) {
    return (
      <div className="pb-24 safe-top">
        <div className="sticky top-0 bg-white z-30 px-6 py-4 border-b border-gray-100 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        </div>
        <div className="p-6 flex items-center justify-center min-h-[80vh]">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-8 shadow-md max-w-md border-2 border-red-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <XCircle size={32} className="text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Schedule Unavailable</h2>
              <p className="text-sm text-gray-700 mb-4">
                Your membership has been disabled by the gym administrator. You cannot view or book classes at this time.
              </p>
              <div className="bg-white/60 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-900 text-left">
                  Please contact the gym owner or staff to restore access to your account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 safe-top">
      {/* HEADER */}
      <div className="sticky top-0 bg-white z-30 px-6 py-4 border-b border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
            {/* ✅ CHANGE: Use credits from context */}
            {credits > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200 animate-in fade-in slide-in-from-left-2">
                    <Coins size={14} className="fill-purple-700/20" />
                    <span>{credits} Credit{credits !== 1 ? 's' : ''}</span>
                </div>
            )}
          </div>

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

      {/* CONTENT */}
      <div className="p-4 bg-gray-50 min-h-[80vh]">
        {viewMode === 'list' ? (
          <MemberScheduleList
            classes={classes}
            theme={theme}
            onBook={handleClassClick}
            counts={counts}
            userBookings={userBookings}
            userCredits={credits} // ✅ Pass credits
            memberships={memberships} // ✅ Pass memberships
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