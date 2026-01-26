import { getFunctions, httpsCallable } from "firebase/functions";

/**
 * Get comprehensive revenue analytics for a gym
 * @param {string} gymId - Gym ID
 * @param {Date|string} startDate - Start date for the period (optional, defaults to 30 days ago)
 * @param {Date|string} endDate - End date for the period (optional, defaults to now)
 * @returns {Promise<{success: boolean, analytics?: object, error?: string}>}
 */
export const getRevenueAnalytics = async (gymId, startDate = null, endDate = null) => {
  try {
    const functions = getFunctions();
    const getAnalytics = httpsCallable(functions, 'getRevenueAnalytics');

    const result = await getAnalytics({
      gymId,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
    });

    return result.data;
  } catch (error) {
    console.error("[getRevenueAnalytics] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get quick summary stats (cached version for dashboard widgets)
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
 */
export const getQuickStats = async (gymId) => {
  // For quick dashboard stats, we use a 30-day window
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await getRevenueAnalytics(gymId, startDate, endDate);

  if (!result.success) {
    return result;
  }

  // Return a simplified version for dashboard widgets
  return {
    success: true,
    stats: {
      revenue: result.analytics.revenue.net,
      orders: result.analytics.orders.total,
      activeSubscribers: result.analytics.subscriptions.active,
      mrr: result.analytics.subscriptions.mrr,
      pendingOrders: result.analytics.orders.pending,
      activeDisputes: result.analytics.disputes.active,
    }
  };
};
