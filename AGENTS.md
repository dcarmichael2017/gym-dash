GymDash AI Agent Guidelines & Context

Role: You are a Senior Full-Stack Engineer specializing in React (Vite), Firebase (Firestore/Functions), and SaaS Architecture.
Goal: Produce production-ready, clean code that adheres to the "Monorepo" structure and "Multi-Role" security model.

1. Core Architecture & Mental Model

GymDash is a multi-tenant SaaS. All data is scoped by gymId.

The "Brain" (packages/shared): Logic lives here. If a function calculates a stat or transforms data, it belongs here, not in the UI component.

The "Face" (packages/web): Dumb UI. It receives data via hooks and renders.

The "Bridge" (Firestore Hooks): We prefer onSnapshot listeners for "live" dashboards (Schedule, Member List) and getDoc for static forms (Edit Profile).

2. Critical Rules (The "Do Not Break" List)

Strict Billing Source of Truth:

Never infer a member's eligibility from the frontend alone.

Always sync with users/{userId}.memberships or users/{userId}.classCredits.

Known Issue: Admin updates to billing must reflect instantly in the Member view. Ensure cached data is invalidated or listeners are active.

Guardian/Minor Protection:

A "Dependent" profile (linked via familyId) CANNOT sign their own waivers. Logic must check for headOfHousehold.

Atomic Transactions:

Any action involving money or capacity (booking a spot, buying a pack) MUST be a Firestore Transaction.

NEVER write to class.attendees without a transaction block.

3. Coding Standards & Patterns

Data Fetching

Hooks: Use custom hooks (e.g., useGymStats, useMemberProfile) to abstract Firestore logic.

Loading States: Always handle loading and error states. Never render a blank screen while fetching.

Undefined Safety: Firestore is schemaless. Always default values:

// BAD
const credits = user.classCredits;
// GOOD
const credits = user.classCredits || 0;


UI/UX (Tailwind + Lucide)

Mobile First: We are a mobile-heavy app. Always verify layouts with md:flex-row or hidden md:block.

Modals: Use the global Modal component. Ensure onClose cleans up state to prevent "zombie" data when reopening.

Alerts: NEVER use window.alert(). Use useConfirm() from ConfirmationContext.

4. Operational Workflows

Commit Messages: Use Conventional Commits (feat:, fix:, refactor:, docs:).

Refactoring: If you change a shared function in packages/shared, YOU MUST check packages/app (Mobile) and packages/web (Web) for breaking changes.

5. Known Technical Debt (Handle with Care)

Billing Sync: The MemberBillingTab sometimes desyncs from the actual Firestore state. Prefer real-time listeners over one-time fetches here.

Ghost Classes: Classes with recurrenceEndDate are "Archived." Do not delete them; filter them out of future queries.

6. Directory Map

