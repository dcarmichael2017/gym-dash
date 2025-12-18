import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Plus, Trash2, Clock, Calendar as CalendarIcon, User } from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getClasses, deleteClass, getStaffList, getMembershipTiers, getGymDetails } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';
import { ClassFormModal } from '../../components/ClassFormModal';

const DashboardClassesScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [membershipList, setMembershipList] = useState([]);
  const [gymData, setGymData] = useState(null);

  // Modal
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);

  // --- HELPERS ---
  const getInstructorName = (id) => {
    const staff = staffList.find(s => s.id === id);
    return staff ? staff.name : 'Unassigned';
  };

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
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const init = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.data()?.gymId) {
                setGymId(snap.data().gymId);
                await refreshData(snap.data().gymId);
            }
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };
    init();
  }, []);

  const handleOpenCreate = () => {
    setEditingClass(null);
    setIsClassModalOpen(true);
  };

  const handleOpenEdit = (cls) => {
    setEditingClass(cls);
    setIsClassModalOpen(true);
  };

  const handleDeleteClass = async (e, classId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this class schedule? This removes all future sessions.")) return;
    setClasses(prev => prev.filter(c => c.id !== classId));
    await deleteClass(gymId, classId);
    refreshData(gymId);
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Classes</h2>
          <p className="text-gray-500">Manage schedules and instructors</p>
        </div>
        <button
            onClick={handleOpenCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors shadow-sm"
        >
            <Plus className="h-5 w-5 mr-2" /> Add Class
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto pb-10">
          {classes.length === 0 && (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No classes defined.</p>
                <button onClick={handleOpenCreate} className="mt-4 text-blue-600 font-medium hover:underline">Create your first class</button>
            </div>
          )}

          {classes
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((cls) => (
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
    </div>
  );
};

export default DashboardClassesScreen;