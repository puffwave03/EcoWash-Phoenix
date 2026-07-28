# Database Design

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-008

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

Logistics “today” windows use the server runtime day until an organization timezone column is approved. Before connecting APP-008 to a real Supabase organization, add `organizations.timezone`; the expected EcoWash timezone is `Atlantic/Canary`.

## Deletion Strategy

- Prefer soft delete/archive for operational records.
- Prefer deactivation for catalog services and prices.
- Use cancellation/void/refund records instead of destructive deletion for orders and payments.
- `order_status_history` and `audit_logs` are append-only.