packages/shared/api/firestore/*.js: Single Source of Truth for DB writes.

packages/web/src/layouts: Contains AdminLayout (Sidebar) and MemberLayout (Bottom Nav).

packages/web/src/context: Global state. GymContext controls the current gym view.

7. Next Action Plan: Moving to Subcollection Architecture

The Goal

We are moving user memberships from a simple Array inside the user document (which causes permission issues for multi-gym admins) to a Subcollection named memberships.

Old Structure: users/{uid} -> field memberships: [{gymId: "A", status: "active"}]
New Structure: users/{uid}/memberships/{gymId} -> Document { status: "active", ... }

This allows us to write security rules that say: "If you are the owner of Gym A, you can only touch the document inside memberships/GymA."

Part 1: Complete Updated Firestore Rules

Replace your entire firestore.rules file with this.
Key Changes:

Added match /memberships/{gymId} subcollection rule.

Fixed membershipHistory to check resource.data.gymId instead of the user profile.

Kept managesUser for legacy/other subcollections (like creditLogs) for now, but the new architecture relies on isStaffOrOwner.

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
       // Ensure user exists, has the role, AND belongs to the gym
       return user != null && user.gymId == gymId && (user.role == 'owner' || user.role == 'staff' || user.role == 'coach');
    }

    // Helper: Check if the requester manages the target user's gym
    // (Legacy helper for creditLogs - checks if targetUser.gymId matches requester.gymId)
    function managesUser(targetUserData) {
        let requester = getRequesterData();
        return targetUserData.gymId == requester.gymId && 
               (requester.role == 'owner' || requester.role == 'staff' || requester.role == 'coach');
    }

    // --- USERS COLLECTION ---
    match /users/{userId} {
      allow create: if request.auth != null;
      
      // BASE USER PROFILE
      // 1. User can read/write own profile
      // 2. Staff can read basic profile if they manage the user (via old gymId logic)
      allow read, update, delete: if request.auth != null && (
        request.auth.uid == userId || 
        managesUser(resource.data)
      );

      // --- [NEW] MEMBERSHIPS SUBCOLLECTION ---
      // Path: /users/{userId}/memberships/{gymId}
      // This solves the "Admin Cancel" permission issue.
      match /memberships/{gymId} {
         // 1. User can read their own memberships
         allow read: if request.auth.uid == userId;

         // 2. Admin can Read/Write/Update ONLY the document matching their Gym ID
         // We use the {gymId} wildcard from the path to verify permission.
         allow read, write: if request.auth != null && isStaffOrOwner(gymId);
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
        // 1. User can read their own history
        allow read: if request.auth.uid == userId;

        // 2. Admin can READ if the LOG belongs to their gym
        // FIX: Check resource.data.gymId (the log's gym) instead of user's current gym
        allow read: if request.auth != null && isStaffOrOwner(resource.data.gymId);

        // 3. Admin can CREATE if they are tagging the log with their gym
        allow create: if request.auth != null && isStaffOrOwner(request.resource.data.gymId);
      }
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

          // Allow Booking if I am assigning myself
          allow create: if request.auth != null 
                        && request.resource.data.memberId == request.auth.uid;
                        
          // Allow Cancelling (only my own doc) OR Staff Override
          allow update: if request.auth != null && (
             resource.data.memberId == request.auth.uid ||
             isStaffOrOwner(gymId)
          );
      }
      
      // Membership Tiers
      match /membershipTiers/{tierId} {
        allow read: if request.auth != null;
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


Part 2: Implementation Phases

Since you are using test data, perform these steps in order.

Phase 1: Clean Slate

Go to your Firestore Console.

Delete the users collection.

Delete the gyms collection.

This ensures no old "Array-based" data conflicts with your new code.

Phase 2: Update "Join/Add Member" Logic

Location: Your API file where you handle addMember or joinGym.

What to change:
Stop updating the memberships array on the user document. Instead, write a new document to the subcollection.

// BEFORE (Don't do this anymore)
// await updateDoc(userRef, {
//    memberships: arrayUnion({ gymId: gymId, status: 'active' })
// });

// AFTER (Do this)
const membershipRef = doc(db, 'users', userId, 'memberships', gymId);

await setDoc(membershipRef, {
    status: 'active',
    gymId: gymId, // Store ID inside doc too for easier querying
    joinedAt: new Date(),
    // ... other fields like price, tierId
});

// OPTIONAL: Update a summary field on the parent user doc for searching
// await updateDoc(userRef, { [`gymIds.${gymId}`]: true }); 


Phase 3: Update "Cancel Membership" Logic

Location: Your API file for cancelMembership.

What to change:
Stop trying to read the user, find the index in the array, and splice it. Just target the subcollection document directly.

// AFTER
export const cancelUserMembership = async (userId, gymId) => {
    // Direct path to the specific membership card
    const membershipRef = doc(db, 'users', userId, 'memberships', gymId);
    
    // Simple update
    await updateDoc(membershipRef, { 
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
    });
};


Phase 4: Update Frontend (Read Logic)

Location: MemberBillingTab.js or wherever you show membership status.

What to change:
Do not rely on user.memberships.find(...). The data is no longer on the user object. You must set up a listener for the subcollection.

// Inside your component
useEffect(() => {
    if (!userId || !gymId) return;

    // Listen to the specific subcollection path
    const memRef = doc(db, 'users', userId, 'memberships', gymId);
    
    const unsub = onSnapshot(memRef, (snap) => {
        if (snap.exists()) {
            setMembershipData(snap.data()); // This is your active membership
        } else {
            setMembershipData(null); // Not a member
        }
    });

    return () => unsub();
}, [userId, gymId]);
