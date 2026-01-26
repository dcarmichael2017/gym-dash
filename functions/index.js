// --- IMPORTS ---
const {onCall, HttpsError, onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {defineString, defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripe = require("stripe");

// --- INITIALIZATION ---
admin.initializeApp();

const stripeSecret = defineString("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// --- CORS CONFIG ---
const ALLOWED_ORIGINS = [
  /^https:\/\/.*\.app\.github\.dev$/,
  "http://localhost:5173",
  "http://localhost:5174",
];

// --- FUNCTION 1: CREATE STRIPE ACCOUNT (v2) ---
exports.createStripeAccountLink = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, origin} = request.data;

      if (!gymId || !origin) {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a 'gymId' and 'origin'.",
        );
      }

      // Validate origin
      const isAllowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (!isAllowed) {
        throw new HttpsError(
            "permission-denied",
            "The provided origin is not allowed.",
        );
      }

      try {
        const user = await admin.auth().getUser(request.auth.uid);
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        // Check if gym already has a Stripe account
        if (gymDoc.exists && gymDoc.data().stripeAccountId) {
          // Account already exists, create a new account link for onboarding
          const existingAccountId = gymDoc.data().stripeAccountId;
          const accountLink = await stripeClient.accountLinks.create({
            account: existingAccountId,
            refresh_url: `${origin}/onboarding/step-6?gymId=${gymId}`,
            return_url: `${origin}/onboarding/stripe-success?gymId=${gymId}`,
            type: "account_onboarding",
          });
          return {url: accountLink.url};
        }

        // Create new Stripe account
        const account = await stripeClient.accounts.create({
          type: "standard",
          email: user.email,
          metadata: {
            gymId: gymId,
            uid: request.auth.uid,
          },
        });

        await gymRef.update({
          stripeAccountId: account.id,
          stripeAccountStatus: "PENDING",
          stripeAccountCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const accountLink = await stripeClient.accountLinks.create({
          account: account.id,
          refresh_url: `${origin}/onboarding/step-6?gymId=${gymId}`,
          return_url: `${origin}/onboarding/stripe-success?gymId=${gymId}`,
          type: "account_onboarding",
        });

        return {url: accountLink.url};
      } catch (error) {
        console.error("Error creating Stripe account link:", error);
        throw new HttpsError("internal", "An error occurred: " + error.message);
      }
    },
);

// --- FUNCTION: VERIFY STRIPE ACCOUNT STATUS ---
/**
 * Checks the Stripe account status and updates Firestore accordingly.
 * Call this after user returns from Stripe onboarding or periodically.
 */
exports.verifyStripeAccount = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required.");
      }

      try {
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          return {
            success: true,
            status: "NOT_CONNECTED",
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
          };
        }

        // Retrieve account from Stripe
        const account = await stripeClient.accounts.retrieve(stripeAccountId);

        // Determine status based on account state
        let status = "PENDING";
        if (account.charges_enabled && account.payouts_enabled) {
          status = "ACTIVE";
        } else if (account.requirements?.disabled_reason) {
          status = "RESTRICTED";
        } else if (account.details_submitted) {
          status = "PENDING_VERIFICATION";
        }

        // Update Firestore with latest status
        await gymRef.update({
          stripeAccountStatus: status,
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
          stripeDetailsSubmitted: account.details_submitted,
          stripeAccountUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          status: status,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          requirements: account.requirements,
        };
      } catch (error) {
        console.error("Error verifying Stripe account:", error);
        throw new HttpsError("internal", "Failed to verify account: " + error.message);
      }
    },
);

// --- FUNCTION: CREATE STRIPE ACCOUNT LINK FOR REFRESH/RECONNECT ---
/**
 * Creates a new account link for an existing Stripe account.
 * Used when user needs to complete onboarding or update their account.
 */
exports.createStripeAccountLinkRefresh = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, origin, returnPath} = request.data;

      if (!gymId || !origin) {
        throw new HttpsError(
            "invalid-argument",
            "gymId and origin are required.",
        );
      }

      // Validate origin
      const isAllowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (!isAllowed) {
        throw new HttpsError("permission-denied", "Origin not allowed.");
      }

      try {
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const stripeAccountId = gymDoc.data().stripeAccountId;
        if (!stripeAccountId) {
          throw new HttpsError(
              "failed-precondition",
              "No Stripe account connected. Please start fresh onboarding.",
          );
        }

        const basePath = returnPath || "/admin/settings";
        const accountLink = await stripeClient.accountLinks.create({
          account: stripeAccountId,
          refresh_url: `${origin}${basePath}?stripe_refresh=true&gymId=${gymId}`,
          return_url: `${origin}${basePath}?stripe_success=true&gymId=${gymId}`,
          type: "account_onboarding",
        });

        return {url: accountLink.url};
      } catch (error) {
        console.error("Error creating Stripe account link:", error);
        throw new HttpsError("internal", "Failed to create link: " + error.message);
      }
    },
);

// --- FUNCTION: CREATE STRIPE LOGIN LINK ---
/**
 * Creates a login link for the connected account's Stripe Dashboard.
 */
exports.createStripeLoginLink = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required.");
      }

      try {
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const stripeAccountId = gymDoc.data().stripeAccountId;
        if (!stripeAccountId) {
          throw new HttpsError(
              "failed-precondition",
              "No Stripe account connected.",
          );
        }

        // Create a login link to the Stripe Express dashboard
        const loginLink = await stripeClient.accounts.createLoginLink(stripeAccountId);

        return {url: loginLink.url};
      } catch (error) {
        console.error("Error creating Stripe login link:", error);
        // For Standard accounts, they should go to dashboard.stripe.com directly
        if (error.code === "account_invalid" || error.type === "StripeInvalidRequestError") {
          return {
            url: "https://dashboard.stripe.com",
            note: "Standard accounts should use dashboard.stripe.com directly",
          };
        }
        throw new HttpsError("internal", "Failed to create login link: " + error.message);
      }
    },
);

// ============================================================================
// STRIPE PRODUCT & PRICE SYNC (Phase 2)
// ============================================================================

/**
 * Sync a membership tier to Stripe (create Product + Price)
 * Called when admin creates or updates a membership tier
 */
exports.syncMembershipTierToStripe = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, tierId, tierData} = request.data;

      if (!gymId || !tierId || !tierData) {
        throw new HttpsError(
            "invalid-argument",
            "gymId, tierId, and tierData are required.",
        );
      }

      try {
        // Get gym's Stripe account
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError(
              "failed-precondition",
              "Gym has no connected Stripe account.",
          );
        }

        // Check if Stripe account is active
        if (gymData.stripeAccountStatus !== "ACTIVE") {
          throw new HttpsError(
              "failed-precondition",
              "Stripe account is not active. Please complete onboarding first.",
          );
        }

        const tierRef = gymRef.collection("membershipTiers").doc(tierId);
        const tierDoc = await tierRef.get();
        const existingTier = tierDoc.exists ? tierDoc.data() : null;

        // Prepare Stripe product metadata
        const productMetadata = {
          gymId: gymId,
          tierId: tierId,
          type: tierData.interval === "one_time" ? "class_pack" : "membership",
        };

        let stripeProductId = existingTier?.stripeProductId;
        let stripePriceId = null;

        // Create or update Stripe Product
        if (stripeProductId) {
          // Update existing product
          await stripeClient.products.update(
              stripeProductId,
              {
                name: tierData.name,
                description: tierData.description || `${tierData.name} membership`,
                metadata: productMetadata,
              },
              {stripeAccount: stripeAccountId},
          );
        } else {
          // Create new product
          const product = await stripeClient.products.create(
              {
                name: tierData.name,
                description: tierData.description || `${tierData.name} membership`,
                metadata: productMetadata,
              },
              {stripeAccount: stripeAccountId},
          );
          stripeProductId = product.id;
        }

        // Create new Stripe Price (prices are immutable, so we always create new ones)
        const priceInCents = Math.round(parseFloat(tierData.price) * 100);

        if (tierData.interval === "one_time") {
          // One-time price for class packs
          const price = await stripeClient.prices.create(
              {
                product: stripeProductId,
                unit_amount: priceInCents,
                currency: "usd",
                metadata: {
                  gymId: gymId,
                  tierId: tierId,
                  credits: tierData.credits?.toString() || "0",
                },
              },
              {stripeAccount: stripeAccountId},
          );
          stripePriceId = price.id;
        } else {
          // Recurring price for subscriptions
          const intervalMap = {
            "week": "week",
            "2weeks": "week", // Stripe doesn't support 2 weeks, we'll use week * 2
            "month": "month",
            "year": "year",
          };

          const stripeInterval = intervalMap[tierData.interval] || "month";
          const intervalCount = tierData.interval === "2weeks" ? 2 : 1;

          const price = await stripeClient.prices.create(
              {
                product: stripeProductId,
                unit_amount: priceInCents,
                currency: "usd",
                recurring: {
                  interval: stripeInterval,
                  interval_count: intervalCount,
                },
                metadata: {
                  gymId: gymId,
                  tierId: tierId,
                },
              },
              {stripeAccount: stripeAccountId},
          );
          stripePriceId = price.id;
        }

        // Archive old price if it exists and is different
        if (existingTier?.stripePriceId && existingTier.stripePriceId !== stripePriceId) {
          try {
            await stripeClient.prices.update(
                existingTier.stripePriceId,
                {active: false},
                {stripeAccount: stripeAccountId},
            );
          } catch (archiveErr) {
            console.log("Could not archive old price:", archiveErr.message);
          }
        }

        // Update Firestore with Stripe IDs
        await tierRef.update({
          stripeProductId: stripeProductId,
          stripePriceId: stripePriceId,
          stripeSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          stripeProductId: stripeProductId,
          stripePriceId: stripePriceId,
        };
      } catch (error) {
        console.error("Error syncing membership tier to Stripe:", error);
        throw new HttpsError("internal", "Failed to sync: " + error.message);
      }
    },
);

/**
 * Sync a shop product to Stripe (create Product + Prices for variants)
 * Called when admin creates or updates a shop product
 */
exports.syncShopProductToStripe = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, productId, productData} = request.data;

      if (!gymId || !productId || !productData) {
        throw new HttpsError(
            "invalid-argument",
            "gymId, productId, and productData are required.",
        );
      }

      try {
        // Get gym's Stripe account
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError(
              "failed-precondition",
              "Gym has no connected Stripe account.",
          );
        }

        if (gymData.stripeAccountStatus !== "ACTIVE") {
          throw new HttpsError(
              "failed-precondition",
              "Stripe account is not active.",
          );
        }

        const productRef = gymRef.collection("products").doc(productId);
        const productDoc = await productRef.get();
        const existingProduct = productDoc.exists ? productDoc.data() : null;

        // Prepare Stripe product
        const productMetadata = {
          gymId: gymId,
          productId: productId,
          type: "shop_product",
          category: productData.category || "gear",
        };

        let stripeProductId = existingProduct?.stripeProductId;

        // Create or update Stripe Product
        const productPayload = {
          name: productData.name,
          description: productData.description || "",
          metadata: productMetadata,
        };

        // Add images if available
        if (productData.images && productData.images.length > 0) {
          productPayload.images = productData.images.slice(0, 8); // Stripe limits to 8 images
        }

        if (stripeProductId) {
          await stripeClient.products.update(
              stripeProductId,
              productPayload,
              {stripeAccount: stripeAccountId},
          );
        } else {
          const product = await stripeClient.products.create(
              productPayload,
              {stripeAccount: stripeAccountId},
          );
          stripeProductId = product.id;
        }

        // Handle pricing based on variants
        let stripePriceId = null;
        let variantPrices = [];

        if (productData.hasVariants && productData.variants?.length > 0) {
          // Create prices for each variant
          for (const variant of productData.variants) {
            const variantPriceInCents = Math.round(parseFloat(variant.price) * 100);

            const price = await stripeClient.prices.create(
                {
                  product: stripeProductId,
                  unit_amount: variantPriceInCents,
                  currency: "usd",
                  nickname: variant.name,
                  metadata: {
                    gymId: gymId,
                    productId: productId,
                    variantId: variant.id,
                    variantName: variant.name,
                  },
                },
                {stripeAccount: stripeAccountId},
            );

            variantPrices.push({
              variantId: variant.id,
              stripePriceId: price.id,
            });
          }
        } else {
          // Single price for non-variant products
          const priceInCents = Math.round(parseFloat(productData.price) * 100);

          const price = await stripeClient.prices.create(
              {
                product: stripeProductId,
                unit_amount: priceInCents,
                currency: "usd",
                metadata: {
                  gymId: gymId,
                  productId: productId,
                },
              },
              {stripeAccount: stripeAccountId},
          );
          stripePriceId = price.id;
        }

        // Update Firestore with Stripe IDs
        const updatePayload = {
          stripeProductId: stripeProductId,
          stripeSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (stripePriceId) {
          updatePayload.stripePriceId = stripePriceId;
        }

        // If variants, update each variant with its price ID
        if (variantPrices.length > 0) {
          const updatedVariants = productData.variants.map((variant) => {
            const priceInfo = variantPrices.find((vp) => vp.variantId === variant.id);
            return {
              ...variant,
              stripePriceId: priceInfo?.stripePriceId || null,
            };
          });
          updatePayload.variants = updatedVariants;
        }

        await productRef.update(updatePayload);

        return {
          success: true,
          stripeProductId: stripeProductId,
          stripePriceId: stripePriceId,
          variantPrices: variantPrices,
        };
      } catch (error) {
        console.error("Error syncing shop product to Stripe:", error);
        throw new HttpsError("internal", "Failed to sync: " + error.message);
      }
    },
);

/**
 * Archive a Stripe product (when deleting from our system)
 * We archive instead of delete to maintain Stripe records
 */
