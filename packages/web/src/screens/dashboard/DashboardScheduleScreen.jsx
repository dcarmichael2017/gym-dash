import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Plus, Trash2, Clock, Calendar as CalendarIcon, User, Edit2,
  List, Grid, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getClasses, deleteClass, getStaffList, getMembershipTiers, getGymDetails, updateClass, getWeeklyAttendanceCounts } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';
import { ClassFormModal } from '../../components/ClassFormModal';
import { WeeklyCalendarView } from '../../components/WeeklyCalendarView';
import { SessionDetailsModal } from '../../components/SessionDetailsModal';

const DashboardScheduleScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  
  // Data State
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [membershipList, setMembershipList] = useState([]);
  const [gymData, setGymData] = useState(null);

  // View State
  const [viewMode, setViewMode] = useState('calendar');
  
  // NEW: Date Navigation State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  const [slideDirection, setSlideDirection] = useState('next');

  const [bookingCounts, setBookingCounts] = useState({});

  // --- HELPERS ---
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    // Adjust to make Monday index 0, Sunday index 6
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // Helper to get formatted date strings for API
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
    // 1. Set the animation direction based on input
    setSlideDirection(direction > 0 ? 'next' : 'prev');
    
    // 2. Update date
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    // Calculate if today is in the future or past relative to current view
    setSlideDirection(today > currentDate ? 'next' : 'prev');
    setCurrentDate(today);
  };

  // --- 1. FETCH DATA ---
  const refreshData = async (gId = gymId) => {
    if (!gId) return;
    try {
      // Get date range for current view
      const { startStr, endStr } = getWeekRange(currentDate);

      const [classRes, staffRes, memberRes, gymRes, countsRes] = await Promise.all([
        getClasses(gId),
        getStaffList(gId),
        getMembershipTiers(gId),
        getGymDetails(gId),
        // Fetch counts for this specific week
        getWeeklyAttendanceCounts(gId, startStr, endStr) 
      ]);

      if (classRes.success) setClasses(classRes.classList);
      if (staffRes.success) setStaffList(staffRes.staffList);
      if (memberRes.success) setMembershipList(memberRes.tiers);
      if (gymRes.success) setGymData(gymRes.gym);
      if (countsRes.success) setBookingCounts(countsRes.counts); // Store counts

    } catch (err) {
      console.error("Error refreshing schedule:", err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (userData?.gymId) {
          setGymId(userData.gymId);
          await refreshData(userData.gymId);
        }
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    initData();
  }, []);

  useEffect(() => {
    if (gymId) {
        refreshData(gymId);
    }
  }, [currentDate, gymId]); // Add currentDate dependency

  // --- 2. HANDLERS ---
  const handleOpenCreate = () => {
    setEditingClass(null);
    setIsClassModalOpen(true);
  };

  const handleOpenEdit = (cls) => {
    setEditingClass(cls);
    setIsClassModalOpen(true);
  };

  const handleCreateSession = ({ day, time }) => {
    setEditingClass({
        time: time,
        days: [day],
        duration: 60,
    });
    setIsClassModalOpen(true);
  };

  const handleSessionClick = (sessionData) => {
    const parentClass = classes.find(c => c.id === sessionData.classId);
    // 2. Merge the parent class data (specifically programId) into the session object
    setSelectedSession({
        ...sessionData,
        programId: parentClass?.programId || null,
        // You can also ensure instructor name is sync'd here if needed
        instructorName: getInstructorName(parentClass?.instructorId) 
    });
  };

  const handleDeleteClass = async (e, classId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this class schedule? This removes all future sessions.")) return;

    setClasses(prev => prev.filter(c => c.id !== classId));
    await deleteClass(gymId, classId);
    refreshData(gymId);
  };

  const handleCancelSession = async (classId, dateStr, affectedUsers, isRestore) => {
    try {
        const targetClass = classes.find(c => c.id === classId);
        if (!targetClass) return;

        let newCancelledDates = targetClass.cancelledDates || [];

        if (isRestore) {
            newCancelledDates = newCancelledDates.filter(d => d !== dateStr);
        } else {
            if (!newCancelledDates.includes(dateStr)) {
                newCancelledDates.push(dateStr);
            }
        }

        const result = await updateClass(gymId, classId, {
            cancelledDates: newCancelledDates
        });

        if (result.success) {
            if (!isRestore && affectedUsers?.length > 0) {
                console.log(`[System] Notification needed for ${affectedUsers.length} users about ${dateStr}`);
            }
            
            // 1. Refresh the background data (Calendar Grid)
            await refreshData(gymId);

            // 2. FIX: Manually update the Modal's state so it reflects the change instantly
            // We check if the modal is currently open for this specific session
            if (selectedSession && selectedSession.classId === classId && selectedSession.dateStr === dateStr) {
                setSelectedSession(prev => ({
                    ...prev,
                    isCancelled: !isRestore // If we are restoring, isCancelled becomes false
                }));
            }

        } else {
            alert("Failed to update session.");
        }
    } catch (error) {
        console.error("Cancellation error:", error);
    }
  };

  const getInstructorName = (id) => {
    const staff = staffList.find(s => s.id === id);
    return staff ? staff.name : 'Unassigned';
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Class Schedule</h2>
          <p className="text-gray-500">Manage your weekly timetable</p>
        </div>

        <div className="flex gap-3">
            {/* NEW: Date Navigation Controls */}
            {viewMode === 'calendar' && (
                <div className="bg-white border border-gray-200 p-1 rounded-lg flex items-center gap-1 mr-2">
                    <button onClick={() => navigateWeek(-1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={goToToday} className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded">
                        Today
                    </button>
                    <button onClick={() => navigateWeek(1)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                        <ChevronRight size={20} />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                    <span className="px-2 text-sm font-semibold text-gray-800">
                        {startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                        {' - '}
                        {new Date(new Date(startOfWeek).setDate(startOfWeek.getDate() + 6)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                </div>
            )}

          <div className="bg-white border border-gray-200 p-1 rounded-lg flex">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="List View"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Calendar View"
            >
              <Grid size={20} />
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" /> Add Class
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="flex-1 min-h-0">
            <WeeklyCalendarView
                classes={classes}
                staffList={staffList}
                currentWeekStart={startOfWeek}
                
                // PASS THE DIRECTION PROP
                slideDirection={slideDirection} 
                bookingCounts={bookingCounts}
                onEditClass={handleSessionClick}
                onCreateSession={handleCreateSession}
                onCancelSession={(cls, day) => console.log("Use Session Details to cancel")} 
            />
        </div>
      ) : (
        /* List View (unchanged) */
        <div className="space-y-4 overflow-y-auto pb-10">
            {/* ... Existing List View Code ... */}
             {classes.length === 0 && (
                <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No classes found.</p>
                </div>
              )}
              {classes
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((cls) => (
                    /* ... Same List Item Code as before ... */
                    <div key={cls.id} onClick={() => handleOpenEdit(cls)} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between group hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative">
                        <div className="flex items-start md:items-center gap-5">
                            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{cls.name}</h3>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                                    <span className="font-medium text-gray-700">{cls.time}</span>
                                    <span>{cls.duration} min</span>
                                    <span>{cls.frequency || 'Weekly'}</span>
                                    {cls.instructorId && <span className="flex items-center bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-medium ml-1"><User className="h-3 w-3 mr-1" />{getInstructorName(cls.instructorId)}</span>}
                                </div>
                                <div className="flex gap-1.5 mt-3">
                                    {cls.days.map(day => <span key={day} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">{day.slice(0, 3)}</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 md:mt-0 flex items-center justify-end gap-2">
                             <button onClick={(e) => handleDeleteClass(e, cls.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"><Trash2 className="h-5 w-5" /></button>
                        </div>
                    </div>
                ))}
        </div>
      )}

      <ClassFormModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        gymId={gymId}
        classData={editingClass}
        staffList={staffList}
        membershipList={membershipList}
        globalSettings={gymData?.booking}
        onSave={() => refreshData(gymId)}
      />

      <SessionDetailsModal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        gymId={gymId}
        onEditSeries={(classId) => {
            setSelectedSession(null);
            const cls = classes.find(c => c.id === classId);
            handleOpenEdit(cls);
        }}
        onCancelSession={handleCancelSession}
        onRosterChange={() => refreshData(gymId)}
      />
    </div>
  );
};

export default DashboardScheduleScreen;