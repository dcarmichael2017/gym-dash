import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  XCircle,
  Loader2
} from 'lucide-react';

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Active & Connected',
    description: 'Your Stripe account is fully set up and can accept payments.',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    Icon: CheckCircle,
  },
  PENDING: {
    label: 'Pending Setup',
    description: 'Please complete your Stripe onboarding to accept payments.',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    Icon: Clock,
  },
  PENDING_VERIFICATION: {
    label: 'Pending Verification',
    description: 'Stripe is reviewing your account details. This usually takes 1-2 business days.',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    Icon: Clock,
  },
  RESTRICTED: {
    label: 'Restricted',
    description: 'Your account has restrictions. Please update your information in Stripe.',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    Icon: AlertCircle,
  },
  NOT_CONNECTED: {
    label: 'Not Connected',
    description: 'Connect your Stripe account to start accepting payments.',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    Icon: XCircle,
  },
};

export const PaymentsSettingsTab = ({
  stripeId,
  stripeStatus: initialStatus,
  gymId,
  theme
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [stripeStatus, setStripeStatus] = useState(initialStatus || (stripeId ? 'PENDING' : 'NOT_CONNECTED'));
  const [accountDetails, setAccountDetails] = useState(null);
  const [error, setError] = useState(null);

  const primaryColor = theme?.primaryColor || '#2563eb';
  const statusConfig = STATUS_CONFIG[stripeStatus] || STATUS_CONFIG.NOT_CONNECTED;
  const StatusIcon = statusConfig.Icon;

  // Verify account status on mount if we have a stripeId
  useEffect(() => {
    if (stripeId && gymId) {
      verifyAccount();
    }
  }, [stripeId, gymId]);

  const verifyAccount = async () => {
    if (!gymId) return;

    setIsVerifying(true);
    setError(null);

    try {
      const functions = getFunctions();
      const verifyStripeAccount = httpsCallable(functions, 'verifyStripeAccount');
      const result = await verifyStripeAccount({ gymId });

      setStripeStatus(result.data.status);
      setAccountDetails({
        chargesEnabled: result.data.chargesEnabled,
        payoutsEnabled: result.data.payoutsEnabled,
        detailsSubmitted: result.data.detailsSubmitted,
      });
    } catch (err) {
      console.error('Error verifying Stripe account:', err);
      setError('Failed to verify account status');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!gymId) return;

    setIsLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      // Use createStripeAccountLink for fresh connections
      const createStripeAccountLink = httpsCallable(functions, 'createStripeAccountLink');
      const result = await createStripeAccountLink({
        gymId,
        origin: window.location.origin
      });

      // Redirect to Stripe
      window.location.href = result.data.url;
    } catch (err) {
      console.error('Error creating Stripe link:', err);
      setError('Failed to create Stripe connection. Please try again.');
      setIsLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!gymId) return;

    setIsLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      const createStripeAccountLinkRefresh = httpsCallable(functions, 'createStripeAccountLinkRefresh');
      const result = await createStripeAccountLinkRefresh({
        gymId,
        origin: window.location.origin,
        returnPath: '/admin/settings'
      });

      // Redirect to Stripe
      window.location.href = result.data.url;
    } catch (err) {
      console.error('Error creating Stripe link:', err);
      setError('Failed to create onboarding link. Please try again.');
      setIsLoading(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    // For Standard accounts, direct to dashboard.stripe.com
    // For Express accounts, we'd use createLoginLink
    window.open('https://dashboard.stripe.com', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="text-center py-8">
        <div className={`inline-flex h-16 w-16 ${statusConfig.iconBg} items-center justify-center rounded-full mb-4`}>
          <StatusIcon className={`h-8 w-8 ${statusConfig.iconColor}`} />
        </div>
        <h3 className="text-lg font-medium text-gray-800">Stripe Connection</h3>

        <div className="mt-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
            ● {statusConfig.label}
          </span>
          <p className="text-gray-500 text-sm mt-3 max-w-md mx-auto">
            {statusConfig.description}
          </p>
        </div>

        {/* Account ID Display */}
        {stripeId && (
          <p className="text-gray-400 text-xs mt-4">
            Account ID: <span className="font-mono">{stripeId}</span>
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg max-w-md mx-auto">
            {error}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {/* Connect button for NOT_CONNECTED status */}
        {stripeStatus === 'NOT_CONNECTED' && (
          <button
            onClick={handleConnectStripe}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Connect with Stripe
              </>
            )}
          </button>
        )}

        {/* Complete setup button for PENDING or RESTRICTED with existing account */}
        {(stripeStatus === 'PENDING' || stripeStatus === 'RESTRICTED') && stripeId && (
          <button
            onClick={handleCompleteOnboarding}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Complete Stripe Setup
              </>
            )}
          </button>
        )}

        {/* Stripe Dashboard button for ACTIVE accounts */}
        {stripeStatus === 'ACTIVE' && (
          <button
            onClick={handleOpenStripeDashboard}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            <ExternalLink className="h-4 w-4" />
            Open Stripe Dashboard
          </button>
        )}

        {/* Refresh Status Button - only show when there's an account */}
        {stripeId && (
          <button
            onClick={verifyAccount}
            disabled={isVerifying}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Checking...' : 'Refresh Status'}
          </button>
        )}
      </div>

      {/* Account Details (for debugging/transparency) */}
      {accountDetails && stripeStatus !== 'NOT_CONNECTED' && (
        <div className="mt-8 border-t pt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Account Capabilities</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              {accountDetails.chargesEnabled ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span className={accountDetails.chargesEnabled ? 'text-gray-700' : 'text-gray-400'}>
                Can Accept Payments
              </span>
            </div>
            <div className="flex items-center gap-2">
              {accountDetails.payoutsEnabled ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span className={accountDetails.payoutsEnabled ? 'text-gray-700' : 'text-gray-400'}>
                Can Receive Payouts
              </span>
            </div>
            <div className="flex items-center gap-2">
              {accountDetails.detailsSubmitted ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
              <span className={accountDetails.detailsSubmitted ? 'text-gray-700' : 'text-gray-400'}>
                Details Submitted
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">About Stripe Connect</h4>
        <p className="text-xs text-gray-500">
          GymDash uses Stripe to securely process payments. Your banking and financial information
          is stored directly with Stripe - we never see or store sensitive payment details.
          A small platform fee is applied to each transaction.
        </p>
      </div>
    </div>
  );
};
