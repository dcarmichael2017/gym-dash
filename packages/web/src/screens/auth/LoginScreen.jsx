// /packages/web/src/screens/auth/LoginScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// --- UPDATED IMPORT ---
// Switched to a path alias for better monorepo compatibility.
import { signInWithEmail } from '@shared/api/auth.js';
// --- END UPDATE ---
import { Building, LogIn } from 'lucide-react';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await signInWithEmail(email, password);
    setIsLoading(false);

    if (result.success) {
      console.log('Login successful! User ID:', result.user.uid);
      // Navigate to the root, the ProtectedRoute will handle redirection
      navigate('/'); 
    } else {
      console.error("Login Error:", result.error);
      if (result.error.includes('auth/invalid-credential')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError('An error occurred during login. Please try again.');
      }
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border">
      
      <div className="flex flex-col items-center mb-6">
        <div className="bg-slate-800 p-3 rounded-full mb-3">
          <Building className="text-white h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800">Welcome Back!</h1>
        <p className="text-gray-500 mt-1">Log in to manage your gym.</p>
      </div>
      
      <form onSubmit={handleLogin}>
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

        {error && <p className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">{error}</p>}

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-700 disabled:bg-slate-400 transition-colors"
          >
            {isLoading ? 'Logging In...' : (
              <>
                <LogIn className="h-5 w-5 mr-2" /> Log In
              </>
            )}
          </button>
        </div>
      </form>
      
      <p className="text-sm text-center text-gray-600 mt-6">
        Don't have an account?{' '}
        <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
          Sign Up
        </Link>
      </p>
    </div>
  );
};

