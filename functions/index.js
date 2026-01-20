// --- IMPORTS ---
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {defineString} = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripe = require("stripe");

// --- INITIALIZATION ---
admin.initializeApp();

const stripeSecret = defineString("STRIPE_SECRET_KEY");

// --- FUNCTION 1: CREATE STRIPE ACCOUNT (v2) ---
exports.createStripeAccountLink = onCall(
    {
      region: "us-central1",
      cors: [/^https:\/\/.*\.app\.github\.dev$/, "http://localhost:5173"],
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

      const allowedOrigins = [
        /^https:\/\/.*\.app\.github\.dev$/,
        "http://localhost:5173",
      ];
      const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin));
      if (!isAllowed) {
        throw new HttpsError(
            "permission-denied",
            "The provided origin is not allowed.",
        );
      }

      try {
        const user = await admin.auth().getUser(request.auth.uid);
        const gymRef = db.collection("gyms").doc(gymId);

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
        throw new HttpsError("internal", "An error occurred.");
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
