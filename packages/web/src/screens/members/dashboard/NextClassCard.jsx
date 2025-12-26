import React, { useEffect, useState } from 'react';
import { Clock, ArrowRight, Loader2, CalendarX, Sparkles, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'; 
import { db } from '../../../../../../packages/shared/api/firebaseConfig'; 
import { useGym } from '../../../context/GymContext';
import { getMembershipTiers } from '../../../../../../packages/shared/api/firestore'; 

const NextClassCard = ({ hasActiveMembership }) => {
  const navigate = useNavigate();
  const { currentGym } = useGym();
  
  const theme = currentGym?.theme || { primaryColor: '#2563eb' };

  const [nextClass, setNextClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [includedPlanNames, setIncludedPlanNames] = useState([]);
  const [instructorName, setInstructorName] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentGym?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setNextClass(null);
      setInstructorName(null);
      setIncludedPlanNames([]);

      try {
        // 1. Fetch all class templates for this gym
        const classesRef = collection(db, 'gyms', currentGym.id, 'classes');
        const classSnap = await getDocs(classesRef);
        const allClassTemplates = classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Calculate the next occurring instance (Recurring OR Single Event)
        const foundNextClass = calculateNextClass(allClassTemplates);

        if (foundNextClass) {
          setNextClass(foundNextClass);

          // Handle Instructor Name
          if (foundNextClass.instructorId && !foundNextClass.instructorName) {
            const staffRef = doc(db, 'gyms', currentGym.id, 'staff', foundNextClass.instructorId);
            const staffSnap = await getDoc(staffRef);
            if (staffSnap.exists()) {
              const fullName = staffSnap.data().name || "Instructor";
              setInstructorName(fullName.split(' ')[0]); 
            }
          } else {
            setInstructorName(foundNextClass.instructorName || null);
          }

          // Handle Membership Tiers
          if (foundNextClass.allowedMembershipIds?.length > 0) {
            const tiersResult = await getMembershipTiers(currentGym.id);
            if (tiersResult.success) {
              const names = tiersResult.tiers
                .filter(t => foundNextClass.allowedMembershipIds.includes(t.id))
                .map(t => t.name);
              setIncludedPlanNames(names);
            }
          }
        }
      } catch (err) {
        console.error("Error calculating next class:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentGym?.id]);

  // Helper to find the absolute next class instance from all templates
  const calculateNextClass = (classes) => {
    const now = new Date();
    const DAYS_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let potentialInstances = [];

    // Look ahead 7 days to find the nearest instance
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + i);
      const dayName = DAYS_MAP[targetDate.getDay()];
      
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      classes.forEach(cls => {
        const isRecurringMatch = cls.days?.map(d => d.toLowerCase()).includes(dayName);
        const isNotCancelled = !cls.cancelledDates?.includes(dateString);
        const isSingleEventMatch = cls.frequency === 'Single Event' && cls.startDate === dateString;

        if ((isRecurringMatch && isNotCancelled && cls.frequency !== 'Single Event') || isSingleEventMatch) {
          
          // Create a Date object for the specific time of this class
          const [hours, minutes] = cls.time.split(':');
          const instanceFullDate = new Date(targetDate);
          instanceFullDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          // Only include if it hasn't started yet today
          if (instanceFullDate > now) {
            potentialInstances.push({
              ...cls,
              instanceDate: instanceFullDate,
              dateString
            });
          }
        }
      });

      // If we found classes for this day, stop and pick the earliest one
      if (potentialInstances.length > 0) break;
    }

    // Sort by time and return the first one
    return potentialInstances.sort((a, b) => a.instanceDate - b.instanceDate)[0];
  };

  const formatClassTime = (dateObj) => {
    if (!dateObj || !(dateObj instanceof Date)) return '';
    const now = new Date();
    const isToday = dateObj.getDate() === now.getDate() && dateObj.getMonth() === now.getMonth();
    const isTomorrow = dateObj.getDate() === now.getDate() + 1;
    const timeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return `${dateObj.toLocaleDateString([], { weekday: 'long' })}, ${timeStr}`;
  };

  // ... (Keep existing Render Logic)
  if (loading) {
    return (
      <div 
          className="rounded-2xl p-6 h-48 flex items-center justify-center shadow-lg transition-all"
          style={{ backgroundColor: theme.primaryColor, boxShadow: `0 10px 30px -10px ${theme.primaryColor}50` }}
      >
          <Loader2 className="animate-spin text-white opacity-50" />
      </div>
    );
  }

  if (!nextClass) {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden h-48 flex flex-col justify-center items-center text-center">
           <CalendarX className="opacity-50 mb-2" size={32} />
           <h2 className="font-bold text-lg">No Upcoming Classes</h2>
           <p className="text-sm opacity-70">Check back later for schedule updates.</p>
      </div>
    );
  }

  return (
    <div 
        className="rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transition-all hover:scale-[1.01]"
        style={{ backgroundColor: theme.primaryColor, boxShadow: `0 10px 30px -10px ${theme.primaryColor}50` }}
    >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col items-start">
                    <span className="bg-black/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-white/10 backdrop-blur-md">
                        Up Next
                    </span>
                    <h2 className="text-xl font-bold mt-2 truncate max-w-[250px] leading-tight">
                        {nextClass.name}
                    </h2>
                    <p className="opacity-90 text-sm flex items-center gap-1.5 mt-1">
                        <Clock size={14} /> 
                        <span>
                            {formatClassTime(nextClass.instanceDate)} 
                            <span className="opacity-60 ml-1">({nextClass.duration}m)</span>
                        </span>
                    </p>
                    {instructorName && (
                        <div className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-white bg-black/20 px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10">
                            <User size={12} className="opacity-80" />
                            <span>with {instructorName}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
                <div className="flex flex-col">
                    {!hasActiveMembership ? (
                        <>
                            {nextClass.dropInEnabled ? (
                                <>
                                    <span className="text-[10px] uppercase opacity-75 font-bold">Drop-in Price</span>
                                    <span className="text-lg font-bold">${nextClass.dropInPrice || 25}</span>
                                    {includedPlanNames.length > 0 && (
                                        <span className="text-[10px] text-blue-100 mt-1 flex items-center gap-1">
                                            <Sparkles size={10} />
                                            Free with {includedPlanNames[0]}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded mb-1 w-fit">
                                    Membership Required
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-xs font-medium text-blue-100">Ready to train?</span>
                    )}
                </div>
                <button 
                    onClick={() => navigate('/members/schedule')}
                    className="bg-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 hover:bg-blue-50 transition-colors shadow-sm"
                    style={{ color: theme.primaryColor }}
                >
                    Book <ArrowRight size={14} />
                </button>
            </div>
        </div>
    </div>
  );
};

export default NextClassCard;