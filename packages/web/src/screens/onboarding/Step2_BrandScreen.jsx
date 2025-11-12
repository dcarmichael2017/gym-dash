// /packages/web/src/screens/onboarding/Step2_BrandScreen.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { uploadLogo } from '../../../../shared/api/storage.js';
// --- FIX: Import updateUserOnboardingStep ---
import {
  updateGymBranding,
  getGymDetails,
  updateUserOnboardingStep // Add this import
} from '../../../../shared/api/firestore.js';

export const Step2_BrandScreen = () => {
  const [logoFile, setLogoFile] = useState(null);
  const [primaryColor, setPrimaryColor] = useState('#DB2777'); // Default pink
  const [secondaryColor, setSecondaryColor] = useState('#4F46E5'); // Default indigo
  const [existingLogoUrl, setExistingLogoUrl] = useState(null); // To display current logo
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gymId, setGymId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    // This logic correctly handles loading data when you log in
    // or when you navigate back from Step 3.
    if (location.state && location.state.gymId) {
      const currentGymId = location.state.gymId;
      setGymId(currentGymId);

      const fetchGymData = async () => {
        setIsLoading(true);
        const result = await getGymDetails(currentGymId);
        if (result.success) {
          if (result.gym.theme) {
            setPrimaryColor(result.gym.theme.primaryColor || '#DB2777');
            setSecondaryColor(result.gym.theme.secondaryColor || '#4F46E5');
          }
          if (result.gym.logoUrl) {
            setExistingLogoUrl(result.gym.logoUrl);
          }
        } else {
          setError(result.error);
        }
        setIsLoading(false);
      };
      fetchGymData();
    } else {
      // This error is correct. If state is missing, the user
      // must go back, as ProtectedRoute can't pass state on a refresh.
      setError("Gym ID not found. Please go back to Step 1.");
    }
  }, [location.state]); // This dependency is correct.

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setLogoFile(e.target.files[0]);
      setExistingLogoUrl(null); // Clear existing logo preview if a new one is selected
    }
  };

  const handleBrandingSubmit = async (e) => {
    e.preventDefault();
    if (!user || !gymId) {
      setError("Authentication error or missing Gym ID. Please sign in again.");
      return;
    }

    setError(null);
    setIsLoading(true);

    let logoUrl = existingLogoUrl; // Start with the existing logo URL

    // If a new file is selected, upload it and get the new URL
    if (logoFile) {
      const uploadResult = await uploadLogo(gymId, logoFile);
      if (uploadResult.success) {
        logoUrl = uploadResult.url;
      } else {
        setError(uploadResult.error);
        setIsLoading(false);
        return;
      }
    }

    const brandingData = {
      theme: {
        primaryColor,
        secondaryColor,
      },
      logoUrl: logoUrl,
    };

    const updateResult = await updateGymBranding(gymId, brandingData);

    // --- START FIX: Update user step *before* navigating ---
    if (updateResult.success) {
      console.log('Branding updated successfully!');

      // Now, tell the database we are on step 3
      const stepResult = await updateUserOnboardingStep(user.uid, 'step3_staff');
      setIsLoading(false); // Stop loading *after* all calls

      if (stepResult.success) {
        // Now we can safely navigate
        navigate('/onboarding/step-3', { state: { gymId: gymId } });
      } else {
        setError("Branding saved, but couldn't update progress. Please refresh.");
      }
    } else {
      setIsLoading(false); // Stop loading on failure
      setError(updateResult.error);
    }
    // --- END FIX ---
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Customize Your Brand</h2>
      <p className="text-center text-gray-600 mb-6">This will define the look of your member app.</p>

      <form onSubmit={handleBrandingSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Gym Logo</label>
          {existingLogoUrl && !logoFile && (
            <div className="mb-4">
              <img src={existingLogoUrl} alt="Current gym logo" className="h-20 w-20 object-contain rounded-md border p-1" />
              <p className="text-xs text-gray-500 mt-1">Current logo. Upload a new one to replace it.</p>
            </div>
          )}
          <input
            type="file"
            onChange={handleFileChange}
            accept="image/png, image/jpeg"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="flex gap-8 mb-6">
          <div>
            <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
            <input
              id="primaryColor"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-24 h-12 p-1 bg-white border border-gray-300 rounded-md cursor-pointer"
              />
          </div>
          <div>
            <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
            <input
              id="secondaryColor"
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-24 h-12 p-1 bg-white border border-gray-300 rounded-md cursor-pointer"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <div className="flex justify-between items-center">
          <button type="button" onClick={() => navigate('/onboarding/step-1', { state: { gymId } })} className="text-sm text-gray-600 hover:underline">Back</button>
          <button
            type="submit"
            disabled={isLoading || !gymId}
            className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
          >
            {isLoading ? 'Saving...' : 'Next'}
          </button>
        </div>
      </form>
    </div>
  );
};