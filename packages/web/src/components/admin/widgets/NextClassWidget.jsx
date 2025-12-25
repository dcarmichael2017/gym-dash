import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { db } from '../../../../../shared/api/firebaseConfig'; // Adjust path if needed based on your folder structure

export const NextClassWidget = ({ gymId }) => {
  const [nextClass, setNextClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNextClass = async () => {
      if (!gymId) return;
      try {
        const classesRef = collection(db, 'gyms', gymId, 'classes');
        const snapshot = await getDocs(classesRef);
        const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const now = new Date();
        // --- FIX: 'long' must be lowercase ---
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }); 
        // -------------------------------------
        const currentTime = now.getHours() * 60 + now.getMinutes(); 

        const sortedClasses = classes.sort((a, b) => a.time.localeCompare(b.time));
        
        // 1. Check for remaining classes today
        let upcoming = sortedClasses.find(c => 
          c.days.includes(currentDay) && 
          (parseInt(c.time.split(':')[0]) * 60 + parseInt(c.time.split(':')[1])) > currentTime
        );

        // 2. If none today, just grab the earliest class in the list
        if (!upcoming && sortedClasses.length > 0) {
           upcoming = sortedClasses[0]; 
        }

        if (upcoming) {
            // Label logic
            const isToday = upcoming.days.includes(currentDay) && 
                (parseInt(upcoming.time.split(':')[0]) * 60 + parseInt(upcoming.time.split(':')[1])) > currentTime;
            
            setNextClass({ ...upcoming, label: isToday ? 'Today' : 'Upcoming' });
        }

      } catch (error) {
        console.error("Error fetching next class:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNextClass();
  }, [gymId]);

  if (loading) return <div className="h-40 bg-gray-50 rounded-xl animate-pulse"></div>;

  return (
    <div 
      onClick={() => navigate('/dashboard/schedule')}
      className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Next Upcoming Class</p>
          <h3 className="text-xl font-bold text-gray-800 mt-1">
            {nextClass ? nextClass.name : 'No classes set'}
          </h3>
        </div>
        <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
          <Clock className="h-6 w-6 text-blue-600" />
        </div>
      </div>
      
      {nextClass ? (
        <div className="mt-2">
           <div className="flex items-center text-sm text-gray-600 mb-1">
             <span className={`font-semibold mr-2 ${nextClass.label === 'Today' ? 'text-green-600' : 'text-blue-600'}`}>
                {nextClass.label}
             </span>
             at {nextClass.time}
           </div>
           <div className="text-xs text-gray-400">
             {nextClass.duration} mins • {nextClass.frequency || 'Weekly'}
           </div>
        </div>
      ) : (
         <div className="flex items-center text-sm text-blue-600 font-medium">
            Go to Schedule <ArrowRight className="h-4 w-4 ml-1" />
         </div>
      )}
    </div>
  );
};