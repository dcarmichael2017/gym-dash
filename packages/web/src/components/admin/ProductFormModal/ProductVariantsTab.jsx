import React from 'react';
import {
  Layers, Plus, Trash2, Package, AlertCircle
} from 'lucide-react';

export const ProductVariantsTab = ({ formData, updateFormData, primaryColor }) => {

  const generateVariantId = () => {
    return `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleToggleVariants = () => {
    if (formData.hasVariants) {
      // Switching off variants - clear variants array
      updateFormData({ hasVariants: false, variants: [] });
    } else {
      // Switching on variants - add one default variant
      updateFormData({
        hasVariants: true,
        variants: [{
          id: generateVariantId(),
          name: '',
          sku: '',
          price: formData.price || '',
          stock: 0,
          lowStockThreshold: parseInt(formData.lowStockThreshold) || 5
        }]
      });
    }
  };

  const handleAddVariant = () => {
    updateFormData({
      variants: [...formData.variants, {
        id: generateVariantId(),
        name: '',
        sku: '',
        price: formData.price || '',
        stock: 0,
        lowStockThreshold: parseInt(formData.lowStockThreshold) || 5
      }]
    });
  };

  const handleRemoveVariant = (variantId) => {
    const newVariants = formData.variants.filter(v => v.id !== variantId);
    if (newVariants.length === 0) {
      // If removing last variant, disable variants
      updateFormData({ hasVariants: false, variants: [] });
    } else {
      updateFormData({ variants: newVariants });
    }
  };

  const handleVariantChange = (variantId, field, value) => {
    const newVariants = formData.variants.map(v => {
      if (v.id === variantId) {
        return { ...v, [field]: value };
      }
      return v;
    });
    updateFormData({ variants: newVariants });
  };

  return (
    <div className="space-y-6">
      {/* Variants Toggle */}
      <div
        className="p-4 rounded-xl border transition-all"
        style={formData.hasVariants
          ? { backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30` }
          : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }
        }
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5" style={{ color: formData.hasVariants ? primaryColor : '#9ca3af' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: formData.hasVariants ? primaryColor : '#4b5563' }}>
                This product has variants
              </p>
              <p className="text-xs text-gray-500">
                Enable for products with size, color, or other options
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleVariants}
            className="w-11 h-6 rounded-full relative transition-colors"
            style={{ backgroundColor: formData.hasVariants ? primaryColor : '#d1d5db' }}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
              formData.hasVariants ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
      </div>

      {/* Stock Input (No Variants) */}
      {!formData.hasVariants && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
                Stock Quantity
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.stock}
                  onChange={e => updateFormData({ stock: e.target.value })}
                  className="w-full pl-10 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': primaryColor }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">
                Low Stock Alert
              </label>
              <div className="relative">
                <AlertCircle className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  placeholder="5"
                  value={formData.lowStockThreshold}
                  onChange={e => updateFormData({ lowStockThreshold: e.target.value })}
                  className="w-full pl-10 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': primaryColor }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                You'll be alerted when stock falls below this level
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Variants List */}
      {formData.hasVariants && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Product Variants
            </label>
            <span className="text-xs text-gray-400">
              {formData.variants.length} variant{formData.variants.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Variants Table Header */}
          <div className="bg-gray-50 rounded-t-lg border border-gray-200 px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">SKU</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Stock</div>
            <div className="col-span-2">Low Alert</div>
            <div className="col-span-1"></div>
          </div>

          {/* Variants Rows */}
          <div className="border border-t-0 border-gray-200 rounded-b-lg divide-y divide-gray-100">
            {formData.variants.map((variant, index) => (
              <div key={variant.id} className="px-4 py-3 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <input
                    type="text"
                    placeholder="e.g. Small, Red"
                    value={variant.name}
                    onChange={e => handleVariantChange(variant.id, 'name', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': primaryColor }}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="SKU-001"
                    value={variant.sku || ''}
                    onChange={e => handleVariantChange(variant.id, 'sku', e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': primaryColor }}
                  />
                </div>
                <div className="col-span-2">
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={variant.price}
                      onChange={e => handleVariantChange(variant.id, 'price', e.target.value)}
                      className="w-full pl-6 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:border-transparent"
                      style={{ '--tw-ring-color': primaryColor }}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={variant.stock}
                    onChange={e => handleVariantChange(variant.id, 'stock', parseInt(e.target.value) || 0)}
                    className={`w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:border-transparent ${
                      (variant.stock || 0) <= (variant.lowStockThreshold || 5)
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200'
                    }`}
                    style={{ '--tw-ring-color': primaryColor }}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="5"
                    value={variant.lowStockThreshold || ''}
                    onChange={e => handleVariantChange(variant.id, 'lowStockThreshold', parseInt(e.target.value) || 5)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': primaryColor }}
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(variant.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Variant Button */}
          <button
            type="button"
            onClick={handleAddVariant}
            className="flex items-center gap-2 text-sm font-bold hover:opacity-80 transition-opacity"
            style={{ color: primaryColor }}
          >
            <Plus size={16} />
            Add Variant
          </button>

          {/* Helper Text */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium mb-1">Tips for variants:</p>
            <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
              <li>Use clear names like "Small", "Medium", "Large" or "Red", "Blue", "Green"</li>
              <li>Each variant can have its own price and stock level</li>
              <li>SKU is optional but helpful for inventory tracking</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantsTab;
