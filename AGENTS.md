GymDash AI Agent Guidelines & Context

Role: You are a Senior Full-Stack Engineer specializing in React (Vite), Firebase (Firestore/Functions), and SaaS Architecture.
Goal: Produce production-ready, clean code that adheres to the "Monorepo" structure and "Multi-Role" security model.

## 1. Core Architecture & Mental Model

GymDash is a multi-tenant SaaS. All data is scoped by gymId.

**The "Brain" (packages/shared)**: Logic lives here. If a function calculates a stat or transforms data, it belongs here, not in the UI component.

**The "Face" (packages/web)**: Dumb UI. It receives data via hooks and renders.

**The "Bridge" (Firestore Hooks)**: We prefer onSnapshot listeners for "live" dashboards (Schedule, Member List) and getDoc for static forms (Edit Profile).

## 2. Critical Rules (The "Do Not Break" List)

### Strict Billing Source of Truth

**CRITICAL: Membership Data is in SUBCOLLECTIONS**

- ✅ **NEW**: Memberships live at `users/{userId}/memberships/{gymId}`
- ❌ **NEVER** read from `user.memberships[]` array (this is legacy and REMOVED)
- ✅ Always fetch from subcollection: `doc(db, 'users', userId, 'memberships', gymId)`
- ✅ Use real-time listeners for billing tabs and member profiles
- ✅ Invalidate cache after admin billing changes

**Why Subcollections?**
- Proper permission scoping (admins can only touch memberships for THEIR gym)
- Scales to unlimited gym associations per user
- Eliminates array mutation conflicts in concurrent scenarios
- Enables real-time listeners per-gym without over-fetching

### Guardian/Minor Protection

A "Dependent" profile (linked via familyId) CANNOT sign their own waivers. Logic must check for headOfHousehold.

### Atomic Transactions

Any action involving money or capacity (booking a spot, buying a pack) MUST be a Firestore Transaction.

**CRITICAL PATTERN**: When reading data inside a transaction, use `transaction.get()` NOT `getDoc()`:

```javascript
// ❌ BAD - Creates stale reads
export const bookMember = async () => {
  return await runTransaction(db, async (transaction) => {
    const membershipSnap = await getDoc(membershipRef); // WRONG!
  });
};

// ✅ GOOD - Atomic reads
export const bookMember = async () => {
  return await runTransaction(db, async (transaction) => {
    const membershipSnap = await transaction.get(membershipRef); // RIGHT!
  });
};
```

**Transaction-Safe Helper Pattern**:
Functions used both inside and outside transactions should accept an optional transaction parameter:

```javascript
export const canUserBook = async (classData, userId, gymId, transaction = null) => {
  const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
  
  // Use transaction.get() if in transaction, otherwise getDoc()
  const membershipSnap = transaction 
    ? await transaction.get(membershipRef)
    : await getDoc(membershipRef);
  
  // ... rest of logic
};
```

NEVER write to `class.attendees` without a transaction block.

## 3. Coding Standards & Patterns

### Data Fetching

**Hooks**: Use custom hooks (e.g., useGymStats, useMemberProfile) to abstract Firestore logic.

**Loading States**: Always handle loading and error states. Never render a blank screen while fetching.

**Undefined Safety**: Firestore is schemaless. Always default values:

```javascript
// BAD
const credits = user.classCredits;

// GOOD
const credits = user.classCredits || 0;
```

**Membership Data Pattern** (POST-REFACTOR):

```javascript
// ❌ OLD WAY (DEPRECATED - DO NOT USE)
const membership = user.memberships?.find(m => m.gymId === gymId);

// ✅ NEW WAY (REQUIRED)
// Option 1: From Context (if available)
const { memberships } = useGym();
const membership = memberships.find(m => m.gymId === currentGym.id);

// Option 2: Direct Fetch
const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
const membershipSnap = await getDoc(membershipRef);
const membership = membershipSnap.exists() ? membershipSnap.data() : null;

// Option 3: Real-time Listener (Preferred for UI)
useEffect(() => {
  const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
  const unsub = onSnapshot(membershipRef, (snap) => {
    setMembership(snap.exists() ? snap.data() : null);
  });
  return () => unsub();
}, [userId, gymId]);
```

### UI/UX (Tailwind + Lucide)

**Mobile First**: We are a mobile-heavy app. Always verify layouts with `md:flex-row` or `hidden md:block`.

**Modals**: Use the global Modal component. Ensure onClose cleans up state to prevent "zombie" data when reopening.

**Alerts**: NEVER use `window.alert()`. Use `useConfirm()` from ConfirmationContext.

## 4. Operational Workflows

### Commit Messages

Use Conventional Commits (feat:, fix:, refactor:, docs:).

**Examples**:
- `feat: add membership history viewer for admins`
- `fix: prevent stale reads in booking transaction`
- `refactor: migrate memberships to subcollection architecture`
- `docs: update agent guidelines for subcollection patterns`

### Refactoring

If you change a shared function in `packages/shared`, YOU MUST check `packages/app` (Mobile) and `packages/web` (Web) for breaking changes.

**Post-Subcollection Refactor Checklist**:
- [ ] Does this component read from `user.memberships` array? → Update to subcollection
- [ ] Does this function call `canUserBook()`? → Ensure transaction parameter is passed if in transaction
- [ ] Does this query use `arrayContains` on memberships? → Update to collectionGroup query
- [ ] Does this security rule check `user.memberships`? → Update to check subcollection path

## 5. Known Technical Debt (Handle with Care)

### ~~Billing Sync~~ ✅ RESOLVED

**OLD ISSUE**: The MemberBillingTab sometimes desynced from the actual Firestore state.

**RESOLUTION**: Migrated to subcollection architecture with real-time listeners. Admin changes now instantly reflect via `onSnapshot` on the specific membership document.

### Ghost Classes

Classes with `recurrenceEndDate` are "Archived." Do not delete them; filter them out of future queries.

## 6. Directory Map

- `packages/shared/api/firestore/*.js`: Single Source of Truth for DB writes.
- `packages/web/src/layouts`: Contains AdminLayout (Sidebar) and MemberLayout (Bottom Nav).
- `packages/web/src/context`: Global state. GymContext controls the current gym view.

## 7. Subcollection Architecture (IMPLEMENTED)

### Migration Complete ✅

We successfully migrated from array-based memberships to subcollection architecture on [DATE].

### Database Schema

**User Document Structure**:
```javascript
users/{userId} {
  // Personal Info
  firstName: string,
  lastName: string,
  email: string,
  phoneNumber: string,
  
  // Role & Status
  role: 'member' | 'owner' | 'staff' | 'coach',
  status: 'active' | 'prospect' | 'inactive' | 'banned',
  
  // Gym Associations (SUMMARY FIELDS - for querying)
  gymIds: { [gymId]: true },  // Map for quick "is member of gym" checks
  lastActiveGymId: string,     // For sticky session on login
  
  // Billing Summary (NOT detailed membership info)
  classCredits: number,
  
  // Progression
  ranks: { [programId]: { rankId, stripes, credits } },
  attendanceCount: number,
  
  // ❌ REMOVED: memberships: [] array (DEPRECATED)
}
```

**Membership Subcollection** (NEW):
```javascript
users/{userId}/memberships/{gymId} {
  // Membership Details
  gymId: string,              // Redundant but useful for collectionGroup queries
  gymName: string,
  
  // Status & Type
  status: 'active' | 'trialing' | 'inactive' | 'cancelled' | 'prospect',
  membershipId: string,       // Links to gyms/{gymId}/membershipTiers/{tierId}
  membershipName: string,
  
  // Billing
  price: number,
  interval: 'month' | 'year' | 'one_time',
  stripeSubscriptionId: string | null,
  cancelAtPeriodEnd: boolean,
  
  // Dates
  joinedAt: timestamp,
  startDate: timestamp,
  trialEndDate: timestamp | null,
  currentPeriodEnd: timestamp | null,
  cancelledAt: timestamp | null,
  
  // Waiver
  waiverSigned: boolean,
  waiverSignedVersion: number,
  
  // Metadata
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Membership History Subcollection** (NEW - Audit Trail):
```javascript
users/{userId}/membershipHistory/{historyId} {
  gymId: string,              // Which gym this log is about
  description: string,        // Human-readable event description
  actorId: string,            // Who made the change (userId or 'system')
  createdAt: timestamp
}
```

### Key Functions Updated

**File: `packages/shared/api/firestore/members.js`**

```javascript
// ✅ UPDATED: Creates membership in subcollection
export const addManualMember = async (gymId, memberData) => {
  // 1. Create clean user document (no membership fields)
  const userRef = await addDoc(collection(db, "users"), {
    firstName, lastName, email, phoneNumber,
    role: 'member',
    gymIds: { [gymId]: true },  // ✅ Summary map
    lastActiveGymId: gymId,
    // ... other personal fields
  });

  // 2. Create membership document in subcollection
  const membershipRef = doc(db, 'users', userRef.id, 'memberships', gymId);
  await setDoc(membershipRef, {
    gymId, gymName, status, membershipId, price, interval,
    joinedAt: new Date(),
    waiverSigned: false,
    // ... other membership fields
  });

  // 3. Log to history
  await logMembershipHistory(userRef.id, gymId, 'Member manually added', actorId);
};

// ✅ NEW: Audit trail helper
export const logMembershipHistory = async (userId, gymId, description, actorId = 'system') => {
  const logRef = collection(db, 'users', userId, 'membershipHistory');
  await addDoc(logRef, {
    gymId,
    description,
    actorId,
    createdAt: new Date()
  });
};

