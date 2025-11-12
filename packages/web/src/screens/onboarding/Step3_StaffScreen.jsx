// /packages/web/src/screens/onboarding/Step3_StaffScreen.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import {
  addStaffMember,
  getStaffList,
  updateUserOnboardingStep // --- 1. ADDED IMPORT ---
} from '../../../../shared/api/firestore.js';

export const Step3_StaffScreen = () => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // For adding staff
  const [isNavigating, setIsNavigating] = useState(false); // --- 2. ADDED STATE --- (For 'Next' button)
  const [gymId, setGymId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // --- 3. ADDED AUTH ---
  const auth = getAuth();
  const user = auth.currentUser;

  // This useEffect now runs once when the component loads
  useEffect(() => {
    if (location.state && location.state.gymId) {
      const currentGymId = location.state.gymId;
      setGymId(currentGymId);

      // Fetch the initial staff list from Firestore
      const fetchStaff = async () => {
        setIsLoading(true); // OK to use this for initial load
        const result = await getStaffList(currentGymId);
        if (result.success) {
          setStaffList(result.staffList);
        } else {
          setError(result.error);
        }
        setIsLoading(false);
      };

      fetchStaff();
    } else {
      setError("Gym ID not found. Please start over.");
    }
  }, [location.state]);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!gymId) {
      setError("Cannot add staff without a Gym ID.");
      return;
    }

    setError(null);
    setIsLoading(true); // This state is for the "Add" button

    const staffData = { name, title };
    const result = await addStaffMember(gymId, staffData);

    setIsLoading(false);

    if (result.success) {
      // Add the new staff member (returned from the function) to our list
      setStaffList([...staffList, result.staffMember]);
      // Clear the form fields
      setName('');
      setTitle('');
    } else {
      setError(result.error);
    }
  };

  // --- 4. UPDATED handleNext ---
  const handleNext = async () => {
    if (!user) {
      setError("User not found. Please refresh and log in.");
      return;
    }

    setIsNavigating(true);
    setError(null);

    // Tell the database we are done with step 3
    const stepResult = await updateUserOnboardingStep(user.uid, 'step4_class');

    if (stepResult.success) {
      navigate('/onboarding/step-4', { state: { gymId: gymId } });
    } else {
      setError("Failed to save progress. Please try again.");
    }

    setIsNavigating(false);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Add Your Staff</h2>
      <p className="text-center text-gray-600 mb-6">You can add your coaches and instructors here.</p>

      <form onSubmit={handleAddStaff} className="mb-6">
        <div className="flex items-end gap-4">
          {/* ... form inputs (name, title) ... */}
          <div className="flex-grow">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., John Danaher"
              required
            />
          </div>
          <div className="flex-grow">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title / Credentials</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Black Belt"
              required
            />
          </div>
          <button
            type="submit"
            // --- 5. UPDATE DISABLED STATE ---
            disabled={isLoading || isNavigating}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 h-10 disabled:bg-blue-300"
          >
            {isLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
      </form>

      {/* ... staff list rendering ... */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Your Team</h3>
        <div className="space-y-2">
          {staffList.length > 0 ? (
            staffList.map((staff) => (
              <div key={staff.id} className="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{staff.name}</p>
                  <p className="text-sm text-gray-500">{staff.title}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">{isLoading && staffList.length === 0 ? "Loading..." : "No staff members added yet."}</p>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button type="button" onClick={() => navigate('/onboarding/step-2', { state: { gymId } })} className="text-sm text-gray-600 hover:underline">Back</button>
        <button
          type="button"
          onClick={handleNext}
          // --- 6. UPDATE DISABLED STATE ---
          disabled={!gymId || isLoading || isNavigating}
          className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
        >
          {/* --- 7. UPDATE BUTTON TEXT --- */}
          {isNavigating ? 'Saving...' : 'Next'}
        </button>
      </div>
    </div>
  );
};