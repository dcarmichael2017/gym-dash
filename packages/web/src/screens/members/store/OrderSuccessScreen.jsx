import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, ShoppingBag } from 'lucide-react';
import { useGym } from '../../../context/GymContext';

export const OrderSuccessScreen = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const { currentGym } = useGym();
    const theme = currentGym?.theme || { primaryColor: '#2563eb' };

    useEffect(() => {
        // Clear cart after successful purchase
        // Cart is managed by StoreContext which doesn't persist, so it should already be cleared on page reload
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm px-6 py-4">
                <h1 className="text-xl font-bold text-gray-900">Order Confirmed</h1>
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
                        Order Placed!
                    </h2>
                    <p className="text-gray-500 mb-6">
                        Thank you for your purchase! Your order has been confirmed and will be ready for pickup.
                    </p>

                    {/* Order Info */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 text-gray-600">
                            <Package size={18} />
                            <span className="text-sm font-medium">
                                The gym will notify you when your order is ready
                            </span>
                        </div>
                    </div>

                    {/* What's Next */}
                    <div className="text-left bg-blue-50 rounded-xl p-4 mb-6">
                        <h3 className="font-bold text-blue-900 mb-2 text-sm">What's Next?</h3>
                        <ul className="space-y-2 text-sm text-blue-700">
                            <li className="flex items-center gap-2">
                                <ArrowRight size={14} />
                                Visit the gym to pick up your items
                            </li>
                            <li className="flex items-center gap-2">
                                <ArrowRight size={14} />
                                Bring ID or show your member profile
                            </li>
                            <li className="flex items-center gap-2">
                                <ArrowRight size={14} />
                                Questions? Contact the gym directly
                            </li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/members/store')}
                            className="w-full py-3.5 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            style={{ backgroundColor: theme.primaryColor }}
                        >
                            <ShoppingBag size={18} />
                            Continue Shopping
                        </button>
                        <button
                            onClick={() => navigate('/members/home')}
                            className="w-full py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderSuccessScreen;
