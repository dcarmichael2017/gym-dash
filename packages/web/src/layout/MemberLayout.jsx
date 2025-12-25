import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Calendar, User, QrCode } from 'lucide-react';

const MemberLayout = () => {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* MAIN CONTENT AREA 
        - "flex-1" makes it take all available height above the nav bar
        - "overflow-y-auto" allows scrolling content while keeping nav fixed
      */}
      <div className="flex-1 overflow-y-auto pb-20 safe-top no-scrollbar">
        <Outlet />
      </div>

      {/* MOBILE BOTTOM NAV 
        - Fixed to bottom
        - High z-index to stay on top
      */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 pb-6 safe-bottom flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        
        <NavItem to="/members/home" icon={<Home size={24} />} label="Home" />
        <NavItem to="/members/schedule" icon={<Calendar size={24} />} label="Book" />
        
        {/* Floating Action Button (Check-In) - Lifted up with negative margin */}
        <div className="-mt-10">
            <button className="bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition-transform active:scale-95 border-4 border-gray-50 flex items-center justify-center">
                <QrCode size={28} />
            </button>
        </div>

        {/* Spacer for the center button */}
        <div className="w-12"></div> 

        <NavItem to="/members/profile" icon={<User size={24} />} label="Profile" />
      </div>
    </div>
  );
};

// Helper Component for Nav Items
const NavItem = ({ to, icon, label }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => 
      `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
        isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
      }`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

export default MemberLayout;