import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Building, Palette, CreditCard } from 'lucide-react';

// API Imports
import { auth, db } from '../../../../shared/api/firebaseConfig';
import { getGymDetails } from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';

// Component Imports
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { BrandingSettingsTab } from './settings/BrandingSettingsTab';
import { PaymentsSettingsTab } from './settings/PaymentsSettingsTab';

const DashboardSettingsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Centralized Data State
  const [gymData, setGymData] = useState(null);

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
          const result = await getGymDetails(gId);
          if (result.success) setGymData(result.gym);
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-500">Manage your gym profile and configurations.</p>
      </div>

      {/* TABS HEADER */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        {[
            { id: 'general', label: 'General', icon: Building },
            { id: 'branding', label: 'Branding', icon: Palette },
            { id: 'payments', label: 'Payments', icon: CreditCard },
        ].map(tab => (
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
        
        {activeTab === 'general' && (
            <GeneralSettingsTab 
                gymId={gymId} 
                initialData={{ name: gymData.name, description: gymData.description }}
                showMessage={showMessage}
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
            />
        )}

        {activeTab === 'payments' && (
            <PaymentsSettingsTab stripeId={gymData.stripeAccountId} />
        )}

      </div>
    </div>
  );
};

export default DashboardSettingsScreen;