import React from 'react';
import { Coins, Info, AlertTriangle, Shield, CheckSquare, Square } from 'lucide-react';

export const TabAccess = ({ 
    formData, 
    setFormData, 
    membershipList, 
    toggleMembership, 
    toggleAllMemberships, 
    handleNumberChange 
}) => {
    
    // Logic: It's free if credits are enabled but cost is 0
    const isFreeClass = formData.dropInEnabled && parseFloat(formData.creditCost) === 0;
    const isUnbookable = !formData.dropInEnabled && formData.allowedMembershipIds.length === 0;

    // FILTER: Only show recurring memberships (exclude credit packs/one-time)
    const recurringPlans = membershipList.filter(plan => plan.interval !== 'one_time');

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            {isUnbookable && (
                <div className="flex items-start gap-3 bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-bold">Warning: Class Unbookable</p>
                        <p className="text-xs mt-1">You have disabled Credit booking and selected no memberships. No one can book this class.</p>
                    </div>
                </div>
            )}

            <div className={`flex flex-col bg-gray-50 p-4 rounded-lg border transition-colors ${isFreeClass ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md shadow-sm ${isFreeClass ? 'bg-white text-green-600' : 'bg-white text-orange-600'}`}>
                            <Coins className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">Allow Credit Booking</p>
                            <p className="text-xs text-gray-500">Users can book using class credits</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, dropInEnabled: !p.dropInEnabled }))} className={`w-11 h-6 rounded-full transition-colors relative ${formData.dropInEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.dropInEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                </div>
                {formData.dropInEnabled && (
                    <div className="ml-12 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="relative w-32">
                                {/* Changed to Credit Input */}
                                <div className="absolute left-3 top-1.5 text-gray-400 pointer-events-none">
                                    <Coins size={14} />
                                </div>
                                <input 
                                    type="number" 
                                    min="0" 
                                    value={formData.creditCost} 
                                    onChange={e => setFormData({ ...formData, creditCost: e.target.value })} 
                                    className="w-full pl-9 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                                <span className="absolute right-3 top-1.5 text-xs text-gray-400 font-medium">credits</span>
                            </div>
                            {isFreeClass && <div className="flex items-center text-green-700 text-xs font-medium bg-green-100 px-2 py-1 rounded-md"><Info className="h-3 w-3 mr-1" /><span>Free Class</span></div>}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            How many credits does this class cost? (Default: 1)
                        </p>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Max Capacity</label>
                <input
                    type="number"
                    min="0"
                    value={formData.maxCapacity || ''}
                    onChange={e => handleNumberChange('maxCapacity', e.target.value)}
                    placeholder="Unlimited"
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {recurringPlans.length > 0 ? (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase">Included in Memberships</label>
                        <button type="button" onClick={toggleAllMemberships} className="text-xs text-blue-600 hover:underline">Toggle All</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {recurringPlans.map(plan => {
                            const isSelected = formData.allowedMembershipIds.includes(plan.id);
                            return (
                                <div key={plan.id} onClick={() => toggleMembership(plan.id)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                    <span className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>{plan.name}</span>
                                    {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5 text-gray-300" />}
                                </div>
                            )
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2 italic">
                        Note: Credit packs and one-time purchases are hidden from this list.
                    </p>
                </div>
            ) : (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800 text-xs flex items-start gap-2">
                    <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>No recurring membership plans found.</p>
                </div>
            )}
        </div>
    );
};