import React from 'react';
import { Bell, CalendarDays, HeartPulse, ShoppingCart, UserCircle, User, Clock, Flame, Leaf, Star } from 'lucide-react';

export const MobileSchedulePreview = ({ gymName, logoUrl, themeColor, classList }) => {
  const primaryColor = themeColor || '#3b82f6';

  const themeStyles = {
    backgroundColor: primaryColor,
  };
  const themeTextStyles = {
    color: primaryColor,
  };

  return (
    <div className="w-[375px] h-[750px] bg-gray-800 rounded-4xl shadow-2xl p-4 mx-auto shrink-0">
      <div className="w-full h-full bg-slate-50 rounded-3xl overflow-hidden flex flex-col relative">
        
        <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-lg shrink-0">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    {logoUrl ? (
                         <img src={logoUrl} alt={`${gymName} Logo`} className="w-12 h-12 rounded-full border-2 border-slate-500 object-cover bg-white"/>
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold border-2 border-slate-500">
                           {gymName ? gymName.charAt(0).toUpperCase() : 'G'}
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-medium text-slate-400">Welcome to</p>
                        <h1 className="text-xl font-bold">{gymName || 'Your Gym Name'}</h1>
                    </div>
                </div>
                <div className="p-2 rounded-full">
                    <Bell size={20} />
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">Schedule</h2>
                <div className="flex space-x-3">
                    <div className="text-center shrink-0">
                        <div className="w-16 h-20 flex flex-col justify-center items-center text-white rounded-xl shadow-md" style={themeStyles}>
                            <p className="text-sm">Mon</p>
                            <p className="text-2xl font-bold">6</p>
                        </div>
                    </div>
                    <div className="text-center shrink-0">
                        <div className="w-16 h-20 flex flex-col justify-center items-center bg-white border border-slate-200 text-slate-700 rounded-xl">
                            <p className="text-sm">Tue</p>
                            <p className="text-2xl font-bold">7</p>
                        </div>
                    </div>
                    <div className="text-center shrink-0">
                        <div className="w-16 h-20 flex flex-col justify-center items-center bg-white border border-slate-200 text-slate-700 rounded-xl">
                            <p className="text-sm">Wed</p>
                            <p className="text-2xl font-bold">8</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
                 {(classList && classList.length > 0) ? classList.map((cls, index) => (
                    <div key={cls.id || index} className="bg-white p-4 rounded-xl shadow-md border border-slate-100 flex gap-4">
                        <div className="text-center border-r pr-4">
                            <p className="text-xl font-extrabold text-slate-800">{cls.time.split(':')[0]}</p>
                            <p className="text-xs text-slate-500">{cls.time.split(':')[1]}</p>
                        </div>
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-semibold bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full">
                                        {cls.name.split(' ')[0]}
                                    </span>
                                    <h4 className="font-bold text-slate-900 mt-1">{cls.name}</h4>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-sm border-2 border-white shadow-sm">
                                    {cls.instructorName.split(' ').map(n => n[0]).join('')}
                                </div>
                            </div>
                            <div className="flex items-center text-xs text-slate-500 gap-4 mt-2">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" />{cls.instructorName}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{cls.duration} min</span>
                                <span className="flex items-center gap-1">
                                    {index % 2 === 0 ? <Flame className="w-3 h-3 text-red-500"/> : <Leaf className="w-3 h-3 text-green-500"/>}
                                    {index % 2 === 0 ? 'Advanced' : 'Beginner'}
                                </span>
                            </div>
                            {/* FIX: Added pointer-events-none to make the button non-clickable */}
                            <button className="w-full mt-4 text-white font-bold py-2 rounded-lg text-sm transition-transform pointer-events-none" style={themeStyles}>
                                Book Spot
                            </button>
                        </div>
                    </div>
                 )) : (
                     <div className="text-center py-10 bg-slate-100 rounded-lg">
                        <p className="text-slate-500">Your created classes will appear here.</p>
                     </div>
                 )}

                <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-xl my-8">
                     <div className="flex items-center gap-3 mb-2">
                        <Star className="text-yellow-400" />
                        <h3 className="text-lg font-bold">Special Events</h3>
                     </div>
                     <p className="text-sm text-slate-300 mb-4">Highlighted workshops and special events you create will appear here.</p>
                     {/* FIX: Added pointer-events-none to make the button non-clickable */}
                     <button className="w-full bg-white/20 hover:bg-white/30 font-bold py-2 rounded-lg text-sm pointer-events-none">Learn More</button>
                </div>
            </div>
        </main>

        {/* FIX: Changed <a> tags to <div> tags and added cursor-default to prevent navigation */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-slate-200 px-4 py-2 flex justify-around shrink-0 cursor-default">
            <div className="flex flex-col items-center gap-1" style={themeTextStyles}>
                <CalendarDays />
                <span className="text-xs font-bold">Schedule</span>
            </div>
             <div className="flex flex-col items-center gap-1 text-slate-500">
                <HeartPulse />
                <span className="text-xs">My Bookings</span>
            </div>
             <div className="flex flex-col items-center gap-1 text-slate-500">
                <ShoppingCart />
                <span className="text-xs">Shop</span>
            </div>
             <div className="flex flex-col items-center gap-1 text-slate-500">
                <UserCircle />
                <span className="text-xs">Profile</span>
            </div>
        </nav>

      </div>
    </div>
  );
};
