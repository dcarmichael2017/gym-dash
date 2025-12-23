// src/features/members/components/MemberFormModal/MemberRankTab.jsx
import React, { useState } from 'react';
import { TrendingUp, Plus, X, AlertTriangle } from 'lucide-react';
import { RankProgressionCard } from './RankProgressionCard';

export const MemberRankTab = ({ 
    formData, 
    setFormData, 
    rankSystems 
}) => {
    
    // UI State for Manual Edit Overlay
    const [editingRankProgramId, setEditingRankProgramId] = useState(null);
    const [tempRankData, setTempRankData] = useState({ rankId: '', stripes: 0, credits: 0 });

    // UI State for Remove Confirmation
    const [removeConfirmId, setRemoveConfirmId] = useState(null);

    // --- HELPERS ---

    const calculateBaseCredits = (program, rankId, stripeCount) => {
        if (!program || !rankId) return 0;
        
        const currentRank = program.ranks.find(r => r.id === rankId);
        if (!currentRank) return 0;

        const baseReq = parseInt(currentRank.classesRequired || 0);
        
        if (stripeCount <= 0) return baseReq;

        const nextRankIndex = program.ranks.findIndex(r => r.id === rankId) + 1;
        const nextRank = program.ranks[nextRankIndex];
        
        if (nextRank) {
            const nextReq = parseInt(nextRank.classesRequired || 0);
            const gap = nextReq - baseReq;
            const maxStripes = parseInt(currentRank.maxStripes || 0);
            const steps = maxStripes + 1;
            const perStep = Math.round(gap / steps);
            
            return baseReq + (stripeCount * perStep);
        }

        return baseReq;
    };

    // --- HANDLERS ---
    
    const handleAddProgram = (e) => {
        const progId = e.target.value;
        if (!progId) return;
    
        const program = rankSystems.find(p => p.id === progId);
        const firstRank = program.ranks[0];
        const baseCredits = parseInt(firstRank.classesRequired || 0);
    
        setFormData(prev => ({
            ...prev,
            ranks: {
                ...prev.ranks,
                [progId]: {
                    rankId: firstRank.id,
                    stripes: 0,
                    credits: baseCredits
                }
            }
        }));
    };

    // 1. Trigger the Modal
    const handleRemoveClick = (programId) => {
        setRemoveConfirmId(programId);
    };

    // 2. Actually Perform Delete
    const confirmRemoveProgram = () => {
        if (!removeConfirmId) return;
        
        setFormData(prev => {
            const newRanks = { ...prev.ranks };
            delete newRanks[removeConfirmId];
            return { ...prev, ranks: newRanks };
        });
        setRemoveConfirmId(null);
    };

    const handleOpenRankEdit = (programId) => {
        const current = formData.ranks[programId];
        setTempRankData({ ...current });
        setEditingRankProgramId(programId);
    };

    const handleManualEditChange = (field, value) => {
        const program = rankSystems.find(p => p.id === editingRankProgramId);
        
        setTempRankData(prev => {
            const newState = { ...prev, [field]: value };
            
            if (field === 'rankId' || field === 'stripes') {
                const stripes = field === 'stripes' ? parseInt(value) : (field === 'rankId' ? 0 : prev.stripes);
                const rankId = field === 'rankId' ? value : prev.rankId;
                
                if (field === 'rankId') newState.stripes = 0;
                
                newState.credits = calculateBaseCredits(program, rankId, stripes);
            }
            
            return newState;
        });
    };

    const handleSaveRankEdit = () => {
        setFormData(prev => ({
            ...prev,
            ranks: {
                ...prev.ranks,
                [editingRankProgramId]: tempRankData
            }
        }));
        setEditingRankProgramId(null);
    };

    const handlePromote = (programId, nextLabel) => {
        // Keeping window.confirm here for simplicity as it's a positive action, 
        // but you could replace this too if desired.
        if(!window.confirm(`Promote this member to ${nextLabel}?`)) return;
    
        const currentData = formData.ranks[programId];
        const program = rankSystems.find(p => p.id === programId);
        const currentRank = program.ranks.find(r => r.id === currentData.rankId);
        const maxStripes = parseInt(currentRank.maxStripes || 0);
    
        let updates = { ...currentData };
    
        if (currentData.stripes < maxStripes) {
            updates.stripes = currentData.stripes + 1;
        } else {
            const nextIndex = program.ranks.findIndex(r => r.id === currentData.rankId) + 1;
            const nextRank = program.ranks[nextIndex];
            if (nextRank) {
                updates.rankId = nextRank.id;
                updates.stripes = 0;
            }
        }
    
        setFormData(prev => ({
            ...prev,
            ranks: {
                ...prev.ranks,
                [programId]: updates
            }
        }));
    };

    // Determine current rank object for the edit modal
    const editingProgram = rankSystems.find(p => p.id === editingRankProgramId);
    const editingRank = editingProgram?.ranks.find(r => r.id === tempRankData.rankId);
    const maxStripesForCurrentRank = editingRank ? parseInt(editingRank.maxStripes || 0) : 0;

    // Determine program name for remove modal
    const removeProgramName = removeConfirmId ? rankSystems.find(p => p.id === removeConfirmId)?.name : '';

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
            
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" /> 
                        Active Progressions
                    </h4>
                    
                    <div className="relative">
                        <select 
                            onChange={handleAddProgram} 
                            value="" 
                            className="pl-8 pr-4 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer appearance-none w-40"
                        >
                            <option value="" disabled>Add Program</option>
                            {rankSystems
                                .filter(sys => !formData.ranks[sys.id]) 
                                .map(sys => (
                                    <option key={sys.id} value={sys.id}>{sys.name}</option>
                                ))
                            }
                        </select>
                        <Plus className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
                    </div>
                </div>

                <div className="space-y-3">
                    {Object.keys(formData.ranks).length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
                            No active martial arts programs.
                        </div>
                    ) : (
                        Object.entries(formData.ranks).map(([progId, rankData]) => {
                            const program = rankSystems.find(p => p.id === progId);
                            if (!program) return null;
                            return (
                                <RankProgressionCard 
                                    key={progId} 
                                    program={program} 
                                    userRankData={rankData}
                                    onUpdate={() => handleOpenRankEdit(progId)}
                                    onPromote={handlePromote}
                                    onRemove={() => handleRemoveClick(progId)} // Updated Handler
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- MANUAL EDIT OVERLAY --- */}
            {editingRankProgramId && editingProgram && (
                <div className="absolute inset-0 bg-white/95 z-20 flex items-center justify-center p-4 animate-in fade-in rounded-xl backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white border border-gray-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h4 className="font-bold text-gray-800">Edit Rank Details</h4>
                            <button onClick={() => setEditingRankProgramId(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Current Rank</label>
                                <div className="relative">
                                    <select 
                                        value={tempRankData.rankId} 
                                        onChange={e => handleManualEditChange('rankId', e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700"
                                    >
                                        {editingProgram.ranks.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    {editingRank && (
                                        <div 
                                            className="absolute right-3 top-3 w-4 h-4 rounded-full border border-gray-200 pointer-events-none"
                                            style={{ backgroundColor: editingRank.color }}
                                        />
                                    )}
                                </div>
                            </div>

                            {maxStripesForCurrentRank > 0 ? (
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Stripes</label>
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                            Max: {maxStripesForCurrentRank}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-2 flex-wrap">
                                            {[...Array(maxStripesForCurrentRank + 1)].map((_, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => handleManualEditChange('stripes', i)}
                                                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-all border ${
                                                        tempRankData.stripes === i 
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' 
                                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                                                    }`}
                                                >
                                                    {i}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2">
                                        Selecting stripes automatically updates attendance progress.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-400 text-center border border-dashed border-gray-200">
                                    No stripes available for this rank.
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <button 
                                type="button" 
                                onClick={() => setEditingRankProgramId(null)} 
                                className="flex-1 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSaveRankEdit} 
                                className="flex-1 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-bold text-sm shadow-sm transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- REMOVE CONFIRMATION OVERLAY --- */}
            {removeConfirmId && (
                <div className="absolute inset-0 bg-white/95 z-20 flex items-center justify-center p-4 animate-in fade-in rounded-xl backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-white border border-gray-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
                         <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h4 className="text-lg font-bold text-gray-900 mb-2">Remove Program?</h4>
                            <p className="text-sm text-gray-500 mb-4">
                                Are you sure you want to remove <b>{removeProgramName}</b> from this member? All rank history for this program will be lost.
                            </p>
                            
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setRemoveConfirmId(null)} 
                                    className="flex-1 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    onClick={confirmRemoveProgram} 
                                    className="flex-1 py-2.5 text-white bg-red-600 rounded-lg hover:bg-red-700 font-bold text-sm shadow-sm transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};