# Security

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-004

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

## Storage Security

Order photos use private storage.

Required controls:

- MIME allowlist for supported image types.
- File size limit.
- Path includes organization/order ownership context and unpredictable file name.
- No PII in file names.
- Short-lived signed URLs only.
- Upload/delete actions audited.

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
