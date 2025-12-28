// src/features/members/components/MemberFormModal/MemberProfileTab.jsx
import React from 'react';
import { User, Mail, Phone, ShieldAlert } from 'lucide-react';

export const MemberProfileTab = ({ 
    formData, 
    setFormData 
}) => {

    // Simple phone formatting for the admin input (strips non-digits)
    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^\d]/g, '');
        setFormData({ ...formData, phoneNumber: value });
    };

    const handleEmergencyPhoneChange = (e) => {
        const value = e.target.value.replace(/[^\d]/g, '');
        setFormData({ ...formData, emergencyPhone: value });
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            
            {/* 1. Primary Demographics */}
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">First Name</label>
                        <input 
                            required 
                            value={formData.firstName} 
                            onChange={e => setFormData({ ...formData, firstName: e.target.value })} 
                            placeholder="John" 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Last Name</label>
                        <input 
                            required 
                            value={formData.lastName} 
                            onChange={e => setFormData({ ...formData, lastName: e.target.value })} 
                            placeholder="Doe" 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <input 
                                required 
                                type="email" 
                                value={formData.email} 
                                onChange={e => setFormData({ ...formData, email: e.target.value })} 
                                placeholder="john@example.com" 
                                className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <input 
                                type="tel" 
                                value={formData.phoneNumber} 
                                onChange={handlePhoneChange} 
                                placeholder="5551234567" 
                                className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Emergency Contact Section */}
            <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-4 text-red-600">
                    <ShieldAlert size={16} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Emergency Contact</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Contact Name</label>
                        <input 
                            value={formData.emergencyName || ''} 
                            onChange={e => setFormData({ ...formData, emergencyName: e.target.value })} 
                            placeholder="Full Name" 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white" 
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Contact Phone</label>
                        <input 
                            value={formData.emergencyPhone || ''} 
                            onChange={handleEmergencyPhoneChange} 
                            placeholder="Phone Number" 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white" 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};