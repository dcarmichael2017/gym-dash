import React, { useState, useEffect } from 'react';
import { Ticket, Plus, Trash2, Check, Globe, Users, Lock, Coins } from 'lucide-react';
import { createMembershipTier, updateMembershipTier } from '../../../../../../packages/shared/api/firestore';

const ClassPackForm = ({ gymId, tierData, onSave, onClose, theme }) => {
  const primaryColor = theme?.primaryColor || '#2563eb';
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    interval: 'one_time',
    description: '',
    visibility: 'public',
    credits: '', 
    validityDays: '',
    features: ['Access to all classes']
  });

  useEffect(() => {
    if (tierData) {
      setFormData({
        name: tierData.name || '',
        price: tierData.price || '',
        interval: 'one_time',
        description: tierData.description || '',
        visibility: tierData.visibility || 'public',
        credits: tierData.credits || '', 
        validityDays: tierData.validityDays || '',
        features: tierData.features || []
      });
    }
  }, [tierData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.credits) return;

    setLoading(true);

    const cleanData = {
      ...formData,
      price: parseFloat(formData.price),
      credits: parseInt(formData.credits),
      validityDays: formData.validityDays ? parseInt(formData.validityDays) : null,
      features: formData.features.filter(f => f.trim() !== '')
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
      className={`flex-1 p-3 rounded-xl border text-left transition-all ${formData.visibility === value ? 'ring-1' : 'bg-white border-gray-200 hover:border-gray-300'}`}
      style={formData.visibility === value ? { backgroundColor: `${primaryColor}10`, borderColor: primaryColor, ringColor: primaryColor } : {}}
    >
      <div className="mb-1" style={{ color: formData.visibility === value ? primaryColor : '#9ca3af' }}>
        <Icon size={20} />
      </div>
      <div className="text-xs font-bold uppercase" style={{ color: formData.visibility === value ? primaryColor : '#4b5563' }}>
        {label}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
        {desc}
      </div>
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Info Banner */}
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-start gap-3 mb-4">
            <Ticket className="text-orange-600 mt-1 shrink-0" size={20} />
            <div>
                <h4 className="font-bold text-orange-900 text-sm">Class Pack Mode</h4>
                <p className="text-xs text-orange-700 mt-1">
                    Creates a one-time purchase that adds finite credits to a member's account. Good for drop-ins or punch cards.
                </p>
            </div>
        </div>

        {/* Name */}
        <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Pack Name</label>
            <input required placeholder="e.g. 10 Class Pass" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Price & Credits */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Price ($)</label>
                <input required type="number" min="0" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Credits</label>
                <div className="relative">
                    <Coins className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input required type="number" min="1" placeholder="10" value={formData.credits} onChange={e => setFormData({...formData, credits: e.target.value})} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>
        </div>

        {/* Expiration */}
        <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Expires After (Days)</label>
            <input type="number" min="1" placeholder="Optional (e.g. 90)" value={formData.validityDays} onChange={e => setFormData({...formData, validityDays: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-gray-400 mt-1">Leave blank if credits never expire.</p>
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
                            <input value={feat} onChange={e => handleFeatureChange(i, e.target.value)} className="w-full pl-9 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" />
                        </div>
                        <button type="button" onClick={() => removeFeature(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                ))}
                <button type="button" onClick={addFeature} className="text-xs font-bold flex items-center gap-1 hover:opacity-80 px-2 py-1 rounded" style={{ color: primaryColor }}><Plus size={14} /> Add Perk</button>
            </div>
        </div>

        {/* Description */}
        <div>
            <div className="flex justify-between items-baseline mb-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Public Description</label>
                <span className="text-[10px] text-gray-400">Visible to members in the app</span>
            </div>
            <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Valid for any Muay Thai class..." />
        </div>

        <div className="pt-6 mt-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50 transition-colors shadow-sm" style={{ backgroundColor: primaryColor }}>{loading ? 'Saving...' : (tierData ? 'Update Pack' : 'Create Pack')}</button>
        </div>
    </form>
  );
};

export default ClassPackForm;