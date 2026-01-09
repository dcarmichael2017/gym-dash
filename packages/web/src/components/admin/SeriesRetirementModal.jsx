import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Calendar, User, AlertTriangle, ArrowRight } from 'lucide-react';
import { getFutureBookingsForClass, handleClassSeriesRetirement, convertSeriesToSingleEvent } from '../../../../shared/api/firestore';
import { useConfirm } from '../../context/ConfirmationContext';

export const SeriesRetirementModal = ({ isOpen, onClose, gymId, classData, onRetireComplete }) => {
    const [loading, setLoading] = useState(true);
    const [groupedBookings, setGroupedBookings] = useState({});
    const [selectedDates, setSelectedDates] = useState(new Set());
    const [isRetiring, setIsRetiring] = useState(false);
    const { confirm } = useConfirm();

    useEffect(() => {
        if (isOpen && gymId && classData) {
            const fetchBookings = async () => {
                setLoading(true);
                const today = new Date().toISOString().split('T')[0];
                const res = await getFutureBookingsForClass(gymId, classData.id, today);
                if (res.success) {
                    const groups = res.bookings.reduce((acc, booking) => {
                        const date = booking.dateString;
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(booking);
                        return acc;
                    }, {});
                    setGroupedBookings(groups);
                }
                setLoading(false);
            };
            fetchBookings();
        } else {
            // Reset state when closed
            setGroupedBookings({});
            setSelectedDates(new Set());
            setLoading(true);
            setIsRetiring(false);
        }
    }, [isOpen, gymId, classData]);

    const sortedDates = useMemo(() => Object.keys(groupedBookings).sort(), [groupedBookings]);

    const handleToggleDate = (dateString) => {
        setSelectedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dateString)) {
                newSet.delete(dateString);
            } else {
                newSet.add(dateString);
            }
            return newSet;
        });
    };

    const handleRetire = async () => {
        const toRescue = Array.from(selectedDates);
        const toCancelCount = sortedDates.length - toRescue.length;

        const confirmed = await confirm({
            title: "Confirm Retirement",
            message: (
                <div>
                    <p>You are about to finalize this action:</p>
                    <ul className="list-disc list-inside text-sm text-left mt-2 space-y-1">
                        <li><strong>{toRescue.length} session(s)</strong> will be kept as one-off events.</li>
                        <li><strong>{toCancelCount} session(s)</strong> will be cancelled and refunded.</li>
                        <li>The recurring series <strong>"{classData.name}"</strong> will be archived.</li>
                    </ul>
                </div>
            ),
            confirmText: "Yes, Proceed",
            type: 'danger'
        });

        if (!confirmed) return;

        setIsRetiring(true);

        // 1. "Rescue" the selected sessions by converting them
        for (const dateStr of toRescue) {
            await convertSeriesToSingleEvent(gymId, classData.id, dateStr);
        }

        // 2. Archive the original series (this will refund anyone not rescued)
        await handleClassSeriesRetirement(gymId, classData.id, 'refund');
        
        setIsRetiring(false);
        onRetireComplete();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[600px] max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" />
                        <h3 className="font-bold text-lg text-gray-800">Retire Class Series</h3>
                    </div>
                    <button onClick={onClose} disabled={isRetiring} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <Loader2 className="animate-spin mr-2" /> Loading future bookings...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-gray-800">Impact Review</h4>
                                <p className="text-sm text-gray-500">The following future sessions have bookings. Choose which ones to keep by converting them to one-off events.</p>
                            </div>
                            <ul className="space-y-2">
                                {sortedDates.map(dateStr => {
                                    const bookingsOnDate = groupedBookings[dateStr];
                                    const isSelected = selectedDates.has(dateStr);
                                    const dateObj = new Date(dateStr + 'T00:00:00'); // Ensure correct date parsing
                                    const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

                                    return (
                                        <li key={dateStr}>
                                            <label className={`block p-3 rounded-lg border-2 transition-all cursor-pointer ${isSelected ? 'bg-green-50 border-green-400 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className={`font-semibold ${isSelected ? 'text-green-800' : 'text-gray-700'}`}>{formattedDate}</p>
                                                        <p className={`text-xs flex items-center gap-1 ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                                                            <User size={12} /> {bookingsOnDate.length} booking(s)
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleDate(dateStr)}
                                                        className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                </div>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 border-t bg-gray-50 shrink-0">
                    <button
                        onClick={handleRetire}
                        disabled={loading || isRetiring}
                        className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isRetiring ? <Loader2 className="animate-spin" /> : <Trash2 size={16} />}
                        {isRetiring ? 'Processing...' : `Retire Series & Finalize`}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        Any unselected sessions will be cancelled and members will be refunded.
                    </p>
                </div>
            </div>
        </div>
    );
};
