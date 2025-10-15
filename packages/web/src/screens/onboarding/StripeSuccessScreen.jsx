import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';

export const StripeSuccessScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // A helper function to parse query parameters from the URL
  const useQuery = () => {
    return new URLSearchParams(location.search);
  }
  
  const query = useQuery();
  const gymId = query.get('gymId');

  const handleFinishOnboarding = () => {
    // Navigate to the main dashboard, passing the gymId
    // You might need to change '/dashboard' to your actual dashboard route
    navigate('/dashboard', { state: { gymId } });
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center border animate-fade-in">
      <div className="flex justify-center items-center">
        <CheckCircle className="text-green-500" size={64} />
      </div>
      <h2 className="text-3xl font-bold text-gray-800 mt-6 mb-3">Setup Complete!</h2>
      <p className="text-gray-600 mb-8">
        Your Stripe account has been successfully connected. You're now ready to manage your gym and accept payments.
      </p>
      
      <button
        onClick={handleFinishOnboarding}
        className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all duration-200"
      >
        Go to Your Dashboard
        <ArrowRight size={20} />
      </button>

      {gymId && (
        <p className="text-xs text-gray-400 mt-6">
          Gym ID: {gymId}
        </p>
      )}
    </div>
  );
};

// Simple fade-in animation using CSS
const styles = `
  @keyframes fade-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-in {
    animation: fade-in 0.5s ease-out forwards;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
