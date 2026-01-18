import React, { useEffect, useState } from 'react';
import { Clock, ArrowRight, Loader2, CalendarX, Sparkles, User, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'; 
import { db, auth } from '../../../../../../packages/shared/api/firebaseConfig'; 
import { useGym } from '../../../context/GymContext';
import { getMembershipTiers } from '../../../../../../packages/shared/api/firestore'; 

const NextClassCard = ({ hasActiveMembership }) => {
  const navigate = useNavigate();
  const { currentGym, memberships, credits } = useGym(); // ✅ Get credits from context

  const theme = currentGym?.theme || { primaryColor: '#2563eb' };

  const [nextClass, setNextClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBooked, setIsBooked] = useState(false);
  const [includedPlanNames, setIncludedPlanNames] = useState([]);
  const [instructorName, setInstructorName] = useState(null);
  const [isCreditOnly, setIsCreditOnly] = useState(false); // ✅ Track if class is credit-only

  useEffect(() => {
    const fetchData = async () => {
      if (!currentGym?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setNextClass(null);
      setIsBooked(false);
      setInstructorName(null);
      setIncludedPlanNames([]);
      setIsCreditOnly(false); // ✅ Reset credit-only flag

      try {
        // 1. Fetch all class templates for this gym
        const classesRef = collection(db, 'gyms', currentGym.id, 'classes');
        const classSnap = await getDocs(classesRef);
        const allClassTemplates = classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- 2. SETUP USER ROLES ---
        const myMembership = memberships.find(m => m.gymId === currentGym.id);
        const isOwner = currentGym.ownerId === auth.currentUser?.uid;
        const isStaff = myMembership?.role === 'staff' || myMembership?.role === 'coach' || myMembership?.role === 'admin';

        // --- 3. FILTER CLASSES ---
        const visibleTemplates = allClassTemplates.filter(cls => {
            const level = cls.visibility || 'public';
            if (isOwner) return true;
            if (isStaff) return level !== 'admin';
            return level === 'public';
        });

        // 4. Calculate the next occurring instance using ONLY visible classes
        const foundNextClass = calculateNextClass(visibleTemplates);

        if (foundNextClass) {
          setNextClass(foundNextClass);

          // Check if user is already booked for this specific class instance
          if (auth.currentUser) {
            const attendanceId = `${foundNextClass.id}_${foundNextClass.dateString}_${auth.currentUser.uid}`;
            const attendanceRef = doc(db, 'gyms', currentGym.id, 'attendance', attendanceId);
            const attendanceSnap = await getDoc(attendanceRef);
            if (attendanceSnap.exists() && ['booked', 'waitlisted'].includes(attendanceSnap.data().status)) {
              setIsBooked(true);
            }
          }

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

          // Handle Membership Tiers (WITH VISIBILITY CHECK)
          if (foundNextClass.allowedMembershipIds?.length > 0) {
            const tiersResult = await getMembershipTiers(currentGym.id);
            if (tiersResult.success) {
              const visibleTiers = tiersResult.tiers.filter(t => {
                   // A. Must be allowed for this class
                   if (!foundNextClass.allowedMembershipIds.includes(t.id)) return false;

                   // B. Must be visible to the current user
                   const level = t.visibility || 'public';
                   if (isOwner) return true;
                   if (isStaff) return level !== 'admin';
                   return level === 'public';
                });

              const names = visibleTiers.map(t => t.name);
              setIncludedPlanNames(names);

              // ✅ Determine if class is credit-only (no memberships include it)
              const userMembership = myMembership;
              const userTierId = userMembership?.membershipId;
              const isMembershipIncluded = userTierId && foundNextClass.allowedMembershipIds.includes(userTierId);

              // Credit-only if: class requires credits AND user's membership doesn't cover it
              setIsCreditOnly(!isMembershipIncluded && foundNextClass.dropInEnabled);
            }
          } else {
            // ✅ If no allowed memberships, it's credit-only
            setIsCreditOnly(foundNextClass.dropInEnabled);
          }
        }
      } catch (err) {
        console.error("Error calculating next class:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentGym?.id, memberships]);

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

  // --- NAVIGATION LOGIC ---
  const handleAction = () => {
      const creditCost = nextClass?.creditCost !== undefined ? nextClass.creditCost : 0;

      if (isBooked) {
          // 1. ALREADY BOOKED -> Go to Schedule
          navigate('/members/schedule');
      } else if (isCreditOnly && hasActiveMembership) {
          // 2. CREDIT-ONLY CLASS + HAS MEMBERSHIP
          // If user has enough credits, go to schedule to book
          // Otherwise, go to store to buy credits
          if (credits >= creditCost) {
              navigate('/members/schedule');
          } else {
              navigate('/members/store', { state: { category: 'packs' } });
          }
      } else if (hasActiveMembership) {
          // 3. HAS MEMBERSHIP (class is included) -> Go to Schedule
          navigate('/members/schedule');
      } else {
          // 4. NO MEMBERSHIP (prospect)
          if (nextClass?.dropInEnabled && credits >= creditCost) {
              // ✅ Has enough credits -> Go to Schedule to book
              navigate('/members/schedule');
          } else if (nextClass?.dropInEnabled) {
              // Has drop-in but not enough credits -> Go to store
              navigate('/members/store', { state: { category: 'packs' } });
          } else {
              // Membership required -> Go to memberships tab
              navigate('/members/store', { state: { category: 'memberships' } });
          }
      }
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

  // Helper to determine cost display
  const creditCost = nextClass.creditCost !== undefined ? nextClass.creditCost : 0;

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
                    {isBooked ? (
                        <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded mb-1 w-fit">
                            You're Booked!
                        </span>
                    ) : isCreditOnly && hasActiveMembership ? (
                        // ✅ CREDIT-ONLY CLASS (user has membership but class requires credits)
                        <>
                            <span className="text-[10px] uppercase opacity-75 font-bold">Credit Cost</span>
                            {creditCost > 0 ? (
                                <>
                                    <span className="text-lg font-bold">
                                        {creditCost} Credit{creditCost !== 1 ? 's' : ''}
                                    </span>
                                    {credits >= creditCost ? (
                                        <span className="text-[10px] text-green-100 mt-1 flex items-center gap-1">
                                            <Sparkles size={10} />
                                            You have {credits} credit{credits !== 1 ? 's' : ''}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-orange-100 mt-1 flex items-center gap-1">
                                            <ShoppingBag size={10} />
                                            Need {creditCost - credits} more
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-lg font-bold">Free</span>
                            )}
                        </>
                    ) : !hasActiveMembership ? (
                        <>
                            {nextClass.dropInEnabled ? (
                                <>
                                    <span className="text-[10px] uppercase opacity-75 font-bold">Credit Cost</span>
                                    {creditCost > 0 ? (
                                        <>
                                            <span className="text-lg font-bold">
                                                {creditCost} Credit{creditCost !== 1 ? 's' : ''}
                                            </span>
                                            {/* ✅ Show credit balance for non-members too */}
                                            {credits >= creditCost ? (
                                                <span className="text-[10px] text-green-100 mt-1 flex items-center gap-1">
                                                    <Sparkles size={10} />
                                                    You have {credits} credit{credits !== 1 ? 's' : ''}
                                                </span>
                                            ) : credits > 0 ? (
                                                <span className="text-[10px] text-orange-100 mt-1 flex items-center gap-1">
                                                    <ShoppingBag size={10} />
                                                    Need {creditCost - credits} more
                                                </span>
                                            ) : includedPlanNames.length > 0 ? (
                                                <span className="text-[10px] text-blue-100 mt-1 flex items-center gap-1">
                                                    <Sparkles size={10} />
                                                    Free with {includedPlanNames[0]}
                                                </span>
                                            ) : null}
                                        </>
                                    ) : (
                                        <span className="text-lg font-bold">Free</span>
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
                
                {/* DYNAMIC ACTION BUTTON */}
                <button
                    onClick={handleAction}
                    className="bg-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 hover:bg-blue-50 transition-colors shadow-sm"
                    style={{ color: theme.primaryColor }}
                >
                    {isBooked ? (
                        <>View Schedule <ArrowRight size={14} /></>
                    ) : isCreditOnly && hasActiveMembership ? (
                        // ✅ CREDIT-ONLY CLASS + HAS MEMBERSHIP
                        credits >= creditCost ? (
                            <>Book <ArrowRight size={14} /></>
                        ) : (
                            <>Get Credits <ShoppingBag size={14} /></>
                        )
                    ) : hasActiveMembership ? (
                        <>Book <ArrowRight size={14} /></>
                    ) : (
                        // ✅ NO MEMBERSHIP - Check credits first
                        nextClass.dropInEnabled && credits >= creditCost ? (
                            <>Book <ArrowRight size={14} /></>
                        ) : nextClass.dropInEnabled ? (
                            <>Get Credits <ShoppingBag size={14} /></>
                        ) : (
                            <>View Plans <ArrowRight size={14} /></>
                        )
                    )}
                </button>
            </div>
        </div>
    </div>
  );
};

export default NextClassCard;