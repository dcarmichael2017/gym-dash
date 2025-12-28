import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, User, QrCode, LogOut, Dumbbell, Link as LinkIcon, ShoppingBag } from 'lucide-react';
import { auth } from '../../../../packages/shared/api/firebaseConfig';
import { useGym } from '../context/GymContext';

const MemberLayout = () => {
  const { currentGym, memberships } = useGym();
  const navigate = useNavigate();

  const hasGyms = memberships && memberships.length > 0;

  // --- THEME & LAYOUT LOGIC ---
  const theme = currentGym?.theme || { 
      primaryColor: '#2563eb', 
      secondaryColor: '#4f46e5',
      layout: 'classic'
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  // --- CALCULATE STYLES BASED ON LAYOUT ---
  const getStyles = () => {
      const isBoldSidebar = theme.layout === 'sidebar';
      const isBrandHeader = theme.layout === 'header';

      return {
          sidebarContainer: {
              backgroundColor: isBoldSidebar ? theme.primaryColor : '#ffffff',
              borderColor: isBoldSidebar ? 'transparent' : '#e5e7eb', // gray-200
              color: isBoldSidebar ? '#ffffff' : '#1f2937' // gray-900
          },
          
          // HEADER AREA (Logo Section)
          sidebarHeader: {
              backgroundColor: isBrandHeader ? theme.primaryColor : 'transparent',
              borderColor: (isBoldSidebar || isBrandHeader) ? 'rgba(255,255,255,0.1)' : '#f3f4f6', 
              textColor: (isBoldSidebar || isBrandHeader) ? '#ffffff' : '#111827'
          },

          logoBox: {
              backgroundColor: (isBoldSidebar || isBrandHeader) ? 'rgba(255,255,255, 0.2)' : theme.primaryColor,
              color: '#ffffff'
          },

          navItem: (isActive) => {
              if (isBoldSidebar) {
                  return {
                      bg: isActive ? 'rgba(255,255,255, 0.2)' : 'transparent',
                      text: isActive ? '#ffffff' : 'rgba(255,255,255, 0.7)',
                      icon: isActive ? '#ffffff' : 'rgba(255,255,255, 0.7)'
                  };
              } else {
                  return {
                      bg: isActive ? `${theme.primaryColor}15` : 'transparent', 
                      text: isActive ? theme.primaryColor : '#4b5563', 
                      icon: isActive ? theme.primaryColor : '#9ca3af' 
                  };
              }
          },

          checkInBtn: {
              backgroundColor: isBoldSidebar ? '#ffffff' : theme.primaryColor,
              color: isBoldSidebar ? theme.primaryColor : '#ffffff'
          },

          logoutBtn: {
              color: isBoldSidebar ? 'rgba(255,255,255, 0.6)' : '#6b7280',
              hoverColor: isBoldSidebar ? '#ffffff' : '#dc2626'
          }
      };
  };

  const styles = getStyles();

  return (
    <div className="flex h-screen bg-gray-50">
      
      {/* =========================================
          DESKTOP SIDEBAR 
         ========================================= */}
      <aside 
        className="hidden md:flex w-64 flex-col sticky top-0 h-screen z-40 transition-colors duration-300 border-r"
        style={{ 
            backgroundColor: styles.sidebarContainer.backgroundColor, 
            borderColor: styles.sidebarContainer.borderColor 
        }}
      >
        
        {/* Sidebar Header (Logo Area) */}
        <div 
            className="h-20 flex items-center px-6 border-b transition-colors"
            style={{ 
                backgroundColor: styles.sidebarHeader.backgroundColor,
                borderColor: styles.sidebarHeader.borderColor
            }}
        >
           <div 
             className="h-10 w-10 rounded-lg flex items-center justify-center shadow-lg mr-3 shrink-0"
             style={styles.logoBox}
           >
              {hasGyms && currentGym?.logoUrl ? (
                  <img src={currentGym.logoUrl} className="h-full w-full rounded-lg object-contain bg-white" />
              ) : (
                  <Dumbbell size={20} color="#ffffff" />
              )}
           </div>
           <span 
             className="font-bold truncate text-lg"
             style={{ color: styles.sidebarHeader.textColor }}
           >
             {hasGyms ? (currentGym?.name || "My Gym") : "GymDash"}
           </span>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 p-4 space-y-2">
            <DesktopNavItem 
                to="/members/home" 
                icon={Home} 
                label={hasGyms ? "Dashboard" : "Find a Gym"} 
                getStyle={styles.navItem} 
            />
            
            {hasGyms && (
                <>
                    <DesktopNavItem 
                        to="/members/schedule" 
                        icon={Calendar} 
                        label="Schedule" 
                        getStyle={styles.navItem} 
                    />
                    {/* UPDATED LINK */}
                    <DesktopNavItem 
                        to="/members/store" 
                        icon={ShoppingBag} 
                        label="Store" 
                        getStyle={styles.navItem} 
                    />
                </>
            )}
            
            <DesktopNavItem 
                to="/members/profile" 
                icon={User} 
                label="Profile" 
                getStyle={styles.navItem} 
            />
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t" style={{ borderColor: styles.sidebarHeader.borderColor }}>
             {hasGyms && (
                 <button 
                    className="w-full p-3 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity mb-2"
                    style={styles.checkInBtn}
                 >
                    <QrCode size={18} /> Check In
                 </button>
             )}
             
             <button 
                onClick={handleLogout} 
                className="w-full p-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                style={{ color: styles.logoutBtn.color }}
                onMouseEnter={(e) => e.currentTarget.style.color = styles.logoutBtn.hoverColor}
                onMouseLeave={(e) => e.currentTarget.style.color = styles.logoutBtn.color}
             >
                <LogOut size={16} /> Sign Out
             </button>
        </div>
      </aside>


      {/* =========================================
          MAIN CONTENT AREA 
         ========================================= */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0 safe-top no-scrollbar">
           <div className="w-full max-w-lg md:max-w-2xl mx-auto min-h-full bg-gray-50 md:bg-white md:shadow-sm md:border-x md:border-gray-100">
              <Outlet />
           </div>
        </div>

        {/* =========================================
            MOBILE BOTTOM NAV 
           ========================================= */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 pb-6 safe-bottom flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <MobileNavItem to="/members/home" icon={<Home size={24} />} label={hasGyms ? "Home" : "Search"} theme={theme} />
          
          {hasGyms && (
              <MobileNavItem to="/members/schedule" icon={<Calendar size={24} />} label="Book" theme={theme} />
          )}
          
          {/* FAB (Check-in) */}
          {hasGyms ? (
              <div className="-mt-10">
                  <button 
                    className="text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform active:scale-95 border-4 border-gray-50 flex items-center justify-center"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                      <QrCode size={28} />
                  </button>
              </div>
          ) : (
               <div className="-mt-10 opacity-20">
                   <div className="bg-gray-200 text-gray-400 p-4 rounded-full border-4 border-gray-50">
                        <LinkIcon size={28} />
                   </div>
               </div>
          )}

          {hasGyms && (
              /* UPDATED LINK */
              <MobileNavItem to="/members/store" icon={<ShoppingBag size={24} />} label="Store" theme={theme} />
          )}

          <MobileNavItem to="/members/profile" icon={<User size={24} />} label="Profile" theme={theme} />
        </div>

      </div>
    </div>
  );
};

// --- HELPER COMPONENTS ---

const MobileNavItem = ({ to, icon, label, theme }) => (
  <NavLink 
    to={to} 
    style={({ isActive }) => isActive ? { color: theme.primaryColor } : {}}
    className={({ isActive }) => 
      `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
        isActive ? '' : 'text-gray-400 hover:text-gray-600'
      }`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

const DesktopNavItem = ({ to, icon: Icon, label, getStyle }) => (
    <NavLink 
      to={to} 
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
      style={({ isActive }) => {
          const style = getStyle(isActive);
          return {
              backgroundColor: style.bg,
              color: style.text
          }
      }}
    >
      {({ isActive }) => {
          const style = getStyle(isActive);
          return (
            <>
                <Icon size={20} style={{ color: style.icon }} />
                <span>{label}</span>
            </>
          );
      }}
    </NavLink>
);

export default MemberLayout;