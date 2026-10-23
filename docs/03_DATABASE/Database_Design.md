# Database Design

Status: Current authorization model supplement — CTO REVIEW PASS — READY FOR COMMIT

Last reconciled: 2026-10-23; baseline `9b03b8b9e2120b1c65668da63410aa8a76c53c35`.

## Implemented identity and authorization model

Supabase Auth, PostgreSQL and Storage are implemented. The migration history is the schema source of truth; the July model preserved below is a historical design snapshot, not a complete current table inventory. This supplement reconciles security relationships without redesigning operational, financial or fiscal models.

| Existing relation or field | Current responsibility | Authorization boundary |
| --- | --- | --- |
| `profiles`, `organization_memberships` | Auth-linked profile and organization membership with `role`, `is_active`, `operational_capabilities`. | Tenant roles remain Owner, Manager and Staff. Membership establishes tenant access; it does not by itself express assignment to each operational record. |
| `orders.assigned_to`, `pickups.assigned_to`, `deliveries.assigned_to` | Assignment to an operational actor. | Workspace filters and relevant mutation RPCs enforce capability/assignment. These fields do not imply that every SELECT policy filters by assignee. |
| `customer_portal_access` | Connects an Auth `user_id` to a tenant's `customer_id`, with association state. | Separate from staff membership. Canonical Portal context uses the authenticated UUID, active association/customer, organization state and Portal entitlement. Customer RPCs scope reads to that context. |
| `platform_admins`, `platform_audit_log` | Separate Platform identity and administration audit. | Guarded cross-tenant administration; Platform Admin is not an `app_role` tenant membership or an automatic grant to read all raw business tables. |
| `organizations.status`, `platform_service_status`, `deleted_at` | Organization activity, platform suspension and logical deletion. | F04 membership/role/shared-profile helpers and canonical Portal context require active organization/service and no logical deletion. PostgREST pre-request separately handles suspended identity associations. |

Sources: [tenant foundation](../../supabase/migrations/20260727000100_app_003_tenant_foundation.sql), [capabilities and assignments](../../supabase/migrations/20260820000100_ux_ops_001_8_access_capabilities.sql), [Portal association](../../supabase/migrations/20260803000100_portal_001_customer_portal.sql), [Platform administration](../../supabase/migrations/20260827000300_platform_admin_001_saas_control_center.sql), [Portal context](../../supabase/migrations/20261014000200_portal_entitlement_boundary_001.sql), [F04 helpers](../../supabase/migrations/20261023122144_security_f04_inactive_org_helpers_001a.sql).

## Tenant isolation and visibility within one tenant

Authenticated identity and canonical membership/Portal context determine tenant access; client-supplied organization IDs are not authorization. Existing composite tenant relationships, RLS and explicit RPC checks protect organization boundaries. The accepted staging Tenant A/B tests include real direct reads; see [Testing](../05_DEVELOPMENT/Testing.md).

The SELECT policies `customers_select_member`, `orders_select_member` and `payments_select_member` call `is_organization_member(organization_id)`. They do not require an operational assignment or capability. See the [customer policy](../../supabase/migrations/20260728000100_app_005_customers_properties.sql), [order policy](../../supabase/migrations/20260728000200_app_006_orders_workflow.sql) and [payment policy](../../supabase/migrations/20260728000300_app_007_logistics_photos_payments.sql). F04 adds organization-state enforcement to the shared helper, preserving this membership-based visibility model.

Application route guards, server-query filters, SQL SELECT policies and RPC authorization are separate layers. For example, Customer Account RPCs enforce Owner/Manager even though operational payment-table SELECT uses membership. See [Customer Account functions](../../supabase/migrations/20260826000100_customer_account_001_financial_summary.sql). UI denial alone cannot establish direct table/RPC denial.

F03 remains a specific evidence/contract gap about Staff reads inside its own tenant. D03 remains a specific gap about multiple identity contexts and suspension: the pre-request checks any qualifying suspended association while Portal selects one canonical context. Neither gap authorizes new policies or an architectural change. [Security](../04_ARCHITECTURE/Security.md) defines the reconciled boundaries and [Project Status](../06_ROADMAP/Project_Status.md) records the pending CTO decisions.

## Historical database design — 2026-07-28