// ✅ NEW: Fetch audit trail (for admin view)
export const getMembershipHistory = async (userId, gymId) => {
  const historyRef = collection(db, 'users', userId, 'membershipHistory');
  const q = query(historyRef, where("gymId", "==", gymId), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return { 
    success: true, 
    history: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
};

// ✅ UPDATED: Cancel now updates subcollection
export const adminCancelUserMembership = async (userId, gymId, reason) => {
  const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
  await updateDoc(membershipRef, {
    status: 'inactive',
    membershipId: null,
    cancelAtPeriodEnd: false,
    cancellationReason: reason,
    cancelledAt: new Date(),
    updatedAt: new Date()
  });
  await logMembershipHistory(userId, gymId, `Cancelled by admin: ${reason}`, actorId);
};

// ✅ UPDATED: Join gym creates subcollection doc
export const joinGym = async (userId, gymId, gymName) => {
  const userRef = doc(db, "users", userId);
  
  // 1. Create membership subcollection document
  const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
  await setDoc(membershipRef, {
    gymId, gymName, status: 'prospect',
    membershipId: null, price: 0,
    joinedAt: new Date(),
    waiverSigned: false,
    // ... defaults
  });
  
  // 2. Update summary fields on parent user doc
  await updateDoc(userRef, {
    [`gymIds.${gymId}`]: true,  // ✅ Creates nested map entry
    lastActiveGymId: gymId
  });
  
  await logMembershipHistory(userId, gymId, `Joined gym ${gymName}`, userId);
};

// ✅ UPDATED: Disconnect removes subcollection doc
export const disconnectGym = async (userId, gymId) => {
  // 1. Delete membership subcollection document
  await deleteDoc(doc(db, "users", userId, "memberships", gymId));
  
  // 2. Remove from summary map
  await updateDoc(doc(db, "users", userId), {
    [`gymIds.${gymId}`]: deleteField(),
    lastActiveGymId: null  // Or compute from remaining memberships
  });
  
  await logMembershipHistory(userId, gymId, 'Disconnected from gym', userId);
};

// ✅ UPDATED: Search uses gymIds map
export const searchMembers = async (gymId, searchTerm) => {
  const q = query(
    collection(db, "users"),
    where(`gymIds.${gymId}`, "==", true),  // ✅ Uses map instead of arrayContains
    where("searchName", ">=", searchTerm.toLowerCase()),
    where("searchName", "<=", searchTerm.toLowerCase() + "\uf8ff")
  );
  const snapshot = await getDocs(q);
  return { success: true, results: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
};

// ✅ UPDATED: Get gym members uses collectionGroup
export const getGymMembers = async (gymId) => {
  // Query ALL membership subcollections across all users, filtered by gymId
  const membershipsRef = collectionGroup(db, "memberships");
  const q = query(membershipsRef, where("gymId", "==", gymId));
  const snapshot = await getDocs(q);
  
  // Extract parent user IDs from document paths
  const userIds = [...new Set(snapshot.docs.map(doc => doc.ref.path.split('/')[1]))];
  
  // Fetch full user profiles AND their membership data
  const members = await Promise.all(
    userIds.map(async (userId) => {
      const userSnap = await getDoc(doc(db, "users", userId));
      const membershipSnap = await getDoc(doc(db, "users", userId, "memberships", gymId));
      
      return userSnap.exists() ? {
        id: userSnap.id,
        ...userSnap.data(),
        currentMembership: membershipSnap.exists() ? membershipSnap.data() : null
      } : null;
    })
  );
  
  return { success: true, members: members.filter(m => m !== null) };
};
```

**File: `packages/shared/api/firestore/bookings.js`**

```javascript
// ✅ UPDATED: Transaction-safe membership check
export const canUserBook = async (classData, userId, targetGymId, transaction = null) => {
  const allowedPlans = classData.allowedMembershipIds || [];
  const creditCost = parseInt(classData.creditCost) || 0;

  // Fetch user profile
  const userRef = doc(db, 'users', userId);
  const userSnap = transaction 
    ? await transaction.get(userRef)
    : await getDoc(userRef);
  if (!userSnap.exists()) {
    return { allowed: false, reason: "User profile not found.", type: 'denied', cost: 0 };
  }
  const userData = userSnap.data();
  let credits = parseInt(userData.classCredits) || 0;

  // ✅ Fetch membership from subcollection (transaction-safe)
  const membershipRef = doc(db, 'users', userId, 'memberships', targetGymId);
  const membershipSnap = transaction
    ? await transaction.get(membershipRef)
    : await getDoc(membershipRef);
  const relevantMembership = membershipSnap.exists() ? membershipSnap.data() : null;

  const VALID_ACCESS_STATUSES = ['active', 'trialing'];

  // Check membership access
  if (relevantMembership) {
    const memStatus = relevantMembership.status?.toLowerCase().trim();
    const planId = relevantMembership.membershipId;
    const planCoversClass = allowedPlans.includes(planId);
    const isGoodStanding = VALID_ACCESS_STATUSES.includes(memStatus);

    if (planCoversClass && isGoodStanding) {
      return { allowed: true, reason: "Membership Access", type: 'membership', cost: 0 };
    }
  }

  // Fallback to credits or drop-in
  // ... rest of logic
};

// ✅ UPDATED: Uses transaction-safe canUserBook
export const bookMember = async (gymId, classInfo, member, options = {}) => {
  return await runTransaction(db, async (transaction) => {
    // ... transaction setup ...
    
    // ✅ Pass transaction to canUserBook for atomic reads
    let gatekeeper = await canUserBook(classData, member.id, gymId, transaction);
    
    if (!gatekeeper.allowed && !options.force) {
      throw gatekeeper.reason;
    }
    
    // ... rest of booking logic ...
  });
};

// ✅ UPDATED: Eligibility check fetches from subcollection
export const checkBookingEligibility = async (gymId, userId, classInstanceProp) => {
  // ... initial setup ...
  
  // ✅ Call canUserBook with null transaction (outside transaction context)
  let baseEligibility = await canUserBook(classData, userId, gymId, null);
  
  // Deep membership check for weekly limits
  if (baseEligibility.type === 'membership') {
    // ✅ Fetch membership from subcollection
    const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
    const membershipSnap = await getDoc(membershipRef);
    const userMembershipData = membershipSnap.exists() ? membershipSnap.data() : null;
    
    if (userMembershipData?.membershipId) {
      // Fetch tier details and check weekly limit
      // ... limit checking logic ...
    }
  }
  
  return { success: true, data: result };
};
```

**File: `packages/web/src/context/GymContext.jsx`**

```javascript
// ✅ UPDATED: Listens to memberships subcollection
export const GymProvider = ({ children }) => {
  const [currentGym, setCurrentGym] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Reset state on logout
        setCurrentGym(null);
        setMemberships([]);
        setLoading(false);
        return;
      }

      // Listen to user profile for lastActiveGymId
      const profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
        if (!docSnap.exists()) {
          setLoading(false);
          return;
        }
        const userData = docSnap.data();
        const lastActiveId = userData.lastActiveGymId;

        // ✅ Listen to memberships subcollection (REAL-TIME)
        const membershipsUnsubscribe = onSnapshot(
          collection(db, 'users', user.uid, 'memberships'),
          async (snapshot) => {
            // ✅ Map subcollection docs to array
            const userMemberships = snapshot.docs.map(doc => ({ 
              id: doc.id,  // This is the gymId
              ...doc.data() 
            }));
            setMemberships(userMemberships);

            // Determine which gym to switch to
            const isLastActiveValid = userMemberships.some(
              m => m.gymId === lastActiveId && !m.isHidden
            );
            
            let targetGymId = null;
            if (isLastActiveValid) {
              targetGymId = lastActiveId;
            } else if (userMemberships.length > 0) {
              const firstValid = userMemberships.find(m => !m.isHidden);
              targetGymId = firstValid?.gymId || null;
            }

            if (targetGymId && targetGymId !== currentGymIdRef.current) {
              await switchGym(targetGymId);
            } else if (!targetGymId) {
              setCurrentGym(null);
            }
            
            setLoading(false);
          }
        );
      });
    });

    return () => authUnsubscribe();
  }, []);

  // ... rest of provider
};
```

**File: `packages/web/src/components/members/MemberBillingTab.jsx`**

```javascript
// ✅ UPDATED: Real-time listener for membership subcollection
export const MemberBillingTab = ({ member, gymId }) => {
  const [membershipData, setMembershipData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member?.id || !gymId) return;

    // ✅ Listen to specific membership document (REAL-TIME)
    const membershipRef = doc(db, 'users', member.id, 'memberships', gymId);
    const unsub = onSnapshot(membershipRef, (snap) => {
      if (snap.exists()) {
        setMembershipData(snap.data());
      } else {
        setMembershipData(null); // Not a member
      }
      setLoading(false);
    });

    return () => unsub();
  }, [member?.id, gymId]);

  // Display membership data from subcollection
  return (
    <div>
      <p>Status: {membershipData?.status || 'No Membership'}</p>
      <p>Plan: {membershipData?.membershipName || 'N/A'}</p>
      <p>Price: ${membershipData?.price || 0}/{membershipData?.interval || 'month'}</p>
      {/* ... rest of UI */}
    </div>
  );
};
```

### Firestore Security Rules

**File: `firestore.rules`**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // --- HELPER FUNCTIONS ---
    function getRequesterData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    // Check if the user is an owner, staff, or coach for a specific gym
    function isStaffOrOwner(gymId) {
       let user = getRequesterData();
       return user != null && user.gymId == gymId && (user.role == 'owner' || user.role == 'staff' || user.role == 'coach');
    }

    // ✅ NEW: Simplified version for query compatibility
    // This checks directly against resource.data without additional reads
    function isInRequesterGym() {
        let requester = getRequesterData();
        let targetGymId = requester.gymId;
        
        // Check if the target user has the requester's gym in their gymIds map
        return targetGymId != null && 
               resource.data.gymIds != null && 
               targetGymId in resource.data.gymIds && 
               resource.data.gymIds[targetGymId] == true;
    }

    // Check if requester has admin role
    function isAdmin() {
        let requester = getRequesterData();
        return requester.role == 'owner' || requester.role == 'staff' || requester.role == 'coach';
    }

    // ✅ UPDATED: Helper to check if requester manages the target user
    function managesUser(targetUserData) {
       let requester = getRequesterData();
       
       // 1. Safe extraction of target data (handles missing fields)
       // We use .get() to provide a default empty map/string if the field is missing
       let targetGymIds = targetUserData.get('gymIds', {});
       let targetLegacyGymId = targetUserData.get('gymId', '');
       
       // 2. Check: Is Admin's Gym ID inside the User's gymIds map?
       let isUserInGym = (requester.gymId in targetGymIds && targetGymIds[requester.gymId] == true);
       
       // 3. Check: Legacy Fallback
       let isUserInGymLegacy = targetLegacyGymId == requester.gymId;

       // 4. Check Admin Role
       let hasRole = (requester.role == 'owner' || requester.role == 'staff' || requester.role == 'coach');

       return (isUserInGym || isUserInGymLegacy) && hasRole;
    }

    // ✅ NEW: Collection Group Query Rule for Memberships
    // This allows admins to query all membership subcollections
    match /{path=**}/memberships/{membershipId} {
      allow read: if request.auth != null && (
        // 1. User reading their own membership (checks if path contains their UID)
        path[4] == request.auth.uid || 
        // OR: simpler check if you trust the ID structure
        path.split('/')[1] == request.auth.uid ||

        // 2. Admin reading: MUST own the gym listed on the membership
        // We use isStaffOrOwner passing the gymId found inside the membership doc
        isStaffOrOwner(resource.data.gymId)
      );

      allow write: if request.auth != null && (
        path.split('/')[1] == request.auth.uid ||
        isStaffOrOwner(resource.data.gymId)
      );
    }

    // --- USERS COLLECTION ---
    match /users/{userId} {
      allow create: if request.auth != null;
      
      // ✅ FIXED: Separate rules for queries vs individual reads
      // For QUERIES (like getGymMembers), use simpler rule
      allow list: if request.auth != null && (
        isAdmin() && isInRequesterGym()
      );
      
      // For individual document READS, use the full managesUser check
      allow get: if request.auth != null && (
        request.auth.uid == userId || 
        managesUser(resource.data)
      );
      
      // Updates and deletes use the full check
      allow update, delete: if request.auth != null && (
        request.auth.uid == userId || 
        managesUser(resource.data)
      );

      // --- MEMBERSHIPS SUBCOLLECTION ---
      match /memberships/{gymId} {
         allow read: if request.auth.uid == userId || (request.auth != null && isStaffOrOwner(gymId));
         allow write: if request.auth.uid == userId || (request.auth != null && isStaffOrOwner(gymId));
      }

      // --- CREDIT LOGS SUBCOLLECTION ---
      match /creditLogs/{logId} {
         allow read: if request.auth != null && (
            request.auth.uid == userId ||
            managesUser(get(/databases/$(database)/documents/users/$(userId)).data)
         );

         allow create: if request.auth != null && (
            request.auth.uid == userId || 
            managesUser(get(/databases/$(database)/documents/users/$(userId)).data) 
         );
      }

      // --- MEMBERSHIP HISTORY SUBCOLLECTION ---
      match /membershipHistory/{historyId} {
        allow read: if request.auth.uid == userId || 
          (request.auth != null && isStaffOrOwner(resource.data.gymId));

        allow create: if request.auth.uid == userId || 
          (request.auth != null && isStaffOrOwner(request.resource.data.gymId));
      }

    // --- GYMS COLLECTION ---
    match /gyms/{gymId} {
      allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
      allow read: if request.auth != null; 
      allow update, delete: if request.auth != null && resource.data.ownerId == request.auth.uid;

      // --- ATTENDANCE ---
      match /attendance/{bookingId} {
          allow read: if request.auth != null && (
             resource == null || 
             resource.data.memberId == request.auth.uid || 
             isStaffOrOwner(gymId)
          );

          allow create: if request.auth != null 
                        && request.resource.data.memberId == request.auth.uid;
                        
          allow update: if request.auth != null && (
             resource.data.memberId == request.auth.uid ||
             isStaffOrOwner(gymId)
          );
      }
      
      // Membership Tiers
      match /membershipTiers/{tierId} {
        allow read: if request.auth != null;
      }
      
      // Settings (Legal, etc)
      match /settings/{settingDoc} {
         allow read: if request.auth != null;
         allow write: if isStaffOrOwner(gymId);
         
         match /{allChildren=**} {
            allow read: if request.auth != null;
            allow write: if isStaffOrOwner(gymId);
         }
      }

      // --- CATCH-ALL (Classes, Staff, etc) ---
      match /{allSubcollections=**} {
         function isPublicContent() {
            return !('visibility' in resource.data) || resource.data.visibility == 'public';
         }

         allow read: if request.auth != null && (isPublicContent() || isStaffOrOwner(gymId));
         
         allow write: if request.auth != null && (
            isStaffOrOwner(gymId) || 
            get(/databases/$(database)/documents/gyms/$(gymId)).data.ownerId == request.auth.uid
         );
      }
    }
  }
}
```

## 8. Common Patterns & Anti-Patterns

### ✅ DO

**Fetch membership from subcollection**:
```javascript
const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
const membershipSnap = await getDoc(membershipRef);
const membership = membershipSnap.exists() ? membershipSnap.data() : null;
```

**Use real-time listeners for live data**:
```javascript
useEffect(() => {
  const unsub = onSnapshot(
    doc(db, 'users', userId, 'memberships', gymId),
    (snap) => setMembership(snap.exists() ? snap.data() : null)
  );
  return () => unsub();
}, [userId, gymId]);
```

**Pass transaction to helper functions**:
```javascript
export const bookMember = async (gymId, classInfo, member, options = {}) => {
  return await runTransaction(db, async (transaction) => {
    let gatekeeper = await canUserBook(classData, member.id, gymId, transaction);
    // ... rest of logic
  });
};
```

**Log membership changes to history**:
```javascript
await logMembershipHistory(userId, gymId, 'Plan upgraded to Premium', actorId);
```

**Use gymIds map for member searches**:
```javascript
const q = query(
  collection(db, "users"),
  where(`gymIds.${gymId}`, "==", true),
  where("searchName", ">=", searchTerm)
);
```

### ❌ DON'T

**Read from deprecated memberships array**:
```javascript
// ❌ BAD - This field no longer exists
const membership = user.memberships?.find(m => m.gymId === gymId);
```

**Use getDoc() inside transactions**:
```javascript
// ❌ BAD - Creates stale reads
await runTransaction(db, async (transaction) => {
  const snap = await getDoc(membershipRef); // WRONG!
});
```

**Update parent user doc with membership details**:
```javascript
// ❌ BAD - Membership data should only live in subcollection
await updateDoc(userRef, {
  membershipId: 'tier_123',  // WRONG!
  membershipStatus: 'active' // WRONG!
});
```

**Forget to invalidate context after admin changes**:
```javascript
// ❌ BAD - UI won't update
await updateDoc(membershipRef, { status: 'cancelled' });
// Should use real-time listener or manually refresh context
```

**Use arrayContains for gym association queries**:
```javascript
// ❌ BAD - Old pattern, no longer works
where("memberships", "array-contains", { gymId: gymId })
```

## 8.5. Common Gotchas & Solutions

### GymContext vs Direct gymId Fetching

**Admin Screens MUST NOT use GymContext**:
```javascript
// ❌ BAD - Admin screen using GymContext
import { useGym } from '../../context/GymContext';
const { currentGym } = useGym();
// This will be undefined for admin users!

// ✅ GOOD - Admin screen using direct gymId fetch
const [gymId, setGymId] = useState(null);
useEffect(() => {
  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      setGymId(userData.gymId); // Admin users have a single gymId
    }
  };
  fetchUserData();
}, []);
```

**Why?**
- **GymContext is for members** who can belong to multiple gyms and switch between them
- **Admin/staff users** belong to a single gym stored in `user.gymId` field
- Using GymContext in admin screens causes `undefined` gymId errors

**Pattern**:
- Member screens → Use `useGym()` from GymContext
- Admin screens → Fetch `user.gymId` directly from user document

### Fetching Gym Members

**Use getGymMembers API, not direct Firestore queries**:
```javascript
// ❌ BAD - Direct Firestore query (doesn't work with subcollections)
const usersRef = collection(db, 'users');
const q = query(usersRef, where(`gymIds.${gymId}`, '==', true));
const snapshot = await getDocs(q);

// ✅ GOOD - Use the getGymMembers API
import { getGymMembers } from '@shared/api/firestore';
const result = await getGymMembers(gymId);
if (result.success) {
  const members = result.members; // Includes membership data
}
```

**Why?**
- `getGymMembers` uses `collectionGroup` to query membership subcollections
- It automatically joins user profile data with their gym-specific membership
- Returns enriched member objects with `currentMembership` field

### Auto-Scroll in Chat Components

**Prevent input blur on every keystroke**:
```javascript
// ❌ BAD - Auto-scroll triggers on state change, causing blur
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]); // Scrolls on EVERY message state change (including typing)

// ✅ GOOD - Only scroll on actual new messages
const prevMessageCountRef = useRef(messages.length);
useEffect(() => {
  if (messages.length > prevMessageCountRef.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    prevMessageCountRef.current = messages.length;
  }
}, [messages]);
```

**Why?**
- Auto-scrolling triggers layout recalculations
- Causes active input to lose focus
- Only scroll when new messages arrive, not on every render

### Chat Layout with Fixed Input

**Separate scrollable messages from fixed input**:
```javascript
// ✅ GOOD - Fixed height chat with sticky input
<div className="flex flex-col h-screen">
  {/* Header - Fixed */}
  <div className="p-4 border-b bg-white">Header</div>

  {/* Messages - Scrollable */}
  <div className="flex-1 overflow-y-auto p-4">
    {messages.map(msg => <Message key={msg.id} {...msg} />)}
    <div ref={messagesEndRef} />
  </div>

  {/* Input - Fixed */}
  <div className="p-4 bg-white border-t">
    <input type="text" />
  </div>
</div>
```

**Why?**
- `h-screen` ensures component fills viewport height
- `flex-1 overflow-y-auto` makes only messages scroll
- Input stays fixed at bottom, always accessible

### Component Recreation Causing Input Focus Loss

