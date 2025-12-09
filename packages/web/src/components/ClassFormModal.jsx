import React, { useState, useEffect } from 'react';
import { 
  X, Clock, Calendar as CalendarIcon, User, RefreshCw, 
  DollarSign, CheckSquare, Square, Shield, Info, AlertTriangle // Added AlertTriangle
} from 'lucide-react';
import { createClass, updateClass } from '../../../shared/api/firestore';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FREQUENCIES = ["Weekly", "Bi-Weekly", "Every Three Weeks", "Once a Month"];

export const ClassFormModal = ({ isOpen, onClose, gymId, classData, staffList, membershipList = [], onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    time: '09:00',
    duration: 60,
    days: [],
    instructorId: '',
    frequency: 'Weekly',
    dropInEnabled: true,
    dropInPrice: 20,
    allowedMembershipIds: []
  });
  const [loading, setLoading] = useState(false);

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (classData) {
        setFormData({
          name: classData.name || '',
          time: classData.time || '09:00',
          duration: classData.duration || 60,
          days: classData.days || [],
          instructorId: classData.instructorId || '',
          frequency: classData.frequency || 'Weekly',
          dropInEnabled: classData.dropInEnabled !== undefined ? classData.dropInEnabled : true,
          dropInPrice: classData.dropInPrice !== undefined ? classData.dropInPrice : 20,
          allowedMembershipIds: classData.allowedMembershipIds || [] 
        });
      } else {
        // Smart Defaults
        const hasMemberships = membershipList && membershipList.length > 0;
        setFormData({
          name: '',
          time: '09:00',
          duration: 60,
          days: [],
          instructorId: '',
          frequency: 'Weekly',
          // If no memberships exist, we MUST enable drop-ins, otherwise the class is broken by default
          dropInEnabled: !hasMemberships, 
          dropInPrice: 20,
          // If memberships exist, pre-select them all
          allowedMembershipIds: hasMemberships ? membershipList.map(m => m.id) : [] 
        });
      }
    }
  }, [isOpen, classData, membershipList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.days.length === 0) {
      alert("Please enter a name and select at least one day.");
      return;
    }

    setLoading(true);
    
    // Ensure numbers are numbers before saving
    const cleanData = {
        ...formData,
        dropInPrice: parseFloat(formData.dropInPrice) || 0,
        duration: parseInt(formData.duration) || 60
    };

    let result;
    if (classData) {
      result = await updateClass(gymId, classData.id, cleanData);
    } else {
      result = await createClass(gymId, cleanData);
    }

    setLoading(false);

    if (result.success) {
      onSave();
      onClose();
    } else {
      alert("Failed to save class: " + result.error);
    }
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day) 
        ? prev.days.filter(d => d !== day) 
        : [...prev.days, day]
    }));
  };

  const toggleMembership = (id) => {
    setFormData(prev => {
      const current = prev.allowedMembershipIds || [];
      return {
        ...prev,
        allowedMembershipIds: current.includes(id)
          ? current.filter(m => m !== id)
          : [...current, id]
      };
    });
  };

  const toggleAllMemberships = () => {
    setFormData(prev => ({
      ...prev,
      allowedMembershipIds: prev.allowedMembershipIds.length === membershipList.length 
        ? [] 
        : membershipList.map(m => m.id)
    }));
  };

  // --- Logic Checks ---
  const isFreeClass = formData.dropInEnabled && parseFloat(formData.dropInPrice) === 0;
  
  // Is this class effectively closed? (No Drop-in AND No Memberships selected)
  const isUnbookable = !formData.dropInEnabled && formData.allowedMembershipIds.length === 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="font-bold text-lg text-gray-800">
            {classData ? 'Edit Class' : 'Add New Class'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          <form id="classForm" onSubmit={handleSubmit} className="space-y-6">
            
            {/* SECTION 1: DETAILS */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1">Class Details</h4>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Class Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Morning Jiu Jitsu"
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* ... Time, Duration, Instructor, Frequency, Days inputs remain the same ... */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Start Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="time" 
                      required
                      value={formData.time}
                      onChange={e => setFormData({...formData, time: e.target.value})}
                      className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Duration (min)</label>
                  <input 
                    type="number" 
                    required
                    min="15" step="15"
                    value={formData.duration}
                    onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Instructor</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <select
                      value={formData.instructorId}
                      onChange={e => setFormData({...formData, instructorId: e.target.value})}
                      className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">No Instructor</option>
                      {staffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Frequency</label>
                  <div className="relative">
                    <RefreshCw className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <select
                      value={formData.frequency}
                      onChange={e => setFormData({...formData, frequency: e.target.value})}
                      className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">Repeats On</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        formData.days.includes(day)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {day.slice(0,3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 2: ACCESS & PRICING */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1 flex items-center gap-2">
                 <Shield className="h-3 w-3" /> Access & Pricing
              </h4>
              
              {/* WARNING FOR UNBOOKABLE CLASS */}
              {isUnbookable && (
                 <div className="flex items-start gap-3 bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 text-sm animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-bold">Warning: Class Unbookable</p>
                        <p className="text-xs mt-1">
                            You have disabled Drop-ins and selected no memberships. This class will appear on the schedule but <b>no one will be able to book it</b>.
                        </p>
                    </div>
                 </div>
              )}

              {/* Drop In Logic */}
              <div className={`flex flex-col bg-gray-50 p-3 rounded-lg border transition-colors ${isFreeClass ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md shadow-sm ${isFreeClass ? 'bg-white text-green-600' : 'bg-white text-gray-600'}`}>
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">Allow Drop-ins</p>
                            <p className="text-xs text-gray-500">Non-members can book this class</p>
                        </div>
                    </div>
                    
                    <button 
                        type="button"
                        onClick={() => setFormData(p => ({...p, dropInEnabled: !p.dropInEnabled}))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${formData.dropInEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.dropInEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                </div>

                {/* Price Input & Free Message */}
                {formData.dropInEnabled && (
                    <div className="ml-12 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="relative w-32">
                                <span className="absolute left-3 top-1.5 text-gray-500 text-sm">$</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={formData.dropInPrice}
                                    onChange={e => setFormData({...formData, dropInPrice: e.target.value})}
                                    className="w-full pl-6 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            {isFreeClass && (
                                <div className="flex items-center text-green-700 text-xs font-medium bg-green-100 px-2 py-1 rounded-md">
                                    <Info className="h-3 w-3 mr-1" />
                                    <span>Free Class</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
              </div>

              {/* Membership Logic */}
              {membershipList.length > 0 ? (
                <div>
                   <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Included in Plans</label>
                      <button type="button" onClick={toggleAllMemberships} className="text-xs text-blue-600 hover:underline">
                        Toggle All
                      </button>
                   </div>
                   <div className="space-y-2">
                      {membershipList.map(plan => {
                         const isSelected = formData.allowedMembershipIds.includes(plan.id);
                         return (
                           <div 
                              key={plan.id} 
                              onClick={() => toggleMembership(plan.id)}
                              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                           >
                              <span className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>
                                {plan.name}
                              </span>
                              {isSelected ? 
                                <CheckSquare className="h-5 w-5 text-blue-600" /> : 
                                <Square className="h-5 w-5 text-gray-300" />
                              }
                           </div>
                         )
                      })}
                   </div>
                </div>
              ) : (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800 text-xs flex items-start gap-2">
                   <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                   <p>No membership plans found. Currently, access to this class is controlled entirely by the <b>Drop-in settings</b> above. Create a membership in your dashboard to change that!</p>
                </div>
              )}
            </div>
            
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="classForm"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Saving...' : (classData ? 'Save Changes' : 'Create Class')}
          </button>
        </div>

      </div>
    </div>
  );
};