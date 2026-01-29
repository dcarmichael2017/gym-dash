import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy, where, limit } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebaseConfig";

// --- ORDER STATUS CONSTANTS ---
export const ORDER_STATUS = {
  PAID: 'paid',
  READY_FOR_PICKUP: 'ready_for_pickup',
  FULFILLED: 'fulfilled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled'
};

// Human-readable status labels
export const ORDER_STATUS_LABELS = {
  paid: 'Pending',
  ready_for_pickup: 'Ready for Pickup',
  fulfilled: 'Fulfilled',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
  disputed: 'Disputed',
  cancelled: 'Cancelled'
};

export const REFUND_REASONS = [
  { id: 'requested_by_customer', label: 'Requested by customer' },
  { id: 'defective', label: 'Defective product' },
  { id: 'wrong_item', label: 'Wrong item sent' },
  { id: 'duplicate', label: 'Duplicate order' },
  { id: 'fraudulent', label: 'Fraudulent purchase' },
  { id: 'other', label: 'Other' }
];

// --- GET ORDERS ---

/**
 * Get all orders for a gym
 * @param {string} gymId - Gym ID
 * @param {object} options - Filter options
 * @returns {Promise<{success: boolean, orders?: array, error?: string}>}
 */
export const getOrders = async (gymId, options = {}) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "orders");
    let q = query(collectionRef, orderBy("createdAt", "desc"));

    // Apply status filter if provided
    if (options.status) {
      q = query(collectionRef, where("status", "==", options.status), orderBy("createdAt", "desc"));
    }

    // Apply limit if provided
    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
      fulfilledAt: doc.data().fulfilledAt?.toDate?.() || doc.data().fulfilledAt,
      refundedAt: doc.data().refundedAt?.toDate?.() || doc.data().refundedAt,
    }));

    return { success: true, orders };
  } catch (error) {
    console.error("[getOrders] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a single order by ID
 * @param {string} gymId - Gym ID
 * @param {string} orderId - Order ID
 * @returns {Promise<{success: boolean, order?: object, error?: string}>}
 */
export const getOrderById = async (gymId, orderId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "orders", orderId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: "Order not found" };
    }

    const data = docSnap.data();
    return {
      success: true,
      order: {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        paidAt: data.paidAt?.toDate?.() || data.paidAt,
        fulfilledAt: data.fulfilledAt?.toDate?.() || data.fulfilledAt,
        refundedAt: data.refundedAt?.toDate?.() || data.refundedAt,
      }
    };
  } catch (error) {
    console.error("[getOrderById] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get orders for a specific member
 * @param {string} gymId - Gym ID
 * @param {string} memberId - Member's user ID
 * @returns {Promise<{success: boolean, orders?: array, error?: string}>}
 */
export const getMemberOrders = async (gymId, memberId) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "orders");
    const q = query(
      collectionRef,
      where("memberId", "==", memberId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      paidAt: doc.data().paidAt?.toDate?.() || doc.data().paidAt,
      fulfilledAt: doc.data().fulfilledAt?.toDate?.() || doc.data().fulfilledAt,
      readyForPickupAt: doc.data().readyForPickupAt?.toDate?.() || doc.data().readyForPickupAt,
      refundedAt: doc.data().refundedAt?.toDate?.() || doc.data().refundedAt,
    }));

    return { success: true, orders };
  } catch (error) {
    console.error("[getMemberOrders] Error:", error);
    return { success: false, error: error.message };
  }
};

// --- ORDER MANAGEMENT ---

/**
 * Mark an order as fulfilled
 * @param {string} gymId - Gym ID
 * @param {string} orderId - Order ID
 * @param {string} notes - Fulfillment notes (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const fulfillOrder = async (gymId, orderId, notes = null) => {
  try {
    const docRef = doc(db, "gyms", gymId, "orders", orderId);
    await updateDoc(docRef, {
      status: ORDER_STATUS.FULFILLED,
      fulfilledAt: new Date(),
      fulfillmentNotes: notes
    });
    return { success: true };
  } catch (error) {
    console.error("[fulfillOrder] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark an order as ready for pickup
 * @param {string} gymId - Gym ID
 * @param {string} orderId - Order ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markOrderReadyForPickup = async (gymId, orderId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "orders", orderId);
    await updateDoc(docRef, {
      status: ORDER_STATUS.READY_FOR_PICKUP,
      readyForPickupAt: new Date()
    });
    return { success: true };
  } catch (error) {
    console.error("[markOrderReadyForPickup] Error:", error);
    return { success: false, error: error.message };
  }
};

// --- REFUND FUNCTIONS ---

/**
 * Process a refund for an order (shop purchase)
 * @param {string} gymId - Gym ID
 * @param {string} orderId - Order ID
 * @param {number} amount - Refund amount in dollars (null for full refund)
 * @param {string} reason - Refund reason
 * @param {boolean} refundApplicationFee - Whether to refund the platform fee
 * @returns {Promise<{success: boolean, refund?: object, error?: string}>}
 */
