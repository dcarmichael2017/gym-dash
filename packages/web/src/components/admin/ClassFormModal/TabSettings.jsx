import React from 'react';
import { Settings, Medal, CheckSquare, Square, Eye, Users, Lock, Globe, DollarSign, AlertCircle, Info, ChevronDown } from 'lucide-react'; // Added ChevronDown

export const TabSettings = ({
    formData,
    setFormData,
    rankSystems,
    activeRules,
    toggleRule,
    handleNumberChange,
    isReadOnly = false,
    globalSettings = {}
}) => {

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

    const cancelOptions = [
        { value: "0.25", label: "15 Minutes" }, { value: "0.5", label: "30 Minutes" },
        { value: "1", label: "1 Hour" }, { value: "2", label: "2 Hours" },
        { value: "3", label: "3 Hours" }, { value: "6", label: "6 Hours" },
        { value: "12", label: "12 Hours" }, { value: "24", label: "24 Hours" },
        { value: "48", label: "48 Hours" },
    ];

    const DefaultRuleDisplay = ({ label, value, unit }) => (
         <div className="text-xs">
            <p className="font-semibold text-gray-500">{label}</p>
            <p className="text-gray-700 font-medium">{value} {unit}</p>
        </div>
    );

    const getCancelLabel = (value) => {
        const option = cancelOptions.find(opt => opt.value == value); // Use == for loose comparison
        return option ? option.label : "Until Class Starts";
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            {isReadOnly && (
                <div className="p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-sm flex items-center gap-3 -mb-2">
                    <Info size={18} className="shrink-0" />
                    <div>
                        <p className="font-bold">Class in Progress</p>
                        <p className="text-xs">Edits will apply to future sessions only.</p>
                    </div>
                </div>
            )}

            <div>
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

                <div className="border-t border-gray-100 my-6"></div>

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

                <div className="border-t border-gray-100 my-6"></div>

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

                    {formData.useCustomRules ? (
                        <div className="space-y-5 animate-in fade-in duration-200">
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

                            {/* Cancel Deadline */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 flex justify-center"><button type="button" onClick={() => toggleRule('cancel')} className="text-blue-600 hover:text-blue-800">{activeRules.cancel ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500">Cancel Deadline</label>
                                    {activeRules.cancel ? (
                                        <div className="relative">
                                            <select value={formData.cancelWindowHours} onChange={e => handleNumberChange('cancelWindowHours', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm appearance-none bg-white">
                                                {cancelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                        </div>
                                    ) : <div className="text-xs text-green-600 py-2">Until Class Starts</div>}
                                </div>
                            </div>

                            {/* Late Cancel Fee */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 flex justify-center mt-1"><button type="button" onClick={() => toggleRule('fee')} className="text-blue-600 hover:text-blue-800">{activeRules.fee ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Late Cancel Penalty (Monetary)</label>
                                    {activeRules.fee ? (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"><DollarSign size={14} className="text-gray-400" /></div>
                                                <input type="number" min="0" step="0.50" value={formData.lateCancelFee} onChange={e => handleNumberChange('lateCancelFee', e.target.value)} className="w-full pl-8 p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none" placeholder="0.00" />
                                            </div>
                                            <div className="flex gap-2 p-2 bg-yellow-50 text-yellow-800 text-[10px] rounded border border-yellow-100 leading-tight">
                                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                                <p><strong>Warning:</strong> Charges member's card on file.</p>
                                            </div>
                                        </div>
                                    ) : <div className="text-xs text-gray-400 py-1.5 flex items-center gap-1"><Info size={14} /> No monetary fee charged.</div>}
                                </div>
                            </div>
                            
                            {/* Late Booking Grace Period */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 flex justify-center"><button type="button" onClick={() => toggleRule('lateBooking')} className="text-blue-600 hover:text-blue-800">{activeRules.lateBooking ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500">Late Booking Grace Period</label>
                                    {activeRules.lateBooking ? (
                                        <div className="flex items-center gap-2">
                                            <input type="number" min="0" value={formData.lateBookingMinutes} onChange={e => handleNumberChange('lateBookingMinutes', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="15" />
                                            <span className="text-xs text-gray-400 whitespace-nowrap">min after start</span>
                                        </div>
                                    ) : <div className="text-xs text-green-600 py-2">Until Class Ends</div>}
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs text-gray-500">
                            <p className="font-bold text-gray-700 mb-3 text-center">Using Gym Default Rules</p>
                            <div className="grid grid-cols-2 gap-3">
                                <DefaultRuleDisplay label="Booking Window" value={globalSettings?.bookingWindowDays ?? 'Unlimited'} unit="Days" />
                                <DefaultRuleDisplay label="Cancel Deadline" value={getCancelLabel(globalSettings?.cancelWindowHours ?? 2)} unit="before class" />
                                <DefaultRuleDisplay label="Late Booking" value={globalSettings?.lateBookingMinutes ?? 'Until End'} unit="min after start" />
                                <DefaultRuleDisplay label="Late Cancel Fee" value={`$${(globalSettings?.lateCancelFee ?? 0).toFixed(2)}`} unit="" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
