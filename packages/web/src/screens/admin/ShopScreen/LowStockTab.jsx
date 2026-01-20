import React, { useState } from 'react';
import {
  AlertTriangle, Package, Edit2, Save, X, Loader2
} from 'lucide-react';
import { updateProductStock } from '../../../../../../packages/shared/api/firestore';

export const LowStockTab = ({ products, gymId, onRefresh, onEdit, primaryColor }) => {
  const [editingStock, setEditingStock] = useState(null); // { productId, variantId, value }
  const [saving, setSaving] = useState(false);

  const handleStartEdit = (productId, variantId, currentStock) => {
    setEditingStock({
      productId,
      variantId,
      value: currentStock.toString()
    });
  };

  const handleCancelEdit = () => {
    setEditingStock(null);
  };

  const handleSaveStock = async () => {
    if (!editingStock) return;

    setSaving(true);
    const result = await updateProductStock(
      gymId,
      editingStock.productId,
      editingStock.variantId,
      parseInt(editingStock.value) || 0
    );

    if (result.success) {
      await onRefresh();
      setEditingStock(null);
    } else {
      alert('Failed to update stock: ' + result.error);
    }
    setSaving(false);
  };

  // Empty state
  if (products.length === 0) {
    return (
      <div className="py-16 text-center bg-green-50 rounded-xl border-2 border-dashed border-green-200">
        <Package className="h-12 w-12 text-green-400 mx-auto mb-3" />
        <p className="text-green-700 font-medium">All products are well stocked!</p>
        <p className="text-green-600 text-sm mt-1">No items below their low stock threshold.</p>
      </div>
    );
  }

  // Flatten products and variants into a list
  const lowStockItems = [];
  products.forEach(product => {
    if (product.hasVariants) {
      (product.variants || []).forEach(variant => {
        const threshold = variant.lowStockThreshold || product.lowStockThreshold || 5;
        if ((variant.stock || 0) <= threshold) {
          lowStockItems.push({
            product,
            variant,
            stock: variant.stock || 0,
            threshold
          });
        }
      });
    } else {
      const threshold = product.lowStockThreshold || 5;
      lowStockItems.push({
        product,
        variant: null,
        stock: product.stock || 0,
        threshold
      });
    }
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex items-center gap-3">
        <AlertTriangle className="text-orange-500" size={20} />
        <div>
          <p className="font-bold text-orange-800">Low Stock Alert</p>
          <p className="text-sm text-orange-600">
            {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below threshold
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Variant</th>
              <th className="px-6 py-3 text-center">Current Stock</th>
              <th className="px-6 py-3 text-center">Threshold</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lowStockItems.map((item, index) => {
              const isEditing =
                editingStock?.productId === item.product.id &&
                editingStock?.variantId === (item.variant?.id || null);

              return (
                <tr key={`${item.product.id}-${item.variant?.id || 'base'}`} className="hover:bg-gray-50">
                  {/* Product */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package size={16} />
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-gray-800">{item.product.name}</span>
                    </div>
                  </td>

                  {/* Variant */}
                  <td className="px-6 py-4 text-gray-600">
                    {item.variant ? item.variant.name : '—'}
                  </td>

                  {/* Current Stock */}
                  <td className="px-6 py-4 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editingStock.value}
                        onChange={(e) => setEditingStock(prev => ({ ...prev, value: e.target.value }))}
                        className="w-20 px-2 py-1 text-center border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                        style={{ '--tw-ring-color': primaryColor }}
                        autoFocus
                      />
                    ) : (
                      <span className={`font-bold ${item.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.stock}
                      </span>
                    )}
                  </td>

                  {/* Threshold */}
                  <td className="px-6 py-4 text-center text-gray-500">
                    {item.threshold}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleSaveStock}
                          disabled={saving}
                          className="p-2 text-white rounded-lg transition-colors"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleStartEdit(item.product.id, item.variant?.id || null, item.stock)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Update Stock
                        </button>
                        <button
                          onClick={() => onEdit(item.product)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LowStockTab;
