// --- IMPORTS ---
const {onCall, HttpsError} = require("firebase-functions/v2/https");
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
