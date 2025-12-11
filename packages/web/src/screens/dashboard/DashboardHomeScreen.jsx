import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../../shared/api/firebaseConfig';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';

// Import Widgets
import { NextClassWidget } from './widgets/NextClassWidget';
import { StatsWidget } from './widgets/StatsWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';

const DashboardHomeScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
             setLoading(false);
             return;
        }

        // Get Gym ID from User Profile
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (userData?.gymId) {
          setGymId(userData.gymId);
        }
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Overview</h2>
        <p className="text-gray-500">Welcome back! Here's what's happening at your gym.</p>
      </div>

      {/* Top Stats Row */}
      {/* Changed grid-cols-3 to grid-cols-4 or adjusted gap to fit new data density */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Widget 1: Next Class (Kept separate) */}
        <div className="md:col-span-2 lg:col-span-1">
           <NextClassWidget gymId={gymId} />
        </div>
        
        {/* Widget 2: Stats (Now renders 3 small cards) */}
        {/* The StatsWidget returns a fragment of 3 divs, so they will sit as siblings here */}
        <StatsWidget gymId={gymId} />
        
      </div>

      {/* Bottom Row: Actions */}
      <QuickActionsWidget />
    </div>
  );
};

export default DashboardHomeScreen;