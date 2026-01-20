import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, CheckSquare, Square, Scale, FileText, Loader2, History, Clock } from 'lucide-react';
import { updateLegalSettings, getLegalSettings } from '../../../../../../packages/shared/api/firestore';
import LegalHistoryModal from '../../../components/admin/LegalHistoryModal';


const PLACEHOLDERS = {
  waiver: `[EXAMPLE STRUCTURE - CONSULT YOUR LAWYER]

1. ASSUMPTION OF RISK
I hereby acknowledge that I am voluntarily participating in physical activity...

2. RELEASE OF LIABILITY
I do hereby waive, release, and discharge [Gym Name] from any and all liabilities...

3. MEDICAL PHYSICAL CONDITION
I represent that I am in good physical health and have no medical condition...`,
  
  tos: `[EXAMPLE STRUCTURE]

1. MEMBERSHIP & BILLING
Memberships are billed on a recurring monthly basis...

2. CANCELLATION POLICY
Cancellations must be requested 30 days in advance via the member portal...

3. CODE OF CONDUCT
Harassment of members or staff will result in immediate termination...`
};

export const LegalSettingsTab = ({ gymId, showMessage, theme }) => {
  const primaryColor = theme?.primaryColor || '#2563eb';
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // State for metadata & original data for comparison
  const [meta, setMeta] = useState({ version: 0, updatedAt: null });
  const [originalData, setOriginalData] = useState(null);

  const [formData, setFormData] = useState({
    waiverText: '',
    tosText: '',
    requireWaiver: true, 
  });

  // --- 1. FETCH DATA ON MOUNT ---
  useEffect(() => {
    const loadSettings = async () => {
        if (!gymId) return;
        setFetching(true);
        const res = await getLegalSettings(gymId);
        
        if (res.success && res.data) {
            const loadedData = {
                waiverText: res.data.waiverText || '',
                tosText: res.data.tosText || '',
                requireWaiver: res.data.enforceWaiverSignature !== false 
            };
            
            setFormData(loadedData);
            setOriginalData(loadedData); // Store snapshot for comparison
            
            setMeta({
                version: res.data.version || 1,
                updatedAt: res.data.updatedAt ? res.data.updatedAt.toDate() : null
            });
        }
        setFetching(false);
    };
    loadSettings();
  }, [gymId]);

  // --- 2. COMPARE CHANGES ---
  const hasChanges = originalData && (
      formData.waiverText !== originalData.waiverText ||
      formData.tosText !== originalData.tosText ||
      formData.requireWaiver !== originalData.requireWaiver
  );

  const handleSave = async () => {
    if (!hasChanges) {
        showMessage('info', 'No changes to save.');
        return;
    }

    if (formData.requireWaiver && !formData.waiverText.trim()) {
        showMessage('error', 'You cannot require a waiver without waiver text.');
        return;
    }

    setLoading(true);

    const result = await updateLegalSettings(gymId, {
        waiverText: formData.waiverText,
        tosText: formData.tosText,
        enforceWaiverSignature: formData.requireWaiver
    });

    setLoading(false);
    if (result.success) {
      showMessage('success', `Saved! Now on Version ${result.version}.`);
      setMeta(prev => ({ 
          version: result.version, 
          updatedAt: new Date() 
      }));
      // Update the "Original" reference so button disables again until next change
      setOriginalData({ ...formData });
    } else {
      showMessage('error', 'Failed to save settings.');
    }
  };

  const handleViewHistory = () => {
      setShowHistory(true);
  };

  if (fetching) {
      return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

    {/* ADD MODAL CONDITION */}
      {showHistory && (
          <LegalHistoryModal 
              gymId={gymId} 
              onClose={() => setShowHistory(false)} 
          />
      )}
      
      {/* --- VERSION & STATUS HEADER --- */}
      <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-full text-blue-600">
                  <History size={20} />
              </div>
              <div>
                  <h3 className="text-sm font-bold text-gray-900">Current Version: v{meta.version}</h3>
                  <p className="text-xs text-gray-500">
                      Last Updated: {meta.updatedAt ? meta.updatedAt.toLocaleString() : 'Never'}
                  </p>
              </div>
          </div>
          
          <button 
            onClick={handleViewHistory}
            className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
          >
              <Clock size={14} /> View History
          </button>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-bold">Disclaimer</p>
          <p>GymDash provides the tools to collect digital signatures, but we do not provide legal advice.</p>
        </div>
      </div>

      {/* Enforcement Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
            <h4 className="font-bold text-gray-800 text-sm">Enforce Waiver Signature?</h4>
            <p className="text-xs text-gray-500">If enabled, members must sign before accessing the dashboard.</p>
        </div>
        <button 
            onClick={() => setFormData(p => ({...p, requireWaiver: !p.requireWaiver}))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${formData.requireWaiver ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 text-gray-500'}`}
        >
            {formData.requireWaiver ? <CheckSquare size={18} /> : <Square size={18} />}
            <span className="text-sm font-medium">{formData.requireWaiver ? 'Required' : 'Optional'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liability Waiver */}
          <div>
            <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-gray-500" />
                    <label className="block text-sm font-bold text-gray-700">Liability Waiver</label>
                </div>
                <span className="text-xs text-gray-400">Required</span>
            </div>
            <textarea
              rows={15}
              value={formData.waiverText}
              onChange={(e) => setFormData({ ...formData, waiverText: e.target.value })}
              placeholder={PLACEHOLDERS.waiver}
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono leading-relaxed placeholder:text-gray-300"
            />
          </div>

          {/* Terms of Service */}
          <div>
            <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <label className="block text-sm font-bold text-gray-700">Terms of Service</label>
                </div>
                <span className="text-xs text-gray-400">General Policies</span>
            </div>
            <textarea
              rows={15}
              value={formData.tosText}
              onChange={(e) => setFormData({ ...formData, tosText: e.target.value })}
              placeholder={PLACEHOLDERS.tos}
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono leading-relaxed placeholder:text-gray-300"
            />
          </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading || !hasChanges}
          className="flex items-center px-6 py-2 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: primaryColor }}
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Legal Docs'}
        </button>
      </div>
    </div>
  );
};