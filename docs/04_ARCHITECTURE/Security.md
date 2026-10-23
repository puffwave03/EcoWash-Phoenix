# Security

Status: Current architecture reference — CTO REVIEW PASS — READY FOR COMMIT

Last reconciled: 2026-10-23; repository baseline `9b03b8b9e2120b1c65668da63410aa8a76c53c35`.

## Current scope and authority

This section records the implemented security boundaries reconciled by `SECURITY-EVIDENCE-RECONCILIATION-001` (AUDIT COMPLETE / CTO REVIEWED). [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) and [Project Status](../06_ROADMAP/Project_Status.md) own current acceptance and continuation; [Testing](../05_DEVELOPMENT/Testing.md) indexes evidence by level. This documentation update runs no new security tests and does not declare general application security or production readiness.

## Tenant identity, roles and operational access

Tenant context comes from authenticated identity and database relationships, not a browser-supplied organization ID. Organization-scoped RLS and RPC checks enforce tenant boundaries. `owner`, `manager` and `staff` remain the tenant `app_role` values. Owner controls Staff/access administration; Manager has operational supervision without that Owner-only authority. Staff operations use explicit capabilities and assignments. Owner and Manager receive the effective operational capabilities through their roles; Staff cannot obtain supervision and POS requires explicit capability. See [capability resolution](../../src/lib/auth/capabilities.ts) and [database capability/assignment enforcement](../../supabase/migrations/20260820000100_ux_ops_001_8_access_capabilities.sql).

Server guards and workspace assignment filters restrict application routes, queries and actions. They are not equivalent to restrictions on every direct SQL SELECT. Existing `customers_select_member`, `orders_select_member` and `payments_select_member` policies authorize tenant membership, without an assignment predicate. The [database boundary summary](../03_DATABASE/Database_Design.md) distinguishes these layers. Real authenticated Tenant A/B isolation and capability-scoped operational flows have existing PASS evidence; they must not be reopened merely because a historical document lists an unfinished task.

**F03 — PARTIAL / EVIDENCE GAP:** the remaining question is Staff visibility within the same tenant, across direct table reads and RPCs, for users with/without capability and assignment. Cross-tenant reads and specific privileged RPC denials already have evidence. CTO must delimit the intended intra-tenant read contract before deciding whether any policy correction is necessary. No new restriction or confirmed vulnerability is declared here.

## Customer Portal and Platform administration

Portal authorization uses `customer_portal_access`, separate from staff membership. Auth login alone does not authorize customer data. The canonical `customer_portal_current_access()` derives the customer/organization from the authenticated UUID, selects the first active association with an active customer, then checks organization state and Portal entitlement. Customer-facing RPCs bind reads to that context. See [Portal context isolation](../../supabase/migrations/20261005000200_portal_context_isolation_001.sql) and [entitlement boundary](../../supabase/migrations/20261014000200_portal_entitlement_boundary_001.sql).

Platform Admin uses separate `platform_admins` identity and guarded, audited administration RPCs. It is not a tenant role and does not imply arbitrary raw customer/order/payment access. Its bounded cross-tenant management and ability to manage suspended tenants have existing staging evidence. [Platform migration](../../supabase/migrations/20260827000300_platform_admin_001_saas_control_center.sql) and [guard](../../src/lib/auth/require-platform-admin.ts) define this boundary.

## Organization state and pre-request checks

Organization `status`, `platform_service_status` and `deleted_at` are distinct checks. The three F04 membership/role/shared-profile helpers require active organization status, active platform service and no logical deletion, in addition to their existing authenticated identity, membership, tenant and role conditions. The canonical Portal context also checks these organization conditions; the application membership resolver rejects inactive organizations.

`platform_assert_request_allowed()` is configured as the PostgREST pre-request hook. It rejects a non-Platform-Admin identity when an active membership or active Portal association points to a non-deleted suspended organization. Active Platform Admin identities are exempt from this hook so that they can administer suspended tenants; their separate RPC guards remain necessary. Ordinary suspension/reactivation and tenant/Portal denial already passed the controlled staging QA.

**D03 — PARTIAL / EVIDENCE GAP:** the hook considers any qualifying suspended association, while Portal selects a canonical context. A user with a legitimate context in tenant A and an active association in suspended tenant B can therefore encounter a request-wide denial. The intended behavior and remaining combinations of multiple contexts, inactive associations and inactive customers require focused CTO review. This is not evidence of unauthorized access and does not reopen the completed ordinary suspension QA or authorize a global session redesign.