**Move components OUTSIDE the main component to prevent recreation**:
```javascript
// ❌ BAD - Components defined inside main component
const MainComponent = () => {
  const [text, setText] = useState('');

  // This component is recreated on EVERY render
  const ChatInput = ({ value, onChange }) => (
    <input value={value} onChange={onChange} />
  );

  return <ChatInput value={text} onChange={setText} />;
};

// ✅ GOOD - Components defined outside
const ChatInput = ({ value, onChange }) => (
  <input
    value={value}
    onChange={onChange}
    autoComplete="off"
  />
);

const MainComponent = () => {
  const [text, setText] = useState('');
  return <ChatInput value={text} onChange={setText} />;
};
```

**Why?**
- When components are defined inside the parent, React sees them as NEW component types on each render
- This causes React to unmount the old input and mount a new one
- Mounting a new input loses focus and resets cursor position
- Moving components outside ensures they maintain the same identity across renders

**Additional fixes for input stability**:
```javascript
// Use onKeyDown instead of deprecated onKeyPress
<input
  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
  // NOT: onKeyPress={(e) => e.key === 'Enter' && handleSend()}
/>

// Always add autoComplete="off" to prevent browser interference
<input autoComplete="off" />
```

## 9. Debugging Checklist

### When Membership Data Doesn't Load

1. **Check if subcollection document exists**:
   ```javascript
   const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
   const snap = await getDoc(membershipRef);
   console.log('Membership exists:', snap.exists());
   console.log('Data:', snap.data());
   ```

2. **Verify Firestore Rules allow read access**:
   - User reading own membership: `request.auth.uid == userId`
   - Admin reading member's membership: `isStaffOrOwner(gymId)` returns true

3. **Check GymContext is loading memberships**:
   ```javascript
   const { memberships } = useGym();
   console.log('Loaded memberships:', memberships);
   ```

4. **Verify gymIds map is populated on user document**:
   ```javascript
   const userSnap = await getDoc(doc(db, 'users', userId));
   console.log('gymIds:', userSnap.data()?.gymIds);
   ```

### When Booking Fails with "Insufficient Credits" but User Has Credits

1. **Check if canUserBook is receiving transaction**:
   ```javascript
   // In bookMember transaction:
   console.log('Calling canUserBook with transaction:', !!transaction);
   ```

2. **Verify membership status is 'active' or 'trialing'**:
   ```javascript
   console.log('Membership status:', membership?.status);
   console.log('Valid statuses:', ['active', 'trialing']);
   ```

3. **Check if class allows drop-in or credit booking**:
   ```javascript
   console.log('Credit cost:', classData.creditCost);
   console.log('Drop-in enabled:', classData.dropInEnabled);
   console.log('Allowed membership IDs:', classData.allowedMembershipIds);
   ```

### When Admin Can't Cancel Membership

1. **Verify admin has correct role and gymId**:
   ```javascript
   const adminData = await getDoc(doc(db, 'users', auth.currentUser.uid));
   console.log('Admin role:', adminData.data()?.role);
   console.log('Admin gymId:', adminData.data()?.gymId);
   ```

2. **Check if membership document path is correct**:
   ```javascript
   const membershipRef = doc(db, 'users', memberId, 'memberships', gymId);
   console.log('Membership path:', membershipRef.path);
   ```

3. **Verify Firestore Rules**:
   - Rule should check: `isStaffOrOwner(gymId)` where `gymId` is the document ID in the path
   - Admin's `user.gymId` must match the `{gymId}` wildcard in the path

### When Membership History Doesn't Show

1. **Check if history documents exist**:
   ```javascript
   const historyRef = collection(db, 'users', userId, 'membershipHistory');
   const q = query(historyRef, where("gymId", "==", gymId));
   const snap = await getDocs(q);
   console.log('History count:', snap.size);
   ```

2. **Verify logs have gymId field**:
   ```javascript
   snap.docs.forEach(doc => {
     console.log('Log:', doc.data());
     console.log('Has gymId:', !!doc.data().gymId);
   });
   ```

3. **Check Firestore Rules allow admin read access**:
   - Rule checks: `isStaffOrOwner(resource.data.gymId)`
   - The `resource.data.gymId` is the gym recorded in the log

## 10. AI Agent-Specific Instructions

### When Debugging Permission Errors

**ALWAYS run this diagnostic helper first**:
```javascript
// In members.js
export const runPermissionDiagnostics = async (targetGymId) => {
  console.group("🕵️‍♂️ FIRESTORE PERMISSIONS DIAGNOSTIC");
  
  const adminUser = auth.currentUser;
  if (!adminUser) {
    console.error("❌ No user logged in");
    return;
  }

  console.log(`👤 Auth User UID: ${adminUser.uid}`);
  console.log(`🎯 Target Gym ID: ${targetGymId}`);

  // Check admin profile
  const adminSnap = await getDoc(doc(db, "users", adminUser.uid));
  if (adminSnap.exists()) {
    const data = adminSnap.data();
    console.log("✅ Admin Profile:", {
      role: data.role,
      gymId: data.gymId,
      hasTargetGym: data.gymIds?.[targetGymId] ? "YES ✅" : "NO ❌"
    });
  }

  // Check membership access
  const memQuery = query(
    collectionGroup(db, 'memberships'), 
    where('gymId', '==', targetGymId),
    limit(1)
  );
  const memSnap = await getDocs(memQuery);
  console.log(`📋 Can query memberships: ${!memSnap.empty ? "YES ✅" : "NO ❌"}`);
  
  console.groupEnd();
};
```

### When Refactoring Legacy Code

**Step 1**: Search for array-based patterns:
```bash
# Search for old patterns
grep -r "user.memberships" packages/
grep -r "\.memberships\?" packages/
grep -r "arrayContains.*membership" packages/
```

**Step 2**: Replace with subcollection patterns per examples above.

**Step 3**: Test thoroughly:
- Member can view their own membership
- Admin can view member's membership
- Admin can update member's membership
- Membership changes reflect in real-time

### When Adding New Membership-Related Features

**Always**:
1. Store data in `users/{userId}/memberships/{gymId}` subcollection
2. Log changes to `users/{userId}/membershipHistory` subcollection
3. Use real-time listeners for UI updates
4. Update `gymIds` summary map if adding/removing gym associations
5. Test permissions for both user and admin access

**Never**:
1. Store membership details on parent user document
2. Use arrays for multi-gym associations
3. Skip logging to membership history
4. Forget to update Firestore Rules

## 11. Migration Verification Checklist

### ✅ Completed Tasks

- [x] Updated `addManualMember()` to create subcollection document
- [x] Updated `joinGym()` to create subcollection document and update gymIds map
- [x] Updated `disconnectGym()` to delete subcollection document
- [x] Updated `cancelUserMembership()` to update subcollection document
- [x] Updated `getGymMembers()` to use collectionGroup query
- [x] Updated `searchMembers()` to use gymIds map filter
- [x] Created `logMembershipHistory()` helper for audit trail
- [x] Created `getMembershipHistory()` helper for admin view
- [x] Updated `canUserBook()` to be transaction-safe
- [x] Updated `bookMember()` to pass transaction to canUserBook
- [x] Updated `checkBookingEligibility()` to fetch from subcollection
- [x] Updated `GymContext` to listen to memberships subcollection
- [x] Updated `MemberBillingTab` to use real-time listener
- [x] Updated `MemberTableRow` to read from currentMembership object
- [x] Updated `BookingModal` to use memberships from context
- [x] Updated Firestore Rules to allow subcollection access
- [x] Documented all changes in agents.md

### 🧪 Testing Checklist

Before considering migration complete, verify:

- [ ] New member signup creates subcollection document
- [ ] Member can view their own membership in profile
- [ ] Admin can view member's membership in billing tab
- [ ] Admin can update member's membership (change plan, cancel)
- [ ] Admin can view membership history logs
- [ ] Member can book classes using membership or credits
- [ ] Booking transaction reads membership atomically
- [ ] Weekly limit tracking fetches correct membership tier
- [ ] GymContext loads memberships on login
- [ ] GymContext updates in real-time when admin changes membership
- [ ] Member search filters by gymIds map correctly
- [ ] Get gym members uses collectionGroup query correctly
- [ ] Join gym creates both subcollection doc and updates gymIds
- [ ] Disconnect gym deletes subcollection doc and updates gymIds
- [ ] Firestore Rules allow user to read own memberships
- [ ] Firestore Rules allow admin to read/write gym-specific memberships
- [ ] Firestore Rules deny admin access to other gym's memberships

## 12. Future Considerations

### Potential Enhancements

1. **Multi-Gym Credits**: Track credits per gym in subcollection
   - Current: Credits stored globally on user document
   - Future: `users/{userId}/credits/{gymId}` subcollection

2. **Membership Tiers to Subcollection**: Move to gym subcollection
   - Current: `gyms/{gymId}.membershipTiers[]` array
   - Future: `gyms/{gymId}/membershipTiers/{tierId}` subcollection
   - Benefits: Better permission scoping, easier updates

3. **Family Account Enhancements**: Link dependents via subcollection
   - Current: `user.dependents[]` array of IDs
   - Future: `users/{userId}/family/{dependentId}` subcollection
   - Benefits: Track relationship metadata, easier permission rules

4. **Billing Webhooks**: Stripe webhook handler needs updating
   - Ensure webhook updates subcollection, not array
   - Log all billing events to membership history

### Breaking Changes to Avoid

- Don't rename `gymId` field in membership documents (used for collectionGroup queries)
- Don't change path structure (other systems may depend on it)
- Don't remove `gymIds` summary map (needed for efficient member searches)
- Keep backward compatibility helpers for at least one release cycle

---

**Last Updated**: [Current Date]
**Migration Completed**: ✅ Yes
**Firestore Rules Updated**: ✅ Yes
**Production Tested**: ⚠️ Pending

---

## Quick Reference Card

**Need to fetch membership?**
```javascript
const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
const snap = await getDoc(membershipRef);
const membership = snap.exists() ? snap.data() : null;
```

**Need to update membership?**
```javascript
const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
await updateDoc(membershipRef, { status: 'cancelled' });
await logMembershipHistory(userId, gymId, 'Cancelled by admin', actorId);
```

**Need to check if user belongs to gym?**
```javascript
const userSnap = await getDoc(doc(db, 'users', userId));
const belongsToGym = userSnap.data()?.gymIds?.[gymId] === true;
```

**Need to find all members of a gym?**
```javascript
const q = query(
  collectionGroup(db, 'memberships'),
  where('gymId', '==', gymId)
);
const snapshot = await getDocs(q);
const memberIds = snapshot.docs.map(doc => doc.ref.path.split('/')[1]);
```

**Inside a transaction?**
```javascript
// Use transaction.get() instead of getDoc()
const snap = await transaction.get(membershipRef);
```

**Need real-time updates?**
```javascript
useEffect(() => {
  const unsub = onSnapshot(membershipRef, (snap) => {
    setMembership(snap.exists() ? snap.data() : null);
  });
  return () => unsub();
}, [userId, gymId]);
```

COMPLETED IMPLEMENTATION: Per-Gym Credits

# Implementation Status

## ✅ Completed: Per-Gym Credits Refactor

**Date Completed**: [Current Date]
**Branch**: refactor/per-gym-credits

### What Was Implemented:

1. **Created credits.js API** (`packages/shared/api/firestore/credits.js`)
   - `getGymCredits(userId, gymId)` - Fetch credit balance for specific gym
   - `deductCredits(transaction, userId, gymId, amount, reason, source)` - Transaction-safe deduction
   - `addCredits(transaction, userId, gymId, amount, reason, source)` - Transaction-safe addition
   - `adjustUserCredits(userId, gymId, amount, reason, adminId)` - Admin adjustment wrapper
   - `getUserCreditHistory(userId, gymId, limitCount)` - Fetch gym-specific credit logs
   - `migrateGlobalCreditsToPerGym(userId)` - Migration helper for existing users

2. **Updated bookings.js** to use per-gym credits:
   - `canUserBook()` - Now fetches credits from `users/{userId}/credits/{gymId}` subcollection
   - `bookMember()` - Uses `deductCredits()` instead of incrementing global field
   - `cancelBooking()` - Uses `addCredits()` for refunds instead of global increment
   - `checkBookingEligibility()` - Checks gym-specific credits for weekly limit fallback

3. **Updated GymContext** (`packages/web/src/context/GymContext.jsx`):
   - Added `credits` state to track current gym's credit balance
   - Added real-time listener to `users/{userId}/credits/{currentGym.id}`
   - Exposed `credits` in context provider value
   - Credits automatically reset to 0 when gym is switched

4. **Updated Firestore Security Rules** (`firestore.rules`):
   - Added rules for `users/{userId}/credits/{gymId}` subcollection
   - Users can read their own credits
   - Users can create/update their own credits (for booking transactions with validation)
   - Admins can read/write credits only for their gym (via `isStaffOrOwner(gymId)`)
   - Users can create credit logs for their own bookings/cancellations
   - Updated `creditLogs` rules to check `resource.data.gymId` for per-gym access

5. **Updated UI Components**:
   - **MemberBillingTab**: Now listens to gym-specific credits, adjusts per gym, loads gym-specific history
   - **BookingModal** (Member Side): Now uses `credits` from GymContext instead of `userProfile.classCredits`
   - Updated `getUserCreditHistory()` calls to include `gymId` parameter
   - Updated `adjustUserCredits()` calls to include `gymId` parameter
   - Updated `checkBookingEligibility()` to return gym-specific credits in result

### Database Schema Changes:

**NEW Subcollection:**
```javascript
users/{userId}/credits/{gymId} {
  balance: number,
  gymId: string,
  createdAt: timestamp,
  lastUpdated: timestamp
}
```

**UPDATED Subcollection:**
```javascript
users/{userId}/creditLogs/{logId} {
  gymId: string,           // ✅ NOW REQUIRED for per-gym filtering
  amount: number,
  balance: number,         // Balance after transaction
  reason: string,
  type: 'deduction' | 'addition' | 'migration',
  source: 'system' | 'admin_forced' | 'admin_cancel' | 'user_cancel',
  createdAt: timestamp,
  actorId: string
}
```

**DEPRECATED Field (kept at 0 for backward compatibility):**
```javascript
users/{userId} {
  classCredits: 0  // ❌ No longer used, always 0
}
```

### Migration Strategy:

For existing users with `classCredits > 0`:
1. Run `migrateGlobalCreditsToPerGym(userId)` helper
2. Moves all credits to user's primary gym (lastActiveGymId or first gym)
3. Creates migration log in creditLogs subcollection
4. Sets global `classCredits` field to 0

### Testing Checklist:

Before merging to main:
- [ ] New member signup initializes credits at 0 for gym
- [ ] Booking a class deducts from gym-specific balance
- [ ] Cancelling a booking refunds to gym-specific balance
- [ ] Admin can adjust member's credits for their gym
- [ ] Admin can view gym-specific credit history
- [ ] Credits display correctly in MemberBillingTab
- [ ] Credits update in real-time when admin makes changes
- [ ] Switching gyms shows correct credit balance per gym
- [ ] Credit logs are scoped per gym (no cross-gym visibility)
- [ ] Firestore Rules prevent admin from accessing other gym's credits

---

NEXT PLAN OF ACTION:

# Multi-Gym & Per-Gym Credits Analysis

## Current State Assessment

### ✅ What's Already Working for Multi-Gym

