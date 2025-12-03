import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Building, 
  Palette, 
  Users, 
  CreditCard, 
  Save, 
  Trash2, 
  Plus, 
  Upload,
  Check
} from 'lucide-react';

// Relative Imports
import { auth, db } from '../../../../shared/api/firebaseConfig';
import { uploadLogo } from '../../../../shared/api/storage';
import { 
  getGymDetails, 
  updateGymDetails, 
  updateGymBranding, 
  getStaffList, 
  addStaffMember, 
  deleteStaffMember 
} from '../../../../shared/api/firestore';
import { FullScreenLoader } from '../../components/layout/FullScreenLoader';

// Professional Color Presets
const THEME_PRESETS = [
  { name: 'Modern Pink', primary: '#DB2777', secondary: '#4F46E5' }, // Pink / Indigo
  { name: 'Ocean Blue', primary: '#2563EB', secondary: '#0EA5E9' },  // Blue / Sky
  { name: 'Power Red', primary: '#DC2626', secondary: '#1F2937' },   // Red / Dark Gray
  { name: 'Forest', primary: '#059669', secondary: '#10B981' },      // Green / Emerald
  { name: 'Midnight', primary: '#4F46E5', secondary: '#1E1B4B' },    // Indigo / Deep Navy
  { name: 'Sunset', primary: '#EA580C', secondary: '#F59E0B' },      // Orange / Amber
];

const DashboardSettingsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Data States
  const [generalData, setGeneralData] = useState({ name: '', description: '' });
  
  // Branding Data now includes 'layout'
  const [brandingData, setBrandingData] = useState({ 
    primaryColor: '#DB2777', 
    secondaryColor: '#4F46E5', 
    logoUrl: null,
    layout: 'classic' // Default layout
  });
  
  const [logoFile, setLogoFile] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', title: '' });
  const [stripeId, setStripeId] = useState(null);

  // 1. Fetch All Data on Mount
  useEffect(() => {
    const initData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (userData?.gymId) {
          setGymId(userData.gymId);
          
          // Parallel Fetching
          const [gymResult, staffResult] = await Promise.all([
            getGymDetails(userData.gymId),
            getStaffList(userData.gymId)
          ]);

          if (gymResult.success) {
            const gym = gymResult.gym;
            setGeneralData({ 
              name: gym.name || '', 
              description: gym.description || '' 
            });
            if (gym.theme) {
              setBrandingData({
                primaryColor: gym.theme.primaryColor || '#DB2777',
                secondaryColor: gym.theme.secondaryColor || '#4F46E5',
                logoUrl: gym.logoUrl || null,
                layout: gym.theme.layout || 'classic' // Load saved layout
              });
            }
            setStripeId(gym.stripeAccountId);
          }

          if (staffResult.success) {
            setStaffList(staffResult.staffList);
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // --- Handlers ---

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleGeneralSave = async (e) => {
    e.preventDefault();
    const result = await updateGymDetails(gymId, generalData);
    if (result.success) showMessage('success', 'Gym details updated!');
    else showMessage('error', 'Failed to update details.');
  };

  const applyPreset = (preset) => {
    setBrandingData(prev => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary
    }));
  };

  const handleBrandingSave = async (e) => {
    e.preventDefault();
    let url = brandingData.logoUrl;

    if (logoFile) {
        const uploadRes = await uploadLogo(gymId, logoFile);
        if (uploadRes.success) {
            url = uploadRes.url;
            setBrandingData(prev => ({ ...prev, logoUrl: url }));
        } else {
            showMessage('error', 'Logo upload failed');
            return;
        }
    }

    const payload = {
        theme: {
            primaryColor: brandingData.primaryColor,
            secondaryColor: brandingData.secondaryColor,
            layout: brandingData.layout // Save the layout choice
        },
        logoUrl: url
    };

    const result = await updateGymBranding(gymId, payload);
    if (result.success) showMessage('success', 'Branding updated! Refresh page to see full changes.');
    else showMessage('error', 'Failed to update branding.');
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.title) return;

    const result = await addStaffMember(gymId, newStaff);
    if (result.success) {
        setStaffList([...staffList, result.staffMember]);
        setNewStaff({ name: '', title: '' });
        showMessage('success', 'Staff member added.');
    } else {
        showMessage('error', 'Failed to add staff.');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if(!window.confirm("Remove this staff member?")) return;
    setStaffList(prev => prev.filter(s => s.id !== staffId));
    await deleteStaffMember(gymId, staffId);
  };

  if (loading) return <FullScreenLoader />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <p className="text-gray-500">Manage your gym profile and configurations.</p>
      </div>

      {/* --- Tabs --- */}
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        {[
            { id: 'general', label: 'General', icon: Building },
            { id: 'branding', label: 'Branding', icon: Palette },
            { id: 'staff', label: 'Staff', icon: Users },
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

      {/* --- Notification Message --- */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
            {message.text}
        </div>
      )}

      {/* --- Content Area --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        
        {/* TAB 1: GENERAL */}
        {activeTab === 'general' && (
            <form onSubmit={handleGeneralSave}>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gym Name</label>
                        <input 
                            type="text" 
                            value={generalData.name}
                            onChange={e => setGeneralData({...generalData, name: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea 
                            rows="4"
                            value={generalData.description}
                            onChange={e => setGeneralData({...generalData, description: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                            <Save className="h-4 w-4 mr-2" /> Save Changes
                        </button>
                    </div>
                </div>
            </form>
        )}

        {/* TAB 2: BRANDING */}
        {activeTab === 'branding' && (
            <form onSubmit={handleBrandingSave}>
                <div className="space-y-8">
                    
                    {/* 1. Logo Section */}
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-32 h-32 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden relative">
                            {logoFile ? (
                                <img src={URL.createObjectURL(logoFile)} className="w-full h-full object-contain" />
                            ) : brandingData.logoUrl ? (
                                <img src={brandingData.logoUrl} className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-gray-400 text-xs">No Logo</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Upload New Logo</label>
                            <div className="flex items-center gap-4">
                                <label className="cursor-pointer flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-gray-700 text-sm font-medium transition-colors">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Choose File
                                    <input type="file" className="hidden" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
                                </label>
                                {logoFile && <span className="text-sm text-gray-500">{logoFile.name}</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Recommended: PNG or JPG, at least 512x512px.</p>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* 2. Layout Style Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Layout Style</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            
                            {/* Option 1: Classic */}
                            <button
                                type="button"
                                onClick={() => setBrandingData({...brandingData, layout: 'classic'})}
                                className={`border-2 rounded-xl p-4 flex flex-col gap-3 text-left transition-all ${
                                    brandingData.layout === 'classic' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                                }`}
                            >
                                <div className="h-20 w-full bg-gray-100 rounded-md border border-gray-200 flex overflow-hidden">
                                    <div className="w-1/4 bg-white border-r h-full"></div>
                                    <div className="flex-1 bg-white h-full flex flex-col">
                                        <div className="h-4 border-b w-full"></div>
                                    </div>
                                </div>
                                <div>
                                    <span className="block font-medium text-gray-900">Classic</span>
                                    <span className="text-xs text-gray-500">Clean white sidebar and header.</span>
                                </div>
                            </button>

                            {/* Option 2: Bold Sidebar */}
                            <button
                                type="button"
                                onClick={() => setBrandingData({...brandingData, layout: 'sidebar'})}
                                className={`border-2 rounded-xl p-4 flex flex-col gap-3 text-left transition-all ${
                                    brandingData.layout === 'sidebar' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                                }`}
                            >
                                <div className="h-20 w-full bg-gray-100 rounded-md border border-gray-200 flex overflow-hidden">
                                    <div className="w-1/4 h-full" style={{ backgroundColor: brandingData.primaryColor }}></div>
                                    <div className="flex-1 bg-white h-full flex flex-col">
                                        <div className="h-4 border-b w-full"></div>
                                    </div>
                                </div>
                                <div>
                                    <span className="block font-medium text-gray-900">Bold Sidebar</span>
                                    <span className="text-xs text-gray-500">Primary color on navigation.</span>
                                </div>
                            </button>

                            {/* Option 3: Brand Header */}
                            <button
                                type="button"
                                onClick={() => setBrandingData({...brandingData, layout: 'header'})}
                                className={`border-2 rounded-xl p-4 flex flex-col gap-3 text-left transition-all ${
                                    brandingData.layout === 'header' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                                }`}
                            >
                                <div className="h-20 w-full bg-gray-100 rounded-md border border-gray-200 flex flex-col overflow-hidden">
                                     <div className="h-4 w-full" style={{ backgroundColor: brandingData.primaryColor }}></div>
                                    <div className="flex-1 flex">
                                        <div className="w-1/4 bg-white border-r h-full"></div>
                                        <div className="flex-1 bg-white"></div>
                                    </div>
                                </div>
                                <div>
                                    <span className="block font-medium text-gray-900">Brand Header</span>
                                    <span className="text-xs text-gray-500">Primary color on top header.</span>
                                </div>
                            </button>

                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* 3. Theme Presets */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Color Themes</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                        {THEME_PRESETS.map((preset) => {
                          const isActive = 
                            brandingData.primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                            brandingData.secondaryColor.toLowerCase() === preset.secondary.toLowerCase();

                          return (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => applyPreset(preset)}
                              className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                                isActive ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="h-10 w-full" style={{ backgroundColor: preset.primary }}></div>
                              <div className="h-4 w-full" style={{ backgroundColor: preset.secondary }}></div>
                              <div className="p-2 bg-white text-xs font-medium text-gray-600 text-center">
                                {preset.name}
                              </div>
                              {isActive && (
                                <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm">
                                  <Check className="h-3 w-3 text-blue-600" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Colors Section (Manual) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    value={brandingData.primaryColor}
                                    onChange={e => setBrandingData({...brandingData, primaryColor: e.target.value})}
                                    className="h-10 w-20 p-1 rounded border border-gray-300 cursor-pointer"
                                />
                                <span className="text-gray-500 text-sm font-mono">{brandingData.primaryColor}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="color" 
                                    value={brandingData.secondaryColor}
                                    onChange={e => setBrandingData({...brandingData, secondaryColor: e.target.value})}
                                    className="h-10 w-20 p-1 rounded border border-gray-300 cursor-pointer"
                                />
                                <span className="text-gray-500 text-sm font-mono">{brandingData.secondaryColor}</span>
                            </div>
                        </div>
                    </div>

                    {/* 5. Live Preview Card */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Live Button Preview</p>
                        <div className="flex gap-3">
                           <button 
                             type="button" 
                             className="px-4 py-2 rounded-md text-white text-sm font-medium shadow-sm"
                             style={{ backgroundColor: brandingData.primaryColor }}
                           >
                              Primary Action
                           </button>
                           <button 
                             type="button" 
                             className="px-4 py-2 rounded-md bg-white border text-sm font-medium shadow-sm"
                             style={{ borderColor: brandingData.secondaryColor, color: brandingData.secondaryColor }}
                           >
                              Secondary Action
                           </button>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                            <Save className="h-4 w-4 mr-2" /> Save Branding
                        </button>
                    </div>
                </div>
            </form>
        )}

        {/* TAB 3: STAFF */}
        {activeTab === 'staff' && (
            <div>
                {/* Add Form */}
                <form onSubmit={handleAddStaff} className="flex flex-col md:flex-row gap-4 mb-8 bg-gray-50 p-4 rounded-lg">
                    <div className="flex-1">
                        <input 
                            placeholder="Name (e.g. John Doe)"
                            value={newStaff.name}
                            onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <input 
                            placeholder="Title (e.g. Head Coach)"
                            value={newStaff.title}
                            onChange={e => setNewStaff({...newStaff, title: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                        />
                    </div>
                    <button type="submit" className="bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium flex items-center justify-center">
                        <Plus className="h-4 w-4 mr-1" /> Add
                    </button>
                </form>

                {/* List */}
                <div className="space-y-3">
                    {staffList.map(staff => (
                        <div key={staff.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:border-blue-100 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                    {staff.name[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{staff.name}</p>
                                    <p className="text-xs text-gray-500">{staff.title}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDeleteStaff(staff.id)}
                                className="text-gray-400 hover:text-red-500 p-2"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    {staffList.length === 0 && (
                        <p className="text-center text-gray-400 text-sm py-4">No staff members added yet.</p>
                    )}
                </div>
            </div>
        )}

        {/* TAB 4: PAYMENTS */}
        {activeTab === 'payments' && (
            <div className="text-center py-8">
                <div className="inline-flex h-16 w-16 bg-green-100 items-center justify-center rounded-full mb-4">
                    <CreditCard className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-800">Stripe Connection</h3>
                
                {stripeId ? (
                    <div className="mt-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            ● Active & Connected
                        </span>
                        <p className="text-gray-500 text-sm mt-4">
                            Account ID: <span className="font-mono">{stripeId}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            To update banking details, please visit your Stripe Express Dashboard.
                        </p>
                    </div>
                ) : (
                    <div className="mt-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            ● Not Connected
                        </span>
                        <p className="text-gray-500 text-sm mt-2">
                            Please complete the onboarding flow to accept payments.
                        </p>
                    </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
};

export default DashboardSettingsScreen;