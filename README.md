# GymDash Monorepo
GymDash Project Documentation (v0.8)

Date: January 8, 2026
Current Phase: Sprint 7 - Member Portal & Store Foundation
Status: Operational / Pre-Beta Hardening
Pricing Model: 1% Transaction-Based Fee (Square/Stripe + 1%)

1. Executive Summary

GymDash is a multi-tenant SaaS platform tailored for Martial Arts academies. It provides gym owners with a robust administrative suite while automatically generating a personalized mobile experience for students. The platform utilizes a stable Monorepo structure (NPM Workspaces) and a Multi-Role Monolith architecture. By operating on a performance-based 1% fee, GymDash minimizes entry barriers for new gyms while providing enterprise-grade features like family billing graphs and relative rank progression. To ensure sustainability, the app implements a Revenue Integrity Framework that throttles resources for high-scale gyms that bypass the payment gateway.

2. Project Structure & Key Infrastructure

A. Monorepo Architecture (NPM Workspaces)

packages/shared/ (The Brains): Centralized logic ensuring consistency between Admin and Member triggers.

api/firebaseConfig.js: Centralized Firebase initialization.

api/firestore.js: Core data layer containing transactional operations (e.g., bookMember, processWaitlist, verifyClassEligibility).

hooks/useGymStats.js: Smart Data Hook that calculates real-time and historical analytics via client-side event processing.

packages/web/ (The Unified Face): A single React application utilizing Role-Based Routing to direct users to /admin or /members based on Firestore roles.

layouts/AdminLayout.jsx: Desktop-first sidebar shell.

layouts/MemberLayout.jsx: Mobile-first shell with fixed bottom navigation and deep-linking capabilities.

B. Data & Analytics Architecture (Hybrid Strategy)

To support historical reporting in NoSQL, we utilize a dual-pronged approach:

State History (Daily Snapshots): A scheduled Cloud Function ("The Nightly Cron") captures totalActive, totalMRR, and totalCheckins at 11:59 PM.

Event History (Timestamps): Specific lifecycle events are stamped on user documents (createdAt, convertedAt for trialing-to-active, canceledAt with churnReason).

3. Completed Implementation Details (Production Ready)

A. Authentication & Onboarding

The Wizard (Steps 1-6): A comprehensive setup path capturing Branding, Staff, and Class creation with a real-time mobile app preview.

Resume Logic: Full support for users to exit and resume the onboarding flow without data loss.

Sprint 7.7 Hardening: Implemented strict name splitting (First/Last) and mandatory Emergency Contact collection during onboarding to meet insurance requirements.

RBAC Security: Hardened Firestore Security Rules. Business data is restricted to Owners/Staff; User privacy is enforced by limiting profile edits to the individual user.

B. Member Management & Family Logic

Modular Profile Architecture: Refactored MemberFormModal into a modular tabbed interface (Profile, Progression, Membership, Family, History) to support complex data editing.

Gym Switching & Sticky Sessions: Implemented a bottom-sheet UI for users belonging to multiple gyms. The app remembers the lastActiveGymId to maintain context across reloads.

Family Graph Logic:

Hot-Swap: Ability to search and link existing profiles as dependents without losing history.

Grandparent Chain Protection: Prevents dependents from having their own dependents.

Cascade Protection: Blocks deletion of a "Head of Household" if active dependents exist.

C. Ranking & Progression System

Relative Counting Logic: Ranks are defined by attendance requirements (e.g., "Classes per Stripe").

Auto-Baselining: A smart math engine that calculates rankCredits automatically when an admin promotes a member manually.

Data Integrity: Safeguards prevent higher ranks from having lower attendance requirements than previous ones.

D. Booking & Waitlist Architecture

Transactional Integrity: bookMember runs inside a Firestore Transaction to prevent overbooking.

FIFO Waitlist: Automation promotes the oldest waitlisted user automatically when a spot opens.

Smart Dashboard: The member home screen now aggregates upcoming bookings, credit balances, and announcements into a single view.

Deep Linking: Implemented routing logic to handle deep links for Store items and Dashboard actions, improving navigation flow from external notifications.

4. Current Phase: Sprint 7 (The Member Portal & Store)

