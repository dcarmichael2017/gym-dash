import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createClass, getStaffList, getClasses, deleteClass } from '@shared/api/firestore.js';
import { Trash2, PlusCircle, CalendarX } from 'lucide-react'; // Added icons

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const frequencyOptions = ["Weekly", "Bi-Weekly", "Every Three Weeks", "Once a Month"];

export const Step4_ClassScreen = () => {
  // Form state
  const [className, setClassName] = useState('');
  const [instructor, setInstructor] = useState('');
  const [duration, setDuration] = useState('60');
  const [selectedDays, setSelectedDays] = useState([]);
  const [time, setTime] = useState('18:00');
  const [frequency, setFrequency] = useState(frequencyOptions[0]);
  
  // Data state
  const [staffList, setStaffList] = useState([]);
  const [classList, setClassList] = useState([]);
  
  // UI state
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true); // Separate state for initial data load
  const [gymId, setGymId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state && location.state.gymId) {
      const currentGymId = location.state.gymId;
      setGymId(currentGymId);
      
      const fetchData = async () => {
        setIsFetching(true);
        const staffResult = await getStaffList(currentGymId);
        const classesResult = await getClasses(currentGymId);
        
        if (staffResult.success) {
          setStaffList(staffResult.staffList);
          if (staffResult.staffList.length > 0 && !instructor) {
            setInstructor(staffResult.staffList[0].id);
          }
        } else {
          setError(staffResult.error);
        }

        if (classesResult.success) {
            setClassList(classesResult.classList);
        } else {
            setError(classesResult.error);
        }
        setIsFetching(false);
      };

      fetchData();
    } else {
      setError("Gym ID not found. Please start over.");
      setIsFetching(false);
    }
  }, [location.state, instructor]);

  const handleDayToggle = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!gymId || !className.trim()) {
      setError("Class name cannot be empty.");
      return;
    }
    if (selectedDays.length === 0) {
        setError("Please select at least one day for the class.");
        return;
    }
    setError(null);
    setIsLoading(true);

    const selectedInstructor = staffList.find(staff => staff.id === instructor);

    const classData = { 
        name: className, 
        instructorId: instructor,
        instructorName: selectedInstructor?.name || 'N/A',
        duration: parseInt(duration, 10),
        days: selectedDays,
        time,
        frequency
    };
    const result = await createClass(gymId, classData);
    setIsLoading(false);

    if (result.success) {
      setClassList(prev => [...prev, result.classData]); // Use functional update
      // Reset form
      setClassName('');
      setSelectedDays([]);
      setTime('18:00');
    } else {
      setError(result.error);
    }
  };

  const handleDeleteClass = async (classIdToDelete) => {
    if (!gymId) return;
    setClassList(prev => prev.filter(cls => cls.id !== classIdToDelete));
    const result = await deleteClass(gymId, classIdToDelete);
    if (!result.success) {
        setError(result.error);
    }
  };

  const handleNext = () => {
    navigate('/onboarding/step-5', { state: { gymId: gymId } });
  };
  
  // Reusable style for form inputs
  const inputStyles = "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 p-2 bg-white";

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Create Your Class Schedule</h2>
        <p className="text-gray-600 mt-2">Set up your first recurring class. You can add more later from your dashboard.</p>
      </div>
      
      <form onSubmit={handleAddClass} className="mb-10 p-6 border rounded-lg bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
          <div>
            <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
            <input id="className" type="text" value={className} onChange={(e) => setClassName(e.target.value)} required className={inputStyles} placeholder="e.g., Morning Yoga"/>
          </div>
          <div>
            <label htmlFor="instructor" className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
            <select id="instructor" value={instructor} onChange={(e) => setInstructor(e.target.value)} required className={inputStyles}>
              {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required className={inputStyles}/>
          </div>
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputStyles}/>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">Class Frequency</label>
            <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} required className={inputStyles}>
                {frequencyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Days of the Week</label>
            <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                    <button type="button" key={day} onClick={() => handleDayToggle(day)} className={`px-4 py-2 text-sm rounded-full transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${selectedDays.includes(day) ? 'bg-blue-600 text-white font-bold shadow-md ring-blue-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                        {day}
                    </button>
                ))}
            </div>
        </div>
        <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
          <PlusCircle size={20} />
          {isLoading ? 'Adding Class...' : 'Add Class to Schedule'}
        </button>
        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
      </form>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Your Current Schedule</h3>
        <div className="space-y-3">
            {isFetching ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading schedule...</p>
            ) : classList.length > 0 ? (
                classList.map((cls) => (
                    <div key={cls.id} className="bg-white p-4 border border-gray-200 rounded-lg flex justify-between items-center hover:shadow-sm transition-shadow">
                        <div>
                            <p className="font-semibold text-gray-900">{cls.name}</p>
                            <p className="text-sm text-gray-600">{cls.instructorName} | {cls.duration} min</p>
                            <p className="text-sm text-gray-500">{cls.frequency} on {cls.days.join(', ')} at {cls.time}</p>
                        </div>
                        <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))
            ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <CalendarX className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No classes yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Use the form above to add your first class.</p>
                </div>
            )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-10 border-t pt-6">
        <button type="button" onClick={() => navigate('/onboarding/step-3', { state: { gymId } })} className="text-sm font-medium text-gray-600 hover:underline">Back</button>
        <button type="button" onClick={handleNext} disabled={!gymId || classList.length === 0} className="bg-green-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
          Next
        </button>
      </div>
    </div>
  );
};
