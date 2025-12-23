// src/features/members/components/MemberFormModal/MemberHistoryTab.jsx
import React, { useState, useEffect } from 'react';
import { History, Calendar, Clock, CheckCircle, User } from 'lucide-react'; // Added User icon
import { getMemberAttendance } from '../../../../../../shared/api/firestore';

export const MemberHistoryTab = ({ gymId, memberId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (memberId) {
            const fetchHistory = async () => {
                setLoading(true);
                const res = await getMemberAttendance(gymId, memberId);
                if (res.success) setHistory(res.history);
                setLoading(false);
            };
            fetchHistory();
        }
    }, [gymId, memberId]);

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-gray-800">Class History</h4>
                    <p className="text-xs text-gray-500">Recent attendance & bookings</p>
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
                        ) : history.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-4 py-8 text-center text-gray-400">
                                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                    <p>No records found.</p>
                                </td>
                            </tr>
                        ) : (
                            history.map(record => {
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
                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
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
                                                ${isCancelled ? 'bg-gray-100 text-gray-600 border-gray-200' : ''}
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