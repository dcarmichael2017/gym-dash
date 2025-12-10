// packages/web/src/components/MemberFamilyTab.jsx

import React, { useState } from 'react';
import {
    Users, Link as LinkIcon, Search, Trash2, Check, UserPlus, ArrowLeft,
    ChevronRight, AlertCircle, CheckCircle2, XCircle, Clock, Archive
} from 'lucide-react';
import {
    addManualMember,
    searchMembers,
    linkFamilyMember,
    unlinkFamilyMember
} from '../../../shared/api/firestore';

export const MemberFamilyTab = ({ memberData, gymId, allMembers, onSave, onSelectMember }) => {
    // Modes: 'view', 'add_choice', 'search', 'create_dependent'
    const [mode, setMode] = useState('view');
    const [loading, setLoading] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // New Dependent Form State
    const [dependentForm, setDependentForm] = useState({
        firstName: '', lastName: '', email: '', phone: ''
    });

    // --- GRANDPARENT CHAIN FIX ---
    const isDependent = !!memberData.payerId;

    // --- HANDLERS ---

    const handleLink = async (dependentId) => {
        setLoading(true);
        const res = await linkFamilyMember(dependentId, memberData.id);
        setLoading(false);
        if (res.success) {
            onSave();
            setMode('view');
        } else {
            alert("Link failed: " + res.error);
        }
    };

    const handleUnlink = async (depId, payId) => {
        if (!depId || !payId) return;
        if (!confirm("Unlink this dependent? They will become their own primary account.")) return;

        setLoading(true);
        const res = await unlinkFamilyMember(depId, payId);
        setLoading(false);
        if (res.success) onSave();
        else alert("Failed to unlink: " + res.error);
    };

    const handleCreateDependent = async (e) => {
        e.preventDefault();
        setLoading(true);

        // 1. Create Profile
        const payload = {
            ...dependentForm,
            searchName: `${dependentForm.firstName} ${dependentForm.lastName}`.toLowerCase(),
            status: 'active',
            photoUrl: null
        };

        const createRes = await addManualMember(gymId, payload);

        if (createRes.success) {
            // 2. Link immediately
            const linkRes = await linkFamilyMember(createRes.member.id, memberData.id);
            setLoading(false);
            if (linkRes.success) {
                onSave();
                setMode('view');
                setDependentForm({ firstName: '', lastName: '', email: '', phone: '' });
            } else {
                alert("Created user but failed to link: " + linkRes.error);
            }
        } else {
            setLoading(false);
            alert("Failed to create dependent: " + createRes.error);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm) return;
        setIsSearching(true);
        const res = await searchMembers(gymId, searchTerm);
        if (res.success) {
            // Filter out: Self, existing dependents, and the Payer (prevent loops)
            const results = res.results.filter(m => 
                m.id !== memberData.id && 
                !memberData.dependents?.includes(m.id) &&
                m.id !== memberData.payerId
            );
            setSearchResults(results);
        }
        setIsSearching(false);
    };

    const handleSwitchToDependent = (dependentId) => {
        const dependentMember = allMembers.find(m => m.id === dependentId);
        if (dependentMember && onSelectMember) {
            onSelectMember(dependentMember);
        }
    };

    // --- RENDER HELPERS ---

    const getMiniStatusBadge = (status) => {
        switch(status) {
            case 'active': return <div className="flex items-center text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-md"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</div>;
            case 'trialing': return <div className="flex items-center text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md"><Clock className="w-3 h-3 mr-1"/> Trial</div>;
            case 'past_due': return <div className="flex items-center text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-md"><XCircle className="w-3 h-3 mr-1"/> Past Due</div>;
            case 'archived': return <div className="flex items-center text-[10px] font-bold text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded-md"><Archive className="w-3 h-3 mr-1"/> Archived</div>;
            default: return <div className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">Inactive</div>;
        }
    };

    if (!memberData) {
        return <div className="text-center py-8 text-gray-500">Please create and save the profile first.</div>;
    }

    // SCENARIO A: Current User IS a Dependent
    if (isDependent) {
        return (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center animate-in fade-in">
                <LinkIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <h4 className="font-bold text-gray-800">Dependent Account</h4>
                <p className="text-sm text-gray-500 mb-4">
                    This user's billing is managed by another account.
                </p>
                <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-xs text-yellow-800 mb-4 text-left">
                    <p className="font-bold mb-1 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/> Restrictions Apply</p>
                    Dependents cannot have their own dependents (Grandparent Chain Rule). To add children to this user, you must first unlink them from their current Head of Household.
                </div>
                <button
                    onClick={() => handleUnlink(memberData.id, memberData.payerId)}
                    className="text-red-600 text-sm font-medium hover:underline flex items-center justify-center gap-1 mx-auto"
                >
                    <Trash2 className="h-4 w-4" /> Unlink (Make Primary)
                </button>
            </div>
        );
    }

    // SCENARIO B: Head of Household Logic
    return (
        <div>
            {/* 1. VIEW MODE */}
            {mode === 'view' && (
                <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-200">
                    <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                        <div>
                            <h4 className="font-bold text-gray-800">Family Management</h4>
                            <p className="text-xs text-gray-500">Manage dependents for {memberData.firstName}.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {memberData.dependents && memberData.dependents.length > 0 ? (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-400 uppercase">Linked Dependents ({memberData.dependents.length})</p>
                                
                                {memberData.dependents.map(depId => {
                                    const dep = allMembers.find(m => m.id === depId);
                                    // Fallback status if missing
                                    const status = dep?.subscriptionStatus || dep?.status || 'inactive'; 

                                    return (
                                        <div 
                                            key={depId} 
                                            onClick={() => handleSwitchToDependent(depId)}
                                            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer group transition-all"
                                        >
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3 text-xs shrink-0">
                                                    {dep ? (dep.firstName?.[0] || 'U') : '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">
                                                        {dep ? `${dep.firstName} ${dep.lastName}` : 'Unknown Member'}
                                                    </p>
                                                    {/* NEW: Plan Name + Dependent Label */}
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">Dependent</span>
                                                        {dep?.membershipName && (
                                                            <span className="text-[10px] text-blue-600 font-medium">{dep.membershipName}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* NEW: Status Badge on the right */}
                                            <div className="flex items-center gap-3">
                                                {getMiniStatusBadge(status)}
                                                <div className="text-gray-400 group-hover:text-blue-500">
                                                    <ChevronRight className="h-5 w-5" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-sm text-gray-500">No dependents linked yet.</p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setMode('add_choice')}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center shadow-sm transition-all"
                    >
                        <UserPlus className="h-5 w-5 mr-2" /> Add a Dependent
                    </button>
                </div>
            )}

            {/* 2. ADD CHOICE MODE */}
            {mode === 'add_choice' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
                    <button onClick={() => setMode('view')} className="text-xs text-gray-500 flex items-center hover:text-gray-800"><ArrowLeft className="h-3 w-3 mr-1" /> Back</button>
                    <h4 className="font-bold text-gray-800">Add Dependent</h4>

                    <button onClick={() => setMode('create_dependent')} className="w-full p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left flex items-center group">
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600 mr-4 group-hover:scale-110 transition-transform"><UserPlus className="h-5 w-5" /></div>
                        <div>
                            <p className="font-bold text-gray-800">Create New Profile</p>
                            <p className="text-xs text-gray-500">Add a child or spouse not yet in the system</p>
                        </div>
                    </button>

                    <button onClick={() => setMode('search')} className="w-full p-4 border border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left flex items-center group">
                        <div className="bg-purple-100 p-3 rounded-full text-purple-600 mr-4 group-hover:scale-110 transition-transform"><Search className="h-5 w-5" /></div>
                        <div>
                            <p className="font-bold text-gray-800">Link Existing Member</p>
                            <p className="text-xs text-gray-500">Search for an existing member to add as a dependent</p>
                        </div>
                    </button>
                </div>
            )}

            {/* 3. CREATE MODE */}
            {mode === 'create_dependent' && (
                <form onSubmit={handleCreateDependent} className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
                    <div className="flex items-center justify-between">
                        <button type="button" onClick={() => setMode('add_choice')} className="text-xs text-gray-500 flex items-center hover:text-gray-800"><ArrowLeft className="h-3 w-3 mr-1" /> Back</button>
                        <h4 className="font-bold text-gray-800">New Dependent</h4>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 mb-4 flex items-start">
                        <Check className="h-4 w-4 mr-2 mt-0.5" />
                        This new user will be linked to {memberData.firstName} immediately.
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">First Name</label>
                            <input required value={dependentForm.firstName} onChange={e => setDependentForm({ ...dependentForm, firstName: e.target.value })} className="p-2 border rounded-lg w-full" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Last Name</label>
                            <input required value={dependentForm.lastName} onChange={e => setDependentForm({ ...dependentForm, lastName: e.target.value })} className="p-2 border rounded-lg w-full" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Email (Optional)</label>
                        <input type="email" placeholder="Child's email or leave blank" value={dependentForm.email} onChange={e => setDependentForm({ ...dependentForm, email: e.target.value })} className="p-2 border rounded-lg w-full" />
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm mt-4">
                        {loading ? 'Creating...' : 'Create & Link User'}
                    </button>
                </form>
            )}

            {/* 4. SEARCH MODE */}
            {mode === 'search' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
                    <div className="flex items-center justify-between">
                        <button onClick={() => setMode('view')} className="text-xs text-gray-500 flex items-center hover:text-gray-800"><ArrowLeft className="h-3 w-3 mr-1" /> Cancel</button>
                        <h4 className="font-bold text-gray-800">Find Member to Add</h4>
                    </div>

                    <div className="flex gap-2">
                        <input
                            placeholder="Search name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                        />
                        <button onClick={handleSearch} className="bg-blue-600 text-white px-3 rounded-lg hover:bg-blue-700">
                            <Search className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg">
                        {searchResults.length > 0 ? searchResults.map(res => (
                            <div key={res.id} className="p-3 border-b last:border-0 flex justify-between items-center hover:bg-gray-50">
                                <span className="text-sm font-medium">{res.firstName} {res.lastName}</span>
                                <button
                                    onClick={() => handleLink(res.id)}
                                    className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-200 font-bold"
                                >
                                    Add
                                </button>
                            </div>
                        )) : (
                            <div className="p-4 text-center text-xs text-gray-400">
                                {isSearching ? 'Searching...' : 'No results found.'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};