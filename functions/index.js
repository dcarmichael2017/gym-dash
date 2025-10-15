const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineString} = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripe = require("stripe");

// Define the Stripe secret key as a parameter.
const stripeSecret = defineString("STRIPE_SECRET_KEY");

// Initialize Firebase Admin SDK lazily.
let app;

/**
 * Creates a Stripe Connected Account for a gym (v2 Function).
 */
exports.createStripeAccountLink = onCall(
    // OPTIONS: Explicitly set the region and CORS policy.
    {
      region: "us-central1",
      cors: [/^https:\/\/.*\.app\.github\.dev$/, "http://localhost:5173"],
    },
    async (request) => {
      // LAZY INITIALIZATION
      if (!app) {
        app = admin.initializeApp();
      }
      const db = admin.firestore();
      const stripeClient = stripe(stripeSecret.value());

      // 1. Ensure the user is authenticated.
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
      }

      // Destructure origin from the request data
      const {gymId, origin} = request.data;

      if (!gymId || !origin) {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a 'gymId' and 'origin'.",
        );
      }

      // Basic security check to ensure the provided origin is one we trust.
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

        // 2. Create a Stripe Connected Account.
        const account = await stripeClient.accounts.create({
          type: "standard",
          email: user.email,
          metadata: {
            gymId: gymId,
            uid: request.auth.uid,
          },
        });

        // 3. Save the new Stripe Account ID to Firestore.
        await gymRef.update({
          stripeAccountId: account.id,
          stripeAccountStatus: "PENDING",
        });

        // 4. Create the unique Account Link using the dynamic origin.
        const accountLink = await stripeClient.accountLinks.create({
          account: account.id,
          refresh_url: `${origin}/onboarding/step-6?gymId=${gymId}`,
          return_url: `${origin}/onboarding/stripe-success?gymId=${gymId}`,
          type: "account_onboarding",
        });

        // 5. Return the URL to the frontend.
        return {url: accountLink.url};
      } catch (error) {
        console.error("Error creating Stripe account link:", error);
        throw new HttpsError("internal", "An error occurred.");
      }
    });

