import React, { useState, useEffect } from 'react';
import {
    X, Clock, Calendar as CalendarIcon, User, RefreshCw,
    DollarSign, CheckSquare, Square, Shield, Info, AlertTriangle,
    Settings, Medal, Sliders, CalendarDays, CreditCard, CalendarRange
} from 'lucide-react';
import { createClass, updateClass, getGymDetails } from '../../../shared/api/firestore';
import { ClassSessionsList } from './ClassSessionsList';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FREQUENCIES = ["Weekly", "Bi-Weekly", "Every Three Weeks", "Once a Month"];

export const ClassFormModal = ({ isOpen, onClose, gymId, classData, staffList, membershipList = [], globalSettings, onSave }) => {
    const [activeTab, setActiveTab] = useState('schedule');
    const [rankSystems, setRankSystems] = useState([]);
    const [loading, setLoading] = useState(false);

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        name: '',
        time: '09:00',
        duration: 60,
        days: [],
        maxCapacity: 20,
        instructorId: '',
        frequency: 'Weekly',
        dropInEnabled: true,
        dropInPrice: 20,
        allowedMembershipIds: [],
        programId: '',

        // Booking Rules
        useCustomRules: false,
        bookingWindowDays: '',
        cancelWindowHours: '',
        checkInWindowMinutes: '',
        lateCancelFee: '',

        // Cancellation Data
        cancelledDates: [], // Array of ISO strings "2023-10-27"
    });

    const [activeRules, setActiveRules] = useState({
        booking: true, cancel: true, checkIn: true, fee: true
    });

    // --- INITIALIZATION ---
    useEffect(() => {
        if (isOpen && gymId) {
            const fetchRanks = async () => {
                const res = await getGymDetails(gymId);
                if (res.success && res.gym.grading?.programs) {
                    setRankSystems(res.gym.grading.programs);
                }
            };
            fetchRanks();
        }
    }, [isOpen, gymId]);

    useEffect(() => {
        if (isOpen) {
            setActiveTab('schedule');

            const getSetting = (key, hardDefault) => {
                if (classData?.bookingRules && classData.bookingRules[key] !== undefined) return classData.bookingRules[key];
                if (globalSettings && globalSettings[key] !== undefined) return globalSettings[key];
                return hardDefault;
            };

            const isRuleActive = (val) => val !== null;
            const isFeeActive = (val) => val !== null && val > 0;

            const initBooking = getSetting('bookingWindowDays', 7);
            const initCancel = getSetting('cancelWindowHours', 2);
            const initCheckIn = getSetting('checkInWindowMinutes', 60);
            const initFee = getSetting('lateCancelFee', 0);

            if (classData) {
                setFormData({
                    name: classData.name || '',
                    time: classData.time || '09:00',
                    duration: classData.duration || 60,
                    days: classData.days || [],
                    instructorId: classData.instructorId || '',
                    frequency: classData.frequency || 'Weekly',
                    dropInEnabled: classData.dropInEnabled !== undefined ? classData.dropInEnabled : true,
                    dropInPrice: classData.dropInPrice !== undefined ? classData.dropInPrice : 20,
                    allowedMembershipIds: classData.allowedMembershipIds || [],
                    programId: classData.programId || '',

                    useCustomRules: !!classData.bookingRules,
                    bookingWindowDays: initBooking ?? 7,
                    cancelWindowHours: initCancel ?? 2,
                    checkInWindowMinutes: initCheckIn ?? 60,
                    lateCancelFee: initFee ?? 0,

                    // Load Cancelled Dates
                    cancelledDates: classData.cancelledDates || [],
                });

                setActiveRules({
                    booking: classData.bookingRules ? isRuleActive(classData.bookingRules.bookingWindowDays) : isRuleActive(initBooking),
                    cancel: classData.bookingRules ? isRuleActive(classData.bookingRules.cancelWindowHours) : isRuleActive(initCancel),
                    checkIn: classData.bookingRules ? isRuleActive(classData.bookingRules.checkInWindowMinutes) : isRuleActive(initCheckIn),
                    fee: classData.bookingRules ? isFeeActive(classData.bookingRules.lateCancelFee) : isFeeActive(initFee),
                });
            } else {
                // New Class Setup
                const hasMemberships = membershipList && membershipList.length > 0;
                setFormData({
                    name: '',
                    time: '09:00',
                    duration: 60,
                    days: [],
                    instructorId: '',
                    frequency: 'Weekly',
                    dropInEnabled: !hasMemberships,
                    dropInPrice: 20,
                    allowedMembershipIds: hasMemberships ? membershipList.map(m => m.id) : [],
                    programId: '',
                    useCustomRules: false,
                    bookingWindowDays: globalSettings?.bookingWindowDays ?? 7,
                    cancelWindowHours: globalSettings?.cancelWindowHours ?? 2,
                    checkInWindowMinutes: globalSettings?.checkInWindowMinutes ?? 60,
                    lateCancelFee: globalSettings?.lateCancelFee ?? 0,
                    cancelledDates: [],
                });

                setActiveRules({
                    booking: globalSettings?.bookingWindowDays !== null,
                    cancel: globalSettings?.cancelWindowHours !== null,
                    checkIn: globalSettings?.checkInWindowMinutes !== null,
                    fee: globalSettings?.lateCancelFee !== null && globalSettings?.lateCancelFee > 0
                });
            }
        }
    }, [isOpen, classData, membershipList, globalSettings]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || formData.days.length === 0) {
            alert("Please enter a name and select at least one day.");
            return;
        }

        setLoading(true);

        const bookingRulesPayload = formData.useCustomRules ? {
            bookingWindowDays: activeRules.booking ? (parseInt(formData.bookingWindowDays) || 7) : null,
            cancelWindowHours: activeRules.cancel ? (parseInt(formData.cancelWindowHours) || 0) : null,
            checkInWindowMinutes: activeRules.checkIn ? (parseInt(formData.checkInWindowMinutes) || 30) : null,
            lateCancelFee: activeRules.fee ? (parseFloat(formData.lateCancelFee) || 0) : 0,
        } : null;

        const payload = {
            name: formData.name,
            time: formData.time,
            duration: parseInt(formData.duration) || 60,
            days: formData.days,
            instructorId: formData.instructorId,
            frequency: formData.frequency,
            dropInEnabled: formData.dropInEnabled,
            dropInPrice: parseFloat(formData.dropInPrice) || 0,
            allowedMembershipIds: formData.allowedMembershipIds,
            programId: formData.programId,
            bookingRules: bookingRulesPayload,

            // Save cancelled sessions
            cancelledDates: formData.cancelledDates,
        };

        let result;
        if (classData) {
            result = await updateClass(gymId, classData.id, payload);
        } else {
            result = await createClass(gymId, payload);
        }

        setLoading(false);

        if (result.success) {
            onSave();
            onClose();
        } else {
            alert("Failed to save class: " + result.error);
        }
    };

    // --- Handlers ---
    const toggleDay = (day) => {
        setFormData(prev => ({
            ...prev,
            days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
        }));
    };

    const toggleMembership = (id) => {
        setFormData(prev => {
            const current = prev.allowedMembershipIds || [];
            return {
                ...prev,
                allowedMembershipIds: current.includes(id) ? current.filter(m => m !== id) : [...current, id]
            };
        });
    };

    const toggleAllMemberships = () => {
        setFormData(prev => ({
            ...prev,
            allowedMembershipIds: prev.allowedMembershipIds.length === membershipList.length ? [] : membershipList.map(m => m.id)
        }));
    };

    const toggleRule = (ruleKey) => setActiveRules(prev => ({ ...prev, [ruleKey]: !prev[ruleKey] }));

    const handleNumberChange = (field, value) => {
        const val = parseFloat(value);
        if (val < 0) return;
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const isFreeClass = formData.dropInEnabled && parseFloat(formData.dropInPrice) === 0;
    const isUnbookable = !formData.dropInEnabled && formData.allowedMembershipIds.length === 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-[700px] max-h-[90vh]">

                {/* Header */}
                <div className="border-b border-gray-100 bg-gray-50 shrink-0">
                    <div className="px-6 py-4 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-800">
                            {classData ? 'Edit Class' : 'Add New Class'}
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* TABS */}
                    <div className="flex px-6 space-x-6">
                        <button onClick={() => setActiveTab('schedule')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <CalendarDays size={16} /> Schedule
                        </button>
                        <button onClick={() => setActiveTab('access')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'access' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <CreditCard size={16} /> Access
                        </button>
                        <button onClick={() => setActiveTab('settings')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            <Sliders size={16} /> Settings
                        </button>

                        {/* Only show Sessions for existing classes */}
                        {classData && (
                            <button onClick={() => setActiveTab('sessions')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sessions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <CalendarRange size={16} /> Sessions
                            </button>
                        )}
                    </div>
                </div>

                {/* Scrollable Form Body */}
                <div className="overflow-y-auto p-6 flex-1">
                    <form id="classForm" onSubmit={handleSubmit} className="space-y-6">

                        {/* === TAB 1: SCHEDULE === */}
                        {activeTab === 'schedule' && (
                            <div className="space-y-5 animate-in slide-in-from-right-4 duration-200">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Class Name</label>
                                    <input
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Morning Jiu Jitsu"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Start Time</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                            <input type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Duration (min)</label>
                                        <input type="number" required min="15" step="15" value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Instructor</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                            <select value={formData.instructorId} onChange={e => setFormData({ ...formData, instructorId: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white">
                                                <option value="">No Instructor</option>
                                                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Frequency</label>
                                        <div className="relative">
                                            <RefreshCw className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                            <select value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })} className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg bg-white">
                                                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">Repeats On</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map(day => (
                                            <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${formData.days.includes(day) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                                                {day.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === TAB 2: ACCESS & PRICING === */}
                        {activeTab === 'access' && (

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
                                        value={formData.maxCapacity}
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
                        )}

                        {/* === TAB 3: SETTINGS (RULES & RANKS) === */}
                        {activeTab === 'settings' && (
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
                        )}

                        {/* === TAB 4: SESSIONS (Single Instance Management) === */}
                        {activeTab === 'sessions' && (
                            <ClassSessionsList
                                classData={{ ...classData, ...formData }} // Pass current form state so previews update live
                                onCancelSession={(dateStr, shouldCancel) => {
                                    setFormData(prev => {
                                        const current = prev.cancelledDates || [];
                                        if (shouldCancel) {
                                            return { ...prev, cancelledDates: [...current, dateStr] };
                                        } else {
                                            return { ...prev, cancelledDates: current.filter(d => d !== dateStr) };
                                        }
                                    });
                                }}
                            />
                        )}

                    </form>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                    <button type="submit" form="classForm" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50">
                        {loading ? 'Saving...' : (classData ? 'Save Changes' : 'Create Class')}
                    </button>
                </div>

            </div>
        </div>
    );
};