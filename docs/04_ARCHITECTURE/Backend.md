# Backend

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-006

---

## Purpose

Define backend boundaries for the future EcoWash MVP without implementing backend code.

---

## Contents

## Backend Direction

Supabase remains the candidate backend for:

- Auth
- PostgreSQL
- Storage
- Row Level Security

APP-003 adds versioned local Supabase configuration, the first tenant-foundation migration and Supabase client factories for browser and server code.

Installed dependencies:

- `@supabase/supabase-js`
- `@supabase/ssr`

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The anon key may be used by browser/server clients only with RLS enabled. The service-role key remains server-only and is not required by APP-003 client code.

## Initial Backend Responsibilities

- Authenticate users.
- Resolve profile and organization membership.
- Enforce tenant boundary through RLS and server-side checks.
- Store normalized operational records.
- Store private order photos with ownership checks.
- Record audit events for sensitive actions.

Implemented in APP-003:

- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/env.ts`
- `supabase/config.toml`
- initial migration for `organizations`, `locations`, `profiles` and `organization_memberships`

Implemented in APP-004:

- Supabase SSR session refresh in the existing Next.js proxy middleware
- email/password login using a Server Action
- server-side logout
- current user, profile and active membership loaders
- server-side role guards for `owner`, `manager` and `staff`
- protected dashboard route foundation under `/[locale]/app`
- access-denied route for authenticated users without operational access

Implemented in APP-005:

- versioned migration for `customers` and `properties`
- customer and property CRUD through Server Actions
- server-side validation without adding new dependencies
- tenant context derived from the authenticated membership, not from form input
- customer search and active/inactive filtering
- customer detail with linked properties
- property detail and edit routes
- logical deactivation for customers and properties

Implemented in APP-006:

- migration for services, standard prices, orders, order items and status history
- RPCs for atomic order creation, item mutation, discount update and status transition
- service catalog management for owner/manager
- read-only service catalog access for staff
- protected order CRUD and production workflow UI

## Server Boundary

Future Next.js server actions or API routes may be used for operations that require extra validation beyond direct RLS-protected data access, especially:

- membership and role changes
- price changes
- production status corrections
- payment recording and voiding
- signed URL creation
- audit log writes

APP-004 uses Server Actions for login/logout. APP-005 uses Server Actions for customer and property mutations. Neither exposes Supabase tokens or service-role credentials to the browser.

The client must never receive service-role credentials.

## Not In MVP Backend

- Realtime
- Edge Functions unless a verified need appears
- Online payment providers
- OCR or Google Vision
- Push notifications
- PDF/fiscal invoice generation
- Customer portal backend
- Native mobile backend assumptions

Also not implemented in APP-003:

- login UI
- signup UI
- reset password
- customers, properties, services, orders or payments
- operational Storage buckets

Also not implemented in APP-005:

- services
- orders
- order items
- prices
- payments
- photos or operational Storage buckets
- pickup/delivery workflows
- customer portal access

Also not implemented in APP-006:

- pickup/delivery
- payments
- photos and operational Storage buckets
- OCR, PDF, Realtime and Edge Functions

## Data Ownership Boundary

Operational records are accessed through organization membership. Staff access may be further limited by assignment in application logic or future RLS policy where practical.