exports.archiveStripeProduct = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, stripeProductId} = request.data;

      if (!gymId || !stripeProductId) {
        throw new HttpsError(
            "invalid-argument",
            "gymId and stripeProductId are required.",
        );
      }

      try {
        // Get gym's Stripe account
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const stripeAccountId = gymDoc.data().stripeAccountId;
        if (!stripeAccountId) {
          return {success: true, message: "No Stripe account connected."};
        }

        // Archive the product (set active: false)
        await stripeClient.products.update(
            stripeProductId,
            {active: false},
            {stripeAccount: stripeAccountId},
        );

        return {success: true};
      } catch (error) {
        console.error("Error archiving Stripe product:", error);
        // Don't throw - if it fails, it's not critical
        return {success: false, error: error.message};
      }
    },
);

// --- FUNCTION 2: WAITLIST PROMOTION TRIGGER (v2) ---
/**
 * Detects changes in Attendance documents.
 * If status changes from 'waitlisted' -> 'booked', log it.
 */
exports.detectWaitlistPromotion = onDocumentUpdated(
    "gyms/{gymId}/attendance/{attendanceId}",
    (event) => {
      // In v2, data is wrapped in event.data
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();

      // Safety check: if document was deleted, afterData is undefined
      if (!beforeData || !afterData) return null;

      const wasWaitlisted = beforeData.status === "waitlisted";
      const isNowBooked = afterData.status === "booked";

      if (wasWaitlisted && isNowBooked) {
        const memberName = afterData.memberName || "Unknown Member";
        const className = afterData.className || "Unknown Class";

        console.log(
            `[📧 EMAIL TRIGGER] ${memberName} promoted in ${className}.`,
        );
        console.log(`[TODO] Send email to user ID: ${afterData.memberId}`);
      }

      return null;
    },
);

// --- FUNCTION 3: MIGRATE CLASS SERIES (v2) ---
exports.migrateClassSeries = onCall(
    {region: "us-central1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, oldClassId, cutoffDateString, newClassData, refundPolicy = 'refund'} = request.data;
      if (!gymId || !oldClassId || !cutoffDateString) {
        throw new HttpsError(
            "invalid-argument",
            "Missing required arguments: gymId, oldClassId, cutoffDateString.",
        );
      }

      const db = admin.firestore();
      const batch = db.batch();
      const refundedUserIds = new Set();

      try {
        // 1. Find all future bookings to be cancelled and refunded
        const bookingsQuery = db.collection("gyms").doc(gymId).collection("attendance")
            .where("classId", "==", oldClassId)
            .where("dateString", ">=", cutoffDateString)
            .where("status", "in", ["booked", "waitlisted"]);

        const bookingsSnapshot = await bookingsQuery.get();

        for (const doc of bookingsSnapshot.docs) {
          const booking = doc.data();
          const userRef = db.collection("users").doc(booking.memberId);

          // 2. Refund credits if any were used, based on the policy
          if (refundPolicy === 'refund' && booking.costUsed > 0) {
            batch.update(userRef, {
              classCredits: admin.firestore.FieldValue.increment(booking.costUsed),
            });

            // 3. Create a credit log for the refund
            const creditLogRef = db.collection("users").doc(booking.memberId).collection("creditLogs").doc();
            batch.set(creditLogRef, {
              amount: booking.costUsed,
              changeType: "refund",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              reason: `Admin migration: ${booking.className}`,
              source: "admin_migration",
            });
          }

          // 4. Mark the booking as cancelled
          batch.update(doc.ref, {
            status: "cancelled",
            cancelledAt: new Date(),
            refunded: true,
            refundAmount: booking.costUsed || 0,
          });

          refundedUserIds.add(booking.memberName || booking.memberId);
        }

        // 5. "Ghost" the old class series by setting its end date
        const oldClassRef = db.collection("gyms").doc(gymId).collection("classes").doc(oldClassId);
        batch.update(oldClassRef, {
          recurrenceEndDate: cutoffDateString,
          visibility: "admin", // Hide from public view
        });

        // 6. "Spawn" a new class series if new data is provided
        if (newClassData) {
          const newClassRef = db.collection("gyms").doc(gymId).collection("classes").doc();
          batch.set(newClassRef, {
            ...newClassData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            recurrenceEndDate: null, // Ensure new series has no end date
            attendanceCount: 0,
          });
        }

        await batch.commit();

        return {success: true, refundedUserIds: Array.from(refundedUserIds)};
      } catch (error) {
        console.error("Error migrating class series:", error);
        throw new HttpsError("internal", "An unexpected error occurred during migration.");
      }
    },
);

// ============================================================================
// STORAGE GOVERNANCE - Scheduled Media Cleanup ("Ghost Gym" Logic)
// ============================================================================

/**
 * Scheduled function that runs daily at 2 AM UTC to clean up expired chat media.
 * Implements the "Ghost Gym" logic: auto-delete chat media older than X days.
 */
exports.cleanupExpiredChatMedia = onSchedule(
    {
      schedule: "0 2 * * *", // Daily at 2 AM UTC
      timeZone: "UTC",
      retryCount: 3,
      region: "us-central1",
    },
    async () => {
      const db = admin.firestore();
      const storage = admin.storage();

      console.log("Starting expired chat media cleanup...");

      try {
        // Get all gyms
        const gymsSnapshot = await db.collection("gyms").get();
        let totalDeleted = 0;
        let totalErrors = 0;

        for (const gymDoc of gymsSnapshot.docs) {
          const gymId = gymDoc.id;
          const gymData = gymDoc.data();

          // Get retention settings (default 30 days)
          const retentionDays = gymData.chatMediaRetentionDays ?? 30;

          // Skip if retention is set to -1 (unlimited)
          if (retentionDays < 0) {
            console.log(`Gym ${gymId}: Unlimited retention, skipping...`);
            continue;
          }

          console.log(`Processing gym ${gymId} with ${retentionDays} day retention...`);

          const result = await cleanupGymChatMedia(db, storage, gymId, retentionDays);
          totalDeleted += result.deleted;
          totalErrors += result.errors;
        }

        console.log(`Cleanup complete. Deleted: ${totalDeleted}, Errors: ${totalErrors}`);
        return {success: true, deleted: totalDeleted, errors: totalErrors};
      } catch (error) {
        console.error("Error in scheduled cleanup:", error);
        throw error;
      }
    },
);

/**
 * Clean up expired chat media for a specific gym
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {admin.storage.Storage} storage - Storage instance
 * @param {string} gymId - The gym ID
 * @param {number} retentionDays - Days to retain media
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function cleanupGymChatMedia(db, storage, gymId, retentionDays) {
  let deleted = 0;
  let errors = 0;

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

  // Get all chat groups for this gym
  const chatGroupsSnapshot = await db
      .collection("gyms")
      .doc(gymId)
      .collection("chatGroups")
      .get();

  for (const groupDoc of chatGroupsSnapshot.docs) {
    const groupId = groupDoc.id;

    // Get expired messages with media
    const messagesSnapshot = await db
        .collection("gyms")
        .doc(gymId)
        .collection("chatGroups")
        .doc(groupId)
        .collection("messages")
        .where("timestamp", "<", cutoffTimestamp)
        .get();

    for (const msgDoc of messagesSnapshot.docs) {
      const msgData = msgDoc.data();

      // Skip if no media or already expired
      if (!msgData.media || !msgData.media.url || msgData.mediaExpired) {
        continue;
      }

      try {
        // Delete from Storage
        const mediaUrl = msgData.media.url;
        const deletedSuccessfully = await deleteStorageFile(storage, mediaUrl);

        if (deletedSuccessfully) {
          // Update message to mark media as expired
          await msgDoc.ref.update({
            media: admin.firestore.FieldValue.delete(),
            mediaExpired: true,
            mediaExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          deleted++;
          console.log(`Deleted media from message ${msgDoc.id} in group ${groupId}`);
        }
      } catch (error) {
        console.error(`Error deleting media from message ${msgDoc.id}:`, error);
        errors++;
      }
    }
  }

  return {deleted, errors};
}

/**
 * Delete a file from Firebase Storage using its download URL
 * @param {admin.storage.Storage} storage - Storage instance
 * @param {string} url - The download URL
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function deleteStorageFile(storage, url) {
  try {
    // Extract bucket and path from download URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?...
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)/);

    if (!pathMatch) {
      console.error("Could not parse storage URL:", url);
      return false;
    }

    const bucketName = pathMatch[1];
    const filePath = decodeURIComponent(pathMatch[2]);

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`File already deleted: ${filePath}`);
      return true;
    }

    // Delete the file
    await file.delete();
    console.log(`Deleted file: ${filePath}`);
    return true;
  } catch (error) {
    console.error("Error deleting storage file:", error);
    return false;
  }
}

/**
 * Callable function for admins to trigger immediate cleanup
 * Only callable by gym owners
 */
exports.triggerMediaCleanup = onCall(
    {
      cors: [/^https:\/\/.*\.app\.github\.dev$/, "http://localhost:5173"],
      region: "us-central1",
    },
    async (request) => {
      const db = admin.firestore();
      const storage = admin.storage();

      // Verify authentication
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
      }

      const {gymId, retentionDays} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required");
      }

      // Verify caller is owner of the gym
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      if (userData.gymId !== gymId || userData.role !== "owner") {
        throw new HttpsError("permission-denied", "Only gym owners can trigger cleanup");
      }

      // Run cleanup with specified or default retention
      const days = retentionDays ?? 30;
      console.log(`Manual cleanup triggered for gym ${gymId} with ${days} day retention`);

      const result = await cleanupGymChatMedia(db, storage, gymId, days);

      return {
        success: true,
        message: `Cleanup complete. Deleted ${result.deleted} expired media files.`,
        deleted: result.deleted,
        errors: result.errors,
      };
    },
);

/**
 * Callable function to get storage usage statistics for a gym
 */
exports.getStorageStats = onCall(
    {
      cors: [/^https:\/\/.*\.app\.github\.dev$/, "http://localhost:5173"],
      region: "us-central1",
    },
    async (request) => {
      const db = admin.firestore();

      // Verify authentication
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
      }

      const {gymId} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required");
      }

      // Verify caller is staff of the gym
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      const isStaff = userData.gymId === gymId &&
        ["owner", "staff", "coach"].includes(userData.role);

      if (!isStaff) {
        throw new HttpsError("permission-denied", "Must be gym staff");
      }

      try {
        // Count media in chat groups
        let totalChatMedia = 0;
        let totalChatSize = 0;

        const chatGroupsSnapshot = await db
            .collection("gyms")
            .doc(gymId)
            .collection("chatGroups")
            .get();

        for (const groupDoc of chatGroupsSnapshot.docs) {
          const messagesSnapshot = await groupDoc.ref
              .collection("messages")
              .get();

          for (const msgDoc of messagesSnapshot.docs) {
            const msgData = msgDoc.data();
            if (msgData.media && msgData.media.url && !msgData.mediaExpired) {
              totalChatMedia++;
              totalChatSize += msgData.media.size || 0;
            }
          }
        }

        // Count community post images
        let totalCommunityImages = 0;
        const postsSnapshot = await db
            .collection("gyms")
            .doc(gymId)
            .collection("communityPosts")
            .get();

        for (const postDoc of postsSnapshot.docs) {
          const postData = postDoc.data();
          if (postData.imageUrl) {
            totalCommunityImages++;
          }
        }

        return {
          success: true,
          stats: {
            chatMedia: {
              count: totalChatMedia,
              sizeBytes: totalChatSize,
              sizeMB: Math.round(totalChatSize / (1024 * 1024) * 100) / 100,
            },
            communityImages: {
              count: totalCommunityImages,
            },
          },
        };
      } catch (error) {
        console.error("Error getting storage stats:", error);
        throw new HttpsError("internal", "Error calculating storage stats");
      }
    },
);

// ============================================================================
// STRIPE WEBHOOK HANDLER
// ============================================================================

/**
 * Stripe Webhook Handler
 * Receives events from Stripe and processes them accordingly.
 *
 * IMPORTANT: This uses onRequest (not onCall) because Stripe sends raw HTTP requests.
 * The webhook secret must be configured in Stripe Dashboard and set via:
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 */
exports.stripeWebhook = onRequest(
    {
      region: "us-central1",
      secrets: [stripeWebhookSecret],
    },
    async (req, res) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      // Only accept POST requests
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const sig = req.headers["stripe-signature"];
      const webhookSecret = stripeWebhookSecret.value();

      let event;

      try {
        // Verify webhook signature
        event = stripeClient.webhooks.constructEvent(
            req.rawBody,
            sig,
            webhookSecret,
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }

      console.log(`Received Stripe event: ${event.type} (${event.id})`);

      try {
        // Handle the event based on type
        switch (event.type) {
          case "account.updated":
            await handleAccountUpdated(db, stripeClient, event);
            break;

          case "checkout.session.completed":
            await handleCheckoutSessionCompleted(db, event);
            break;

          case "invoice.paid":
            await handleInvoicePaid(db, event);
            break;

          case "invoice.payment_failed":
            await handleInvoicePaymentFailed(db, event);
            break;

          case "customer.subscription.updated":
            await handleSubscriptionUpdated(db, event);
            break;

          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(db, event);
            break;

          case "charge.refunded":
            await handleChargeRefunded(db, event);
            break;

          case "charge.dispute.created":
            await handleDisputeCreated(db, event);
            break;

          case "charge.dispute.closed":
            await handleDisputeClosed(db, event);
            break;

          default:
            console.log(`Unhandled event type: ${event.type}`);
        }

        // Return success
        res.status(200).json({received: true});
      } catch (error) {
        console.error("Error processing webhook:", error);
        // Return 200 to acknowledge receipt (Stripe will retry on 4xx/5xx)
        // Log the error but don't fail the webhook
        res.status(200).json({received: true, error: error.message});
      }
    },
);

// --- WEBHOOK HANDLERS ---

/**
 * Handle account.updated event
 * Updates the gym's Stripe account status when their connected account changes
 */
async function handleAccountUpdated(db, stripeClient, event) {
  const account = event.data.object;
  const gymId = account.metadata?.gymId;

  if (!gymId) {
    console.log("No gymId in account metadata, searching by account ID...");
    // Find gym by stripeAccountId
    const gymsSnapshot = await db.collection("gyms")
        .where("stripeAccountId", "==", account.id)
        .limit(1)
        .get();

    if (gymsSnapshot.empty) {
      console.log(`No gym found for Stripe account ${account.id}`);
      return;
    }

    const gymDoc = gymsSnapshot.docs[0];
    await updateGymStripeStatus(db, gymDoc.id, account, event.id);
  } else {
    await updateGymStripeStatus(db, gymId, account, event.id);
  }
}

