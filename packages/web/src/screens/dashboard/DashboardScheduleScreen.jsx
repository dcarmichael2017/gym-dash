import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Plus, Trash2, Clock, Calendar as CalendarIcon, User, Edit2,
  List, Grid
} from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getClasses, deleteClass, getStaffList, getMembershipTiers, getGymDetails, updateClass } from '../../../../shared/api/firestore';
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
  const [viewMode, setViewMode] = useState('calendar'); // Default to Calendar

  // Modal State
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null); // Use this consistently
  const [selectedSession, setSelectedSession] = useState(null);

  // --- 1. FETCH DATA ---
  const refreshData = async (gId = gymId) => {
    if (!gId) return;
    try {
      const [classRes, staffRes, memberRes, gymRes] = await Promise.all([
        getClasses(gId),
        getStaffList(gId),
        getMembershipTiers(gId),
        getGymDetails(gId) 
      ]);

      if (classRes.success) setClasses(classRes.classList);
      if (staffRes.success) setStaffList(staffRes.staffList);
      if (memberRes.success) setMembershipList(memberRes.tiers);
      if (gymRes.success) setGymData(gymRes.gym);
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

  // --- 2. HANDLERS ---

  // A. Open Create Modal (Empty)
  const handleOpenCreate = () => {
    setEditingClass(null);
    setIsClassModalOpen(true);
  };

  // B. Open Edit Modal (Existing Class)
  const handleOpenEdit = (cls) => {
    setEditingClass(cls);
    setIsClassModalOpen(true);
  };

  // C. Handle Calendar Empty Slot Click (Pre-filled Create)
  const handleCreateSession = ({ day, time }) => {
    setEditingClass({
        time: time,
        days: [day], // Pre-select the clicked day
        duration: 60,
    });
    setIsClassModalOpen(true);
  };

  // D. Handle Calendar Class Click (Open Session Details)
  const handleSessionClick = (sessionData) => {
    setSelectedSession(sessionData);
  };

  // E. Handle Deleting Entire Series
  const handleDeleteClass = async (e, classId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this class schedule? This removes all future sessions.")) return;

    setClasses(prev => prev.filter(c => c.id !== classId));
    await deleteClass(gymId, classId);
    refreshData(gymId);
  };

  // F. Handle Cancelling Single Session
  const handleCancelSession = async (classId, dateStr, affectedUsers, isRestore) => {
    try {
        // 1. Find class data
        const targetClass = classes.find(c => c.id === classId);
        if (!targetClass) return;

        let newCancelledDates = targetClass.cancelledDates || [];

        if (isRestore) {
            // Remove date from array to restore it
            newCancelledDates = newCancelledDates.filter(d => d !== dateStr);
        } else {
            // Add date to array to cancel it
            if (!newCancelledDates.includes(dateStr)) {
                newCancelledDates.push(dateStr);
            }
        }

        // 2. Update Firestore
        const result = await updateClass(gymId, classId, {
            cancelledDates: newCancelledDates
        });

        if (result.success) {
            // 3. Notification Placeholder
            if (!isRestore && affectedUsers?.length > 0) {
                console.log(`[System] Notification needed for ${affectedUsers.length} users about ${dateStr}`);
            }
            
            // 4. Refresh UI
            await refreshData(gymId);
            
            // Note: SessionDetailsModal handles closing itself if needed, 
            // but updating the parent data ensures the calendar re-renders greyed out.
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
          {/* View Toggles */}
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

      {/* --- CONDITIONAL RENDER --- */}
      {viewMode === 'calendar' ? (
        <div className="flex-1 min-h-0">
            <WeeklyCalendarView
            classes={classes}
            staffList={staffList}
            // Clicking block opens Session Details
            onEditClass={handleSessionClick}
            // Clicking empty slot opens Create Form
            onCreateSession={handleCreateSession}
            // (Optional) Quick Cancel from Calendar view directly
            onCancelSession={(cls, day) => console.log("Use Session Details to cancel")} 
            />
        </div>
      ) : (
        /* List View Implementation */
        <div className="space-y-4 overflow-y-auto pb-10">
          {classes.length === 0 && (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No classes found.</p>
            </div>
          )}

          {classes
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((cls) => (
              <div
                key={cls.id}
                onClick={() => handleOpenEdit(cls)}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between group hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative"
              >
                <div className="flex items-start md:items-center gap-5">
                  <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                      {cls.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="font-medium text-gray-700">{cls.time}</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span>{cls.duration} min</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span>{cls.frequency || 'Weekly'}</span>

                      {cls.instructorId && (
                        <span className="flex items-center bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-medium ml-1">
                          <User className="h-3 w-3 mr-1" />
                          {getInstructorName(cls.instructorId)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1.5 mt-3">
                      {cls.days.map(day => (
                        <span key={day} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">
                          {day.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 flex items-center justify-end gap-2">
                  <span className="text-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                    Click to edit
                  </span>
                  <button
                    onClick={(e) => handleDeleteClass(e, cls.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
                    title="Delete Class Series"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* --- REUSABLE MODAL: CREATE / EDIT SERIES --- */}
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

      {/* --- SESSION DETAILS MODAL: ROSTER & CANCEL --- */}
      <SessionDetailsModal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        session={selectedSession}
        gymId={gymId}
        
        // "Edit Series" Button Action
        onEditSeries={(classId) => {
            setSelectedSession(null); // Close details
            // Find class object and open edit form
            const cls = classes.find(c => c.id === classId);
            handleOpenEdit(cls);
        }}
        
        // "Cancel Session" Button Action
        onCancelSession={handleCancelSession}
      />
    </div>
  );
};

export default DashboardScheduleScreen;