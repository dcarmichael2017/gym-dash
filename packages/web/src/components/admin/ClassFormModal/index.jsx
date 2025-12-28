import React, { useState, useEffect } from 'react';
import { X, CalendarDays, CreditCard, Sliders, CalendarRange } from 'lucide-react';
import { createClass, updateClass, getGymDetails } from '../../../../../shared/api/firestore';
import { ClassSessionsList } from '../ClassSessionsList';
import { useConfirm } from '../../../context/ConfirmationContext';
import { TabSchedule } from './TabSchedule';
import { TabAccess } from './TabAccess';
import { TabSettings } from './TabSettings';

export const ClassFormModal = ({ isOpen, onClose, gymId, classData, staffList, membershipList = [], globalSettings, onSave, initialViewMode }) => {
    const { showConfirm } = useConfirm();
    const [activeTab, setActiveTab] = useState('schedule');
    const [rankSystems, setRankSystems] = useState([]);
    const [loading, setLoading] = useState(false);
    const isExistingClass = classData && classData.id;

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        name: '',
        time: '09:00',
        duration: 60,
        startDate: '',
        days: [],
        maxCapacity: 20,
        instructorId: '',
        frequency: 'Weekly',
        dropInEnabled: true,
        dropInPrice: 20,
        allowedMembershipIds: [],
        programId: '',
        useCustomRules: false,
        bookingWindowDays: '',
        cancelWindowHours: '',
        checkInWindowMinutes: '',
        lateCancelFee: '',
        cancelledDates: [],
        // NEW: Visibility Field
        visibility: 'public' 
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
                    startDate: classData.startDate || '',
                    days: classData.days || [],
                    maxCapacity: classData.maxCapacity !== undefined ? classData.maxCapacity : 20,
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
                    cancelledDates: classData.cancelledDates || [],
                    // Load existing visibility or default to public
                    visibility: classData.visibility || 'public' 
                });

                setActiveRules({
                    booking: classData.bookingRules ? isRuleActive(classData.bookingRules.bookingWindowDays) : isRuleActive(initBooking),
                    cancel: classData.bookingRules ? isRuleActive(classData.bookingRules.cancelWindowHours) : isRuleActive(initCancel),
                    checkIn: classData.bookingRules ? isRuleActive(classData.bookingRules.checkInWindowMinutes) : isRuleActive(initCheckIn),
                    fee: classData.bookingRules ? isFeeActive(classData.bookingRules.lateCancelFee) : isFeeActive(initFee),
                });
            } else {
                const defaultFreq = initialViewMode === 'events' ? 'Single Event' : 'Weekly';
                const defaultDate = initialViewMode === 'events' ? new Date().toISOString().split('T')[0] : '';
                const hasMemberships = membershipList && membershipList.length > 0;
                setFormData({
                    name: '',
                    time: '09:00',
                    duration: 60,
                    startDate: defaultDate,
                    frequency: defaultFreq,
                    days: defaultFreq === 'Single Event' ? [] : [], // Ensure empty days for single event
                    maxCapacity: 20,
                    instructorId: '',
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
                    // Default for new classes
                    visibility: 'public'
                });

                setActiveRules({
                    booking: globalSettings?.bookingWindowDays !== null,
                    cancel: globalSettings?.cancelWindowHours !== null,
                    checkIn: globalSettings?.checkInWindowMinutes !== null,
                    fee: globalSettings?.lateCancelFee !== null && globalSettings?.lateCancelFee > 0
                });
            }
        }
    }, [isOpen, classData, membershipList, globalSettings, initialViewMode]);

    // --- HANDLERS ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Validate Name (Required for all)
        if (!formData.name) {
            await showConfirm({
                title: "Missing Name",
                message: "Please enter a name for this class.",
                confirmText: "OK",
                cancelText: null // Hides the cancel button to act like an Alert
            });
            return;
        }

        // 2. Validate Schedule based on Frequency
        if (formData.frequency === 'Single Event') {
            // Logic for One-Off: Must have a Date
            if (!formData.startDate) {
                await showConfirm({
                    title: "Missing Date",
                    message: "Please select a specific date for this single event.",
                    confirmText: "OK",
                    cancelText: null
                });
                return;
            }
        } else {
            // Logic for Recurring: Must have Days of Week
            if (formData.days.length === 0) {
                await showConfirm({
                    title: "Missing Days",
                    message: "Please select at least one day of the week for this recurring class.",
                    confirmText: "OK",
                    cancelText: null
                });
                return;
            }
        }

        setLoading(true);

        const bookingRulesPayload = formData.useCustomRules ? {
            bookingWindowDays: activeRules.booking ? (parseInt(formData.bookingWindowDays) || 7) : null,
            cancelWindowHours: activeRules.cancel ? (parseInt(formData.cancelWindowHours) || 0) : null,
            checkInWindowMinutes: activeRules.checkIn ? (parseInt(formData.checkInWindowMinutes) || 30) : null,
            lateCancelFee: activeRules.fee ? (parseFloat(formData.lateCancelFee) || 0) : 0,
        } : null;

        const payload = {
            ...formData,
            duration: parseInt(formData.duration) || 60,
            dropInPrice: parseFloat(formData.dropInPrice) || 0,
            maxCapacity: parseInt(formData.maxCapacity) || 0,
            bookingRules: bookingRulesPayload,
            // Ensure visibility is sent
            visibility: formData.visibility || 'public'
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
            await showConfirm({
                title: "Error",
                message: "Failed to save class: " + result.error,
                confirmText: "OK",
                cancelText: null
            });
        }
    };

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-[700px] max-h-[90vh]">

                {/* Header */}
                <div className="border-b border-gray-100 bg-gray-50 shrink-0">
                    <div className="px-6 py-4 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-800">
                            {isExistingClass ? 'Edit Class' : 'Add New Class'}
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
                        {isExistingClass && (
                            <button onClick={() => setActiveTab('sessions')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sessions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <CalendarRange size={16} /> Sessions
                            </button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-6 flex-1">
                    <form id="classForm" onSubmit={handleSubmit} className="space-y-6">
                        {activeTab === 'schedule' && (
                            <TabSchedule
                                formData={formData}
                                setFormData={setFormData}
                                staffList={staffList}
                                toggleDay={toggleDay}
                            />
                        )}

                        {activeTab === 'access' && (
                            <TabAccess
                                formData={formData}
                                setFormData={setFormData}
                                membershipList={membershipList}
                                toggleMembership={toggleMembership}
                                toggleAllMemberships={toggleAllMemberships}
                                handleNumberChange={handleNumberChange}
                            />
                        )}

                        {activeTab === 'settings' && (
                            <TabSettings
                                formData={formData}
                                setFormData={setFormData}
                                rankSystems={rankSystems}
                                activeRules={activeRules}
                                toggleRule={toggleRule}
                                handleNumberChange={handleNumberChange}
                            />
                        )}

                        {activeTab === 'sessions' && (
                            <ClassSessionsList
                                classData={{ ...classData, ...formData }}
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

                {/* Footer */}
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