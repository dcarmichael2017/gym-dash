import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, Calendar, Users, Settings, LogOut, Menu, 
  Dumbbell, Briefcase, CreditCard, BarChart3, BookOpen // <--- 1. Added BookOpen icon
} from 'lucide-react';
import { auth, db } from '../../../shared/api/firebaseConfig';

const DashboardLayout = () => {
  const [gymName, setGymName] = useState('My Gym');
  const [gymId, setGymId] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  
  const [theme, setTheme] = useState({ 
    primaryColor: '#2563eb', 
    secondaryColor: '#4f46e5',
    layout: 'classic' 
  });
  
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // --- 2. UPDATED NAVIGATION ITEMS ---
  const navItems = [
    { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Reports', path: '/dashboard/analytics', icon: BarChart3 },
    
    // Split Schedule into two:
    { name: 'Calendar', path: '/dashboard/calendar', icon: Calendar }, 
    { name: 'Classes', path: '/dashboard/classes', icon: BookOpen },
    
    { name: 'Memberships', path: '/dashboard/memberships', icon: CreditCard },
    { name: 'Members', path: '/dashboard/members', icon: Users },
    { name: 'Staff', path: '/dashboard/staff', icon: Briefcase },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  // --- PREFAB LOGIC ---
  const getStyles = () => {
    const isSidebarColored = theme.layout === 'sidebar';
    const isHeaderColored = theme.layout === 'header';

    return {
      sidebar: {
        bg: isSidebarColored ? theme.primaryColor : '#ffffff',
        text: isSidebarColored ? '#ffffff' : '#4b5563',
        border: isSidebarColored ? 'none' : '',
        logoColor: isSidebarColored ? '#ffffff' : theme.secondaryColor
      },
      header: {
        bg: isHeaderColored ? theme.primaryColor : '#ffffff',
        text: isHeaderColored ? '#ffffff' : '#1f2937',
        border: isHeaderColored ? 'none' : ''
      },
      navItem: (isActive) => {
        if (isSidebarColored) {
          return isActive 
            ? { bg: 'rgba(255,255,255, 0.2)', text: '#ffffff' } 
            : { bg: 'transparent', text: 'rgba(255,255,255, 0.7)' };
        } else {
          return isActive 
            ? { bg: `${theme.primaryColor}15`, text: theme.primaryColor } 
            : { bg: 'transparent', text: '#4b5563' };
        }
      }
    };
  };

  const styles = getStyles();

  useEffect(() => {
    const fetchGymDetails = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().gymId) {
            const gId = userSnap.data().gymId;
            setGymId(gId);

            const gymRef = doc(db, 'gyms', gId);
            const gymSnap = await getDoc(gymRef);
            if (gymSnap.exists()) {
              const data = gymSnap.data();
              setGymName(data.name);
              if (data.logoUrl) setLogoUrl(data.logoUrl);
              
              if (data.theme) {
                 setTheme({
                    primaryColor: data.theme.primaryColor || '#2563eb',
                    secondaryColor: data.theme.secondaryColor || '#4f46e5',
                    layout: data.theme.layout || 'classic'
                 });
              }
            }
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    fetchGymDetails();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const checkActive = (itemPath) => {
    return location.pathname === itemPath || 
           (itemPath !== '/dashboard' && location.pathname.startsWith(`${itemPath}/`));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      
      {/* --- SIDEBAR --- */}
      <aside 
        className="hidden md:flex md:w-64 flex-col border-r border-gray-200 transition-colors duration-300"
        style={{ backgroundColor: styles.sidebar.bg, borderColor: styles.sidebar.border }}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-100/10">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain mr-2 rounded-md bg-white/10" />
          ) : (
            <Dumbbell className="h-8 w-8 mr-2" style={{ color: styles.sidebar.logoColor }} />
          )}
          <span className="font-bold text-xl truncate" style={{ color: styles.sidebar.text }}>
            {gymName}
          </span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = checkActive(item.path);
            const itemStyle = styles.navItem(isActive);

            return (
              <Link
                key={item.name}
                to={item.path}
                style={{ backgroundColor: itemStyle.bg, color: itemStyle.text }}
                className="flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
              >
                <item.icon className="h-5 w-5 mr-3 opacity-90" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100/10">
          <button 
            onClick={handleLogout}
            className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
               theme.layout === 'sidebar' 
               ? 'text-white/70 hover:bg-white/10 hover:text-white' 
               : 'text-red-600 hover:bg-red-50'
            }`}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* --- MAIN AREA --- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* --- HEADER --- */}
        <header 
          className="h-16 flex items-center justify-between px-6 border-b border-gray-200 transition-colors duration-300"
          style={{ backgroundColor: styles.header.bg, color: styles.header.text }}
        >
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="h-6 w-6" style={{ color: styles.header.text }} />
            </button>
          </div>
          
          <div className="ml-4 md:ml-0">
            <h1 className="text-xl font-semibold">
              {loading ? '...' : 
                location.pathname.includes('analytics') ? 'Reports' : 
                location.pathname.includes('calendar') ? 'Calendar' : 
                location.pathname.includes('classes') ? 'Classes' : 
                location.pathname.includes('settings') ? 'Settings' : 
                location.pathname.includes('memberships') ? 'Memberships' : 
                location.pathname.includes('members') ? 'Members' : 
                location.pathname.includes('staff') ? 'Staff' :
                gymName
              }
            </h1>
          </div>

          <div className="flex items-center space-x-4">
              <div 
                className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm ring-2 ring-white/20"
                style={{ backgroundColor: theme.secondaryColor }}
              >
                {auth.currentUser?.email?.[0].toUpperCase()}
              </div>
          </div>
        </header>

        {/* Mobile Menu (Overlay) */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 w-full bg-white border-b border-gray-200 z-50 shadow-xl">
            <nav className="p-4 space-y-2">
              {navItems.map((item) => {
                const isActive = checkActive(item.path);
                
                const activeStyle = {
                    backgroundColor: `${theme.primaryColor}15`, 
                    color: theme.primaryColor
                };

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)} 
                    style={isActive ? activeStyle : {}}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive 
                        ? '' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
              
              <div className="border-t border-gray-100 my-2 pt-2">
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <Outlet context={{ theme, gymName, gymId }} />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;