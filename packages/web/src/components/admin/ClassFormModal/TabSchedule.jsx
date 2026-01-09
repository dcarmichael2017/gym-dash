import React from 'react';
import { Clock, User, RefreshCw, Calendar, Info } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FREQUENCIES = ["Weekly", "Bi-Weekly", "Every Three Weeks", "Once a Month", "Single Event"];

export const TabSchedule = ({ formData, setFormData, staffList, toggleDay }) => {

    const isSingleEvent = formData.frequency === 'Single Event';
    const isEnded = !!formData.recurrenceEndDate;

    return (
        <div className="space-y-5 animate-in slide-in-from-right-4 duration-200">
             {isEnded && (
                <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm flex items-center gap-3">
                    <Info size={18} className="shrink-0" />
                    <div>
                        <p className="font-bold">This class series has ended.</p>
                        <p className="text-xs">This is a historical record. To restart it, create a new class.</p>
                    </div>
                </div>
            )}
            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Class Name</label>
                <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Morning Jiu Jitsu"
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Start Time</label>
                    <div className="relative">
                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Duration (min)</label>
                    <input type="number" required min="15" step="15" value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Instructor</label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select value={formData.instructorId} onChange={e => setFormData({ ...formData, instructorId: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white">
                            <option value="">No Instructor</option>
                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
                {/* 2. Frequency Dropdown */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Frequency</label>
                    <div className="relative">
                        <RefreshCw className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select 
                            value={formData.frequency} 
                            onChange={e => {
                                const newFreq = e.target.value;
                                // Clear days if switching to Single, clear startDate if switching back
                                setFormData({ 
                                    ...formData, 
                                    frequency: newFreq,
                                    days: newFreq === 'Single Event' ? [] : formData.days,
                                    startDate: newFreq === 'Single Event' ? new Date().toISOString().split('T')[0] : ''
                                });
                            }} 
                            className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white"
                        >
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* 3. Conditional Rendering: Days vs Date Picker */}
            {isSingleEvent ? (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Event Date</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input 
                            type="date" 
                            required 
                            value={formData.startDate || ''} 
                            onChange={e => setFormData({ ...formData, startDate: e.target.value })} 
                            className="w-full pl-9 p-2.5 border border-blue-300 bg-blue-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 font-medium" 
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">This class will occur exactly once on this date.</p>
                </div>
            ) : (
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">Repeats On</label>
                    <div className="flex flex-wrap gap-2">
                        {DAYS.map(day => (
                            <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${formData.days.includes(day) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                                {day.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
