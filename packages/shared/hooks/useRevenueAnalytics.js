import { useState, useEffect, useCallback } from 'react';
import { getRevenueAnalytics } from '../api/firestore';

/**
 * Hook to fetch and manage revenue analytics data
 * @param {string} gymId - Gym ID
 * @param {object} options - Configuration options
 * @param {Date|string} options.startDate - Start date for period
 * @param {Date|string} options.endDate - End date for period
 * @param {boolean} options.autoFetch - Whether to fetch on mount (default: true)
 */
export const useRevenueAnalytics = (gymId, options = {}) => {
  const {
    startDate = null,
    endDate = null,
    autoFetch = true,
  } = options;

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async (start = startDate, end = endDate) => {
    if (!gymId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getRevenueAnalytics(gymId, start, end);

      if (result.success) {
        setAnalytics(result.analytics);
      } else {
        setError(result.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [gymId, startDate, endDate]);

  useEffect(() => {
    if (autoFetch && gymId) {
      fetchAnalytics();
    }
  }, [autoFetch, gymId, fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};

/**
 * Predefined date ranges for analytics
 */
export const DATE_RANGES = {
  LAST_7_DAYS: {
    label: 'Last 7 Days',
    getRange: () => ({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    }),
  },
  LAST_30_DAYS: {
    label: 'Last 30 Days',
    getRange: () => ({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    }),
  },
  LAST_90_DAYS: {
    label: 'Last 90 Days',
    getRange: () => ({
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    }),
  },
  THIS_MONTH: {
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(),
      };
    },
  },
  LAST_MONTH: {
    label: 'Last Month',
    getRange: () => {
      const now = new Date();
      return {
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    },
  },
  THIS_YEAR: {
    label: 'This Year',
    getRange: () => {
      const now = new Date();
      return {
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: new Date(),
      };
    },
  },
};
