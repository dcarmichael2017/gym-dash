# GymDash AI Agent Guidelines (AGENTS.md)

## 1. Project Overview
GymDash is a multi-tenant SaaS for Martial Arts academies.
- **Architecture:** Monorepo (NPM Workspaces).
- **Frontend:** React (Vite) in `packages/web`, React Native (Expo) in `packages/app`.
- **Backend:** Firebase (Firestore, Cloud Functions). Shared logic in `packages/shared`.

## 2. Directory Structure & Responsibilities
- **`packages/shared/`**: "The Brains." Shared logic.
    - **`api/firestore/`**: Breakdown of DB operations (`bookings.js`, `members.js`, `classes.js`).
    - **`hooks/useGymStats.js`**: Analytics logic.
- **`packages/web/src/`**: The Web Dashboard.
    - **`components/admin/`**: Admin-facing UI (Modals, Tables).
    - **`screens/members/`**: Student-facing UI (Profile, Schedule, Store).
    - **`context/`**: Global state (`GymContext`, `AuthContext`).

## 3. Critical Business Logic (DO NOT BREAK)
1.  **Attendance Counting:**
    - "Attended" means `status === 'attended'`.
    - "Booked" is future tense. Do not count as a completed class.
    - "No-Show" or "Cancelled" must NOT count toward rank progression.
2.  **Billing Integrity:** - Transactions must explicitly track `bookingType`.
    - Never delete an active member; use `status: 'archived'`.
3.  **Strict File Separation:**
    - Do NOT write raw Firestore queries inside React Components (`.jsx`).
    - Create a function in `packages/shared/api/firestore/` and import it.

## 4. Coding Standards
- **Styling:** Tailwind CSS.
- **Icons:** Use `lucide-react` or the existing icon library found in `components/ui`.
- **Mobile First:** Member screens (`screens/members`) must be touch-friendly.

## 5. Current Task Context (Sprint 7)
We are currently building the "Member Portal" and "Attendance Visibility".
- Focus on displaying data clearly to both Admins and Members.
- Attendance history should be read-only for Members.
- Admins need to see tallies to judge readiness for belt promotions.