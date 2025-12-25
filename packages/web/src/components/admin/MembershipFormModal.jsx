import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, CheckCircle2, AlertCircle, Coins 
} from 'lucide-react';
// FIX: Removed one "../" because this file is in src/components/
import { createMembershipTier, updateMembershipTier } from '../../../../shared/api/firestore';

export const MembershipFormModal = ({ isOpen, onClose, gymId, tierData, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    interval: 'month',
    initiationFee: '',
    description: '',
    hasTrial: false,
    trialDays: 7
  });
  const [loading, setLoading] = useState(false);

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (tierData) {
        // Edit Mode
        setFormData({
          name: tierData.name || '',
          price: tierData.price || '',
          interval: tierData.interval || 'month',
          initiationFee: tierData.initiationFee || '',
          description: tierData.description || '',
          hasTrial: tierData.hasTrial || false,
          trialDays: tierData.trialDays || 7
        });
      } else {
        // Create Mode
        setFormData({
          name: '',
          price: '',
          interval: 'month',
          initiationFee: '', 
          description: '',
          hasTrial: false,
          trialDays: 7
        });
      }
    }
  }, [isOpen, tierData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;

    setLoading(true);

    const cleanData = {
      ...formData,
      price: parseFloat(formData.price),
      initiationFee: parseFloat(formData.initiationFee) || 0,
      trialDays: formData.hasTrial ? (parseInt(formData.trialDays) || 7) : null
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
      alert("Failed to save plan: " + result.error);
    }
  };

  const toggleTrial = () => {
    setFormData(prev => ({
      ...prev,
      hasTrial: !prev.hasTrial,
      interval: (!prev.hasTrial && prev.interval === 'one_time') ? 'month' : prev.interval
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="font-bold text-lg text-gray-800">
            {tierData ? 'Edit Plan' : 'New Membership Plan'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto p-6">
          <form id="membershipForm" onSubmit={handleSubmit} className="space-y-5">
            
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Plan Name</label>
              <input 
                required
                placeholder="e.g. Gold Unlimited"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Price & Interval */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Price ($)</label>
                 <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                    <input 
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: e.target.value})}
                      className="w-full pl-7 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Billing Interval</label>
                 <div className="relative">
                   <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                   <select 
                    value={formData.interval}
                    onChange={e => setFormData({...formData, interval: e.target.value, hasTrial: e.target.value === 'one_time' ? false : formData.hasTrial})}
                    className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                    <option value="one_time">One Time Payment</option>
                  </select>
                 </div>
              </div>
            </div>

            {/* Initiation Fee */}
            <div>
               <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Signup / Initiation Fee (Optional)</label>
               <div className="relative">
                  <Coins className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.initiationFee}
                    onChange={e => setFormData({...formData, initiationFee: e.target.value})}
                    className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>
               
               {/* DYNAMIC HELP TEXT */}
               <p className={`text-[10px] mt-1 transition-colors ${formData.hasTrial ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                 {formData.hasTrial 
                    ? `This fee is charged automatically after the ${formData.trialDays || 7}-day trial ends.` 
                    : "Charged immediately upon signup."}
               </p>
            </div>

            {/* Trial Logic */}
            <div className={`p-4 rounded-xl border transition-all ${formData.hasTrial ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className={`p-2 rounded-lg ${formData.hasTrial ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                      <Clock className="h-5 w-5" />
                   </div>
                   <div>
                      <p className={`text-sm font-bold ${formData.hasTrial ? 'text-blue-900' : 'text-gray-600'}`}>Include Free Trial</p>
                      <p className="text-xs text-gray-500">Let users try before they are charged</p>
                   </div>
                </div>
                
                <button 
                  type="button"
                  onClick={toggleTrial}
                  disabled={formData.interval === 'one_time'}
                  className={`w-11 h-6 rounded-full transition-colors relative ${formData.hasTrial ? 'bg-blue-600' : 'bg-gray-300'} ${formData.interval === 'one_time' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.hasTrial ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {formData.hasTrial && (
                <div className="mt-4 pt-4 border-t border-blue-100 animate-in fade-in slide-in-from-top-2">
                   <label className="block text-xs font-semibold text-blue-700 mb-1 uppercase">Trial Duration (Days)</label>
                   <input 
                      type="number"
                      min="1"
                      value={formData.trialDays}
                      onChange={e => setFormData({...formData, trialDays: e.target.value})}
                      className="w-full p-2 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 bg-white"
                   />
                   <p className="text-xs text-blue-600 mt-2 flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Customer will be charged automatically on day {parseInt(formData.trialDays || 0) + 1}.
                   </p>
                </div>
              )}
              
              {formData.interval === 'one_time' && (
                 <div className="mt-2 text-xs text-gray-500 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Trials are not available for one-time payments.
                 </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Description</label>
              <textarea 
                rows="3"
                placeholder="What's included in this plan?"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
          <button 
            type="submit" 
            form="membershipForm"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      </div>
    </div>
  );
};