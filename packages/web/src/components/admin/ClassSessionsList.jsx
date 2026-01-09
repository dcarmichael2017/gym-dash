import React, { useState, useEffect } from 'react';
import { Calendar, XCircle, CheckCircle, Users, Loader2 } from 'lucide-react';
import { getFutureBookingsForClass } from '../../../../shared/api/firestore';

export const ClassSessionsList = ({ gymId, classData, onCancelSession, onSessionClick }) => {
    const [bookingCounts, setBookingCounts] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (gymId && classData?.id) {
            const fetchCounts = async () => {
                setLoading(true);
                const today = new Date().toISOString().split('T')[0];
                const res = await getFutureBookingsForClass(gymId, classData.id, today);
                if (res.success) {
                    const counts = res.bookings.reduce((acc, booking) => {
                        acc[booking.dateString] = (acc[booking.dateString] || 0) + 1;
                        return acc;
                    }, {});
                    setBookingCounts(counts);
                }
                setLoading(false);
            };
            fetchCounts();
        } else {
            setLoading(false);
        }
    }, [gymId, classData?.id]);
    
    const generateUpcomingSessions = () => {
        if (classData.frequency === 'Single Event') {
            if (!classData.startDate) return [];
            
            const [y, m, d] = classData.startDate.split('-').map(Number);
            const [h, min] = classData.time.split(':').map(Number);
            const evtDate = new Date(y, m - 1, d, h, min);
            
            // Check if it's in the past (Optional: maybe show it anyway for context?)
            // If you want to show it regardless of date:
            return [{
                dateObj: evtDate,
                dateStr: classData.startDate,
                dayName: evtDate.toLocaleDateString('en-US', { weekday: 'long' }),
                isCancelled: classData.cancelledDates?.includes(classData.startDate)
            }];
        }
        
        if (!classData || !classData.days || classData.days.length === 0) return [];
        
        const sessions = [];
        const now = new Date(); // Current moment (Date + Time)
        
        // Start checking from "Today" at 00:00 to catch today's later classes
        const checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);

        // Look ahead 28 days (4 weeks)
        for (let i = 0; i < 28; i++) {
            const date = new Date(checkDate);
            date.setDate(checkDate.getDate() + i);
            
            const dateStr = date.toISOString().split('T')[0];
            if (classData.recurrenceEndDate && dateStr > classData.recurrenceEndDate) {
                break; // Stop generating sessions past the end date.
            }
            
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            
            if (classData.days.includes(dayName)) {
                // --- STRICT TIME CHECK ---
                // 1. Parse Class Time "09:30" -> Hours/Minutes
                const [hours, minutes] = classData.time.split(':').map(Number);
                
                // 2. Create specific Date object for this session instance
                const sessionDateTime = new Date(date);
                sessionDateTime.setHours(hours, minutes, 0, 0);

                // 3. Compare with NOW
                // If the session start time is in the past, skip it.
                if (sessionDateTime < now) continue;

                const isCancelled = classData.cancelledDates?.includes(dateStr);

                sessions.push({
                    dateObj: sessionDateTime, // Use the full datetime for sorting/display if needed
                    dateStr: dateStr,
                    dayName: dayName,
                    isCancelled: isCancelled
                });
            }
        }
        return sessions;
    };

    const sessions = generateUpcomingSessions();

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-800">Upcoming Sessions</h4>
                <span className="text-xs text-gray-500">Next 4 Weeks</span>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
                {sessions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p>No upcoming sessions found.</p>
                        <p className="text-xs mt-1 text-gray-300">(Past sessions are hidden)</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sessions.map((session, idx) => {
                            const count = bookingCounts[session.dateStr] || 0;
                            const capacity = classData.maxCapacity || '∞';

                            return (
                            <div 
                                key={idx} 
                                className={`p-3 ${session.isCancelled ? 'bg-gray-50 opacity-60' : 'bg-white group transition-colors ' + (onSessionClick ? 'cursor-pointer hover:bg-gray-50' : '')}`}
                                onClick={() => !session.isCancelled && onSessionClick && onSessionClick(classData, session.dateStr)}
                            >
                               <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${session.isCancelled ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${session.isCancelled ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                {session.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </p>
                                            <p className="text-xs text-gray-500 flex items-center divide-x divide-gray-300">
                                                <span className="pr-2">{classData.time} • {classData.duration} min</span>
                                                <span className="pl-2 flex items-center gap-1 font-medium text-gray-600 group-hover:text-blue-600">
                                                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
                                                    <span>{loading ? '' : `${count} / ${capacity}`}</span>
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    {session.isCancelled ? (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onCancelSession(session.dateStr, false); }} // Restore
                                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            <CheckCircle size={12} /> Restore
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onCancelSession(session.dateStr, true); }} // Cancel
                                            className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                                        >
                                            <XCircle size={12} /> Cancel
                                        </button>
                                    )}
                               </div>
                            </div>
                        )})}
                    </div>
                )}
            </div>
        </div>
    );
};
