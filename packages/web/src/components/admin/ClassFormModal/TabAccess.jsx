import React from 'react';
import { DollarSign, Info, AlertTriangle, Shield, CheckSquare, Square } from 'lucide-react';

export const TabAccess = ({ 
    formData, 
    setFormData, 
    membershipList, 
    toggleMembership, 
    toggleAllMemberships, 
    handleNumberChange 
}) => {
    
    const isFreeClass = formData.dropInEnabled && parseFloat(formData.dropInPrice) === 0;
    const isUnbookable = !formData.dropInEnabled && formData.allowedMembershipIds.length === 0;

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            {isUnbookable && (
                <div className="flex items-start gap-3 bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-bold">Warning: Class Unbookable</p>
                        <p className="text-xs mt-1">You have disabled Drop-ins and selected no memberships. No one can book this class.</p>
                    </div>
                </div>
            )}

            <div className={`flex flex-col bg-gray-50 p-4 rounded-lg border transition-colors ${isFreeClass ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
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
                    <button type="button" onClick={() => setFormData(p => ({ ...p, dropInEnabled: !p.dropInEnabled }))} className={`w-11 h-6 rounded-full transition-colors relative ${formData.dropInEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.dropInEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                </div>
                {formData.dropInEnabled && (
                    <div className="ml-12 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="relative w-32">
                                <span className="absolute left-3 top-1.5 text-gray-500 text-sm">$</span>
                                <input type="number" min="0" value={formData.dropInPrice} onChange={e => setFormData({ ...formData, dropInPrice: e.target.value })} className="w-full pl-6 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            {isFreeClass && <div className="flex items-center text-green-700 text-xs font-medium bg-green-100 px-2 py-1 rounded-md"><Info className="h-3 w-3 mr-1" /><span>Free Class</span></div>}
                        </div>
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

            {membershipList.length > 0 ? (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase">Included in Plans</label>
                        <button type="button" onClick={toggleAllMemberships} className="text-xs text-blue-600 hover:underline">Toggle All</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {membershipList.map(plan => {
                            const isSelected = formData.allowedMembershipIds.includes(plan.id);
                            return (
                                <div key={plan.id} onClick={() => toggleMembership(plan.id)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                    <span className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>{plan.name}</span>
                                    {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5 text-gray-300" />}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800 text-xs flex items-start gap-2">
                    <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>No membership plans found.</p>
                </div>
            )}
        </div>
    );
};