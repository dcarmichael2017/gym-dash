import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag, Clock, CheckCircle, PackageCheck, ArrowRight, Loader2 } from 'lucide-react';
import { getMemberOrders, getActiveProducts } from '../../../../../../packages/shared/api/firestore';
import { auth } from '../../../../../../packages/shared/api/firebaseConfig';

const STATUS_CONFIG = {
  paid: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Processing' },
  ready_for_pickup: { icon: PackageCheck, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Ready for Pickup' },
  fulfilled: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Fulfilled' },
};

export const ShopWidget = ({ gymId, theme }) => {
  const [recentOrders, setRecentOrders] = useState([]);
  const [hasProducts, setHasProducts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!gymId || !auth.currentUser) return;
      setLoading(true);

      // Fetch orders and products in parallel
      const [ordersRes, productsRes] = await Promise.all([
        getMemberOrders(gymId, auth.currentUser.uid),
        getActiveProducts(gymId)
      ]);

      if (ordersRes.success) {
        // Get only active orders (not fulfilled/refunded) - max 3
        const activeOrders = ordersRes.orders
          .filter(o => o.status === 'paid' || o.status === 'ready_for_pickup')
          .slice(0, 3);
        setRecentOrders(activeOrders);
      }

      if (productsRes.success) {
        setHasProducts(productsRes.products.length > 0);
      }

      setLoading(false);
    };

    fetchData();
  }, [gymId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-gray-300" size={24} />
        </div>
      </div>
    );
  }

  // If user has active orders, show them
  if (recentOrders.length > 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme?.primaryColor}15` }}>
                <Package size={18} style={{ color: theme?.primaryColor }} />
              </div>
              <h3 className="font-bold text-gray-900">Your Orders</h3>
            </div>
            <Link
              to="/members/profile"
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: theme?.primaryColor }}
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {recentOrders.map(order => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.paid;
            const StatusIcon = config.icon;
            const itemCount = order.items?.length || 0;

            return (
              <Link
                key={order.id}
                to="/members/profile"
                className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.bg}`}>
                  <StatusIcon size={16} className={config.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    ${order.total?.toFixed(2)} - {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </p>
                  <p className={`text-xs font-medium ${config.color}`}>
                    {config.label}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // If no orders but has products, show shop link
  if (hasProducts) {
    return (
      <Link
        to="/members/store"
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="p-3 rounded-xl" style={{ backgroundColor: `${theme?.primaryColor}15` }}>
          <ShoppingBag size={22} style={{ color: theme?.primaryColor }} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-900">Shop Merch</p>
          <p className="text-xs text-gray-500 mt-0.5">Browse gear, apparel & more</p>
        </div>
        <ArrowRight size={18} className="text-gray-400" />
      </Link>
    );
  }

  // No orders and no products - don't render anything
  return null;
};

export default ShopWidget;
