// src/features/members/components/MemberFormModal/MemberProfileTab.jsx
import React from 'react';
import { User, Mail, Phone, Camera } from 'lucide-react';

export const MemberProfileTab = ({ 
    formData, 
    setFormData, 
    handleFileChange, 
    photoFile 
}) => {
    
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            {/* Photo Upload */}
            <div className="flex flex-col items-center">
                <div className="relative group cursor-pointer">
                    <div className="h-24 w-24 rounded-full bg-gray-100 overflow-hidden border-2 border-gray-200 flex items-center justify-center">
                        {photoFile ? (
                            <img src={URL.createObjectURL(photoFile)} className="h-full w-full object-cover" />
                        ) : formData.photoUrl ? (
                            <img src={formData.photoUrl} className="h-full w-full object-cover" />
                        ) : (
                            <User className="h-10 w-10 text-gray-400" />
                        )}
                    </div>
                    <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                        <Camera className="h-6 w-6" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                </div>
            </div>

            {/* Demographics Inputs */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">First Name</label>
                    <input required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Last Name</label>
                    <input required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Phone</label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                </div>
            </div>
        </div>
    );
};