## RLS, RPC privileges and privileged server code

RLS determines permitted rows for direct table access; grants determine which operations/functions are callable. RPCs separately validate caller, tenant and applicable role/capability. `SECURITY DEFINER` functions require explicit authorization, a fixed safe `search_path` and deliberate grants; their existence alone does not prove safe access. SEC-001.1 revoked broad function execution and reduced table privileges, with subsequent migrations maintaining explicit per-function boundaries. Later F02/F04 postflights verified their respective function properties and permissions; these scoped results are not a fresh exhaustive remote catalog audit.

Browser clients do not receive service-role credentials. Privileged Auth administration uses the server-only [admin client](../../src/lib/supabase/admin.ts) behind application authorization. The historical statement that no Server Action uses service role describes an earlier phase, not the current invitation architecture. Current POS refunds use `record_pos_refund`; historical SEC-001 mutation evidence involving `void_payment` or `refund_payment` does not authorize re-enabling those legacy RPCs.

## Completed scoped security corrections

| Finding | Accepted scope | Remaining distinction |
| --- | --- | --- |
| SEC-001 / .1 / .2 | Historical audit, privilege/Storage remediation and authenticated mutation regression completed. | The preserved August evidence is not a blanket certification of later features. |
| F01 | Auth callback HTML bridge hardened; source/local regression evidence and publication recorded. | Does not certify every Auth/browser flow. |
| F02 | Unsafe Preview disabled independently of flags; identity-binding RPC checks and removal of global Auth activity metadata implemented, with staging postflight recorded. | Consent, identity reassignment, remaining invitation/Auth cases and previously created sessions are separate questions. |
| F04 | Three helpers corrected by `20261023122144_security_f04_inactive_org_helpers_001a.sql`; CTO staging postflight and active/inactive behavior 3/3 PASS with explicit rollback. | Supersedes the historical F04 OPEN/BLOCKED gate for these helpers; not browser E2E or all RLS/RPC combinations. |

## Private Storage and Portal photographs

`order-media` is private. Staff Storage SELECT requires the tenant boundary and matching active photo metadata; customer access has its separate Portal policy. The Portal issues signed photo URLs with a 600-second expiry. [Portal queries](../../src/features/portal/server/queries.ts) and [Storage policy](../../supabase/migrations/20260803000300_portal_001_fix_customer_storage_policy.sql) are the implementation references.

`PORTAL-UAT-006` passed browser revocation at a refreshed protected request and subsequent reactivation without a new login. That result does not prove Auth session termination or immediate invalidation of previously issued photo URLs. `PORTAL-REVOCATION-MEDIA-TTL-001` remains the already recorded bounded TTL/cache privacy risk. PO/CTO keep Portal photos enabled; shorter expiry/cache mitigation requires separate scope before commercial release. No new photo prohibition or demonstrated cross-tenant leak is inferred.

`AUTH-DR-001C` remains mandatory before production, alongside the other release gates in [Recovery Runbook](../05_DEVELOPMENT/Recovery_Runbook.md). Logical database/Storage restore evidence does not establish physical Auth or authenticated application recovery.

## Historical security reference — 2026-08-01

The original text below is preserved verbatim as evidence of its phase. Its future-feature wording, role/payment descriptions and release mission are historical; the current sections above and later canonical checkpoints take precedence.

<details>
<summary>Original SEC-001 and APP security reference — historical evidence</summary>

Status: Active

Version: 0.1

Last Updated: 2026-08-01

Current Mission: RELEASE-001

---

## Purpose

Define the MVP security and RLS strategy for the future Supabase implementation.

---

## Contents

## Security Principles

- Organization isolation is mandatory.
- Roles are enforced server-side and by RLS.
- Service-role credentials are never exposed to the browser.
- Staff/customer access must remain separate when customer access is introduced.
- QR codes must not contain PII.
- Google Vision or OCR must never run from the client if introduced later.

## Role Capabilities

| Role | MVP access |
| --- | --- |
| `owner` | Full organization operations, memberships, catalog, prices, audit visibility. |
| `manager` | Operational management, customers, properties, orders, prices if approved, payments. |
| `staff` | Operational order work, photos, notes, pickup/delivery tasks, normal status transitions. |

Deferred roles:

- `driver`
- `customer`

## RLS Strategy

Tenant-scoped tables must only be visible to active members of the same organization.

APP-003 implements initial RLS for:

- `profiles`
- `organizations`
- `locations`
- `organization_memberships`