The original design below is preserved verbatim. Its proposed tables, pre-migration language, global order sequence and payment descriptions are historical; later canonical migrations and domain rules take precedence. It must not be used as a complete current schema or authorization inventory.

<details>
<summary>Original APP database model — historical reference</summary>

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-008.1

---

## Purpose

Define the MVP PostgreSQL/Supabase data design before migrations are written.

---

## Contents

APP-003 added the first versioned Supabase migration for tenant foundation tables:

- `organizations`
- `locations`
- `profiles`
- `organization_memberships`

APP-005 adds the first operational master-data tables:

- `customers`
- `properties`

Service and order tables are implemented in APP-006. Pickup, delivery, manual payment and order photo tables are implemented in APP-007 and are in implementation review.

APP-006 adds:

- `services`
- `service_prices`
- `orders`
- `order_items`
- `order_status_history`

Issue, invoice and notification tables are not implemented in APP-007.

## Database Principles

- PostgreSQL is the target relational database.
- Supabase is the candidate platform for Auth, PostgreSQL, Storage and RLS.
- Core operational data uses normalized relational tables.
- JSONB is allowed only for flexible non-critical metadata, not for customers, orders, order items, pricing, payments or workflow.
- Every tenant-scoped table must enforce organization isolation.
- Historical order and price data must remain stable after catalog changes.

## Tables

| Table | Primary purpose | Tenant scope |
| --- | --- | --- |
| `organizations` | Tenant/business root | Direct |
| `locations` | Operating sites | Direct via `organization_id` |
| `profiles` | Auth-linked user profile | Membership-based |
| `organization_memberships` | Role per organization | Direct via `organization_id` |
| `customers` | Customer records | Direct via `organization_id` |
| `properties` | Customer properties/apartments | Direct via `organization_id` |
| `services` | Service catalog | Direct via `organization_id` |
| `service_prices` | Standard/location pricing | Direct via `organization_id` |
| `customer_service_prices` | Customer/property overrides | Direct via `organization_id` |
| `orders` | Operational work order | Direct via `organization_id` |
| `order_items` | Order service lines | Through `orders` |
| `order_status_history` | Production status timeline | Through `orders` |
| `pickups` | Pickup tasks | Through `orders` |
| `deliveries` | Delivery tasks | Through `orders` |
| `payments` | Manual payments | Through `orders` |
| `order_photos` | Photo metadata | Through `orders` |
| `notes` | Scoped notes | Direct via `organization_id` |
| `order_issues` | Structured order problems | Through `orders` |
| `audit_logs` | Security/business audit | Direct via `organization_id` |

## Order Number

Orders use:

- `id`: internal UUID.
- `order_number`: human-readable number unique within organization.

APP-006 generates order numbers server-side through a PostgreSQL sequence with format `EW-000001`. The value is unique within organization and is not accepted from browser form input.

## Customers And Properties

APP-005 implements:

- `customer_type`: `individual`, `business`
- `property_type`: `apartment`, `holiday_home`, `hotel`, `business`, `other`
- `customers.organization_id` as the direct tenant boundary
- `properties.organization_id` as the direct tenant boundary
- `properties.customer_id` linked to `customers.id`
- a composite foreign key from `properties(organization_id, customer_id)` to `customers(organization_id, id)` to prevent cross-tenant property/customer links
- `is_active` for logical deactivation
- `created_by` and `updated_by` references to `profiles(id)`
- indexes for tenant-scoped search and customer/property lookup
- update triggers for `updated_at`
- triggers protecting immutable tenant and creator fields

Application CRUD is logical only: APP-005 does not add client delete policies or application hard delete flows for customers or properties.

## Order Totals

Stored values:

- `subtotal`
- `discount_amount`
- `total`
- `currency`

Derived values:

- `total_paid` from valid payment records.
- `balance_due` as `total - total_paid`.
- `payment_status` from totals and payment records: `unpaid`, `partially_paid`, `paid`, `refunded` or `void`.
- future order closure, if needed, from production, fulfillment and payment conditions.

Totals require audit when changed after the order leaves `draft`.

Production completion does not close the order by itself. For example, an order can have:

- `production_status`: `completed`
- `fulfillment_status`: `delivery_scheduled`
- `payment_status`: `partially_paid`

## On-Hold History

