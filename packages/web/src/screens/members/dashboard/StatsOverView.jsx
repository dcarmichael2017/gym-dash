import React, { useState, useEffect } from 'react';
import { CheckSquare, Loader2 } from 'lucide-react';
import { getMemberAttendanceHistory } from '../../../../../shared/api/firestore/bookings';

const StatsOverView = ({ gymId, memberId }) => {
    const [attendedCount, setAttendedCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (gymId && memberId) {
            setLoading(true);
            const fetchHistory = async () => {
                const res = await getMemberAttendanceHistory(gymId, memberId);
                if (res.success) {
                    setAttendedCount(res.history.length);
                }
                setLoading(false);
            };
            fetchHistory();
        } else {
            setLoading(false);
        }
    }, [gymId, memberId]);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-full">
                    <CheckSquare className="text-green-600" size={20} />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Classes Attended</p>
                    <div className="text-2xl font-bold text-gray-800">
                        {loading ? <Loader2 size={20} className="animate-spin text-gray-300" /> : attendedCount}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsOverView;
