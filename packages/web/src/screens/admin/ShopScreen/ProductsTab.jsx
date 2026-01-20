import React from 'react';
import {
  Package, Edit2, Trash2, Eye, EyeOff, Tag, AlertCircle
} from 'lucide-react';
import { getTotalStock } from '../../../../../../packages/shared/api/firestore';

export const ProductsTab = ({
  products,
  categories,
  selectedCategory,
  onCategoryChange,
  onEdit,
  onDelete,
  onAdd,
  primaryColor
}) => {
  // Category filter chips
  const CategoryChip = ({ id, name, active }) => (
    <button
      onClick={() => onCategoryChange(id)}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        active
          ? 'text-white shadow-sm'
          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
      }`}
      style={active ? { backgroundColor: primaryColor } : {}}
    >
      {name}
    </button>
  );

  // Empty state
  if (products.length === 0) {
    return (
      <div>
        {/* Category Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <CategoryChip id="all" name="All" active={selectedCategory === 'all'} />
          {categories.map(cat => (
            <CategoryChip key={cat.id} id={cat.id} name={cat.name} active={selectedCategory === cat.id} />
          ))}
        </div>

        {/* Empty State */}
        <div className="py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {selectedCategory === 'all'
              ? 'No products found.'
              : `No products found in ${categories.find(c => c.id === selectedCategory)?.name || selectedCategory}.`
            }
          </p>
          <button
            onClick={onAdd}
            className="text-sm hover:underline mt-1"
            style={{ color: primaryColor }}
          >
            Add your first product
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <CategoryChip id="all" name="All" active={selectedCategory === 'all'} />
        {categories.map(cat => (
          <CategoryChip key={cat.id} id={cat.id} name={cat.name} active={selectedCategory === cat.id} />
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={() => onEdit(product)}
            onDelete={() => onDelete(product)}
            primaryColor={primaryColor}
          />
        ))}
      </div>
    </div>
  );
};

const ProductCard = ({ product, onEdit, onDelete, primaryColor }) => {
  const totalStock = getTotalStock(product);
  const isLowStock = product.hasVariants
    ? (product.variants || []).some(v => (v.stock || 0) <= (v.lowStockThreshold || product.lowStockThreshold || 5))
    : totalStock <= (product.lowStockThreshold || 5);

  const primaryImage = product.images?.[0];
  const categoryName = product.category?.charAt(0).toUpperCase() + product.category?.slice(1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image Section */}
      <div className="aspect-square bg-gray-100 relative">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Package size={48} />
          </div>
        )}

        {/* Status Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {!product.active && (
            <span className="px-2 py-1 text-xs font-medium bg-gray-800/80 text-white rounded-full flex items-center gap-1">
              <EyeOff size={12} /> Inactive
            </span>
          )}
          {product.visibility === 'internal' && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-600/80 text-white rounded-full flex items-center gap-1">
              <Eye size={12} /> Internal
            </span>
          )}
          {product.visibility === 'hidden' && (
            <span className="px-2 py-1 text-xs font-medium bg-gray-600/80 text-white rounded-full flex items-center gap-1">
              <EyeOff size={12} /> Hidden
            </span>
          )}
          {product.featured && (
            <span className="px-2 py-1 text-xs font-medium bg-yellow-500/90 text-white rounded-full">
              Featured
            </span>
          )}
        </div>

        {/* Sale Badge */}
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded-full">
              SALE
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex-1">
          {/* Category Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              <Tag size={10} className="inline mr-1" />
              {categoryName}
            </span>
          </div>

          {/* Name */}
          <h3 className="font-bold text-gray-800 line-clamp-2 mb-1">{product.name}</h3>

          {/* Price */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-lg" style={{ color: primaryColor }}>
              ${product.price?.toFixed(2)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-sm text-gray-400 line-through">
                ${product.compareAtPrice?.toFixed(2)}
              </span>
            )}
          </div>

          {/* Stock Info */}
          <div className={`flex items-center gap-1 text-sm ${isLowStock ? 'text-orange-600' : 'text-gray-500'}`}>
            {isLowStock && <AlertCircle size={14} />}
            {product.hasVariants ? (
              <span>{product.variants?.length || 0} variants • {totalStock} total</span>
            ) : (
              <span>{totalStock} in stock</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onEdit}
            className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center transition-colors"
          >
            <Edit2 className="h-4 w-4 mr-2" /> Edit
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductsTab;
