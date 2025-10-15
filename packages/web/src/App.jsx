// /packages/web/src/App.jsx

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/layout/AuthLayout.jsx'; // Added .jsx

// Import all your screens with the .jsx extension
import { SignUpScreen } from './screens/auth/SignUpScreen.jsx';
import { Step1_GymDetailsScreen } from './screens/onboarding/Step1_GymDetailsScreen.jsx';
import { Step2_BrandScreen } from './screens/onboarding/Step2_BrandScreen.jsx';
import { Step3_StaffScreen } from './screens/onboarding/Step3_StaffScreen.jsx';
import { Step4_ClassScreen } from './screens/onboarding/Step4_ClassScreen.jsx';
import { Step5_AppPreviewScreen } from './screens/onboarding/Step5_AppPreviewScreen.jsx';
import { Step6_ConnectPaymentsScreen } from './screens/onboarding/Step6_ConnectPaymentsScreen.jsx';
import { Step7_StripeSuccessScreen } from './screens/onboarding/StripeSuccessScreen.jsx';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The AuthLayout will wrap all the onboarding and auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/signup" element={<SignUpScreen />} />
          <Route path="/onboarding/step-1" element={<Step1_GymDetailsScreen />} />
          <Route path="/onboarding/step-2" element={<Step2_BrandScreen />} />
          <Route path="/onboarding/step-3" element={<Step3_StaffScreen />} />
          <Route path="/onboarding/step-4" element={<Step4_ClassScreen />} />
          <Route path="/onboarding/step-5" element={<Step5_AppPreviewScreen />} />
          <Route path="/onboarding/step-6" element={<Step6_ConnectPaymentsScreen />} />
          <Route path="/onboarding/stripe-success" element={<Step7_StripeSuccessScreen />} />

          {/* Redirect the root URL to the signup page for now */}
          <Route path="/" element={<Navigate to="/signup" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
