# Domain Model

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Define the MVP domain model for EcoWash operations before SQL migrations are written.

---

## Contents

## Model Strategy

The MVP uses normalized relational entities for core operational data. JSONB must not replace searchable core relationships. JSONB is acceptable only for flexible non-critical metadata.

Tenant strategy: single-tenant UX for EcoWash initially, multi-tenant-ready data model through organization ownership.

## Entity Responsibilities

| Entity | Purpose | Ownership and tenant boundary |
| --- | --- | --- |
| `organizations` | Business tenant. | Top-level owner of operational data. |
| `locations` | Physical operating site. | Belongs to organization. One initial location. |
| `profiles` | Application identity linked to auth user. | User-level record; access comes through membership. |
| `organization_memberships` | User role in an organization. | Belongs to organization and profile. |
| `customers` | Person or commercial customer. | Belongs directly to organization. |
| `properties` | Apartment, hotel unit or service property. | Belongs to organization and usually customer. |
| `services` | Catalog service. | Belongs to organization; optionally location-scoped in pricing. |
| `service_prices` | Standard or location service price. | Belongs to organization; may reference location. |
| `customer_service_prices` | Approved customer/property override. | Belongs to organization; optional in MVP if special pricing is needed. |
| `orders` | Central operational work unit. | Belongs to organization, location and customer. |
| `order_items` | Priced service line. | Belongs to order and organization through order. |
| `order_status_history` | Immutable production status timeline. | Belongs to order and organization through order. |
| `pickups` | Optional pickup task. | Belongs to order and organization through order. |
| `deliveries` | Optional delivery task. | Belongs to order and organization through order. |
| `payments` | Manual payment record. | Belongs to order and organization through order. |
| `order_photos` | Stored image metadata. | Belongs to order and organization through order. |
| `notes` | Scoped note. | Belongs to organization and a supported entity. |
| `order_issues` | Structured discrepancy/problem. | Belongs to order and organization through order. |
| `audit_logs` | Security and business audit trail. | Belongs directly to organization. |

## Order Aggregate

`orders` is the aggregate root for order items, production history, pickup/delivery, payments, photos, notes and issues.

Required order fields:

- `id`
- `organization_id`
- `location_id`
- `order_number`
- `customer_id`
- `production_status`
- `fulfillment_type`
- `currency`
- `subtotal_amount`
- `discount_amount`
- `delivery_fee_amount`
- `total_amount`
- `created_by`
- `created_at`
- `updated_at`

Optional order fields:

- `property_id`
- `due_at`
- `customer_note`
- `internal_note`
- `assigned_to`
- cancellation or hold reason fields if represented on the current order snapshot

Derived values:

- `total_paid`
- `balance_due`
- `payment_status`
- logistics status summary
- future order closure state, if needed, from production, fulfillment and payment conditions

Audited values:

- production status
- totals and discounts
- assignment
- cancellation
- customer/property changes after order acceptance

Production status rule:

- `on_hold` is a temporary production status recorded in `order_status_history`.
- The previous valid production status should be derived from history instead of requiring a duplicated `previous_status` field on `orders`.
- Standard resume from `on_hold` returns to that previous valid status.
- Owner or manager can choose a different allowed transition only with a reason and audit.
- `completed` means production work is finished only. It does not imply fulfillment completion or payment settlement.

## Fulfillment Model

Use a simple combination:

- `orders.fulfillment_type` records the intended pattern.
- `pickups` exists only when pickup is needed.
- `deliveries` exists only when delivery is needed.
- Logistics status can be derived from pickup/delivery records and fulfillment type.

Avoid duplicating a second master fulfillment enum that can contradict pickup and delivery records.

## Payment Model

Payments are append-friendly records. Order payment state is derived from successful, non-void payment records against `orders.total_amount`.

Payment records can be voided or refunded later, but no online provider is included in the MVP.
