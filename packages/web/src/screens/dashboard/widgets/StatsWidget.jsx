import React, { useState, useEffect } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { Users, TrendingUp, Shield } from 'lucide-react';
import { db } from '../../../../../shared/api/firebaseConfig';

export const StatsWidget = ({ gymId }) => {
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!gymId) return;
      try {
        // Fetch Real Staff Count
        const staffRef = collection(db, 'gyms', gymId, 'staff');
        const snapshot = await getCountFromServer(staffRef);
        setStaffCount(snapshot.data().count);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [gymId]);

  if (loading) return <div className="h-40 bg-gray-50 rounded-xl animate-pulse col-span-2"></div>;

  return (
    <>
      {/* Active Staff (REAL DATA) */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500">Active Staff</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-2">{staffCount}</h3>
          </div>
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Shield className="h-6 w-6 text-indigo-600" />
          </div>
        </div>
        <p className="text-sm text-indigo-600 mt-4 flex items-center">
           Instructors & Admins
        </p>
      </div>

      {/* Members (PLACEHOLDER) */}
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
    </>
  );
};