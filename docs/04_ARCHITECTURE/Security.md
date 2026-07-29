# Security

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-008.1

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

## APP-007 Logistics, Photos And Payment Controls

- Pickup and delivery records are tenant-scoped through their parent order.
- Logistics create/update and status transitions use narrow RPCs.
- Pickup and delivery statuses are independent from production status.
- Staff can record manual payments but cannot void or refund them.
- Owner and manager can void or refund payments only with a reason.
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
