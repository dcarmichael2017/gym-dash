// /packages/web/src/screens/onboarding/Step4_ClassScreen.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createClass, getStaffList, getClasses, deleteClass } from '../../../../shared/api/firestore.js';
import { Trash2 } from 'lucide-react'; // Icon for delete button

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
  const [gymId, setGymId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state && location.state.gymId) {
      const currentGymId = location.state.gymId;
      setGymId(currentGymId);
      
      const fetchData = async () => {
        setIsLoading(true);
        const staffResult = await getStaffList(currentGymId);
        const classesResult = await getClasses(currentGymId);
        
        if (staffResult.success) {
          setStaffList(staffResult.staffList);
          if (staffResult.staffList.length > 0) setInstructor(staffResult.staffList[0].id);
        } else {
          setError(staffResult.error);
        }

        if (classesResult.success) {
            setClassList(classesResult.classList);
        } else {
            setError(classesResult.error);
        }
        setIsLoading(false);
      };

      fetchData();
    } else {
      setError("Gym ID not found. Please start over.");
    }
  }, [location.state]);

  const handleDayToggle = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!gymId || selectedDays.length === 0) {
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
        frequency // Add frequency to the data
    };
    const result = await createClass(gymId, classData);
    setIsLoading(false);

    if (result.success) {
      setClassList([...classList, result.classData]);
      setClassName('');
      setSelectedDays([]);
    } else {
      setError(result.error);
    }
  };

  const handleDeleteClass = async (classIdToDelete) => {
    if (!gymId) return;

    // Optimistically remove from UI
    setClassList(prev => prev.filter(cls => cls.id !== classIdToDelete));
    
    const result = await deleteClass(gymId, classIdToDelete);
    if (!result.success) {
        setError(result.error);
        // If the delete failed, we would ideally add the class back to the list
        // For simplicity now, we just show an error.
    }
  };

  const handleNext = () => {
    navigate('/onboarding/step-5', { state: { gymId: gymId } });
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-3xl">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Create Your Class Schedule</h2>
      <p className="text-center text-gray-600 mb-6">Set up the recurring classes that will appear on your schedule.</p>
      
      <form onSubmit={handleAddClass} className="mb-8 p-6 border rounded-lg bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
            <input id="className" type="text" value={className} onChange={(e) => setClassName(e.target.value)} required className="w-full input"/>
          </div>
          <div>
            <label htmlFor="instructor" className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
            <select id="instructor" value={instructor} onChange={(e) => setInstructor(e.target.value)} required className="w-full input">
              {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required className="w-full input"/>
          </div>
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="w-full input"/>
          </div>
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">Class Frequency</label>
            <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} required className="w-full input">
                {frequencyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
                <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Days of the Week</label>
            <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                    <button type="button" key={day} onClick={() => handleDayToggle(day)} className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ease-in-out focus:outline-none ${selectedDays.includes(day) ? 'bg-blue-600 text-white font-bold shadow-lg ring-2 ring-blue-500 ring-offset-2' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                        {day}
                    </button>
                ))}
            </div>
        </div>
        <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors">

        </button>
        {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
      </form>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-800 mb-3">Current Schedule</h3>
        <div className="space-y-3">
            {classList.length > 0 ? (
                classList.map((cls) => (
                    <div key={cls.id} className="bg-white p-4 border rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-gray-900">{cls.name}</p>
                            <p className="text-sm text-gray-600">{cls.instructorName} | {cls.duration} min</p>
                            <p className="text-sm text-gray-500">{cls.frequency} on {cls.days.join(', ')} at {cls.time}</p>
                        </div>
                        <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))
            ) : (
                <p className="text-sm text-gray-500 text-center py-4">{isLoading ? "Loading..." : "No classes added yet."}</p>
            )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-8">
        <button type="button" onClick={() => navigate('/onboarding/step-3', { state: { gymId } })} className="text-sm font-medium text-gray-600 hover:underline">Back</button>
        <button type="button" onClick={handleNext} disabled={!gymId} className="bg-green-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-green-700 transition-colors">Next</button>
      </div>
    </div>
  );
};

