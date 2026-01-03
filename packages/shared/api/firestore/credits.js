import { doc, collection, getDocs, updateDoc, query, orderBy, limit, increment, runTransaction } from "firebase/firestore";
import { db } from "../firebaseConfig";

// --- CREDIT MANAGEMENT ---

/**
 * 4. NEW: Admin Adjust Credits
 */
export const adjustUserCredits = async (userId, amount, reason, adminId) => {
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw "User not found";

      // Update Balance
      transaction.update(userRef, {
        classCredits: increment(amount)
      });

      // Write Log
      createCreditLog(
        transaction,
        userId,
        amount,
        'admin_adjustment',
        reason || 'Admin manual adjustment',
        adminId
      );
    });
    return { success: true };
  } catch (error) {
    console.error("Adjustment failed:", error);
    return { success: false, error: error.message };
  }
};

// --- 5. NEW: Get Credit History ---
export const getUserCreditHistory = async (userId) => {
  try {
    const logsRef = collection(db, "users", userId, "creditLogs");
    const q = query(logsRef, orderBy("createdAt", "desc"), limit(50));
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
 * Shared Helper: Log Credit Transaction
 * Exported so bookings.js can use it
 */
export const createCreditLog = (transaction, userId, amount, type, description, actorId = 'system') => {
  const logRef = doc(collection(db, "users", userId, "creditLogs"));
  transaction.set(logRef, {
    amount: amount, // +1 or -1
    type: type, // 'booking', 'refund', 'admin_adjustment', 'purchase'
    description: description,
    createdAt: new Date(),
    createdBy: actorId
  });
};