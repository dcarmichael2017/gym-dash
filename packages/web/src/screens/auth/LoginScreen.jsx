// /packages/web/src/screens/auth/LoginScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmail } from '@shared/api/auth.js'; // Ensure path alias works or use relative
import { Building, LogIn, Lock, Mail } from 'lucide-react';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("[LoginScreen] Button clicked");
    setError(null);
    setIsLoading(true);

    const result = await signInWithEmail(email, password);
    console.log("[LoginScreen] Auth Result:", result);

    if (result.success) {
      console.log("[LoginScreen] Success. Waiting for App.jsx to handle redirect...");
      // DO NOT NAVIGATE MANUALLY
    } else {
      console.log("[LoginScreen] Failure:", result.error);
      setIsLoading(false);
      if (result.error.includes('auth/invalid-credential')) {
        setError('Invalid email or password.');
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 mb-4">
            <Building className="text-white h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 mt-2">Sign in to continue</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2 ml-1" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 w-full h-12 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                required
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2 ml-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 w-full h-12 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base"
                required
                placeholder="••••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl p-3 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 flex items-center justify-center rounded-xl shadow-lg shadow-blue-200 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:bg-blue-300 transition-all active:scale-[0.98]"
          >
            {isLoading ? 'Logging In...' : 'Log In'}
          </button>
        </form>
        
        <p className="text-center text-gray-600 mt-8">
          Don't have an account?{' '}
          <Link to="/signup" className="font-bold text-blue-600 hover:text-blue-500">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};