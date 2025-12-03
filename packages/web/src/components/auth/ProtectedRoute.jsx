// /packages/web/src/components/auth/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
// --- UPDATED IMPORT ---
// Using relative path to match your project structure
import { auth, db } from '../../../../shared/api/firebaseConfig.js';
// --- END UPDATE ---
import { FullScreenLoader } from '../layout/FullScreenLoader.jsx';

export const ProtectedRoute = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // No user, redirect to login
        setIsLoading(false);
        setIsAuthenticated(false);
        // Don't redirect if we are already on a public auth page
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        return;
      }

      // User is logged in, check their onboarding status
      try {
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();
          const { onboardingStep, gymId } = userData;

          const currentPath = location.pathname;

          if (onboardingStep === 'complete') {
            // Onboarding is done
            setIsLoading(false);
            setIsAuthenticated(true);
            // If they are on an auth or onboarding page, send them to dashboard
            if (currentPath.includes('/onboarding') || currentPath === '/login' || currentPath === '/signup') {
              navigate('/');
            }
            // Otherwise, let them go where they were headed
          } else {
            // --- START UPDATED LOGIC ---
            // Onboarding is not complete

            // Get the user's required step number (e.g., 'step2_branding' -> 2)
            const targetStepNum = parseInt(onboardingStep.split('_')[0].replace('step', ''), 10);
            const targetStepPath = `/onboarding/step-${targetStepNum}`;

            // Get the step number the user is *currently* on
            let currentStepNum = 0;
            if (currentPath.includes('/onboarding/step-')) {
              // User is on a specific step, get the number
              currentStepNum = parseInt(currentPath.split('-')[1], 10);
            } else {
              // User is on /dashboard, /, /settings, etc.
              // We treat ANY non-onboarding page as "Step 999" (skipping ahead)
              currentStepNum = 999; 
            }

            // Only redirect if the user is trying to skip *AHEAD*
            if (currentStepNum > targetStepNum) {
              console.warn(`Redirecting: User on step ${targetStepNum} tried to access future step ${currentStepNum}.`);
              const routeState = targetStepNum > 1 ? { state: { gymId } } : {};
              navigate(targetStepPath, { ...routeState, replace: true });

            } else {
              // ALLOW navigation. User is on their correct step or a previous one.
              // (e.g., currentStep (1) <= targetStep (2))
              setIsAuthenticated(true);
            }
            setIsLoading(false);
            // --- END UPDATED LOGIC ---
          }
        } else {
          // This case happens on first sign-up
          // The user exists (auth) but the profile (firestore) doc hasn't been created yet.
          // This is fine, as createUserProfile runs right after signup.
          // But if they are logged in and have no profile, send to step 1.
          console.warn("No user profile found for logged in user! Redirecting to step 1.");
          navigate('/onboarding/step-1', { replace: true });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        navigate('/login'); // Something went wrong, kick to login
      }
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [navigate, location.pathname]); // Re-run if navigation changes

  if (isLoading) {
    return <FullScreenLoader />;
  }

  // If authenticated, render the child routes (e.g., Dashboard, Onboarding steps)
  // If not, and we're on a public route, also render (this is handled by App.jsx)
  // This component's logic is primarily for *redirecting*
  // The actual showing/hiding is done by the route structure in App.jsx
  return <Outlet />;
};