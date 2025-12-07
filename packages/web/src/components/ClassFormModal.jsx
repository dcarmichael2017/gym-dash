import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar as CalendarIcon, User, RefreshCw } from 'lucide-react';
import { createClass, updateClass } from '../../../shared/api/firestore';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FREQUENCIES = ["Weekly", "Bi-Weekly", "Every Three Weeks", "Once a Month"];

export const ClassFormModal = ({ isOpen, onClose, gymId, classData, staffList, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    time: '09:00',
    duration: 60,
    days: [],
    instructorId: '',
    frequency: 'Weekly'
  });
  const [loading, setLoading] = useState(false);

  // Initialize form when modal opens or classData changes (Edit Mode)
  useEffect(() => {
    if (isOpen) {
      if (classData) {
        setFormData({
          name: classData.name || '',
          time: classData.time || '09:00',
          duration: classData.duration || 60,
          days: classData.days || [],
          instructorId: classData.instructorId || '',
          frequency: classData.frequency || 'Weekly'
        });
      } else {
        // Reset for Add Mode
        setFormData({
          name: '',
          time: '09:00',
          duration: 60,
          days: [],
          instructorId: '',
          frequency: 'Weekly'
        });
      }
    }
  }, [isOpen, classData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.days.length === 0) {
      alert("Please enter a name and select at least one day.");
      return;
    }

    setLoading(true);
    let result;

    if (classData) {
      // Edit Mode
      result = await updateClass(gymId, classData.id, formData);
    } else {
      // Create Mode
      // Add instructorName denormalization if needed, currently relying on ID lookup
      result = await createClass(gymId, formData);
    }

    setLoading(false);

    if (result.success) {
      onSave(); // Refresh parent list
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">
            {classData ? 'Edit Class' : 'Add New Class'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Class Name */}
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

          {/* Time & Duration */}
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

          {/* Instructor & Frequency */}
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

          {/* Days Selector */}
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

          {/* Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-50">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Saving...' : (classData ? 'Save Changes' : 'Create Class')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};