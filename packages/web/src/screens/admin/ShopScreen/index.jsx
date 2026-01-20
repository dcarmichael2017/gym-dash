import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  Plus, Package, AlertTriangle, Loader2, ShoppingBag
} from 'lucide-react';
import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { getProducts, getLowStockProducts, deleteProduct, PRODUCT_CATEGORIES } from '../../../../../../packages/shared/api/firestore';
import { ProductsTab } from './ProductsTab';
import { LowStockTab } from './LowStockTab';
import { ProductFormModal } from '../../../components/admin/ProductFormModal';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';

const ShopScreen = () => {
  const { theme } = useOutletContext() || {};
  const primaryColor = theme?.primaryColor || '#2563eb';

  // Data state
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [products, setProducts] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, productId: null, productName: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch gym ID and products on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().gymId) {
          const gId = userSnap.data().gymId;
          setGymId(gId);
          await refreshData(gId);
        }
      } catch (error) {
        console.error('Error initializing shop data:', error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const refreshData = async (gId) => {
    const result = await getProducts(gId);
    if (result.success) {
      setProducts(result.products);
    }
  };

  // Handlers
  const handleOpenAdd = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleSave = async () => {
    await refreshData(gymId);
    handleCloseModal();
  };

  const handleOpenDelete = (product) => {
    setDeleteModal({
      isOpen: true,
      productId: product.id,
      productName: product.name
    });
  };

  const handleDelete = async () => {
    if (!deleteModal.productId) return;

    setIsDeleting(true);
    const result = await deleteProduct(gymId, deleteModal.productId);

    if (result.success) {
      setProducts(prev => prev.filter(p => p.id !== deleteModal.productId));
      setDeleteModal({ isOpen: false, productId: null, productName: '' });
    } else {
      alert('Failed to delete product: ' + result.error);
    }
    setIsDeleting(false);
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const lowStockProducts = products.filter(p => {
    if (!p.active) return false;
    const threshold = p.lowStockThreshold || 5;

    if (p.hasVariants) {
      return (p.variants || []).some(v => (v.stock || 0) <= threshold);
    }
    return (p.stock || 0) <= threshold;
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Pro Shop</h2>
          <p className="text-gray-500">Manage products and inventory for your members.</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="text-white px-4 py-2 rounded-lg flex items-center hover:opacity-90 transition-colors shadow-sm font-bold text-sm"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Product
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === 'all' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          style={activeTab === 'all' ? { borderColor: primaryColor, color: primaryColor } : {}}
        >
          <Package size={16} /> All Products
          {products.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {products.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('lowstock')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === 'lowstock' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          style={activeTab === 'lowstock' ? { borderColor: primaryColor, color: primaryColor } : {}}
        >
          <AlertTriangle size={16} /> Low Stock
          {lowStockProducts.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-600">
              {lowStockProducts.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'all' ? (
        <ProductsTab
          products={filteredProducts}
          categories={PRODUCT_CATEGORIES}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onAdd={handleOpenAdd}
          primaryColor={primaryColor}
        />
      ) : (
        <LowStockTab
          products={lowStockProducts}
          gymId={gymId}
          onRefresh={() => refreshData(gymId)}
          onEdit={handleOpenEdit}
          primaryColor={primaryColor}
        />
      )}

      {/* Product Form Modal */}
      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          gymId={gymId}
          productData={selectedProduct}
          onSave={handleSave}
          theme={theme}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, productId: null, productName: '' })}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteModal.productName}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ShopScreen;
