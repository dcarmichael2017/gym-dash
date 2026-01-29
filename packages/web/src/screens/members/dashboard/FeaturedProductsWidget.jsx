import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { getActiveProducts } from '../../../../../../packages/shared/api/firestore';

const ROTATION_INTERVAL = 5000; // 5 seconds

export const FeaturedProductsWidget = ({ gymId, theme }) => {
  const [products, setProducts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!gymId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const res = await getActiveProducts(gymId);

      if (res.success && res.products.length > 0) {
        // Separate featured and non-featured
        const featured = res.products.filter(p => p.featured);
        const regular = res.products.filter(p => !p.featured);

        // If we have featured products, use them; otherwise use regular products
        const displayProducts = featured.length > 0 ? featured : regular;
        setProducts(displayProducts);
      }

      setLoading(false);
    };

    fetchProducts();
  }, [gymId]);

  // Auto-rotate through products
  useEffect(() => {
    if (products.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % products.length);
        setIsTransitioning(false);
      }, 300);
    }, ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [products.length]);

  // Don't render while loading
  if (loading) {
    return null;
  }

  // Don't render if no products
  if (products.length === 0) {
    return null;
  }

  const currentProduct = products[currentIndex];
  const image = currentProduct.images?.[0];
  const hasDiscount = currentProduct.compareAtPrice && currentProduct.compareAtPrice > currentProduct.price;
  const hasFeatured = products.some(p => p.featured);

  return (
    <Link
      to="/members/store"
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex hover:shadow-md transition-shadow group"
    >
      {/* Product Image */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 bg-gray-100">
        {image ? (
          <img
            src={image}
            alt={currentProduct.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={32} className="text-gray-300" />
          </div>
        )}

        {/* Badges */}
        {currentProduct.featured && (
          <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
            <Sparkles size={10} /> Featured
          </div>
        )}
        {hasDiscount && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            Sale
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className={`flex-1 p-4 flex flex-col justify-center transition-opacity duration-300 ${
        isTransitioning ? 'opacity-0' : 'opacity-100'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ backgroundColor: `${theme?.primaryColor}15`, color: theme?.primaryColor }}
          >
            {hasFeatured ? 'Featured' : 'Shop'}
          </span>
        </div>

        <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-1 group-hover:underline">
          {currentProduct.name}
        </h3>

        {currentProduct.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 hidden sm:block">
            {currentProduct.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: theme?.primaryColor }}>
              ${currentProduct.price?.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-gray-400 line-through">
                ${currentProduct.compareAtPrice?.toFixed(2)}
              </span>
            )}
          </div>

          <span
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: theme?.primaryColor }}
          >
            Shop <ArrowRight size={12} />
          </span>
        </div>

        {/* Pagination Dots */}
        {products.length > 1 && (
          <div className="flex items-center gap-1 mt-2">
            {products.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'w-4'
                    : 'w-1 bg-gray-200'
                }`}
                style={idx === currentIndex ? { backgroundColor: theme?.primaryColor } : {}}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
};

export default FeaturedProductsWidget;
