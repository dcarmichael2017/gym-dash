import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { Check } from 'lucide-react'; // Added Icon

import { uploadLogo } from '../../../../shared/api/storage.js';
import {
  updateGymBranding,
  getGymDetails,
  updateUserOnboardingStep 
} from '../../../../shared/api/firestore.js';

// Reuse the presets for consistency
const THEME_PRESETS = [
  { name: 'Modern Pink', primary: '#DB2777', secondary: '#4F46E5' },
  { name: 'Ocean Blue', primary: '#2563EB', secondary: '#0EA5E9' },
  { name: 'Power Red', primary: '#DC2626', secondary: '#1F2937' },
  { name: 'Forest', primary: '#059669', secondary: '#10B981' },
  { name: 'Midnight', primary: '#4F46E5', secondary: '#1E1B4B' },
  { name: 'Sunset', primary: '#EA580C', secondary: '#F59E0B' },
];

export const Step2_BrandScreen = () => {
  const [logoFile, setLogoFile] = useState(null);
  const [primaryColor, setPrimaryColor] = useState('#DB2777'); 
  const [secondaryColor, setSecondaryColor] = useState('#4F46E5'); 
  const [existingLogoUrl, setExistingLogoUrl] = useState(null); 
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gymId, setGymId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
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
      setError("Gym ID not found. Please go back to Step 1.");
    }
  }, [location.state]); 

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setLogoFile(e.target.files[0]);
      setExistingLogoUrl(null); 
    }
  };

  const applyPreset = (preset) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const handleBrandingSubmit = async (e) => {
    e.preventDefault();
    if (!user || !gymId) {
      setError("Authentication error or missing Gym ID. Please sign in again.");
      return;
    }

    setError(null);
    setIsLoading(true);

    let logoUrl = existingLogoUrl; 

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
        layout: 'classic' // Default to classic for new users
      },
      logoUrl: logoUrl,
    };

    const updateResult = await updateGymBranding(gymId, brandingData);

    if (updateResult.success) {
      const stepResult = await updateUserOnboardingStep(user.uid, 'step3_staff');
      setIsLoading(false); 

      if (stepResult.success) {
        navigate('/onboarding/step-3', { state: { gymId: gymId } });
      } else {
        setError("Branding saved, but couldn't update progress. Please refresh.");
      }
    } else {
      setIsLoading(false); 
      setError(updateResult.error);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Customize Your Brand</h2>
      <p className="text-center text-gray-600 mb-6">This will define the look of your member app.</p>

      <form onSubmit={handleBrandingSubmit}>
        {/* LOGO UPLOAD */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Gym Logo</label>
          {existingLogoUrl && !logoFile && (
            <div className="mb-4 text-center">
              <img src={existingLogoUrl} alt="Current gym logo" className="h-24 w-24 object-contain mx-auto rounded-md border p-1" />
              <p className="text-xs text-gray-500 mt-1">Current logo</p>
            </div>
          )}
          <input
            type="file"
            onChange={handleFileChange}
            accept="image/png, image/jpeg"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <hr className="border-gray-100 mb-6" />

        {/* PRESET THEMES */}
        <div className="mb-6">
           <label className="block text-sm font-medium text-gray-700 mb-3">Choose a Color Theme</label>
           <div className="grid grid-cols-3 gap-3">
              {THEME_PRESETS.map((preset) => {
                const isActive = 
                    primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                    secondaryColor.toLowerCase() === preset.secondary.toLowerCase();

                return (
                    <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                            isActive ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="h-8 w-full" style={{ backgroundColor: preset.primary }}></div>
                        <div className="h-3 w-full" style={{ backgroundColor: preset.secondary }}></div>
                        <div className="p-1.5 bg-white text-[10px] font-medium text-gray-600 text-center truncate">
                            {preset.name}
                        </div>
                        {isActive && (
                            <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm">
                                <Check className="h-3 w-3 text-blue-600" />
                            </div>
                        )}
                    </button>
                );
              })}
           </div>
        </div>

        {/* CUSTOM COLORS (Collapsed visual hierarchy) */}
        <div className="mb-8">
           <p className="text-xs text-gray-400 font-medium uppercase mb-2">Or Customize Manually</p>
           <div className="flex gap-4">
              <div className="flex-1">
                 <div className="flex items-center gap-2 border border-gray-200 rounded-md p-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded border-none cursor-pointer"
                    />
                    <div className="text-xs">
                       <span className="block text-gray-500">Primary</span>
                       <span className="font-mono text-gray-700">{primaryColor}</span>
                    </div>
                 </div>
              </div>
              <div className="flex-1">
                 <div className="flex items-center gap-2 border border-gray-200 rounded-md p-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded border-none cursor-pointer"
                    />
                    <div className="text-xs">
                       <span className="block text-gray-500">Secondary</span>
                       <span className="font-mono text-gray-700">{secondaryColor}</span>
                    </div>
                 </div>
              </div>
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
            {isLoading ? 'Saving...' : 'Next Step'}
          </button>
        </div>
      </form>
    </div>
  );
};