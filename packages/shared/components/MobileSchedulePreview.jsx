// packages/shared/components/MobileSchedulePreview.jsx

import React, { useState, useMemo } from 'react';
import { Bell, CalendarDays, HeartPulse, ShoppingCart, UserCircle, User, Clock, Flame, Leaf, Star } from 'lucide-react';

export const MobileSchedulePreview = ({ gymName, logoUrl, primaryColor, secondaryColor, classList }) => {
  const pColor = primaryColor || '#3b82f6';
  const sColor = secondaryColor || '#ec4899';

  // --- NEW: Generate the next 5 days dynamically ---
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
        const nextDay = new Date(today);
        nextDay.setDate(today.getDate() + i);
        days.push({
            label: nextDay.toLocaleDateString('en-US', { weekday: 'short' }), // "Mon"
            fullName: nextDay.toLocaleDateString('en-US', { weekday: 'long' }), // "Monday"
            date: nextDay.getDate(), // 12
        });
    }
    return days;
  }, []);

  // State to track which day is clicked (Default to today)
  const [selectedDay, setSelectedDay] = useState(calendarDays[0].fullName);

  // Filter classes for the selected day
  const filteredClasses = (classList || []).filter(cls => 
    cls.days && cls.days.includes(selectedDay)
  );
  // ------------------------------------------------

  const primaryThemeStyles = { backgroundColor: pColor };
  const primaryThemeTextStyles = { color: pColor };
  const secondaryThemeStyles = { backgroundColor: sColor, color: '#ffffff' };

  return (
    <div className="w-[375px] h-[750px] bg-gray-800 rounded-3xl shadow-2xl p-4 mx-auto shrink-0 border-4 border-gray-900">
      <div className="w-full h-full bg-slate-50 rounded-2xl overflow-hidden flex flex-col relative text-left">
        
        {/* Header */}
        <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-lg shrink-0">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    {logoUrl ? (
                         <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-full border-2 border-slate-500 object-contain bg-white"/>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold border-2 border-slate-500">
                           {gymName ? gymName.charAt(0).toUpperCase() : 'G'}
                        </div>
                    )}
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Welcome to</p>
                        <h1 className="text-lg font-bold leading-tight">{gymName || 'Your Gym'}</h1>
                    </div>
                </div>
                <div className="p-2 rounded-full bg-white/10">
                    <Bell size={18} />
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 scrollbar-hide">
            {/* Calendar Strip */}
            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">Schedule</h2>
                <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
                    {calendarDays.map((day) => {
                        const isSelected = selectedDay === day.fullName;
                        return (
                            <button 
                                key={day.fullName} 
                                onClick={() => setSelectedDay(day.fullName)}
                                className="text-center shrink-0 focus:outline-none transition-all duration-200"
                            >
                                <div 
                                    className={`w-14 h-18 py-2 flex flex-col justify-center items-center rounded-xl border ${
                                        isSelected 
                                        ? 'text-white shadow-md transform scale-105' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                                    style={isSelected ? primaryThemeStyles : {}}
                                >
                                    <p className="text-xs opacity-90">{day.label}</p>
                                    <p className="text-xl font-bold">{day.date}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* Class List */}
            <div className="space-y-4 pb-20">
                 {filteredClasses.length > 0 ? filteredClasses
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((cls, index) => {
                    
                    // --- BUG FIX: Safety Check for Time ---
                    const timeString = cls.time || "00:00";
                    const [hours, minutes] = timeString.split(':');
                    // --------------------------------------

                    return (
                    <div key={cls.id || index} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4">
                        <div className="text-center border-r border-slate-100 pr-4 flex flex-col justify-center min-w-[60px]">
                            <p className="text-xl font-extrabold text-slate-800">{hours}</p>
                            <p className="text-xs text-slate-500 font-medium">{minutes}</p>
                        </div>
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span style={secondaryThemeStyles} className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {cls.name.split(' ')[0] || 'Class'}
                                    </span>
                                    <h4 className="font-bold text-slate-900 mt-1 text-base">{cls.name}</h4>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs border border-slate-200">
                                    {(cls.instructorName || 'S')[0]}
                                </div>
                            </div>
                            
                            <div className="flex items-center text-xs text-slate-500 gap-3 mt-3">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" />{cls.instructorName || 'Staff'}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{cls.duration}m</span>
                            </div>
                            
                            <button className="w-full mt-3 text-white font-bold py-2 rounded-lg text-sm shadow-sm" style={primaryThemeStyles}>
                                Book Class
                            </button>
                        </div>
                    </div>
                 )}) : (
                     <div className="text-center py-10 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm">No classes on {selectedDay}.</p>
                     </div>
                 )}

                {/* Promo Banner */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-lg mt-6 relative overflow-hidden">
                     <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 text-yellow-400">
                            <Star size={16} fill="currentColor" />
                            <h3 className="text-sm font-bold uppercase tracking-widest">Featured</h3>
                        </div>
                        <p className="text-sm text-slate-300 mb-3 leading-relaxed">Join our upcoming workshops and special events.</p>
                        <div className="h-2 w-20 bg-white/20 rounded-full"></div>
                     </div>
                     <Star className="absolute -bottom-4 -right-4 text-white/5 w-24 h-24" />
                </div>
            </div>
        </main>

        {/* Fake Bottom Nav */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 px-6 py-3 flex justify-between items-end shrink-0 cursor-default z-20">
            <div className="flex flex-col items-center gap-1" style={primaryThemeTextStyles}>
                <CalendarDays size={24} />
                <span className="text-[10px] font-bold">Schedule</span>
            </div>
             <div className="flex flex-col items-center gap-1 text-slate-400">
                <HeartPulse size={24} />
                <span className="text-[10px]">Activity</span>
            </div>
             <div className="flex flex-col items-center gap-1 text-slate-400">
                <ShoppingCart size={24} />
                <span className="text-[10px]">Shop</span>
            </div>
             <div className="flex flex-col items-center gap-1 text-slate-400">
                <UserCircle size={24} />
                <span className="text-[10px]">Profile</span>
            </div>
        </nav>

      </div>
    </div>
  );
};