import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ShoppingBag, AlertTriangle, Loader2, Package, RotateCcw
} from 'lucide-react';
import { auth, db } from '../../../../../../packages/shared/api/firebaseConfig';
import { getOrders, getDisputedOrders, getOrderStats } from '../../../../../../packages/shared/api/firestore';
import { OrdersTab } from './OrdersTab';
import { DisputesTab } from './DisputesTab';

const OrdersScreen = () => {
  const { theme } = useOutletContext() || {};
  const primaryColor = theme?.primaryColor || '#2563eb';

  // Data state
  const [loading, setLoading] = useState(true);
  const [gymId, setGymId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch gym ID and orders on mount
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
        console.error('Error initializing orders data:', error);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const refreshData = async (gId) => {
    setRefreshing(true);
    try {
      const [ordersResult, disputesResult, statsResult] = await Promise.all([
        getOrders(gId),
        getDisputedOrders(gId),
        getOrderStats(gId)
      ]);

      if (ordersResult.success) {
        setOrders(ordersResult.orders);
      }
      if (disputesResult.success) {
        setDisputes(disputesResult.orders);
      }
      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter orders by status (pending includes paid and ready_for_pickup)
  const pendingOrders = orders.filter(o => o.status === 'paid' || o.status === 'ready_for_pickup');
  const fulfilledOrders = orders.filter(o => o.status === 'fulfilled');
  const refundedOrders = orders.filter(o => o.status === 'refunded' || o.status === 'partially_refunded');

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
          <h2 className="text-2xl font-bold text-gray-800">Orders</h2>
          <p className="text-gray-500">Manage shop orders, refunds, and disputes.</p>
        </div>

        <button
          onClick={() => refreshData(gymId)}
          disabled={refreshing}
          className="text-gray-600 px-4 py-2 rounded-lg flex items-center hover:bg-gray-100 transition-colors font-medium text-sm border border-gray-200 disabled:opacity-50"
        >
          <RotateCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Revenue</p>
            <p className="text-2xl font-bold text-green-600 mt-1">${stats.totalRevenue?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendingFulfillment}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Refunded</p>
            <p className="text-2xl font-bold text-red-600 mt-1">${stats.refundedAmount?.toFixed(2) || '0.00'}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === 'all' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          style={activeTab === 'all' ? { borderColor: primaryColor, color: primaryColor } : {}}
        >
          <ShoppingBag size={16} /> All Orders
          {orders.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
              {orders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === 'pending' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          style={activeTab === 'pending' ? { borderColor: primaryColor, color: primaryColor } : {}}
        >
          <Package size={16} /> Pending
          {pendingOrders.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-600">
              {pendingOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('disputes')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === 'disputes' ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          style={activeTab === 'disputes' ? { borderColor: primaryColor, color: primaryColor } : {}}
        >
          <AlertTriangle size={16} /> Disputes
          {disputes.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600">
              {disputes.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'all' && (
        <OrdersTab
          orders={orders}
          gymId={gymId}
          onRefresh={() => refreshData(gymId)}
          primaryColor={primaryColor}
          filter="all"
        />
      )}
      {activeTab === 'pending' && (
        <OrdersTab
          orders={pendingOrders}
          gymId={gymId}
          onRefresh={() => refreshData(gymId)}
          primaryColor={primaryColor}
          filter="pending"
        />
      )}
      {activeTab === 'disputes' && (
        <DisputesTab
          disputes={disputes}
          gymId={gymId}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
};

export default OrdersScreen;
