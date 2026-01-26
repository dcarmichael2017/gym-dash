import React, { useState, useEffect } from 'react';
import { ShoppingBag, Shirt, Ticket, Dumbbell, ChevronRight, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './StoreContext';
import { CartDrawer } from './CartDrawer'; 

// --- IMPORTS FOR DATA & TABS ---
import { useGym } from '../../../context/GymContext';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';
import { getMembershipTiers, getActiveProducts, PRODUCT_CATEGORIES } from '../../../../../../packages/shared/api/firestore';
import MembershipListTab from './tabs/MembershipListTab';
import MembershipDropInTab from './tabs/MembershipDropInTab';

export const StoreScreen = () => {
    const navigate = useNavigate();
    const location = useLocation(); // Hook for state params
    const { currentGym, memberships } = useGym();
    const { cartCount, setIsCartOpen } = useStore();
    const theme = currentGym?.theme || { primaryColor: '#2563eb' };

    // Check if current member is inactive
    const currentMembership = memberships?.find(m => m.gymId === currentGym?.id);
    const isInactive = currentMembership?.status === 'inactive';

    // State
    const [activeCategory, setActiveCategory] = useState('all');
    const [tiers, setTiers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loadingTiers, setLoadingTiers] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(true);

    // --- DEEP LINK LISTENER ---
    useEffect(() => {
        if (location.state?.category) {
            setActiveCategory(location.state.category);
            
            // Optional: Clear state so a page refresh doesn't stick to this category forever? 
            // Usually fine to leave it, or replace history.
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // --- 1. FETCH MEMBERSHIPS ---
    useEffect(() => {
        const fetchTiers = async () => {
            if (!currentGym) return;
            setLoadingTiers(true);

            const res = await getMembershipTiers(currentGym.id);

            if (res.success) {
                const myMembership = memberships.find(m => m.gymId === currentGym.id);
                const isOwner = currentGym.ownerId === auth.currentUser?.uid;
                const isStaff = myMembership?.role === 'staff' || myMembership?.role === 'coach' || myMembership?.role === 'admin';

                const visibleTiers = res.tiers.filter(tier => {
                   if (tier.active === false) return false;
                   const level = tier.visibility || 'public';
                   if (isOwner) return true;
                   if (isStaff) return level !== 'admin';
                   return level === 'public';
                });

                setTiers(visibleTiers);
            }
            setLoadingTiers(false);
        };

        fetchTiers();
    }, [currentGym, memberships]);

    // --- 1.5. FETCH PRODUCTS ---
    useEffect(() => {
        const fetchProducts = async () => {
            if (!currentGym) return;
            setLoadingProducts(true);

            const res = await getActiveProducts(currentGym.id);

            if (res.success) {
                // Transform products for display (add type: 'physical', map images to image)
                const displayProducts = res.products.map(p => ({
                    ...p,
                    type: 'physical',
                    image: p.images?.[0] || null,
                    // Map variants to include 'label' for ProductDetailModal compatibility
                    variants: p.hasVariants ? (p.variants || []).map(v => ({
                        ...v,
                        label: v.name,
                        price: parseFloat(v.price) || p.price
                    })) : []
                }));
                setProducts(displayProducts);
            }
            setLoadingProducts(false);
        };

        fetchProducts();
    }, [currentGym]);

    // --- 2. SPLIT DATA ---
    const recurringPlans = tiers.filter(t => t.interval !== 'one_time');
    const oneTimePlans = tiers.filter(t => t.interval === 'one_time');

    // --- 3. HELPER TO RENDER CONTENT ---
    const renderContent = () => {
        if (activeCategory === 'memberships') {
            if (loadingTiers) return <Loader2 className="animate-spin mx-auto text-gray-400 mt-10" />;
            return <MembershipListTab tiers={recurringPlans} theme={theme} currentMembership={currentMembership} />;
        }

        if (activeCategory === 'packs') {
            if (loadingTiers) return <Loader2 className="animate-spin mx-auto text-gray-400 mt-10" />;
            return <MembershipDropInTab tiers={oneTimePlans} theme={theme} />;
        }

        // Default: Render Physical Products (Gear/All)
        if (loadingProducts) {
            return <Loader2 className="animate-spin mx-auto text-gray-400 mt-10" />;
        }

        // Filter products by category
        const displayProducts = activeCategory === 'all'
            ? products
            : products.filter(p => p.category === activeCategory);

        if (displayProducts.length === 0) {
            return (
                <div className="text-center py-10 opacity-50">
                    <ShoppingBag size={48} className="mx-auto mb-2" />
                    <p>No products found in this category.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-2 gap-4">
                {displayProducts.map(product => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        onPress={() => navigate(`/members/store/product/${product.id}`)}
                        theme={theme}
                    />
                ))}
            </div>
        );
    };

    // Show inactive message if member is inactive
    if (isInactive) {
        return (
            <div className="min-h-screen bg-gray-50 pb-24 relative">
                <div className="bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm px-6 py-4">
                    <h1 className="text-xl font-bold text-gray-900">Pro Shop</h1>
                </div>
                <div className="p-6 flex items-center justify-center min-h-[80vh]">
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-8 shadow-md max-w-md border-2 border-red-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <XCircle size={32} className="text-red-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Store Unavailable</h2>
                            <p className="text-sm text-gray-700 mb-4">
                                Your membership has been disabled by the gym administrator. You cannot purchase items at this time.
                            </p>
                            <div className="bg-white/60 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-900 text-left">
                                    Please contact the gym owner or staff to restore access to your account.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 relative">

            {/* Header with Cart */}
            <div className="bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm px-6 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-900">Pro Shop</h1>
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="relative p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                    <ShoppingBag size={20} className="text-gray-700" />
                    {cartCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                            {cartCount}
                        </div>
                    )}
                </button>
            </div>

            {/* Category Shortcuts */}
            <div className="px-6 py-4 overflow-x-auto no-scrollbar flex gap-3">
                <CategoryChip 
                    label="All" 
                    active={activeCategory === 'all'} 
                    onClick={() => setActiveCategory('all')} 
                />
                <CategoryChip 
                    label="Gear" 
                    icon={Shirt} 
                    active={activeCategory === 'gear'} 
                    onClick={() => setActiveCategory('gear')} 
                />
                <CategoryChip 
                    label="Memberships" 
                    icon={Dumbbell} 
                    active={activeCategory === 'memberships'} 
                    onClick={() => setActiveCategory('memberships')} 
                />
                <CategoryChip 
                    label="Class Packs" 
                    icon={Ticket} 
                    active={activeCategory === 'packs'} 
                    onClick={() => setActiveCategory('packs')} 
                />
            </div>

            {/* Content Area */}
            <div className="px-6">
                {renderContent()}
            </div>

            {/* Cart Drawer */}
            <CartDrawer />
        </div>
    );
};

// --- SUB COMPONENTS ---

const CategoryChip = ({ label, icon: Icon, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
            active 
                ? 'bg-gray-900 text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200 shadow-sm hover:border-gray-300'
        }`}
    >
        {Icon && <Icon size={16} />}
        {label}
    </button>
);

const ProductCard = ({ product, onPress, theme }) => {
    const primaryColor = theme?.primaryColor || '#2563eb';
    const isOnSale = product.compareAtPrice && product.compareAtPrice > product.price;

    return (
        <button
            onClick={onPress}
            className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col text-left hover:shadow-md transition-all active:scale-[0.98]"
        >
            <div className="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden relative">
                {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag size={32} />
                    </div>
                )}
                {/* Sale Badge */}
                {isOnSale && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                        SALE
                    </div>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-between">
                <div>
                    <h4 className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight mb-1">
                        {product.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                        {product.hasVariants ? `${product.variants?.length || 0} Options` : 'In Stock'}
                    </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold" style={{ color: primaryColor }}>
                            ${product.price?.toFixed(2)}
                        </span>
                        {isOnSale && (
                            <span className="text-xs text-gray-400 line-through">
                                ${product.compareAtPrice?.toFixed(2)}
                            </span>
                        )}
                    </div>
                    <div className="w-6 h-6 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                        <ChevronRight size={14} />
                    </div>
                </div>
            </div>
        </button>
    );
};