`on_hold` is a temporary production status and is recorded like every other production status change. The reliable source for the previous valid production status is `order_status_history`.

Database design should not require a duplicated `previous_status` column on `orders` if history can derive the resume target. Standard resume returns to the last valid production status before `on_hold`. Owner or manager can choose another allowed transition only with a reason, and the action must be auditable.

## Order Items

APP-006 stores item snapshots and recalculates totals through order item RPCs. Direct item mutation is blocked by trigger outside the controlled RPC path.

Weight item:

- unit type `weight`
- decimal quantity
- price per kg snapshot
- optional initial/final weight fields

Piece item:

- unit type `piece`
- integer quantity
- unit price snapshot
- article/category snapshot

All order items snapshot:

- service description
- unit type
- unit price
- quantity
- line total
- future tax information only when fiscal scope is approved

## Pricing Priority

APP-006 uses the first active standard price matching organization/location. Future pricing priority remains:

1. Property override
2. Customer override
3. Location price
4. Organization default price

Price records require effective dates. Existing order items must not depend on current catalog price after creation.

## Logistics

APP-007 stores pickup and delivery details in separate records only when needed. There is no duplicated global logistics status that can contradict pickup or delivery records.

Pickup/delivery records include:

- status
- address snapshot
- scheduled time
- completed time
- assigned staff
- notes
- optional fee

Pickup and delivery status values are `not_required`, `scheduled`, `in_progress`, `completed` and `cancelled`. The MVP normally represents not-required logistics by the absence of an active pickup or delivery row. Standard transitions are `scheduled -> in_progress`, `in_progress -> completed`, `scheduled -> cancelled` and `in_progress -> cancelled`. A completed pickup or delivery requires a completion timestamp; cancellation requires a reason.

Production completion does not complete pickup or delivery, and delivery completion does not imply payment.

APP-007 logistics fees are informational only and do not contribute to `orders.total`. APP-006 order totals remain `subtotal - discount_amount`; any future decision to charge logistics fees must add an atomic server-side recalculation.

## Manual Payments

APP-007 stores manual payment records only. There is no online payment provider, card token, invoice or fiscal document table.

Payment records include:

- amount, method, paid timestamp and optional reference
- `recorded_by`, `confirmed_by`, `voided_by` and refund source fields for audit
- optional payment proof photo
- status values `pending`, `confirmed`, `void` and `refunded`

The order payment summary is read-only and derived from `orders.total` and payment records. Confirmed payments add to `total_paid`; refunded records subtract from it; void and pending records do not count toward `total_paid`. MVP overpayment is rejected. Fully refunded orders derive `payment_status = refunded`; orders with only voided payment attempts derive `payment_status = void`.

## Photos And Storage

APP-007 creates `order_photos` metadata and the private `order-media` Storage bucket.

Path strategy:

- `organization_id/order_id/random_uuid.ext`
- organization and order identifiers are used for ownership checks.
- the file component is unpredictable.
- names, phone numbers, addresses and other PII are not allowed in the path.

Stored metadata keeps the bucket/path, category, MIME type, size, caption, uploaded user and active flag. Public URLs are not persisted. Signed URLs are generated on demand and must be short-lived.

APP-007 uses a 1 MB image limit for the Server Action upload path. The bucket and database enforce the same limit. The server checks browser-declared MIME type, path extension derived from MIME type and basic binary signatures for JPEG, PNG and WebP without adding image-processing dependencies. SVG, GIF, PDF and other formats are denied.

## Dashboard Reporting

APP-008 does not add reporting tables, materialized views or migrations. Dashboard values are read-time projections over existing tenant-scoped tables:

- `orders`
- `order_status_history`
- `pickups`
- `deliveries`
- `payments`
- `order_photos`

Payment balances use the same derived payment rules as APP-007. Cross-currency balances are kept as separate currency amounts and are not converted or summed into a single figure.

APP-008.1 adds `organizations.timezone` with default `Atlantic/Canary`. Dashboard “today” windows use the active organization timezone from membership context.

## Deletion Strategy

- Prefer soft delete/archive for operational records.
- Prefer deactivation for catalog services and prices.
- Use cancellation/void/refund records instead of destructive deletion for orders and payments.
- `order_status_history` and `audit_logs` are append-only.

</details>
