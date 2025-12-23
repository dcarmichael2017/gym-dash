// src/features/members/components/MemberFormModal/MemberFamilyTab.jsx
import React, { useState } from 'react';
import { Search, Link as LinkIcon, Unlink, User, Loader, Users, ArrowUpRight } from 'lucide-react';
import { 
    searchMembers, 
    linkFamilyMember, 
    unlinkFamilyMember 
} from '../../../../../../shared/api/firestore';

export const MemberFamilyTab = ({ memberData, gymId, onSave, onSelectMember, allMembers = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [processing, setProcessing] = useState(false);

    // --- Derived State ---
    const isDependent = !!memberData.payerId;
    const dependents = memberData.dependents || [];

    // Find Head of Household Profile (if dependent)
    const payerProfile = isDependent 
        ? allMembers.find(m => m.id === memberData.payerId) 
        : null;

    // --- Handlers ---

    const handleSearch = async (term) => {
        setSearchTerm(term);
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        const res = await searchMembers(gymId, term); 
        if (res.success) {
            const filtered = res.results.filter(m => 
                m.id !== memberData.id && 
                m.id !== memberData.payerId &&
                !dependents.includes(m.id)
            );
            setSearchResults(filtered);
        }
        setSearching(false);
    };

    const handleLink = async (targetMemberId) => {
        setProcessing(true);
        const res = await linkFamilyMember(targetMemberId, memberData.id);
        if (res.success) {
            setSearchTerm('');
            setSearchResults([]);
            onSave(); 
        } else {
            alert("Failed to link member: " + res.error);
        }
        setProcessing(false);
    };

    const handleUnlink = async (dependentId) => {
        if (!window.confirm("Remove this member from family billing?")) return;
        setProcessing(true);
        const res = await unlinkFamilyMember(dependentId, memberData.id);
        if (res.success) onSave();
        else alert("Failed to unlink: " + res.error);
        setProcessing(false);
    };

    const handleUnlinkSelf = async () => {
        if (!window.confirm("Unlink from Head of Household? You will need your own payment method.")) return;
        setProcessing(true);
        const res = await unlinkFamilyMember(memberData.id, memberData.payerId);
        if (res.success) onSave();
        else alert("Failed to unlink: " + res.error);
        setProcessing(false);
    };

    // Generic handler for switching view to another profile
    const handleProfileClick = (targetProfile) => {
        if (targetProfile) {
            onSelectMember(targetProfile);
        } else {
            console.warn("Profile not found locally");
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            
            {/* 1. STATUS SECTION */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h4 className="font-bold text-blue-900 text-sm">Family Status</h4>
                        <p className="text-xs text-blue-700 mt-1">
                            {isDependent 
                                ? "This account is managed by a Head of Household." 
                                : "This member is a Head of Household. They pay for dependents."}
                        </p>
                    </div>
                    {isDependent && (
                        <button 
                            onClick={handleUnlinkSelf} 
                            disabled={processing}
                            className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                        >
                            Unlink Self
                        </button>
                    )}
                </div>

                {/* --- SHOW PAYER LINK IF DEPENDENT --- */}
                {isDependent && payerProfile && (
                    <div 
                        onClick={() => handleProfileClick(payerProfile)}
                        className="flex items-center justify-between p-3 bg-white/60 border border-blue-200 rounded-lg cursor-pointer hover:bg-white hover:shadow-sm transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                {payerProfile.firstName?.charAt(0) || <User size={14} />}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-blue-900">
                                    {payerProfile.firstName} {payerProfile.lastName}
                                </p>
                                <p className="text-[10px] text-blue-600 font-medium">
                                    Head of Household
                                </p>
                            </div>
                        </div>
                        <ArrowUpRight size={16} className="text-blue-400 group-hover:text-blue-600" />
                    </div>
                )}
            </div>

            {/* 2. DEPENDENTS LIST (If Head of Household) */}
            {!isDependent && (
                <div>
                    <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                        <Users size={16} /> Dependents ({dependents.length})
                    </h4>
                    
                    {dependents.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
                            No family members linked.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {dependents.map(depId => {
                                const depProfile = allMembers.find(m => m.id === depId);
                                return (
                                    <DependentRow 
                                        key={depId} 
                                        depId={depId} 
                                        name={depProfile?.firstName}
                                        onUnlink={handleUnlink} 
                                        processing={processing}
                                        onSelect={() => handleProfileClick(depProfile)} 
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 3. ADD NEW (Only if Head of Household) */}
            {!isDependent && (
                <div className="pt-4 border-t border-gray-100">
                    <h4 className="font-bold text-gray-800 text-sm mb-2">Link Existing Member</h4>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name..." 
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        {searching && <Loader className="absolute right-3 top-2.5 h-4 w-4 text-blue-500 animate-spin" />}
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto shadow-sm">
                            {searchResults.map(res => (
                                <div key={res.id} className="flex justify-between items-center p-3 bg-white hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                            <User size={14} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{res.firstName} {res.lastName}</p>
                                            <p className="text-xs text-gray-500">{res.email}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleLink(res.id)}
                                        disabled={processing}
                                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1"
                                    >
                                        <LinkIcon size={12} /> Link
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Helper sub-component for list items
const DependentRow = ({ depId, name, onUnlink, processing, onSelect }) => {
    return (
        <div className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3 cursor-pointer" onClick={onSelect}>
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <User size={14} />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-800">
                        {name ? name : `Member ${depId.substr(0, 5)}...`}
                    </p>
                    <p className="text-[10px] text-gray-400">Click to view profile</p>
                </div>
            </div>
            <button 
                onClick={() => onUnlink(depId)}
                disabled={processing}
                className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                title="Unlink"
            >
                <Unlink size={16} />
            </button>
        </div>
    );
};