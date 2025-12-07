import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth'; // --- NEW IMPORT ---
import { CreditCard, SkipForward } from 'lucide-react';
import { updateUserOnboardingStep } from '../../../../shared/api/firestore'; // --- NEW IMPORT ---

export const Step6_ConnectPaymentsScreen = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const gymId = location.state?.gymId;

  const handleConnectStripe = async () => {
    if (!gymId) {
      setError("Gym ID is missing. Please go back and try again.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      const createStripeAccountLink = httpsCallable(functions, 'createStripeAccountLink');

      // Pass the gymId AND the current window's origin to the function.
      const result = await createStripeAccountLink({ 
        gymId,
        origin: window.location.origin
      });

      const { url } = result.data;
      window.location.href = url;

    } catch (err) {
      console.error("Error calling Stripe function:", err);
      setError("Could not connect to Stripe. Please try again later.");
      setIsLoading(false);
    }
  };

  // --- NEW: Handle Skip Logic ---
  const handleDevSkip = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) return;

    setIsLoading(true);
    // Mark as complete immediately
    const result = await updateUserOnboardingStep(user.uid, 'complete');
    
    if (result.success) {
        // Redirect to Dashboard
        navigate('/dashboard'); 
    } else {
        setError("Failed to skip step.");
        setIsLoading(false);
    }
  };

  // Check if we are in development mode (Vite feature)
  const isDevMode = import.meta.env.DEV; 

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border">
      <h2 className="text-3xl font-bold text-gray-800 mb-3">Last Step! Let's Get You Paid</h2>
      <p className="text-gray-600 mb-8">
        We partner with Stripe to handle secure payments directly to your bank account. Click the button below to set up your account.
      </p>
      
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" 
          alt="Stripe Logo" 
          className="h-8 mx-auto"
        />
        <p className="text-xs text-gray-500 mt-4">
          You will be redirected to Stripe's secure website to enter your details. GymDash never sees your banking information.
        </p>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={handleConnectStripe}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 bg-[#635BFF] text-white font-bold py-3 px-6 rounded-lg hover:bg-[#534bff] transition-all duration-200 disabled:bg-gray-400"
      >
        <CreditCard size={20} />
        {isLoading ? 'Connecting...' : 'Connect with Stripe'}
      </button>

      {/* --- NEW: Dev Skip Button --- */}
      {/* This only renders if running locally */}
      {isDevMode && (
        <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
            <p className="text-xs text-amber-600 font-bold uppercase mb-2">Development Mode Only</p>
            <button
                onClick={handleDevSkip}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-amber-100 text-amber-800 font-medium py-2 px-6 rounded-lg hover:bg-amber-200 transition-colors"
            >
                <SkipForward size={16} />
                Skip Payment Setup
            </button>
        </div>
      )}

       <div className="mt-6">
        <button type="button" onClick={() => navigate('/onboarding/step-5', { state: { gymId } })} className="text-sm font-medium text-gray-600 hover:underline">Back</button>
      </div>
    </div>
  );
};