APP-003 also adds PostgreSQL helper functions for membership and role checks. These helpers are used by policies so authorization is enforced in the database, not only in the UI.

Expected access pattern:

| Table group | Select | Insert | Update | Delete |
| --- | --- | --- | --- | --- |
| Organizations | active members | restricted | owner | no client hard delete |
| Memberships | owner/manager as approved; self limited | owner/manager invitation flow | owner only for roles | no client hard delete |
| Customers/properties | active members | owner/manager/staff | owner/manager/staff with audit for sensitive fields | archive only |
| Services/prices | active members | owner/manager | owner/manager with audit | deactivate only |
| Orders/items | active members; staff may be assignment-filtered later | owner/manager/staff | owner/manager/staff by role and state | archive/cancel only |
| Status history | active members | server-validated transition | no client update | no client delete |
| Pickups/deliveries | active members; assigned staff allowed | owner/manager/staff | owner/manager/assigned staff | cancel/archive only |
| Payments | active members | owner/manager/staff as approved | owner/manager for void/correction | no client hard delete |
| Photos | active members with order access | owner/manager/staff with order access | limited metadata updates | soft delete |
| Notes/issues | active members with scoped access | owner/manager/staff | author or manager rules | soft delete/resolve |
| Audit logs | owner/manager read as approved | server only | no client update | no client delete |

## APP-003 RLS Invariants

- A user cannot select, insert, update or delete data for another organization.
- Staff cannot change roles or memberships.
- Staff cannot modify global service catalog or pricing unless explicitly promoted by policy.
- Order child records must resolve to the same organization as their parent order.
- Photo metadata and storage object paths must match order ownership.
- Audit logs are append-only and cannot be changed by the client.
- Status history is append-only and cannot be changed by the client.
- Service-role keys are never present in client bundles or public environment variables.
- Signed URLs for private files are short-lived.
- QR payloads do not contain customer names, phone numbers, addresses or payment details.

APP-003 status:

- The tenant-foundation tables have RLS enabled.
- `owner`, `manager` and `staff` are the only implemented roles.
- Membership and role changes are restricted to `owner` policies at the database layer.
- Client hard delete policies are intentionally not added.
- Service-role credentials are not used by the new browser/server client factories.

## SEC-001 Security Audit Result

SEC-001 is completed.

SEC-001.1 applied `20260801000100_sec_001_1_security_remediation.sql` to EcoWash Staging and hardened the database security surface:

- all `public` function execution was revoked from `PUBLIC`, `anon` and `authenticated` before applying an explicit authenticated allowlist
- internal helpers, including `recalculate_order_totals(uuid)` and `app_current_organization_id()`, are not executable by Data API clients
- anonymous table SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges on application tables are removed
- authenticated table privileges are reduced to the operations used directly by the app
- Storage SELECT for `order-media` requires active matching `order_photos` metadata
- browser/server Supabase clients continue to use only the anon key; no service-role key is browser reachable

SEC-001.2 authenticated mutation regression passed after the hardening:

- mutative RPCs used by the app continue to work for an authorized authenticated user
- rollback-only regression tests left no persistent fixture data
- smoke order `EW-000001` remained unchanged
- anonymous RPC calls are blocked with permission denied

PILOT-001 is architecture-approved. M1 internal roles remain `owner`, `manager` and `staff`; production operator and delivery operator are application personas/capabilities, not new `app_role` values.

Customer access must not use `organization_memberships` and must not add `customer` to `app_role`. The M1 direction is Supabase Auth magic link/OTP plus a separate future customer-user relationship. Magic link is authentication only; authorization requires customer-scoped RLS/RPC or equivalent server-side checks, field whitelists, customer-safe photo categories, expiry/revocation and audit.

The customer portal must not call internal staff RPCs directly.

## APP-004 Authentication Controls

APP-004 adds real email/password login and logout through Supabase SSR.

Security rules:

- No public signup is exposed.
- No user can self-assign `owner`.
- Roles are read from database memberships, not browser state, query strings or user metadata.
- Middleware refreshes session cookies and handles initial redirects, but dashboard authorization is still verified server-side.
- Users without an active membership are sent to access denied.
- Users with more than one active membership are blocked until a future tenant switcher is approved.
- Inactive organizations are blocked.
- Service-role credentials are not used in frontend or Server Actions.
- Login errors are generic and do not enumerate users.

## AUTH-001 Password Recovery Controls

