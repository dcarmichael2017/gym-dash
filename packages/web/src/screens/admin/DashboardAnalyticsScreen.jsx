import React, { useMemo, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { useOutletContext } from 'react-router-dom';
import {
  TrendingUp, DollarSign, ShoppingBag, Users, AlertTriangle,
  RotateCcw, CreditCard, Package, ChevronDown, Loader2
} from 'lucide-react';
import { useGymStats } from '../../../../shared/hooks/useGymStats';
import { useRevenueAnalytics, DATE_RANGES } from '../../../../shared/hooks/useRevenueAnalytics';
import { FullScreenLoader } from '../../components/common/FullScreenLoader';

// Safe wrapper for ResponsiveContainer to prevent rendering with invalid dimensions
const SafeResponsiveContainer = ({ children, ...props }) => (
  <ResponsiveContainer {...props} minWidth={0} minHeight={0}>
    {children}
  </ResponsiveContainer>
);

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const CATEGORY_COLORS = {
  gear: '#3B82F6',
  apparel: '#10B981',
  drinks: '#F59E0B',
  supplements: '#EF4444',
  accessories: '#8B5CF6',
  uncategorized: '#6B7280',
};

const DashboardAnalyticsScreen = () => {
  const { gymId, theme } = useOutletContext();
  const primaryColor = theme?.primaryColor || '#2563eb';

  const [dateRange, setDateRange] = useState('LAST_30_DAYS');
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Memoize date range to prevent infinite re-renders
  const { startDate, endDate } = useMemo(() => {
    return DATE_RANGES[dateRange].getRange();
  }, [dateRange]);

  // Fetch member stats (existing)
  const {
    activeMembers,
    mrrEstimate,
    demographics,
    signupHistory,
    tierDistribution,
    loading: statsLoading,
  } = useGymStats(gymId);

  // Fetch revenue analytics (new Stripe data)
  // Use autoFetch: false initially to prevent race conditions
  const {
    analytics,
    loading: analyticsLoading,
    error: analyticsError,
    refetch,
  } = useRevenueAnalytics(gymId, {
    startDate,
    endDate,
    autoFetch: !!gymId, // Only auto-fetch when gymId is available
  });

  // Stable refetch handler
  const handleRefetch = useCallback(() => {
    if (gymId) {
      refetch(startDate, endDate);
    }
  }, [gymId, startDate, endDate, refetch]);

  // --- CHART DATA ---
  const historyData = useMemo(() => {
    if (statsLoading) return [];

    const data = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });

      const cumulativeSignups = signupHistory
        .filter(h => h.date <= key)
        .reduce((sum, h) => sum + h.signups, 0);

      const arpu = activeMembers > 0 ? (mrrEstimate / activeMembers) : 0;

      data.push({
        name: label,
        Members: cumulativeSignups,
        Revenue: Math.round(cumulativeSignups * arpu)
      });
    }
    return data;
  }, [statsLoading, signupHistory, activeMembers, mrrEstimate]);

  const demographicData = [
    { name: 'Adults', value: demographics.adults },
    { name: 'Dependents', value: demographics.dependents },
  ];

  // Revenue timeline from analytics
  const revenueTimeline = analytics?.timeline || [];

  if (statsLoading) return <FullScreenLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">

      {/* Header with Date Range Selector */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics Command Center</h2>
          <p className="text-gray-500">Deep dive into your gym's performance.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={handleRefetch}
            disabled={analyticsLoading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RotateCcw size={18} className={analyticsLoading ? 'animate-spin' : ''} />
          </button>

          {/* Date Range Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {DATE_RANGES[dateRange].label}
              <ChevronDown size={16} />
            </button>

            {showDateDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDateDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setDateRange(key);
                        setShowDateDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        dateRange === key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- ROW 0: KEY METRICS CARDS --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Net Revenue"
          value={analytics?.revenue?.net ? `$${analytics.revenue.net.toFixed(2)}` : '—'}
          icon={DollarSign}
          color="green"
          loading={analyticsLoading}
        />
        <MetricCard
          label="MRR"
          value={analytics?.subscriptions?.mrr ? `$${analytics.subscriptions.mrr.toFixed(2)}` : `$${mrrEstimate.toFixed(2)}`}
          icon={CreditCard}
          color="blue"
          loading={analyticsLoading}
        />
        <MetricCard
          label="Active Subscribers"
          value={analytics?.subscriptions?.active ?? activeMembers}
          icon={Users}
          color="purple"
          loading={analyticsLoading}
        />
        <MetricCard
          label="Shop Orders"
          value={analytics?.orders?.total ?? 0}
          icon={ShoppingBag}
          color="yellow"
          loading={analyticsLoading}
        />
        <MetricCard
          label="Refunds"
          value={analytics?.revenue?.refunds ? `$${analytics.revenue.refunds.toFixed(2)}` : '$0'}
          icon={RotateCcw}
          color="red"
          loading={analyticsLoading}
        />
        <MetricCard
          label="Disputes"
          value={analytics?.disputes?.active ?? 0}
          icon={AlertTriangle}
          color={analytics?.disputes?.active > 0 ? 'red' : 'gray'}
          loading={analyticsLoading}
        />
      </div>

      {/* Analytics Error */}
      {analyticsError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <strong>Analytics Error:</strong> {analyticsError}
        </div>
      )}

      {/* --- ROW 1: REVENUE & MEMBER GROWTH --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart A: Revenue Timeline */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-gray-800">Revenue Trend</h3>
              <p className="text-xs text-gray-400">Daily shop revenue ({DATE_RANGES[dateRange].label})</p>
            </div>
            <div className="bg-green-50 p-2 rounded-lg text-green-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="h-64">
            {analyticsLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-gray-400" size={32} />
              </div>
            ) : revenueTimeline.length > 0 ? (
              <SafeResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTimeline}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{fill: '#9CA3AF', fontSize: 11}}
                    dy={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{fill: '#9CA3AF', fontSize: 12}}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </SafeResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingBag size={32} className="mb-2 opacity-50" />
                <p>No revenue data for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* Chart B: Member Growth */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-gray-800">Member Growth</h3>
              <p className="text-xs text-gray-400">Total Active Members (Last 6 Months)</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="h-64">
            <SafeResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} allowDecimals={false} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="Members" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </SafeResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- ROW 2: SUBSCRIPTION METRICS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Subscription Stats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-1">Subscription Health</h3>
          <p className="text-xs text-gray-400 mb-6">Key subscription metrics</p>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Churn Rate</span>
              <span className={`font-bold ${
                (analytics?.subscriptions?.churnRate || 0) > 5 ? 'text-red-600' : 'text-green-600'
              }`}>
                {analytics?.subscriptions?.churnRate || 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Cancelled (Period)</span>
              <span className="font-bold text-gray-900">
                {analytics?.subscriptions?.cancelledInPeriod || 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Failed Payments</span>
              <span className={`font-bold ${
                (analytics?.subscriptions?.failedPayments || 0) > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {analytics?.subscriptions?.failedPayments || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
          <h3 className="font-bold text-gray-800 mb-1">Plan Distribution</h3>
          <p className="text-xs text-gray-400 mb-6">Active Members by Tier</p>

          <div className="h-48">
            {tierDistribution.length > 0 ? (
              <SafeResponsiveContainer width="100%" height="100%">
                <BarChart data={tierDistribution} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: '#4B5563'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                  <Bar dataKey="value" fill={primaryColor} radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </SafeResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>No active plans yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- ROW 3: SHOP ANALYTICS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Top Selling Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-1">Top Selling Products</h3>
          <p className="text-xs text-gray-400 mb-6">Best performers ({DATE_RANGES[dateRange].label})</p>

          {analyticsLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : (analytics?.shop?.topProducts?.length || 0) > 0 ? (
            <div className="space-y-3">
              {analytics.shop.topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.quantity} sold</p>
                    </div>
                  </div>
                  <span className="font-bold text-green-600">${product.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <Package size={32} className="mb-2 opacity-50" />
              <p>No products sold in this period</p>
            </div>
          )}
        </div>

        {/* Revenue by Category */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-1">Revenue by Category</h3>
          <p className="text-xs text-gray-400 mb-6">Shop revenue breakdown</p>

          {analyticsLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : (analytics?.shop?.revenueByCategory?.length || 0) > 0 ? (
            <div className="h-48">
              <SafeResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.shop.revenueByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: $${value}`}
                    labelLine={false}
                  >
                    {analytics.shop.revenueByCategory.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[entry.name.toLowerCase()] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                </PieChart>
              </SafeResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <ShoppingBag size={32} className="mb-2 opacity-50" />
              <p>No category data available</p>
            </div>
          )}
        </div>
      </div>

      {/* --- ROW 4: DEMOGRAPHICS & ORDER STATUS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Demographics Pie */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-1">Demographics</h3>
          <p className="text-xs text-gray-400 mb-6">Member Age Breakdown</p>

          <div className="h-48 relative">
            <SafeResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={demographicData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {demographicData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </SafeResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-gray-800">{demographics.avgAge || 0}</span>
              <span className="text-xs text-gray-400 uppercase font-bold">Avg Age</span>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3B82F6]"></div>
              <span className="text-sm text-gray-600">Adults ({demographics.adults})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
              <span className="text-sm text-gray-600">Kids ({demographics.dependents})</span>
            </div>
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
          <h3 className="font-bold text-gray-800 mb-1">Order Status</h3>
          <p className="text-xs text-gray-400 mb-6">Order fulfillment breakdown ({DATE_RANGES[dateRange].label})</p>

          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-xl">
              <p className="text-2xl font-bold text-yellow-600">{analytics?.orders?.pending || 0}</p>
              <p className="text-xs text-yellow-700 font-medium mt-1">Pending</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{analytics?.orders?.fulfilled || 0}</p>
              <p className="text-xs text-green-700 font-medium mt-1">Fulfilled</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{analytics?.orders?.refunded || 0}</p>
              <p className="text-xs text-red-700 font-medium mt-1">Refunded</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">{analytics?.orders?.total || 0}</p>
              <p className="text-xs text-blue-700 font-medium mt-1">Total</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

// Metric Card Component
const MetricCard = ({ label, value, icon: Icon, color, loading }) => {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <Icon size={14} />
        </div>
      </div>
      {loading ? (
        <div className="h-7 flex items-center">
          <Loader2 className="animate-spin text-gray-400" size={18} />
        </div>
      ) : (
        <p className="text-xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  );
};

export default DashboardAnalyticsScreen;
