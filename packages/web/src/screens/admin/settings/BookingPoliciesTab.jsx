import React, { useState, useEffect } from 'react';
import { Save, CalendarClock, LogIn, CheckSquare, Square, Info, DollarSign } from 'lucide-react';
import { updateGymDetails } from '../../../../../shared/api/firestore';

export const BookingPoliciesTab = ({ gymId, initialData, showMessage }) => {
  const [loading, setLoading] = useState(false);
  
  const [activeRules, setActiveRules] = useState({
    booking: true,
    cancel: true,
    checkIn: true,
    fee: true // NEW: Fee Toggle
  });

  const [formData, setFormData] = useState({
    bookingWindowDays: '',
    cancelWindowHours: '',
    checkInWindowMinutes: '',
    lateCancelFee: '', // NEW: Fee Amount
  });

  // Initialize Data
  useEffect(() => {
    setFormData({
      bookingWindowDays: initialData?.bookingWindowDays ?? 7,
      cancelWindowHours: initialData?.cancelWindowHours ?? 2,
      checkInWindowMinutes: initialData?.checkInWindowMinutes ?? 60,
      lateCancelFee: initialData?.lateCancelFee ?? 0,
    });

    setActiveRules({
      booking: initialData?.bookingWindowDays !== null && initialData?.bookingWindowDays !== undefined,
      cancel: initialData?.cancelWindowHours !== null && initialData?.cancelWindowHours !== undefined,
      checkIn: initialData?.checkInWindowMinutes !== null && initialData?.checkInWindowMinutes !== undefined,
      fee: initialData?.lateCancelFee !== null && initialData?.lateCancelFee !== undefined && initialData?.lateCancelFee > 0,
    });
  }, [initialData]);

  const handleSave = async () => {
    setLoading(true);
    
    const payload = {
      booking: {
        bookingWindowDays: activeRules.booking ? (parseInt(formData.bookingWindowDays) || 7) : null,
        cancelWindowHours: activeRules.cancel ? (parseInt(formData.cancelWindowHours) || 0) : null,
        checkInWindowMinutes: activeRules.checkIn ? (parseInt(formData.checkInWindowMinutes) || 60) : null,
        lateCancelFee: activeRules.fee ? (parseFloat(formData.lateCancelFee) || 0) : 0, // 0 means free
      }
    };

    const result = await updateGymDetails(gymId, payload);

    setLoading(false);
    if (result.success) {
      showMessage('success', 'Booking policies updated successfully.');
    } else {
      showMessage('error', 'Failed to save policies.');
    }
  };

  const handleNumberChange = (field, value) => {
    const val = parseFloat(value);
    if (val < 0) return; 
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleRule = (rule) => {
    setActiveRules(prev => ({ ...prev, [rule]: !prev[rule] }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Booking Rules Section */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Global Booking Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* 1. Booking Window */}
          <div>
            <div className="flex justify-between items-center mb-1">
                <div>
                    <label className="text-sm font-medium text-gray-700">Booking Window</label>
                    <p className="text-xs text-gray-500">When can students start booking?</p>
                </div>
                <button type="button" onClick={() => toggleRule('booking')} className="text-xs text-blue-600 hover:underline">
                    {activeRules.booking ? 'Restrict' : 'Unlimited'}
                </button>
            </div>
            
            <div className="flex items-center gap-3 mt-2">
                <button 
                    onClick={() => toggleRule('booking')} 
                    className={`p-2 rounded-md border transition-colors ${activeRules.booking ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-300 border-gray-200'}`}
                >
                    {activeRules.booking ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
                
                {activeRules.booking ? (
                    <div className="flex-1 relative">
                        <input
                            type="number"
                            min="1" max="365"
                            value={formData.bookingWindowDays}
                            onChange={(e) => handleNumberChange('bookingWindowDays', e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-gray-500 text-sm">days out</span>
                    </div>
                ) : (
                    <div className="flex-1 bg-green-50 text-green-700 text-sm py-2.5 px-3 rounded-lg border border-green-200 flex items-center gap-2">
                        <Info size={16} /> Open indefinitely.
                    </div>
                )}
            </div>
          </div>

          {/* 2. Cancellation Deadline */}
          <div>
            <div className="flex justify-between items-center mb-1">
                <div>
                    <label className="text-sm font-medium text-gray-700">Cancellation Deadline</label>
                    <p className="text-xs text-gray-500">When is it too late to cancel?</p>
                </div>
                <button type="button" onClick={() => toggleRule('cancel')} className="text-xs text-blue-600 hover:underline">
                    {activeRules.cancel ? 'Restrict' : 'Anytime'}
                </button>
            </div>

            <div className="flex items-center gap-3 mt-2">
                <button 
                    onClick={() => toggleRule('cancel')} 
                    className={`p-2 rounded-md border transition-colors ${activeRules.cancel ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-300 border-gray-200'}`}
                >
                    {activeRules.cancel ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                {activeRules.cancel ? (
                    <div className="flex-1 relative">
                        <input
                            type="number"
                            min="0" max="48"
                            value={formData.cancelWindowHours}
                            onChange={(e) => handleNumberChange('cancelWindowHours', e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-gray-500 text-sm">hours before</span>
                    </div>
                ) : (
                    <div className="flex-1 bg-green-50 text-green-700 text-sm py-2.5 px-3 rounded-lg border border-green-200 flex items-center gap-2">
                        <Info size={16} /> Cancel anytime.
                    </div>
                )}
            </div>
          </div>

          {/* 3. Late Cancel Fee (NEW) */}
          <div>
            <div className="flex justify-between items-center mb-1">
                <div>
                    <label className="text-sm font-medium text-gray-700">Late Cancel Fee</label>
                    <p className="text-xs text-gray-500">Charge for cancelling past deadline?</p>
                </div>
                <button type="button" onClick={() => toggleRule('fee')} className="text-xs text-blue-600 hover:underline">
                    {activeRules.fee ? 'Charge' : 'Free'}
                </button>
            </div>

            <div className="flex items-center gap-3 mt-2">
                <button 
                    onClick={() => toggleRule('fee')} 
                    className={`p-2 rounded-md border transition-colors ${activeRules.fee ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-300 border-gray-200'}`}
                >
                    {activeRules.fee ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                {activeRules.fee ? (
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                        <input
                            type="number"
                            min="0"
                            value={formData.lateCancelFee}
                            onChange={(e) => handleNumberChange('lateCancelFee', e.target.value)}
                            className="w-full pl-7 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                ) : (
                    <div className="flex-1 bg-green-50 text-green-700 text-sm py-2.5 px-3 rounded-lg border border-green-200 flex items-center gap-2">
                        <Info size={16} /> No fee charged.
                    </div>
                )}
            </div>
          </div>

        </div>
      </div>

      {/* Check-in Rules Section */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
          <LogIn className="h-4 w-4" /> Global Check-in Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex justify-between items-center mb-1">
                <div>
                    <label className="text-sm font-medium text-gray-700">Check-in Opens</label>
                    <p className="text-xs text-gray-500">How early can a student check in?</p>
                </div>
                <button type="button" onClick={() => toggleRule('checkIn')} className="text-xs text-blue-600 hover:underline">
                    {activeRules.checkIn ? 'Restrict' : 'All Day'}
                </button>
            </div>

            <div className="flex items-center gap-3 mt-2">
                <button 
                    onClick={() => toggleRule('checkIn')} 
                    className={`p-2 rounded-md border transition-colors ${activeRules.checkIn ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-300 border-gray-200'}`}
                >
                    {activeRules.checkIn ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                {activeRules.checkIn ? (
                    <div className="flex-1 relative">
                        <input
                            type="number"
                            min="5" max="120"
                            value={formData.checkInWindowMinutes}
                            onChange={(e) => handleNumberChange('checkInWindowMinutes', e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-2.5 text-gray-500 text-sm">mins before start</span>
                    </div>
                ) : (
                    <div className="flex-1 bg-green-50 text-green-700 text-sm py-2.5 px-3 rounded-lg border border-green-200 flex items-center gap-2">
                        <Info size={16} /> Anytime on class day.
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Policies'}
        </button>
      </div>
    </div>
  );
};