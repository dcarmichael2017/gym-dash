import React, { useState, useEffect } from 'react';
import { ShoppingBag, Shirt, Ticket, Dumbbell, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom'; // Added useLocation
import { useStore } from './StoreContext';
import { ProductDetailModal } from './ProductDetailModal';
import { CartDrawer } from './CartDrawer'; 

// --- IMPORTS FOR DATA & TABS ---
import { useGym } from '../../../context/GymContext';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';
import { getMembershipTiers } from '../../../../../../packages/shared/api/firestore';
import MembershipListTab from './tabs/MembershipListTab';
import MembershipDropInTab from './tabs/MembershipDropInTab';

// --- MOCK DATA FOR PHYSICAL GOODS ---
const MOCK_PRODUCTS = [
    {
        id: 'gear_1',
        type: 'physical',
        category: 'gear',
        name: 'Team Rashguard',
        price: 55.00,
        image: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&q=80&w=300',
        hasVariants: true,
        variants: [
            { id: 's', label: 'Small', stock: 5, price: 55.00 },
            { id: 'm', label: 'Medium', stock: 0, price: 55.00 },
            { id: 'l', label: 'Large', stock: 12, price: 55.00 },
        ]
    },
    {
        id: 'gear_2',
        type: 'physical',
        category: 'gear',
        name: 'Team Gi (White)',
        price: 120.00,
        image: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?auto=format&fit=crop&q=80&w=300',
        hasVariants: true,
        variants: [
            { id: 'a1', label: 'A1', stock: 2, price: 120.00 },
            { id: 'a2', label: 'A2', stock: 4, price: 120.00 },
        ]
    },
    {
        id: 'drink_1',
        type: 'physical',
        category: 'gear',
        name: 'Sparkling Water',
        price: 2.50,
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=300',
        hasVariants: false,
        stock: 50
    }
];

export const StoreScreen = () => {
    const navigate = useNavigate();
    const location = useLocation(); // Hook for state params
    const { currentGym, memberships } = useGym();
    const { cartCount, setIsCartOpen } = useStore();
    const theme = currentGym?.theme || { primaryColor: '#2563eb' };

    // State
    const [activeCategory, setActiveCategory] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [tiers, setTiers] = useState([]);
    const [loadingTiers, setLoadingTiers] = useState(true);

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

    // --- 2. SPLIT DATA ---
    const recurringPlans = tiers.filter(t => t.interval !== 'one_time');
    const oneTimePlans = tiers.filter(t => t.interval === 'one_time');

    // --- 3. HELPER TO RENDER CONTENT ---
    const renderContent = () => {
        if (activeCategory === 'memberships') {
            if (loadingTiers) return <Loader2 className="animate-spin mx-auto text-gray-400 mt-10" />;
            return <MembershipListTab tiers={recurringPlans} theme={theme} />;
        }

        if (activeCategory === 'packs') {
            if (loadingTiers) return <Loader2 className="animate-spin mx-auto text-gray-400 mt-10" />;
            return <MembershipDropInTab tiers={oneTimePlans} theme={theme} />;
        }

        // Default: Render Physical Products (Gear/All)
        // Filter Mock Products
        const displayProducts = activeCategory === 'all' 
            ? MOCK_PRODUCTS 
            : MOCK_PRODUCTS.filter(p => p.category === activeCategory);

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
                        onPress={() => setSelectedProduct(product)} 
                    />
                ))}
            </div>
        );
    };

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

            {/* Modals & Drawers */}
            {selectedProduct && (
                <ProductDetailModal 
                    product={selectedProduct} 
                    onClose={() => setSelectedProduct(null)} 
                />
            )}
            
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

const ProductCard = ({ product, onPress }) => (
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
        </div>
        <div className="flex-1 flex flex-col justify-between">
            <div>
                <h4 className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight mb-1">
                    {product.name}
                </h4>
                <p className="text-xs text-gray-500">
                    {product.hasVariants ? `${product.variants.length} Options` : 'In Stock'}
                </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-blue-600">${product.price.toFixed(2)}</span>
                <div className="w-6 h-6 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                    <ChevronRight size={14} />
                </div>
            </div>
        </div>
    </button>
);