export const processOrderRefund = async (gymId, orderId, amount = null, reason = 'requested_by_customer', refundApplicationFee = false) => {
  try {
    const functions = getFunctions();
    const processRefund = httpsCallable(functions, 'processRefund');

    const result = await processRefund({
      gymId,
      orderId,
      amount,
      reason,
      refundApplicationFee,
      refundType: 'order'
    });

    return result.data;
  } catch (error) {
    console.error("[processOrderRefund] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Process a refund for a subscription
 * @param {string} gymId - Gym ID
 * @param {string} subscriptionId - Stripe Subscription ID
 * @param {boolean} prorate - Whether to prorate the refund
 * @param {string} reason - Refund reason
 * @returns {Promise<{success: boolean, refund?: object, error?: string}>}
 */
export const processSubscriptionRefund = async (gymId, subscriptionId, prorate = true, reason = 'requested_by_customer') => {
  try {
    const functions = getFunctions();
    const processRefund = httpsCallable(functions, 'processRefund');

    const result = await processRefund({
      gymId,
      subscriptionId,
      prorate,
      reason,
      refundType: 'subscription'
    });

    return result.data;
  } catch (error) {
    console.error("[processSubscriptionRefund] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Process a refund for a class pack purchase
 * @param {string} gymId - Gym ID
 * @param {string} userId - User ID
 * @param {string} purchaseId - Class pack purchase ID
 * @param {number} creditsUsed - Number of credits already used
 * @param {string} reason - Refund reason
 * @returns {Promise<{success: boolean, refund?: object, error?: string}>}
 */
export const processClassPackRefund = async (gymId, userId, purchaseId, creditsUsed = 0, reason = 'requested_by_customer') => {
  try {
    const functions = getFunctions();
    const processRefund = httpsCallable(functions, 'processRefund');

    const result = await processRefund({
      gymId,
      userId,
      purchaseId,
      creditsUsed,
      reason,
      refundType: 'class_pack'
    });

    return result.data;
  } catch (error) {
    console.error("[processClassPackRefund] Error:", error);
    return { success: false, error: error.message };
  }
};

// --- DISPUTE FUNCTIONS ---

/**
 * Get orders with active disputes
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, orders?: array, error?: string}>}
 */
export const getDisputedOrders = async (gymId) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "orders");
    const q = query(
      collectionRef,
      where("hasDispute", "==", true),
      orderBy("disputeCreatedAt", "desc")
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      disputeCreatedAt: doc.data().disputeCreatedAt?.toDate?.() || doc.data().disputeCreatedAt,
    }));

    return { success: true, orders };
  } catch (error) {
    console.error("[getDisputedOrders] Error:", error);
    return { success: false, error: error.message };
  }
};

// --- ORDER STATS ---

/**
 * Get order statistics for dashboard
 * @param {string} gymId - Gym ID
 * @param {Date} startDate - Start date for stats
 * @param {Date} endDate - End date for stats
 * @returns {Promise<{success: boolean, stats?: object, error?: string}>}
 */
export const getOrderStats = async (gymId, startDate = null, endDate = null) => {
  try {
    const result = await getOrders(gymId);
    if (!result.success) return result;

    const orders = result.orders.filter(order => {
      if (!startDate && !endDate) return true;
      const orderDate = order.createdAt;
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
      return true;
    });

    // Calculate total revenue: sum all orders, then subtract refunded amounts
    // This correctly handles partial refunds (order total minus refund amount)
    const grossRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalRefunded = orders.reduce((sum, o) => sum + (o.refundedAmount || 0), 0);
    const netRevenue = grossRevenue - totalRefunded;

    const stats = {
      totalOrders: orders.length,
      totalRevenue: netRevenue,
      grossRevenue: grossRevenue,
      pendingFulfillment: orders.filter(o => o.status === 'paid').length,
      readyForPickup: orders.filter(o => o.status === 'ready_for_pickup').length,
      fulfilled: orders.filter(o => o.status === 'fulfilled').length,
      refunded: orders.filter(o => o.status === 'refunded' || o.status === 'partially_refunded').length,
      disputed: orders.filter(o => o.hasDispute).length,
      refundedAmount: totalRefunded,
    };

    return { success: true, stats };
  } catch (error) {
    console.error("[getOrderStats] Error:", error);
    return { success: false, error: error.message };
  }
};