/**
 * Update gym document with Stripe account status
 */
async function updateGymStripeStatus(db, gymId, account, eventId) {
  const gymRef = db.collection("gyms").doc(gymId);

  // Check for idempotency
  const eventRef = gymRef.collection("stripeEvents").doc(eventId);
  const eventDoc = await eventRef.get();
  if (eventDoc.exists && eventDoc.data().processed) {
    console.log(`Event ${eventId} already processed, skipping.`);
    return;
  }

  // Determine status
  let status = "PENDING";
  if (account.charges_enabled && account.payouts_enabled) {
    status = "ACTIVE";
  } else if (account.requirements?.disabled_reason) {
    status = "RESTRICTED";
  } else if (account.details_submitted) {
    status = "PENDING_VERIFICATION";
  }

  // Update gym document
  await gymRef.update({
    stripeAccountStatus: status,
    stripeChargesEnabled: account.charges_enabled,
    stripePayoutsEnabled: account.payouts_enabled,
    stripeDetailsSubmitted: account.details_submitted,
    stripeAccountUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log the event
  await eventRef.set({
    eventType: "account.updated",
    stripeEventId: eventId,
    processed: true,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      status: status,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Updated gym ${gymId} Stripe status to ${status}`);
}

/**
 * Handle checkout.session.completed event
 * This is where we fulfill orders, add credits, or create memberships
 */
async function handleCheckoutSessionCompleted(db, event) {
  const session = event.data.object;
  const metadata = session.metadata || {};

  console.log("Checkout session completed:", session.id);
  console.log("Metadata:", metadata);

  // Check what type of purchase this is based on metadata
  const purchaseType = metadata.type; // 'membership', 'class_pack', 'shop_order'
  const gymId = metadata.gymId;
  const userId = metadata.userId;

  if (!gymId) {
    console.log("No gymId in session metadata, cannot process.");
    return;
  }

  // Log the event for idempotency
  const gymRef = db.collection("gyms").doc(gymId);
  const eventRef = gymRef.collection("stripeEvents").doc(event.id);
  const eventDoc = await eventRef.get();

  if (eventDoc.exists && eventDoc.data().processed) {
    console.log(`Event ${event.id} already processed, skipping.`);
    return;
  }

  // Process based on type
  switch (purchaseType) {
    case "membership":
      await handleMembershipCheckoutCompleted(db, session, metadata);
      break;

    case "class_pack":
      await handleClassPackCheckoutCompleted(db, session, metadata);
      break;

    case "shop_order":
      await handleShopOrderCheckoutCompleted(db, session, metadata);
      break;

    default:
      console.log(`Unknown purchase type: ${purchaseType}`);
  }

  // Log the event as processed
  await eventRef.set({
    eventType: "checkout.session.completed",
    stripeEventId: event.id,
    processed: true,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    data: {
      sessionId: session.id,
      purchaseType: purchaseType,
      userId: userId,
      amountTotal: session.amount_total,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Handle completed checkout for membership subscription
 * Creates/updates membership document in Firestore
 */
async function handleMembershipCheckoutCompleted(db, session, metadata) {
  const {gymId, tierId, userId, tierName} = metadata;

  if (!userId || !gymId || !tierId) {
    console.error("Missing required metadata for membership checkout:", metadata);
    return;
  }

  console.log(`Processing membership subscription for user ${userId} at gym ${gymId}`);

  // Get subscription details from the session
  const subscriptionId = session.subscription;
  const customerId = session.customer;

  if (!subscriptionId) {
    console.error("No subscription ID in checkout session");
    return;
  }

  // Get the membership tier data for additional details
  const tierRef = db.collection("gyms").doc(gymId).collection("membershipTiers").doc(tierId);
  const tierDoc = await tierRef.get();
  const tierData = tierDoc.exists ? tierDoc.data() : null;

  // Calculate period dates
  // Note: For trials, currentPeriodStart might be the trial start
  // The actual subscription details come from the subscription object
  const now = new Date();

  // Build membership document
  const membershipData = {
    status: "active",
    membershipId: tierId,
    membershipName: tierName || tierData?.name || "Membership",
    price: tierData?.price || 0,
    interval: tierData?.interval || "month",
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    stripeCheckoutSessionId: session.id,
    startDate: admin.firestore.FieldValue.serverTimestamp(),
    currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
    // currentPeriodEnd will be updated by invoice.paid webhook or subscription.updated
    cancelAtPeriodEnd: false,
    // Features from tier
    features: tierData?.features || [],
    // Credits allocation if tier grants credits
    monthlyCredits: tierData?.monthlyCredits || 0,
    // Track if came from trial
    hadTrial: tierData?.hasTrial || false,
    trialDays: tierData?.trialDays || 0,
    // Timestamps
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // If this was a trialing subscription
  if (session.mode === "subscription" && tierData?.hasTrial && tierData?.trialDays > 0) {
    membershipData.status = "trialing";
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + tierData.trialDays);
    membershipData.trialEndDate = admin.firestore.Timestamp.fromDate(trialEnd);
  }

  // Update/create membership document
  const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
  await membershipRef.set(membershipData, {merge: true});

  // Log to membership history
  const historyRef = membershipRef.collection("history").doc();
  const historyEntry = {
    action: "subscribed",
    description: `Subscribed to ${tierName || tierData?.name}`,
    price: tierData?.price || 0,
    interval: tierData?.interval || "month",
    stripeSubscriptionId: subscriptionId,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (membershipData.status === "trialing") {
    historyEntry.description = `Started free trial for ${tierName || tierData?.name}`;
    historyEntry.trialDays = tierData.trialDays;
  }

  await historyRef.set(historyEntry);

  // Update user document with gym membership reference if needed
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    // If user doesn't have a primary gym, set this one
    if (!userData.gymId) {
      await userRef.update({
        gymId: gymId,
        role: "member",
      });
    }

    // Add to gym's members array if not already
    const gymRef = db.collection("gyms").doc(gymId);
    await gymRef.update({
      memberCount: admin.firestore.FieldValue.increment(1),
    });
  }

  // Allocate initial credits if the tier includes them
  if (tierData?.monthlyCredits > 0) {
    const creditsRef = db.collection("users").doc(userId).collection("credits").doc(gymId);
    const creditsDoc = await creditsRef.get();

    const currentCredits = creditsDoc.exists ? (creditsDoc.data().balance || 0) : 0;

    await creditsRef.set({
      balance: currentCredits + tierData.monthlyCredits,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    // Log credit allocation
    const creditLogRef = creditsRef.collection("logs").doc();
    await creditLogRef.set({
      amount: tierData.monthlyCredits,
      changeType: "membership_allocation",
      description: `Monthly credits from ${tierName || tierData?.name} subscription`,
      balance: currentCredits + tierData.monthlyCredits,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(`Successfully created membership for user ${userId} at gym ${gymId}`);
}

/**
 * Handle completed checkout for class pack purchase
 * Adds credits to user's account
 */
async function handleClassPackCheckoutCompleted(db, session, metadata) {
  const {gymId, userId, packId, packName, credits} = metadata;

  if (!userId || !gymId || !packId) {
    console.error("Missing required metadata for class pack checkout:", metadata);
    return;
  }

  console.log(`Processing class pack purchase for user ${userId} at gym ${gymId}`);

  const creditsToAdd = parseInt(credits) || 0;

  if (creditsToAdd <= 0) {
    console.error("No credits to add from class pack:", packId);
    return;
  }

  // Get current credits balance
  const creditsRef = db.collection("users").doc(userId).collection("credits").doc(gymId);
  const creditsDoc = await creditsRef.get();
  const currentCredits = creditsDoc.exists ? (creditsDoc.data().balance || 0) : 0;

  // Add credits
  await creditsRef.set({
    balance: currentCredits + creditsToAdd,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  // Log credit allocation
  const creditLogRef = creditsRef.collection("logs").doc();
  await creditLogRef.set({
    amount: creditsToAdd,
    changeType: "class_pack_purchase",
    description: `Purchased ${packName || "Class Pack"} - ${creditsToAdd} credits added`,
    balance: currentCredits + creditsToAdd,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log to membership history if user has a membership
  const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
  const membershipDoc = await membershipRef.get();

  if (membershipDoc.exists) {
    const historyRef = membershipRef.collection("history").doc();
    await historyRef.set({
      action: "class_pack_purchased",
      description: `Purchased ${packName || "Class Pack"} - ${creditsToAdd} credits`,
      creditsAdded: creditsToAdd,
      stripeCheckoutSessionId: session.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(`Successfully added ${creditsToAdd} credits to user ${userId} at gym ${gymId}`);
}

/**
 * Handle completed checkout for shop order
 * Creates order document and decrements stock
 */
async function handleShopOrderCheckoutCompleted(db, session, metadata) {
  const {gymId, userId, orderItems, subtotal} = metadata;

  if (!userId || !gymId || !orderItems) {
    console.error("Missing required metadata for shop order checkout:", metadata);
    return;
  }

  console.log(`Processing shop order for user ${userId} at gym ${gymId}`);

  // Parse order items from metadata (stored as JSON string)
  let items;
  try {
    items = JSON.parse(orderItems);
  } catch (e) {
    console.error("Failed to parse orderItems:", e);
    return;
  }

  // Get user data for order
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : {};

  // Create order document
  const gymRef = db.collection("gyms").doc(gymId);
  const orderRef = gymRef.collection("orders").doc();

  const orderData = {
    id: orderRef.id,
    memberId: userId,
    memberName: userData.displayName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Unknown",
    memberEmail: userData.email || "",
    items: items,
    subtotal: parseFloat(subtotal) || 0,
    total: session.amount_total / 100, // Convert from cents
    status: "paid",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
    fulfillmentNotes: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    fulfilledAt: null,
  };

  await orderRef.set(orderData);

  // Decrement stock for each item
  for (const item of items) {
    const productRef = gymRef.collection("products").doc(item.productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) continue;

    const productData = productDoc.data();

    if (productData.hasVariants && item.variantId) {
      // Update variant stock
      const updatedVariants = (productData.variants || []).map((v) => {
        if (v.id === item.variantId) {
          return {...v, stock: Math.max(0, (v.stock || 0) - item.quantity)};
        }
        return v;
      });
      await productRef.update({variants: updatedVariants});
    } else if (!productData.hasVariants) {
      // Update product stock
      const newStock = Math.max(0, (productData.stock || 0) - item.quantity);
      await productRef.update({stock: newStock});
    }
  }

  // Log to membership history if user has a membership
  const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
  const membershipDoc = await membershipRef.get();

  if (membershipDoc.exists) {
    const historyRef = membershipRef.collection("history").doc();
    await historyRef.set({
      action: "shop_purchase",
      description: `Shop purchase - ${items.length} item(s) - $${(session.amount_total / 100).toFixed(2)}`,
      orderId: orderRef.id,
      stripeCheckoutSessionId: session.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(`Successfully created order ${orderRef.id} for user ${userId} at gym ${gymId}`);
}

/**
 * Handle invoice.paid event
 * Updates membership renewal dates
 */
async function handleInvoicePaid(db, event) {
  const invoice = event.data.object;
  console.log("Invoice paid:", invoice.id);

  // Skip invoices that aren't for subscriptions
  if (!invoice.subscription) {
    console.log("Invoice is not for a subscription, skipping.");
    return;
  }

  // Get subscription metadata to find user/gym
  const subscriptionId = invoice.subscription;
  const metadata = invoice.subscription_details?.metadata || {};
  const gymId = metadata.gymId;
  const userId = metadata.userId;

  if (!gymId || !userId) {
    console.log("Missing gymId or userId in invoice metadata, skipping.");
    return;
  }

  // Check for idempotency
  const gymRef = db.collection("gyms").doc(gymId);
  const eventRef = gymRef.collection("stripeEvents").doc(event.id);
  const eventDoc = await eventRef.get();

  if (eventDoc.exists && eventDoc.data().processed) {
    console.log(`Event ${event.id} already processed, skipping.`);
    return;
  }

  try {
    // Get membership document
    const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists) {
      console.log(`Membership not found for user ${userId} at gym ${gymId}`);
      return;
    }

    const membershipData = membershipDoc.data();

    // Only process if this matches our subscription
    if (membershipData.stripeSubscriptionId !== subscriptionId) {
      console.log("Invoice subscription doesn't match membership subscription, skipping.");
      return;
    }

    // Calculate period dates from invoice
    const periodStart = invoice.period_start ?
        admin.firestore.Timestamp.fromMillis(invoice.period_start * 1000) : null;
    const periodEnd = invoice.period_end ?
        admin.firestore.Timestamp.fromMillis(invoice.period_end * 1000) : null;

    // Update membership with new period dates
    const updateData = {
      lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (periodStart) updateData.currentPeriodStart = periodStart;
    if (periodEnd) updateData.currentPeriodEnd = periodEnd;

    // If member was in past_due or trialing, they're now active
    if (membershipData.status === "past_due" || membershipData.status === "trialing") {
      updateData.status = "active";
    }

    await membershipRef.update(updateData);

    // Log to membership history
    const historyRef = membershipRef.collection("history").doc();
    const formattedDate = periodEnd ?
        new Date(periodEnd.toMillis()).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }) : "N/A";

    await historyRef.set({
      action: "payment_succeeded",
      description: `Payment successful - next billing: ${formattedDate}`,
      amount: invoice.amount_paid / 100,
      invoiceId: invoice.id,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log event as processed
    await eventRef.set({
      eventType: "invoice.paid",
      stripeEventId: event.id,
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      data: {
        invoiceId: invoice.id,
        userId: userId,
        amount: invoice.amount_paid,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Successfully processed invoice.paid for user ${userId} at gym ${gymId}`);
  } catch (error) {
    console.error("Error processing invoice.paid:", error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 * Updates membership status to past_due, notifies member
 */
async function handleInvoicePaymentFailed(db, event) {
  const invoice = event.data.object;
  console.log("Invoice payment failed:", invoice.id);

  // Skip invoices that aren't for subscriptions
  if (!invoice.subscription) {
    console.log("Invoice is not for a subscription, skipping.");
    return;
  }

  // Get subscription metadata to find user/gym
  const subscriptionId = invoice.subscription;
  const metadata = invoice.subscription_details?.metadata || {};
  const gymId = metadata.gymId;
  const userId = metadata.userId;

  if (!gymId || !userId) {
    console.log("Missing gymId or userId in invoice metadata, skipping.");
    return;
  }

  // Check for idempotency
  const gymRef = db.collection("gyms").doc(gymId);
  const eventRef = gymRef.collection("stripeEvents").doc(event.id);
  const eventDoc = await eventRef.get();

  if (eventDoc.exists && eventDoc.data().processed) {
    console.log(`Event ${event.id} already processed, skipping.`);
    return;
  }

  try {
    // Get membership document
    const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists) {
      console.log(`Membership not found for user ${userId} at gym ${gymId}`);
      return;
    }

    const membershipData = membershipDoc.data();

    // Only process if this matches our subscription
    if (membershipData.stripeSubscriptionId !== subscriptionId) {
      console.log("Invoice subscription doesn't match membership subscription, skipping.");
      return;
    }

    // Update membership to past_due status
    await membershipRef.update({
      status: "past_due",
      lastPaymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentFailureReason: invoice.last_finalization_error?.message || "Payment failed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log to membership history
    const historyRef = membershipRef.collection("history").doc();
    await historyRef.set({
      action: "payment_failed",
      description: "Payment failed - please update your payment method",
      invoiceId: invoice.id,
      failureReason: invoice.last_finalization_error?.message || "Payment failed",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log event as processed
    await eventRef.set({
      eventType: "invoice.payment_failed",
      stripeEventId: event.id,
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      data: {
        invoiceId: invoice.id,
        userId: userId,
        failureReason: invoice.last_finalization_error?.message,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Successfully processed invoice.payment_failed for user ${userId} at gym ${gymId}`);

    // TODO: Send notification to member (email/push) about failed payment
  } catch (error) {
    console.error("Error processing invoice.payment_failed:", error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated event
 * Syncs subscription changes (plan changes, cancellation scheduled, etc.)
 */
async function handleSubscriptionUpdated(db, event) {
  const subscription = event.data.object;
  console.log("Subscription updated:", subscription.id);

  // Get metadata to find user/gym
  const metadata = subscription.metadata || {};
  const gymId = metadata.gymId;
  const userId = metadata.userId;

  if (!gymId || !userId) {
    console.log("Missing gymId or userId in subscription metadata, skipping.");
    return;
  }

  // Check for idempotency
  const gymRef = db.collection("gyms").doc(gymId);
  const eventRef = gymRef.collection("stripeEvents").doc(event.id);
  const eventDoc = await eventRef.get();

  if (eventDoc.exists && eventDoc.data().processed) {
    console.log(`Event ${event.id} already processed, skipping.`);
    return;
  }

  try {
    // Get membership document
    const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists) {
      console.log(`Membership not found for user ${userId} at gym ${gymId}`);
      return;
    }

    const membershipData = membershipDoc.data();

    // Only process if this matches our subscription
    if (membershipData.stripeSubscriptionId !== subscription.id) {
      console.log("Subscription doesn't match membership subscription, skipping.");
      return;
    }

    // Build update data
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Map Stripe status to our status
    const statusMap = {
      active: "active",
      past_due: "past_due",
      unpaid: "past_due",
      canceled: "cancelled",
      incomplete: "pending",
      incomplete_expired: "cancelled",
      trialing: "trialing",
      paused: "paused",
    };

    if (statusMap[subscription.status]) {
      updateData.status = statusMap[subscription.status];
    }

    // Update cancel_at_period_end flag
    updateData.cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

    // Update period dates
    if (subscription.current_period_start) {
      updateData.currentPeriodStart = admin.firestore.Timestamp.fromMillis(
          subscription.current_period_start * 1000,
      );
    }
    if (subscription.current_period_end) {
      updateData.currentPeriodEnd = admin.firestore.Timestamp.fromMillis(
          subscription.current_period_end * 1000,
      );
    }

    // Update trial end if applicable
    if (subscription.trial_end) {
      updateData.trialEndDate = admin.firestore.Timestamp.fromMillis(subscription.trial_end * 1000);
    }

    // If subscription has cancel_at set, store when it will cancel
    if (subscription.cancel_at) {
      updateData.cancelAt = admin.firestore.Timestamp.fromMillis(subscription.cancel_at * 1000);
    }

    await membershipRef.update(updateData);

    // Log to history if cancellation was scheduled
    if (subscription.cancel_at_period_end && !membershipData.cancelAtPeriodEnd) {
      const historyRef = membershipRef.collection("history").doc();
      const cancelDate = subscription.current_period_end ?
          new Date(subscription.current_period_end * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }) : "end of period";

      await historyRef.set({
        action: "cancellation_scheduled",
        description: `Subscription set to cancel on ${cancelDate}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Log to history if cancellation was reversed
    if (!subscription.cancel_at_period_end && membershipData.cancelAtPeriodEnd) {
      const historyRef = membershipRef.collection("history").doc();
      await historyRef.set({
        action: "cancellation_reversed",
        description: "Subscription cancellation was reversed",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Log event as processed
    await eventRef.set({
      eventType: "customer.subscription.updated",
      stripeEventId: event.id,
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      data: {
        subscriptionId: subscription.id,
        userId: userId,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Successfully processed subscription.updated for user ${userId} at gym ${gymId}`);
  } catch (error) {
    console.error("Error processing subscription.updated:", error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted event
 * Cancels membership when subscription ends
 */
async function handleSubscriptionDeleted(db, event) {
  const subscription = event.data.object;
  console.log("Subscription deleted:", subscription.id);

  // Get metadata to find user/gym
  const metadata = subscription.metadata || {};
  const gymId = metadata.gymId;
  const userId = metadata.userId;

  if (!gymId || !userId) {
    console.log("Missing gymId or userId in subscription metadata, skipping.");
    return;
  }

  // Check for idempotency
  const gymRef = db.collection("gyms").doc(gymId);
  const eventRef = gymRef.collection("stripeEvents").doc(event.id);
  const eventDoc = await eventRef.get();

  if (eventDoc.exists && eventDoc.data().processed) {
    console.log(`Event ${event.id} already processed, skipping.`);
    return;
  }

  try {
    // Get membership document
    const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists) {
      console.log(`Membership not found for user ${userId} at gym ${gymId}`);
      return;
    }

    const membershipData = membershipDoc.data();

    // Only process if this matches our subscription
    if (membershipData.stripeSubscriptionId !== subscription.id) {
      console.log("Subscription doesn't match membership subscription, skipping.");
      return;
    }

    // Update membership to cancelled status
    await membershipRef.update({
      status: "inactive",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancellationReason: subscription.cancellation_details?.reason || "Subscription ended",
      stripeSubscriptionId: null, // Clear the subscription ID
      cancelAtPeriodEnd: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log to membership history
    const historyRef = membershipRef.collection("history").doc();
    await historyRef.set({
      action: "subscription_ended",
      description: "Subscription has ended",
      reason: subscription.cancellation_details?.reason || "Period ended",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log event as processed
    await eventRef.set({
      eventType: "customer.subscription.deleted",
      stripeEventId: event.id,
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      data: {
        subscriptionId: subscription.id,
        userId: userId,
        reason: subscription.cancellation_details?.reason,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Decrement gym member count
    await gymRef.update({
      memberCount: admin.firestore.FieldValue.increment(-1),
    });

    console.log(`Successfully processed subscription.deleted for user ${userId} at gym ${gymId}`);
  } catch (error) {
    console.error("Error processing subscription.deleted:", error);
    throw error;
  }
}

/**
 * Handle charge.refunded event
 * Processes refunds and updates order status
 */
async function handleChargeRefunded(db, event) {
  const charge = event.data.object;
  console.log("Charge refunded:", charge.id);

  try {
    // Find the order associated with this charge's payment intent
    const paymentIntentId = charge.payment_intent;

    if (!paymentIntentId) {
      console.log("No payment intent on charge, cannot process refund webhook.");
      return;
    }

    // Search for the order by stripePaymentIntentId across all gyms
    const gymsSnapshot = await db.collection("gyms").get();

    for (const gymDoc of gymsSnapshot.docs) {
      const ordersQuery = await gymDoc.ref.collection("orders")
          .where("stripePaymentIntentId", "==", paymentIntentId)
          .limit(1)
          .get();

      if (!ordersQuery.empty) {
        const orderDoc = ordersQuery.docs[0];

        // Check for idempotency
        const eventRef = gymDoc.ref.collection("stripeEvents").doc(event.id);
        const eventDoc = await eventRef.get();
        if (eventDoc.exists && eventDoc.data().processed) {
          console.log(`Refund event ${event.id} already processed, skipping.`);
          return;
        }

        // Calculate refund amounts
        const refundedAmountCents = charge.amount_refunded || 0;
        const totalAmountCents = charge.amount || 0;
        const isFullRefund = refundedAmountCents >= totalAmountCents;

        const newStatus = isFullRefund ? "refunded" : "partially_refunded";

        // Update the order
        await orderDoc.ref.update({
          status: newStatus,
          refundedAmount: refundedAmountCents / 100,
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log the event
        await eventRef.set({
          eventType: "charge.refunded",
          stripeEventId: event.id,
          chargeId: charge.id,
          orderId: orderDoc.id,
          refundedAmount: refundedAmountCents / 100,
          isFullRefund: isFullRefund,
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Processed refund webhook for order ${orderDoc.id}: $${refundedAmountCents / 100}`);
        return;
      }
    }

    // If no order found, might be a subscription or class pack refund
    // Those are handled by the processRefund function directly
    console.log(`No order found for payment intent ${paymentIntentId}, might be subscription/class pack.`);
  } catch (error) {
    console.error("Error processing charge.refunded webhook:", error);
    throw error;
  }
}

/**
 * Handle charge.dispute.created event
 * Logs dispute and notifies gym owner
 */
async function handleDisputeCreated(db, event) {
  const dispute = event.data.object;
  console.log("Dispute created:", dispute.id);

  try {
    const chargeId = dispute.charge;
    const paymentIntentId = dispute.payment_intent;

    if (!chargeId && !paymentIntentId) {
      console.log("No charge or payment intent on dispute, cannot process.");
      return;
    }

    // Search for the order by payment intent across all gyms
    const gymsSnapshot = await db.collection("gyms").get();

    for (const gymDoc of gymsSnapshot.docs) {
      // Query orders by payment intent ID
      const ordersQuery = await gymDoc.ref.collection("orders")
          .where("stripePaymentIntentId", "==", paymentIntentId)
          .limit(1)
          .get();

      if (!ordersQuery.empty) {
        const orderDoc = ordersQuery.docs[0];
        const orderData = orderDoc.data();

        // Check for idempotency
        const disputeEventRef = gymDoc.ref.collection("stripeEvents").doc(event.id);
        const existingEvent = await disputeEventRef.get();
        if (existingEvent.exists && existingEvent.data().processed) {
          console.log(`Dispute event ${event.id} already processed, skipping.`);
          return;
        }

        // Mark the order as disputed
        await orderDoc.ref.update({
          hasDispute: true,
          disputeId: dispute.id,
          disputeStatus: dispute.status,
          disputeReason: dispute.reason,
          disputeAmount: dispute.amount / 100,
          disputeCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log to stripeEvents
        await disputeEventRef.set({
          eventType: "charge.dispute.created",
          stripeEventId: event.id,
          disputeId: dispute.id,
          chargeId: chargeId,
          orderId: orderDoc.id,
          amount: dispute.amount / 100,
          reason: dispute.reason,
          status: dispute.status,
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Store dispute info at gym level for dashboard
        const disputeRef = gymDoc.ref.collection("disputes").doc(dispute.id);
        await disputeRef.set({
          disputeId: dispute.id,
          chargeId: chargeId,
          orderId: orderDoc.id,
          amount: dispute.amount / 100,
          reason: dispute.reason,
          status: dispute.status,
          memberName: orderData.memberName,
          memberEmail: orderData.memberEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          evidenceDueBy: dispute.evidence_details?.due_by
            ? new Date(dispute.evidence_details.due_by * 1000)
            : null,
        });

        console.log(`Logged dispute ${dispute.id} for order ${orderDoc.id} at gym ${gymDoc.id}`);

        // TODO: Send email notification to gym owner
        // This would use a mail service like SendGrid

        return;
      }
    }

    console.log(`Could not find order for disputed payment intent ${paymentIntentId}`);
  } catch (error) {
    console.error("Error processing dispute.created webhook:", error);
    throw error;
  }
}

/**
 * Handle charge.dispute.closed event
 * Updates dispute status
 */
async function handleDisputeClosed(db, event) {
  const dispute = event.data.object;
  console.log("Dispute closed:", dispute.id, "Status:", dispute.status);

  try {
    // Find and update the dispute record
    const gymsSnapshot = await db.collection("gyms").get();

    for (const gymDoc of gymsSnapshot.docs) {
      const disputeRef = gymDoc.ref.collection("disputes").doc(dispute.id);
      const disputeDoc = await disputeRef.get();

      if (disputeDoc.exists) {
        await disputeRef.update({
          status: dispute.status,
          closedAt: admin.firestore.FieldValue.serverTimestamp(),
          won: dispute.status === "won",
        });

        // Update the order's dispute status
        const disputeData = disputeDoc.data();
        if (disputeData.orderId) {
          const orderRef = gymDoc.ref.collection("orders").doc(disputeData.orderId);
          await orderRef.update({
            disputeStatus: dispute.status,
            disputeClosedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Log the event
        const eventRef = gymDoc.ref.collection("stripeEvents").doc(event.id);
        await eventRef.set({
          eventType: "charge.dispute.closed",
          stripeEventId: event.id,
          disputeId: dispute.id,
          status: dispute.status,
          won: dispute.status === "won",
          processed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Updated dispute ${dispute.id} to status: ${dispute.status}`);
        return;
      }
    }

    console.log(`Dispute ${dispute.id} not found in database`);
  } catch (error) {
    console.error("Error processing dispute.closed webhook:", error);
    throw error;
  }
}

// ============================================================================
// PHASE 3: SUBSCRIPTION CHECKOUT
// ============================================================================

/**
 * Create a Stripe Checkout Session for membership subscription
 * Called when member wants to subscribe to a membership tier
 *
 * @param {string} gymId - The gym ID
 * @param {string} tierId - The membership tier ID
 * @param {string} origin - The origin URL for success/cancel redirects
 * @returns {Object} - { url: string } - The Stripe Checkout URL
 */
/**
 * Create a Stripe Customer Portal session for managing billing
 * Allows members to view invoices, update payment methods, and cancel subscriptions
 *
 * @param {string} gymId - The gym ID
 * @returns {Object} - { url: string } - The Customer Portal URL
 */
exports.createCustomerPortalSession = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, origin} = request.data;

      if (!gymId || !origin) {
        throw new HttpsError(
            "invalid-argument",
            "gymId and origin are required.",
        );
      }

      // Validate origin
      const isAllowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (!isAllowed) {
        throw new HttpsError("permission-denied", "Origin not allowed.");
      }

      try {
        const userId = request.auth.uid;

        // Get gym data
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError(
              "failed-precondition",
              "Gym has no connected Stripe account.",
          );
        }

        // Get user's membership to find the Stripe Customer ID
        const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();

        if (!membershipDoc.exists || !membershipDoc.data().stripeCustomerId) {
          throw new HttpsError(
              "failed-precondition",
              "No billing information found. You may not have an active subscription.",
          );
        }

        const stripeCustomerId = membershipDoc.data().stripeCustomerId;

        // Create Customer Portal session
        const portalSession = await stripeClient.billingPortal.sessions.create(
            {
              customer: stripeCustomerId,
              return_url: `${origin}/members/profile`,
            },
            {stripeAccount: stripeAccountId},
        );

        console.log(`Created customer portal session for user ${userId} at gym ${gymId}`);

        return {url: portalSession.url};
      } catch (error) {
        console.error("Error creating customer portal session:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to create portal session: " + error.message);
      }
    },
);

/**
 * Get payment methods for a member (read-only display)
 * Returns sanitized card data - never returns full card numbers
 */
exports.getPaymentMethods = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required.");
      }

      try {
        const userId = request.auth.uid;

        // Get gym data
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError("failed-precondition", "Gym has no connected Stripe account.");
        }

        // Get user's membership to find the Stripe Customer ID
        const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();

        if (!membershipDoc.exists || !membershipDoc.data().stripeCustomerId) {
          return {paymentMethods: [], defaultPaymentMethodId: null};
        }

        const stripeCustomerId = membershipDoc.data().stripeCustomerId;

        // Get payment methods from Stripe
        const paymentMethods = await stripeClient.paymentMethods.list(
            {
              customer: stripeCustomerId,
              type: "card",
            },
            {stripeAccount: stripeAccountId},
        );

        // Get customer to find default payment method
        const customer = await stripeClient.customers.retrieve(
            stripeCustomerId,
            {stripeAccount: stripeAccountId},
        );

        const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method || null;

        // Sanitize payment method data - NEVER return full card numbers
        const sanitizedMethods = paymentMethods.data.map((pm) => ({
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
          isDefault: pm.id === defaultPaymentMethodId,
        }));

        console.log(`Retrieved ${sanitizedMethods.length} payment methods for user ${userId} at gym ${gymId}`);

        return {
          paymentMethods: sanitizedMethods,
          defaultPaymentMethodId: defaultPaymentMethodId,
        };
      } catch (error) {
        console.error("Error getting payment methods:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to get payment methods: " + error.message);
      }
    },
);

exports.createSubscriptionCheckout = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, tierId, origin, promoCode} = request.data;

      if (!gymId || !tierId || !origin) {
        throw new HttpsError(
            "invalid-argument",
            "gymId, tierId, and origin are required.",
        );
      }

      // Validate origin
      const isAllowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (!isAllowed) {
        throw new HttpsError("permission-denied", "Origin not allowed.");
      }

      try {
        const userId = request.auth.uid;

        // Get gym data
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError(
              "failed-precondition",
              "Gym has no connected Stripe account.",
          );
        }

        if (gymData.stripeAccountStatus !== "ACTIVE") {
          throw new HttpsError(
              "failed-precondition",
              "Gym's payment system is not active.",
          );
        }

        // Get membership tier
        const tierRef = gymRef.collection("membershipTiers").doc(tierId);
        const tierDoc = await tierRef.get();

        if (!tierDoc.exists) {
          throw new HttpsError("not-found", "Membership tier not found.");
        }

        const tierData = tierDoc.data();

        if (!tierData.active) {
          throw new HttpsError(
              "failed-precondition",
              "This membership tier is no longer available.",
          );
        }

        if (!tierData.stripePriceId) {
          throw new HttpsError(
              "failed-precondition",
              "This membership tier is not set up for payments yet.",
          );
        }

        // Check if this is a one-time (class pack) or subscription
        if (tierData.interval === "one_time") {
          throw new HttpsError(
              "invalid-argument",
              "Use createClassPackCheckout for one-time purchases.",
          );
        }

        // Get user data
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          throw new HttpsError("not-found", "User not found.");
        }

        const userData = userDoc.data();

        // Check for existing active subscription for this gym
        const membershipRef = userRef.collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();

        if (membershipDoc.exists) {
          const membershipData = membershipDoc.data();
          if (membershipData.status === "active" &&
              membershipData.stripeSubscriptionId) {
            throw new HttpsError(
                "already-exists",
                "You already have an active subscription. Please manage or cancel your current subscription first.",
            );
          }
        }

        // Check or create Stripe Customer for this user on the connected account
        let stripeCustomerId = null;

        // First, check if user already has a customer on this connected account
        if (membershipDoc.exists && membershipDoc.data().stripeCustomerId) {
          stripeCustomerId = membershipDoc.data().stripeCustomerId;
        } else {
          // Create a new customer on the connected account
          const customer = await stripeClient.customers.create(
              {
                email: userData.email,
                name: userData.displayName || userData.name || userData.email,
                metadata: {
                  userId: userId,
                  gymId: gymId,
                },
              },
              {stripeAccount: stripeAccountId},
          );
          stripeCustomerId = customer.id;

          // Store the customer ID in the membership subcollection
          await membershipRef.set({
            stripeCustomerId: stripeCustomerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        }

        // Build line items for checkout
        const lineItems = [
          {
            price: tierData.stripePriceId,
            quantity: 1,
          },
        ];

        // Add initiation fee as a one-time line item if applicable
        if (tierData.initiationFee && tierData.initiationFee > 0) {
          // Create a one-time price for the initiation fee
          const initiationFeePrice = await stripeClient.prices.create(
              {
                product_data: {
                  name: `${tierData.name} - Initiation Fee`,
                },
                unit_amount: Math.round(tierData.initiationFee * 100),
                currency: "usd",
              },
              {stripeAccount: stripeAccountId},
          );

          lineItems.push({
            price: initiationFeePrice.id,
            quantity: 1,
          });
        }

        // Build checkout session options
        const sessionConfig = {
          customer: stripeCustomerId,
          mode: "subscription",
          line_items: lineItems,
          success_url: `${origin}/members/membership/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/members/store?category=memberships`,
          metadata: {
            type: "membership",
            gymId: gymId,
            tierId: tierId,
            userId: userId,
            tierName: tierData.name,
          },
          subscription_data: {
            metadata: {
              gymId: gymId,
              tierId: tierId,
              userId: userId,
              tierName: tierData.name,
            },
          },
          // Application fee (platform fee) - charged on recurring payments
          // Note: This requires the gym to have the appropriate Stripe Connect setup
          // application_fee_percent: 5, // Uncomment to enable platform fees
        };

        // Add trial period if applicable
        if (tierData.hasTrial && tierData.trialDays > 0) {
          sessionConfig.subscription_data.trial_period_days = tierData.trialDays;
        }

        // Apply promo code if provided
        if (promoCode) {
          // Validate and get the promo code ID
          const couponsQuery = await db.collection("gyms").doc(gymId)
              .collection("coupons")
              .where("code", "==", promoCode.toUpperCase())
              .where("active", "==", true)
              .limit(1)
              .get();

          if (!couponsQuery.empty) {
            const couponDoc = couponsQuery.docs[0];
            const couponData = couponDoc.data();

            // Check if coupon applies to memberships
            if (couponData.appliesToProducts === "all" || couponData.appliesToProducts === "memberships") {
              // Check expiration
              if (!couponData.expiresAt || new Date(couponData.expiresAt.toDate()) > new Date()) {
                // Check max redemptions
                if (!couponData.maxRedemptions || couponData.currentRedemptions < couponData.maxRedemptions) {
                  sessionConfig.discounts = [{
                    promotion_code: couponData.stripePromotionCodeId,
                  }];
                }
              }
            }
          }
        }

        // Create the Checkout Session on the connected account
        const session = await stripeClient.checkout.sessions.create(
            sessionConfig,
            {stripeAccount: stripeAccountId},
        );

        console.log(`Created checkout session ${session.id} for user ${userId} on gym ${gymId}`);

        return {url: session.url};
      } catch (error) {
        console.error("Error creating subscription checkout:", error);

        // Re-throw HttpsErrors as-is
        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to create checkout: " + error.message);
      }
    },
);

/**
 * Create a checkout link for admin to share with a member
 * Allows admin to generate a payment link for a specific member
 *
 * @param {string} gymId - The gym ID
 * @param {string} tierId - The membership tier ID
 * @param {string} memberId - The target member's user ID
 * @param {string} origin - The origin URL for redirects
 * @returns {Object} - { url: string } - The shareable checkout URL
 */
exports.createAdminCheckoutLink = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, tierId, memberId, origin, customPrice} = request.data;

      if (!gymId || !tierId || !memberId || !origin) {
        throw new HttpsError(
            "invalid-argument",
            "gymId, tierId, memberId, and origin are required.",
        );
      }

      // Validate origin
      const isAllowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (!isAllowed) {
        throw new HttpsError("permission-denied", "Origin not allowed.");
      }

      try {
        const adminUserId = request.auth.uid;

        // Verify admin has permission (must be owner or staff of the gym)
        const adminRef = db.collection("users").doc(adminUserId);
        const adminDoc = await adminRef.get();

        if (!adminDoc.exists) {
          throw new HttpsError("permission-denied", "Admin user not found.");
        }

        const adminData = adminDoc.data();
        if (adminData.gymId !== gymId && adminData.role !== "owner" && adminData.role !== "staff") {
          throw new HttpsError("permission-denied", "You don't have permission to do this.");
        }

        // Get gym data
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError(
              "failed-precondition",
              "Gym has no connected Stripe account.",
          );
        }

        if (gymData.stripeAccountStatus !== "ACTIVE") {
          throw new HttpsError(
              "failed-precondition",
              "Gym's payment system is not active.",
          );
        }

        // Get membership tier
        const tierRef = gymRef.collection("membershipTiers").doc(tierId);
        const tierDoc = await tierRef.get();

        if (!tierDoc.exists) {
          throw new HttpsError("not-found", "Membership tier not found.");
        }

        const tierData = tierDoc.data();

        if (!tierData.active) {
          throw new HttpsError(
              "failed-precondition",
              "This membership tier is no longer available.",
          );
        }

        if (!tierData.stripePriceId) {
          throw new HttpsError(
              "failed-precondition",
              "This membership tier is not set up for payments yet. Please sync it to Stripe first.",
          );
        }

        // Get member data
        const memberRef = db.collection("users").doc(memberId);
        const memberDoc = await memberRef.get();

        if (!memberDoc.exists) {
          throw new HttpsError("not-found", "Member not found.");
        }

        const memberData = memberDoc.data();

        // Check or create Stripe Customer for this member on the connected account
        const membershipRef = memberRef.collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();
        let stripeCustomerId = null;

        if (membershipDoc.exists && membershipDoc.data().stripeCustomerId) {
          stripeCustomerId = membershipDoc.data().stripeCustomerId;
        } else {
          // Create a new customer on the connected account
          const customer = await stripeClient.customers.create(
              {
                email: memberData.email,
                name: memberData.displayName || memberData.name || memberData.email,
                metadata: {
                  userId: memberId,
                  gymId: gymId,
                },
              },
              {stripeAccount: stripeAccountId},
          );
          stripeCustomerId = customer.id;

          // Store the customer ID
          await membershipRef.set({
            stripeCustomerId: stripeCustomerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        }

        // Determine the price to use (custom or default)
        const useCustomPrice = customPrice !== undefined &&
            customPrice !== null &&
            customPrice !== "" &&
            parseFloat(customPrice) !== tierData.price;

        let priceId = tierData.stripePriceId;

        // If custom price is provided, create an ad-hoc recurring price
        if (useCustomPrice) {
          const customPriceAmount = Math.round(parseFloat(customPrice) * 100);

          // Create a new price using the existing Stripe product
          const newPrice = await stripeClient.prices.create(
              {
                product: tierData.stripeProductId,
                unit_amount: customPriceAmount,
                currency: "usd",
                recurring: {
                  interval: tierData.interval === "year" ? "year" : "month",
                },
                metadata: {
                  customPriceFor: memberId,
                  originalTierId: tierId,
                  createdByAdmin: adminUserId,
                },
              },
              {stripeAccount: stripeAccountId},
          );
          priceId = newPrice.id;
          console.log(`Created custom price ${priceId} for member ${memberId}: $${customPrice}/${tierData.interval}`);
        }

        // Build line items
        const lineItems = [
          {
            price: priceId,
            quantity: 1,
          },
        ];

        // Add initiation fee if applicable
        if (tierData.initiationFee && tierData.initiationFee > 0) {
          const initiationFeePrice = await stripeClient.prices.create(
              {
                product_data: {
                  name: `${tierData.name} - Initiation Fee`,
                },
                unit_amount: Math.round(tierData.initiationFee * 100),
                currency: "usd",
              },
              {stripeAccount: stripeAccountId},
          );

          lineItems.push({
            price: initiationFeePrice.id,
            quantity: 1,
          });
        }

        // Build checkout session
        const sessionConfig = {
          customer: stripeCustomerId,
          mode: "subscription",
          line_items: lineItems,
          success_url: `${origin}/members/membership/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/members/store?category=memberships`,
          metadata: {
            type: "membership",
            gymId: gymId,
            tierId: tierId,
            userId: memberId,
            tierName: tierData.name,
            createdByAdmin: adminUserId,
            customPrice: useCustomPrice ? customPrice.toString() : "",
          },
          subscription_data: {
            metadata: {
              gymId: gymId,
              tierId: tierId,
              userId: memberId,
              tierName: tierData.name,
              assignedPrice: useCustomPrice ? customPrice.toString() : tierData.price.toString(),
            },
          },
        };

        // Add trial period if applicable
        if (tierData.hasTrial && tierData.trialDays > 0) {
          sessionConfig.subscription_data.trial_period_days = tierData.trialDays;
        }

        // Create the Checkout Session
        const session = await stripeClient.checkout.sessions.create(
            sessionConfig,
            {stripeAccount: stripeAccountId},
        );

        console.log(`Admin ${adminUserId} created checkout link for member ${memberId} on gym ${gymId}`);

        return {url: session.url};
      } catch (error) {
        console.error("Error creating admin checkout link:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to create checkout link: " + error.message);
      }
    },
);

// ============================================================================
// PHASE 4: ONE-TIME PURCHASES - SHOP CHECKOUT
// ============================================================================

/**
 * Create a Stripe Checkout session for shop product purchases (cart checkout)
 * Handles physical products with variants and stock validation
 */
exports.createShopCheckout = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, cartItems, origin, promoCode} = request.data;

      if (!gymId || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        throw new HttpsError(
            "invalid-argument",
            "gymId and cartItems array are required.",
        );
      }

      // Validate origin
      const isAllowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (!isAllowed) {
        throw new HttpsError("permission-denied", "Origin not allowed.");
      }

      try {
        const userId = request.auth.uid;

        // Get gym data
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId || gymData.stripeAccountStatus !== "ACTIVE") {
          throw new HttpsError(
              "failed-precondition",
              "This gym is not set up to accept online payments yet.",
          );
        }

        // Get user data
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          throw new HttpsError("not-found", "User not found.");
        }

        const userData = userDoc.data();

        // Check or create Stripe Customer
        const membershipRef = userRef.collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();
        let stripeCustomerId = null;

        if (membershipDoc.exists && membershipDoc.data().stripeCustomerId) {
          stripeCustomerId = membershipDoc.data().stripeCustomerId;
        } else {
          const customer = await stripeClient.customers.create(
              {
                email: userData.email,
                name: userData.displayName || userData.firstName ?
                    `${userData.firstName || ""} ${userData.lastName || ""}`.trim() :
                    userData.email,
                metadata: {
                  userId: userId,
                  gymId: gymId,
                },
              },
              {stripeAccount: stripeAccountId},
          );
          stripeCustomerId = customer.id;

          await membershipRef.set({
            stripeCustomerId: stripeCustomerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        }

        // Validate cart items and build line items
        const lineItems = [];
        const orderItems = [];
        let hasStockIssue = false;
        const stockIssues = [];

        for (const cartItem of cartItems) {
          const {productId, variantId, quantity} = cartItem;

          if (!productId || !quantity || quantity < 1) {
            throw new HttpsError("invalid-argument", "Invalid cart item.");
          }

          const productRef = gymRef.collection("products").doc(productId);
          const productDoc = await productRef.get();

          if (!productDoc.exists) {
            throw new HttpsError("not-found", `Product not found: ${productId}`);
          }

          const productData = productDoc.data();

          if (!productData.active) {
            throw new HttpsError("failed-precondition", `Product is no longer available: ${productData.name}`);
          }

          let price = productData.price;
          let stockAvailable = productData.stock || 0;
          let variantName = null;

          // Handle variants
          if (productData.hasVariants && variantId) {
            const variant = productData.variants?.find((v) => v.id === variantId);
            if (!variant) {
              throw new HttpsError("not-found", `Variant not found for product: ${productData.name}`);
            }
            price = variant.price || productData.price;
            stockAvailable = variant.stock || 0;
            variantName = variant.name;
          }

          // Check stock
          if (stockAvailable < quantity) {
            hasStockIssue = true;
            stockIssues.push(`${productData.name}${variantName ? ` (${variantName})` : ""}: only ${stockAvailable} available`);
            continue;
          }

          // Create price for this item
          const stripePrice = await stripeClient.prices.create(
              {
                product_data: {
                  name: variantName ? `${productData.name} - ${variantName}` : productData.name,
                  images: productData.images?.length > 0 ? [productData.images[0]] : [],
                },
                unit_amount: Math.round(price * 100),
                currency: "usd",
              },
              {stripeAccount: stripeAccountId},
          );

          lineItems.push({
            price: stripePrice.id,
            quantity: quantity,
          });

          orderItems.push({
            productId: productId,
            productName: productData.name,
            variantId: variantId || null,
            variantName: variantName,
            quantity: quantity,
            unitPrice: price,
            totalPrice: price * quantity,
          });
        }

        if (hasStockIssue) {
          throw new HttpsError(
              "failed-precondition",
              `Stock issues: ${stockIssues.join("; ")}`,
          );
        }

        if (lineItems.length === 0) {
          throw new HttpsError("invalid-argument", "No valid items in cart.");
        }

        // Calculate totals
        const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

        // Build session config
        const sessionConfig = {
          customer: stripeCustomerId,
          mode: "payment",
          line_items: lineItems,
          success_url: `${origin}/members/store/order-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/members/store`,
          metadata: {
            type: "shop_order",
            gymId: gymId,
            userId: userId,
            orderItems: JSON.stringify(orderItems),
            subtotal: subtotal.toString(),
          },
        };

        // Apply promo code if provided
        if (promoCode) {
          const couponsQuery = await db.collection("gyms").doc(gymId)
              .collection("coupons")
              .where("code", "==", promoCode.toUpperCase())
              .where("active", "==", true)
              .limit(1)
              .get();

          if (!couponsQuery.empty) {
            const couponDoc = couponsQuery.docs[0];
            const couponData = couponDoc.data();

            if (couponData.appliesToProducts === "all" || couponData.appliesToProducts === "shop") {
              if (!couponData.expiresAt || new Date(couponData.expiresAt.toDate()) > new Date()) {
                if (!couponData.maxRedemptions || couponData.currentRedemptions < couponData.maxRedemptions) {
                  sessionConfig.discounts = [{
                    promotion_code: couponData.stripePromotionCodeId,
                  }];
                }
              }
            }
          }
        }

        // Create Checkout Session
        const session = await stripeClient.checkout.sessions.create(
            sessionConfig,
            {stripeAccount: stripeAccountId},
        );

        console.log(`Created shop checkout session ${session.id} for user ${userId} at gym ${gymId}`);

        return {url: session.url};
      } catch (error) {
        console.error("Error creating shop checkout:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to create checkout: " + error.message);
      }
    },
);

/**
 * Create a Stripe Checkout session for one-time class pack purchases
 * Class packs are membership tiers with interval = 'one_time'
 */
exports.createClassPackCheckout = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, packId, origin, promoCode} = request.data;

      if (!gymId || !packId || !origin) {
        throw new HttpsError(
            "invalid-argument",
            "gymId, packId, and origin are required.",
        );
      }

      // Validate origin
      const isAllowed = ALLOWED_ORIGINS.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      if (!isAllowed) {
        throw new HttpsError("permission-denied", "Origin not allowed.");
      }

      try {
        const userId = request.auth.uid;

        // Get gym data
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId || gymData.stripeAccountStatus !== "ACTIVE") {
          throw new HttpsError(
              "failed-precondition",
              "This gym is not set up to accept online payments yet.",
          );
        }

        // Get class pack (membership tier with interval = 'one_time')
        const packRef = gymRef.collection("membershipTiers").doc(packId);
        const packDoc = await packRef.get();

        if (!packDoc.exists) {
          throw new HttpsError("not-found", "Class pack not found.");
        }

        const packData = packDoc.data();

        if (!packData.active) {
          throw new HttpsError("failed-precondition", "This class pack is no longer available.");
        }

        if (packData.interval !== "one_time") {
          throw new HttpsError("invalid-argument", "This is not a class pack (one-time purchase).");
        }

        if (!packData.stripePriceId) {
          throw new HttpsError(
              "failed-precondition",
              "This class pack is not set up for online payments.",
          );
        }

        // Get user data
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          throw new HttpsError("not-found", "User not found.");
        }

        const userData = userDoc.data();

        // Check or create Stripe Customer
        const membershipRef = userRef.collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();
        let stripeCustomerId = null;

        if (membershipDoc.exists && membershipDoc.data().stripeCustomerId) {
          stripeCustomerId = membershipDoc.data().stripeCustomerId;
        } else {
          const customer = await stripeClient.customers.create(
              {
                email: userData.email,
                name: userData.displayName || userData.firstName ?
                    `${userData.firstName || ""} ${userData.lastName || ""}`.trim() :
                    userData.email,
                metadata: {
                  userId: userId,
                  gymId: gymId,
                },
              },
              {stripeAccount: stripeAccountId},
          );
          stripeCustomerId = customer.id;

          await membershipRef.set({
            stripeCustomerId: stripeCustomerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        }

        // Build line items
        const lineItems = [
          {
            price: packData.stripePriceId,
            quantity: 1,
          },
        ];

        // Build session config
        const sessionConfig = {
          customer: stripeCustomerId,
          mode: "payment",
          line_items: lineItems,
          success_url: `${origin}/members/store/pack-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/members/store?category=packs`,
          metadata: {
            type: "class_pack",
            gymId: gymId,
            userId: userId,
            packId: packId,
            packName: packData.name,
            credits: (packData.credits || 0).toString(),
          },
        };

        // Apply promo code if provided
        if (promoCode) {
          const couponsQuery = await db.collection("gyms").doc(gymId)
              .collection("coupons")
              .where("code", "==", promoCode.toUpperCase())
              .where("active", "==", true)
              .limit(1)
              .get();

          if (!couponsQuery.empty) {
            const couponDoc = couponsQuery.docs[0];
            const couponData = couponDoc.data();

            if (couponData.appliesToProducts === "all" || couponData.appliesToProducts === "class_packs") {
              if (!couponData.expiresAt || new Date(couponData.expiresAt.toDate()) > new Date()) {
                if (!couponData.maxRedemptions || couponData.currentRedemptions < couponData.maxRedemptions) {
                  sessionConfig.discounts = [{
                    promotion_code: couponData.stripePromotionCodeId,
                  }];
                }
              }
            }
          }
        }

        // Create Checkout Session
        const session = await stripeClient.checkout.sessions.create(
            sessionConfig,
            {stripeAccount: stripeAccountId},
        );

        console.log(`Created class pack checkout session ${session.id} for user ${userId} at gym ${gymId}`);

        return {url: session.url};
      } catch (error) {
        console.error("Error creating class pack checkout:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to create checkout: " + error.message);
      }
    },
);

// ============================================================================
// PHASE 5: SUBSCRIPTION LIFECYCLE MANAGEMENT
// ============================================================================

/**
 * Cancel a member's subscription
 * Can cancel immediately or at end of billing period
 */
exports.cancelMemberSubscription = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, cancelImmediately = false} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required.");
      }

      try {
        const userId = request.auth.uid;

        // Get membership document
        const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();

        if (!membershipDoc.exists) {
          throw new HttpsError("not-found", "Membership not found.");
        }

        const membershipData = membershipDoc.data();

        if (!membershipData.stripeSubscriptionId) {
          throw new HttpsError("failed-precondition", "No active subscription found.");
        }

        // Get gym data for Stripe account
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError("failed-precondition", "Gym has no connected Stripe account.");
        }

        if (cancelImmediately) {
          // Cancel immediately - subscription ends now
          await stripeClient.subscriptions.cancel(
              membershipData.stripeSubscriptionId,
              {stripeAccount: stripeAccountId},
          );

          // Update membership in Firestore
          await membershipRef.update({
            status: "inactive",
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancellationReason: "Member cancelled",
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Log to history
          const historyRef = membershipRef.collection("history").doc();
          await historyRef.set({
            action: "subscription_cancelled",
            description: "Subscription cancelled immediately by member",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`Member ${userId} cancelled subscription immediately at gym ${gymId}`);

          return {success: true, cancelledImmediately: true};
        } else {
          // Cancel at end of period
          await stripeClient.subscriptions.update(
              membershipData.stripeSubscriptionId,
              {cancel_at_period_end: true},
              {stripeAccount: stripeAccountId},
          );

          // Get the updated subscription to know when it will end
          const subscription = await stripeClient.subscriptions.retrieve(
              membershipData.stripeSubscriptionId,
              {stripeAccount: stripeAccountId},
          );

          const cancelAt = subscription.current_period_end ?
              admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000) : null;

          // Update membership in Firestore
          await membershipRef.update({
            cancelAtPeriodEnd: true,
            cancelAt: cancelAt,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Log to history
          const historyRef = membershipRef.collection("history").doc();
          const cancelDate = cancelAt ?
              new Date(cancelAt.toMillis()).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              }) : "end of period";

          await historyRef.set({
            action: "cancellation_scheduled",
            description: `Subscription set to cancel on ${cancelDate}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`Member ${userId} scheduled cancellation at gym ${gymId} for ${cancelDate}`);

          return {
            success: true,
            cancelledImmediately: false,
            cancelAt: cancelAt ? cancelAt.toDate().toISOString() : null,
          };
        }
      } catch (error) {
        console.error("Error cancelling subscription:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to cancel subscription: " + error.message);
      }
    },
);

/**
 * Reactivate a subscription that was scheduled to cancel
 * Reverses the cancel_at_period_end flag
 */
exports.reactivateSubscription = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required.");
      }

      try {
        const userId = request.auth.uid;

        // Get membership document
        const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();

        if (!membershipDoc.exists) {
          throw new HttpsError("not-found", "Membership not found.");
        }

        const membershipData = membershipDoc.data();

        if (!membershipData.stripeSubscriptionId) {
          throw new HttpsError("failed-precondition", "No subscription found.");
        }

        if (!membershipData.cancelAtPeriodEnd) {
          throw new HttpsError("failed-precondition", "Subscription is not scheduled for cancellation.");
        }

        // Get gym data for Stripe account
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError("failed-precondition", "Gym has no connected Stripe account.");
        }

        // Reactivate in Stripe
        await stripeClient.subscriptions.update(
            membershipData.stripeSubscriptionId,
            {cancel_at_period_end: false},
            {stripeAccount: stripeAccountId},
        );

        // Update membership in Firestore
        await membershipRef.update({
          cancelAtPeriodEnd: false,
          cancelAt: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log to history
        const historyRef = membershipRef.collection("history").doc();
        await historyRef.set({
          action: "cancellation_reversed",
          description: "Subscription cancellation was reversed by member",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Member ${userId} reactivated subscription at gym ${gymId}`);

        return {success: true};
      } catch (error) {
        console.error("Error reactivating subscription:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to reactivate subscription: " + error.message);
      }
    },
);

/**
 * Change subscription plan (upgrade/downgrade)
 * Allows members to switch to a different membership tier
 */
exports.changeSubscriptionPlan = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, newTierId, previewOnly = false} = request.data;

      if (!gymId || !newTierId) {
        throw new HttpsError("invalid-argument", "gymId and newTierId are required.");
      }

      try {
        const userId = request.auth.uid;

        // Get current membership
        const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
        const membershipDoc = await membershipRef.get();

        if (!membershipDoc.exists) {
          throw new HttpsError("not-found", "Membership not found.");
        }

        const membershipData = membershipDoc.data();

        if (!membershipData.stripeSubscriptionId) {
          throw new HttpsError("failed-precondition", "No active subscription found.");
        }

        if (membershipData.status !== "active" && membershipData.status !== "trialing") {
          throw new HttpsError("failed-precondition", "Subscription must be active to change plans.");
        }

        // Get gym data
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError("failed-precondition", "Gym has no connected Stripe account.");
        }

        // Get new tier
        const newTierRef = db.collection("gyms").doc(gymId).collection("membershipTiers").doc(newTierId);
        const newTierDoc = await newTierRef.get();

        if (!newTierDoc.exists) {
          throw new HttpsError("not-found", "Membership tier not found.");
        }

        const newTierData = newTierDoc.data();

        if (!newTierData.stripePriceId) {
          throw new HttpsError("failed-precondition", "This plan is not available for online subscription.");
        }

        // Check if changing to the same plan
        if (membershipData.membershipId === newTierId) {
          throw new HttpsError("invalid-argument", "You are already subscribed to this plan.");
        }

        // Get current subscription from Stripe
        const subscription = await stripeClient.subscriptions.retrieve(
            membershipData.stripeSubscriptionId,
            {stripeAccount: stripeAccountId},
        );

        const currentItemId = subscription.items.data[0].id;

        // Preview the proration
        if (previewOnly) {
          const prorationDate = Math.floor(Date.now() / 1000);

          const invoice = await stripeClient.invoices.retrieveUpcoming({
            customer: membershipData.stripeCustomerId,
            subscription: membershipData.stripeSubscriptionId,
            subscription_items: [{
              id: currentItemId,
              price: newTierData.stripePriceId,
            }],
            subscription_proration_date: prorationDate,
          }, {stripeAccount: stripeAccountId});

          // Calculate the proration amount
          const prorationAmount = invoice.lines.data
              .filter((line) => line.proration)
              .reduce((sum, line) => sum + line.amount, 0);

          return {
            success: true,
            preview: {
              newPlanName: newTierData.name,
              newPlanPrice: newTierData.price,
              newPlanInterval: newTierData.interval || "month",
              proratedAmount: prorationAmount / 100, // Convert from cents
              immediateCharge: prorationAmount > 0 ? prorationAmount / 100 : 0,
              credit: prorationAmount < 0 ? Math.abs(prorationAmount / 100) : 0,
              nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString(),
            },
          };
        }

        // Perform the actual plan change
        await stripeClient.subscriptions.update(
            membershipData.stripeSubscriptionId,
            {
              items: [{
                id: currentItemId,
                price: newTierData.stripePriceId,
              }],
              proration_behavior: "create_prorations",
            },
            {stripeAccount: stripeAccountId},
        );

        // Update membership in Firestore
        const oldPlanName = membershipData.planName;
        await membershipRef.update({
          membershipId: newTierId,
          planName: newTierData.name,
          price: newTierData.price,
          interval: newTierData.interval || "month",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log to history
        const historyRef = membershipRef.collection("history").doc();
        await historyRef.set({
          action: "plan_changed",
          description: `Changed from ${oldPlanName || "previous plan"} to ${newTierData.name}`,
          oldPlan: oldPlanName,
          newPlan: newTierData.name,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Member ${userId} changed plan from ${oldPlanName} to ${newTierData.name} at gym ${gymId}`);

        return {
          success: true,
          newPlan: {
            id: newTierId,
            name: newTierData.name,
            price: newTierData.price,
            interval: newTierData.interval || "month",
          },
        };
      } catch (error) {
        console.error("Error changing subscription plan:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to change plan: " + error.message);
      }
    },
);

// ============================================================================
// COUPON & PROMO CODE FUNCTIONS
// ============================================================================

/**
 * Create a coupon with Stripe Promotion Code
 * Admin only - creates coupon in Stripe and stores locally
 */
exports.createCoupon = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, couponData} = request.data;

      if (!gymId || !couponData) {
        throw new HttpsError("invalid-argument", "gymId and couponData are required.");
      }

      const {
        code,
        type, // 'percent' or 'fixed'
        value, // percentage (20 for 20%) or cents (1000 for $10)
        duration = "once", // 'once', 'repeating', 'forever'
        durationInMonths = null, // only for 'repeating'
        appliesToProducts = "all", // 'memberships', 'shop', 'class_packs', 'all'
        maxRedemptions = null,
        expiresAt = null,
        firstTimeOnly = false,
      } = couponData;

      if (!code || !type || value === undefined) {
        throw new HttpsError("invalid-argument", "code, type, and value are required.");
      }

      try {
        const userId = request.auth.uid;

        // Verify user is admin/owner of the gym
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;

        if (!stripeAccountId) {
          throw new HttpsError("failed-precondition", "Gym has no connected Stripe account.");
        }

        // Check if user is owner or admin
        const isOwner = gymData.ownerId === userId;
        if (!isOwner) {
          const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
          const membershipDoc = await membershipRef.get();
          const role = membershipDoc.exists ? membershipDoc.data().role : null;
          if (role !== "admin" && role !== "staff") {
            throw new HttpsError("permission-denied", "Only admins can create coupons.");
          }
        }

        // Check if code already exists
        const existingCoupon = await db.collection("gyms").doc(gymId)
            .collection("coupons")
            .where("code", "==", code.toUpperCase())
            .where("active", "==", true)
            .get();

        if (!existingCoupon.empty) {
          throw new HttpsError("already-exists", "A coupon with this code already exists.");
        }

        // Create Stripe Coupon
        const stripeCouponData = {
          name: code.toUpperCase(),
          duration: duration,
        };

        if (type === "percent") {
          stripeCouponData.percent_off = value;
        } else {
          stripeCouponData.amount_off = value;
          stripeCouponData.currency = "usd";
        }

        if (duration === "repeating" && durationInMonths) {
          stripeCouponData.duration_in_months = durationInMonths;
        }

        if (maxRedemptions) {
          stripeCouponData.max_redemptions = maxRedemptions;
        }

        if (expiresAt) {
          stripeCouponData.redeem_by = Math.floor(new Date(expiresAt).getTime() / 1000);
        }

        const stripeCoupon = await stripeClient.coupons.create(
            stripeCouponData,
            {stripeAccount: stripeAccountId},
        );

        // Create Stripe Promotion Code
        const promoCodeData = {
          coupon: stripeCoupon.id,
          code: code.toUpperCase(),
        };

        if (firstTimeOnly) {
          promoCodeData.restrictions = {first_time_transaction: true};
        }

        const stripePromoCode = await stripeClient.promotionCodes.create(
            promoCodeData,
            {stripeAccount: stripeAccountId},
        );

        // Store coupon locally
        const couponRef = db.collection("gyms").doc(gymId).collection("coupons").doc();
        const couponDoc = {
          code: code.toUpperCase(),
          stripeCouponId: stripeCoupon.id,
          stripePromotionCodeId: stripePromoCode.id,
          type: type,
          value: value,
          duration: duration,
          durationInMonths: durationInMonths,
          appliesToProducts: appliesToProducts,
          firstTimeOnly: firstTimeOnly,
          maxRedemptions: maxRedemptions,
          currentRedemptions: 0,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userId,
        };

        await couponRef.set(couponDoc);

        console.log(`Created coupon ${code} for gym ${gymId}`);

        return {
          success: true,
          coupon: {
            id: couponRef.id,
            ...couponDoc,
          },
        };
      } catch (error) {
        console.error("Error creating coupon:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to create coupon: " + error.message);
      }
    },
);

/**
 * Validate a coupon code
 * Returns discount info if valid
 */
exports.validateCoupon = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, code, cartType = "all"} = request.data;

      if (!gymId || !code) {
        throw new HttpsError("invalid-argument", "gymId and code are required.");
      }

      try {
        // Find the coupon
        const couponsQuery = await db.collection("gyms").doc(gymId)
            .collection("coupons")
            .where("code", "==", code.toUpperCase())
            .where("active", "==", true)
            .limit(1)
            .get();

        if (couponsQuery.empty) {
          return {valid: false, error: "Invalid coupon code."};
        }

        const couponDoc = couponsQuery.docs[0];
        const coupon = couponDoc.data();

        // Check expiration
        if (coupon.expiresAt && new Date(coupon.expiresAt.toDate()) < new Date()) {
          return {valid: false, error: "This coupon has expired."};
        }

        // Check max redemptions
        if (coupon.maxRedemptions && coupon.currentRedemptions >= coupon.maxRedemptions) {
          return {valid: false, error: "This coupon has reached its usage limit."};
        }

        // Check if coupon applies to this cart type
        if (coupon.appliesToProducts !== "all" && coupon.appliesToProducts !== cartType) {
          return {valid: false, error: `This coupon is only valid for ${coupon.appliesToProducts}.`};
        }

        // Return coupon details
        return {
          valid: true,
          coupon: {
            id: couponDoc.id,
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            duration: coupon.duration,
            stripePromotionCodeId: coupon.stripePromotionCodeId,
            description: coupon.type === "percent" ?
              `${coupon.value}% off` :
              `$${(coupon.value / 100).toFixed(2)} off`,
          },
        };
      } catch (error) {
        console.error("Error validating coupon:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to validate coupon: " + error.message);
      }
    },
);

/**
 * List all coupons for a gym (admin only)
 */
exports.listCoupons = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, includeInactive = false} = request.data;

      if (!gymId) {
        throw new HttpsError("invalid-argument", "gymId is required.");
      }

      try {
        const userId = request.auth.uid;

        // Verify user is admin/owner of the gym
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const isOwner = gymData.ownerId === userId;

        if (!isOwner) {
          const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
          const membershipDoc = await membershipRef.get();
          const role = membershipDoc.exists ? membershipDoc.data().role : null;
          if (role !== "admin" && role !== "staff") {
            throw new HttpsError("permission-denied", "Only admins can list coupons.");
          }
        }

        // Get coupons
        let query = db.collection("gyms").doc(gymId).collection("coupons");
        if (!includeInactive) {
          query = query.where("active", "==", true);
        }

        const couponsSnapshot = await query.orderBy("createdAt", "desc").get();

        const coupons = couponsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || null,
          expiresAt: doc.data().expiresAt?.toDate?.() || null,
        }));

        return {success: true, coupons};
      } catch (error) {
        console.error("Error listing coupons:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to list coupons: " + error.message);
      }
    },
);

/**
 * Deactivate a coupon (admin only)
 */
exports.deactivateCoupon = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {gymId, couponId} = request.data;

      if (!gymId || !couponId) {
        throw new HttpsError("invalid-argument", "gymId and couponId are required.");
      }

      try {
        const userId = request.auth.uid;

        // Verify user is admin/owner of the gym
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;
        const isOwner = gymData.ownerId === userId;

        if (!isOwner) {
          const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
          const membershipDoc = await membershipRef.get();
          const role = membershipDoc.exists ? membershipDoc.data().role : null;
          if (role !== "admin" && role !== "staff") {
            throw new HttpsError("permission-denied", "Only admins can deactivate coupons.");
          }
        }

        // Get the coupon
        const couponRef = db.collection("gyms").doc(gymId).collection("coupons").doc(couponId);
        const couponDoc = await couponRef.get();

        if (!couponDoc.exists) {
          throw new HttpsError("not-found", "Coupon not found.");
        }

        const couponData = couponDoc.data();

        // Deactivate in Stripe (delete the promo code, not the coupon)
        if (stripeAccountId && couponData.stripePromotionCodeId) {
          try {
            await stripeClient.promotionCodes.update(
                couponData.stripePromotionCodeId,
                {active: false},
                {stripeAccount: stripeAccountId},
            );
          } catch (stripeErr) {
            console.warn("Failed to deactivate Stripe promo code:", stripeErr.message);
          }
        }

        // Deactivate locally
        await couponRef.update({
          active: false,
          deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
          deactivatedBy: userId,
        });

        console.log(`Deactivated coupon ${couponId} for gym ${gymId}`);

        return {success: true};
      } catch (error) {
        console.error("Error deactivating coupon:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to deactivate coupon: " + error.message);
      }
    },
);

// ============================================================================
// PHASE 8: REFUNDS & DISPUTES
// ============================================================================

/**
 * Process a refund for various purchase types (orders, subscriptions, class packs)
 * Admin only function
 */
exports.processRefund = onCall(
    {
      region: "us-central1",
      cors: ALLOWED_ORIGINS,
    },
    async (request) => {
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      const {
        gymId,
        refundType, // 'order', 'subscription', 'class_pack'
        orderId, // For order refunds
        subscriptionId, // For subscription refunds
        userId, // For class pack refunds
        purchaseId, // For class pack refunds
        amount, // Optional: partial refund amount in dollars
        reason,
        refundApplicationFee,
        prorate, // For subscription refunds
        creditsUsed, // For class pack refunds
      } = request.data;

      if (!gymId || !refundType) {
        throw new HttpsError("invalid-argument", "gymId and refundType are required.");
      }

      try {
        const adminUserId = request.auth.uid;

        // Verify user is admin/owner of the gym
        const gymRef = db.collection("gyms").doc(gymId);
        const gymDoc = await gymRef.get();

        if (!gymDoc.exists) {
          throw new HttpsError("not-found", "Gym not found.");
        }

        const gymData = gymDoc.data();
        const stripeAccountId = gymData.stripeAccountId;
        const isOwner = gymData.ownerId === adminUserId;

        if (!isOwner) {
          const membershipRef = db.collection("users").doc(adminUserId).collection("memberships").doc(gymId);
          const membershipDoc = await membershipRef.get();
          const role = membershipDoc.exists ? membershipDoc.data().role : null;
          if (role !== "admin" && role !== "staff") {
            throw new HttpsError("permission-denied", "Only admins can process refunds.");
          }
        }

        if (!stripeAccountId) {
          throw new HttpsError("failed-precondition", "Gym has no connected Stripe account.");
        }

        let refundResult;

        switch (refundType) {
          case "order":
            refundResult = await processOrderRefund(
                db,
                stripeClient,
                gymId,
                stripeAccountId,
                orderId,
                amount,
                reason,
                refundApplicationFee,
                adminUserId,
            );
            break;

          case "subscription":
            refundResult = await processSubscriptionRefund(
                db,
                stripeClient,
                gymId,
                stripeAccountId,
                subscriptionId,
                prorate,
                reason,
                adminUserId,
            );
            break;

          case "class_pack":
            refundResult = await processClassPackRefund(
                db,
                stripeClient,
                gymId,
                stripeAccountId,
                userId,
                purchaseId,
                creditsUsed || 0,
                reason,
                adminUserId,
            );
            break;

          default:
            throw new HttpsError("invalid-argument", `Invalid refund type: ${refundType}`);
        }

        return refundResult;
      } catch (error) {
        console.error("Error processing refund:", error);

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError("internal", "Failed to process refund: " + error.message);
      }
    },
);

/**
 * Process refund for a shop order
 */
async function processOrderRefund(
    db,
    stripeClient,
    gymId,
    stripeAccountId,
    orderId,
    amount,
    reason,
    refundApplicationFee,
    adminUserId,
) {
  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required for order refunds.");
  }

  const orderRef = db.collection("gyms").doc(gymId).collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    throw new HttpsError("not-found", "Order not found.");
  }

  const orderData = orderDoc.data();

  if (!orderData.stripePaymentIntentId) {
    throw new HttpsError("failed-precondition", "Order has no associated payment.");
  }

  if (orderData.status === "refunded") {
    throw new HttpsError("failed-precondition", "Order has already been fully refunded.");
  }

  // Calculate refund amount
  const totalPaid = orderData.total || 0;
  const alreadyRefunded = orderData.refundedAmount || 0;
  const maxRefundable = totalPaid - alreadyRefunded;
  const refundAmountCents = amount
    ? Math.min(Math.round(amount * 100), Math.round(maxRefundable * 100))
    : Math.round(maxRefundable * 100);

  if (refundAmountCents <= 0) {
    throw new HttpsError("invalid-argument", "No amount available to refund.");
  }

  // Process refund through Stripe
  const refundParams = {
    payment_intent: orderData.stripePaymentIntentId,
    amount: refundAmountCents,
    reason: reason === "fraudulent" ? "fraudulent" : reason === "duplicate" ? "duplicate" : "requested_by_customer",
  };

  // Note: refund_application_fee only works with transfers, not direct charges
  // For Connect with destination charges, this would refund the platform fee
  if (refundApplicationFee) {
    refundParams.refund_application_fee = true;
  }

  const refund = await stripeClient.refunds.create(
      refundParams,
      {stripeAccount: stripeAccountId},
  );

  // Calculate new totals
  const newRefundedAmount = alreadyRefunded + (refundAmountCents / 100);
  const isFullRefund = newRefundedAmount >= totalPaid;
  const newStatus = isFullRefund ? "refunded" : "partially_refunded";

  // Update order
  await orderRef.update({
    status: newStatus,
    refundedAmount: newRefundedAmount,
    refundedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastRefund: {
      stripeRefundId: refund.id,
      amount: refundAmountCents / 100,
      reason: reason,
      processedBy: adminUserId,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  });

  // Log to stripeEvents for idempotency
  const eventRef = db.collection("gyms").doc(gymId).collection("stripeEvents").doc(`refund_${refund.id}`);
  await eventRef.set({
    eventType: "refund.created",
    stripeRefundId: refund.id,
    orderId: orderId,
    amount: refundAmountCents / 100,
    reason: reason,
    processedBy: adminUserId,
    processed: true,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Processed refund ${refund.id} for order ${orderId}: $${refundAmountCents / 100}`);

  return {
    success: true,
    refund: {
      id: refund.id,
      amount: refundAmountCents / 100,
      status: refund.status,
      orderId: orderId,
      orderStatus: newStatus,
    },
  };
}

/**
 * Process refund for a subscription (with optional proration)
 */
async function processSubscriptionRefund(
    db,
    stripeClient,
    gymId,
    stripeAccountId,
    subscriptionId,
    prorate,
    reason,
    adminUserId,
) {
  if (!subscriptionId) {
    throw new HttpsError("invalid-argument", "subscriptionId is required for subscription refunds.");
  }

  // Get the subscription from Stripe
  const subscription = await stripeClient.subscriptions.retrieve(
      subscriptionId,
      {stripeAccount: stripeAccountId},
  );

  if (!subscription) {
    throw new HttpsError("not-found", "Subscription not found in Stripe.");
  }

  // Get the latest invoice for this subscription
  const invoices = await stripeClient.invoices.list(
      {
        subscription: subscriptionId,
        limit: 1,
        status: "paid",
      },
      {stripeAccount: stripeAccountId},
  );

  if (invoices.data.length === 0) {
    throw new HttpsError("failed-precondition", "No paid invoices found for this subscription.");
  }

  const latestInvoice = invoices.data[0];
  const chargeId = latestInvoice.charge;

  if (!chargeId) {
    throw new HttpsError("failed-precondition", "No charge found for the latest invoice.");
  }

  // Calculate refund amount
  let refundAmountCents;

  if (prorate) {
    // Calculate prorated refund based on unused time
    const periodStart = subscription.current_period_start;
    const periodEnd = subscription.current_period_end;
    const now = Math.floor(Date.now() / 1000);

    const totalPeriod = periodEnd - periodStart;
    const usedPeriod = now - periodStart;
    const unusedFraction = Math.max(0, (totalPeriod - usedPeriod) / totalPeriod);

    refundAmountCents = Math.round(latestInvoice.amount_paid * unusedFraction);
  } else {
    // Full refund of the last payment
    refundAmountCents = latestInvoice.amount_paid;
  }

  if (refundAmountCents <= 0) {
    throw new HttpsError("invalid-argument", "No amount available to refund (period may be fully used).");
  }

  // Process refund
  const refund = await stripeClient.refunds.create(
      {
        charge: chargeId,
        amount: refundAmountCents,
        reason: "requested_by_customer",
      },
      {stripeAccount: stripeAccountId},
  );

  // Find the user membership for this subscription
  const membershipsSnapshot = await db.collectionGroup("memberships")
      .where("stripeSubscriptionId", "==", subscriptionId)
      .limit(1)
      .get();

  if (!membershipsSnapshot.empty) {
    const membershipDoc = membershipsSnapshot.docs[0];
    const membershipRef = membershipDoc.ref;

    // Log to membership history
    const historyRef = membershipRef.collection("history").doc();
    await historyRef.set({
      action: "subscription_refund",
      description: `Refund processed: $${(refundAmountCents / 100).toFixed(2)} (${prorate ? "prorated" : "full"})`,
      stripeRefundId: refund.id,
      amount: refundAmountCents / 100,
      reason: reason,
      processedBy: adminUserId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Log to stripeEvents
  const eventRef = db.collection("gyms").doc(gymId).collection("stripeEvents").doc(`refund_${refund.id}`);
  await eventRef.set({
    eventType: "subscription_refund.created",
    stripeRefundId: refund.id,
    subscriptionId: subscriptionId,
    amount: refundAmountCents / 100,
    prorate: prorate,
    reason: reason,
    processedBy: adminUserId,
    processed: true,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Processed subscription refund ${refund.id} for subscription ${subscriptionId}: $${refundAmountCents / 100}`);

  return {
    success: true,
    refund: {
      id: refund.id,
      amount: refundAmountCents / 100,
      status: refund.status,
      subscriptionId: subscriptionId,
      prorate: prorate,
    },
  };
}

/**
 * Process refund for a class pack purchase
 */
async function processClassPackRefund(
    db,
    stripeClient,
    gymId,
    stripeAccountId,
    userId,
    purchaseId,
    creditsUsed,
    reason,
    adminUserId,
) {
  if (!userId || !purchaseId) {
    throw new HttpsError("invalid-argument", "userId and purchaseId are required for class pack refunds.");
  }

  // Get the class pack purchase from creditLogs
  const creditLogsRef = db.collection("users").doc(userId)
      .collection("memberships").doc(gymId)
      .collection("creditLogs");

  const purchaseQuery = await creditLogsRef
      .where("type", "==", "purchase")
      .where("stripeCheckoutSessionId", "==", purchaseId)
      .limit(1)
      .get();

  let purchaseDoc;
  let purchaseData;

  if (!purchaseQuery.empty) {
    purchaseDoc = purchaseQuery.docs[0];
    purchaseData = purchaseDoc.data();
  } else {
    // Try finding by document ID
    const directDoc = await creditLogsRef.doc(purchaseId).get();
    if (directDoc.exists && directDoc.data().type === "purchase") {
      purchaseDoc = directDoc;
      purchaseData = directDoc.data();
    } else {
      throw new HttpsError("not-found", "Class pack purchase not found.");
    }
  }

  if (!purchaseData.stripePaymentIntentId && !purchaseData.stripeCheckoutSessionId) {
    throw new HttpsError("failed-precondition", "Purchase has no associated Stripe payment.");
  }

  if (purchaseData.refunded) {
    throw new HttpsError("failed-precondition", "This purchase has already been refunded.");
  }

  // Calculate refund amount based on credits used
  const totalCredits = purchaseData.credits || purchaseData.amount || 0;
  const pricePerCredit = purchaseData.totalPaid ? purchaseData.totalPaid / totalCredits : 0;
  const unusedCredits = Math.max(0, totalCredits - creditsUsed);
  const refundAmount = unusedCredits * pricePerCredit;
  const refundAmountCents = Math.round(refundAmount * 100);

  if (refundAmountCents <= 0) {
    throw new HttpsError("invalid-argument", "No refundable amount (all credits may have been used).");
  }

  // Get payment intent ID
  let paymentIntentId = purchaseData.stripePaymentIntentId;

  if (!paymentIntentId && purchaseData.stripeCheckoutSessionId) {
    // Retrieve payment intent from checkout session
    const session = await stripeClient.checkout.sessions.retrieve(
        purchaseData.stripeCheckoutSessionId,
        {stripeAccount: stripeAccountId},
    );
    paymentIntentId = session.payment_intent;
  }

  if (!paymentIntentId) {
    throw new HttpsError("failed-precondition", "Could not find payment intent for this purchase.");
  }

  // Process refund
  const refund = await stripeClient.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: refundAmountCents,
        reason: "requested_by_customer",
      },
      {stripeAccount: stripeAccountId},
  );

  // Deduct credits from member's balance
  const membershipRef = db.collection("users").doc(userId).collection("memberships").doc(gymId);
  const membershipDoc = await membershipRef.get();

  if (membershipDoc.exists) {
    const currentCredits = membershipDoc.data().classCredits || 0;
    const newCredits = Math.max(0, currentCredits - unusedCredits);

    await membershipRef.update({
      classCredits: newCredits,
    });

    // Log credit deduction
    const deductLogRef = creditLogsRef.doc();
    await deductLogRef.set({
      type: "refund_deduction",
      credits: -unusedCredits,
      amount: -unusedCredits,
      description: `Refund processed - ${unusedCredits} credits removed`,
      stripeRefundId: refund.id,
      originalPurchaseId: purchaseDoc.id,
      processedBy: adminUserId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark original purchase as refunded
    await purchaseDoc.ref.update({
      refunded: true,
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      refundedAmount: refundAmountCents / 100,
      stripeRefundId: refund.id,
      creditsRefunded: unusedCredits,
    });
  }

  // Log to stripeEvents
  const eventRef = db.collection("gyms").doc(gymId).collection("stripeEvents").doc(`refund_${refund.id}`);
  await eventRef.set({
    eventType: "class_pack_refund.created",
    stripeRefundId: refund.id,
    userId: userId,
    purchaseId: purchaseDoc.id,
    amount: refundAmountCents / 100,
    creditsRefunded: unusedCredits,
    reason: reason,
    processedBy: adminUserId,
    processed: true,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Processed class pack refund ${refund.id} for user ${userId}: $${refundAmountCents / 100} (${unusedCredits} credits)`);

  return {
    success: true,
    refund: {
      id: refund.id,
      amount: refundAmountCents / 100,
      status: refund.status,
      creditsRefunded: unusedCredits,
      userId: userId,
    },
  };
}
