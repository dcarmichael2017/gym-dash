// packages/web/src/screens/onboarding/Step5_AppPreviewScreen.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import {
  getGymDetails,
  getClasses,
  updateUserOnboardingStep
} from '../../../../shared/api/firestore';
import { MobileSchedulePreview } from '../../../../shared/components/MobileSchedulePreview.jsx';

export const Step5_AppPreviewScreen = () => {
  const [gymDetails, setGymDetails] = useState(null);
  const [classList, setClassList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState(null);
  const [gymId, setGymId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    const currentGymId = location.state?.gymId;
    if (currentGymId) {
      setGymId(currentGymId);

      const fetchData = async () => {
        setIsLoading(true);
        try {
          // Parallel fetch for speed
          const [gymResult, classesResult] = await Promise.all([
             getGymDetails(currentGymId),
             getClasses(currentGymId)
          ]);

          if (gymResult.success) {
            setGymDetails(gymResult.gym);
          } else {
            throw new Error(gymResult.error);
          }

          if (classesResult.success) {
            setClassList(classesResult.classList);
          } else {
            throw new Error(classesResult.error);
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    } else {
      setError("Gym ID not found. Please start over from Step 1.");
      setIsLoading(false);
    }
  }, [location.state]);

  const handleNext = async () => {
    if (!user) {
      setError("User not found. Please refresh and log in.");
      return;
    }

    setIsNavigating(true);
    setError(null);

    const stepResult = await updateUserOnboardingStep(user.uid, 'step6_payments');

    if (stepResult.success) {
      navigate('/onboarding/step-6', { state: { gymId } });
    } else {
      setError("Failed to save progress. Please try again.");
    }
    setIsNavigating(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg text-center">
        <p>Loading your app preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Your App Preview</h2>
      <p className="text-gray-600 mb-6">Here’s how your gym's branding and schedule will look to your members.</p>

      {/* --- FIXED: Removed stray 's' and centered container --- */}
      <div className="mb-8 flex justify-center">
         <MobileSchedulePreview
           gymName={gymDetails?.name}
           logoUrl={gymDetails?.logoUrl}
           primaryColor={gymDetails?.theme?.primaryColor}
           secondaryColor={gymDetails?.theme?.secondaryColor}
           classList={classList}
         />
      </div>

      <div className="flex justify-between items-center mt-8">
        <button type="button" onClick={() => navigate('/onboarding/step-4', { state: { gymId } })} className="text-sm font-medium text-gray-600 hover:underline">Back</button>

        <button
          type="button"
          onClick={handleNext}
          disabled={isNavigating || isLoading}
          className="bg-green-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-green-700 transition-colors disabled:bg-green-300"
        >
          {isNavigating ? 'Saving...' : 'Looks Good, Next!'}
        </button>
      </div>
    </div>
  );
};