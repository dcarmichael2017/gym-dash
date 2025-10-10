import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getGymDetails, getClasses } from '@shared/api/firestore.js';
import { MobileSchedulePreview } from '@shared/components/MobileSchedulePreview.jsx';

export const Step5_AppPreviewScreen = () => {
  const [gymDetails, setGymDetails] = useState(null);
  const [classList, setClassList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gymId, setGymId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Correctly using the alias now
    const currentGymId = location.state?.gymId;
    if (currentGymId) {
      setGymId(currentGymId);
      
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const gymResult = await getGymDetails(currentGymId);
          const classesResult = await getClasses(currentGymId);

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

  const handleNext = () => {
    // This would eventually navigate to the final step or dashboard
    alert("Onboarding Complete! (For now)");
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading your app preview...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">{error}</div>;
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Your App Preview</h2>
      <p className="text-gray-600 mb-6">Here’s how your gym's branding and schedule will look to your members.</p>
      
      <div className="mb-8 flex justify-center">
        <MobileSchedulePreview 
          gymName={gymDetails?.name}
          logoUrl={gymDetails?.logoUrl}
          // PASSING BOTH COLORS: Pass both primary and secondary colors to the component
          primaryColor={gymDetails?.theme?.primaryColor}
          secondaryColor={gymDetails?.theme?.secondaryColor}
          classList={classList}
        />
      </div>

      <div className="flex justify-between items-center mt-8">
        <button type="button" onClick={() => navigate('/onboarding/step-4', { state: { gymId } })} className="text-sm font-medium text-gray-600 hover:underline">Back</button>
        <button type="button" onClick={handleNext} className="bg-green-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-green-700 transition-colors">
          Looks Good, Finish!
        </button>
      </div>
    </div>
  );
};

