// src/screens/members/store/StoreContext.js
import React, { createContext, useContext, useState, useMemo } from 'react';

const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

export const StoreProvider = ({ children }) => {
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Add item to cart
    const addToCart = (product, variant = null) => {
        setCart(prev => {
            // Create unique ID based on product + variant
            const cartItemId = variant ? `${product.id}-${variant.id}` : product.id;
            
            const existing = prev.find(item => item.cartItemId === cartItemId);
            
            if (existing) {
                return prev.map(item => 
                    item.cartItemId === cartItemId 
                        ? { ...item, quantity: item.quantity + 1 } 
                        : item
                );
            }

            // Get the first image from images array, or fall back to image field
            const productImage = product.images?.[0] || product.image || null;

            return [...prev, {
                cartItemId,
                productId: product.id,
                name: product.name,
                price: variant ? variant.price : product.price,
                image: productImage,
                variantName: variant ? variant.label : null,
                type: product.type, // 'physical' or 'membership'
                quantity: 1
            }];
        });
        setIsCartOpen(true); // Auto open cart on add? Or just show toast?
    };

    const removeFromCart = (cartItemId) => {
        setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    };

    const updateQuantity = (cartItemId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartItemId === cartItemId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }, [cart]);

    const cartCount = useMemo(() => {
        return cart.reduce((count, item) => count + item.quantity, 0);
    }, [cart]);

    const clearCart = () => setCart([]);

    return (
        <StoreContext.Provider value={{ 
            cart, 
            addToCart, 
            removeFromCart, 
            updateQuantity, 
            clearCart,
            cartTotal,
            cartCount,
            isCartOpen,
            setIsCartOpen
        }}>
            {children}
        </StoreContext.Provider>
    );
};