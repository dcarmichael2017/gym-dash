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
import AdminLayout from './layout/AdminLayout';
import MemberLayout from './layout/MemberLayout';

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
import DashboardMembershipsScreen from './screens/admin/MembershipsScreen';
import DashboardMembersScreen from './screens/admin/DashboardMembersScreen';
import DashboardStaffScreen from './screens/admin/DashboardStaffScreen';
import DashboardSettingsScreen from './screens/admin/DashboardSettingsScreen';
import DashboardAnalyticsScreen from './screens/admin/DashboardAnalyticsScreen';
import DashboardCalendarScreen from './screens/admin/DashboardCalendarScreen';
import DashboardClassesScreen from './screens/admin/DashboardClassesScreen';

// --- MEMBER SCREENS ---
import MemberHomeScreen from './screens/members/dashboard/MemberHomeScreen';
import MemberScheduleScreen from './screens/members/schedule/MemberScheduleScreen';
import MemberProfileScreen from './screens/members/profile/MemberProfileScreen';

// UPDATED IMPORTS FOR STORE
import { StoreScreen } from './screens/members/store'; // The UI
import { StoreProvider } from './screens/members/store/StoreContext'; // The Data Layer
import BroadcastCenterScreen from './screens/admin/BroadcastCenterScreen';
import CommunityFeedScreen from './screens/admin/CommunityFeedScreen';
import GroupChatScreen from './screens/admin/GroupChatScreen';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. GLOBAL AUTH LISTENER
  useEffect(() => {
    console.log("[App] Effect mounted, listening for auth...");

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role || 'member');
          } else {
            setRole('member');
          }
          setUser(currentUser);
        } catch (error) {
          setRole('member');
          setUser(currentUser);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <FullScreenLoader />;
  }

  // Helper to protect login routes
  const PublicOnlyRoute = ({ children }) => {
    if (user) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <ConfirmationProvider>
      <GymProvider>
        <BrowserRouter>
          <Routes>

            {/* --- PUBLIC AUTH --- */}
            <Route element={<AuthLayout />}>
              <Route path="/signup" element={<PublicOnlyRoute><SignUpScreen /></PublicOnlyRoute>} />
              <Route path="/login" element={<PublicOnlyRoute><LoginScreen /></PublicOnlyRoute>} />
            </Route>

            {/* --- ONBOARDING --- */}
            <Route element={<AuthLayout />}>
              <Route path="/onboarding/step-1" element={<Step1_GymDetailsScreen />} />
              <Route path="/onboarding/step-2" element={<Step2_BrandScreen />} />
              <Route path="/onboarding/step-3" element={<Step3_StaffScreen />} />
              <Route path="/onboarding/step-4" element={<Step4_ClassScreen />} />
              <Route path="/onboarding/step-5" element={<Step5_AppPreviewScreen />} />
              <Route path="/onboarding/step-6" element={<Step6_ConnectPaymentsScreen />} />
            </Route>
            <Route path="/onboarding/stripe-success" element={<StripeSuccessScreen />} />

            {/* --- ADMIN ROUTES --- */}
            <Route path="/admin" element={user && (role === 'owner' || role === 'staff') ? <AdminLayout /> : <Navigate to="/login" />}>
              <Route index element={<DashboardHomeScreen />} />
              <Route path="analytics" element={<DashboardAnalyticsScreen />} />
              <Route path="calendar" element={<DashboardCalendarScreen />} />
              <Route path="classes" element={<DashboardClassesScreen />} />
              <Route path="broadcast" element={<BroadcastCenterScreen />} />
              <Route path="community" element={<CommunityFeedScreen viewMode="admin" />} />
              <Route path="chat" element={<GroupChatScreen viewMode="admin" />} />
              <Route path="memberships" element={<DashboardMembershipsScreen />} />
              <Route path="members" element={<DashboardMembersScreen />} />
              <Route path="staff" element={<DashboardStaffScreen />} />
              <Route path="settings" element={<DashboardSettingsScreen />} />
            </Route>

            {/* --- MEMBER ROUTES --- */}
            <Route path="/members" element={
                user && role === 'member' ? (
                    // WRAP ALL MEMBER ROUTES SO CART PERSISTS
                    <StoreProvider>
                        <MemberLayout />
                    </StoreProvider>
                ) : <Navigate to="/login" />
            }>
              <Route path="home" element={<MemberHomeScreen />} />
              <Route path="schedule" element={<MemberScheduleScreen />} />
              <Route path="profile" element={<MemberProfileScreen />} />
              
              <Route path="community" element={<CommunityFeedScreen viewMode="member" />} />
              <Route path="chat" element={<GroupChatScreen viewMode="member" />} />
              <Route path="store" element={<StoreScreen />} />
              
              <Route index element={<Navigate to="home" replace />} />
            </Route>

            {/* --- ROOT REDIRECT --- */}
            <Route path="/" element={
              !user ? <Navigate to="/login" /> :
                (role === 'owner' || role === 'staff') ? <Navigate to="/admin" /> :
                  <Navigate to="/members/home" />
            } />

            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </GymProvider>
    </ConfirmationProvider>
  );
}

export default App;