import React, { useState, useEffect } from 'react';
import { X, CalendarDays, CreditCard, Sliders, CalendarRange, Trash2, CheckCircle, Copy, AlertTriangle } from 'lucide-react';
import { createClass, updateClass, getGymDetails, getFutureBookingsForClass, migrateClassSeries, getAllBookingsForClass, deleteClass, handleClassSeriesRetirement } from '../../../../../shared/api/firestore';
import { ClassSessionsList } from '../ClassSessionsList';
import { useConfirm } from '../../../context/ConfirmationContext';
import { TabSchedule } from './TabSchedule';
import { TabAccess } from './TabAccess';
import { TabSettings } from './TabSettings';

export const ClassFormModal = ({ isOpen, onClose, gymId, classData, staffList, membershipList = [], globalSettings, onSave, initialViewMode, onSessionClick }) => {
    const { confirm: showConfirm } = useConfirm();
    const [activeTab, setActiveTab] = useState('schedule');
    const [rankSystems, setRankSystems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isClassActive, setIsClassActive] = useState(false);
    const [migrationReport, setMigrationReport] = useState(null);
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
        dropInEnabled: false, // ✅ Default OFF
        creditCost: 1, 
        allowedMembershipIds: [],
        programId: '',
        useCustomRules: false,
        bookingWindowDays: '',
        cancelWindowHours: '',
        checkInWindowMinutes: '',
        lateCancelFee: '',
        lateBookingMinutes: '',
        cancelledDates: [],
        visibility: 'public' 
    });

    const [activeRules, setActiveRules] = useState({
        booking: true, cancel: true, checkIn: true, fee: true, lateBooking: true
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
            setMigrationReport(null);

            // Active Session Immunity Check
            if (classData?.id && classData.days?.length > 0) {
                const now = new Date();
                const dayMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const todayName = dayMap[now.getDay()];

                if (classData.days.includes(todayName)) {
                    const [h, m] = classData.time.split(':').map(Number);
                    const classStart = new Date(now);
                    classStart.setHours(h, m, 0, 0);
                    const classEnd = new Date(classStart.getTime() + (classData.duration || 60) * 60000);
                    setIsClassActive(now >= classStart && now <= classEnd);
                } else {
                    setIsClassActive(false);
                }
            } else {
                setIsClassActive(false);
            }

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
            const initLateBooking = getSetting('lateBookingMinutes', 15);

            if (classData) {
                // UX FIX: If cost is 0 in DB (because it was disabled), show 1 in the UI input so it's ready to use if toggled on.
                const visualCreditCost = (classData.creditCost && classData.creditCost > 0) ? classData.creditCost : 1;

                setFormData({
                    name: classData.name || '',
                    time: classData.time || '09:00',
                    duration: classData.duration || 60,
                    startDate: classData.startDate || '',
                    days: classData.days || [],
                    maxCapacity: classData.maxCapacity !== undefined ? classData.maxCapacity : 20,
                    instructorId: classData.instructorId || '',
                    frequency: classData.frequency || 'Weekly',
                    // ✅ UPDATE: Use stored value, or default to FALSE if undefined
                    dropInEnabled: classData.dropInEnabled !== undefined ? classData.dropInEnabled : false,
                    creditCost: visualCreditCost, 
                    allowedMembershipIds: classData.allowedMembershipIds || [],
                    programId: classData.programId || '',
                    useCustomRules: !!classData.bookingRules,
                    bookingWindowDays: initBooking ?? 7,
                    cancelWindowHours: initCancel ?? 2,
                    checkInWindowMinutes: initCheckIn ?? 60,
                    lateBookingMinutes: initLateBooking ?? 15,
                    lateCancelFee: initFee ?? 0,
                    cancelledDates: classData.cancelledDates || [],
                    visibility: classData.visibility || 'public' 
                });

                setActiveRules({
                    booking: classData.bookingRules ? isRuleActive(classData.bookingRules.bookingWindowDays) : isRuleActive(initBooking),
                    cancel: classData.bookingRules ? isRuleActive(classData.bookingRules.cancelWindowHours) : isRuleActive(initCancel),
                    checkIn: classData.bookingRules ? isRuleActive(classData.bookingRules.checkInWindowMinutes) : isRuleActive(initCheckIn),
                    fee: classData.bookingRules ? isFeeActive(classData.bookingRules.lateCancelFee) : isFeeActive(initFee),
                    lateBooking: classData.bookingRules ? isRuleActive(classData.bookingRules.lateBookingMinutes) : isRuleActive(initLateBooking),
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
                    days: defaultFreq === 'Single Event' ? [] : [], 
                    maxCapacity: 20,
                    instructorId: '',
                    // ✅ UPDATE: Forced FALSE for new classes
                    dropInEnabled: false, 
                    creditCost: 1, 
                    allowedMembershipIds: hasMemberships ? membershipList.filter(m => m.interval !== 'one_time').map(m => m.id) : [],
                    programId: '',
                    useCustomRules: false,
                    bookingWindowDays: globalSettings?.bookingWindowDays ?? 7,
                    cancelWindowHours: globalSettings?.cancelWindowHours ?? 2,
                    checkInWindowMinutes: globalSettings?.checkInWindowMinutes ?? 60,
                    lateCancelFee: globalSettings?.lateCancelFee ?? 0,
                    lateBookingMinutes: globalSettings?.lateBookingMinutes ?? 15,
                    cancelledDates: [],
                    visibility: 'public'
                });

                setActiveRules({
                    booking: globalSettings?.bookingWindowDays !== null,
                    cancel: globalSettings?.cancelWindowHours !== null,
                    checkIn: globalSettings?.checkInWindowMinutes !== null,
                    fee: globalSettings?.lateCancelFee !== null && globalSettings?.lateCancelFee > 0,
                    lateBooking: globalSettings?.lateBookingMinutes !== null
                });
            }
        }
    }, [isOpen, classData, membershipList, globalSettings, initialViewMode]);

    // --- HANDLERS ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name) {
            await showConfirm({
                title: "Missing Name",
                message: "Please enter a name for this class.",
                confirmText: "OK",
                cancelText: null 
            });
            return;
        }

        if (formData.frequency === 'Single Event') {
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

        const hasScheduleChanged = isExistingClass && formData.frequency !== 'Single Event' && (
            formData.time !== classData.time ||
            JSON.stringify((formData.days || []).sort()) !== JSON.stringify((classData.days || []).sort())
        );

        const bookingRulesPayload = formData.useCustomRules ? {
            bookingWindowDays: activeRules.booking ? (parseInt(formData.bookingWindowDays) || 7) : null,
            cancelWindowHours: activeRules.cancel ? (parseInt(formData.cancelWindowHours) || 0) : null,
            checkInWindowMinutes: activeRules.checkIn ? (parseInt(formData.checkInWindowMinutes) || 30) : null,
            lateCancelFee: activeRules.fee ? (parseFloat(formData.lateCancelFee) || 0) : 0,
            lateBookingMinutes: activeRules.lateBooking ? (parseInt(formData.lateBookingMinutes) || 0) : null,
        } : null;

        // ✅ This logic is correct: It saves 0 if disabled, but uses input if enabled.
        const finalCreditCost = formData.dropInEnabled ? (parseInt(formData.creditCost) || 0) : 0;

        const payload = {
            ...formData,
            duration: parseInt(formData.duration) || 60,
            dropInEnabled: formData.dropInEnabled, // explicitly passing true/false
            creditCost: finalCreditCost, 
            maxCapacity: parseInt(formData.maxCapacity) || 0,
            bookingRules: bookingRulesPayload,
            visibility: formData.visibility || 'public'
        };

        if (hasScheduleChanged) {
            const today = new Date().toISOString().split('T')[0];
            const futureBookingsRes = await getFutureBookingsForClass(gymId, classData.id, today);

            if (futureBookingsRes.success && futureBookingsRes.bookings.length > 0) {
                const confirmed = await showConfirm({
                    title: "Migrate Class Series?",
                    message: `This schedule change will cancel ${futureBookingsRes.bookings.length} upcoming booking(s). Members will be refunded and the old series will be hidden. A new series with these settings will be created. Proceed?`,
                    confirmText: "Yes, Migrate Series",
                    cancelText: "Go Back",
                    type: 'danger'
                });

                if (!confirmed) return;
                
                setLoading(true);
                const result = await migrateClassSeries(gymId, { oldClassId: classData.id, cutoffDateString: today, newClassData: payload });

                if (result.success) {
                    setMigrationReport({ title: 'Migration Successful', count: result.refundedUserIds.length, list: result.refundedUserIds.join('\n') });
                } else {
                    await showConfirm({ title: "Error", message: `Migration failed: ${result.error}`, confirmText: "OK", cancelText: null });
                }
                setLoading(false);
                return;
            }
        }

        setLoading(true);

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

    // ... Rest of the component (handlers, render) remains the same
    
    // (Copied Handlers to ensure completeness of the snippet)
    const handleClassSeriesRetirement = async () => {
        if (!isExistingClass) return;

        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const futureBookingsRes = await getFutureBookingsForClass(gymId, classData.id, today);
        setLoading(false);

        const hasFutureBookings = futureBookingsRes.success && futureBookingsRes.bookings.length > 0;
        let confirmed = false;
        let refundPolicy = 'none';

        if (hasFutureBookings) {
            const bookingCount = futureBookingsRes.bookings.length;
            confirmed = await showConfirm({
                title: "Impact Review",
                message: `This series has ${bookingCount} upcoming booking(s) that will be cancelled.`,
                confirmText: "Refund Credits & Archive",
                cancelText: "Cancel",
                type: 'danger'
            });
            if (confirmed) {
                refundPolicy = 'refund';
            }
        } else {
             confirmed = await showConfirm({
                title: "End Class Series?",
                message: "No future bookings found. This will archive or delete the series based on its past history.",
                confirmText: "Yes, End Series",
                cancelText: "Cancel"
            });
        }
        
        if (confirmed) {
            setLoading(true);
            const result = await handleClassSeriesRetirement(gymId, classData.id, refundPolicy);
            if (result.success) {
                let reportTitle = result.action === 'deleted' ? 'Series Deleted' : 'Series Ended';
                setMigrationReport({ title: reportTitle, count: result.refundedCount || 0, list: result.refundedUserIds?.join('\n') || '' });
            } else {
                await showConfirm({ title: "Error", message: `Failed to end series: ${result.error}`, confirmText: "OK", cancelText: null });
            }
            setLoading(false);
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
        const recurringPlans = membershipList.filter(m => m.interval !== 'one_time');
        setFormData(prev => ({
            ...prev,
            allowedMembershipIds: prev.allowedMembershipIds.length === recurringPlans.length ? [] : recurringPlans.map(m => m.id)
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
                    {migrationReport ? (
                        <div className="text-center flex flex-col items-center justify-center h-full animate-in fade-in">
                            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                            <h3 className="text-xl font-bold text-gray-800">{migrationReport.title}</h3>
                            <p className="text-gray-500 mt-1">
                                {migrationReport.count > 0 
                                    ? `${migrationReport.count} member(s) with future bookings were refunded.` 
                                    : "No members were affected."
                                }
                            </p>
                            {migrationReport.count > 0 && (
                                <div className="w-full max-w-xs mt-4">
                                    <textarea readOnly value={migrationReport.list} rows={5} className="w-full text-xs p-2 border rounded-md bg-gray-50 text-gray-600" />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(migrationReport.list)}
                                        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors"
                                    >
                                        <Copy size={14} /> Copy List
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
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
                                    isReadOnly={isClassActive}
                                    globalSettings={globalSettings}
                                />
                            )}

                            {activeTab === 'sessions' && (
                                <ClassSessionsList
                                    gymId={gymId}
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
                                    onSessionClick={onSessionClick}
                                />
                            )}
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t border-gray-100 bg-gray-50 flex ${isExistingClass && !migrationReport ? 'justify-between' : 'justify-end'} items-center gap-3 shrink-0`}>
                    {isExistingClass && !migrationReport && (
                        <button
                            type="button"
                            onClick={handleClassSeriesRetirement}
                            disabled={loading}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           <Trash2 size={14} /> End Series
                        </button>
                    )}

                    {migrationReport ? (
                        <button type="button" onClick={() => { onSave(); onClose(); }} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm">
                            Done
                        </button>
                    ) : (
                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                            <button type="submit" form="classForm" disabled={loading || isClassActive} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50">
                                {loading ? 'Saving...' : (classData ? 'Save Changes' : 'Create Class')}
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};