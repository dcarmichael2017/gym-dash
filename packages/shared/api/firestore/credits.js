import { doc, collection, getDocs, getDoc, setDoc, updateDoc, query, where, orderBy, limit, increment, runTransaction, deleteField } from "firebase/firestore";
import { db } from "../firebaseConfig";

// --- PER-GYM CREDIT MANAGEMENT ---

/**
 * Get credit balance for a specific gym
 * @param {string} userId - User ID
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, balance?: number, error?: string}>}
 */
export const getGymCredits = async (userId, gymId) => {
  try {
    const creditRef = doc(db, 'users', userId, 'credits', gymId);
    const creditSnap = await getDoc(creditRef);

    if (creditSnap.exists()) {
      return { success: true, balance: creditSnap.data().balance || 0 };
    } else {
      // Initialize with 0 credits if document doesn't exist
      await setDoc(creditRef, {
        balance: 0,
        gymId: gymId,
        createdAt: new Date(),
        lastUpdated: new Date()
      });
      return { success: true, balance: 0 };
    }
  } catch (error) {
    console.error("Error getting gym credits:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Transaction-safe credit deduction
 * Used inside transactions (bookings, etc.)
 * @param {Transaction} transaction - Firestore transaction
 * @param {string} userId - User ID
 * @param {string} gymId - Gym ID
 * @param {number} amount - Amount to deduct
 * @param {string} reason - Reason for deduction
 * @param {string} source - Source of deduction (system, admin_forced, etc.)
 * @returns {Promise<number>} New balance after deduction
 */
export const deductCredits = async (transaction, userId, gymId, amount, reason, source = 'system') => {
  const creditRef = doc(db, 'users', userId, 'credits', gymId);
  const creditSnap = await transaction.get(creditRef);

  let currentBalance = 0;
  if (creditSnap.exists()) {
    currentBalance = creditSnap.data().balance || 0;
  } else {
    // Initialize if doesn't exist
    transaction.set(creditRef, {
      balance: 0,
      gymId: gymId,
      createdAt: new Date(),
      lastUpdated: new Date()
    });
  }

  const newBalance = currentBalance - amount;

  // Update balance
  transaction.update(creditRef, {
    balance: newBalance,
    lastUpdated: new Date()
  });

  // Log transaction
  const logRef = doc(collection(db, 'users', userId, 'creditLogs'));
  transaction.set(logRef, {
    gymId: gymId,
    amount: -amount,
    balance: newBalance,
    reason: reason,
    type: 'deduction',
    source: source,
    createdAt: new Date(),
    actorId: source === 'admin_forced' ? 'admin' : userId
  });

  return newBalance;
};

/**
 * Transaction-safe credit addition
 * Used inside transactions (refunds, admin adjustments, etc.)
 * @param {Transaction} transaction - Firestore transaction
 * @param {string} userId - User ID
 * @param {string} gymId - Gym ID
 * @param {number} amount - Amount to add
 * @param {string} reason - Reason for addition
 * @param {string} source - Source of addition (system, admin, etc.)
 * @returns {Promise<number>} New balance after addition
 */
export const addCredits = async (transaction, userId, gymId, amount, reason, source = 'system') => {
  const creditRef = doc(db, 'users', userId, 'credits', gymId);
  const creditSnap = await transaction.get(creditRef);

  let currentBalance = 0;
  if (creditSnap.exists()) {
    currentBalance = creditSnap.data().balance || 0;
  } else {
    transaction.set(creditRef, {
      balance: 0,
      gymId: gymId,
      createdAt: new Date(),
      lastUpdated: new Date()
    });
  }

  const newBalance = currentBalance + amount;

  transaction.update(creditRef, {
    balance: newBalance,
    lastUpdated: new Date()
  });

  const logRef = doc(collection(db, 'users', userId, 'creditLogs'));
  transaction.set(logRef, {
    gymId: gymId,
    amount: amount,
    balance: newBalance,
    reason: reason,
    type: 'addition',
    source: source,
    createdAt: new Date(),
    actorId: source
  });

  return newBalance;
};

/**
 * Admin adjust credits for a specific gym
 * @param {string} userId - User ID
 * @param {string} gymId - Gym ID
 * @param {number} amount - Amount to adjust (positive or negative)
 * @param {string} reason - Reason for adjustment
 * @param {string} adminId - Admin user ID
 * @returns {Promise<{success: boolean, newBalance?: number, error?: string}>}
 */
export const adjustUserCredits = async (userId, gymId, amount, reason, adminId) => {
  try {
    let newBalance;
    await runTransaction(db, async (transaction) => {
      if (amount > 0) {
        newBalance = await addCredits(
          transaction,
          userId,
          gymId,
          amount,
          reason || 'Admin manual adjustment',
          adminId
        );
      } else if (amount < 0) {
        newBalance = await deductCredits(
          transaction,
          userId,
          gymId,
          Math.abs(amount),
          reason || 'Admin manual adjustment',
          adminId
        );
      } else {
        throw new Error("Amount must be non-zero");
      }
    });
    return { success: true, newBalance };
  } catch (error) {
    console.error("Adjustment failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get credit history for a specific gym
 * @param {string} userId - User ID
 * @param {string} gymId - Gym ID
 * @param {number} limitCount - Maximum number of logs to fetch (default 50)
 * @returns {Promise<{success: boolean, logs?: Array, error?: string}>}
 */
export const getUserCreditHistory = async (userId, gymId, limitCount = 50) => {
  try {
    const logsRef = collection(db, "users", userId, "creditLogs");
    const q = query(
      logsRef,
      where("gymId", "==", gymId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);

    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().createdAt?.toDate()
    }));

    return { success: true, logs };
  } catch (error) {
    console.error("Fetch history failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * MIGRATION HELPER: Split global credits to per-gym credits
 * Moves user.classCredits to users/{userId}/credits/{gymId}
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, migratedAmount?: number, toGym?: string, error?: string}>}
 */
export const migrateGlobalCreditsToPerGym = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { success: false, error: "User not found" };
    }

    const userData = userSnap.data();
    const globalCredits = userData.classCredits || 0;
    const gymIds = Object.keys(userData.gymIds || {});

    if (gymIds.length === 0) {
      return { success: true, message: "No gyms to migrate credits to" };
    }

    // Put all credits in primary gym (user's last active gym or first gym)
    const primaryGymId = userData.lastActiveGymId || gymIds[0];

    // Create credit document in subcollection
    const creditRef = doc(db, 'users', userId, 'credits', primaryGymId);
    await setDoc(creditRef, {
      balance: globalCredits,
      gymId: primaryGymId,
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    // Log the migration
    await setDoc(doc(collection(db, 'users', userId, 'creditLogs')), {
      gymId: primaryGymId,
      amount: globalCredits,
      balance: globalCredits,
      reason: 'Migrated from global credits',
      type: 'migration',
      source: 'system',
      createdAt: new Date(),
      actorId: 'system'
    });

    // Clear global credits (keep field at 0 for backward compatibility)
    await updateDoc(userRef, {
      classCredits: 0
    });

    return { success: true, migratedAmount: globalCredits, toGym: primaryGymId };
  } catch (error) {
    console.error("Migration error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * LEGACY FUNCTION: Kept for backward compatibility
 * Creates a credit log entry
 * @deprecated Use deductCredits or addCredits instead
 */
export const createCreditLog = (transaction, userId, amount, type, description, actorId = 'system') => {
  const logRef = doc(collection(db, "users", userId, "creditLogs"));
  transaction.set(logRef, {
    amount: amount,
    type: type,
    description: description,
    createdAt: new Date(),
    createdBy: actorId,
    // Note: gymId should be added for new logs
  });
};