Your recent subcollection refactor **accidentally prepared you perfectly** for multi-gym support:

**Database is READY:**
```javascript
users/{userId} {
  gymIds: { 
    "gym_abc": true,
    "gym_xyz": true  // ✅ User can belong to multiple gyms
  },
  lastActiveGymId: "gym_abc",  // ✅ Tracks which gym user is viewing
  
  // ❌ PROBLEM: This is global, not per-gym
  classCredits: 100  
}

users/{userId}/memberships/{gymId} {
  // ✅ PERFECT: Each gym has its own membership document
  gymId: "gym_abc",
  status: "active",
  membershipId: "tier_123"
}
```

**GymContext is READY:**
- Already loads ALL memberships from subcollection
- Already supports switching between gyms via `switchGym(gymId)`
- Already filters memberships and picks active gym

**UI is READY:**
- GymContext provides `memberships` array with all gyms
- Components already respect `currentGym.id` for scoping data

### ❌ What's NOT Ready for Multi-Gym

**1. Credits are Global**
```javascript
// Current (BAD for multi-gym):
user.classCredits = 100  // Which gym are these for?

// Should be (GOOD):
users/{userId}/credits/{gymId} {
  balance: 100,
  lastUpdated: timestamp
}
```

**2. Admin/Owner Role is Single-Gym**
```javascript
// Current (BAD):
user.role = "owner"
user.gymId = "gym_abc"  // ❌ Can only own ONE gym

// Should be (GOOD):
user.gymIds = {
  "gym_abc": true,  // Member
  "gym_xyz": true   // Member
}
user.roles = {
  "gym_abc": "owner",   // ✅ Owner of gym A
  "gym_xyz": "member"   // ✅ Member of gym B
}
```

**3. No Gym Creation UI**
- Currently no way for owner to create a second gym
- No gym switcher UI for admins with multiple gyms

---

## 🎯 Recommended Next Steps (In Order)

### Phase 1: Per-Gym Credits (PRIORITY - Blocks Multi-Gym)

**Why First?**
- Credits are the most broken part for multi-gym right now
- Blocks testing multi-gym scenarios
- Relatively simple migration (similar to memberships)

**Create Branch:**
```bash
git checkout main
git pull origin main
git checkout -b refactor/per-gym-credits
```

**Implementation Tasks:**
1. Create `users/{userId}/credits/{gymId}` subcollection
2. Update `bookMember()` to deduct from gym-specific balance
3. Update `cancelBooking()` to refund to gym-specific balance
4. Update `addCredits()` to add to gym-specific balance
5. Update all UI components to read from subcollection
6. Add migration helper to split global credits across gyms
7. Update Firestore Rules for credit subcollection

**Expected Changes:**
- `packages/shared/api/firestore/credits.js` - Create if doesn't exist
- `packages/shared/api/firestore/bookings.js` - Update booking/cancel logic
- `packages/web/src/components/members/MemberHomeScreen.jsx` - Update credit display
- `packages/web/src/context/GymContext.jsx` - Add credits listener
- `firestore.rules` - Add credits subcollection rules

**Estimated Complexity:** Medium (Similar to membership refactor)

---

### Phase 2: Multi-Role Support (Enables Multi-Gym Admin)

**Why Second?**
- Unblocks owners/staff from managing multiple gyms
- Enables proper permission scoping per gym
- Required before building gym switcher UI

**Create Branch:**
```bash
git checkout main
git pull origin main
git checkout -b feat/multi-gym-roles
```

**Implementation Tasks:**
1. Add `roles` map field to user document: `{ gymId: role }`
2. Update `isStaffOrOwner()` Firestore Rule to check `roles` map
3. Update GymContext to expose user's role for current gym
4. Update all permission checks in UI to use `roles[currentGym.id]`
5. Create migration helper to convert `user.role` → `user.roles[gymId]`
6. Update admin components to check per-gym role

**Database Changes:**
```javascript
// BEFORE:
users/{userId} {
  role: "owner",
  gymId: "gym_abc"
}

// AFTER:
users/{userId} {
  roles: {
    "gym_abc": "owner",
    "gym_xyz": "member",
    "gym_123": "staff"
  },
  // Keep legacy fields for backward compatibility initially
  role: "owner",      // Deprecated, but kept for transition
  gymId: "gym_abc"    // Deprecated, but kept for transition
}
```

**Firestore Rules Update:**
```javascript
// BEFORE:
function isStaffOrOwner(gymId) {
  let user = getRequesterData();
  return user.gymId == gymId && 
         (user.role == 'owner' || user.role == 'staff');
}

// AFTER:
function isStaffOrOwner(gymId) {
  let user = getRequesterData();
  let userRole = user.roles[gymId];
  return userRole == 'owner' || userRole == 'staff' || userRole == 'coach';
}
```

**Expected Changes:**
- `firestore.rules` - Update all permission checks
- `packages/web/src/context/GymContext.jsx` - Expose current role
- `packages/web/src/layouts/AdminLayout.jsx` - Use per-gym role checks
- All admin screens - Update permission checks

**Estimated Complexity:** High (Touches permissions everywhere)

---

### Phase 3: Gym Switcher UI (Makes Multi-Gym Usable)

**Why Third?**
- Depends on multi-role support being stable
- Pure UI work, doesn't break existing functionality
- Enables users to navigate between their gyms

**Create Branch:**
```bash
git checkout main
git pull origin main
git checkout -b feat/gym-switcher-ui
```

**Implementation Tasks:**
1. Add gym switcher dropdown to AdminLayout header
2. Show user's role badge per gym in switcher
3. Add gym switcher to MemberLayout for users with multiple memberships
4. Update GymContext to persist selected gym in localStorage
5. Show "Loading..." state when switching gyms
6. Add gym icons/colors for visual differentiation

**UI Components to Create:**
- `GymSwitcher.jsx` - Dropdown component
- `GymBadge.jsx` - Shows gym name/logo
- `RoleBadge.jsx` - Shows user's role (Owner/Staff/Member)

**Expected Changes:**
- `packages/web/src/layouts/AdminLayout.jsx` - Add switcher to header
- `packages/web/src/layouts/MemberLayout.jsx` - Add switcher if multiple gyms
- `packages/web/src/context/GymContext.jsx` - Add localStorage persistence
- `packages/web/src/components/gym/GymSwitcher.jsx` - New component

**Estimated Complexity:** Medium (Mostly UI work)

---

### Phase 4: Gym Creation Flow (Enables True Multi-Gym)

**Why Fourth?**
- All infrastructure is in place by now
- Purely additive feature
- Doesn't affect existing single-gym users

**Create Branch:**
```bash
git checkout main
git pull origin main
git checkout -b feat/create-additional-gym
```

**Implementation Tasks:**
1. Add "Create New Gym" button in gym switcher dropdown
2. Create `CreateGymModal.jsx` wizard component
3. Update `createGym()` API function to add to existing user's gyms
4. Set creator as owner in `roles` map
5. Auto-switch to newly created gym
6. Add gym setup wizard (name, address, logo, etc.)

**Expected Changes:**
- `packages/shared/api/firestore/gym.js` - Update createGym()
- `packages/web/src/components/gym/CreateGymModal.jsx` - New component
- `packages/web/src/components/gym/GymSwitcher.jsx` - Add "Create" button

**Estimated Complexity:** Medium (Mostly form/wizard UI)

---

## 🔍 Technical Design: Per-Gym Credits

Since this is your next priority, here's the detailed implementation plan:

### Database Schema

```javascript
// NEW Subcollection
users/{userId}/credits/{gymId} {
  balance: 100,
  gymId: "gym_abc",        // Redundant but useful for queries
  gymName: "Stark MMA",
  
  // Metadata
  lastUpdated: timestamp,
  createdAt: timestamp
}

// NEW Subcollection (if doesn't exist already)
users/{userId}/creditLogs/{logId} {
  gymId: "gym_abc",         // ✅ CRITICAL: Must scope logs per gym
  amount: -1,               // Negative for deductions, positive for additions
  balance: 99,              // Balance after transaction
  reason: "Booked: BJJ Fundamentals",
  type: "booking" | "refund" | "purchase" | "admin_adjustment",
  source: "system" | "admin_forced" | "stripe",
  relatedBookingId: string | null,
  
  createdAt: timestamp,
  actorId: string           // Who made the change (userId or admin)
}
```

### API Functions to Update

