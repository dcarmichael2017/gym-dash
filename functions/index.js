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
      // Will be implemented in Phase 3
      console.log("Membership purchase - handler to be implemented");
      break;

    case "class_pack":
      // Will be implemented in Phase 4
      console.log("Class pack purchase - handler to be implemented");
      break;

    case "shop_order":
      // Will be implemented in Phase 4
      console.log("Shop order - handler to be implemented");
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
 * Handle invoice.paid event
 * Updates membership renewal dates
 */
async function handleInvoicePaid(db, event) {
  const invoice = event.data.object;
  console.log("Invoice paid:", invoice.id);

  // Will be implemented in Phase 5
  // Update membership currentPeriodEnd, log to history
}

/**
 * Handle invoice.payment_failed event
 * Updates membership status to past_due, notifies member
 */
async function handleInvoicePaymentFailed(db, event) {
  const invoice = event.data.object;
  console.log("Invoice payment failed:", invoice.id);

  // Will be implemented in Phase 5
  // Update membership status to 'past_due', start grace period
}

/**
 * Handle customer.subscription.updated event
 * Syncs subscription changes (plan changes, cancellation scheduled, etc.)
 */
async function handleSubscriptionUpdated(db, event) {
  const subscription = event.data.object;
  console.log("Subscription updated:", subscription.id);

  // Will be implemented in Phase 5
  // Update membership document with new plan details, cancelAtPeriodEnd, etc.
}

/**
 * Handle customer.subscription.deleted event
 * Cancels membership when subscription ends
 */
async function handleSubscriptionDeleted(db, event) {
  const subscription = event.data.object;
  console.log("Subscription deleted:", subscription.id);

  // Will be implemented in Phase 5
  // Update membership status to 'cancelled'
}

/**
 * Handle charge.refunded event
 * Processes refunds and updates order status
 */
async function handleChargeRefunded(db, event) {
  const charge = event.data.object;
  console.log("Charge refunded:", charge.id);

  // Will be implemented in Phase 8
  // Update order status to 'refunded', log refund
}
