import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import {
  getStaffList,
  getClasses,
  deleteClass,
  updateUserOnboardingStep,
  getMembershipTiers
} from '../../../../shared/api/firestore.js'; // Check your relative path here
import { Trash2, Plus, Calendar as CalendarIcon, Clock, User } from 'lucide-react';

// Import the reusable component
// Adjust path if necessary based on your folder structure
import { ClassFormModal } from '../../components/ClassFormModal';

export const Step4_ClassScreen = () => {
  // Data state
  const [staffList, setStaffList] = useState([]);
  const [classList, setClassList] = useState([]);
  const [membershipList, setMembershipList] = useState([]);
  
  // UI state
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [gymId, setGymId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null); // For editing

  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch Data
  const refreshData = async (currentGymId) => {
    if (classList.length === 0) setIsFetching(true);
    
    // Fetch all 3 resources
    const [staffResult, classesResult, memberResult] = await Promise.all([
       getStaffList(currentGymId),
       getClasses(currentGymId),
       getMembershipTiers(currentGymId)
    ]);
    
    if (staffResult.success) setStaffList(staffResult.staffList);
    if (classesResult.success) setClassList(classesResult.classList);
    if (memberResult.success) setMembershipList(memberResult.tiers); // Set logic
    // Handle errors if needed, usually just log them
    
    setIsFetching(false);
  };

  useEffect(() => {
    if (location.state && location.state.gymId) {
      const currentGymId = location.state.gymId;
      setGymId(currentGymId);
      refreshData(currentGymId);
    } else {
      setError("Gym ID not found. Please start over.");
      setIsFetching(false);
    }
  }, [location.state]);

  // Actions
  const handleDeleteClass = async (e, classIdToDelete) => {
    e.stopPropagation();
    if (!gymId) return;
    if(!window.confirm("Remove this class?")) return;

    // Optimistic update
    setClassList(prev => prev.filter(cls => cls.id !== classIdToDelete));
    
    const result = await deleteClass(gymId, classIdToDelete);
    if (!result.success) {
        setError(result.error);
        refreshData(gymId); // Revert on error
    }
  };

  const handleOpenAdd = () => {
    setSelectedClass(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cls) => {
    setSelectedClass(cls);
    setIsModalOpen(true);
  };

  const handleNext = async () => {
    if (!user) return;
    setIsNavigating(true);
    setError(null);

    const stepResult = await updateUserOnboardingStep(user.uid, 'step5_appPreview');

    if (stepResult.success) {
      navigate('/onboarding/step-5', { state: { gymId: gymId } });
    } else {
      setError("Failed to save progress. Please try again.");
    }
    setIsNavigating(false);
  };

  // Helper for display
  const getInstructorName = (id) => {
    const staff = staffList.find(s => s.id === id);
    return staff ? staff.name : 'Unassigned';
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Create Your Class Schedule</h2>
        <p className="text-gray-600 mt-2">Set up your initial schedule. You can easily change this later.</p>
      </div>
      
      {/* --- ACTION BAR --- */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Weekly Classes</h3>
        <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
            <Plus size={18} />
            Add Class
        </button>
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

      {/* --- LIST VIEW --- */}
      <div className="space-y-3 mb-10 min-h-[200px]">
        {isFetching ? (
            <p className="text-sm text-gray-500 text-center py-10">Loading schedule...</p>
        ) : classList.length > 0 ? (
            classList
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((cls) => (
                <div 
                    key={cls.id} 
                    onClick={() => handleOpenEdit(cls)}
                    className="bg-white p-4 border border-gray-200 rounded-lg flex justify-between items-center hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                >
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{cls.name}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                                <span className="font-mono text-gray-700 bg-gray-100 px-1.5 rounded">{cls.time}</span>
                                <span>•</span>
                                <span>{cls.duration} min</span>
                                {cls.instructorId && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center text-blue-600">
                                            <User size={12} className="mr-1"/> {getInstructorName(cls.instructorId)}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-1 mt-2">
                                {cls.days.map(day => (
                                    <span key={day} className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {day.slice(0,3)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={(e) => handleDeleteClass(e, cls.id)}
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Remove Class"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))
        ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-gray-900 font-medium">Schedule is empty</h3>
                <p className="text-gray-500 text-sm mb-4">Add your first class to get started.</p>
                <button onClick={handleOpenAdd} className="text-blue-600 font-medium hover:underline text-sm">
                    Create a Class
                </button>
            </div>
        )}
      </div>

      {/* --- FOOTER NAVIGATION --- */}
      <div className="flex justify-between items-center border-t pt-6">
        <button 
            type="button" 
            onClick={() => navigate('/onboarding/step-3', { state: { gymId } })} 
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
            Back to Staff
        </button>
        <button
          type="button"
          onClick={handleNext}
          // Optional: You can enforce having at least 1 class, or allow skipping
          disabled={!gymId || isNavigating} 
          className="bg-green-600 text-white font-semibold py-2 px-8 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isNavigating ? 'Saving...' : 'Next Step'}
        </button>
      </div>

      {/* --- REUSABLE MODAL --- */}
      <ClassFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gymId={gymId}
        classData={selectedClass}
        staffList={staffList}
        membershipList={membershipList} // Pass the list
        onSave={() => refreshData(gymId)}
      />
    </div>
  );
};