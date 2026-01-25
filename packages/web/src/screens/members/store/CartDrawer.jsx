import React, { useState } from 'react';
import { X, Trash2, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from './StoreContext';
import { useGym } from '../../../context/GymContext';
import { createShopCheckout } from '../../../../../../packages/shared/api/firestore';

export const CartDrawer = () => {
    const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal, clearCart } = useStore();
    const { currentGym } = useGym();
    const theme = currentGym?.theme || { primaryColor: '#2563eb' };

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleCheckout = async () => {
        if (!currentGym?.id || cart.length === 0) return;

        setLoading(true);
        setError(null);

        // Transform cart items for the API
        const cartItems = cart.map(item => ({
            productId: item.productId,
            variantId: item.variantName ? item.cartItemId.split('-')[1] : null, // Extract variantId from cartItemId
            quantity: item.quantity
        }));

        try {
            const result = await createShopCheckout(currentGym.id, cartItems);

            if (result.success && result.url) {
                // Redirect to Stripe Checkout
                window.location.href = result.url;
            } else {
                setError(result.error || 'Failed to start checkout. Please try again.');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />

            {/* Drawer */}
            <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-lg">Your Cart ({cart.length})</h2>
                    <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <ShoppingBagIcon size={48} className="mb-4 opacity-20" />
                            <p>Your cart is empty.</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.cartItemId} className="flex gap-4">
                                <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                                    {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm text-gray-900">{item.name}</h4>
                                    {item.variantName && (
                                        <p className="text-xs text-gray-500">Size: {item.variantName}</p>
                                    )}
                                    <p className="text-sm font-bold mt-1" style={{ color: theme.primaryColor }}>${item.price?.toFixed(2)}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <button onClick={() => removeFromCart(item.cartItemId)} className="text-gray-400 hover:text-red-500">
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-2 py-1">
                                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="text-gray-500 font-bold px-1">-</button>
                                        <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="text-gray-500 font-bold px-1">+</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-red-700">{error}</p>
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-gray-500 font-medium">Subtotal</span>
                            <span className="text-xl font-bold">${cartTotal.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={handleCheckout}
                            disabled={loading}
                            className="w-full py-4 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                            style={{ backgroundColor: theme.primaryColor }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <CreditCard size={18} />
                                    Checkout
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ShoppingBagIcon = ({ size, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);