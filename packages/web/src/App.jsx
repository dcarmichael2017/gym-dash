import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/layout/AuthLayout.jsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx'; // Import the gate
import { FullScreenLoader } from './components/layout/FullScreenLoader.jsx'; // A fallback

// Import all your screens
import { SignUpScreen } from './screens/auth/SignUpScreen.jsx';
import { LoginScreen } from './screens/auth/LoginScreen.jsx'; // Import Login
import { Step1_GymDetailsScreen } from './screens/onboarding/Step1_GymDetailsScreen.jsx';
import { Step2_BrandScreen } from './screens/onboarding/Step2_BrandScreen.jsx';
import { Step3_StaffScreen } from './screens/onboarding/Step3_StaffScreen.jsx';
import { Step4_ClassScreen } from './screens/onboarding/Step4_ClassScreen.jsx';
import { Step5_AppPreviewScreen } from './screens/onboarding/Step5_AppPreviewScreen.jsx';
import { Step6_ConnectPaymentsScreen } from './screens/onboarding/Step6_ConnectPaymentsScreen.jsx';
import { StripeSuccessScreen } from './screens/onboarding/StripeSuccessScreen.jsx';

// Placeholder for our future dashboard
const DashboardScreen = () => (
  <div className="p-8">
    <h1 className="text-3xl font-bold">Welcome to your Dashboard!</h1>
    <p>Onboarding complete. Main app content goes here.</p>
  </div>
);


// In App.jsx

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- PUBLIC AUTH ROUTES --- */}
        {/* These routes use AuthLayout (Correct) */}
        <Route element={<AuthLayout />}>
          <Route path="/signup" element={<SignUpScreen />} />
          <Route path="/login" element={<LoginScreen />} />
        </Route>

        {/* --- PRIVATE APP ROUTES --- */}
        <Route path="" element={<ProtectedRoute />}>

          {/* --- FIX: WRAP ONBOARDING IN A LAYOUT --- */}
          {/* This applies the same centering as the login page */}
          <Route element={<AuthLayout />}>
            <Route path="/onboarding/step-1" element={<Step1_GymDetailsScreen />} />
            <Route path="/onboarding/step-2" element={<Step2_BrandScreen />} />
            <Route path="/onboarding/step-3" element={<Step3_StaffScreen />} />
            <Route path="/onboarding/step-4" element={<Step4_ClassScreen />} />
            <Route path="/onboarding/step-5" element={<Step5_AppPreviewScreen />} />
            <Route path="/onboarding/step-6" element={<Step6_ConnectPaymentsScreen />} />
          </Route>
          {/* --- END FIX --- */}

          {/* These routes probably have their own layout, so leave them out */}
          <Route path="/onboarding/stripe-success" element={<StripeSuccessScreen />} />
          <Route path="/" element={<DashboardScreen />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;