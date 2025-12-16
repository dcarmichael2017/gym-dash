import React, { useState } from 'react';
import { Clock, User, Plus, Ban, Users, AlertTriangle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;

export const WeeklyCalendarView = ({ classes, staffList, onEditClass, onCancelSession, onCreateSession }) => {
  const [hoveredSlot, setHoveredSlot] = useState(null);

  // --- HELPERS ---

  // Convert "09:30" to minutes from start of day
  const getMinutesFromStart = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h - START_HOUR) * 60 + m;
  };

  const getTopOffset = (timeStr) => {
    const mins = getMinutesFromStart(timeStr);
    return (mins / 60) * HOUR_HEIGHT;
  };

  const getHeight = (duration) => (duration / 60) * HOUR_HEIGHT;

  const getInstructorName = (id) => {
    const staff = staffList.find(s => s.id === id);
    return staff ? staff.name.split(' ')[0] : '';
  };

  const stringToColor = (str) => {
    const colors = [
      'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
      'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
      'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
      'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
      'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
      'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // --- HANDLERS ---

  const handleGridClick = (day, hour, e) => {
    // Prevent triggering when clicking an existing class
    if (e.target !== e.currentTarget) return;
    
    // Construct default time string "09:00"
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    onCreateSession({ day, time: timeStr });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
      
      {/* Header Row */}
      <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50 shrink-0 z-20">
        <div className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center border-r border-gray-200">
          Time
        </div>
        {DAYS.map(day => (
          <div key={day} className="p-3 text-sm font-bold text-gray-700 text-center border-r border-gray-200 last:border-r-0">
            {day.slice(0, 3)}
          </div>
        ))}
      </div>

      {/* Scrollable Grid */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="grid grid-cols-8 relative min-h-[960px]">
          
          {/* Time Labels */}
          <div className="border-r border-gray-100 bg-white z-10 sticky left-0">
            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
              <div 
                key={i} 
                className="text-xs text-gray-400 text-right pr-2 pt-1 border-b border-gray-50 relative"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="-translate-y-1/2 block">{i + START_HOUR}:00</span>
              </div>
            ))}
          </div>

          {/* Days Columns */}
          {DAYS.map(day => (
            <div key={day} className="border-r border-gray-100 relative bg-white last:border-r-0 group">
              
              {/* Hourly Grid Slots (Clickable) */}
              {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => {
                const hour = i + START_HOUR;
                return (
                  <div 
                    key={hour} 
                    onClick={(e) => handleGridClick(day, hour, e)}
                    onMouseEnter={() => setHoveredSlot({ day, hour })}
                    onMouseLeave={() => setHoveredSlot(null)}
                    className="border-b border-gray-50 w-full relative cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  >
                    {/* Add Button on Hover */}
                    {hoveredSlot?.day === day && hoveredSlot?.hour === hour && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Plus className="text-gray-300 opacity-50" size={20} />
                        </div>
                    )}
                  </div>
                );
              })}

              {/* Render Classes */}
              {classes
                .filter(c => c.days.includes(day))
                .map(cls => {
                    // Logic for display state
                    // Note: You need to implement getRealDateForDay(day) in parent to accurately check cancelledDates
                    // For now, we assume cancelledDates stores "YYYY-MM-DD"
                    const isCancelled = false; // logic moved to parent/modal mostly, but if we have date context here we can check cls.cancelledDates.includes(todayStr)
                    const registeredCount = 0; // Placeholder until you pass roster data down
                    const isFull = cls.maxCapacity && registeredCount >= cls.maxCapacity;

                    return (
                      <div
                        key={`${cls.id}-${day}`}
                        className={`absolute inset-x-1 rounded-md border p-1.5 text-left text-xs transition-all shadow-sm flex flex-col gap-0.5 overflow-hidden group/card cursor-pointer 
                            ${stringToColor(cls.name)}
                            ${isCancelled ? 'opacity-50 grayscale line-through' : ''}
                            ${isFull ? 'border-red-400 ring-1 ring-red-400' : ''}
                        `}
                        style={{
                          top: `${getTopOffset(cls.time)}px`,
                          height: `${getHeight(cls.duration)}px`,
                          zIndex: 10
                        }}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            // Pass session info up to parent to open Details Modal
                            onEditClass({
                                classId: cls.id,
                                className: cls.name,
                                time: cls.time,
                                duration: cls.duration,
                                instructorName: getInstructorName(cls.instructorId),
                                maxCapacity: cls.maxCapacity,
                                // Mock date calculation needed here for the specific instance
                                dateStr: new Date().toISOString().split('T')[0], 
                                isCancelled: isCancelled
                            }); 
                        }}
                      >
                        {/* Hover Actions */}
                        {!isCancelled && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 flex gap-1 bg-white/80 rounded p-0.5 backdrop-blur-sm transition-opacity">
                                <button 
                                    title="Cancel this session"
                                    onClick={(e) => { e.stopPropagation(); onCancelSession(cls.id, "2023-10-27", [], false); }} // Mock date
                                    className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-500"
                                >
                                    <Ban size={12} />
                                </button>
                            </div>
                        )}

                        <div className="font-bold leading-tight truncate pr-4">{cls.name}</div>
                        
                        <div className="flex items-center gap-1 opacity-80 text-[10px]">
                          <Clock size={10} /> {cls.time} - {parseInt(cls.time.split(':')[0]) + Math.floor((parseInt(cls.time.split(':')[1]) + cls.duration)/60)}:{(parseInt(cls.time.split(':')[1]) + cls.duration)%60 || '00'}
                        </div>
                        
                        <div className="flex justify-between items-end mt-auto">
                            {cls.instructorId ? (
                                <div className="flex items-center gap-1 opacity-80 text-[10px]">
                                    <User size={10} /> {getInstructorName(cls.instructorId)}
                                </div>
                            ) : <span></span>}

                            {/* Capacity Badge */}
                            <div className={`flex items-center gap-1 text-[9px] font-bold px-1 rounded ${isFull ? 'bg-red-100 text-red-700' : 'opacity-60'}`}>
                                {isFull && <AlertTriangle size={8} />}
                                <Users size={8} /> {registeredCount}/{cls.maxCapacity || '∞'}
                            </div>
                        </div>
                      </div>
                    );
                })
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};