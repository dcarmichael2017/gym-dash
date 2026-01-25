import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Ticket, ArrowRight, Calendar, User } from 'lucide-react';
import { useGym } from '../../../context/GymContext';

export const PackSuccessScreen = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const { currentGym, refreshMemberships } = useGym();
    const theme = currentGym?.theme || { primaryColor: '#2563eb' };

    useEffect(() => {
        // Refresh membership data to get updated credits
        if (refreshMemberships) {
            refreshMemberships();
        }
    }, [refreshMemberships]);

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm px-6 py-4">
                <h1 className="text-xl font-bold text-gray-900">Purchase Complete</h1>
            </div>

            {/* Success Content */}
            <div className="p-6 flex flex-col items-center justify-center min-h-[70vh]">
                <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 max-w-md w-full text-center">
                    {/* Success Icon */}
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: `${theme.primaryColor}15` }}
                    >
                        <CheckCircle size={40} style={{ color: theme.primaryColor }} />
                    </div>

                    {/* Success Message */}
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Credits Added!
                    </h2>
                    <p className="text-gray-500 mb-6">
                        Your class pack purchase was successful. Your credits have been added to your account.
                    </p>

                    {/* Credits Info */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mb-6 border border-blue-100">
                        <div className="flex items-center justify-center gap-2">
                            <Ticket size={20} className="text-blue-600" />
                            <span className="text-lg font-bold text-blue-900">
                                Credits are ready to use!
                            </span>
                        </div>
                        <p className="text-sm text-blue-700 mt-2">
                            Check your profile to see your updated credit balance
                        </p>
                    </div>

                    {/* What's Next */}
                    <div className="text-left bg-green-50 rounded-xl p-4 mb-6 border border-green-100">
                        <h3 className="font-bold text-green-900 mb-2 text-sm">What's Next?</h3>
                        <ul className="space-y-2 text-sm text-green-700">
                            <li className="flex items-center gap-2">
                                <ArrowRight size={14} />
                                Browse the class schedule
                            </li>
                            <li className="flex items-center gap-2">
                                <ArrowRight size={14} />
                                Book a class using your credits
                            </li>
                            <li className="flex items-center gap-2">
                                <ArrowRight size={14} />
                                Enjoy your workout!
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/members/schedule')}
                            className="w-full py-3.5 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            style={{ backgroundColor: theme.primaryColor }}
                        >
                            <Calendar size={18} />
                            Browse Schedule
                        </button>
                        <button
                            onClick={() => navigate('/members/profile')}
                            className="w-full py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                        >
                            <User size={18} />
                            View Profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PackSuccessScreen;
