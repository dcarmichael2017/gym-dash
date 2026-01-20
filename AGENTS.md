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

[ ] Stripe Connect Integration:

Action: Complete the onboarding flow where Gym Owners connect their Stripe accounts to your platform so you can take the 1% application fee. This includes the stripe integration for subscriptions, coupons, discounts, refunds, etc.

[ ] Payment Methods:

Action: Allow members to save cards on file.

Complexity: Support "Global" cards (user wallet) vs "Gym-Specific" cards if a user belongs to multiple gyms (Security/Privacy compliance required).

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