import React from 'react';
import { Settings, Medal, CheckSquare, Square, Eye, Users, Lock, Globe, DollarSign, AlertCircle, Info, ChevronDown } from 'lucide-react'; // Added ChevronDown

export const TabSettings = ({
    formData,
    setFormData,
    rankSystems,
    activeRules,
    toggleRule,
    handleNumberChange
}) => {

    // ... VisibilityOption component remains the same ...
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
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">

            {/* ... Visibility and Rank sections remain the same ... */}
            
            {/* 1. VISIBILITY SETTINGS */}
            <div className="space-y-2">
                <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-500" /> Class Visibility
                </label>
                <div className="flex gap-2">
                    <VisibilityOption value="public" label="Public" icon={Globe} desc="Everyone" />
                    <VisibilityOption value="staff" label="Internal" icon={Users} desc="Staff/Admins" />
                    <VisibilityOption value="admin" label="Hidden" icon={Lock} desc="Owners Only" />
                </div>
            </div>

            <div className="border-t border-gray-100"></div>

            {/* 2. Rank Tracking */}
            <div className="space-y-2">
                <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Medal className="h-4 w-4 text-indigo-500" /> Attendance Tracking
                </label>
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
                    {rankSystems.length === 0 ? (
                        <p className="text-sm text-indigo-700">No rank systems created yet.</p>
                    ) : (
                        <div>
                            <label className="block text-xs font-semibold text-indigo-700 mb-1">Count towards Program</label>
                            <select value={formData.programId} onChange={(e) => setFormData({ ...formData, programId: e.target.value })} className="w-full p-2.5 border border-indigo-200 rounded-lg bg-white text-sm">
                                <option value="">-- Do Not Track Progression --</option>
                                {rankSystems.map(prog => <option key={prog.id} value={prog.id}>{prog.name}</option>)}
                            </select>
                            <p className="text-xs text-indigo-500 mt-2">Checking in to this class will add attendance to this program.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-gray-100"></div>

            {/* 3. Booking Rules Override */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-gray-500" /> Booking Rules
                        </label>
                        <p className="text-xs text-gray-400">Override gym defaults for this specific class.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, useCustomRules: !p.useCustomRules }))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${formData.useCustomRules ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.useCustomRules ? 'translate-x-5' : ''}`} />
                    </button>
                </div>

                {/* Rules Inputs */}
                <div className={`space-y-5 transition-opacity ${formData.useCustomRules ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    
                    {/* Booking Window */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center"><button type="button" onClick={() => toggleRule('booking')} className="text-blue-600 hover:text-blue-800">{activeRules.booking ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500">Booking Window (Days)</label>
                            {activeRules.booking ? (
                                <input type="number" min="1" value={formData.bookingWindowDays} onChange={e => handleNumberChange('bookingWindowDays', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="7" />
                            ) : <div className="text-xs text-green-600 py-2">Unlimited</div>}
                        </div>
                    </div>

                    {/* Cancel Deadline - STREAMLINED DROPDOWN */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center"><button type="button" onClick={() => toggleRule('cancel')} className="text-blue-600 hover:text-blue-800">{activeRules.cancel ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500">Cancel Deadline</label>
                            {activeRules.cancel ? (
                                <div className="relative">
                                    <select 
                                        value={formData.cancelWindowHours} 
                                        onChange={e => handleNumberChange('cancelWindowHours', e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded text-sm appearance-none bg-white"
                                    >
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
                                    <ChevronDown className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            ) : (
                                <div className="text-xs text-green-600 py-2">Until Class Starts</div>
                            )}
                        </div>
                    </div>

                    {/* Late Cancel Fee */}
                    <div className="flex items-start gap-3">
                        <div className="w-8 flex justify-center mt-1">
                            <button type="button" onClick={() => toggleRule('fee')} className="text-blue-600 hover:text-blue-800">
                                {activeRules.fee ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Late Cancel Penalty (Monetary)</label>
                            {activeRules.fee ? (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                            <DollarSign size={14} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.50"
                                            value={formData.lateCancelFee}
                                            onChange={e => handleNumberChange('lateCancelFee', e.target.value)}
                                            className="w-full pl-8 p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="flex gap-2 p-2 bg-yellow-50 text-yellow-800 text-[10px] rounded border border-yellow-100 leading-tight">
                                        <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                        <p>
                                            <strong>Warning:</strong> Charges member's card on file.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                 <div className="text-xs text-gray-400 py-1.5 flex items-center gap-1">
                                    <Info size={14} /> No monetary fee charged.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!formData.useCustomRules && (
                    <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 italic text-center">
                        Using Gym Defaults
                    </div>
                )}
            </div>

            {/* Late Booking Grace Period */}
            <div className="flex items-center gap-3">
                <div className="w-8 flex justify-center">
                    <button type="button" onClick={() => toggleRule('lateBooking')} className="text-blue-600 hover:text-blue-800">
                        {activeRules.lateBooking ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500">Late Booking Grace Period (Minutes)</label>
                    {activeRules.lateBooking ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                value={formData.lateBookingMinutes}
                                onChange={e => handleNumberChange('lateBookingMinutes', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                placeholder="15"
                            />
                            <span className="text-xs text-gray-400 whitespace-nowrap">after start</span>
                        </div>
                    ) : (
                        <div className="text-xs text-green-600 py-2">Until Class Ends</div>
                    )}
                </div>
            </div>
        </div>
    );
};