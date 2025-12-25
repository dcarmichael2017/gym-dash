import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// --- SHARED ---
import { auth, db } from '../../../packages/shared/api/firebaseConfig';
import { ConfirmationProvider } from './context/ConfirmationContext';
import { GymProvider } from './context/GymContext';
import { FullScreenLoader } from './components/common/FullScreenLoader';

// --- LAYOUTS ---
import { AuthLayout } from './layout/AuthLayout';
import AdminLayout from './layout/AdminLayout'; // Renamed from DashboardLayout
import MemberLayout from './layout/MemberLayout'; // New!

// --- AUTH SCREENS ---
import { SignUpScreen } from './screens/auth/SignUpScreen';
import { LoginScreen } from './screens/auth/LoginScreen';

// --- ONBOARDING SCREENS ---
import { Step1_GymDetailsScreen } from './screens/onboarding/Step1_GymDetailsScreen';
import { Step2_BrandScreen } from './screens/onboarding/Step2_BrandScreen';
import { Step3_StaffScreen } from './screens/onboarding/Step3_StaffScreen';
import { Step4_ClassScreen } from './screens/onboarding/Step4_ClassScreen';
import { Step5_AppPreviewScreen } from './screens/onboarding/Step5_AppPreviewScreen';
import { Step6_ConnectPaymentsScreen } from './screens/onboarding/Step6_ConnectPaymentsScreen';
import { StripeSuccessScreen } from './screens/onboarding/StripeSuccessScreen';

// --- ADMIN SCREENS ---
import DashboardHomeScreen from './screens/admin/DashboardHomeScreen';
import DashboardMembershipsScreen from './screens/admin/DashboardMembershipsScreen';
import DashboardMembersScreen from './screens/admin/DashboardMembersScreen';
import DashboardStaffScreen from './screens/admin/DashboardStaffScreen';
import DashboardSettingsScreen from './screens/admin/DashboardSettingsScreen';
import DashboardAnalyticsScreen from './screens/admin/DashboardAnalyticsScreen';
import DashboardCalendarScreen from './screens/admin/DashboardCalendarScreen';
import DashboardClassesScreen from './screens/admin/DashboardClassesScreen';

// --- MEMBER SCREENS (New!) ---
import MemberHomeScreen from './screens/members/MemberHomeScreen';
import MemberScheduleScreen from './screens/members/MemberScheduleScreen';
import MemberProfileScreen from './screens/members/MemberProfileScreen';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'owner', 'member', 'staff'
  const [loading, setLoading] = useState(true);

  // 1. GLOBAL AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Fetch Role from Firestore
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // If no role is defined, default to member to be safe
            setRole(userData.role || 'member');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setRole(null);
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <FullScreenLoader />;

  return (
    <ConfirmationProvider>
      <GymProvider>
        <BrowserRouter>
          <Routes>

            {/* --- PUBLIC AUTH --- */}
            <Route element={<AuthLayout />}>
              <Route path="/signup" element={<SignUpScreen />} />
              <Route path="/login" element={<LoginScreen />} />
            </Route>

            {/* --- ONBOARDING (Owner Only) --- */}
            {/* We protect this manually to allow flow continuity */}
            <Route element={<AuthLayout />}>
              <Route path="/onboarding/step-1" element={<Step1_GymDetailsScreen />} />
              <Route path="/onboarding/step-2" element={<Step2_BrandScreen />} />
              <Route path="/onboarding/step-3" element={<Step3_StaffScreen />} />
              <Route path="/onboarding/step-4" element={<Step4_ClassScreen />} />
              <Route path="/onboarding/step-5" element={<Step5_AppPreviewScreen />} />
              <Route path="/onboarding/step-6" element={<Step6_ConnectPaymentsScreen />} />
            </Route>
            <Route path="/onboarding/stripe-success" element={<StripeSuccessScreen />} />

            {/* --- ADMIN LAND (Owners/Staff) --- */}
            {/* RENAMED from /dashboard to /admin for clarity */}
            <Route path="/admin" element={user && (role === 'owner' || role === 'staff') ? <AdminLayout /> : <Navigate to="/login" />}>
              <Route index element={<DashboardHomeScreen />} />
              <Route path="analytics" element={<DashboardAnalyticsScreen />} />
              <Route path="calendar" element={<DashboardCalendarScreen />} />
              <Route path="classes" element={<DashboardClassesScreen />} />
              <Route path="memberships" element={<DashboardMembershipsScreen />} />
              <Route path="members" element={<DashboardMembersScreen />} />
              <Route path="staff" element={<DashboardStaffScreen />} />
              <Route path="settings" element={<DashboardSettingsScreen />} />
            </Route>

            {/* --- MEMBER LAND (Students) --- */}
            {/* NEW Route Section */}
            <Route path="/members" element={user && role === 'member' ? <MemberLayout /> : <Navigate to="/login" />}>
              <Route path="home" element={<MemberHomeScreen />} />
              <Route path="schedule" element={<MemberScheduleScreen />} />
              <Route path="profile" element={<MemberProfileScreen />} />
              {/* Default Redirect within Member Land */}
              <Route index element={<Navigate to="home" replace />} />
            </Route>

            {/* --- SMART ROOT REDIRECT --- */}
            {/* Decides where to send you based on who you are */}
            <Route path="/" element={
              !user ? <Navigate to="/login" /> :
                (role === 'owner' || role === 'staff') ? <Navigate to="/admin" /> :
                  <Navigate to="/members/home" />
            } />

            {/* --- CATCH ALL --- */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </GymProvider>
    </ConfirmationProvider>
  );
}

export default App;