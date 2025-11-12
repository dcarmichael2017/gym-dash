// /packages/web/src/screens/onboarding/Step1_GymDetailsScreen.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
// --- UPDATED IMPORTS ---
import {
  createGym,
  updateUserOnboardingStep,
  getGymDetails,
  updateGymDetails
} from '../../../../shared/api/firestore.js';

export const Step1_GymDetailsScreen = () => {
  const [gymName, setGymName] = useState('');
  const [description, setDescription] = useState('');
  const [gymId, setGymId] = useState(null); // State to hold existing gym ID
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false); // For fetching
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const user = auth.currentUser;

  // --- ADDED: Load existing gym data ---
  useEffect(() => {
    // Check if a gymId was passed from Step 2 (or from ProtectedRoute)
    if (location.state && location.state.gymId) {
      const currentGymId = location.state.gymId;
      setGymId(currentGymId);
      setIsDataLoading(true);

      const fetchGymData = async () => {
        const result = await getGymDetails(currentGymId);
        if (result.success) {
          setGymName(result.gym.name || '');
          setDescription(result.gym.description || '');
        } else {
          setError("Could not load your gym details.");
        }
        setIsDataLoading(false);
      };
      fetchGymData();
    }
  }, [location.state]);

  // --- UPDATED: Handle both Create and Update ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in.");
      return;
    }

    setError(null);
    setIsLoading(true);

    const gymData = {
      name: gymName,
      description: description,
      ownerId: user.uid, // Always include ownerId
    };

    // --- LOGIC FOR UPDATE VS CREATE ---
    if (gymId) {
      // Gym already exists, just UPDATE it
      const result = await updateGymDetails(gymId, gymData);
      setIsLoading(false);

      if (result.success) {
        // Just navigate, no need to update user step
        navigate('/onboarding/step-2', { state: { gymId: gymId } });
      } else {
        setError("Error updating gym. Please try again.");
      }
    } else {
      // This is a NEW gym, so CREATE it
      const result = await createGym(gymData);

      if (result.success) {
        const newGymId = result.gymId;
        console.log('Gym created successfully! Gym ID:', newGymId);

        // Tell the database we are done with step 1
        const stepResult = await updateUserOnboardingStep(user.uid, 'step2_branding');
        setIsLoading(false); // Stop loading *after* all calls are done

        if (stepResult.success) {
          navigate('/onboarding/step-2', { state: { gymId: newGymId } });
        } else {
          setError("Gym created, but couldn't save progress.");
        }
      } else {
        setIsLoading(false);
        console.error("Error creating gym:", result.error);
        setError("Error creating gym. Please try again.");
      }
    }
  };

  // --- UPDATED: Show loading state for data ---
  if (isDataLoading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md w-full">
        <p className="text-center text-gray-600">Loading details...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-1">
        {gymId ? 'Edit Your Gym Details' : 'Welcome!'}
      </h2>
      <p className="text-center text-gray-600 mb-6">
        {gymId ? 'Update your gym information below.' : "Let's set up your gym."}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="gymName" className="block text-sm font-medium text-gray-700 mb-1">
            Gym Name
          </label>
          <input
            id="gymName"
            type="text"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Apex Martial Arts"
            required
          />
        </div>
        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Brief Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="What makes your gym special?"
            rows="3"
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          type="submit"
          disabled={isLoading || isDataLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
        >
          {isLoading ? (gymId ? 'Updating...' : 'Creating...') : (gymId ? 'Save and Next' : 'Next')}
        </button>
      </form>
    </div>
  );
};