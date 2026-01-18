// /packages/web/src/screens/auth/SignUpScreen.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUpWithEmail } from '../../../../shared/api/auth.js';
import { createUserProfile } from '../../../../shared/api/firestore';
import { Building, User, ChevronLeft, Briefcase, Mail, Lock, Phone, UserCircle } from 'lucide-react';

export const SignUpScreen = () => {
  const [selectedRole, setSelectedRole] = useState(null); 
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: ''
  });
  
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 1. Create Auth User
    const authResult = await signUpWithEmail(formData.email, formData.password);

    if (authResult.success) {
      // 2. Create Profile with detailed data
      const profileData = { 
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          email: formData.email.toLowerCase().trim(),
          phoneNumber: formData.phoneNumber.replace(/[^\d]/g, ''), // Strip non-digits
          role: selectedRole, // 'owner' or 'member'
          createdAt: new Date()
      };

      const profileResult = await createUserProfile(authResult.user.uid, profileData);
      
      setIsLoading(false);

      if (profileResult.success) {
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
      setError(authResult.error.includes("auth/email-already-in-use") 
        ? <span>Email already in use. <Link to="/login" className="underline">Log in?</Link></span>
        : authResult.error);
    }
  };

  if (!selectedRole) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Join GymDash</h1>
                <p className="text-gray-500 mb-8">How will you use the platform?</p>

                <div className="space-y-4">
                    <RoleButton 
                        role="owner" 
                        title="I own a Gym" 
                        desc="Manage classes, members, and billing." 
                        icon={Briefcase} 
                        color="blue" 
                        onClick={setSelectedRole} 
                    />
                    <RoleButton 
                        role="member" 
                        title="I am a Member" 
                        desc="Book classes and view progress." 
                        icon={User} 
                        color="green" 
                        onClick={setSelectedRole} 
                    />
                </div>
                <p className="mt-8 text-gray-600">
                    Already have an account? <Link to="/login" className="font-bold text-blue-600">Log In</Link>
                </p>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl w-full max-w-lg border border-gray-100">
        <button onClick={() => setSelectedRole(null)} className="mb-6 flex items-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <ChevronLeft size={16} /> Change Role
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Let's get started</h1>
          <p className="text-gray-500">Creating your {selectedRole} account</p>
        </div>
        
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="firstName" placeholder="John" value={formData.firstName} onChange={handleInputChange} icon={UserCircle} required />
            <Input label="Last Name" name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleInputChange} icon={UserCircle} required />
          </div>

          <Input label="Email Address" name="email" type="email" placeholder="john@example.com" value={formData.email} onChange={handleInputChange} icon={Mail} required />
          <Input label="Phone Number" name="phoneNumber" type="tel" placeholder="(555) 000-0000" value={formData.phoneNumber} onChange={handleInputChange} icon={Phone} required />
          <Input label="Password" name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleInputChange} icon={Lock} required />

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl p-4 border border-red-100">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full h-14 rounded-2xl shadow-lg text-base font-bold text-white transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 ${
                selectedRole === 'owner' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-green-600 hover:bg-green-700 shadow-green-100'
            }`}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- HELPER COMPONENTS ---

const RoleButton = ({ role, title, desc, icon: Icon, color, onClick }) => (
    <button 
        onClick={() => onClick(role)}
        className={`w-full bg-white p-6 rounded-2xl border-2 border-transparent hover:border-${color}-500 shadow-sm hover:shadow-lg transition-all group text-left flex items-center gap-4`}
    >
        <div className={`bg-${color}-100 p-3 rounded-full group-hover:bg-${color}-600 transition-colors`}>
            <Icon className={`h-6 w-6 text-${color}-600 group-hover:text-white`} />
        </div>
        <div>
            <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
        </div>
    </button>
);

const Input = ({ label, icon: Icon, ...props }) => (
    <div className="space-y-1.5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{label}</label>
        <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <Icon size={18} />
            </div>
            <input 
                {...props}
                className="w-full h-12 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
        </div>
    </div>
);