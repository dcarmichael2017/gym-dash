// /packages/web/src/screens/auth/SignUpScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUpWithEmail } from '../../../../shared/api/auth.js'; // Adjust path as needed
import { createUserProfile } from '../../../../shared/api/firestore.js'; // Adjust path as needed
import { Building, User, ChevronLeft, Briefcase } from 'lucide-react';

export const SignUpScreen = () => {
  // Step 1: Role Selection, Step 2: Auth Form
  const [selectedRole, setSelectedRole] = useState(null); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 1. Create Auth User
    const authResult = await signUpWithEmail(email, password);

    if (authResult.success) {
      // 2. Create Profile with the SELECTED ROLE
      const profileData = { 
          email: authResult.user.email,
          role: selectedRole, // 'owner' or 'member'
          status: 'active' // Default status
      };

      const profileResult = await createUserProfile(authResult.user.uid, profileData);
      
      setIsLoading(false);

      if (profileResult.success) {
        // 3. Forked Redirect Logic
        if (selectedRole === 'owner') {
            navigate('/onboarding/step-1'); 
        } else {
            navigate('/members/home'); 
        }
      } else {
        setError("Account created, but profile failed. Please contact support.");
      }

    } else {
      setIsLoading(false);
      if (authResult.error.includes("auth/email-already-in-use")) {
        setError(
          <span>
            Email already in use. <Link to="/login" className="underline">Log in?</Link>
          </span>
        );
      } else {
        setError(authResult.error);
      }
    }
  };

  // --- VIEW 1: ROLE SELECTION ---
  if (!selectedRole) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Join GymDash</h1>
                    <p className="text-gray-500 mt-2">How will you use the platform?</p>
                </div>

                <div className="space-y-4">
                    {/* BUTTON: I AM AN OWNER */}
                    <button 
                        onClick={() => setSelectedRole('owner')}
                        className="w-full bg-white p-6 rounded-2xl border-2 border-transparent hover:border-blue-500 shadow-sm hover:shadow-xl transition-all group text-left flex items-center gap-4"
                    >
                        <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-600 transition-colors">
                            <Briefcase className="h-6 w-6 text-blue-600 group-hover:text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">I own a Gym</h3>
                            <p className="text-sm text-gray-500">I want to manage classes, members, and billing.</p>
                        </div>
                    </button>

                    {/* BUTTON: I AM A MEMBER */}
                    <button 
                        onClick={() => setSelectedRole('member')}
                        className="w-full bg-white p-6 rounded-2xl border-2 border-transparent hover:border-green-500 shadow-sm hover:shadow-xl transition-all group text-left flex items-center gap-4"
                    >
                        <div className="bg-green-100 p-3 rounded-full group-hover:bg-green-600 transition-colors">
                            <User className="h-6 w-6 text-green-600 group-hover:text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">I am a Member</h3>
                            <p className="text-sm text-gray-500">I want to book classes and view my progress.</p>
                        </div>
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-gray-600">
                        Already have an account? <Link to="/login" className="font-bold text-blue-600">Log In</Link>
                    </p>
                </div>
            </div>
        </div>
      );
  }

  // --- VIEW 2: SIGN UP FORM ---
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        
        {/* Back Button */}
        <button onClick={() => setSelectedRole(null)} className="mb-6 flex items-center text-sm text-gray-400 hover:text-gray-600">
            <ChevronLeft size={16} /> Back
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className={`p-4 rounded-2xl shadow-lg mb-4 ${selectedRole === 'owner' ? 'bg-blue-600 shadow-blue-200' : 'bg-green-600 shadow-green-200'}`}>
            {selectedRole === 'owner' ? <Building className="text-white h-8 w-8" /> : <User className="text-white h-8 w-8" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
              {selectedRole === 'owner' ? 'Create Business Account' : 'Create Student Account'}
          </h1>
        </div>
        
        <form onSubmit={handleSignUp} className="space-y-5">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
              placeholder="••••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full h-14 rounded-xl shadow-lg text-base font-bold text-white transition-all active:scale-[0.98] ${
                selectedRole === 'owner' 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                : 'bg-green-600 hover:bg-green-700 shadow-green-200'
            }`}
          >
            {isLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};