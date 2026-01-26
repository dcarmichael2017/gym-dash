import { doc, addDoc, collection, updateDoc, getDocs, deleteDoc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebaseConfig";

// --- MEMBERSHIP TIERS ---

/**
 * Create a new membership tier
 * @param {string} gymId - Gym ID
 * @param {object} tierData - Tier data
 * @param {boolean} syncToStripe - Whether to sync to Stripe (default: false)
 * @returns {Promise<{success: boolean, tier?: object, error?: string}>}
 */
export const createMembershipTier = async (gymId, tierData, syncToStripe = false) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "membershipTiers");
    const payload = {
      ...tierData,
      stripeProductId: null,
      stripePriceId: null,
      active: true,
      createdAt: new Date()
    };
    const docRef = await addDoc(collectionRef, payload);
    const tier = { id: docRef.id, ...payload };

    // Optionally sync to Stripe
    if (syncToStripe) {
      try {
        const functions = getFunctions();
        const syncMembershipTierToStripe = httpsCallable(functions, 'syncMembershipTierToStripe');
        const result = await syncMembershipTierToStripe({
          gymId,
          tierId: docRef.id,
          tierData: payload
        });
        if (result.data.success) {
          tier.stripeProductId = result.data.stripeProductId;
          tier.stripePriceId = result.data.stripePriceId;
        }
      } catch (stripeErr) {
        console.warn("Stripe sync failed (non-blocking):", stripeErr.message);
        // Don't fail the operation, tier was created successfully
      }
    }

    return { success: true, tier };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get all membership tiers for a gym
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, tiers?: array, error?: string}>}
 */
export const getMembershipTiers = async (gymId) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "membershipTiers");
    const snapshot = await getDocs(collectionRef);
    const tiers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, tiers };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get a single membership tier
 * @param {string} gymId - Gym ID
 * @param {string} tierId - Tier ID
 * @returns {Promise<{success: boolean, tier?: object, error?: string}>}
 */
