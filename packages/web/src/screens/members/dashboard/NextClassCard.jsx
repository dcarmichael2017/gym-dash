import React, { useEffect, useState } from 'react';
import { Clock, ArrowRight, Loader2, CalendarX, Sparkles, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../../../../../packages/shared/api/firebaseConfig'; 
import { useGym } from '../../../context/GymContext';
import { getNextUpcomingClass, getMembershipTiers } from '../../../../../../packages/shared/api/firestore'; 

const NextClassCard = ({ hasActiveMembership }) => {
  const navigate = useNavigate();
  const { currentGym } = useGym();
  
  // --- THEME ---
  const theme = currentGym?.theme || { primaryColor: '#2563eb' }; // Default Blue

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

        const classResult = await getNextUpcomingClass(currentGym.id);
        
        if (classResult.success && classResult.nextClass) {
            const cls = classResult.nextClass;
            setNextClass(cls);

            if (cls.instructorId && !cls.instructorName) {
                try {
                    const staffRef = doc(db, 'gyms', currentGym.id, 'staff', cls.instructorId);
                    const staffSnap = await getDoc(staffRef);
                    if (staffSnap.exists()) {
                        const fullName = staffSnap.data().name || "Instructor";
                        setInstructorName(fullName.split(' ')[0]); 
                    }
                } catch (err) {
                    console.error("Error fetching instructor:", err);
                }
            } else if (cls.instructorName) {
                setInstructorName(cls.instructorName);
            }

            if (cls.allowedMembershipIds && cls.allowedMembershipIds.length > 0) {
                const tiersResult = await getMembershipTiers(currentGym.id);
                if (tiersResult.success) {
                    const names = tiersResult.tiers
                        .filter(t => cls.allowedMembershipIds.includes(t.id))
                        .map(t => t.name);
                    setIncludedPlanNames(names);
                }
            }
        }
        setLoading(false);
    };
    fetchData();
  }, [currentGym?.id]);

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
        {/* Background Decoration */}
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

                    {/* INSTRUCTOR BADGE */}
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
                                            {includedPlanNames.length > 1 && ` +${includedPlanNames.length - 1} more`}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded mb-1 w-fit">
                                        Membership Required
                                    </span>
                                    {includedPlanNames.length > 0 ? (
                                        <span className="text-[10px] opacity-80 max-w-[150px] truncate">
                                            Available on: {includedPlanNames.join(', ')}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] opacity-80">Check plans for access</span>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        <span className="text-xs font-medium text-blue-100">
                           Ready to train?
                        </span>
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