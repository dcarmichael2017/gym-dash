import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Coins, Plus, Trash2, Check, Globe, Users, Lock } from 'lucide-react';
import { createMembershipTier, updateMembershipTier } from '../../../../../../packages/shared/api/firestore';

const RecurringForm = ({ gymId, tierData, onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    interval: 'month',
    initiationFee: '',
    description: '',
    hasTrial: false,
    trialDays: 7,
    visibility: 'public',
    features: ['Unlimited Classes']
  });

  useEffect(() => {
    if (tierData) {
      setFormData({
        name: tierData.name || '',
        price: tierData.price !== undefined ? tierData.price : '',
        interval: tierData.interval || 'month',
        initiationFee: tierData.initiationFee || '',
        description: tierData.description || '',
        hasTrial: tierData.hasTrial || false,
        trialDays: tierData.trialDays || 7,
        visibility: tierData.visibility || 'public',
        features: tierData.features || [],
        weeklyLimit: tierData.weeklyLimit || ''
      });
    }
  }, [tierData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;

    setLoading(true);

    const cleanData = {
      ...formData,
      price: parseFloat(formData.price),
      initiationFee: parseFloat(formData.initiationFee) || 0,
      weeklyLimit: formData.weeklyLimit ? parseInt(formData.weeklyLimit) : null,
      trialDays: formData.hasTrial ? (parseInt(formData.trialDays) || 7) : null,
      features: formData.features.filter(f => f.trim() !== ''),
      // Explicitly ensure visibility is saved
      visibility: formData.visibility || 'public'
    };

    let result;
    if (tierData) {
      result = await updateMembershipTier(gymId, tierData.id, cleanData);
    } else {
      result = await createMembershipTier(gymId, cleanData);
    }

    setLoading(false);

    if (result.success) {
      onSave();
      onClose();
    } else {
      alert("Failed to save: " + result.error);
    }
  };

  // --- Helpers ---
  const handleFeatureChange = (index, val) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = val;
    setFormData({ ...formData, features: newFeatures });
  };
  const addFeature = () => setFormData({ ...formData, features: [...formData.features, ''] });
  const removeFeature = (i) => setFormData({ ...formData, features: formData.features.filter((_, idx) => idx !== i) });

  // --- Visibility Button Component ---
  const VisibilityOption = ({ value, label, icon: Icon, desc }) => (
    <button
      type="button"
      onClick={() => setFormData({ ...formData, visibility: value })}
      className={`flex-1 p-3 rounded-xl border text-left transition-all ${formData.visibility === value
          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
          : 'bg-white border-gray-200 hover:border-blue-200'
        }`}
    >
      <div className={`mb-1 ${formData.visibility === value ? 'text-blue-600' : 'text-gray-400'}`}>
        <Icon size={20} />
      </div>
      <div className={`text-xs font-bold uppercase ${formData.visibility === value ? 'text-blue-900' : 'text-gray-600'}`}>
        {label}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
        {desc}
      </div>
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Plan Name</label>
        <input required placeholder="e.g. Gold Unlimited" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Price & Billing Cycle */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Price ($)</label>
          <input required type="number" min="0" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Billing Frequency</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <select
              value={formData.interval}
              onChange={e => setFormData({ ...formData, interval: e.target.value })}
              className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="week">Weekly</option>
              <option value="2weeks">Every 2 Weeks</option>
            </select>
          </div>
        </div>
      </div>

      {/* Booking Limits */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
          Weekly Class Limit
        </label>
        <div className="relative">
          <input
            type="number"
            min="0"
            placeholder="Unlimited"
            value={formData.weeklyLimit || ''}
            onChange={e => setFormData({ ...formData, weeklyLimit: e.target.value })}
            className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-2.5 text-xs text-gray-400 pointer-events-none">
            classes / week
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Leave blank for unlimited. (e.g., set to "3" for a 3x/week plan).
        </p>
      </div>

      {/* Signup Fee */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Signup Fee (Optional)</label>
        <div className="relative">
          <Coins className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input type="number" min="0" step="0.01" value={formData.initiationFee} onChange={e => setFormData({ ...formData, initiationFee: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
        </div>
      </div>

      {/* Visibility Buttons */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">Visibility</label>
        <div className="flex gap-2">
          <VisibilityOption value="public" label="Public" icon={Globe} desc="Visible in app store" />
          <VisibilityOption value="staff" label="Internal" icon={Users} desc="Staff use only" />
          <VisibilityOption value="admin" label="Hidden" icon={Lock} desc="Draft / Owner only" />
        </div>
      </div>

      {/* Features */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">Features & Perks</label>
        <div className="space-y-2">
          {formData.features.map((feat, i) => (
            <div key={i} className="flex gap-2">
              <div className="relative flex-1">
                <Check className="absolute left-3 top-2.5 h-4 w-4 text-green-500" />
                <input value={feat} onChange={e => handleFeatureChange(i, e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="e.g. Unlimited Access" />
              </div>
              <button type="button" onClick={() => removeFeature(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
            </div>
          ))}
          <button type="button" onClick={addFeature} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded"><Plus size={14} /> Add Feature</button>
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase">Public Description</label>
          <span className="text-[10px] text-gray-400">Visible to members in the app</span>
        </div>
        <textarea
          rows="2"
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Includes access to all Jiu Jitsu and Muay Thai classes..."
        />
      </div>

      {/* Trial Logic */}
      <div className={`p-4 rounded-xl border transition-all ${formData.hasTrial ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Clock className={`h-5 w-5 ${formData.hasTrial ? 'text-blue-600' : 'text-gray-400'}`} />
            <div>
              <p className={`text-sm font-bold ${formData.hasTrial ? 'text-blue-900' : 'text-gray-600'}`}>Include Free Trial</p>
            </div>
          </div>
          <button type="button" onClick={() => setFormData(p => ({ ...p, hasTrial: !p.hasTrial }))} className={`w-11 h-6 rounded-full relative transition-colors ${formData.hasTrial ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.hasTrial ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        {formData.hasTrial && (
          <div className="mt-4 pt-4 border-t border-blue-100">
            <label className="block text-xs font-semibold text-blue-700 mb-1 uppercase">Trial Duration (Days)</label>
            <input type="number" min="1" value={formData.trialDays} onChange={e => setFormData({ ...formData, trialDays: e.target.value })} className="w-full p-2 border border-blue-200 rounded-lg text-blue-900 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      <div className="pt-6 mt-4 border-t border-gray-100 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors shadow-sm">{loading ? 'Saving...' : (tierData ? 'Update Plan' : 'Create Plan')}</button>
      </div>
    </form>
  );
};

export default RecurringForm;