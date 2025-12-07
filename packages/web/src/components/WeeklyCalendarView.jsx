import React from 'react';
import { Clock, User } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 6; // 6 AM
const END_HOUR = 22;  // 10 PM
const HOUR_HEIGHT = 60; // Pixels per hour

export const WeeklyCalendarView = ({ classes, staffList, onEditClass }) => {
  
  // Helper: Convert "09:30" to minutes from start of day (6 AM)
  const getTopOffset = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const minutesFromStart = (h - START_HOUR) * 60 + m;
    return (minutesFromStart / 60) * HOUR_HEIGHT;
  };

  // Helper: Calculate height based on duration
  const getHeight = (duration) => {
    return (duration / 60) * HOUR_HEIGHT;
  };

  // Helper: Get staff name
  const getInstructorName = (id) => {
    const staff = staffList.find(s => s.id === id);
    return staff ? staff.name.split(' ')[0] : '?';
  };

  // Generate unique colors based on class name string
  const stringToColor = (str) => {
    const colors = [
      'bg-blue-100 border-blue-200 text-blue-700',
      'bg-indigo-100 border-indigo-200 text-indigo-700',
      'bg-green-100 border-green-200 text-green-700',
      'bg-amber-100 border-amber-200 text-amber-700',
      'bg-rose-100 border-rose-200 text-rose-700',
      'bg-purple-100 border-purple-200 text-purple-700',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header Row (Days) */}
      <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
        <div className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center border-r border-gray-200">
          Time
        </div>
        {DAYS.map(day => (
          <div key={day} className="p-4 text-sm font-bold text-gray-700 text-center border-r border-gray-200 last:border-r-0">
            {day.slice(0, 3)}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto relative" style={{ height: '600px' }}>
        <div className="grid grid-cols-8 relative h-full">
          
          {/* Time Labels Column */}
          <div className="border-r border-gray-100 bg-white z-10 relative">
            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
              <div 
                key={i} 
                className="text-xs text-gray-400 text-right pr-2 pt-1 border-b border-gray-50"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {i + START_HOUR}:00
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {DAYS.map(day => (
            <div key={day} className="border-r border-gray-100 relative bg-white last:border-r-0 group">
              {/* Background Grid Lines */}
              {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                <div key={i} className="border-b border-gray-50 w-full" style={{ height: `${HOUR_HEIGHT}px` }}></div>
              ))}

              {/* Render Classes for this Day */}
              {classes
                .filter(c => c.days.includes(day))
                .map(cls => (
                  <button
                    key={`${cls.id}-${day}`}
                    onClick={() => onEditClass(cls)}
                    className={`absolute inset-x-1 rounded-md border p-1.5 text-left text-xs hover:brightness-95 hover:z-20 transition-all shadow-sm flex flex-col gap-1 overflow-hidden cursor-pointer ${stringToColor(cls.name)}`}
                    style={{
                      top: `${getTopOffset(cls.time)}px`,
                      height: `${getHeight(cls.duration)}px`,
                    }}
                  >
                    <div className="font-bold leading-tight truncate">{cls.name}</div>
                    <div className="flex items-center gap-1 opacity-90 text-[10px]">
                        <Clock size={10} /> {cls.time}
                    </div>
                    {cls.instructorId && (
                        <div className="flex items-center gap-1 opacity-90 text-[10px]">
                            <User size={10} /> {getInstructorName(cls.instructorId)}
                        </div>
                    )}
                  </button>
                ))
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};