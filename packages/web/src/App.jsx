import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import { AuthLayout } from './components/layout/AuthLayout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';

// Auth
import { ProtectedRoute } from './components/auth/ProtectedRoute.jsx';

// Screens - Auth
import { SignUpScreen } from './screens/auth/SignUpScreen.jsx';
import { LoginScreen } from './screens/auth/LoginScreen.jsx';

// Screens - Onboarding
import { Step1_GymDetailsScreen } from './screens/onboarding/Step1_GymDetailsScreen.jsx';
import { Step2_BrandScreen } from './screens/onboarding/Step2_BrandScreen.jsx';
import { Step3_StaffScreen } from './screens/onboarding/Step3_StaffScreen.jsx';
import { Step4_ClassScreen } from './screens/onboarding/Step4_ClassScreen.jsx';
import { Step5_AppPreviewScreen } from './screens/onboarding/Step5_AppPreviewScreen.jsx';
import { Step6_ConnectPaymentsScreen } from './screens/onboarding/Step6_ConnectPaymentsScreen.jsx';
import { StripeSuccessScreen } from './screens/onboarding/StripeSuccessScreen.jsx';

// Screens - Dashboard
import DashboardHomeScreen from './screens/dashboard/DashboardHomeScreen.jsx';
import DashboardMembershipsScreen from './screens/dashboard/DashboardMembershipsScreen.jsx';
import DashboardMembersScreen from './screens/dashboard/DashboardMembersScreen.jsx';
import DashboardStaffScreen from './screens/dashboard/DashboardStaffScreen.jsx';
import DashboardSettingsScreen from './screens/dashboard/DashboardSettingsScreen.jsx';
import DashboardAnalyticsScreen from './screens/dashboard/DashboardAnalyticsScreen.jsx';
import DashboardCalendarScreen from './screens/dashboard/DashboardCalendarScreen.jsx';
import DashboardClassesScreen from './screens/dashboard/DashboardClassesScreen.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- PUBLIC AUTH ROUTES --- */}
        <Route element={<AuthLayout />}>
          <Route path="/signup" element={<SignUpScreen />} />
          <Route path="/login" element={<LoginScreen />} />
        </Route>

        {/* --- PRIVATE APP ROUTES --- */}
        <Route element={<ProtectedRoute />}>

          {/* Onboarding Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/onboarding/step-1" element={<Step1_GymDetailsScreen />} />
            <Route path="/onboarding/step-2" element={<Step2_BrandScreen />} />
            <Route path="/onboarding/step-3" element={<Step3_StaffScreen />} />
            <Route path="/onboarding/step-4" element={<Step4_ClassScreen />} />
            <Route path="/onboarding/step-5" element={<Step5_AppPreviewScreen />} />
            <Route path="/onboarding/step-6" element={<Step6_ConnectPaymentsScreen />} />
          </Route>

          <Route path="/onboarding/stripe-success" element={<StripeSuccessScreen />} />

          {/* --- ADMIN DASHBOARD --- */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHomeScreen />} />
            <Route path="analytics" element={<DashboardAnalyticsScreen />} />

            {/* REPLACES THE OLD SCHEDULE ROUTE */}
            <Route path="calendar" element={<DashboardCalendarScreen />} />
            <Route path="classes" element={<DashboardClassesScreen />} />

            <Route path="memberships" element={<DashboardMembershipsScreen />} />
            <Route path="members" element={<DashboardMembersScreen />} />
            <Route path="staff" element={<DashboardStaffScreen />} />
            <Route path="settings" element={<DashboardSettingsScreen />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;