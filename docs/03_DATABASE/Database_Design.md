# Database Design

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Define the MVP PostgreSQL/Supabase data design before migrations are written.

---

## Contents

This document is design only. It intentionally contains no final SQL.

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

The final generation strategy is deferred to APP-003 implementation design, but uniqueness must be scoped to `organization_id`.

## Order Totals

Stored values:

- `subtotal_amount`
- `discount_amount`
- `delivery_fee_amount`
- `total_amount`
- `currency`

Derived values:

- `total_paid` from valid payment records.
- `balance_due` as `total_amount - total_paid`.
- `payment_status` from totals and payment records.
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

Weight item:

- unit type `kg`
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

Use the first active matching price in this order:

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