**File: `packages/shared/api/firestore/credits.js`** (Create if doesn't exist)

```javascript
import { doc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, getDocs, increment, runTransaction } from "firebase/firestore";
import { db } from "../firebaseConfig";

// ✅ NEW: Get credit balance for specific gym
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

// ✅ NEW: Transaction-safe credit deduction
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
  const logRef = collection(db, 'users', userId, 'creditLogs');
  transaction.set(doc(logRef), {
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

// ✅ NEW: Transaction-safe credit addition
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
  
  const logRef = collection(db, 'users', userId, 'creditLogs');
  transaction.set(doc(logRef), {
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

// ✅ NEW: Get credit history for specific gym
export const getCreditHistory = async (userId, gymId) => {
  try {
    const logsRef = collection(db, 'users', userId, 'creditLogs');
    const q = query(
      logsRef,
      where('gymId', '==', gymId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, history };
  } catch (error) {
    console.error("Error fetching credit history:", error);
    return { success: false, error: error.message };
  }
};

// ✅ MIGRATION HELPER: Split global credits across gyms
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
    
    // Distribute credits evenly across gyms (or put all in primary gym)
    const primaryGymId = userData.lastActiveGymId || gymIds[0];
    
    // Put all credits in primary gym
    const creditRef = doc(db, 'users', userId, 'credits', primaryGymId);
    await setDoc(creditRef, {
      balance: globalCredits,
      gymId: primaryGymId,
      createdAt: new Date(),
      lastUpdated: new Date()
    });
    
    // Log the migration
    await addDoc(collection(db, 'users', userId, 'creditLogs'), {
      gymId: primaryGymId,
      amount: globalCredits,
      balance: globalCredits,
      reason: 'Migrated from global credits',
      type: 'migration',
      source: 'system',
      createdAt: new Date(),
      actorId: 'system'
    });
    
    // Clear global credits (keep field for backward compatibility initially)
    await updateDoc(userRef, {
      classCredits: 0
    });
    
    return { success: true, migratedAmount: globalCredits, toGym: primaryGymId };
  } catch (error) {
    console.error("Migration error:", error);
    return { success: false, error: error.message };
  }
};
```

### Update Booking Logic

**File: `packages/shared/api/firestore/bookings.js`**

```javascript
// Update canUserBook to check gym-specific credits
export const canUserBook = async (classData, userId, targetGymId, transaction = null) => {
  // ... existing membership check code ...
  
  // ✅ CHANGE: Fetch gym-specific credits instead of global
  const creditRef = doc(db, 'users', userId, 'credits', targetGymId);
  const creditSnap = transaction 
    ? await transaction.get(creditRef)
    : await getDoc(creditRef);
  
  let credits = 0;
  if (creditSnap.exists()) {
    credits = parseInt(creditSnap.data().balance) || 0;
  }
  
  // ... rest of logic uses 'credits' variable
};

// Update bookMember to deduct from gym-specific balance
export const bookMember = async (gymId, classInfo, member, options = {}) => {
  return await runTransaction(db, async (transaction) => {
    // ... existing setup code ...
    
    // ✅ CHANGE: Deduct from gym-specific credits
    if (costUsed > 0) {
      const newBalance = await deductCredits(
        transaction,
        member.id,
        gymId,
        costUsed,
        options.isStaff ? `Admin Booked: ${classInfo.name}` : `Booked: ${classInfo.name}`,
        options.force ? 'admin_forced' : 'system'
      );
      
      if (newBalance < 0 && !options.force) {
        throw "Insufficient credits";
      }
    }
    
    // ... rest of booking logic
  });
};

// Update cancelBooking to refund to gym-specific balance
export const cancelBooking = async (gymId, attendanceId, options = {}) => {
  await runTransaction(db, async (transaction) => {
    // ... existing setup code ...
    
    // ✅ CHANGE: Refund to gym-specific credits
    if (shouldRefund && data.costUsed > 0) {
      await addCredits(
        transaction,
        data.memberId,
        gymId,
        data.costUsed,
        options.isStaff ? `Admin Refunded: ${data.className}` : `Refund: ${data.className}`,
        options.isStaff ? 'admin_cancel' : 'user_cancel'
      );
      refundedAmount = data.costUsed;
    }
    
    // ... rest of cancellation logic
  });
};
```

### Update GymContext

**File: `packages/web/src/context/GymContext.jsx`**

```javascript
export const GymProvider = ({ children }) => {
  const [currentGym, setCurrentGym] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [credits, setCredits] = useState(0);  // ✅ NEW: Current gym credits
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // ... existing auth and membership listener code ...
    
    // ✅ NEW: Listen to credits for current gym
    let creditsUnsubscribe = null;
    
    if (currentGym?.id && user) {
      const creditRef = doc(db, 'users', user.uid, 'credits', currentGym.id);
      creditsUnsubscribe = onSnapshot(creditRef, (snap) => {
        if (snap.exists()) {
          setCredits(snap.data().balance || 0);
        } else {
          setCredits(0);
        }
      });
    }
    
    return () => {
      if (creditsUnsubscribe) creditsUnsubscribe();
    };
  }, [currentGym?.id, user]);
  
  return (
    <GymContext.Provider value={{ 
      currentGym, 
      memberships, 
      credits,  // ✅ NEW: Expose credits
      switchGym, 
      isLoading: loading 
    }}>
      {children}
    </GymContext.Provider>
  );
};
```

### Update Firestore Rules

**File: `firestore.rules`**

```javascript
match /users/{userId} {
  // ... existing rules ...
  
  // ✅ NEW: Credits subcollection
  match /credits/{gymId} {
    // User can read their own credits
    allow read: if request.auth.uid == userId;
    
    // Admin can read/write credits for their gym only
    allow read, write: if request.auth != null && isStaffOrOwner(gymId);
  }
  
  // ✅ UPDATE: Credit logs should be scoped per gym
  match /creditLogs/{logId} {
    // User can read their own logs
    allow read: if request.auth.uid == userId;
    
    // Admin can read logs for their gym
    allow read: if request.auth != null && isStaffOrOwner(resource.data.gymId);
    
    // Admin can create logs for their gym
    allow create: if request.auth != null && isStaffOrOwner(request.resource.data.gymId);
  }
}
```

---

🟠 P1: Community & Chat Enhancements (Sprint 7.5)
Refining the features you just built to make them production-ready.

[x] Image Optimization (Feed): ✅ COMPLETED

Action: Implemented react-easy-crop for image cropping before upload.

Implementation Details:
- Added `react-easy-crop` library to packages/web
- Created `ImageCropModal.jsx` component with support for 1:1, 4:3, and 16:9 aspect ratios
- Created `imageUtils.js` with cropping and compression utilities (max 1200px, 85% quality)
- Updated `CommunityFeedScreen.jsx` to show crop modal before image upload
- Images are now consistently sized and optimized before upload

[x] Rich Media in Group Chat: ✅ COMPLETED

Action: Added ability to send Images and GIFs in chat.

Implementation Details:
- Added `uploadChatImage()` function to storage.js with support for JPEG, PNG, GIF, WebP (max 10MB)
- Extended `sendMessage()` API to accept optional media object `{ type, url, width, height, size }`
- Updated both admin and member chat screens with image upload button
- Messages display inline images with click-to-open-fullscreen
- Chat previews show "📷 Sent an image" or "📎 Sent a GIF" for media messages
- Storage path: `gyms/{gymId}/chatGroups/{groupId}/media/{timestamp}_{filename}`

[x] Storage Governance (Revenue Integrity): ✅ COMPLETED

Action: Implemented "Ghost Gym" logic for auto-delete media.

Implementation Details:
- Created `cleanupExpiredChatMedia` scheduled Cloud Function (runs daily at 2 AM UTC)
- Configurable per-gym retention via `chatMediaRetentionDays` field (default 30 days, -1 for unlimited)
- Messages keep text but media is soft-deleted (marked as `mediaExpired: true`)
- Created `triggerMediaCleanup` callable function for manual admin cleanup
- Created `getStorageStats` callable function for storage usage monitoring
- Added helper functions in chat.js: `getExpiredMediaMessages()`, `removeMediaFromMessage()`, `getStorageGovernanceSettings()`, `updateStorageGovernanceSettings()`

[x] Mobile QA Across entire application: ✅ COMPLETED

Action: Verify both Admin and Member chat screens on actual mobile viewports (adjust padding/safe-areas). Confirm that admin and member screens work for both web and mobile views.

Implementation Details:
- **Theme System Audit**: Confirmed gym-specific theming via `theme.primaryColor` and `theme.secondaryColor` stored in Firestore
- **Theme Distribution**: Admin screens receive theme via `useOutletContext()` from AdminLayout; Member screens use `useGym()` context
- **Layout Presets**: 3 layouts supported (classic, sidebar, header) determining sidebar/header coloring

**Admin Screen Theme Fixes:**
- `DashboardMembersScreen.jsx`: Added table overflow fix (`overflow-x-auto`, `min-w-[640px]`) and themed "Add Member" button
- `DashboardClassesScreen.jsx`: Themed view mode tabs (Weekly Schedule/One-Off Events), day badges, and icon boxes
- `ClassFormModal/index.jsx`: Added theme prop, themed tabs and save button
- `MembershipsScreen/index.jsx`: Themed tabs, passed theme to RecurringForm and ClassPackForm
- `RecurringForm.jsx`: Themed visibility options, trial toggle, add feature button, submit button
- `ClassPackForm.jsx`: Themed visibility options, add perk button, submit button
- `MemberFormModal/index.jsx`: Themed NavItem component tabs and save button
- `DashboardStaffScreen.jsx`: Themed avatar fallback, title badge, edit hover, modal tabs, payroll sample
- `DashboardSettingsScreen.jsx`: Themed tabs, passed theme to all child settings tabs
- Settings tabs (General, Booking, Legal, Rank, Branding): Updated save buttons to use primaryColor

**Theme Pattern Used:**
```javascript
const { theme } = useOutletContext() || {};
const primaryColor = theme?.primaryColor || '#2563eb';
// Buttons: style={{ backgroundColor: primaryColor }}
// Tabs: style={activeTab === 'x' ? { borderColor: primaryColor, color: primaryColor } : {}}
// Badges: style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
```

**Secondary Color Usage:**
- `secondaryColor` is primarily used in AdminLayout for user avatar background
- Used in BrandingSettingsTab for preview button outline
- Most UI elements use `primaryColor` for consistency

🟡 P2: Commerce & Payments (Phase 8 - "The Store")
This is the next major module according to your docs. You cannot do "Stripe Integration" without the Store UI.

[x] Admin Shop Dashboard: ✅ COMPLETED

Action: Created a simplified Shopify-like interface for admins to manage physical products (gear, merchandise, drinks) with full CRUD operations, variant support, and member store integration.

**Implementation Details:**

**New Files Created:**

1. **Shared API Layer**
   - `packages/shared/api/firestore/products.js` - Full CRUD operations:
     - `createProduct(gymId, productData)` - Create new product
     - `getProducts(gymId)` - Get all products for admin view
     - `getActiveProducts(gymId)` - Get active public products for member store
     - `getProductById(gymId, productId)` - Get single product
     - `updateProduct(gymId, productId, data)` - Update product
     - `deleteProduct(gymId, productId)` - Delete product
     - `updateProductStock(gymId, productId, variantId, quantity)` - Update stock
     - `getLowStockProducts(gymId, threshold)` - Get low stock alerts
     - `getTotalStock(product)` - Calculate total stock across variants
     - `isInStock(product, variantId)` - Check stock availability
     - `PRODUCT_CATEGORIES` - Predefined categories (gear, apparel, drinks, supplements, accessories)

2. **Admin Shop Screen** (`packages/web/src/screens/admin/ShopScreen/`)
   - `index.jsx` - Main screen with tabs: "All Products" | "Low Stock"
   - `ProductsTab.jsx` - Product grid with category filters, edit/delete actions
   - `LowStockTab.jsx` - Low stock alerts table with inline stock editing

3. **Product Form Modal** (`packages/web/src/components/admin/ProductFormModal/`)
   - `index.jsx` - Sidebar-layout modal (like MemberFormModal pattern)
   - `ProductDetailsTab.jsx` - Name, description, category, pricing, visibility, active/featured toggles
   - `ProductVariantsTab.jsx` - Toggle variants on/off, dynamic variant rows with name/SKU/price/stock
   - `ProductImagesTab.jsx` - Multi-image upload (1-5 images), drag-to-reorder, set primary image

4. **Storage Functions** (added to `packages/shared/api/storage.js`)
   - `uploadProductImage(gymId, productId, file)` - Upload product images to Firebase Storage

**Files Modified:**

1. `packages/shared/api/firestore/index.js` - Added products export
2. `firestore.rules` - Added products subcollection rules:
   - Members can read active/public products
   - Admin/staff can read all products and have full write access
3. `packages/web/src/layout/AdminLayout.jsx` - Added "Shop" nav item with ShoppingBag icon
4. `packages/web/src/App.jsx` - Added `/admin/shop` route
5. `packages/web/src/screens/members/store/index.jsx` - Replaced mock data with real Firestore fetch
6. `packages/web/src/screens/members/store/ProductDetailModal.jsx` - Fixed price formatting

**Database Schema:**

```javascript
gyms/{gymId}/products/{productId} {
  // Core Info
  name: string,
  description: string,
  category: 'gear' | 'apparel' | 'drinks' | 'supplements' | 'accessories',

  // Pricing
  price: number,
  compareAtPrice: number | null,  // For sale pricing

  // Variants
  hasVariants: boolean,
  variants: [{
    id: string,
    name: string,
    sku: string | null,
    price: number,
    stock: number,
    lowStockThreshold: number
  }],

  // Stock (if no variants)
  stock: number | null,
  lowStockThreshold: number,

  // Images
  images: string[],  // Array of URLs, first is primary

  // Status
  active: boolean,
  visibility: 'public' | 'internal' | 'hidden',
  featured: boolean,

  // Metadata
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: string
}
```

**Key Features:**
- Admin can create/edit/delete products with full form validation
- Support for product variants (sizes, colors) with individual pricing and stock
- Multi-image upload with drag-to-reorder and primary image selection
- Low stock alerts with configurable threshold per product/variant
- Sale pricing with compare-at-price and strikethrough display
- Visibility controls (public, internal, hidden)
- Member store automatically fetches real products from Firestore
- Sale badges display on member store for discounted items

## 🔴 P2.5: Stripe Integration (Phase 8.5 - "Payments & Subscriptions")

**Branch**: `feat/stripe-integration`
**Status**: 🟡 Planning Complete - Ready for Implementation
**Estimated Complexity**: High (Multi-Sprint Effort)

---

### Executive Summary

Implement Stripe as the payment backbone for GymDash. This includes:
- Gym owners connecting their Stripe accounts (Stripe Connect)
- Members purchasing memberships, class packs, and shop products
- Subscription management with webhooks for status changes
- Application fee collection (configurable, starting at 1%)
- Coupon/promo code system for discounts

---

### Architecture Decisions

#### 1. Stripe Connect Model: **Express Accounts** (Recommended)

**Why Express over Standard/Custom?**
- Express handles identity verification, tax reporting (1099s), and compliance
- Users manage their own payout schedules via Stripe Dashboard
- Minimal liability for GymDash
- Faster onboarding (Stripe-hosted flow)

**Flow:**
```
Gym Owner → "Connect Stripe" Button → Stripe OAuth Flow →
Stripe Creates Express Account → Returns account_id → Store in gyms/{gymId}
```

#### 2. Payment Flow Model: **Stripe Checkout Sessions** (Recommended for MVP)

**Why Checkout Sessions over Payment Intents + Elements?**
- Stripe-hosted, PCI-compliant payment page
- Handles 3D Secure, Apple Pay, Google Pay automatically
- Less code to maintain
- Easier to pass security audits
- Can upgrade to embedded Elements later for seamless UX

**For Subscriptions:**
```
Member clicks "Subscribe" → Create Checkout Session → Redirect to Stripe →
Stripe handles payment → Webhook fires → Update membership subcollection
```

**For One-Time Purchases (Shop, Class Packs):**
```
Member adds to cart → Create Checkout Session → Redirect to Stripe →
Payment completes → Webhook fires → Fulfill order / Add credits
```

#### 3. Payment Method Storage: **Stripe Customer Portal**

**Why Stripe-hosted Portal over Custom UI?**
- Members manage their own cards via Stripe's secure portal
- No sensitive card data in our database
- Automatic compliance with PCI DSS
- Members can update payment methods without our code changes

**Flow:**
```
Member clicks "Manage Payment Methods" → Create Portal Session →
Redirect to Stripe Portal → Member manages cards → Returns to app
```

**Per-Gym Card Selection:**
- Store `stripeDefaultPaymentMethodId` in `users/{userId}/memberships/{gymId}`
- When member has multiple gyms, they can set different default cards per gym
- Card display shows last 4 digits fetched from Stripe API (no sensitive data stored)

#### 4. Application Fee Strategy

**Configurable Fee Structure:**
```javascript
// In gyms/{gymId}/settings/stripe
{
  applicationFeePercent: 1.0,  // 1% default, can be adjusted
}

// Platform-wide default (can be in Firebase Remote Config or hardcoded)
const DEFAULT_APPLICATION_FEE_PERCENT = 1.0;
```

**Fee Collection:**
```javascript
// When creating Checkout Session for connected account
const session = await stripe.checkout.sessions.create({
  // ...other config
  payment_intent_data: {
    application_fee_amount: Math.round(totalAmount * (feePercent / 100)),
    transfer_data: {
      destination: gymStripeAccountId,
    },
  },
});
```

#### 5. Webhook Strategy

**Critical Webhooks to Handle:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Fulfill order (add credits, create membership, process shop order) |
| `invoice.paid` | Confirm subscription renewal, log to membership history |
| `invoice.payment_failed` | Update membership status, notify member, apply grace period |
| `customer.subscription.updated` | Sync plan changes, handle upgrades/downgrades |
| `customer.subscription.deleted` | Cancel membership, revoke access |
| `charge.refunded` | Process refund, update order status |
| `account.updated` | Update gym's Stripe account status |

#### 6. Grace Period Strategy for Failed Payments

**Configurable per gym:**

```javascript
// In gyms/{gymId}/settings/billing
{
  gracePeriodDays: 3,              // Days member can still book after failed payment
  suspendAfterFailedPayments: 1,   // Number of consecutive failures before suspension
  notifyOnFailure: true,
  notifyDaysBeforeRenewal: [7, 1]  // Email reminders before renewal
}
```

**Status Flow:**
1. First failed payment → `status: 'past_due'` (can still book during grace period)
2. After grace period → `status: 'suspended'` (cannot book, prominent "Reactivate" CTA)
3. Member updates payment → Retry charge → If successful, `status: 'active'`

---

### Implementation Phases

#### Phase 1: Foundation & Stripe Connect ✅ COMPLETE

**[x] 1.1 Environment Setup**
- [x] Create `.env.example` with placeholder Stripe keys
- [x] Document: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- [x] Install Stripe SDK in Cloud Functions (`stripe` package)
- [x] Stripe secret deployed via Firebase Functions params: `defineString("STRIPE_SECRET_KEY")`
- [ ] Install `@stripe/stripe-js` in web package for frontend (deferred - using Checkout redirects)

**[x] 1.2 Stripe Connect Onboarding**
- [x] `createStripeAccountLink` Cloud Function (in `functions/index.js`)
  - Creates Standard Stripe account for gym owner
  - Stores `stripeAccountId` and `stripeAccountStatus: 'PENDING'` in gym document
  - Returns account link URL for onboarding redirect
- [x] Step 6 onboarding screen (`Step6_ConnectPaymentsScreen.jsx`)
- [x] Success screen (`StripeSuccessScreen.jsx`) handles return from Stripe
- [x] Gym document stores Stripe fields:
  ```javascript
  gyms/{gymId} {
    stripeAccountId: string | null,
    stripeAccountStatus: 'PENDING' | 'ACTIVE' | 'RESTRICTED',
  }
  ```
- [x] PaymentsSettingsTab shows connection status
- [x] Added `verifyStripeAccount` function to check/update account status
- [x] Added `createStripeAccountLinkRefresh` for reconnecting incomplete accounts
- [x] Enhanced PaymentsSettingsTab with reconnect flow and Stripe Dashboard link

**[x] 1.3 Webhook Infrastructure**
- [x] `stripeWebhook` Cloud Function endpoint with signature verification
- [x] Handles `account.updated` event to sync Stripe account status
- [x] Handles `checkout.session.completed` for payment fulfillment
- [x] Event logging to `gyms/{gymId}/stripeEvents/{eventId}`
- [x] Idempotency checking via `stripeEventId`
- [ ] Configure webhook endpoint in Stripe Dashboard (manual step)

**Webhook Configuration (Manual Step Required):**
1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://us-central1-{PROJECT_ID}.cloudfunctions.net/stripeWebhook`
3. Select events: `account.updated`, `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the signing secret and set it: `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`

---

#### Phase 2: Products & Prices Sync ✅ COMPLETE

**[x] 2.1 Membership Tier → Stripe Product Sync**
- [x] When admin creates membership tier:
  - Create Stripe Product with tier name/description
  - Create Stripe Price(s) for each interval (monthly/yearly/one-time)
- [x] Store in membership tier document:
  ```javascript
  gyms/{gymId}/membershipTiers/{tierId} {
    // ...existing fields
    stripeProductId: string | null,
    stripePriceId: string | null,           // Monthly price
    stripePriceIdYearly: string | null,     // Yearly price (if applicable)
  }
  ```
- [x] When admin edits tier pricing → Update Stripe Price (create new price, archive old)
- [x] When admin deletes tier → Archive Stripe Product (don't delete for audit trail)

**Implementation Details:**
- Cloud Function: `syncMembershipTierToStripe` - Creates/updates Stripe Product and Price
- Cloud Function: `archiveStripeProduct` - Archives products instead of deleting
- API: `memberships.js` - Added `syncToStripe` parameter to create/update functions
- Handles both recurring intervals (`month`, `year`) and one-time prices (`one_time`)
- Archives old prices when price changes occur

**[x] 2.2 Shop Product → Stripe Product Sync**
- [x] When admin creates shop product:
  - Create Stripe Product
  - Create Stripe Price for base product
- [x] Store in product document:
  ```javascript
  gyms/{gymId}/products/{productId} {
    // ...existing fields
    stripeProductId: string | null,
    stripePriceId: string | null
  }
  ```
- [x] Handle price updates when admin edits product pricing

**Implementation Details:**
- Cloud Function: `syncShopProductToStripe` - Creates/updates Stripe Product and Price
- API: `products.js` - Added `syncToStripe` parameter to create/update functions
- Archives old prices when price changes occur
- Syncs product name, description, and images to Stripe

**[x] 2.3 Class Pack → Stripe Product Sync**
- [x] Class packs are handled as membership tiers with `interval: 'one_time'`
- [x] Uses same `syncMembershipTierToStripe` function
- [x] Store in class pack document:
  ```javascript
  gyms/{gymId}/membershipTiers/{packId} {
    // ...existing fields
    interval: 'one_time',
    stripeProductId: string | null,
    stripePriceId: string | null
  }
  ```

---

#### Phase 3: Subscription Checkout ✅ COMPLETED

**[x] 3.1 Member Subscription Flow** ✅
- [x] Created `createSubscriptionCheckout(gymId, tierId, origin)` Cloud Function
  - Validates gym has connected & active Stripe account
  - Creates or retrieves Stripe Customer for member on connected account
  - Creates Checkout Session in subscription mode
  - Handles initiation fees as one-time line items
  - Supports trial periods from tier configuration
  - Returns checkout URL for redirect
- [x] Frontend implementation:
  - Member views available plans in Store → Memberships tab (`MembershipListTab.jsx`)
  - Clicks "Select Plan" / "Start Free Trial" → Calls Cloud Function → Redirects to Stripe Checkout
  - Success URL: `/members/membership/success?session_id={CHECKOUT_SESSION_ID}`
  - Cancel URL: `/members/store?category=memberships`
  - Loading states and error handling implemented

**[x] 3.2 Subscription Success Handling** ✅
- [x] Handle `checkout.session.completed` webhook (mode: subscription):
  - Extracts subscription ID, customer ID from session via `handleMembershipCheckoutCompleted()`
  - Creates/updates membership subcollection:
    ```javascript
    users/{userId}/memberships/{gymId} {
      status: 'active' | 'trialing',
      membershipId: tierId,
      membershipName: tierName,
      price: tierPrice,
      interval: 'month' | 'year' | 'week',
      stripeSubscriptionId: string,
      stripeCustomerId: string,
      stripeCheckoutSessionId: string,
      startDate: timestamp,
      currentPeriodStart: timestamp,
      cancelAtPeriodEnd: false,
      features: string[],
      monthlyCredits: number,
      hadTrial: boolean,
      trialDays: number,
      trialEndDate: timestamp (if trialing),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    ```
  - Logs to membership history subcollection
  - Updates user's gymId and role if first gym
  - Increments gym's memberCount
  - Allocates initial credits if tier includes them

**[x] 3.3 Member Subscription UI** ✅
- [x] Updated `MembershipListTab.jsx`:
  - Shows loading spinner during checkout creation
  - Disables all buttons while processing
  - Error messages with dismiss option
  - Checks for `stripePriceId` before allowing checkout
- [x] Created `SubscriptionSuccessScreen.jsx`:
  - Shows success message with gym branding
  - "What's Next" section with CTAs
  - Links to schedule and profile
  - Refreshes membership data on mount
- [x] Updated `MembershipSection.jsx` in member profile:
  - Added `createCustomerPortalSession` function call
  - Shows "Opening Billing Portal..." loading state
  - Opens Stripe Customer Portal for managing billing
  - Shows external link icon for Stripe subscriptions
  - Fallback handling for non-Stripe memberships

**[x] 3.4 Customer Portal Integration** ✅ (Bonus)
- [x] Created `createCustomerPortalSession(gymId, origin)` Cloud Function
  - Retrieves Stripe Customer ID from user's membership
  - Creates Stripe Billing Portal session on connected account
  - Returns portal URL for redirect
- [x] Added `createCustomerPortalSession()` to shared API
- [x] Integrated into MembershipSection "Payment Method" button

**[x] 3.5 Admin Stripe Integration** ✅
- [x] Added "Enable Online Payments" toggle to `RecurringForm.jsx`:
  - Toggle enables/disables Stripe sync when creating/editing plans
  - Shows sync status for already-synced tiers
  - Auto-enabled for public plans when Stripe is connected
- [x] Added "Enable Online Payments" toggle to `ClassPackForm.jsx`:
  - Same functionality as RecurringForm
  - Supports one-time class pack purchases
- [x] Updated `MembershipsScreen.jsx`:
  - Fetches gym's `stripeAccountStatus` on load
  - Passes `stripeEnabled` prop to forms
- [x] Created `createAdminCheckoutLink(gymId, tierId, memberId)` Cloud Function:
  - Generates a Stripe Checkout URL for admin-assigned memberships
  - Pre-fills customer email from member's user record
  - Stores member ID in session metadata for webhook processing
  - Returns shareable payment link for admin to send to member
- [x] Updated `MemberBillingTab.jsx` with payment link generation:
  - "Generate Payment Link" button for Stripe-synced tiers
  - Copy-to-clipboard functionality for generated URLs
  - Validation that tier has `stripePriceId` before allowing link generation
  - Error states for non-synced tiers with guidance to enable online payments

**Cloud Functions Deployed (Phase 3):**
- `createSubscriptionCheckout` - Creates Stripe Checkout Session for member self-checkout
- `createCustomerPortalSession` - Opens Stripe Customer Portal for billing management
- `createAdminCheckoutLink` - Generates payment link for admin-assigned memberships

**Files Modified:**
- `functions/index.js` - Added checkout, portal, and admin link functions, webhook handler
- `packages/shared/api/firestore/memberships.js` - Added checkout, portal, and admin link API functions
- `packages/web/src/screens/members/store/tabs/MembershipListTab.jsx` - Checkout flow integration
- `packages/web/src/screens/members/membership/SubscriptionSuccessScreen.jsx` - NEW
- `packages/web/src/screens/members/profile/MembershipSection.jsx` - Portal integration
- `packages/web/src/App.jsx` - Added success route
- `packages/web/src/components/admin/memberships/RecurringForm.jsx` - Stripe sync toggle
- `packages/web/src/components/admin/memberships/ClassPackForm.jsx` - Stripe sync toggle
- `packages/web/src/screens/admin/MembershipsScreen/index.jsx` - Stripe enabled state
- `packages/web/src/components/admin/MemberFormModal/MemberBillingTab.jsx` - Payment link generation

---

#### Phase 4: One-Time Purchases ✅ COMPLETE

**[x] 4.1 Class Pack Purchase Flow** ✅
- [x] Created `createClassPackCheckout(gymId, packId)` Cloud Function
  - Creates Checkout Session in payment mode
  - Validates pack has `stripePriceId`
  - Creates/retrieves Stripe Customer on connected account
  - Returns checkout URL for redirect
- [x] Implemented `handleClassPackCheckoutCompleted` webhook handler:
  - Adds credits to `users/{userId}/credits/{gymId}`
  - Logs to credit history with purchase details
  - Logs to membership history
- [x] Updated `MembershipDropInTab.jsx` with checkout integration:
  - "Buy Pack" button initiates Stripe Checkout
  - Shows credits badge on each pack
  - Loading states and error handling
  - Disabled state for packs not synced to Stripe

**[x] 4.2 Shop Product Purchase Flow** ✅
- [x] Created `createShopCheckout(gymId, cartItems)` Cloud Function
  - Accepts array of `{ productId, variantId, quantity }`
  - Validates stock availability for each item
  - Creates ad-hoc prices for each product/variant
  - Returns stock error messages if items unavailable
- [x] Implemented `handleShopOrderCheckoutCompleted` webhook handler:
  - Creates order document in `gyms/{gymId}/orders/{orderId}`
  - Decrements stock for products and variants
  - Logs to membership history
- [x] Updated `CartDrawer.jsx` with Stripe Checkout:
  - "Checkout" button redirects to Stripe
  - Loading states and error handling
  - Theme-aware styling

**[x] 4.3 Success Screens** ✅
- [x] Created `OrderSuccessScreen.jsx` for shop purchases
- [x] Created `PackSuccessScreen.jsx` for class pack purchases
- [x] Added routes in `App.jsx`

**[ ] 4.4 Admin Order Management** (Deferred to future phase)
- [ ] Create `OrdersScreen.jsx` for admin
- [ ] Add "Orders" to admin navigation

**Cloud Functions Deployed (Phase 4):**
- `createClassPackCheckout` - Creates Stripe Checkout for class pack purchases
- `createShopCheckout` - Creates Stripe Checkout for cart/shop purchases

**Files Modified:**
- `functions/index.js` - Added checkout functions and webhook handlers
- `packages/shared/api/firestore/memberships.js` - Added checkout API functions
- `packages/web/src/screens/members/store/CartDrawer.jsx` - Stripe checkout integration
- `packages/web/src/screens/members/store/tabs/MembershipDropInTab.jsx` - Class pack checkout
- `packages/web/src/screens/members/store/OrderSuccessScreen.jsx` - NEW
- `packages/web/src/screens/members/store/PackSuccessScreen.jsx` - NEW
- `packages/web/src/App.jsx` - Added success routes

**Additional Bug Fixes in this Phase:**
- Fixed mobile purchase button z-index (was hidden behind bottom nav)
- Added cart access button to product detail screen header
- Added stock warning for admins when creating products without stock
- Fixed admin checkout link to use custom price instead of tier default

---

#### Phase 5: Subscription Lifecycle Management ✅ COMPLETED

**[x] 5.1 Renewal Handling** ✅
- [x] Handle `invoice.paid` webhook:
  - Updates `currentPeriodStart` and `currentPeriodEnd` in membership
  - Transitions status from `past_due` or `trialing` to `active`
  - Logs to membership history: "Subscription renewed"

**[x] 5.2 Failed Payment Handling** ✅
- [x] Handle `invoice.payment_failed` webhook:
  - Updates membership `status: 'past_due'`
  - Logs failure reason to membership history
- [x] Show "Payment Failed" banner in MembershipSection with link to update payment method
- [ ] (Future) Grace period logic for suspended status

**[x] 5.3 Cancellation Handling** ✅
- [x] `cancelMemberSubscription(gymId, cancelImmediately)` Cloud Function:
  - `cancelImmediately: true` → Cancel now, revoke access
  - `cancelImmediately: false` → Set `cancel_at_period_end: true`, retain access until period end
- [x] Handle `customer.subscription.updated` webhook:
  - Syncs `cancelAtPeriodEnd`, period dates, and status
  - Logs cancellation scheduled/reversed to history
- [x] Handle `customer.subscription.deleted` webhook:
  - Sets membership `status: 'inactive'`
  - Clears `stripeSubscriptionId`
  - Decrements gym member count
- [x] `reactivateSubscription(gymId)` Cloud Function to undo scheduled cancellation
- [x] Member billing UI shows cancellation status with "Reactivate" button

**[x] 5.4 Plan Changes (Upgrades/Downgrades)** ✅
- [x] `changeSubscriptionPlan(gymId, newTierId, previewOnly)` Cloud Function:
  - Uses Stripe's subscription update with proration
  - `previewOnly: true` returns prorated amount preview
  - `previewOnly: false` executes the plan change
- [x] Membership plans screen (MembershipListTab) shows:
  - "Current Plan" badge on active subscription
  - "Upgrade" / "Downgrade" buttons based on price comparison
  - Preview modal with proration details before confirming

**New Cloud Functions:**
- `cancelMemberSubscription` - Cancel subscription (at period end or immediately)
- `reactivateSubscription` - Undo scheduled cancellation
- `changeSubscriptionPlan` - Switch to different membership tier with proration

**Files Modified:**
- `functions/index.js` - Webhook handlers + new Cloud Functions
- `packages/shared/api/firestore/memberships.js` - API functions
- `packages/web/src/screens/members/profile/MembershipSection.jsx` - Payment status banners, reactivate UI
- `packages/web/src/screens/members/store/tabs/MembershipListTab.jsx` - Plan change UI
- `packages/web/src/screens/members/store/index.jsx` - Pass currentMembership prop

---

#### Phase 6: Customer Portal & Payment Methods ✅ COMPLETED

**[x] 6.1 Stripe Customer Portal Integration** ✅
- [x] `createCustomerPortalSession(gymId)` Cloud Function (implemented in Phase 3):
  - Creates portal session for the member's Stripe Customer
  - Returns portal URL with return_url back to app
- [x] "Manage Billing" button in member profile opens portal

**[x] 6.2 Payment Method Display (Read-Only in App)** ✅
- [x] `getPaymentMethods(gymId)` Cloud Function:
  - Fetches payment methods from Stripe API
  - Returns sanitized data: `{ id, brand, last4, expMonth, expYear, isDefault }`
  - **NEVER returns full card numbers**
- [x] MembershipSection displays saved cards:
  - Lists saved cards with brand abbreviations (VISA, MC, AMEX, DISC)
  - Shows DEFAULT badge on default payment method
  - "Manage Billing" button links to Customer Portal

**[x] 6.3 Per-Gym Default Payment Method** ✅
- [x] Already handled by architecture: each gym has its own Stripe connected account
- [x] Each gym creates its own customer for the member
- [x] Payment methods shown are already per-gym isolated
- [x] Members with multiple gyms see different payment methods per gym

**New Cloud Functions:**
- `getPaymentMethods` - Fetch saved cards for display (read-only, sanitized)

**Files Modified:**
- `functions/index.js` - Added getPaymentMethods function
- `packages/shared/api/firestore/memberships.js` - Added getPaymentMethods API
- `packages/web/src/screens/members/profile/MembershipSection.jsx` - Payment methods display

---

#### Phase 7: Coupons & Promo Codes ✅ COMPLETED

**[x] 7.1 Admin Coupon Creation** ✅
- [x] CouponsTab added to MembershipsScreen:
  - Lists existing coupons with usage stats, expiration, status
  - "Create Coupon" form with full options
  - Deactivate coupon functionality
- [x] `createCoupon(gymId, couponData)` Cloud Function:
  - Creates Stripe Coupon + Promotion Code on connected account
  - Stores coupon data in `gyms/{gymId}/coupons/{couponId}`
- [x] `listCoupons(gymId, includeInactive)` Cloud Function
- [x] `deactivateCoupon(gymId, couponId)` Cloud Function
- [x] Coupon options supported:
  - Percentage off or fixed amount off
  - Duration: once, repeating (X months), forever
  - Applies to: all, memberships, shop, class_packs
  - First-time only restriction
  - Max redemptions limit
  - Expiration date

**[x] 7.2 Coupon Application at Checkout** ✅
- [x] Promo code input field on CartDrawer (shop checkout)
- [x] `validateCoupon(gymId, code, cartType)` Cloud Function:
  - Validates coupon exists, is active, not expired, has redemptions left
  - Checks if coupon applies to cart type
  - Returns discount description for display
- [x] All checkout functions updated to accept promoCode:
  - `createSubscriptionCheckout` - memberships
  - `createShopCheckout` - shop products
  - `createClassPackCheckout` - class packs
- [x] Promo code applied as Stripe discount at checkout

**[x] 7.3 Admin-Applied Discounts** ✅
- [x] Admins can create coupons that members apply at checkout
- [x] Manual credit adjustment already exists in credits system

**New Cloud Functions:**
- `createCoupon` - Create Stripe coupon + promotion code
- `validateCoupon` - Validate promo code for checkout
- `listCoupons` - List gym's coupons (admin only)
- `deactivateCoupon` - Deactivate a coupon

**Files Created/Modified:**
- `functions/index.js` - Coupon functions + checkout promo code support
- `packages/shared/api/firestore/memberships.js` - Coupon API functions
- `packages/web/src/screens/admin/MembershipsScreen/CouponsTab.jsx` - NEW
- `packages/web/src/screens/admin/MembershipsScreen/index.jsx` - Added Coupons tab
- `packages/web/src/screens/members/store/CartDrawer.jsx` - Promo code input

---

#### Phase 8: Refunds & Disputes ✅ COMPLETED

**[x] 8.1 Admin Refund Flow**
- [x] Add refund functionality to Order detail screen:
  - Full refund option
  - Partial refund with amount input
  - Reason selection (requested by customer, defective, etc.)
- [x] Create `processRefund(gymId, paymentIntentId, amount, reason)` Cloud Function:
  - Calls Stripe Refunds API
  - **Note**: Application fee is NOT refunded by default (platform keeps fee)
  - Option to refund application fee: `refund_application_fee: true`
- [x] Handle `charge.refunded` webhook:
  - Update order status to `refunded` or `partially_refunded`
  - Log refund details

**[x] 8.2 Subscription Refunds**
- [x] For subscription cancellations with refund:
  - Calculate prorated amount
  - Process refund for unused portion
- [x] Update membership history log

**[x] 8.3 Class Pack Refunds**
- [x] When refunding class pack purchase:
  - Check if credits have been used
  - If credits used < total → Partial refund
  - Deduct credits from member's balance
  - Log to creditLogs: "Refund processed - {X} credits removed"

**[x] 8.4 Dispute Handling (Basic)**
- [x] Handle `charge.dispute.created` webhook:
  - Log dispute to stripeEvents
  - Store dispute in `gyms/{gymId}/disputes` collection
  - Show dispute indicator on order
- [x] Handle `charge.dispute.closed` webhook:
  - Update dispute status (won/lost)
- [ ] (Future) Provide evidence submission UI

**Implementation Details:**

**New Cloud Functions:**
- `processRefund` - Unified refund function supporting orders, subscriptions, and class packs
  - Parameters: `gymId`, `refundType`, `orderId`/`subscriptionId`/`purchaseId`, `amount`, `reason`
  - Handles full and partial refunds
  - Updates order status and logs to stripeEvents

**Webhook Handlers Updated:**
- `charge.refunded` - Updates order status to `refunded` or `partially_refunded`
- `charge.dispute.created` - Creates dispute record, marks order as disputed
- `charge.dispute.closed` - Updates dispute and order status

**New Admin Screen - Orders:**
- `packages/web/src/screens/admin/OrdersScreen/index.jsx` - Main orders management screen
- `packages/web/src/screens/admin/OrdersScreen/OrdersTab.jsx` - Order list with expand/collapse, refund modal
- `packages/web/src/screens/admin/OrdersScreen/DisputesTab.jsx` - Dispute tracking with Stripe Dashboard links

**New API Functions:**
- `packages/shared/api/firestore/orders.js`:
  - `getOrders(gymId, options)` - List orders with filtering
  - `getOrderById(gymId, orderId)` - Get single order
  - `fulfillOrder(gymId, orderId, notes)` - Mark as fulfilled
  - `processOrderRefund(gymId, orderId, amount, reason, refundApplicationFee)`
  - `processSubscriptionRefund(gymId, subscriptionId, prorate, reason)`
  - `processClassPackRefund(gymId, userId, purchaseId, creditsUsed, reason)`
  - `getDisputedOrders(gymId)` - Get orders with disputes
  - `getOrderStats(gymId, startDate, endDate)` - Dashboard statistics

**Files Modified:**
- `functions/index.js` - Added refund/dispute handlers and processRefund function
- `packages/shared/api/firestore/index.js` - Added orders export
- `packages/web/src/App.jsx` - Added OrdersScreen route
- `packages/web/src/layout/AdminLayout.jsx` - Added Orders nav item

---

#### Phase 9: Reporting & Analytics ✅ COMPLETED

**[x] 9.1 Revenue Dashboard Integration**
- [x] Update existing Reports screen with Stripe data:
  - Total revenue (period)
  - Subscription revenue vs one-time purchases
  - Refunds issued
  - Net revenue calculation
- [x] Data source: Aggregate from local order/subscription data with Cloud Function

**[x] 9.2 Subscription Metrics**
- [x] Active subscribers count
- [x] Monthly Recurring Revenue (MRR) calculation
- [x] Churn rate (cancellations / total subscribers)
- [x] Failed payment rate

**[x] 9.3 Shop Metrics**
- [x] Total orders / revenue
- [x] Top selling products (top 5 by revenue)
- [x] Revenue by category (pie chart)
- [x] Order status breakdown (pending, fulfilled, refunded)

**Implementation Details:**

**New Cloud Function:**
- `getRevenueAnalytics(gymId, startDate, endDate)` - Comprehensive analytics aggregation:
  - Revenue: total, shop, subscription MRR, refunds, net
  - Orders: total, pending, fulfilled, refunded
  - Subscriptions: active count, MRR, churn rate, cancelled count, failed payments
  - Shop: top products, revenue by category
  - Disputes: active count, disputed amount
  - Timeline: daily revenue for charts

**New Files Created:**
- `packages/shared/api/firestore/analytics.js` - API functions for analytics
  - `getRevenueAnalytics(gymId, startDate, endDate)`
  - `getQuickStats(gymId)` - Simplified stats for dashboard widgets
- `packages/shared/hooks/useRevenueAnalytics.js` - React hook for analytics
  - `useRevenueAnalytics(gymId, options)` - Fetch and manage analytics state
  - `DATE_RANGES` - Predefined date range options (7 days, 30 days, 90 days, this month, etc.)

**Updated Files:**
- `functions/index.js` - Added `getRevenueAnalytics` Cloud Function
- `packages/shared/api/firestore/index.js` - Added analytics export
- `packages/web/src/screens/admin/DashboardAnalyticsScreen.jsx` - Complete redesign:
  - Key metrics cards row (Net Revenue, MRR, Active Subscribers, Shop Orders, Refunds, Disputes)
  - Date range selector dropdown
  - Revenue timeline chart (daily shop revenue)
  - Member growth chart (6 months)
  - Subscription health panel (churn rate, cancelled, failed payments)
  - Plan distribution bar chart
  - Top selling products list
  - Revenue by category pie chart
  - Demographics pie chart
  - Order status breakdown grid

---

#### Phase 10: UI Polish & Quality of Life (COMPLETE)

**[x] 10.1 Stripe Branding Sync (Gym-Themed Checkout)**

Stripe Connect accounts support custom branding that applies to Checkout pages and Customer Portal. When a gym updates their theme colors, we should sync these to their Stripe account.

**Implementation Plan:**

1. **Create `syncGymBrandingToStripe` Cloud Function:**
   ```javascript
   // Called when gym theme is updated
   exports.syncGymBrandingToStripe = onCall(async (request) => {
     const { gymId } = request.data;

     // Get gym data
     const gymDoc = await db.collection("gyms").doc(gymId).get();
     const { stripeAccountId, theme, logoUrl, name } = gymDoc.data();

     if (!stripeAccountId) return { success: false, error: "No Stripe account" };

     // Update Stripe account branding
     await stripeClient.accounts.update(stripeAccountId, {
       settings: {
         branding: {
           primary_color: theme?.primaryColor || '#2563eb',
           secondary_color: theme?.secondaryColor || '#4f46e5',
           // logo and icon require file uploads to Stripe
         }
       },
       business_profile: {
         name: name
       }
     });

     return { success: true };
   });
   ```

2. **Trigger on Theme Update:**
   - Option A: Add Firestore trigger `onDocumentUpdated("gyms/{gymId}")` that detects theme changes
   - Option B: Call `syncGymBrandingToStripe` from the Settings screen after theme save

3. **Logo Upload (Optional Enhancement):**
   - Stripe requires logos to be uploaded via `stripe.files.create()`
   - Would need to download gym's logo from Firebase Storage, upload to Stripe, then reference in branding
   - Consider: Only sync colors initially, logo sync as future enhancement

4. **Files to Modify:**
   - `functions/index.js` - Add `syncGymBrandingToStripe` function
   - `packages/web/src/screens/admin/settings/BrandingSettingsTab.jsx` - Call sync after save
   - OR add Firestore trigger for automatic sync

**Stripe Branding API Reference:**
```javascript
stripe.accounts.update(accountId, {
  settings: {
    branding: {
      icon: 'file_xxx',           // Square icon (min 128x128px)
      logo: 'file_xxx',           // Full logo
      primary_color: '#2563eb',   // Hex color for buttons, links
      secondary_color: '#4f46e5'  // Hex color for accents
    }
  }
});
```

---

**[x] 10.2 Auto-Clear Payment Links on Tier Changes**

When an admin generates a payment link for a membership tier and later changes the tier's price or details, the existing link becomes stale. We now automatically invalidate it.

**Implementation Plan:**

1. **Add Firestore Trigger for Tier Updates:**
   ```javascript
   exports.onMembershipTierUpdated = onDocumentUpdated(
     "gyms/{gymId}/membershipTiers/{tierId}",
     async (event) => {
       const before = event.data.before.data();
       const after = event.data.after.data();

       // Check if price-affecting fields changed
       const priceChanged = before.price !== after.price;
       const intervalChanged = before.interval !== after.interval;
       const nameChanged = before.name !== after.name;

       if (priceChanged || intervalChanged || nameChanged) {
         // Clear the payment link
         if (after.stripePaymentLink) {
           await event.data.after.ref.update({
             stripePaymentLink: null,
             stripePaymentLinkClearedAt: admin.firestore.FieldValue.serverTimestamp(),
             stripePaymentLinkClearedReason: 'Tier details changed'
           });

           console.log(`Cleared payment link for tier ${event.params.tierId} due to changes`);
         }

         // Optionally: Deactivate the Stripe Price if it exists
         // This prevents the old price from being used
         if (priceChanged && before.stripePriceId) {
           try {
             await stripeClient.prices.update(
               before.stripePriceId,
               { active: false },
               { stripeAccount: gymData.stripeAccountId }
             );
           } catch (e) {
             console.warn("Could not deactivate old price:", e.message);
           }
         }
       }
     }
   );
   ```

2. **UI Indication:**
   - In `RecurringPlansTab.jsx`, show visual indicator when payment link is cleared
   - Add tooltip: "Payment link was cleared because tier details changed. Generate a new one."

3. **Fields to Track:**
   - `stripePaymentLink` - The generated link (existing)
   - `stripePaymentLinkClearedAt` - When it was auto-cleared
   - `stripePaymentLinkClearedReason` - Why it was cleared

4. **Files to Modify:**
   - `functions/index.js` - Add `onMembershipTierUpdated` trigger
   - `packages/web/src/screens/admin/MembershipsScreen/RecurringPlansTab.jsx` - Show cleared state

**Implementation Notes (Completed):**

1. **Phase 10.1 - Branding Sync:**
   - Created `syncGymBrandingToStripe` Cloud Function in `functions/index.js`
   - Uses Stripe Account API to update `settings.branding.primary_color` and `secondary_color`
   - Also updates `business_profile.name` with gym name
   - Added `syncGymBrandingToStripe` API function to `packages/shared/api/firestore/gym.js`
   - Updated `BrandingSettingsTab.jsx` to call sync after theme save
   - Shows success message indicating Stripe sync status

2. **Phase 10.2 - Auto-Clear Payment Links:**
   - Created `onMembershipTierUpdated` Firestore trigger in `functions/index.js`
   - Monitors `gyms/{gymId}/membershipTiers/{tierId}` for changes
   - Detects price, interval, or name changes
   - Clears `stripePaymentLink` and creates new Stripe Price for price changes
   - Updated `RecurringPlansTab.jsx` with visual indicators:
     - Amber warning when payment link needs regeneration
     - Green indicator when payment link is active

---

PHASE 11: Bug Fixes & Webhook Improvements ✅ COMPLETED

### Issues Addressed

**11.1 Membership Not Syncing After Stripe Checkout** ✅
- **Problem**: When users completed membership purchase via store payment link, the membership status wasn't updating in Firestore despite Stripe showing successful payments
- **Root Cause**: Stripe Connect webhooks include connected account events with `event.account` property, but the webhook handler wasn't using this to look up the gym when `gymId` was missing from metadata
- **Fix** (`functions/index.js`):
  - Extract `connectedAccountId` from `event.account` in webhook handler
  - Pass `connectedAccountId` to `handleCheckoutSessionCompleted()`
  - If `gymId` is not in session metadata, look it up from Firestore using `stripeAccountId` field
  - Added detailed logging for debugging webhook events

**11.2 Duplicate Payment Methods Showing** ✅
- **Problem**: Users saw the same card displayed multiple times in their payment methods
- **Root Cause**: No deduplication when listing payment methods from Stripe
- **Fix** (`functions/index.js` in `getPaymentMethods`):
  - Added deduplication logic using card "fingerprint" (brand + last4 + exp_month + exp_year)
  - Uses a Set to track seen cards and skip duplicates
  - Logs when duplicate cards are filtered out

**11.3 Shop Checkout Error with `product_data[images]`** ✅
- **Problem**: Shop product checkout failed with "Received unknown parameter: product_data[images]"
- **Root Cause**: Stripe's inline price_data doesn't support images parameter for all configurations
- **Fix** (`functions/index.js` in `createShopCheckout`):
  - Only include `images` in `product_data` if valid HTTP URLs exist
  - Check that image is a string starting with "http" before including
  - Prevents Stripe API error for products without images or with invalid image URLs

**11.4 Payment Link UI Not Clearing on Billing Changes** ✅
- **Problem**: In the admin member modal, generated payment links remained visible even after changing billing rate or start date
- **Root Cause**: No effect to watch for billing field changes and clear the payment link state
- **Fix** (`packages/web/src/components/admin/MemberFormModal/MemberBillingTab.jsx`):
  - `handlePlanChange()` now clears `paymentLinkUrl` and `paymentLinkError` states
  - Added `useEffect` to watch `customPrice` and `formData.startDate` changes
  - Automatically clears payment link when these values change

---

### Stripe Webhook Configuration

**IMPORTANT**: For the membership sync fix to work, your Stripe webhook must be configured to receive events from connected accounts.

#### Required Webhook Configuration in Stripe Dashboard:

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Select your webhook endpoint (or create one pointing to `https://us-central1-gymdash-4e911.cloudfunctions.net/stripeWebhook`)
3. **CRITICAL**: Enable **"Listen to events on Connected accounts"** checkbox
4. Ensure these events are selected:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `account.updated`

When "Listen to events on Connected accounts" is enabled, Stripe will include the `event.account` property with the connected account ID, allowing the webhook handler to properly route events to the correct gym.

**11.5 Remove "Payment Link Needs Regeneration" Warning from Tier Cards** ✅
- **Problem**: RecurringPlansTab showed a misleading "payment link needs regeneration" amber warning on tier cards whenever `stripePaymentLink` was null but `stripeProductId` existed
- **Why It's Wrong**: Payment links are generated per-member in the MemberFormModal, not per-tier. Changing a tier's price/name doesn't invalidate anything visible on the tier card level. The `onMembershipTierUpdated` trigger already auto-creates a new Stripe Price when the price changes.
- **Fix**:
  - Removed payment link status indicators (amber warning + green active) from `RecurringPlansTab.jsx`
  - Removed `stripePaymentLink` clearing logic from `onMembershipTierUpdated` Cloud Function (kept the auto-create new Price logic)
  - Removed unused `Link` and `AlertTriangle` icon imports

**11.6 Shop Checkout `product_data[images]` Error (Final Fix)** ✅
- **Problem**: Stripe's `prices.create` with inline `product_data` does not reliably support the `images` parameter, causing "Received unknown parameter: product_data[images]" errors
- **Fix**: Removed the `images` parameter from `product_data` entirely in `createShopCheckout`. Product images are not shown on the Stripe Checkout page for inline price data anyway.

**11.7 Stripe Branding Sync Enhancement** ✅
- **Problem**: Gym's theme colors and logo were not appearing on Stripe Checkout and Customer Portal pages
- **Root Cause**: The `syncGymBrandingToStripe` function was only syncing `primary_color` and `secondary_color` but not the gym's logo
- **Fix**: Updated `syncGymBrandingToStripe` to also pass `icon` and `logo` from `gymData.logoUrl` to Stripe's account branding settings
- **Note on Stripe Branding Limitations**: Stripe's account-level branding (`settings.branding`) provides limited control. It sets button/link accent colors and logo on Checkout and Customer Portal pages, but the overall page layout and background remain Stripe's default design. Full custom styling is only possible with Stripe Elements (embedded forms), not with hosted Checkout or Customer Portal pages. To apply branding:
  1. Go to admin **Settings → Branding** and save (this triggers `syncGymBrandingToStripe`)
  2. Verify in Stripe Dashboard → Settings → Branding that your colors and logo appear

#### Files Modified:
- `functions/index.js` - Webhook handler, checkout, payment methods, branding sync, tier update trigger
- `packages/web/src/components/admin/MemberFormModal/MemberBillingTab.jsx` - Payment link UI clearing
- `packages/web/src/screens/admin/MembershipsScreen/RecurringPlansTab.jsx` - Removed payment link status indicators

---

PHASE 12: Saved Payment Methods & Stripe Branding ✅ COMPLETED

### Root Causes Identified

**Saved Payment Methods Not Auto-Filling:**
- `setup_future_usage: "on_session"` was missing from `createClassPackCheckout`, so cards used for class pack purchases were not being saved to the customer for future use
- Subscription checkouts automatically save cards (Stripe requires it for recurring billing)
- Shop checkout already had `setup_future_usage` set
- The same `stripeCustomerId` is used across all checkout types, so once all types save cards, they auto-fill everywhere

**Stripe Branding Not Applying:**
- The app was creating **Standard** Connect accounts (`type: "standard"`)
- Standard accounts are fully controlled by the connected account owner — the platform **cannot** programmatically set branding via `accounts.update()`
- The `settings.branding` fields are only settable for Express and Custom accounts
- Existing Standard accounts cannot be converted to Express via API

### Changes Implemented

**12.1 Add `setup_future_usage` to Class Pack Checkout** ✅
- Added `payment_intent_data: { setup_future_usage: "on_session" }` to `createClassPackCheckout` session config
- Cards used for class pack purchases are now saved to the customer for reuse on all future checkouts

**12.2 Diagnostic Logging for Customer ID Resolution** ✅
- Added `console.log` after customer ID resolution in all 4 checkout functions:
  - `createSubscriptionCheckout`
  - `createAdminCheckoutLink`
  - `createShopCheckout`
  - `createClassPackCheckout`
- Logs: function name, customer ID, user ID, gym ID, and whether customer was existing or newly created
- Check Firebase Functions logs to verify customer resolution is working correctly

**12.3 Switch New Account Creation to Express** ✅
- Changed `type: "standard"` to `type: "express"` in `createStripeAccountLink`
- Added `capabilities: { card_payments: { requested: true }, transfers: { requested: true } }`
- **Only affects NEW gyms** — existing Standard accounts are unchanged
- Onboarding flow (`accountLinks.create` redirect) works identically for Express accounts
- Express accounts allow the platform to programmatically set branding colors and logo

**12.4 Store Account Type in Firestore** ✅
- During account creation: stores `stripeAccountType: "express"` in gym document
- During `verifyStripeAccount`: stores `stripeAccountType: account.type` from Stripe API response
- This backfills existing gyms' account types on their next verification call

**12.5 Account-Type-Aware Branding Sync** ✅
- `syncGymBrandingToStripe` now checks the account type before attempting to set branding
- If account type is unknown, retrieves it from Stripe and stores it in Firestore
- **Standard accounts**: Returns `{ success: false, reason: "standard_account" }` with a message directing the gym owner to configure branding in their own Stripe Dashboard
- **Express/Custom accounts**: Proceeds with `accounts.update()` to set colors and logo, wrapped in try-catch for error handling

**12.6 Updated Branding UI Messaging** ✅
- `BrandingSettingsTab.jsx` now handles the `"standard_account"` response
- Standard account gyms see: "Branding saved! To theme your Stripe checkout pages, visit your Stripe Dashboard → Settings → Branding."
- Express account gyms see: "Branding updated & synced to Stripe checkout!"

### Standard vs Express Account Differences

| Feature | Standard | Express |
|---|---|---|
| Branding via API | Not supported | Supported |
| Onboarding | Redirect to Stripe (full form) | Redirect to Stripe (simplified form) |
| Dashboard | Full Stripe Dashboard | Simplified Express Dashboard |
| Platform control | Limited | Full (branding, fees, etc.) |

### For Existing Standard Account Gyms
- Cannot convert to Express via API — this is a Stripe limitation
- Branding must be configured by the gym owner at: **Stripe Dashboard → Settings → Branding**
- All other features (checkout, saved cards, subscriptions) work identically

#### Files Modified:
- `functions/index.js` - Account creation, verification, all checkout functions, branding sync
- `packages/web/src/screens/admin/settings/BrandingSettingsTab.jsx` - Standard account messaging

### Environment Variables Setup

**Create `.env.example`:**
```bash
# ===========================================
# STRIPE CONFIGURATION
# ===========================================
# Get API keys from: https://dashboard.stripe.com/apikeys

# Secret key (NEVER expose to frontend)
STRIPE_SECRET_KEY=sk_test_xxx

# Publishable key (safe for frontend)
STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Webhook signing secret
# Get this when creating webhook endpoint in Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_xxx

# ===========================================
# APPLICATION SETTINGS
# ===========================================

# Default application fee percentage (can be overridden per gym)
STRIPE_APPLICATION_FEE_PERCENT=1.0
```

**Current Implementation (Already Deployed):**

The Stripe secret key is already deployed to Firebase Cloud Functions using the `defineString` params:

```javascript
// In functions/index.js
const { defineString } = require("firebase-functions/params");
const stripeSecret = defineString("STRIPE_SECRET_KEY");

// Used as:
const stripeClient = stripe(stripeSecret.value());
```

To set/update the secret:
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# Then paste your sk_test_xxx or sk_live_xxx key
```

**Security Notes:**
- [x] `STRIPE_SECRET_KEY` is deployed via Firebase Functions params (secure)
- [ ] Add `STRIPE_WEBHOOK_SECRET` via Firebase Functions params
- [ ] Document secret rotation procedure
- [ ] Set up separate keys for test vs production environments

---

### Database Schema Additions Summary

**Gym Document Updates:**
```javascript
gyms/{gymId} {
  // Stripe Connect
  stripeAccountId: string | null,
  stripeAccountStatus: 'pending' | 'active' | 'restricted' | 'not_connected',
  stripeOnboardingComplete: boolean,
}

gyms/{gymId}/settings/billing {
  gracePeriodDays: number,           // Default: 3
  suspendAfterFailedPayments: number, // Default: 1
  notifyOnFailure: boolean,
  notifyDaysBeforeRenewal: number[],
}

gyms/{gymId}/settings/stripe {
  applicationFeePercent: number,     // Default: 1.0
}
```

**New Collections:**
```javascript
gyms/{gymId}/orders/{orderId} { /* shop orders */ }
gyms/{gymId}/coupons/{couponId} { /* promo codes */ }
gyms/{gymId}/stripeEvents/{eventId} { /* webhook audit log */ }
```

**Updated Collections:**
```javascript
gyms/{gymId}/membershipTiers/{tierId} {
  stripeProductId, stripePriceId, stripePriceIdYearly
}

gyms/{gymId}/products/{productId} {
  stripeProductId,
  variants: [{ stripePriceId }]
}

gyms/{gymId}/classPacks/{packId} {
  stripeProductId, stripePriceId
}

users/{userId}/memberships/{gymId} {
  stripeSubscriptionId, stripeCustomerId,
  currentPeriodStart, currentPeriodEnd,
  cancelAtPeriodEnd, lastPaymentFailedAt
}
```

---

### Security Checklist

- [ ] **Never store full card numbers** - Use Stripe tokenization
- [ ] **Verify webhook signatures** - Prevent spoofed events
- [ ] **Use idempotency keys** - Prevent duplicate charges
- [ ] **Validate amounts server-side** - Never trust client-sent prices
- [ ] **Scope API calls** - Use `stripeAccount` header for connected accounts
- [ ] **Audit log financial operations** - Required for compliance
- [ ] **PCI DSS** - Stripe Checkout handles this; document compliance

---

### Testing Strategy

1. **Use Stripe Test Mode** throughout development (`sk_test_` keys)
2. **Test Cards:**
   - `4242424242424242` - Successful payment
   - `4000000000000341` - Attach fails
   - `4000000000009995` - Insufficient funds
   - `4000002500003155` - Requires 3D Secure
3. **Webhook Testing:**
   - Use Stripe CLI: `stripe listen --forward-to localhost:5001/gym-dash/us-central1/stripeWebhook`
   - Test each webhook event type
4. **Test Connect:**
   - Create test connected accounts in Stripe Dashboard
   - Test onboarding flow end-to-end

---

### Files to Create

**Shared API Layer:**
- `packages/shared/api/stripe/config.js` - Stripe initialization
- `packages/shared/api/stripe/connect.js` - Connect account functions
- `packages/shared/api/stripe/checkout.js` - Checkout session creation
- `packages/shared/api/stripe/subscriptions.js` - Subscription management
- `packages/shared/api/stripe/customers.js` - Customer management
- `packages/shared/api/stripe/products.js` - Product/price sync helpers
- `packages/shared/api/stripe/coupons.js` - Coupon management
- `packages/shared/api/stripe/refunds.js` - Refund processing

**Cloud Functions:**
- `firebase/functions/src/stripe/connect.js` - OAuth handlers
- `firebase/functions/src/stripe/checkout.js` - Checkout session endpoints
- `firebase/functions/src/stripe/webhooks.js` - Webhook handler
- `firebase/functions/src/stripe/portal.js` - Customer portal sessions

**Admin UI:**
- `packages/web/src/screens/admin/settings/BillingSettingsTab.jsx` - Connect UI
- `packages/web/src/screens/admin/CouponsScreen/` - Coupon management
- `packages/web/src/screens/admin/OrdersScreen/` - Order management

**Member UI:**
- `packages/web/src/screens/members/MembershipPlansScreen.jsx` - Subscription selection
- `packages/web/src/screens/members/ClassPacksScreen.jsx` - Class pack purchase
- `packages/web/src/components/members/MemberBillingTab.jsx` - Payment methods display
- `packages/web/src/components/checkout/CheckoutButton.jsx` - Reusable checkout trigger

---

### Implementation Priority Order

1. **Sprint 1**: Phase 1 (Connect + Webhooks) + Phase 2 (Product Sync)
2. **Sprint 2**: Phase 3 (Subscriptions) + Phase 4 (One-Time Purchases)
3. **Sprint 3**: Phase 5 (Lifecycle) + Phase 6 (Portal)
4. **Sprint 4**: Phase 7 (Coupons) + Phase 8 (Refunds)
5. **Sprint 5**: Phase 9 (Reporting) + Testing + Polish

---

🔵 P3: Marketing & Broadcasts (Phase 9)
Tools to help gyms grow.

[ ] Broadcast Center:

Integration: Set up Twilio (SMS) and SendGrid/Resend (Email).

UI: Create a "Compose Message" screen with audience selectors (All Active Members, Leads, Inactive).

[ ] Reports Screen Update:

Action: Update charts to reflect real revenue (once Stripe is linked) and granular attendance stats.

🟣 P4: Architectural Planning (Requires Thinking before Coding)
These are the "Big Questions" you noted. Do not code these until the logic is mapped out.

[ ] Multi-Location / Admin Switcher:

Decision Needed: Do combined gyms share a single database of members, or are they distinct "Silos" that a Super-Admin can toggle between?

Recommendation: Start with "Toggle." An Admin has an array of manageableGymIds. They select a gym from a dropdown, and the app context switches entirely to that Gym ID. Merging databases is extremely complex.

[ ] Staff Implementation (RBAC):

Decision Needed: How to handle payroll?

Recommendation: Start simple.

Invite Flow: Admin sends email -> Link to Signup -> User created with role: 'coach'.

Hours: Simple "Clock In/Out" button on Coach Dashboard.

W2/Payroll: Do not build a payroll engine. Integrate with a dedicated provider (like Gusto embedded) or simply export CSV hours for the owner to pay manually. Building a tax-compliant payroll system is a startup in itself.

[ ] Pricing Model Strategy:

Action: Finalize if you are strictly taking 1% of transactions, or if there is a SaaS subscription fee for the gym owner as well.

⚪ General Optimization
[ ] Reduce Complexity:

Audit: Go through screens. Can the "Community" and "Broadcast" be merged? Can "Members" and "Leads" be the same table with a filter?

[ ] Onboarding Verification:

Action: Run through the full "New Gym Owner" flow and "New Member" flow. Ensure no data is missing (specifically waivers and emergency contacts).