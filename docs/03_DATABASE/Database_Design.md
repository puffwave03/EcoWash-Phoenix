# Database Design

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-006

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

Service and order tables are implemented in APP-006; payment, photo, pickup and delivery tables are not implemented yet.

APP-006 adds:

- `services`
- `service_prices`
- `orders`
- `order_items`
- `order_status_history`

Pickup, delivery, payment, photo, issue, invoice and notification tables are not implemented in APP-006.

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

- future `total_paid` from valid payment records.
- future `balance_due` as `total - total_paid`.
- future `payment_status` from totals and payment records.
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

The order stores intended fulfillment type. Pickup and delivery details are held in separate records only when needed.

Pickup/delivery records include:

- status
- address snapshot
- scheduled time
- completed time
- assigned staff
- notes
- optional proof photo
- optional fee

## Photos And Storage

Expected storage bucket: private order photo bucket scoped by policy. Final bucket names are deferred to APP-003.

Path strategy:

- Include organization and order identifiers for ownership checks.
- Include unpredictable file component.
- Do not include names, phone numbers, addresses or other PII.

Signed URLs must be short-lived.

## Deletion Strategy

- Prefer soft delete/archive for operational records.
- Prefer deactivation for catalog services and prices.
- Use cancellation/void/refund records instead of destructive deletion for orders and payments.
- `order_status_history` and `audit_logs` are append-only.
