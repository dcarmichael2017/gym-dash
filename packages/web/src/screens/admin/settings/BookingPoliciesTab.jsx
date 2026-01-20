import React, { useState, useEffect } from 'react';
import { Save, CalendarClock, LogIn, CheckSquare, Square, Info, DollarSign, AlertCircle, ChevronDown } from 'lucide-react';
import { updateGymDetails } from '../../../../../shared/api/firestore';

export const BookingPoliciesTab = ({ gymId, initialData, showMessage, onUpdate, theme }) => {
  const primaryColor = theme?.primaryColor || '#2563eb';
  const [loading, setLoading] = useState(false);
  
  const [activeRules, setActiveRules] = useState({
    booking: true,
    cancel: true,
    checkIn: true,
    fee: true 
  });

  const [formData, setFormData] = useState({
    bookingWindowDays: '',
    cancelWindowHours: '',
    checkInWindowMinutes: '',
    lateCancelFee: '', 
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
      cancel: initialData?.cancelWindowHours !== null && initialData?.cancelWindowHours !== undefined && initialData?.cancelWindowHours !== 0,
      checkIn: initialData?.checkInWindowMinutes !== null && initialData?.checkInWindowMinutes !== undefined,
      fee: initialData?.lateCancelFee !== null && initialData?.lateCancelFee !== undefined && initialData?.lateCancelFee > 0,
    });
  }, [initialData]);

  const handleSave = async () => {
    setLoading(true);
    
    const payload = {
      booking: {
        bookingWindowDays: activeRules.booking ? (parseInt(formData.bookingWindowDays) || 7) : null,
        cancelWindowHours: activeRules.cancel ? (parseFloat(formData.cancelWindowHours) || 0) : 0,
        checkInWindowMinutes: activeRules.checkIn ? (parseInt(formData.checkInWindowMinutes) || 60) : null,
        lateCancelFee: activeRules.fee ? (parseFloat(formData.lateCancelFee) || 0) : 0, 
      }
    };

    const result = await updateGymDetails(gymId, payload);

    setLoading(false);
    if (result.success) {
      showMessage('success', 'Booking policies updated successfully.');
      if (onUpdate) onUpdate(); 
    } else {
      showMessage('error', 'Failed to save policies.');
    }
  };

  const handleNumberChange = (field, value) => {
    const val = parseFloat(value);
    if (val < 0) return; 
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ✅ SPECIAL HANDLER FOR CANCELLATION DROPDOWN
  const handleCancelDropdownChange = (e) => {
    const val = parseFloat(e.target.value);
    
    if (val === 0) {
        // If user selects "Until Class Starts" from dropdown, turn OFF the rule
        setActiveRules(prev => ({ ...prev, cancel: false }));
        setFormData(prev => ({ ...prev, cancelWindowHours: 0 }));
    } else {
        // Otherwise update the value normally
        setFormData(prev => ({ ...prev, cancelWindowHours: val }));
    }
  };

  // ✅ SMART TOGGLE LOGIC
  const toggleRule = (rule) => {
    setActiveRules(prev => {
        const newState = !prev[rule];

        // If we are turning ON the cancellation rule, and the value is currently 0,
        // default it to 2 hours so it doesn't stay "0" (which implies off).
        if (rule === 'cancel' && newState === true && parseFloat(formData.cancelWindowHours) === 0) {
            setFormData(fd => ({ ...fd, cancelWindowHours: 2 }));
        }

        return { ...prev, [rule]: newState };
    });
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
                    {activeRules.cancel ? 'Restrict' : 'Until Start'}
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
                        <select 
                            value={formData.cancelWindowHours} 
                            onChange={handleCancelDropdownChange} // ✅ Using custom handler
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                        >
                            <option value="0">Until Class Starts (0 min)</option> {/* ✅ Added Option */}
                            <option value="0.25">15 Minutes</option>
                            <option value="0.5">30 Minutes</option>
                            <option value="1">1 Hour</option>
                            <option value="2">2 Hours</option>
                            <option value="3">3 Hours</option>
                            <option value="6">6 Hours</option>
                            <option value="12">12 Hours</option>
                            <option value="24">24 Hours</option>
                            <option value="48">48 Hours</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16} />
                    </div>
                ) : (
                    <div className="flex-1 bg-green-50 text-green-700 text-sm py-2.5 px-3 rounded-lg border border-green-200 flex items-center gap-2">
                        <Info size={16} /> Until class starts.
                    </div>
                )}
            </div>
          </div>

          {/* 3. Late Cancel Fee */}
          <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-6">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                         Late Cancel Penalty (Monetary)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                        Charge the member's card on file if they cancel past the deadline.
                    </p>
                </div>
                <button type="button" onClick={() => toggleRule('fee')} className="text-xs text-blue-600 hover:underline">
                    {activeRules.fee ? 'Active' : 'Disabled'}
                </button>
            </div>

            <div className="flex items-start gap-3 mt-3">
                <button 
                    onClick={() => toggleRule('fee')} 
                    className={`p-2 rounded-md border transition-colors mt-1 ${activeRules.fee ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-300 border-gray-200'}`}
                >
                    {activeRules.fee ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                <div className="flex-1">
                    {activeRules.fee ? (
                        <div className="space-y-3">
                            <div className="relative max-w-xs">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.50"
                                    placeholder="0.00"
                                    value={formData.lateCancelFee}
                                    onChange={(e) => handleNumberChange('lateCancelFee', e.target.value)}
                                    className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-medium text-gray-900"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">USD</span>
                                </div>
                            </div>
                            <div className="flex gap-2 p-3 bg-yellow-50 text-yellow-800 text-xs rounded-lg border border-yellow-100">
                                <AlertCircle size={16} className="shrink-0" />
                                <p>
                                    <strong>Warning:</strong> This will attempt to charge the member's default payment method. 
                                    If no payment method is on file, the cancellation may fail or create a balance due.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 text-gray-600 text-sm py-2.5 px-3 rounded-lg border border-gray-200 flex items-center gap-2">
                            <Info size={16} /> 
                            No monetary fee. Members will only lose their class credit (if applicable).
                        </div>
                    )}
                </div>
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
          className="flex items-center px-6 py-2 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Policies'}
        </button>
      </div>
    </div>
  );
};