- Password recovery uses Supabase Auth anon client capabilities only.
- Recovery email requests use a server-built redirect based on `NEXT_PUBLIC_SITE_URL` and a validated locale.
- Browser-provided redirect URLs are not accepted.
- Supabase Auth email rate-limit responses are shown as safe retry-later messages without exposing whether the email belongs to an account.
- The recovery code is exchanged through the SSR proxy for `/[locale]/update-password`, then the URL is cleaned before rendering the form.
- Password update requires an active Supabase recovery session.
- New password and confirmation must match and meet the minimum project policy.
- The recovery session is signed out after a successful password update before redirecting to login.
- Passwords, tokens and recovery URLs must not be logged.
- Do not request repeated recovery emails during a Supabase email rate-limit window.

## APP-005 Customer And Property Controls

APP-005 adds RLS-protected customer and property tables.

Security rules:

- Active organization members can read customers and properties in their organization.
- `owner`, `manager` and `staff` can create and update customers and properties in their organization.
- `organization_id`, `created_by` and `updated_by` are set by server-side application context for normal mutations.
- Customer and property Server Actions do not accept tenant ownership from browser form input.
- Property records use a composite tenant/customer foreign key so they cannot point to a customer in another organization.
- Client hard delete policies and grants are intentionally not added.
- Deactivation uses `is_active = false` and remains tenant-scoped.
- The Supabase service role is not used by APP-005 UI, queries or Server Actions.

## APP-006 Order Workflow Controls

- Staff can read services and prices but cannot create or update the catalog.
- Orders and order items are tenant-scoped by `organization_id`.
- Order creation, item mutation, discount update and status transitions use narrow PostgreSQL RPCs for atomicity.
- Direct production status updates are blocked outside the workflow RPC.
- Direct order total and item mutation are blocked outside controlled RPC paths.
- Status history is append-only and cannot be inserted, updated or deleted directly by the client.
- `completed` remains production-only and does not imply fulfillment or payment.

## Storage Security

APP-007 order photos use the private `order-media` Storage bucket.

Required controls:

- MIME allowlist for supported image types.
- File size limit of 1 MB for the Server Action upload path.
- Path format `organization_id/order_id/random_uuid.ext`.
- No PII in file names.
- Short-lived signed URLs only.
- Metadata is tenant-scoped in `order_photos`.
- Client hard delete is not exposed; photo removal is logical deactivation.

APP-007 Storage policies allow authenticated owner/manager/staff members of the same organization to upload and read order media for orders in their tenant. Anonymous access, cross-tenant paths, arbitrary path shapes, direct object updates and direct object deletes are denied.

SEC-001.1 further requires active `order_photos` metadata to read `order-media` objects. An object path alone is not sufficient for Storage SELECT.

## APP-007 Logistics, Photos And Payment Controls

- Pickup and delivery records are tenant-scoped through their parent order.
- Logistics create/update and status transitions use narrow RPCs.
- Pickup and delivery statuses are independent from production status.
- Staff payment recording is conditional for the pilot and must be decided in OPS-002 capability design.
- Owner and manager can void or refund payments only with a reason.
- Staff cannot apply discounts, void payments or refund payments.
- Payment summary is derived from confirmed/refunded/void records and `orders.total`; the browser cannot submit a trusted payment status.
- MVP overpayment is rejected.
- A confirmed payment with refund records cannot be voided; corrections after refund require additional refund/accounting records, not destructive mutation.
- Payment proof is optional and must reference an active `payment_proof` order photo in the same tenant and order.
- Direct table updates and hard deletes for APP-007 operational tables are blocked by grants and controlled triggers.

## APP-008 Dashboard Security

- Dashboard metrics are queried server-side after `requireMembership`.
- Every query is scoped to the active membership organization.
- The active organization timezone is read server-side from membership context.
- No dashboard query accepts `organization_id` from the browser.
- The dashboard reads existing RLS-protected tables and does not introduce new mutation paths.
- Payment balances are derived from valid payment records; pending and void payments are not counted as collected.
- Owner and manager can receive global financial aggregates.
- Staff receives only per-order balance/payment status and collection attention records; global financial totals and reserved payment counts are omitted in the server payload.
- Dashboard currency totals are grouped by currency and are not converted or combined.
- Recent activity is built only from existing operational records and does not create a new audit table.

## Audit Scope

Audit logs are required for:

- order creation and sensitive edits
- production status changes
- price changes
- payment creation, voiding or refund recording
- cancellation
- issue resolution
- membership and role changes
- deletion/archive actions
- future sensitive access events

</details>
