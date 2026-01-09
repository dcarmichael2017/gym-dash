# GymDash AI Agent Guidelines (AGENTS.md)

## 1. Project Overview
GymDash is a multi-tenant SaaS for Martial Arts academies.
- **Architecture:** Monorepo (NPM Workspaces).
- **Frontend:** React (Vite) in `packages/web`, React Native (Expo) in `packages/app`.
- **Backend:** Firebase (Firestore, Cloud Functions). Shared logic in `packages/shared`.

## 2. Directory Structure & Responsibilities
- **`packages/shared/`**: "The Brains." Shared logic.
    - **`api/firestore/`**: Database operations (bookings.js, members.js, classes.js).
    - **`hooks/useGymStats.js`**: Analytics & Rank math.
- **`packages/web/src/`**: The Web Dashboard.
    - **`components/admin/`**: Admin-facing UI (Modals, Tables).
    - **`screens/members/`**: Student-facing UI (Dashboard, Profile, Schedule).
    - **`context/`**: Global state (GymContext, AuthContext, ConfirmationContext).

## 3. Critical Business Logic (DO NOT BREAK)
1. **Attendance & Ranking:**
    - "Attended" = `status === 'attended'`. Only this status counts toward rank progression.
    - "Distance to Next Rank" is calculated cumulatively using `gym.grading.programs`.
2. **Billing & Source of Funds:**
    - Every booking MUST track `bookingType` (membership, credit, dropin, or admin_comp).
    - Credit refunds must be atomic and logged in `creditLogs`.
3. **Ghosting & Lifecycle:**
    - Never "Hard Delete" a class with bookings. Use `visibility: 'admin'` and `recurrenceEndDate`.
    - Stop schedule generation loops immediately after `recurrenceEndDate`.

## 4. UI & Safety Protocols
- **No Browser Popups:** Never use `window.confirm()`. Use `ConfirmationContext`.
- **Active Session Immunity:** Classes currently in progress (Time now is between Start/End time) must be Read-Only in the Admin UI.
- **Data Safety:** Always provide fallbacks for Firestore snapshots (e.g., `lateBookingMinutes || 0`) to prevent transaction crashes on `undefined` values.

## 5. Coding Standards
- **Style:** Tailwind CSS + Lucide Icons.
- **Modularity:** No raw Firestore queries in JSX. Use the shared API in `packages/shared/api/firestore/`.
- **Mobile First:** Member dashboard must be touch-optimized with high-visibility progress indicators.