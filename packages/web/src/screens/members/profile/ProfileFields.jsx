import React from 'react';

export const ProfileField = ({ icon: Icon, label, value, onChange, isEditing, editable, placeholder }) => (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-50 last:border-0">
        <div className="flex items-center gap-3 overflow-hidden w-full">
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                <Icon size={16} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
                {editable && isEditing ? (
                    <input
                        type="text"
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        className="font-medium text-gray-900 border-b border-blue-300 focus:outline-none focus:border-blue-600 w-full bg-transparent py-0.5"
                    />
                ) : (
                    <span className="font-medium text-gray-900 truncate block h-6 flex items-center">
                        {value || <span className="text-gray-300 font-normal italic">Not set</span>}
                    </span>
                )}
            </div>
        </div>
    </div>
);