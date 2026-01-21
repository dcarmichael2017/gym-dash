import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Calendar, CreditCard, Loader2 } from 'lucide-react';
import { useGym } from '../../../context/GymContext';

const SubscriptionSuccessScreen = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentGym, refreshMemberships } = useGym();
  const [isLoading, setIsLoading] = useState(true);

  const sessionId = searchParams.get('session_id');
  const theme = currentGym?.theme || { primaryColor: '#3B82F6' };

  useEffect(() => {
    // Refresh memberships to get the new subscription data
    const loadNewMembership = async () => {
      if (refreshMemberships) {
        await refreshMemberships();
      }
      // Give a moment for the webhook to process
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    };

    loadNewMembership();
  }, [refreshMemberships]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Processing your subscription...</h2>
          <p className="text-gray-500">This will only take a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Success Icon */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: `${theme.primaryColor}15` }}
          >
            <CheckCircle size={32} style={{ color: theme.primaryColor }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to {currentGym?.name || 'the gym'}!
          </h1>
          <p className="text-gray-500">
            Your membership is now active. You're all set to start your fitness journey.
          </p>
        </div>

        {/* What's Next Section */}
        <div className="border-t border-gray-100 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">WHAT'S NEXT</h3>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div
                className="p-2 rounded-lg shrink-0"
                style={{ backgroundColor: `${theme.primaryColor}15` }}
              >
                <Calendar size={18} style={{ color: theme.primaryColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Book your first class</p>
                <p className="text-sm text-gray-500">
                  Check out the schedule and reserve your spot in any class.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className="p-2 rounded-lg shrink-0"
                style={{ backgroundColor: `${theme.primaryColor}15` }}
              >
                <CreditCard size={18} style={{ color: theme.primaryColor }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Manage your membership</p>
                <p className="text-sm text-gray-500">
                  View billing details and manage your subscription in your profile.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/members/schedule')}
            className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: theme.primaryColor }}
          >
            View Class Schedule
            <ArrowRight size={18} />
          </button>

          <button
            onClick={() => navigate('/members/profile')}
            className="w-full py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Go to My Profile
          </button>
        </div>

        {/* Session ID for reference */}
        {sessionId && (
          <p className="text-xs text-gray-400 text-center mt-6">
            Reference: {sessionId.slice(0, 20)}...
          </p>
        )}
      </div>
    </div>
  );
};

export default SubscriptionSuccessScreen;