export const getMembershipTier = async (gymId, tierId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "membershipTiers", tierId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: "Tier not found" };
    }

    return { success: true, tier: { id: docSnap.id, ...docSnap.data() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Update a membership tier
 * @param {string} gymId - Gym ID
 * @param {string} tierId - Tier ID
 * @param {object} data - Updated fields
 * @param {boolean} syncToStripe - Whether to sync to Stripe (default: false)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateMembershipTier = async (gymId, tierId, data, syncToStripe = false) => {
  try {
    const docRef = doc(db, "gyms", gymId, "membershipTiers", tierId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });

    // Optionally sync to Stripe
    if (syncToStripe) {
      try {
        // Get the full tier data for sync
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const functions = getFunctions();
          const syncMembershipTierToStripe = httpsCallable(functions, 'syncMembershipTierToStripe');
          await syncMembershipTierToStripe({
            gymId,
            tierId,
            tierData: { id: docSnap.id, ...docSnap.data() }
          });
        }
      } catch (stripeErr) {
        console.warn("Stripe sync failed (non-blocking):", stripeErr.message);
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete a membership tier
 * @param {string} gymId - Gym ID
 * @param {string} tierId - Tier ID
 * @param {boolean} archiveInStripe - Whether to archive in Stripe (default: false)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteMembershipTier = async (gymId, tierId, archiveInStripe = false) => {
  try {
    const docRef = doc(db, "gyms", gymId, "membershipTiers", tierId);

    // Get the tier first to check for Stripe product
    if (archiveInStripe) {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().stripeProductId) {
        try {
          const functions = getFunctions();
          const archiveStripeProduct = httpsCallable(functions, 'archiveStripeProduct');
          await archiveStripeProduct({
            gymId,
            stripeProductId: docSnap.data().stripeProductId
          });
        } catch (stripeErr) {
          console.warn("Stripe archive failed (non-blocking):", stripeErr.message);
        }
      }
    }

    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Manually sync a membership tier to Stripe
 * @param {string} gymId - Gym ID
 * @param {string} tierId - Tier ID
 * @returns {Promise<{success: boolean, stripeProductId?: string, stripePriceId?: string, error?: string}>}
 */
export const syncMembershipTierToStripe = async (gymId, tierId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "membershipTiers", tierId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: "Tier not found" };
    }

    const functions = getFunctions();
    const syncFn = httpsCallable(functions, 'syncMembershipTierToStripe');
    const result = await syncFn({
      gymId,
      tierId,
      tierData: { id: docSnap.id, ...docSnap.data() }
    });

    return result.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// --- SUBSCRIPTION CHECKOUT (Phase 3) ---

/**
 * Create a Stripe checkout session for membership subscription
 * Redirects user to Stripe Checkout page
 * @param {string} gymId - Gym ID
 * @param {string} tierId - Membership tier ID
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const createSubscriptionCheckout = async (gymId, tierId) => {
  try {
    const functions = getFunctions();
    const createCheckout = httpsCallable(functions, 'createSubscriptionCheckout');

    const result = await createCheckout({
      gymId,
      tierId,
      origin: window.location.origin
    });

    if (result.data.url) {
      return { success: true, url: result.data.url };
    }

    return { success: false, error: "No checkout URL returned" };
  } catch (error) {
    // Extract error message from Firebase function error
    const errorMessage = error.message || "Failed to create checkout session";
    return { success: false, error: errorMessage };
  }
};

/**
 * Create a Stripe checkout session for admin to share with member
 * Used when admin wants to send a payment link to a member
 * @param {string} gymId - Gym ID
 * @param {string} tierId - Membership tier ID
 * @param {string} memberId - Target member's user ID
 * @param {number|string|null} customPrice - Optional custom price (overrides tier default)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const createAdminCheckoutLink = async (gymId, tierId, memberId, customPrice = null) => {
  try {
    const functions = getFunctions();
    const createCheckout = httpsCallable(functions, 'createAdminCheckoutLink');

    const result = await createCheckout({
      gymId,
      tierId,
      memberId,
      customPrice,
      origin: window.location.origin
    });

    if (result.data.url) {
      return { success: true, url: result.data.url };
    }

    return { success: false, error: "No checkout URL returned" };
  } catch (error) {
    const errorMessage = error.message || "Failed to create checkout link";
    return { success: false, error: errorMessage };
  }
};

/**
 * Create a Stripe Customer Portal session for managing billing
 * Opens the Stripe portal where members can update payment methods and view invoices
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const createCustomerPortalSession = async (gymId) => {
  try {
    const functions = getFunctions();
    const createPortal = httpsCallable(functions, 'createCustomerPortalSession');

    const result = await createPortal({
      gymId,
      origin: window.location.origin
    });

    if (result.data.url) {
      return { success: true, url: result.data.url };
    }

    return { success: false, error: "No portal URL returned" };
  } catch (error) {
    const errorMessage = error.message || "Failed to open billing portal";
    return { success: false, error: errorMessage };
  }
};

/**
 * Create a Stripe Checkout session for shop product purchases (cart checkout)
 * @param {string} gymId - Gym ID
 * @param {Array} cartItems - Array of {productId, variantId, quantity}
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const createShopCheckout = async (gymId, cartItems) => {
  try {
    const functions = getFunctions();
    const createCheckout = httpsCallable(functions, 'createShopCheckout');

    const result = await createCheckout({
      gymId,
      cartItems,
      origin: window.location.origin
    });

    if (result.data.url) {
      return { success: true, url: result.data.url };
    }

    return { success: false, error: "No checkout URL returned" };
  } catch (error) {
    const errorMessage = error.message || "Failed to create checkout session";
    return { success: false, error: errorMessage };
  }
};

/**
 * Create a Stripe Checkout session for one-time class pack purchase
 * @param {string} gymId - Gym ID
 * @param {string} packId - Class pack (membership tier) ID
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const createClassPackCheckout = async (gymId, packId) => {
  try {
    const functions = getFunctions();
    const createCheckout = httpsCallable(functions, 'createClassPackCheckout');

    const result = await createCheckout({
      gymId,
      packId,
      origin: window.location.origin
    });

    if (result.data.url) {
      return { success: true, url: result.data.url };
    }

    return { success: false, error: "No checkout URL returned" };
  } catch (error) {
    const errorMessage = error.message || "Failed to create checkout session";
    return { success: false, error: errorMessage };
  }
};

/**
 * Cancel a member's subscription
 * @param {string} gymId - Gym ID
 * @param {boolean} cancelImmediately - If true, cancel now; if false, cancel at end of period
 * @returns {Promise<{success: boolean, cancelledImmediately?: boolean, cancelAt?: string, error?: string}>}
 */
export const cancelMemberSubscription = async (gymId, cancelImmediately = false) => {
  try {
    const functions = getFunctions();
    const cancelSub = httpsCallable(functions, 'cancelMemberSubscription');

    const result = await cancelSub({ gymId, cancelImmediately });

    return {
      success: true,
      cancelledImmediately: result.data.cancelledImmediately,
      cancelAt: result.data.cancelAt
    };
  } catch (error) {
    const errorMessage = error.message || "Failed to cancel subscription";
    return { success: false, error: errorMessage };
  }
};

/**
 * Reactivate a subscription that was scheduled to cancel
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const reactivateSubscription = async (gymId) => {
  try {
    const functions = getFunctions();
    const reactivate = httpsCallable(functions, 'reactivateSubscription');

    await reactivate({ gymId });

    return { success: true };
  } catch (error) {
    const errorMessage = error.message || "Failed to reactivate subscription";
    return { success: false, error: errorMessage };
  }
};

/**
 * Preview or execute a subscription plan change
 * @param {string} gymId - Gym ID
 * @param {string} newTierId - New tier ID to switch to
 * @param {boolean} previewOnly - If true, only preview the change without executing
 * @returns {Promise<{success: boolean, preview?: object, newPlan?: object, error?: string}>}
 */
export const changeSubscriptionPlan = async (gymId, newTierId, previewOnly = false) => {
  try {
    const functions = getFunctions();
    const changePlan = httpsCallable(functions, 'changeSubscriptionPlan');

    const result = await changePlan({ gymId, newTierId, previewOnly });

    return {
      success: true,
      ...(previewOnly ? { preview: result.data.preview } : { newPlan: result.data.newPlan })
    };
  } catch (error) {
    const errorMessage = error.message || "Failed to change subscription plan";
    return { success: false, error: errorMessage };
  }
};

/**
 * Get payment methods for a member (read-only display)
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, paymentMethods?: array, defaultPaymentMethodId?: string, error?: string}>}
 */
export const getPaymentMethods = async (gymId) => {
  try {
    const functions = getFunctions();
    const getMethods = httpsCallable(functions, 'getPaymentMethods');

    const result = await getMethods({ gymId });

    return {
      success: true,
      paymentMethods: result.data.paymentMethods || [],
      defaultPaymentMethodId: result.data.defaultPaymentMethodId
    };
  } catch (error) {
    const errorMessage = error.message || "Failed to get payment methods";
    return { success: false, error: errorMessage, paymentMethods: [] };
  }
};
