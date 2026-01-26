import React, { useState, useEffect } from 'react';
import {
  X, Package, Layers, Image, Loader2
} from 'lucide-react';
import { createProduct, updateProduct, PRODUCT_CATEGORIES } from '../../../../../../packages/shared/api/firestore';
import { ProductDetailsTab } from './ProductDetailsTab';
import { ProductVariantsTab } from './ProductVariantsTab';
import { ProductImagesTab } from './ProductImagesTab';

const NavItem = ({ id, label, icon: Icon, active, onClick, primaryColor }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all ${
      active ? '' : 'text-gray-600 hover:bg-gray-100'
    }`}
    style={active ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : {}}
  >
    <Icon size={18} />
    {label}
  </button>
);

export const ProductFormModal = ({ isOpen, onClose, gymId, productData, onSave, theme }) => {
  const primaryColor = theme?.primaryColor || '#2563eb';
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'gear',
    price: '',
    compareAtPrice: '',
    hasVariants: false,
    variants: [],
    stock: '',
    lowStockThreshold: '5',
    images: [],
    active: true,
    visibility: 'public',
    featured: false
  });

  // Initialize form data when editing
  useEffect(() => {
    if (productData) {
      setFormData({
        name: productData.name || '',
        description: productData.description || '',
        category: productData.category || 'gear',
        price: productData.price != null ? productData.price.toString() : '',
        compareAtPrice: productData.compareAtPrice != null ? productData.compareAtPrice.toString() : '',
        hasVariants: productData.hasVariants || false,
        variants: productData.variants || [],
        stock: productData.stock != null ? productData.stock.toString() : '',
        lowStockThreshold: productData.lowStockThreshold != null ? productData.lowStockThreshold.toString() : '5',
        images: productData.images || [],
        active: productData.active !== false,
        visibility: productData.visibility || 'public',
        featured: productData.featured || false
      });
    } else {
      // Reset form for new product
      setFormData({
        name: '',
        description: '',
        category: 'gear',
        price: '',
        compareAtPrice: '',
        hasVariants: false,
        variants: [],
        stock: '',
        lowStockThreshold: '5',
        images: [],
        active: true,
        visibility: 'public',
        featured: false
      });
    }
    setActiveTab('details');
  }, [productData, isOpen]);

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      alert('Product name is required');
      setActiveTab('details');
      return;
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      alert('Valid price is required');
      setActiveTab('details');
      return;
    }
    if (formData.hasVariants && formData.variants.length === 0) {
      alert('Please add at least one variant or disable variants');
      setActiveTab('variants');
      return;
    }

    setLoading(true);

    // Prepare data
    const cleanData = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      compareAtPrice: formData.compareAtPrice ? parseFloat(formData.compareAtPrice) : null,
      stock: formData.hasVariants ? null : (parseInt(formData.stock) || 0),
      lowStockThreshold: parseInt(formData.lowStockThreshold) || 5
    };

    let result;
    if (productData) {
      result = await updateProduct(gymId, productData.id, cleanData);
    } else {
      result = await createProduct(gymId, cleanData);
    }

    setLoading(false);

    if (result.success) {
      onSave();
    } else {
      alert('Failed to save product: ' + result.error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex h-[700px] max-h-[90vh]">

        {/* LEFT SIDEBAR */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-6 border-b border-gray-100 mb-2">
            <h3 className="font-bold text-lg text-gray-800">
              {productData ? 'Edit Product' : 'New Product'}
            </h3>
            {productData && (
              <p className="text-sm text-gray-500 truncate mt-1">{productData.name}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 p-2">
            <NavItem
              id="details"
              label="Details"
              icon={Package}
              active={activeTab === 'details'}
              onClick={setActiveTab}
              primaryColor={primaryColor}
            />
            <NavItem
              id="variants"
              label="Variants & Stock"
              icon={Layers}
              active={activeTab === 'variants'}
              onClick={setActiveTab}
              primaryColor={primaryColor}
            />
            <NavItem
              id="images"
              label="Images"
              icon={Image}
              active={activeTab === 'images'}
              onClick={setActiveTab}
              primaryColor={primaryColor}
            />
          </div>

          {/* Status Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={formData.active ? 'text-green-600' : 'text-gray-400'}>
                  {formData.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Visibility:</span>
                <span className="capitalize">{formData.visibility}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">

          {/* Content Header */}
          <div className="h-16 border-b border-gray-100 flex justify-between items-center px-6 shrink-0">
            <h2 className="font-bold text-xl text-gray-800 capitalize">
              {activeTab === 'details' && 'Product Details'}
              {activeTab === 'variants' && 'Variants & Stock'}
              {activeTab === 'images' && 'Product Images'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-8">
            <form id="productForm" onSubmit={handleSubmit}>
              {activeTab === 'details' && (
                <ProductDetailsTab
                  formData={formData}
                  updateFormData={updateFormData}
                  categories={PRODUCT_CATEGORIES}
                  primaryColor={primaryColor}
                />
              )}
              {activeTab === 'variants' && (
                <ProductVariantsTab
                  formData={formData}
                  updateFormData={updateFormData}
                  primaryColor={primaryColor}
                />
              )}
              {activeTab === 'images' && (
                <ProductImagesTab
                  formData={formData}
                  updateFormData={updateFormData}
                  gymId={gymId}
                  productId={productData?.id}
                  primaryColor={primaryColor}
                />
              )}
            </form>
          </div>

          {/* Footer Actions */}
          <div className="h-20 border-t border-gray-100 px-8 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="productForm"
              disabled={loading}
              className="px-5 py-2.5 text-white rounded-lg font-medium shadow-sm hover:opacity-90 transition-colors flex items-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Saving...' : (productData ? 'Save Changes' : 'Create Product')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductFormModal;
