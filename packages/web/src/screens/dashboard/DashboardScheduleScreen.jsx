import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Plus, Trash2, Clock, Calendar as CalendarIcon, User, Edit2, 
  List, Grid // New Icons
} from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getClasses, deleteClass, getStaffList, getMembershipTiers } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';
import { ClassFormModal } from '../../components/ClassFormModal';
import { WeeklyCalendarView } from '../../components/WeeklyCalendarView'; // Import the new view

const DashboardScheduleScreen = () => {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [gymId, setGymId] = useState(null);
  
  // View State
  const [viewMode, setViewMode] = useState('list'); // Default to Calendar

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [membershipList, setMembershipList] = useState([]);

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

  const refreshData = async (gId) => {
    const [classRes, staffRes, memberRes] = await Promise.all([
        getClasses(gId),
        getStaffList(gId),
        getMembershipTiers(gId)
    ]);

    if (classRes.success) setClasses(classRes.classList);
    if (staffRes.success) setStaffList(staffRes.staffList);
    
    // Now memberRes is defined, so this won't crash
    if (memberRes.success) setMembershipList(memberRes.tiers);
  };

  const handleOpenCreate = () => {
    setSelectedClass(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cls) => {
    setSelectedClass(cls);
    setIsModalOpen(true);
  };

  const handleDeleteClass = async (e, classId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this class schedule?")) return;
    
    setClasses(prev => prev.filter(c => c.id !== classId)); // Optimistic
    await deleteClass(gymId, classId);
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
          <WeeklyCalendarView 
            classes={classes} 
            staffList={staffList} 
            onEditClass={handleOpenEdit} 
          />
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
                            {day.slice(0,3)}
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
                        title="Delete Class"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                </div>
            </div>
            ))}
        </div>
      )}

      {/* --- REUSABLE MODAL --- */}
      <ClassFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gymId={gymId}
        classData={selectedClass}
        staffList={staffList}
        membershipList={membershipList} // Pass the list here
        onSave={() => refreshData(gymId)}
      />
    </div>
  );
};

export default DashboardScheduleScreen;