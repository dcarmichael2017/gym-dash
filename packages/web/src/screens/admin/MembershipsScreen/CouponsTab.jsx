import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Calendar, Users, Percent, DollarSign, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { listCoupons, createCoupon, deactivateCoupon } from '../../../../../../packages/shared/api/firestore';
import { Modal } from '../../../components/common/Modal';

const CouponsTab = ({ gymId, theme, stripeEnabled, onAdd }) => {
  const primaryColor = theme?.primaryColor || '#2563eb';
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(null);

  const fetchCoupons = async () => {
    if (!gymId) return;
    setLoading(true);
    setError(null);

    try {
      const result = await listCoupons(gymId, showInactive);
      if (result.success) {
        setCoupons(result.coupons);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [gymId, showInactive]);

  const handleDeactivate = async (couponId) => {
    if (!confirm('Are you sure you want to deactivate this coupon?')) return;

    setDeactivating(couponId);
    try {
      const result = await deactivateCoupon(gymId, couponId);
      if (result.success) {
        setCoupons(prev => prev.map(c =>
          c.id === couponId ? { ...c, active: false } : c
        ));
      } else {
        alert(result.error || 'Failed to deactivate coupon');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setDeactivating(null);
    }
  };

  const handleCouponCreated = (newCoupon) => {
    setCoupons(prev => [newCoupon, ...prev]);
    setIsModalOpen(false);
  };

  if (!stripeEnabled) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <AlertCircle className="mx-auto mb-3 text-yellow-500" size={32} />
        <h3 className="font-bold text-yellow-800 mb-2">Stripe Not Connected</h3>
        <p className="text-sm text-yellow-700">
          Connect your Stripe account in Settings to create and manage coupons.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show inactive coupons
        </label>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-white px-4 py-2 rounded-lg flex items-center hover:opacity-90 transition-colors shadow-sm font-bold text-sm"
          style={{ backgroundColor: primaryColor }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Tag className="mx-auto mb-3 text-gray-400" size={40} />
          <h3 className="font-bold text-gray-700 mb-2">No Coupons Yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first coupon to offer discounts to your members.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-white px-4 py-2 rounded-lg font-bold text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            Create Your First Coupon
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onDeactivate={() => handleDeactivate(coupon.id)}
              isDeactivating={deactivating === coupon.id}
              primaryColor={primaryColor}
            />
          ))}
        </div>
      )}

      {/* Create Coupon Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Coupon"
      >
        <CreateCouponForm
          gymId={gymId}
          onSuccess={handleCouponCreated}
          onCancel={() => setIsModalOpen(false)}
          primaryColor={primaryColor}
        />
      </Modal>
    </div>
  );
};

const CouponCard = ({ coupon, onDeactivate, isDeactivating, primaryColor }) => {
  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
  const isAtLimit = coupon.maxRedemptions && coupon.currentRedemptions >= coupon.maxRedemptions;
  const isInactive = !coupon.active || isExpired || isAtLimit;

  return (
    <div className={`bg-white rounded-xl border p-4 ${isInactive ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-lg" style={{ color: primaryColor }}>
              {coupon.code}
            </span>
            {!coupon.active && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
            )}
            {isExpired && coupon.active && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Expired</span>
            )}
            {isAtLimit && coupon.active && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Limit Reached</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
            <span className="flex items-center gap-1">
              {coupon.type === 'percent' ? (
                <>
                  <Percent size={14} />
                  {coupon.value}% off
                </>
              ) : (
                <>
                  <DollarSign size={14} />
                  ${(coupon.value / 100).toFixed(2)} off
                </>
              )}
            </span>

            <span className="flex items-center gap-1">
              <Users size={14} />
              {coupon.currentRedemptions || 0}
              {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''} uses
            </span>

            {coupon.expiresAt && (
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {new Date(coupon.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {coupon.appliesToProducts === 'all' ? 'All products' : coupon.appliesToProducts}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {coupon.duration === 'once' ? 'One-time' :
               coupon.duration === 'forever' ? 'Forever' :
               `${coupon.durationInMonths} months`}
            </span>
            {coupon.firstTimeOnly && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                First purchase only
              </span>
            )}
          </div>
        </div>

        {coupon.active && (
          <button
            onClick={onDeactivate}
            disabled={isDeactivating}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Deactivate coupon"
          >
            {isDeactivating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

const CreateCouponForm = ({ gymId, onSuccess, onCancel, primaryColor }) => {
  const [formData, setFormData] = useState({
    code: '',
    type: 'percent',
    value: '',
    duration: 'once',
    durationInMonths: '',
    appliesToProducts: 'all',
    maxRedemptions: '',
    expiresAt: '',
    firstTimeOnly: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.code.trim()) {
      setError('Coupon code is required');
      return;
    }

    if (!formData.value || parseFloat(formData.value) <= 0) {
      setError('Discount value is required');
      return;
    }

    setSaving(true);

    try {
      const couponData = {
        code: formData.code.trim().toUpperCase(),
        type: formData.type,
        value: formData.type === 'percent'
          ? parseFloat(formData.value)
          : Math.round(parseFloat(formData.value) * 100), // Convert dollars to cents
        duration: formData.duration,
        durationInMonths: formData.duration === 'repeating' ? parseInt(formData.durationInMonths) : null,
        appliesToProducts: formData.appliesToProducts,
        maxRedemptions: formData.maxRedemptions ? parseInt(formData.maxRedemptions) : null,
        expiresAt: formData.expiresAt || null,
        firstTimeOnly: formData.firstTimeOnly,
      };

      const result = await createCoupon(gymId, couponData);

      if (result.success) {
        onSuccess(result.coupon);
      } else {
        setError(result.error || 'Failed to create coupon');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Coupon Code */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Coupon Code *
        </label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          placeholder="e.g., SUMMER20"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
          maxLength={20}
        />
        <p className="text-xs text-gray-500 mt-1">Letters and numbers only, will be uppercase</p>
      </div>

      {/* Discount Type & Value */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Discount Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {formData.type === 'percent' ? 'Percentage Off *' : 'Amount Off ($) *'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">
              {formData.type === 'percent' ? '%' : '$'}
            </span>
            <input
              type="number"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder={formData.type === 'percent' ? '20' : '10.00'}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              max={formData.type === 'percent' ? '100' : undefined}
              step={formData.type === 'percent' ? '1' : '0.01'}
            />
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Duration
          </label>
          <select
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="once">Once</option>
            <option value="repeating">Repeating</option>
            <option value="forever">Forever</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">How long discount applies to subscriptions</p>
        </div>
        {formData.duration === 'repeating' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Number of Months
            </label>
            <input
              type="number"
              value={formData.durationInMonths}
              onChange={(e) => setFormData({ ...formData, durationInMonths: e.target.value })}
              placeholder="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
              max="24"
            />
          </div>
        )}
      </div>

      {/* Applies To */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Applies To
        </label>
        <select
          value={formData.appliesToProducts}
          onChange={(e) => setFormData({ ...formData, appliesToProducts: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Products</option>
          <option value="memberships">Memberships Only</option>
          <option value="class_packs">Class Packs Only</option>
          <option value="shop">Shop Products Only</option>
        </select>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Max Redemptions
          </label>
          <input
            type="number"
            value={formData.maxRedemptions}
            onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
            placeholder="Unlimited"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Expiration Date
          </label>
          <input
            type="date"
            value={formData.expiresAt}
            onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {/* First Time Only */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.firstTimeOnly}
          onChange={(e) => setFormData({ ...formData, firstTimeOnly: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">First-time customers only</span>
      </label>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Create Coupon
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default CouponsTab;
