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