Transitioning from "Admin Utility" to "Student Brand Experience."

7.6 Gym Switcher (Complete): Bottom-sheet UI with "Sticky Sessions". Shadow Record strategy preserves attendance data across multi-gym accounts.

7.7 User Onboarding Enrichment (Complete): Interstitial forms for new users to collect Name, Phone, and Emergency Contacts.

7.8 Store Foundation (Complete): Implemented the Member Store UI. Unifies Digital Goods (Memberships/Credits) and Physical Goods (Gear) into a single cart experience.

7.9 Billing & Access Logic (In Progress):

Zero-Dollar Gatekeeper: Refined canUserBook logic to support multi-tier access: Subscription > Class Credits > Drop-In.

Credit Logic: Backend logic now checks user.classCredits > 0 if no active subscription exists.

Drop-In Fallback: Users are prompted for payment only if Subscription and Credit checks fail.

7.10 Attendance Visibility: Implementing per-member class tallies visible to users (History tab).

7.11 Revenue Integrity:

The Scale Switch: Tracking "Active Roster Size".

Validation Mode: At 26+ members, Admin UI prompts for Stripe "Soft-Connect".

5. The Competitive Roadmap (Planned Sprints)

Phase 8: Data Migration & POS

One-Click User Import: Tooling to import existing member data from ZenPlanner, Gymdesk, or CSV files.

One-Tap Pro-Shop: Mobile inventory store using cards on file with Sales Tax Automation.

Guest Checkout: Flow for admins to charge non-profile users for drop-ins or gear via Cash/Card.

Phase 8.1: The Native Store & Inventory (MVP)

Data Strategy: Polymorphic "Product" types (Membership/Pack vs. Physical).

Inventory & Variant Architecture: Simple Variant Array for tracking SKU stock levels (e.g., Size/Color).

Cart Experience: Context-based persistence and "Pick-Up Only" logistics for MVP.

Phase 9: Marketing, Growth & CRM

Marketing Broadcast Center: Dashboard for mass SMS (Twilio) and Email (SendGrid).

Referral Tracking System: Digital "Invite" feature with source-tracking.

Automated Instant Hook: Triggered SMS to new leads for immediate trial booking.

Phase 10: Community & Communication

Managed Community Chat: In-app group chats with automated data-purging.

Ghost Gyms Logic: 48-hour rolling window auto-delete for inactive trial gyms to conserve storage.

Sparring/Roll Log: Digital journal for members to record rounds.

6. Technical Debt & UI Refinements

Task

Priority

Status

Implementation Detail

Emergency Contacts

Critical

Done

Integrated mandatory fields in Profile Tab and Onboarding (Sprint 7.7).

Gym Switcher

Critical

Done

Implemented sticky sessions and multi-gym support (Sprint 7.6).

Guardian Waivers

Critical

Pending

Implement legal flow for parents to sign for minor dependents.

Batch Cancellation

Critical

Pending

Build batch logic for cancelling entire class sessions with automated refunds/notifications.

Active Class Locking

High

Pending

Make "Active/Ongoing" classes read-only in settings to prevent data corruption; allow editing of future series only.

Credit Transaction (Add)

High

Pending

Create backend listener to atomically increment user.classCredits on Pack purchase.

Credit Spending Gate

High

Pending

Update bookMember transaction to decrement credits if subscription inactive.

Physical Inventory Lock

High

Pending

Firestore Transaction for checkout to prevent overselling stock.

Cancellation Refunds

Medium

Pending

If user cancels a credit-booked class within window, auto-refund the credit.

Revenue Governor UI

Medium

Pending

Build "Limited Mode" banner for Ghost Gyms (50+ members/$0 Rev).

Recent Edge Cases Identified

Membership Expiry After Booking:

Scenario: User books Friday class on Monday. Subscription fails Wednesday.

Solution: Backend listener (Stripe Webhook) needed to query and mass-cancel future bookings upon subscription failure. Temporary fix: Front Desk "Check-In" validation.

Class Cancellation Logic:

Scenario: Admin cancels a specific class event (e.g., sick coach).

Requirement: Needs a batch operation to find all bookings for that ID, refund credits/drop-in fees, and trigger push notifications.