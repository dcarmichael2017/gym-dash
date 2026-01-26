import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track if we've already fetched to prevent duplicate calls
  const hasFetchedRef = useRef(false);
  const lastFetchKeyRef = useRef('');

  // Convert dates to stable string keys for dependency comparison
  const startKey = startDate ? new Date(startDate).toISOString().split('T')[0] : '';
  const endKey = endDate ? new Date(endDate).toISOString().split('T')[0] : '';
  const fetchKey = `${gymId}-${startKey}-${endKey}`;

  const fetchAnalytics = useCallback(async (start, end) => {
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
  }, [gymId]);

  // Auto-fetch when params change (using stable string comparison)
  useEffect(() => {
    if (!autoFetch || !gymId) return;

    // Skip if we've already fetched with the same parameters
    if (lastFetchKeyRef.current === fetchKey) return;

    lastFetchKeyRef.current = fetchKey;
    fetchAnalytics(startDate, endDate);
  }, [autoFetch, gymId, fetchKey, startDate, endDate, fetchAnalytics]);

  // Manual refetch function
  const refetch = useCallback((start = startDate, end = endDate) => {
    lastFetchKeyRef.current = ''; // Clear to allow refetch
    fetchAnalytics(start, end);
  }, [startDate, endDate, fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refetch,
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
