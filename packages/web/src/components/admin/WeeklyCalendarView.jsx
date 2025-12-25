import React, { useState } from 'react';
import { Clock, User, Plus, Ban, Users, AlertTriangle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;

export const WeeklyCalendarView = ({
  classes,
  staffList,
  currentWeekStart,
  slideDirection = 'next',
  bookingCounts = {},
  onEditClass,
  onCancelSession,
  onCreateSession
}) => {
  const [hoveredSlot, setHoveredSlot] = useState(null);

  // --- HELPERS ---
  const getDateForColumn = (dayIndex) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    
    // FIX: Construct string manually using Local Time methods
    // to avoid toISOString() converting to UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

  const getDisplayDate = (dayIndex) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + dayIndex);
    return date.getDate();
  };

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

  // --- HANDLER: CREATE NEW CLASS ---
  const handleGridClick = (day, hour, e) => {
    // Stop propagation just in case, though usually not needed here
    // e.stopPropagation(); 
    
    // Default to "00" minutes when clicking a slot
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    
    // Trigger the CREATE modal
    onCreateSession({ day, time: timeStr });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[700px]">

      {/* Header Row */}
      <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50 shrink-0 z-20">
        <div className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center border-r border-gray-200">
          Time
        </div>
        {DAYS.map((day, index) => (
          <div key={day} className="p-3 text-center border-r border-gray-200 last:border-r-0">
            <div className="text-sm font-bold text-gray-700">{day.slice(0, 3)}</div>
            <div className="text-xs text-gray-400 font-medium">{getDisplayDate(index)}</div>
          </div>
        ))}
      </div>

      {/* Scroll Frame */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-white">

        {/* Animation Wrapper */}
        <div
          key={currentWeekStart.toISOString()}
          className={`min-h-[960px] grid grid-cols-8 relative ${slideDirection === 'next'
              ? 'animate-slide-right'
              : 'animate-slide-left'
            }`}
        >

          {/* Time Labels Sidebar */}
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
          {DAYS.map((day, dayIndex) => {
            const currentDayDateStr = getDateForColumn(dayIndex);

            return (
              <div key={day} className="border-r border-gray-100 relative bg-white last:border-r-0 group">

                {/* Hourly Grid Slots (The Clickable Background) */}
                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => {
                  const hour = i + START_HOUR;
                  return (
                    <div
                      key={hour}
                      // CLICK HERE -> OPENS "ADD CLASS"
                      onClick={(e) => handleGridClick(day, hour, e)}
                      onMouseEnter={() => setHoveredSlot({ day, hour })}
                      onMouseLeave={() => setHoveredSlot(null)}
                      className="border-b border-gray-50 w-full relative cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      {hoveredSlot?.day === day && hoveredSlot?.hour === hour && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Plus className="text-gray-300 opacity-50" size={20} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Render Classes (The Floating Cards) */}
                {classes
                  .filter(c => {
                      // 1. Handle One-Off Events
                      if (c.frequency === 'Single Event') {
                          return c.startDate === currentDayDateStr;
                      }
                      // 2. Handle Recurring Classes
                      return c.days.includes(day);
                    })
                  .map(cls => {
                    const isCancelled = cls.cancelledDates?.includes(currentDayDateStr);
                    const lookupKey = `${cls.id}_${currentDayDateStr}`;
                    const registeredCount = bookingCounts[lookupKey] || 0;
                    const isFull = cls.maxCapacity && registeredCount >= cls.maxCapacity;

                    return (
                      <div
                        key={`${cls.id}-${day}`}
                        className={`absolute inset-x-1 rounded-md border p-1.5 text-left text-xs transition-all shadow-sm flex flex-col gap-0.5 overflow-hidden group/card cursor-pointer 
                                ${stringToColor(cls.name)}
                                ${isCancelled ? 'opacity-50 grayscale line-through' : ''}
                                ${isFull && !isCancelled ? 'border-red-400 ring-1 ring-red-400' : ''}
                            `}
                        style={{
                          top: `${getTopOffset(cls.time)}px`,
                          height: `${getHeight(cls.duration)}px`,
                          zIndex: 10 // Ensures card is above grid slots
                        }}
                        // CLICK HERE -> OPENS "SESSION DETAILS"
                        onClick={(e) => {
                          e.stopPropagation(); // STOP grid click from firing
                          onEditClass({
                            classId: cls.id,
                            className: cls.name,
                            time: cls.time,
                            duration: cls.duration,
                            instructorName: getInstructorName(cls.instructorId),
                            maxCapacity: cls.maxCapacity,
                            dateStr: currentDayDateStr,
                            isCancelled: isCancelled
                          });
                        }}
                      >
                        {/* Actions & Content */}
                        {!isCancelled && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 flex gap-1 bg-white/80 rounded p-0.5 backdrop-blur-sm transition-opacity">
                            <button
                              title="Cancel this session"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancelSession(cls.id, currentDayDateStr, [], false);
                              }}
                              className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-500"
                            >
                              <Ban size={12} />
                            </button>
                          </div>
                        )}

                        <div className="font-bold leading-tight truncate pr-4">{cls.name}</div>

                        <div className="flex items-center gap-1 opacity-80 text-[10px]">
                          <Clock size={10} /> {cls.time}
                        </div>

                        <div className="flex justify-between items-end mt-auto">
                          {cls.instructorId ? (
                            <div className="flex items-center gap-1 opacity-80 text-[10px]">
                              <User size={10} /> {getInstructorName(cls.instructorId)}
                            </div>
                          ) : <span></span>}

                          {!isCancelled && (
                            <div className={`flex items-center gap-1 text-[9px] font-bold px-1 rounded ${isFull ? 'bg-red-100 text-red-700' : 'opacity-60'}`}>
                              {isFull && <AlertTriangle size={8} />}
                              <Users size={8} /> {registeredCount}/{cls.maxCapacity || '∞'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};