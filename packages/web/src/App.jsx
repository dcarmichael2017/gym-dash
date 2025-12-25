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
import DashboardMembershipsScreen from './screens/admin/DashboardMembershipsScreen';
import DashboardMembersScreen from './screens/admin/DashboardMembersScreen';
import DashboardStaffScreen from './screens/admin/DashboardStaffScreen';
import DashboardSettingsScreen from './screens/admin/DashboardSettingsScreen';
import DashboardAnalyticsScreen from './screens/admin/DashboardAnalyticsScreen';
import DashboardCalendarScreen from './screens/admin/DashboardCalendarScreen';
import DashboardClassesScreen from './screens/admin/DashboardClassesScreen';

// --- MEMBER SCREENS ---
import MemberHomeScreen from './screens/members/dashboard/MemberHomeScreen';
import MemberScheduleScreen from './screens/members/MemberScheduleScreen';
import MemberProfileScreen from './screens/members/MemberProfileScreen';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. GLOBAL AUTH LISTENER
  useEffect(() => {
    console.log("[App] Effect mounted, listening for auth...");
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("[App] Auth State Changed. User:", currentUser ? currentUser.uid : "null");

      if (currentUser) {
        // 1. Set user immediately so router knows we are authenticated
        setUser(currentUser);
        
        try {
          console.log("[App] Fetching role for:", currentUser.uid);
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          
          if (userDoc.exists()) {
            const userRole = userDoc.data().role || 'member';
            console.log("[App] Role found:", userRole);
            setRole(userRole);
          } else {
            console.log("[App] No profile found, defaulting to member");
            setRole('member');
          }
        } catch (error) {
          console.error("[App] Error fetching role:", error);
          setRole('member');
        }
      } else {
        console.log("[App] User logged out. Clearing state.");
        setUser(null);
        setRole(null);
      }
      
      // 2. Only stop loading AFTER role is determined
      console.log("[App] Loading complete. Rendering Router.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    console.log("[App] Render: Still Loading...");
    return <FullScreenLoader />;
  }

  console.log("[App] Render: Router. User:", user?.uid, "Role:", role);

  // Helper to protect login routes
  const PublicOnlyRoute = ({ children }) => {
    if (user) {
        console.log("[App] PublicRoute Redirecting to / because user exists");
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
              <Route path="memberships" element={<DashboardMembershipsScreen />} />
              <Route path="members" element={<DashboardMembersScreen />} />
              <Route path="staff" element={<DashboardStaffScreen />} />
              <Route path="settings" element={<DashboardSettingsScreen />} />
            </Route>

            {/* --- MEMBER ROUTES --- */}
            <Route path="/members" element={user && role === 'member' ? <MemberLayout /> : <Navigate to="/login" />}>
              <Route path="home" element={<MemberHomeScreen />} />
              <Route path="schedule" element={<MemberScheduleScreen />} />
              <Route path="profile" element={<MemberProfileScreen />} />
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