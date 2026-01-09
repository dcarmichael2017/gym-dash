import React, { useState, useMemo } from 'react';
import { User, Mail, Phone, LogOut, Edit2, Check, X, Loader2, ShieldAlert, History, XCircle, Calendar, Clock, Filter } from 'lucide-react';
import { useMemberProfile } from './useMemberProfile';
import { ProfileField } from './ProfileFields';
import { MembershipSection } from './MembershipSection';
import { LegalSection } from './LegalSection';
import WaiverModal from '../dashboard/WaiverModal';
import { getMemberAttendanceHistory } from '../../../../../shared/api/firestore/bookings';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';

const MemberProfileScreen = () => {
    const {
        user, formData, setFormData, isEditing, setIsEditing, loading,
        showWaiverModal, setShowWaiverModal, currentWaiverVersion,
        handleUpdateProfile, handleCancel, handleWaiverSign, formatPhoneNumber,
        getStatusDisplay, currentGym, memberships, showSuccess
    } = useMemberProfile();

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // Filters for attendance history modal
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedClass, setSelectedClass] = useState('');

    const handleOpenHistory = async () => {
        if (!currentGym?.id || !user?.uid) return;
        setShowHistoryModal(true);
        setHistoryLoading(true);
        setSelectedProgram(''); // Reset filters
        setSelectedClass('');
        const res = await getMemberAttendanceHistory(currentGym.id, user.uid);
        if (res.success) {
            console.log('Member History Data:', res.history);
            setAttendanceHistory(res.history);
        }
        setHistoryLoading(false);
    };

    const theme = currentGym?.theme || { primaryColor: '#2563eb' };
    const myMembership = memberships?.find(m => m.gymId === currentGym?.id);
    const statusBadge = getStatusDisplay(myMembership?.status || 'guest');
    
    const hasWaiver = myMembership?.waiverSigned === true;
    const userSignedVersion = myMembership?.waiverSignedVersion || 0;
    const isOutdated = hasWaiver && userSignedVersion < currentWaiverVersion;

    // --- Filtering Logic for History Modal ---
    const programs = currentGym?.grading?.programs || [];

    const filteredHistory = useMemo(() => {
        return attendanceHistory.filter(record => {
            const programMatch = !selectedProgram || record.programId === selectedProgram;
            const classMatch = !selectedClass || record.className === selectedClass;
            return programMatch && classMatch;
        });
    }, [attendanceHistory, selectedProgram, selectedClass]);

    const availableClasses = useMemo(() => {
        const classNames = attendanceHistory
            .filter(record => !selectedProgram || record.programId === selectedProgram)
            .map(h => h.className);
        return [...new Set(classNames)].sort();
    }, [attendanceHistory, selectedProgram]);

    const isFiltered = selectedProgram || selectedClass;
    const clearFilters = () => {
        setSelectedProgram('');
        setSelectedClass('');
    };
    // --- End Filtering Logic ---

    return (
        <div className="pb-32 bg-gray-50 min-h-screen relative">
            {/* ATTENDANCE HISTORY MODAL */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
                        <div className="p-4 border-b flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <History size={18} className="text-gray-500" />
                                <h3 className="font-bold text-lg text-gray-800">Attendance History</h3>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-800 transition-colors">
                                <XCircle size={22}/>
                            </button>
                        </div>

                        {/* FILTERS */}
                        <div className="p-3 bg-gray-50/70 border-b">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <select
                                    value={selectedProgram}
                                    onChange={(e) => {
                                        setSelectedProgram(e.target.value);
                                        setSelectedClass('');
                                    }}
                                    className="w-full bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    disabled={historyLoading || programs.length === 0}
                                >
                                    <option value="">Filter by Program</option>
                                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>

                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    disabled={historyLoading || availableClasses.length === 0}
                                >
                                    <option value="">Filter by Class</option>
                                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            {isFiltered && (
                                <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline font-semibold mt-2 text-center w-full">
                                    Clear Filters
                                </button>
                            )}
                        </div>
                        
                        <div className="p-2 sm:p-4 overflow-y-auto">
                            {historyLoading ? (
                                <div className="text-center py-16 text-gray-500">
                                    <Loader2 className="animate-spin inline-block mb-2" />
                                    <p>Loading history...</p>
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div className="text-center py-16 text-gray-500">
                                    <Calendar className="inline-block mb-2" />
                                    <p>{isFiltered ? 'No records match your filters.' : 'No attendance records found.'}</p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {filteredHistory.map(record => {
                                        const isAttended = record.status === 'attended';
                                        const isBooked = record.status === 'booked';
                                        const isCancelled = record.status === 'cancelled';
                                        const isNoShow = record.status === 'no-show';
                                        const isWaitlisted = record.status === 'waitlisted';

                                        let badgeStyle = 'bg-gray-100 text-gray-600 border-gray-200';
                                        if (isAttended) badgeStyle = 'bg-green-100 text-green-800 border-green-200';
                                        if (isBooked) badgeStyle = 'bg-blue-100 text-blue-800 border-blue-200';
                                        if (isCancelled || isNoShow) badgeStyle = 'bg-red-100 text-red-800 border-red-200';
                                        if (isWaitlisted) badgeStyle = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                        
                                        return (
                                            <li key={record.id} className={`bg-gray-50 p-3 rounded-lg border border-gray-200 ${isCancelled ? 'opacity-60' : ''}`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <p className={`font-semibold text-sm text-gray-900 ${isCancelled ? 'line-through' : ''}`}>{record.className}</p>
                                                        {record.instructorName && (
                                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                                <User size={12} /> {record.instructorName}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right text-xs text-gray-500 shrink-0 ml-2">
                                                        {record.classTimestamp?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        {record.classTime && <div className="flex items-center justify-end gap-1 mt-0.5"><Clock size={10} /> {record.classTime}</div>}
                                                    </div>
                                                </div>
                                                <div className="mt-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>
                                                        {record.status ? record.status.toUpperCase() : 'UNKNOWN'}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SUCCESS TOAST */}
            {showSuccess && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
                        <div className="bg-green-500 rounded-full p-1">
                            <Check size={14} className="text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-bold">Profile updated successfully</span>
                    </div>
                </div>
            )}

            {showWaiverModal && (
                <WaiverModal
                    gymId={currentGym.id} gymName={currentGym.name} theme={theme}
                    onAccept={handleWaiverSign} onDecline={() => setShowWaiverModal(false)}
                    onClose={() => setShowWaiverModal(false)}
                    viewOnly={hasWaiver && !isOutdated}
                    targetVersion={hasWaiver && !isOutdated ? userSignedVersion : currentWaiverVersion}
                    lastSignedVersion={userSignedVersion} isUpdate={isOutdated}
                />
            )}

            {/* HEADER */}
            <div className="bg-white p-6 pb-8 rounded-b-[2rem] shadow-sm border-b border-gray-100">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-3xl font-bold text-gray-900 truncate">
                            {formData.firstName} {formData.lastName}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{user?.email}</p>
                        <div className={`mt-3 inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusBadge.color}`}>
                            {statusBadge.label}
                        </div>
                    </div>

                    <div className="flex gap-2 shrink-0 ml-4">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:text-gray-900 transition-all">
                                <Edit2 size={18} />
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={handleCancel} className="p-2 bg-gray-50 rounded-full text-gray-500"><X size={18} /></button>
                                <button 
                                    onClick={handleUpdateProfile} 
                                    disabled={loading} 
                                    className="p-2 rounded-full text-white shadow-md flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50" 
                                    style={{ backgroundColor: theme.primaryColor }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* 1. PERSONAL DETAILS SECTION */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <ProfileField 
                        icon={User} 
                        label="First Name" 
                        value={formData.firstName} 
                        isEditing={isEditing} 
                        editable 
                        onChange={e => setFormData({...formData, firstName: e.target.value})} 
                        placeholder="John"
                    />
                    <ProfileField 
                        icon={User} 
                        label="Last Name" 
                        value={formData.lastName} 
                        isEditing={isEditing} 
                        editable 
                        onChange={e => setFormData({...formData, lastName: e.target.value})} 
                        placeholder="Doe"
                    />
                    <ProfileField 
                        icon={Phone} 
                        label="Phone Number" 
                        value={formData.phoneNumber} 
                        isEditing={isEditing} 
                        editable 
                        onChange={e => setFormData({...formData, phoneNumber: formatPhoneNumber(e.target.value)})} 
                        placeholder="(555) 000-0000"
                    />
                    <ProfileField icon={Mail} label="Email Address" value={user?.email} editable={false} />
                </div>

                {/* 2. EMERGENCY CONTACT SECTION (NEW) */}
                <div>
                     <div className="flex items-center gap-2 mb-3 px-1">
                        <ShieldAlert size={16} className="text-red-500" />
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Emergency Contact</h4>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <ProfileField 
                            icon={User} 
                            label="Contact Name" 
                            value={formData.emergencyName} 
                            isEditing={isEditing} 
                            editable 
                            onChange={e => setFormData({...formData, emergencyName: e.target.value})} 
                            placeholder="Full Name"
                        />
                        <ProfileField 
                            icon={Phone} 
                            label="Contact Phone" 
                            value={formData.emergencyPhone} 
                            isEditing={isEditing} 
                            editable 
                            onChange={e => setFormData({...formData, emergencyPhone: formatPhoneNumber(e.target.value)})} 
                            placeholder="(555) 000-0000"
                        />
                    </div>
                </div>

                <MembershipSection 
                    planName={myMembership?.planName}
                    status={myMembership?.status}
                    onManageBilling={() => alert("Redirecting to Stripe...")}
                />

                {currentGym && (
                    <LegalSection 
                        hasWaiver={hasWaiver}
                        isOutdated={isOutdated}
                        version={userSignedVersion}
                        onOpenWaiver={() => setShowWaiverModal(true)}
                    />
                )}

                <button
                    onClick={handleOpenHistory}
                    className="w-full py-4 rounded-2xl bg-white text-gray-700 font-bold text-sm border border-gray-200 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                    <History size={18} /> View Attendance History
                </button>

                <button 
                    onClick={() => auth.signOut()} 
                    className="w-full py-4 rounded-2xl bg-white text-red-600 font-bold text-sm border border-red-100 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                    <LogOut size={18} /> Sign Out
                </button>
            </div>
        </div>
    );
};

export default MemberProfileScreen;
