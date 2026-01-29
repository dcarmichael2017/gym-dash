import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShoppingBag, ChevronLeft, ChevronRight, ArrowRight, Loader2 } from 'lucide-react';
import { getActiveProducts } from '../../../../../../packages/shared/api/firestore';

export const FeaturedProductsWidget = ({ gymId, theme }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!gymId) return;
      setLoading(true);

      const res = await getActiveProducts(gymId);

      if (res.success) {
        // Prioritize featured products, then sort by newest
        const sortedProducts = res.products.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return 0;
        });
        // Take up to 8 products for the gallery
        setProducts(sortedProducts.slice(0, 8));
      }

      setLoading(false);
    };

    fetchProducts();
  }, [gymId]);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [products]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-gray-300" size={24} />
        </div>
      </div>
    );
  }

  // Don't render if no products
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme?.primaryColor}15` }}>
              <Sparkles size={18} style={{ color: theme?.primaryColor }} />
            </div>
            <h3 className="font-bold text-gray-900">Shop</h3>
          </div>
          <Link
            to="/members/store"
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color: theme?.primaryColor }}
          >
            View All <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Scrollable Gallery */}
      <div className="relative">
        {/* Scroll Buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors border border-gray-200"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors border border-gray-200"
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        )}

        {/* Products Row */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide p-4"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {products.map(product => {
            const image = product.images?.[0];
            const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;

            return (
              <Link
                key={product.id}
                to="/members/store"
                className="flex-shrink-0 w-32 group"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/* Image */}
                <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-gray-100 mb-2">
                  {image ? (
                    <img
                      src={image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag size={24} className="text-gray-300" />
                    </div>
                  )}
                  {product.featured && (
                    <div className="absolute top-1.5 left-1.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      Featured
                    </div>
                  )}
                  {hasDiscount && (
                    <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      Sale
                    </div>
                  )}
                </div>

                {/* Info */}
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold" style={{ color: theme?.primaryColor }}>
                    ${product.price?.toFixed(2)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-gray-400 line-through">
                      ${product.compareAtPrice?.toFixed(2)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FeaturedProductsWidget;
