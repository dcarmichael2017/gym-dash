import React, { useState } from 'react';
import { X, ShoppingBag } from 'lucide-react'; // Removed unused imports
import { useStore } from './StoreContext';

export const ProductDetailModal = ({ product, onClose }) => {
    const { addToCart } = useStore();
    const [selectedVariant, setSelectedVariant] = useState(null);

    const requiresSelection = product.hasVariants;
    const canAddToCart = !requiresSelection || selectedVariant;

    const handleAddToCart = () => {
        addToCart(product, selectedVariant);
        onClose();
    };

    return (
        // CHANGED: z-50 -> z-[100] to beat the Bottom Nav Bar
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none">
            
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

            {/* Content */}
            <div className="relative z-10 bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 pointer-events-auto animate-in slide-in-from-bottom-10 duration-200">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-bold text-gray-900 w-3/4">{product.name}</h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-8">
                    {/* Image Area */}
                    <div className="h-48 w-full bg-gray-50 rounded-2xl mb-6 overflow-hidden">
                        {product.image && <img src={product.image} className="w-full h-full object-cover" />}
                    </div>

                    {/* Variant Selector */}
                    {requiresSelection && (
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Select Option</label>
                            <div className="grid grid-cols-3 gap-2">
                                {product.variants.map(variant => {
                                    const isSelected = selectedVariant?.id === variant.id;
                                    const isOOS = variant.stock <= 0;

                                    return (
                                        <button
                                            key={variant.id}
                                            disabled={isOOS}
                                            onClick={() => setSelectedVariant(variant)}
                                            className={`
                                                relative p-3 rounded-xl border text-sm font-bold transition-all
                                                ${isSelected 
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' 
                                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                                }
                                                ${isOOS ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
                                            `}
                                        >
                                            {variant.label}
                                            {isOOS && (
                                                <span className="absolute -top-2 -right-1 bg-gray-200 text-[8px] px-1.5 py-0.5 rounded text-gray-600">
                                                    SOLD OUT
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium">Price</span>
                        <span className="text-2xl font-bold text-gray-900">
                            ${(selectedVariant ? selectedVariant.price : product.price)?.toFixed(2)}
                        </span>
                    </div>
                    <button 
                        onClick={handleAddToCart}
                        disabled={!canAddToCart}
                        className="flex-1 h-12 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                    >
                        <ShoppingBag size={18} />
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    );
};