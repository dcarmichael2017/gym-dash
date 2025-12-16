import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Building, Palette, CreditCard, Scale, Settings, Medal } from 'lucide-react'; // Added Medal

// API Imports
import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getGymDetails } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';

// Component Imports
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { BrandingSettingsTab } from './settings/BrandingSettingsTab';
import { PaymentsSettingsTab } from './settings/PaymentsSettingsTab';
import { BookingPoliciesTab } from './settings/BookingPoliciesTab';
import { LegalSettingsTab } from './settings/LegalSettingsTab';
import { RankSettingsTab } from './settings/RankSettingsTab';

const DashboardSettingsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [gymData, setGymData] = useState(null);

  // 1. Extract fetch logic into a reusable function
  const refreshGymData = async (gId = gymId) => {
    if (!gId) return;
    try {
      const result = await getGymDetails(gId);
      if (result.success) {
        setGymData(result.gym);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().gymId) {
          const gId = userSnap.data().gymId;
          setGymId(gId);
          // Call the reusable function
          await refreshGymData(gId);
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    initData();
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  if (loading) return <FullScreenLoader />;
  if (!gymData) return <div>Error loading settings.</div>;

  const tabs = [
    { id: 'general', label: 'General', icon: Building },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'ranks', label: 'Rank Management', icon: Medal },
    { id: 'booking', label: 'Booking Policies', icon: Settings },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'legal', label: 'Legal & Waivers', icon: Scale },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-500">Manage your gym profile and configurations.</p>
      </div>

      {/* TABS HEADER */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        {tabs.map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
            </button>
        ))}
      </div>

      {/* ALERT BOX */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
            {message.text}
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        
        {/* 2. Pass refreshGymData as a prop (e.g., onUpdate) to tabs that modify data */}
        
        {activeTab === 'general' && (
            <GeneralSettingsTab 
                gymId={gymId} 
                initialData={{ name: gymData.name, description: gymData.description }}
                showMessage={showMessage}
                onUpdate={() => refreshGymData()} // Pass it here
            />
        )}

        {activeTab === 'branding' && (
            <BrandingSettingsTab 
                gymId={gymId}
                initialData={{
                    primaryColor: gymData.theme?.primaryColor || '#DB2777',
                    secondaryColor: gymData.theme?.secondaryColor || '#4F46E5',
                    layout: gymData.theme?.layout || 'classic',
                    logoUrl: gymData.logoUrl
                }}
                showMessage={showMessage}
                onUpdate={() => refreshGymData()}
            />
        )}

        {activeTab === 'ranks' && (
            <RankSettingsTab 
                gymId={gymId}
                initialData={gymData.grading}
                showMessage={showMessage}
                onUpdate={() => refreshGymData()} // <--- PASS IT HERE
            />
        )}

        {activeTab === 'booking' && (
            <BookingPoliciesTab 
                gymId={gymId}
                initialData={gymData.booking}
                showMessage={showMessage}
                onUpdate={() => refreshGymData()}
            />
        )}

        {activeTab === 'payments' && (
            <PaymentsSettingsTab stripeId={gymData.stripeAccountId} />
        )}

        {activeTab === 'legal' && (
            <LegalSettingsTab 
                gymId={gymId}
                initialData={gymData.legal}
                showMessage={showMessage}
                onUpdate={() => refreshGymData()}
            />
        )}

      </div>
    </div>
  );
};

export default DashboardSettingsScreen;