import React, { useState, useRef, useEffect } from 'react';
import { 
  Save, Plus, Trash2, GripVertical, Award, Layers, Edit2, 
  Check, X, ChevronRight, AlertTriangle, ArrowDown, Hash, Users, Calculator, AlertCircle 
} from 'lucide-react';
import { updateGymDetails, getGymMembers } from '../../../../../shared/api/firestore';
import { PRESET_COLORS, RANK_PRESETS } from '../../../../../shared/constants/gymDefaults';

// --- COMPONENTS ---

export const RankSettingsTab = ({ gymId, initialData, showMessage, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [programs, setPrograms] = useState(initialData?.programs || []);
  const [activeProgramId, setActiveProgramId] = useState(programs[0]?.id || null);
  const [editingProgramName, setEditingProgramName] = useState(null);

  // Modal States
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, blockedByMembers: 0 });

  // Drag & Drop Refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // Helper to get current program
  const activeProgram = programs.find(p => p.id === activeProgramId);
  const activeIndex = programs.findIndex(p => p.id === activeProgramId);

  // Sync Logic
  useEffect(() => {
    if (initialData?.programs) {
        setPrograms(initialData.programs);
        if (initialData.programs.length > 0 && !activeProgramId) {
            setActiveProgramId(initialData.programs[0].id);
        }
    }
  }, [initialData]);

  // --- LOGIC HELPERS ---

  const handleCreateProgram = (preset) => {
    const newId = Date.now().toString();
    const ranksWithIds = preset.ranks.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9) }));
    
    const newProgram = { 
      id: newId, 
      name: preset.id === 'custom' ? 'New Program' : preset.name, 
      ranks: ranksWithIds 
    };

    setPrograms([...programs, newProgram]);
    setActiveProgramId(newId);
    setShowPresetModal(false);
  };

  const checkUsageAndDelete = async (e, id) => {
    e.stopPropagation();
    const result = await getGymMembers(gymId);
    
    if (result.success) {
        const membersUsingProgram = result.members.filter(m => m.programId === id).length;
        if (membersUsingProgram > 0) {
            setDeleteConfirm({ show: true, id: id, blockedByMembers: membersUsingProgram });
        } else {
            setDeleteConfirm({ show: true, id: id, blockedByMembers: 0 });
        }
    } else {
        setDeleteConfirm({ show: true, id: id, blockedByMembers: 0 });
    }
  };

  const confirmDeleteProgram = () => {
    const newList = programs.filter(p => p.id !== deleteConfirm.id);
    setPrograms(newList);
    if (activeProgramId === deleteConfirm.id) {
      setActiveProgramId(newList.length > 0 ? newList[0].id : null);
    }
    setDeleteConfirm({ show: false, id: null, blockedByMembers: 0 });
  };

  const handleUpdateProgramName = (id, newName) => {
    setPrograms(programs.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  // --- RANK MANIPULATION ---

  const handleAddRank = () => {
    const newRank = { id: Date.now().toString(), name: '', color: '#FFFFFF', classesRequired: 0, maxStripes: 0 };
    const updatedProgram = { ...activeProgram, ranks: [...activeProgram.ranks, newRank] };
    updateProgramInState(updatedProgram);
  };

  const handleRemoveRank = (rankIndex) => {
    const newRanks = [...activeProgram.ranks];
    newRanks.splice(rankIndex, 1);
    updateProgramInState({ ...activeProgram, ranks: newRanks });
  };

  const handleRankChange = (rankIndex, field, value) => {
    const newRanks = [...activeProgram.ranks];
    newRanks[rankIndex][field] = value;
    updateProgramInState({ ...activeProgram, ranks: newRanks });
  };

  const handleSort = () => {
    let _ranks = [...activeProgram.ranks];
    const draggedItemContent = _ranks.splice(dragItem.current, 1)[0];
    _ranks.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    updateProgramInState({ ...activeProgram, ranks: _ranks });
  };

  const updateProgramInState = (updatedProgram) => {
    const newPrograms = [...programs];
    newPrograms[activeIndex] = updatedProgram;
    setPrograms(newPrograms);
  };

  // --- VALIDATION & SAVE ---

  // Check for logical errors before saving
  const validateRanks = () => {
    for (const prog of programs) {
        let prevReq = -1;
        for (const rank of prog.ranks) {
            // Must be a number
            if (rank.classesRequired === '' || isNaN(rank.classesRequired)) return `Attendance required for ${rank.name} in ${prog.name} is invalid.`;
            // Must be >= previous rank
            if (rank.classesRequired < prevReq) return `Logic Error in ${prog.name}: ${rank.name} (${rank.classesRequired}) cannot require fewer classes than the previous rank (${prevReq}).`;
            
            prevReq = rank.classesRequired;
        }
    }
    return null; // No errors
  };

  const handleSave = async () => {
    const error = validateRanks();
    if (error) {
        showMessage('error', error);
        return;
    }

    setLoading(true);
    const cleanPrograms = programs.map(p => ({
        ...p,
        ranks: p.ranks.filter(r => r.name.trim() !== '')
    }));

    const result = await updateGymDetails(gymId, {
      grading: { programs: cleanPrograms }
    });

    setLoading(false);
    if (result.success) {
      showMessage('success', 'Rank systems updated successfully.');
      if (onUpdate) onUpdate();
    } else {
      showMessage('error', 'Failed to save settings.');
    }
  };

  const getStripeMetric = (rank, index, allRanks) => {
    if (!rank.maxStripes || rank.maxStripes < 1) return null;
    const nextRank = allRanks[index + 1];
    if (!nextRank) return null; 

    const currentClasses = rank.classesRequired || 0;
    const nextClasses = nextRank.classesRequired || 0;

    if (nextClasses <= currentClasses) return null; // Metric hidden if logic is broken

    const gap = nextClasses - currentClasses;
    const perStripe = Math.round(gap / (rank.maxStripes + 1));

    return `~${perStripe} classes / stripe`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Intro Box */}
      <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex gap-3">
        <Award className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-800">
          <p className="font-bold">Rank Management</p>
          <p>Define tracks (Programs) for your students. Ranks must be in ascending order of attendance.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* LEFT: Program List */}
        <div className="w-full md:w-1/4 space-y-3">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Programs</label>
            <div className="flex flex-col gap-2">
                {programs.map(prog => (
                    <div 
                        key={prog.id}
                        onClick={() => setActiveProgramId(prog.id)}
                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all ${
                            activeProgramId === prog.id 
                            ? 'bg-blue-50 border-blue-200 shadow-sm' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        {editingProgramName === prog.id ? (
                            <input 
                                autoFocus
                                className="bg-white border border-blue-300 rounded px-1 py-0.5 text-sm w-full outline-none"
                                value={prog.name}
                                onChange={(e) => handleUpdateProgramName(prog.id, e.target.value)}
                                onBlur={() => setEditingProgramName(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingProgramName(null)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className={`text-sm font-medium ${activeProgramId === prog.id ? 'text-blue-800' : 'text-gray-700'}`}>
                                {prog.name}
                            </span>
                        )}

                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingProgramName(prog.id); }}
                                className="p-1 text-gray-400 hover:text-blue-600"
                            >
                                <Edit2 size={12} />
                            </button>
                            <button 
                                onClick={(e) => checkUsageAndDelete(e, prog.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
                
                <button 
                    onClick={() => setShowPresetModal(true)}
                    className="flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-300 hover:text-blue-600 text-sm font-medium transition-colors"
                >
                    <Plus size={14} /> Add Program
                </button>
            </div>
        </div>

        {/* RIGHT: Rank Editor */}
        <div className="flex-1 w-full bg-white border border-gray-200 rounded-xl p-5 shadow-sm min-h-[400px]">
            {activeProgram ? (
                <>
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Layers className="h-4 w-4 text-gray-400" /> 
                            {activeProgram.name} Ranks
                        </h3>
                        <span className="text-xs text-gray-400">{activeProgram.ranks.length} Ranks Defined</span>
                    </div>

                    <div className="flex px-4 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-16">
                        <div className="flex-1">Rank Name</div>
                        <div className="w-24 text-center mr-4">Cumulative</div>
                        <div className="w-16 text-center mr-8">Stripes</div>
                    </div>

                    <div className="relative pl-6 border-l-2 border-dashed border-gray-200 ml-4 space-y-3">
                        <div className="absolute -left-3 -top-2 flex flex-col items-center">
                            <div className="text-[10px] uppercase font-bold text-gray-300 rotate-90 origin-left translate-y-10 w-20">Start</div>
                        </div>
                        <div className="absolute -left-3 bottom-0 flex flex-col items-center">
                             <div className="text-[10px] uppercase font-bold text-gray-300 rotate-90 origin-left -translate-y-4 w-20">Highest</div>
                             <ArrowDown className="h-4 w-4 text-gray-300 mt-1" />
                        </div>

                        {activeProgram.ranks.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm italic">
                                No ranks defined yet. Click "Add Rank" to start.
                            </div>
                        )}

                        {activeProgram.ranks.map((rank, index) => {
                            const stripeMetric = getStripeMetric(rank, index, activeProgram.ranks);
                            
                            // VALIDATION LOGIC FOR UI
                            // Check if current classes are less than previous rank's classes
                            const prevRank = activeProgram.ranks[index - 1];
                            const isLogicError = prevRank && (parseInt(rank.classesRequired) < parseInt(prevRank.classesRequired));

                            return (
                                <div 
                                    key={rank.id || index} 
                                    draggable
                                    onDragStart={() => (dragItem.current = index)}
                                    onDragEnter={() => (dragOverItem.current = index)}
                                    onDragEnd={handleSort}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="flex flex-col md:flex-row gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg items-center group hover:border-blue-300 transition-all cursor-move active:cursor-grabbing active:shadow-md"
                                >
                                    <div className="flex items-center gap-3">
                                        <GripVertical className="text-gray-300" size={16} />
                                        <div className="text-xs font-bold text-gray-400 w-4 text-center">{index + 1}</div>
                                    </div>

                                    {/* Color Picker */}
                                    <div className="relative group/picker">
                                        <div 
                                            className="w-8 h-8 rounded-full border shadow-sm cursor-pointer"
                                            style={{ backgroundColor: rank.color, borderColor: '#e5e7eb' }}
                                        />
                                        <div className="absolute top-8 left-0 z-20 hidden group-hover/picker:flex flex-wrap gap-1 bg-white p-2 border border-gray-200 shadow-xl rounded-lg w-36">
                                            {PRESET_COLORS.map(c => (
                                                <button
                                                    key={c.hex}
                                                    type="button"
                                                    onClick={() => handleRankChange(index, 'color', c.hex)}
                                                    className="w-5 h-5 rounded-full border hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: c.hex }}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Name Input */}
                                    <div className="flex-1 w-full">
                                        <input 
                                            type="text" 
                                            value={rank.name}
                                            onChange={(e) => handleRankChange(index, 'name', e.target.value)}
                                            placeholder="Rank Name"
                                            className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                                        />
                                    </div>

                                    {/* Attendance Threshold (With Error Styling) */}
                                    <div className="w-full md:w-24 relative group/tooltip">
                                        <input 
                                            type="number" 
                                            value={rank.classesRequired}
                                            onChange={(e) => handleRankChange(index, 'classesRequired', parseInt(e.target.value) || 0)}
                                            className={`w-full p-2 border rounded focus:ring-2 outline-none text-sm text-center ${
                                                isLogicError 
                                                ? 'bg-red-50 border-red-300 text-red-600 focus:ring-red-200' 
                                                : 'bg-white border-gray-300 focus:ring-blue-500'
                                            }`}
                                            title={isLogicError ? "Must be higher than previous rank" : "Cumulative classes required"}
                                        />
                                        {/* Error Warning Icon */}
                                        {isLogicError && (
                                            <div className="absolute -top-2 -right-2 text-red-500 bg-white rounded-full">
                                                <AlertCircle size={14} fill="white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Max Stripes */}
                                    <div className="w-full md:w-16 relative flex flex-col items-center">
                                        <input 
                                            type="number" 
                                            min="0" max="12"
                                            value={rank.maxStripes !== undefined ? rank.maxStripes : 0}
                                            onChange={(e) => handleRankChange(index, 'maxStripes', parseInt(e.target.value) || 0)}
                                            className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm text-center"
                                            placeholder="0"
                                        />
                                        {stripeMetric && !isLogicError && (
                                            <div className="absolute top-full mt-1 whitespace-nowrap z-10 bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <div className="flex items-center gap-1">
                                                    <Calculator size={10} />
                                                    {stripeMetric}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => handleRemoveRank(index)}
                                        className="text-gray-400 hover:text-red-600 p-2"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })}

                        <button 
                            onClick={handleAddRank}
                            className="w-full py-2 mt-4 border border-dashed border-gray-300 rounded-lg text-gray-500 text-sm font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Add Rank
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
                    <Layers className="h-12 w-12 mb-3 text-gray-200" />
                    <p>Select or create a program to manage ranks.</p>
                    <button 
                        onClick={() => setShowPresetModal(true)}
                        className="mt-4 text-blue-600 font-medium hover:underline"
                    >
                        Create your first program
                    </button>
                </div>
            )}
        </div>

      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save All Ranks'}
        </button>
      </div>

      {/* --- CUSTOM MODALS --- */}

      {/* 1. Preset Selection Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Select a Rank System</h3>
                    <button onClick={() => setShowPresetModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50">
                    {RANK_PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => handleCreateProgram(preset)}
                            className="flex flex-col text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
                        >
                            <span className="font-bold text-gray-800 group-hover:text-blue-600 mb-1">{preset.name}</span>
                            <span className="text-xs text-gray-500 mb-2">{preset.description}</span>
                            <div className="flex gap-1 flex-wrap">
                                {preset.ranks.slice(0, 5).map((r, i) => (
                                    <div key={i} className="w-6 h-1.5 rounded-full" style={{ backgroundColor: r.color, border: '1px solid #eee' }} />
                                ))}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 2. Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteConfirm.blockedByMembers > 0 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                    {deleteConfirm.blockedByMembers > 0 ? <Users size={24} /> : <AlertTriangle size={24} />}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {deleteConfirm.blockedByMembers > 0 ? 'Cannot Delete Program' : 'Delete Program?'}
                </h3>
                {deleteConfirm.blockedByMembers > 0 ? (
                    <div className="text-sm text-gray-500 mb-6">
                        <p className="mb-2">There are currently <b>{deleteConfirm.blockedByMembers} members</b> assigned to this program.</p>
                        <p>You must reassign them to a different program before you can delete this one.</p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 mb-6">
                        Are you sure you want to delete this program? This action cannot be undone.
                    </p>
                )}
                <div className="flex gap-3 justify-center">
                    <button 
                        onClick={() => setDeleteConfirm({ show: false, id: null, blockedByMembers: 0 })}
                        className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    >
                        {deleteConfirm.blockedByMembers > 0 ? 'Okay, Close' : 'Cancel'}
                    </button>
                    {deleteConfirm.blockedByMembers === 0 && (
                        <button 
                            onClick={confirmDeleteProgram}
                            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
                        >
                            Yes, Delete
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};