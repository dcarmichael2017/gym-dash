//packages/web/src/screens/dashboard/DashboardHomeScreen.jsx

import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Calendar, Users, TrendingUp, Clock, ArrowRight } from 'lucide-react';

// --- FIX: Use relative imports instead of @shared alias ---
import { auth, db } from '../../../../shared/api/firebaseConfig';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';

const DashboardHomeScreen = () => {
  const [loading, setLoading] = useState(true);
  const [nextClass, setNextClass] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const user = auth.currentUser;
        // If we load this page but auth isn't ready, wait or return.
        // In a real app, ProtectedRoute ensures we are logged in, 
        // but 'currentUser' might briefly be null on hard refresh.
        if (!user) {
             setLoading(false);
             return;
        }

        // 1. Get Gym ID from User
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (userData?.gymId) {
          const gymId = userData.gymId;

          // 2. Fetch Classes
          const classesRef = collection(db, 'gyms', gymId, 'classes');
          const classesSnap = await getDocs(classesRef);
          
          const allClasses = [];
          classesSnap.forEach(doc => {
            allClasses.push({ id: doc.id, ...doc.data() });
          });

          // 3. Determine Next Upcoming Class
          findNextClass(allClasses);
        }

      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const findNextClass = (classes) => {
    if (!classes || classes.length === 0) return;

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'Long' });
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

    // Sort classes by time
    const sortedClasses = classes.sort((a, b) => a.time.localeCompare(b.time));

    // Try to find one today
    const todayClass = sortedClasses.find(c => 
      c.days.includes(currentDay) && 
      (parseInt(c.time.split(':')[0]) * 60 + parseInt(c.time.split(':')[1])) > currentTime
    );

    let upcoming = null;

    if (todayClass) {
      upcoming = { ...todayClass, label: 'Today' };
    } else {
      // If nothing left today, just grab the first one from the list (MVP)
      if(sortedClasses.length > 0) {
          upcoming = { ...sortedClasses[0], label: sortedClasses[0].days[0] }; 
      }
    }

    setNextClass(upcoming);
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Next Class Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Next Upcoming Class</p>
              <h3 className="text-xl font-bold text-gray-800 mt-1">
                {nextClass ? nextClass.name : 'No classes set'}
              </h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          
          {nextClass && (
            <div className="mt-2">
               <div className="flex items-center text-sm text-gray-600 mb-1">
                 <span className="font-semibold text-blue-600 mr-2">{nextClass.label}</span>
                 at {nextClass.time}
               </div>
               <div className="text-xs text-gray-400">
                 {nextClass.duration} mins • {nextClass.frequency}
               </div>
            </div>
          )}
          
          {!nextClass && (
             <p className="text-sm text-gray-400 mt-2">Go to Schedule to add classes.</p>
          )}
        </div>

        {/* Members Card (Placeholder) */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Members</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-2">0</h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-green-600 mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-1" />
            Ready for launch
          </p>
        </div>

        {/* Revenue Card (Placeholder) */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Est. Monthly Revenue</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-2">$0.00</h3>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
           <p className="text-sm text-gray-400 mt-4">
            Connect Stripe to see real data
          </p>
        </div>

      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800">Quick Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Manage Schedule Button */}
             <button 
                onClick={() => navigate('/dashboard/schedule')}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
             >
                <div className="text-left">
                  <h4 className="font-medium text-gray-800">Manage Schedule</h4>
                  <p className="text-sm text-gray-500">Add or edit your class times</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
             </button>

             {/* Invite Staff Button */}
             <button 
                onClick={() => navigate('/dashboard/settings')} 
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
             >
                <div className="text-left">
                  <h4 className="font-medium text-gray-800">Invite Staff</h4>
                  <p className="text-sm text-gray-500">Add instructors to your gym</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHomeScreen;