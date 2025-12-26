import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Clock, CheckCircle, AlertCircle, Hourglass, CheckSquare } from 'lucide-react'; 

// --- CONFIGURATION ---
const START_HOUR = 6;  // 6 AM
const END_HOUR = 22;   // 10 PM
const HOUR_HEIGHT = 64; // Pixel height per hour slot

const MemberCalendarView = ({ 
  classes, 
  weekStart, 
  theme = { primaryColor: '#2563eb', secondaryColor: '#1e40af' }, 
  onBook,
  counts = {},      // Map of { "classId_date": 5 }
  userBookings = {}, // Map of { "classId_date": { status: 'booked', id: '...' } }
  slideDirection = 'next' 
}) => {
  const containerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update "Current Time" bar every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // --- 1. DYNAMIC DAY GENERATION (FIXED TIMEZONE ISSUE) ---
  const calendarDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      // Create a clean date object starting from the provided weekStart
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      
      // FIX: Manually construct YYYY-MM-DD string using LOCAL time values
      // This prevents "2023-12-26" becoming "2023-12-25" due to UTC conversion
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const localDateString = `${year}-${month}-${day}`;

      return {
        dateObj: date,
        dayNum: date.getDate(),
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }), 
        dateString: localDateString // Use this manual string for reliable matching
      };
    });
  }, [weekStart]);

  // --- HELPERS ---

  const isToday = (dateObj) => {
    const now = new Date();
    return dateObj.getDate() === now.getDate() &&
           dateObj.getMonth() === now.getMonth() &&
           dateObj.getFullYear() === now.getFullYear();
  };

  const getTopOffset = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const mins = (h - START_HOUR) * 60 + m;
    return (mins / 60) * HOUR_HEIGHT;
  };

  const getCurrentTimeOffset = () => {
    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    if (h < START_HOUR || h > END_HOUR) return null;
    const mins = (h - START_HOUR) * 60 + m;
    return (mins / 60) * HOUR_HEIGHT;
  };

  const currentOffset = getCurrentTimeOffset();

  // --- ANIMATION STYLES ---
  const animationStyles = `
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .animate-next { animation: slideInRight 0.3s ease-out forwards; }
    .animate-prev { animation: slideInLeft 0.3s ease-out forwards; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[75vh] relative">
      <style>{animationStyles}</style>

      {/* 1. Header Row */}
      <div className="grid grid-cols-8 border-b border-gray-100 bg-gray-50/50 backdrop-blur-sm shrink-0 z-20">
        <div className="p-3 text-xs font-bold text-gray-400 text-center border-r border-gray-100 flex items-center justify-center">
          TIME
        </div>
        
        {calendarDays.map((day) => {
          const activeToday = isToday(day.dateObj);

          return (
            <div 
              key={day.dateString} 
              className={`py-3 text-center border-r border-gray-100 last:border-r-0 flex flex-col items-center justify-center transition-colors
                ${activeToday ? 'bg-blue-50/50' : ''}
              `}
              style={activeToday ? { backgroundColor: `${theme.primaryColor}10` } : {}}
            >
               <div className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                 {day.dayName.slice(0, 3)}
               </div>
               <div 
                 className={`text-sm md:text-base font-bold h-8 w-8 flex items-center justify-center rounded-full
                   ${activeToday ? 'text-white shadow-sm' : 'text-gray-800'}
                 `}
                 style={activeToday ? { backgroundColor: theme.primaryColor } : {}}
               >
                 {day.dayNum}
               </div>
            </div>
          );
        })}
      </div>

      {/* 2. Scrollable Grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto relative no-scrollbar bg-white">
        
        <div 
            key={weekStart.toISOString()} 
            className={`grid grid-cols-8 relative min-h-[900px] ${slideDirection === 'next' ? 'animate-next' : 'animate-prev'}`}
        >
          
          {/* Time Sidebar */}
          <div className="border-r border-gray-100 bg-white z-10 sticky left-0 text-xs font-medium text-gray-400 select-none">
             {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
               <div key={i} className="border-b border-gray-50 text-right pr-2 relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                 <span className="absolute -top-2 right-2 bg-white px-1">
                    {i + START_HOUR > 12 ? i + START_HOUR - 12 : i + START_HOUR} 
                    <span className="text-[9px] ml-0.5">{i + START_HOUR >= 12 ? 'PM' : 'AM'}</span>
                 </span>
               </div>
             ))}
          </div>

          {/* Days Columns */}
          {calendarDays.map((day) => {
             const activeToday = isToday(day.dateObj);
             
             // Filter classes
             const daysClasses = classes.filter(c => {
                // For recurring: Name of day (e.g. 'Monday') must match
                const isScheduledDay = c.days && c.days.some(d => d.toLowerCase() === day.dayName.toLowerCase());
                
                // For cancellation: This specific date string must NOT be in the blacklist
                const isNotCancelled = !c.cancelledDates || !c.cancelledDates.includes(day.dateString);
                
                // For Single Events: The startDate string must match exactly the column date string
                const isOneOffMatch = c.frequency === 'Single Event' && c.startDate === day.dateString;
                
                // Combine: (Recurring AND Not Cancelled) OR (Single Event Match)
                // Note: Single Events should ignore 'isNotCancelled' logic or have it built-in, usually they just match or don't.
                return (isScheduledDay && isNotCancelled && c.frequency !== 'Single Event') || isOneOffMatch;
             });

             return (
               <div 
                 key={day.dateString} 
                 className="border-r border-gray-100 relative last:border-r-0 group"
                 style={activeToday ? { backgroundColor: `${theme.primaryColor}05` } : {}}
               >
                  {/* Background Grid Lines */}
                  {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                     <div key={i} className="border-b border-gray-50 w-full" style={{ height: `${HOUR_HEIGHT}px` }} />
                  ))}

                  {/* "Current Time" Indicator */}
                  {activeToday && currentOffset && (
                    <div 
                      className="absolute w-full z-20 pointer-events-none flex items-center"
                      style={{ top: `${currentOffset}px` }}
                    >
                      <div className="h-2 w-2 rounded-full bg-red-500 -ml-1"></div>
                      <div className="h-[2px] bg-red-500 w-full opacity-80 shadow-[0_0_4px_rgba(239,68,68,0.6)]"></div>
                    </div>
                  )}

                  {/* Class Cards */}
                  {daysClasses.map(cls => {
                     // --- STATE LOGIC ---
                     const instanceId = `${cls.id}_${day.dateString}`;
                     const userState = userBookings[instanceId]?.status; // 'booked' | 'waitlisted' | 'attended'
                     const currentCount = counts[instanceId] || 0;
                     const isFull = cls.maxCapacity && currentCount >= parseInt(cls.maxCapacity);

                     // --- DYNAMIC STYLES ---
                     let bgStyle = { 
                        backgroundColor: `${theme.primaryColor}10`, 
                        borderLeft: `3px solid ${theme.primaryColor}`,
                        color: theme.primaryColor
                     };
                     
                     // Priority: Attended > Booked > Waitlisted > Full > Standard
                     if (userState === 'attended') {
                         bgStyle = { backgroundColor: '#f3f4f6', borderLeft: '3px solid #6b7280', color: '#374151' }; // Grey/Neutral for completed
                     } else if (userState === 'booked') {
                        bgStyle = { backgroundColor: '#dcfce7', borderLeft: '3px solid #16a34a', color: '#15803d' };
                     } else if (userState === 'waitlisted') {
                        bgStyle = { backgroundColor: '#ffedd5', borderLeft: '3px solid #f97316', color: '#c2410c' };
                     } else if (isFull) {
                        bgStyle = { backgroundColor: '#fee2e2', borderLeft: '3px solid #ef4444', color: '#b91c1c' };
                     }

                     return (
                       <button
                          key={instanceId}
                          onClick={() => onBook({ ...cls, dateString: day.dateString })}
                          className="absolute inset-x-1 rounded-md text-left p-1.5 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 z-10 flex flex-col justify-between group/card"
                          style={{
                             top: `${getTopOffset(cls.time)}px`,
                             height: `${(cls.duration / 60) * HOUR_HEIGHT - 2}px`,
                             ...bgStyle
                          }}
                       >
                          <div>
                              <div className="font-bold text-[10px] md:text-xs leading-tight truncate">
                                  {cls.name}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 opacity-80">
                                  {userState === 'attended' && <CheckSquare size={10} />}
                                  {userState === 'booked' && <CheckCircle size={10} />}
                                  {userState === 'waitlisted' && <Hourglass size={10} />}
                                  {isFull && !userState && <AlertCircle size={10} />}
                                  
                                  {/* Only show time if we aren't showing a status icon, or if there is room */}
                                  {(!userState && !isFull) && <span className="text-[9px] font-semibold">{cls.time}</span>}
                              </div>
                          </div>
                          
                          {(cls.duration / 60) * HOUR_HEIGHT > 50 && (
                            <div className="text-[9px] opacity-60 truncate">
                                {userState === 'attended' ? 'Attended' : userState === 'booked' ? 'Confirmed' : isFull ? 'Full' : `${cls.duration} min`}
                            </div>
                          )}
                       </button>
                    );
                  })}
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
};

export default MemberCalendarView;