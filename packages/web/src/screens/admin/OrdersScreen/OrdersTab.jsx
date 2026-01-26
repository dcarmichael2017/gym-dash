import React, { useState } from 'react';
import {
  Package, CheckCircle, XCircle, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Loader2, RotateCcw, DollarSign
} from 'lucide-react';
import { fulfillOrder, processOrderRefund, REFUND_REASONS } from '../../../../../../packages/shared/api/firestore';

const STATUS_STYLES = {
  paid: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Pending', icon: Clock },
  fulfilled: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Fulfilled', icon: CheckCircle },
  refunded: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Refunded', icon: XCircle },
  partially_refunded: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Partial Refund', icon: RotateCcw },
  disputed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Disputed', icon: AlertTriangle },
};

export const OrdersTab = ({ orders, gymId, onRefresh, primaryColor, filter }) => {
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [refundModal, setRefundModal] = useState({ isOpen: false, order: null });
  const [actionError, setActionError] = useState(null);

  const handleFulfill = async (orderId) => {
    setProcessingAction(orderId);
    setActionError(null);
    try {
      const result = await fulfillOrder(gymId, orderId);
      if (result.success) {
        onRefresh();
      } else {
        setActionError(result.error);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setProcessingAction(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
        <Package size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">
          {filter === 'pending' ? 'No pending orders' : 'No orders yet'}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Orders will appear here when members make purchases.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {actionError}
        </div>
      )}

      {orders.map((order) => {
        const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.paid;
        const StatusIcon = statusStyle.icon;
        const isExpanded = expandedOrder === order.id;

        return (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            {/* Order Header */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStyle.bg}`}>
                  <StatusIcon size={20} className={statusStyle.text} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    #{order.id.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.memberName || 'Unknown'} • {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-gray-900">${order.total?.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{order.items?.length || 0} item(s)</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                  {statusStyle.label}
                </span>
                {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                {/* Order Items */}
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Items</h4>
                  <div className="space-y-2">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.variantName && (
                              <p className="text-xs text-gray-500">{item.variantName}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Details */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer</h4>
                    <p className="text-sm text-gray-900">{order.memberName}</p>
                    <p className="text-sm text-gray-500">{order.memberEmail}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment</h4>
                    <p className="text-sm text-gray-900">
                      Subtotal: ${order.subtotal?.toFixed(2)}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      Total: ${order.total?.toFixed(2)}
                    </p>
                    {order.refundedAmount > 0 && (
                      <p className="text-sm text-red-600">
                        Refunded: ${order.refundedAmount?.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dispute Warning */}
                {order.hasDispute && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle size={16} />
                      <span className="font-bold text-sm">Dispute Active</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                      Reason: {order.disputeReason || 'Unknown'} • Amount: ${order.disputeAmount?.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  {order.status === 'paid' && (
                    <button
                      onClick={() => handleFulfill(order.id)}
                      disabled={processingAction === order.id}
                      className="flex-1 py-2 px-4 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processingAction === order.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      Mark Fulfilled
                    </button>
                  )}

                  {(order.status === 'paid' || order.status === 'fulfilled') && !order.hasDispute && (
                    <button
                      onClick={() => setRefundModal({ isOpen: true, order })}
                      className="flex-1 py-2 px-4 bg-red-50 text-red-700 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-200"
                    >
                      <RotateCcw size={16} />
                      Process Refund
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Refund Modal */}
      {refundModal.isOpen && (
        <RefundModal
          order={refundModal.order}
          gymId={gymId}
          onClose={() => setRefundModal({ isOpen: false, order: null })}
          onSuccess={() => {
            setRefundModal({ isOpen: false, order: null });
            onRefresh();
          }}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
};

// Refund Modal Component
const RefundModal = ({ order, gymId, onClose, onSuccess, primaryColor }) => {
  const [refundType, setRefundType] = useState('full'); // 'full' or 'partial'
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('requested_by_customer');
  const [refundApplicationFee, setRefundApplicationFee] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const maxRefundable = (order.total || 0) - (order.refundedAmount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);

    try {
      const refundAmount = refundType === 'full' ? null : parseFloat(amount);

      if (refundType === 'partial' && (!refundAmount || refundAmount <= 0 || refundAmount > maxRefundable)) {
        setError(`Please enter a valid amount between $0.01 and $${maxRefundable.toFixed(2)}`);
        setProcessing(false);
        return;
      }

      const result = await processOrderRefund(gymId, order.id, refundAmount, reason, refundApplicationFee);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Failed to process refund');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Process Refund</h3>
        <p className="text-sm text-gray-500 mb-6">
          Order #{order.id.slice(-8).toUpperCase()} • ${order.total?.toFixed(2)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Refund Type */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Refund Amount</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRefundType('full')}
                className={`py-3 px-4 rounded-lg border-2 transition-all font-medium text-sm ${
                  refundType === 'full'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Full Refund
                <p className="text-xs mt-0.5 opacity-70">${maxRefundable.toFixed(2)}</p>
              </button>
              <button
                type="button"
                onClick={() => setRefundType('partial')}
                className={`py-3 px-4 rounded-lg border-2 transition-all font-medium text-sm ${
                  refundType === 'partial'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Partial Refund
                <p className="text-xs mt-0.5 opacity-70">Custom amount</p>
              </button>
            </div>
          </div>

          {/* Partial Amount Input */}
          {refundType === 'partial' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Amount</label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxRefundable}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Max refundable: ${maxRefundable.toFixed(2)}</p>
            </div>
          )}

          {/* Reason Select */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {REFUND_REASONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Refund Application Fee Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={refundApplicationFee}
              onChange={(e) => setRefundApplicationFee(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Also refund platform fee (if applicable)</span>
          </label>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </>
              ) : (
                'Process Refund'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
