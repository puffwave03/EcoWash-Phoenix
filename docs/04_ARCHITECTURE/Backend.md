# Backend

Status: Current technical boundary summary

Reconciled: 2026-11-05; repository checkpoint `d91dc9faba0f040055176a853afad3527f3a0813`.

## Implemented backend

Supabase Auth, PostgreSQL, private Storage and RLS are implemented, not candidate infrastructure. Versioned migrations define the schema; [Entities](../02_DOMAIN/Entities.md) and [Database Design](../03_DATABASE/Database_Design.md) index the verified model. The APP-era exclusions preserved below describe their dates, not today's missing modules.

- **Server and tenant context:** Next.js Server Components, Server Actions and existing RPCs perform reads/mutations under authenticated context. [SSR server client](../../src/lib/supabase/server.ts) uses request cookies; [membership guard](../../src/lib/auth/require-membership.ts) resolves access server-side. Client organization IDs are not authorization. Role, capability, assignment, entitlement, RPC and RLS controls remain distinct; route/UI denial alone does not prove table denial.
- **Portal:** implemented separately from staff membership through customer associations and canonical Portal context. [Portal readers](../../src/features/portal/server/queries.ts) expose customer-scoped data; staff/internal RPCs and unrestricted order records are not a substitute. Existing multi-context isolation and organization-state guards remain authoritative.
- **Orders and operations:** implemented catalog/pricing, commercial order snapshots, production history, inbound pickup, outbound delivery, customer handoff and order-level warehouse custody. Receipt, readiness, final fulfillment and payment are separate events; reuse existing transactional boundaries rather than inventing a second model. See [Business Rules](../02_DOMAIN/Business_Rules.md).
- **POS and financial facts:** `payments` is canonical; separate refund rows retain source links. POS payment/refund requires the established open-session/channel/access checks; Owner/Manager manual-external payment/refund has a separate sessionless boundary. Accounting and Daily Close use existing facts/snapshots; invoices and REC do not replace payments. Legacy `void_payment` / `refund_payment` must not be re-enabled.
- **Billing and documents:** ordinary/simplified Billing paths, issued snapshots, numbering, advance declarations and bounded final reconciliation exist. Billing remains the fiscal-document source; EW copies/tickets/labels are operational. Ordinary REC issuance was removed from Terminal/Order UI and ordinary receipt GET, while history/reprint and backend action/RPC remain. Printing is not emission or payment recording. [Billing Event Contract](Billing_Event_Contract_001.md) C1–C4 and actual D01–D11 states remain open where recorded; no full fiscal conformity or external fiscal-adapter approval follows.
- **Online payments:** provider-neutral attempts, event handling and canonical settlement foundations exist. The [provider factory](../../src/features/online-payments/providers/index.ts) supplies only a test adapter restricted to test mode or an unconfigured adapter. A real configured production provider is not established; this is neither an absent integration foundation nor a completed live checkout rollout.
- **Storage and credentials:** order-photo metadata and private Storage are implemented, with existing signed-URL and customer-safe visibility/context checks. Storage paths are not access permission. Browser/server user clients use public Supabase configuration under RLS; privileged credentials must stay server-only and must not be supplied to agents as a shortcut. See [Security](Security.md) and [Setup](../05_DEVELOPMENT/Setup.md).

## Acceptance and remaining gates

Implementation is not universal UAT or Production Readiness. [Project Status](../06_ROADMAP/Project_Status.md) and [Testing](../05_DEVELOPMENT/Testing.md) retain scenario-specific evidence. F03 intra-tenant read visibility remains deferred for reassessment before SaaS release; Auth/DR and other security/recovery gates remain. Physical printing and fiscal/rectification decisions are not closed by backend existence. No new provider, permission, migration or fiscal rule is authorized here.

## Historical original — 2026-07-28

The complete original below is preserved verbatim. Its APP-era exclusions, bootstrap state and next-task instructions are dated evidence, superseded only within the scopes clarified above. They do not authorize current execution.

<details>
<summary>Original 2026-07-28 guide — historical reference</summary>

# Backend

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-007

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

Implemented in APP-007 and pending review:

- migration for pickup, delivery, payment and order photo metadata tables
- private `order-media` Storage bucket and tenant-scoped Storage policies
- RPCs for logistics save/transition, payment record/void/refund and photo metadata registration/deactivation
- read-only derived payment summary from order total and valid payment records
- order detail integration for logistics, payments and photos

## Server Boundary

Future Next.js server actions or API routes may be used for operations that require extra validation beyond direct RLS-protected data access, especially:

- membership and role changes
- price changes
- production status corrections
- payment recording and voiding
- signed URL creation
- audit log writes

APP-004 uses Server Actions for login/logout. APP-005 uses Server Actions for customer and property mutations. Neither exposes Supabase tokens or service-role credentials to the browser.

APP-007 uses Server Actions for operational forms and file uploads. Tenant, actor and Storage path authority are derived server-side from the active membership and database checks, not from browser-submitted organization IDs.

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

Also not implemented in APP-007:

- online payment providers
- fiscal invoices or PDFs
- QR, OCR, notifications, Realtime or Edge Functions
- customer portal or mobile app
- dashboard analytics

## Data Ownership Boundary

Operational records are accessed through organization membership. Staff access may be further limited by assignment in application logic or future RLS policy where practical.

</details>
