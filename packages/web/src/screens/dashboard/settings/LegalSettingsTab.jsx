import React, { useState } from 'react';
// ADDED FileText to the imports below
import { Save, AlertCircle, CheckSquare, Square, Scale, AlertTriangle, FileText } from 'lucide-react';
import { updateGymDetails } from '../../../../../shared/api/firestore';

// Placeholder text acts as a visual guide but is NOT saved data
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

export const LegalSettingsTab = ({ gymId, initialData, showMessage }) => {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    waiverText: initialData?.waiverText || '',
    tosText: initialData?.tosText || '',
    requireWaiver: initialData?.requireWaiver ?? true, 
  });

  const handleSave = async () => {
    // Validation check
    if (formData.requireWaiver && !formData.waiverText.trim()) {
        showMessage('error', 'You cannot require a waiver without waiver text.');
        return;
    }

    setLoading(true);
    const result = await updateGymDetails(gymId, {
      legal: {
        waiverText: formData.waiverText,
        tosText: formData.tosText,
        requireWaiver: formData.requireWaiver
      }
    });

    setLoading(false);
    if (result.success) {
      showMessage('success', 'Legal documents updated successfully.');
    } else {
      showMessage('error', 'Failed to save settings.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Platform Legal Disclaimer */}
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-bold">Disclaimer</p>
          <p>GymDash provides the tools to collect digital signatures, but we do not provide legal advice. Please consult a legal professional to draft waivers compliant with your local laws.</p>
        </div>
      </div>

      {/* Enforcement Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
            <h4 className="font-bold text-gray-800 text-sm">Enforce Waiver Signature?</h4>
            <p className="text-xs text-gray-500">If enabled, new members cannot create an account without accepting.</p>
        </div>
        <button 
            onClick={() => setFormData(p => ({...p, requireWaiver: !p.requireWaiver}))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${formData.requireWaiver ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 text-gray-500'}`}
        >
            {formData.requireWaiver ? <CheckSquare size={18} /> : <Square size={18} />}
            <span className="text-sm font-medium">{formData.requireWaiver ? 'Required' : 'Optional'}</span>
        </button>
      </div>

      {/* Liability Waiver */}
      <div>
        <div className="flex justify-between items-end mb-2">
            <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-gray-500" />
                <label className="block text-sm font-bold text-gray-700">Liability Waiver</label>
            </div>
            <span className="text-xs text-gray-400">Required for account creation</span>
        </div>
        <textarea
          rows={12}
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
                <label className="block text-sm font-bold text-gray-700">Gym Terms of Service</label>
            </div>
            <span className="text-xs text-gray-400">General rules & policies</span>
        </div>
        <textarea
          rows={12}
          value={formData.tosText}
          onChange={(e) => setFormData({ ...formData, tosText: e.target.value })}
          placeholder={PLACEHOLDERS.tos}
          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono leading-relaxed placeholder:text-gray-300"
        />
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Legal Docs'}
        </button>
      </div>
    </div>
  );
};