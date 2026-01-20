import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useGym } from '../../../context/GymContext';
import { useStore } from './StoreContext';
import { getProductById } from '../../../../../../packages/shared/api/firestore';

export const ProductDetailScreen = () => {
    const { productId } = useParams();
    const navigate = useNavigate();
    const { currentGym } = useGym();
    const { addToCart } = useStore();
    const theme = currentGym?.theme || { primaryColor: '#2563eb' };

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [addedToCart, setAddedToCart] = useState(false);

    // Fetch product data
    useEffect(() => {
        const fetchProduct = async () => {
            if (!currentGym?.id || !productId) return;
            setLoading(true);
            setError(null);

            const res = await getProductById(currentGym.id, productId);

            if (res.success && res.product) {
                // Transform product for display
                const displayProduct = {
                    ...res.product,
                    type: 'physical',
                    images: res.product.images || [],
                    variants: res.product.hasVariants ? (res.product.variants || []).map(v => ({
                        ...v,
                        label: v.name,
                        price: parseFloat(v.price) || res.product.price
                    })) : []
                };
                setProduct(displayProduct);
            } else {
                setError(res.error || 'Product not found');
            }
            setLoading(false);
        };

        fetchProduct();
    }, [currentGym?.id, productId]);

    const requiresSelection = product?.hasVariants;
    const canAddToCart = !requiresSelection || selectedVariant;
    const currentPrice = selectedVariant ? selectedVariant.price : product?.price;
    const isOnSale = product?.compareAtPrice && product.compareAtPrice > product?.price;
    const images = product?.images?.length > 0 ? product.images : [null];

    const handleAddToCart = () => {
        if (!canAddToCart) return;
        addToCart(product, selectedVariant);
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    const handlePrevImage = () => {
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNextImage = () => {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    // Error state
    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 pb-24">
                <div className="bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-700" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900">Product</h1>
                </div>
                <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
                    <AlertCircle size={48} className="text-gray-300 mb-4" />
                    <p className="text-gray-500 text-center">{error || 'Product not found'}</p>
                    <button
                        onClick={() => navigate('/members/store')}
                        className="mt-4 px-4 py-2 text-sm font-medium rounded-lg"
                        style={{ color: theme.primaryColor }}
                    >
                        Back to Store
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <div className="bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} className="text-gray-700" />
                </button>
                <h1 className="text-lg font-bold text-gray-900 truncate flex-1">{product.name}</h1>
            </div>

            {/* Image Gallery */}
            <div className="bg-white">
                <div className="relative aspect-square sm:aspect-[4/3] md:aspect-[16/9] lg:aspect-[2/1] max-h-[500px] bg-gray-100 overflow-hidden">
                    {images[currentImageIndex] ? (
                        <img
                            src={images[currentImageIndex]}
                            alt={`${product.name} - Image ${currentImageIndex + 1}`}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ShoppingBag size={64} />
                        </div>
                    )}

                    {/* Sale Badge */}
                    {isOnSale && (
                        <div
                            className="absolute top-4 left-4 px-3 py-1 text-white text-xs font-bold rounded-full"
                            style={{ backgroundColor: theme.primaryColor }}
                        >
                            SALE
                        </div>
                    )}

                    {/* Navigation Arrows */}
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={handlePrevImage}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg transition-all"
                            >
                                <ChevronLeft size={24} className="text-gray-700" />
                            </button>
                            <button
                                onClick={handleNextImage}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg transition-all"
                            >
                                <ChevronRight size={24} className="text-gray-700" />
                            </button>
                        </>
                    )}

                    {/* Image Dots */}
                    {images.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                            {images.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                        idx === currentImageIndex
                                            ? 'w-6'
                                            : 'bg-white/60 hover:bg-white/80'
                                    }`}
                                    style={idx === currentImageIndex ? { backgroundColor: theme.primaryColor } : {}}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Image Thumbnails (Desktop) */}
                {images.length > 1 && (
                    <div className="hidden md:flex gap-2 p-4 overflow-x-auto">
                        {images.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentImageIndex(idx)}
                                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                                    idx === currentImageIndex ? '' : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                                style={idx === currentImageIndex ? { borderColor: theme.primaryColor } : {}}
                            >
                                {img ? (
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                        <ShoppingBag size={20} className="text-gray-300" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="p-6 space-y-6">
                {/* Title & Price */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h2>
                    <div className="flex items-center gap-3">
                        <span
                            className="text-3xl font-bold"
                            style={{ color: theme.primaryColor }}
                        >
                            ${currentPrice?.toFixed(2)}
                        </span>
                        {isOnSale && (
                            <span className="text-lg text-gray-400 line-through">
                                ${product.compareAtPrice?.toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Description */}
                {product.description && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Description</h3>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{product.description}</p>
                    </div>
                )}

                {/* Variant Selector */}
                {requiresSelection && product.variants?.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Select Option</h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
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
                                            ${isSelected ? 'ring-1' : ''}
                                            ${isOOS ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-300'}
                                        `}
                                        style={isSelected ? {
                                            borderColor: theme.primaryColor,
                                            backgroundColor: `${theme.primaryColor}10`,
                                            color: theme.primaryColor,
                                            '--tw-ring-color': theme.primaryColor
                                        } : {
                                            borderColor: '#e5e7eb',
                                            color: '#374151'
                                        }}
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

                {/* Stock Info */}
                {!requiresSelection && product.stock !== undefined && (
                    <div className="flex items-center gap-2 text-sm">
                        <div
                            className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        />
                        <span className="text-gray-600">
                            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                    </div>
                )}
            </div>

            {/* Fixed Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-20">
                <div className="max-w-lg mx-auto flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium">Total</span>
                        <span
                            className="text-2xl font-bold"
                            style={{ color: theme.primaryColor }}
                        >
                            ${currentPrice?.toFixed(2)}
                        </span>
                    </div>
                    <button
                        onClick={handleAddToCart}
                        disabled={!canAddToCart}
                        className="flex-1 h-14 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                        style={{
                            backgroundColor: theme.primaryColor,
                            boxShadow: canAddToCart ? `0 10px 25px -5px ${theme.primaryColor}40` : 'none'
                        }}
                    >
                        <ShoppingBag size={20} />
                        {addedToCart ? 'Added!' : requiresSelection && !selectedVariant ? 'Select an Option' : 'Add to Cart'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailScreen;
