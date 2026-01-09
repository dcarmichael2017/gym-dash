import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Plus, Trash2, Clock, Calendar as CalendarIcon, User, CalendarDays, Layers, RotateCcw, Archive } from 'lucide-react';

import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getClasses, handleClassSeriesRetirement, getStaffList, getMembershipTiers, getGymDetails, unarchiveClass, getFutureBookingsForClass } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/common/FullScreenLoader';
import { useConfirm } from '../../context/ConfirmationContext';
import { ClassFormModal } from '../../components/admin/ClassFormModal';

const DashboardClassesScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [membershipList, setMembershipList] = useState([]);
  const [gymData, setGymData] = useState(null);

  // Tab State: 'weekly' or 'events'
  const [viewMode, setViewMode] = useState('weekly');

  // Modal
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const { confirm } = useConfirm();

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
    const todayStr = new Date().toISOString().split('T')[0];
    const futureBookingsRes = await getFutureBookingsForClass(gymId, classId, todayStr);
    const hasFutureBookings = futureBookingsRes.success && futureBookingsRes.bookings.length > 0;
    
    let confirmed = false;
    let refundPolicy = 'none';

    if (hasFutureBookings) {
        const bookingCount = futureBookingsRes.bookings.length;
        confirmed = await confirm({
            title: "Impact Review",
            message: `This series has ${bookingCount} upcoming booking(s). Archiving will cancel them.`,
            confirmText: "Refund Credits & Archive",
            cancelText: "Cancel",
            type: 'danger'
        });
        if (confirmed) refundPolicy = 'refund';

    } else {
        confirmed = await confirm({
            title: "Retire Class Series?",
            message: "No future bookings found. This will archive or delete the series based on its past history.",
            confirmText: "Yes, Retire",
            cancelText: "Cancel",
        });
    }

    if (confirmed) {
        const result = await handleClassSeriesRetirement(gymId, classId, refundPolicy);
        if (result.success) {
            let title = "Success";
            let message = "";
            if (result.action === 'deleted') {
                message = "The class series was permanently deleted.";
            } else {
                message = `The class series was archived. ${result.refundedCount || 0} future booking(s) were refunded.`;
            }
            await confirm({ title, message, confirmText: "OK", cancelText: null });
            refreshData(gymId);
        } else {
            await confirm({ title: "Error", message: `Failed to retire series: ${result.error}`, confirmText: "OK", cancelText: null });
        }
    }
  };

  const handleRestoreClass = async (e, classId) => {
    e.stopPropagation();
    const confirmed = await confirm({
        title: "Restore Class Series?",
        message: "This class will become public and reappear on the schedule.",
        confirmText: "Yes, Restore"
    });

    if (confirmed) {
        const result = await unarchiveClass(gymId, classId);
        if (result.success) {
            await confirm({ title: "Success", message: "The class series was restored.", confirmText: "OK", cancelText: null });
            refreshData(gymId);
        } else {
            await confirm({ title: "Error", message: `Failed to restore series: ${result.error}`, confirmText: "OK", cancelText: null });
        }
    }
  };

  // Filter Logic
  const filteredClasses = classes.filter(cls => {
    if (viewMode === 'weekly') {
      return cls.frequency !== 'Single Event';
    } else {
      return cls.frequency === 'Single Event';
    }
  });

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

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setViewMode('weekly')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <CalendarDays size={16} /> Weekly Schedule
        </button>
        <button
          onClick={() => setViewMode('events')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'events' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Layers size={16} /> One-Off Events
        </button>
      </div>

      {/* List */}
      <div className="space-y-4 overflow-y-auto pb-10">
        {filteredClasses.length === 0 && (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {viewMode === 'weekly' ? 'No recurring classes found.' : 'No upcoming events found.'}
            </p>
            <button onClick={handleOpenCreate} className="mt-4 text-blue-600 font-medium hover:underline">
              Create your first {viewMode === 'weekly' ? 'class' : 'event'}
            </button>
          </div>
        )}

        {filteredClasses
          .sort((a, b) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const aIsArchived = a.recurrenceEndDate && a.recurrenceEndDate < todayStr;
            const bIsArchived = b.recurrenceEndDate && b.recurrenceEndDate < todayStr;
            if (aIsArchived && !bIsArchived) return 1;
            if (!aIsArchived && bIsArchived) return -1;
            
            if (viewMode === 'events') {
              return new Date(a.startDate) - new Date(b.startDate);
            }
            return a.time.localeCompare(b.time);
          })
          .map((cls) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const isArchived = cls.recurrenceEndDate && cls.recurrenceEndDate <= todayStr;
            console.log(`Class: ${cls.name}, EndDate: ${cls.recurrenceEndDate}, Today: ${todayStr}, IsArchived: ${isArchived}`);

            return (
              <div 
                  key={cls.id} 
                  onClick={() => !isArchived && handleOpenEdit(cls)} 
                  className={`bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between group transition-all relative ${
                      isArchived 
                          ? 'bg-gray-100 border-gray-200' 
                          : 'border-gray-200 hover:shadow-md hover:border-blue-200 cursor-pointer'
                  }`}
              >
                {isArchived && (
                  <div className="absolute top-3 right-3 bg-gray-200 text-gray-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Archive size={10} /> Archived
                  </div>
                )}
                <div className={`flex items-start md:items-center gap-5 ${isArchived ? 'opacity-60' : ''}`}>
                  {/* Icon Box */}
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      cls.frequency === 'Single Event' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                     {cls.frequency === 'Single Event' ? <Layers className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                  </div>

                  <div>
                    <h3 className={`font-bold text-lg transition-colors ${
                        isArchived ? 'text-gray-600' : 'text-gray-800 group-hover:text-blue-600'
                    }`}>
                        {cls.name}
                    </h3>
                    
                    {/* Metadata Row */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="font-medium text-gray-700">{cls.time}</span>
                      <span>{cls.duration} min</span>
                      {cls.frequency === 'Single Event' ? (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-xs font-bold border border-purple-200 flex items-center gap-1">
                          <CalendarIcon size={12} /> {cls.startDate}
                        </span>
                      ) : (
                        <span>{cls.frequency || 'Weekly'}</span>
                      )}
                      {cls.instructorId && (
                          <span className="flex items-center bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-medium ml-1">
                              <User className="h-3 w-3 mr-1" />
                              {getInstructorName(cls.instructorId)}
                          </span>
                      )}
                    </div>

                    {/* Days of Week (Only for Recurring) */}
                    {cls.frequency !== 'Single Event' && (
                      <div className="flex gap-1.5 mt-3">
                        {cls.days.map(day => (
                            <span key={day} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">
                                {day.slice(0, 3)}
                            </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-4 md:mt-0 flex items-center justify-end gap-2">
                  {isArchived ? (
                    <button 
                        onClick={(e) => handleRestoreClass(e, cls.id)} 
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors z-10"
                        title="Restore Class Series"
                    >
                        <RotateCcw className="h-5 w-5" />
                    </button>
                  ) : (
                    <button 
                        onClick={(e) => handleDeleteClass(e, cls.id)} 
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
                        title="Retire Class Series"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
        initialViewMode={viewMode}
      />
    </div>
  );
};

export default DashboardClassesScreen;
