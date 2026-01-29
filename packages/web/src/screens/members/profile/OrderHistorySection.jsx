import React, { useState, useEffect } from 'react';
import { Package, ChevronDown, ChevronUp, Clock, PackageCheck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { getMemberOrders, ORDER_STATUS_LABELS } from '../../../../../../packages/shared/api/firestore';

const STATUS_CONFIG = {
  paid: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  ready_for_pickup: { icon: PackageCheck, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  fulfilled: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  refunded: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  partially_refunded: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  disputed: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
};

export const OrderHistorySection = ({ gymId, userId, theme }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!gymId || !userId) return;
      setLoading(true);
      const result = await getMemberOrders(gymId, userId);
      if (result.success) {
        setOrders(result.orders);
      }
      setLoading(false);
    };
    fetchOrders();
  }, [gymId, userId]);

  const formatDate = (date) => {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme?.primaryColor}15` }}>
            <Package size={20} style={{ color: theme?.primaryColor }} />
          </div>
          <h3 className="font-bold text-gray-900">Order History</h3>
        </div>
        <div className="text-center py-8 text-gray-400">Loading orders...</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme?.primaryColor}15` }}>
            <Package size={20} style={{ color: theme?.primaryColor }} />
          </div>
          <h3 className="font-bold text-gray-900">Order History</h3>
        </div>
        <div className="text-center py-8 text-gray-400">
          <Package size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No orders yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme?.primaryColor}15` }}>
          <Package size={20} style={{ color: theme?.primaryColor }} />
        </div>
        <h3 className="font-bold text-gray-900">Order History</h3>
        <span className="ml-auto text-xs text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        {orders.map(order => {
          const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.paid;
          const StatusIcon = statusConfig.icon;
          const isExpanded = expandedOrder === order.id;

          return (
            <div
              key={order.id}
              className={`border rounded-xl overflow-hidden transition-all ${statusConfig.border}`}
            >
              <button
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusConfig.bg}`}>
                  <StatusIcon size={16} className={statusConfig.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">
                      ${order.total?.toFixed(2)}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(order.createdAt)} • {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
                  <div className="space-y-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                            <Package size={16} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          {item.variantName && (
                            <p className="text-xs text-gray-500">{item.variantName}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">${item.price?.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">×{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.status === 'ready_for_pickup' && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-bold text-blue-700 flex items-center gap-2">
                        <PackageCheck size={16} />
                        Ready for Pickup!
                      </p>
                      <p className="text-xs text-blue-600 mt-1">Your order is ready. Please pick it up at the gym.</p>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-500">
                    <span>Order #{order.id?.slice(-8)}</span>
                    {order.fulfilledAt && <span>Completed {formatDate(order.fulfilledAt)}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderHistorySection;
