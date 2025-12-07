import React, { useState } from 'react';
import { Save, Upload, Check } from 'lucide-react';
import { updateGymBranding } from '../../../../../shared/api/firestore';
import { uploadLogo } from '../../../../../shared/api/storage';

const THEME_PRESETS = [
  { name: 'Modern Pink', primary: '#DB2777', secondary: '#4F46E5' },
  { name: 'Ocean Blue', primary: '#2563EB', secondary: '#0EA5E9' },
  { name: 'Power Red', primary: '#DC2626', secondary: '#1F2937' },
  { name: 'Forest', primary: '#059669', secondary: '#10B981' },
  { name: 'Midnight', primary: '#4F46E5', secondary: '#1E1B4B' },
  { name: 'Sunset', primary: '#EA580C', secondary: '#F59E0B' },
];

export const BrandingSettingsTab = ({ gymId, initialData, showMessage }) => {
  const [data, setData] = useState(initialData);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    let url = data.logoUrl;

    if (logoFile) {
        const uploadRes = await uploadLogo(gymId, logoFile);
        if (uploadRes.success) {
            url = uploadRes.url;
        } else {
            showMessage('error', 'Logo upload failed');
            setSaving(false);
            return;
        }
    }

    const payload = {
        theme: {
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            layout: data.layout // Ensure layout is saved
        },
        logoUrl: url
    };

    const result = await updateGymBranding(gymId, payload);
    if (result.success) showMessage('success', 'Branding updated! Refresh page to see changes.');
    else showMessage('error', 'Failed to update branding.');
    setSaving(false);
  };

  const applyPreset = (preset) => {
    setData(prev => ({ ...prev, primaryColor: preset.primary, secondaryColor: preset.secondary }));
  };

  return (
    <form onSubmit={handleSave}>
      <div className="space-y-8">
        
        {/* 1. LOGO SECTION */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-32 h-32 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden relative">
                {logoFile ? (
                    <img src={URL.createObjectURL(logoFile)} className="w-full h-full object-contain" />
                ) : data.logoUrl ? (
                    <img src={data.logoUrl} className="w-full h-full object-contain" />
                ) : (
                    <span className="text-gray-400 text-xs">No Logo</span>
                )}
            </div>
            <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload New Logo</label>
                <div className="flex items-center gap-4">
                    <label className="cursor-pointer flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-gray-700 text-sm font-medium transition-colors">
                        <Upload className="h-4 w-4 mr-2" /> Choose File
                        <input type="file" className="hidden" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
                    </label>
                    {logoFile && <span className="text-sm text-gray-500">{logoFile.name}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-2">Recommended: PNG or JPG, at least 512x512px.</p>
            </div>
        </div>

        <hr className="border-gray-100" />

        {/* 2. LAYOUT STYLE SELECTOR (Visual) */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Layout Style</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Option 1: Classic */}
                <button
                    type="button"
                    onClick={() => setData({...data, layout: 'classic'})}
                    className={`border-2 rounded-xl p-4 flex flex-col gap-3 text-left transition-all ${
                        data.layout === 'classic' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
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
                    onClick={() => setData({...data, layout: 'sidebar'})}
                    className={`border-2 rounded-xl p-4 flex flex-col gap-3 text-left transition-all ${
                        data.layout === 'sidebar' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <div className="h-20 w-full bg-gray-100 rounded-md border border-gray-200 flex overflow-hidden">
                        <div className="w-1/4 h-full" style={{ backgroundColor: data.primaryColor }}></div>
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
                    onClick={() => setData({...data, layout: 'header'})}
                    className={`border-2 rounded-xl p-4 flex flex-col gap-3 text-left transition-all ${
                        data.layout === 'header' ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    <div className="h-20 w-full bg-gray-100 rounded-md border border-gray-200 flex flex-col overflow-hidden">
                            <div className="h-4 w-full" style={{ backgroundColor: data.primaryColor }}></div>
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

        {/* 3. COLOR PRESETS */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Color Themes</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {THEME_PRESETS.map((preset) => {
                const isActive = 
                    data.primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                    data.secondaryColor.toLowerCase() === preset.secondary.toLowerCase();
                
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

        {/* 4. MANUAL COLOR PICKERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                <div className="flex items-center gap-3">
                    <input 
                        type="color" 
                        value={data.primaryColor}
                        onChange={e => setData({...data, primaryColor: e.target.value})}
                        className="h-10 w-20 p-1 rounded border border-gray-300 cursor-pointer"
                    />
                    <span className="text-gray-500 text-sm font-mono">{data.primaryColor}</span>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                <div className="flex items-center gap-3">
                    <input 
                        type="color" 
                        value={data.secondaryColor}
                        onChange={e => setData({...data, secondaryColor: e.target.value})}
                        className="h-10 w-20 p-1 rounded border border-gray-300 cursor-pointer"
                    />
                    <span className="text-gray-500 text-sm font-mono">{data.secondaryColor}</span>
                </div>
            </div>
        </div>

        {/* 5. LIVE PREVIEW CARD */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Live Button Preview</p>
            <div className="flex gap-3">
                <button 
                    type="button" 
                    className="px-4 py-2 rounded-md text-white text-sm font-medium shadow-sm"
                    style={{ backgroundColor: data.primaryColor }}
                >
                    Primary Action
                </button>
                <button 
                    type="button" 
                    className="px-4 py-2 rounded-md bg-white border text-sm font-medium shadow-sm"
                    style={{ borderColor: data.secondaryColor, color: data.secondaryColor }}
                >
                    Secondary Action
                </button>
            </div>
        </div>

        {/* SUBMIT */}
        <div className="flex justify-end pt-4">
            <button 
                type="submit" 
                disabled={saving} 
                className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Branding'}
            </button>
        </div>
      </div>
    </form>
  );
};