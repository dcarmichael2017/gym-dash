// src/features/members/components/MemberFormModal/MemberHistoryTab.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { History, Calendar, Clock, CheckCircle, User, Filter, X } from 'lucide-react';
import { getMemberAttendanceHistory } from '../../../../../shared/api/firestore';

export const MemberHistoryTab = ({ gymId, memberId, gym }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedClass, setSelectedClass] = useState('');

    useEffect(() => {
        if (memberId) {
            const fetchHistory = async () => {
                setLoading(true);
                const res = await getMemberAttendanceHistory(gymId, memberId);
                if (res.success) {
                    console.log('Admin History Data:', res.history);
                    setHistory(res.history);
                }
                setLoading(false);
            };
            fetchHistory();
        }
    }, [gymId, memberId]);

    const programs = gym?.grading?.programs || [];

    const filteredHistory = useMemo(() => {
        return history.filter(record => {
            const programMatch = !selectedProgram || record.programId === selectedProgram;
            const classMatch = !selectedClass || record.className === selectedClass;
            return programMatch && classMatch;
        });
    }, [history, selectedProgram, selectedClass]);

    const availableClasses = useMemo(() => {
        const classNames = history
            .filter(record => !selectedProgram || record.programId === selectedProgram)
            .map(h => h.className);
        return [...new Set(classNames)].sort();
    }, [history, selectedProgram]);

    const totalAttended = filteredHistory.filter(h => h.status === 'attended').length;

    const clearFilters = () => {
        setSelectedProgram('');
        setSelectedClass('');
    };

    const isFiltered = selectedProgram || selectedClass;

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-gray-800">Attendance History</h4>
                    <p className="text-xs text-gray-500">Showing confirmed attendance records.</p>
                </div>
                {!loading && (
                    <div className="text-right">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Attended</span>
                        <p className="text-2xl font-bold text-gray-800">{totalAttended}</p>
                    </div>
                )}
            </div>

            {/* FILTERS */}
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                        value={selectedProgram}
                        onChange={(e) => {
                            setSelectedProgram(e.target.value);
                            setSelectedClass(''); // Reset class filter when program changes
                        }}
                        className="w-full bg-white border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading || programs.length === 0}
                    >
                        <option value="">All Programs</option>
                        {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading || availableClasses.length === 0}
                    >
                        <option value="">All Classes</option>
                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <button
                        onClick={clearFilters}
                        disabled={!isFiltered}
                        className="w-full flex items-center justify-center gap-2 p-2 text-sm font-medium bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X size={14} /> Clear
                    </button>
                </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Class</th>
                            <th className="px-4 py-3 font-medium text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan="3" className="px-4 py-8 text-center text-gray-400 italic">
                                    Loading history...
                                </td>
                            </tr>
                        ) : filteredHistory.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-4 py-8 text-center text-gray-400">
                                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                    <p>{isFiltered ? 'No records match your filters.' : 'No records found.'}</p>
                                </td>
                            </tr>
                        ) : (
                            filteredHistory.map(record => {
                                // --- Date Logic ---
                                let dateObj = new Date();
                                if (record.classTimestamp?.toDate) {
                                    dateObj = record.classTimestamp.toDate();
                                } else if (record.dateString) {
                                    const [y, m, d] = record.dateString.split('-').map(Number);
                                    dateObj = new Date(y, m - 1, d);
                                } else if (record.createdAt?.toDate) {
                                    dateObj = record.createdAt.toDate();
                                }

                                const isAttended = record.status === 'attended';
                                const isBooked = record.status === 'booked';
                                const isCancelled = record.status === 'cancelled';
                                const isNoShow = record.status === 'no-show';

                                return (
                                    <tr key={record.id} className={`hover:bg-gray-50 transition-colors ${isCancelled ? 'line-through text-gray-500' : ''}`}>
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">
                                                {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            {record.classTime && (
                                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock size={10} /> {record.classTime}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-gray-800 block">{record.className}</span>
                                            {/* UPDATED: Show Instructor Name if available */}
                                            {record.instructorName && (
                                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <User size={10} /> {record.instructorName}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                                ${isAttended ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                                ${isBooked ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
                                                ${isCancelled ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                                ${isNoShow ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                            `}>
                                                {isAttended && <CheckCircle size={10} className="mr-1" />}
                                                {record.status ? record.status.toUpperCase() : 'UNKNOWN'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
