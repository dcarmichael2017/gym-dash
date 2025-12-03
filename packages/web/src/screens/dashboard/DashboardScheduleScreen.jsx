//packages/web/src/screens/dashboard/DashboardScheduleScreen.jsx

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Plus, Trash2, Clock, Calendar as CalendarIcon, X } from 'lucide-react';

// Relative Imports
import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getClasses, createClass, deleteClass } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';

const DashboardScheduleScreen = () => {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [gymId, setGymId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [newClass, setNewClass] = useState({
    name: '',
    time: '09:00',
    duration: 60,
    days: [],
    instructor: '' // Optional for now
  });

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // 1. Fetch Data on Mount
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
          await loadClasses(userData.gymId);
        }
      } catch (error) {
        console.error("Error loading schedule:", error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const loadClasses = async (id) => {
    const result = await getClasses(id);
    if (result.success) {
      setClasses(result.classList);
    }
  };

  // 2. Form Handlers
  const handleDayToggle = (day) => {
    setNewClass(prev => {
      const days = prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day];
      return { ...prev, days };
    });
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!gymId) return;

    // Basic validation
    if (!newClass.name || newClass.days.length === 0) {
      alert("Please enter a class name and select at least one day.");
      return;
    }

    setLoading(true);
    const result = await createClass(gymId, newClass);
    if (result.success) {
      // Refresh list and reset form
      await loadClasses(gymId);
      setIsAdding(false);
      setNewClass({ name: '', time: '09:00', duration: 60, days: [], instructor: '' });
    } else {
      alert("Failed to create class");
    }
    setLoading(false);
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm("Are you sure you want to delete this class?")) return;
    
    // Optimistic update (remove from UI immediately)
    setClasses(prev => prev.filter(c => c.id !== classId));
    
    const result = await deleteClass(gymId, classId);
    if (!result.success) {
      alert("Failed to delete class");
      // Revert if failed
      await loadClasses(gymId);
    }
  };

  if (loading && !gymId) return <FullScreenLoader />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Class Schedule</h2>
          <p className="text-gray-500">Manage your weekly class timetable</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isAdding 
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isAdding ? (
            <> <X className="h-4 w-4 mr-2" /> Cancel </>
          ) : (
            <> <Plus className="h-4 w-4 mr-2" /> Add Class </>
          )}
        </button>
      </div>

      {/* --- ADD CLASS FORM (Inline) --- */}
      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-semibold text-gray-800 mb-4">Add New Class</h3>
          <form onSubmit={handleAddClass}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Morning Jiu Jitsu"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newClass.name}
                  onChange={e => setNewClass({...newClass, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input 
                    type="time" 
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newClass.time}
                    onChange={e => setNewClass({...newClass, time: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <input 
                    type="number" 
                    required
                    min="15"
                    step="15"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newClass.duration}
                    onChange={e => setNewClass({...newClass, duration: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Repeats On</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      newClass.days.includes(day)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {day.slice(0,3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- CLASS LIST --- */}
      <div className="space-y-4">
        {classes.length === 0 && !loading && (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <CalendarIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No classes found. Add your first class above!</p>
          </div>
        )}

        {classes
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((cls) => (
          <div key={cls.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between group">
            <div className="flex items-start md:items-center gap-4">
              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{cls.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
                  <span className="font-medium text-gray-700">{cls.time}</span>
                  <span>•</span>
                  <span>{cls.duration} min</span>
                  <span>•</span>
                  <div className="flex gap-1">
                    {cls.days.map(day => (
                       <span key={day} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{day.slice(0,3)}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 md:mt-0 flex items-center justify-end">
              <button 
                onClick={() => handleDeleteClass(cls.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Class"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardScheduleScreen;