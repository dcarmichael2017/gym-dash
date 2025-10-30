// /packages/web/src/screens/onboarding/Step1_GymDetailsScreen.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { createGym } from '../../../../shared/api/firestore.js';

export const Step1_GymDetailsScreen = () => {
  const [gymName, setGymName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  const handleCreateGym = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to create a gym.");
      return;
    }

    setError(null);
    setIsLoading(true);

    const gymData = {
      name: gymName,
      description: description,
      ownerId: user.uid, 
    };

    const result = await createGym(gymData);
    setIsLoading(false);

    if (result.success) {
      console.log('Gym created successfully! Gym ID:', result.gymId);
      navigate('/onboarding/step-2', { state: { gymId: result.gymId } });
    } else {
      // Log the specific Firebase error
      console.error("Error creating gym:", result.error);
      setError("Error creating gym. Please try again.");
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-1">Welcome!</h2>
      <p className="text-center text-gray-600 mb-6">Let's set up your gym.</p>
      
      <form onSubmit={handleCreateGym}>
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
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
        >
          {isLoading ? 'Creating...' : 'Next'}
        </button>
      </form>
    </div>
  );
};
