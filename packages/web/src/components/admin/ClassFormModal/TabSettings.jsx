import React from 'react';
import { Settings, Medal, CheckSquare, Square } from 'lucide-react';

export const TabSettings = ({ 
    formData, 
    setFormData, 
    rankSystems, 
    activeRules, 
    toggleRule, 
    handleNumberChange 
}) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            {/* Rank Tracking */}
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

            <div className="border-t border-gray-100 pt-4"></div>

            {/* Booking Rules Override */}
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
                <div className={`space-y-4 transition-opacity ${formData.useCustomRules ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center"><button type="button" onClick={() => toggleRule('booking')} className="text-blue-600 hover:text-blue-800">{activeRules.booking ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500">Booking Window (Days)</label>
                            {activeRules.booking ? (
                                <input type="number" min="1" value={formData.bookingWindowDays} onChange={e => handleNumberChange('bookingWindowDays', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="7" />
                            ) : <div className="text-xs text-green-600 py-2">Unlimited</div>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center"><button type="button" onClick={() => toggleRule('cancel')} className="text-blue-600 hover:text-blue-800">{activeRules.cancel ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500">Cancel Deadline (Hours)</label>
                            {activeRules.cancel ? (
                                <input type="number" min="0" value={formData.cancelWindowHours} onChange={e => handleNumberChange('cancelWindowHours', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="2" />
                            ) : <div className="text-xs text-green-600 py-2">Anytime</div>}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center"><button type="button" onClick={() => toggleRule('fee')} className="text-blue-600 hover:text-blue-800">{activeRules.fee ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500">Late Cancel Fee ($)</label>
                            {activeRules.fee ? (
                                <input type="number" min="0" value={formData.lateCancelFee} onChange={e => handleNumberChange('lateCancelFee', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="0" />
                            ) : <div className="text-xs text-green-600 py-2">Free</div>}
                        </div>
                    </div>
                </div>

                {!formData.useCustomRules && (
                    <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 italic text-center">
                        Using Gym Defaults
                    </div>
                )}
            </div>
        </div>
    );
};