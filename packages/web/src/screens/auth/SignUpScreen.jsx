// /packages/web/src/screens/auth/SignUpScreen.jsx

import React, { useState } from 'react';
// --- FIX: Import Link ---
import { useNavigate, Link } from 'react-router-dom';

// --- FIX: Correct import path and add createUserProfile ---
// From /packages/web/src/screens/auth/ -> ../../../../ -> /packages/
import { signUpWithEmail } from '../../../../shared/api/auth.js';
import { createUserProfile } from '../../../../shared/api/firestore.js';
// --- END FIX ---

import { Building } from 'lucide-react'; // A nice icon for branding

export const SignUpScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const authResult = await signUpWithEmail(email, password);

    if (authResult.success) {
      console.log('Sign up successful! User ID:', authResult.user.uid);

      // --- FIX: Create the user profile in Firestore AFTER auth ---
      // This is the missing step. We must create the Firestore doc.
      const profileData = { email: authResult.user.email };
      const profileResult = await createUserProfile(authResult.user.uid, profileData);
      
      setIsLoading(false); // Move loading stop here

      if (profileResult.success) {
        navigate('/onboarding/step-1'); 
        // ---------------------------------------
      } else {
        setError("Account created, but failed to save profile. Please contact support.");
      }

    } else {
      setIsLoading(false); // Stop loading on auth failure
      if (authResult.error.includes("auth/email-already-in-use")) {
        setError(
          <span>
            This email is already registered.{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Try logging in?
            </Link>
          </span>
        );
      } else {
        setError(authResult.error);
      }
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border">
      
      <div className="flex flex-col items-center mb-6">
        <div className="bg-slate-800 p-3 rounded-full mb-3">
          <Building className="text-white h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800">Welcome to GymDash</h1>
        <p className="text-gray-500 mt-1">Create an account to manage your gym.</p>
      </div>
      
      <form onSubmit={handleSignUp}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-semibold mb-2 text-left" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 block w-full rounded-md shadow-sm py-2 px-3"
            required
            placeholder="you@example.com"
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-semibold mb-2 text-left" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 block w-full rounded-md shadow-sm py-2 px-3"
            required
            placeholder="••••••••••"
          />
        </div>

        {/* --- FIX: Display React node error --- */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
            {error}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-700 disabled:bg-slate-400 transition-colors"
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </div>
      </form>

      {/* --- FIX: Add the "Log In" link --- */}
      <p className="text-sm text-center text-gray-600 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Log In
        </Link>
      </p>
      {/* --- END FIX --- */}

    </div>
  );
};