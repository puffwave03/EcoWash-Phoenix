# Domain Model

Status: Current implemented-domain overview

Reconciled: 2026-11-05, baseline `e511fcbf920ef8c6a05a8e8420fac853604e3880`.

This overview follows existing relational models; it does not propose a replacement schema. [Entities](Entities.md) indexes migration evidence and [ER Diagram](../03_DATABASE/ER_Diagram.md) shows a deliberately limited FK view. Runtime deployment/schema parity was not rechecked during this documentation-only mission. Acceptance belongs to [Project Status](../06_ROADMAP/Project_Status.md), not to table existence alone.

## Implemented domain boundaries

| Domain / conceptual responsibility | Canonical records and relationships | Boundary / derived values |
|---|---|---|
| Tenant and access | `organizations`, `locations`, Auth-linked `profiles`, `organization_memberships`; membership role/capabilities; `organization_entitlements` | Server-derived context, RLS, route and RPC guards remain separate. Platform administration uses `platform_admins` / `platform_audit_log`, not a new tenant role. F03 read-visibility limitations remain deferred. |
| Portal | `customer_portal_access` links Auth user to tenant customer | Canonical usable customer context is independent of staff membership. Multiple stored associations do not mean aggregate Portal visibility. See [Database Design](../03_DATABASE/Database_Design.md). |
| Customer and property | `customers`, `properties`; property FK includes organization/customer | Active customer/property relationships are validated by existing mutations. Occasional identity uses a technical tenant customer and `orders.walk_in_name` / `walk_in_phone`, not a new visitor aggregate. |
| Catalog and prices | `services`, `service_prices`, `catalog_segments`, segment service/category selection and `catalog_segment_prices`; translation records | Server resolves base/segment price. Current catalog/price versions and already stored commercial order snapshots are different things. Proposed `customer_service_prices` is not verified as an implemented table. |
| Orders / commercial lines | `orders`, `order_items`, `order_status_history` | Order is the operational work unit; controlled line/status mutations retain snapshots/history. Persisted totals are distinct from derived financial summary. Existing economic guards protect paid/documented orders. |
| Production and logistics | Production status/history, `pickups`, `deliveries`, `order_customer_handoffs` | Receipt, production readiness and final handoff are distinct events. Inbound pickup can establish `received`; completed production alone does not close custody or debt. |
| Warehouse | `warehouse_positions`, `order_storage`, `warehouse_movements` | Order-level custody/location/placement and movements; no implied per-garment tracking. Storage may change as actual receipt/handoff/delivery occurs under existing transactions. |
| Financial ledger / POS | `payments` includes confirmed payment and separate linked refund rows; optional POS-session link; `pos_sessions` | Net collected, balance and payment state are derived. Session cash control does not replace the ledger. `manual_external` is sessionless and role-restricted; `order` channel is historical. |
| Online checkout | `online_payment_attempts`, `online_payment_provider_events`, tenant non-secret configuration | Attempts/provider events are integration state. Confirmed financial truth is still `payments`; real production provider adapter remains unconfigured. |
| Daily Close / Accounting | Persisted `daily_closes` snapshots; financial readers; suppliers/expense categories/expenses for expense reporting | Daily Close is operational, not fiscal close. Accounting totals do not derive from REC counts or printing. Do not infer a separate universal accounting-ledger table. |
| Billing | `invoices`, `invoice_items`, `invoice_orders`, number counters/settings; advance declarations and payment links | Billing owns issued document truth and numbering. Advance declarations attest an event; they are not invoices. Fiscal attribution does not replace payment/order ownership. Ordinary/simplified/advance/final coverage remains bounded. |
| Operational documents | EW renders canonical order data; `operational_receipts`, receipt counters, `sales_document_events`; printer profiles | EW has no new independent fiscal identity. Historic REC is a persisted non-fiscal snapshot. Events record view/print requests, not proof of physical printing. Ordinary UI issuance removed; backend remains. |
| Photos and sensitive data | `order_photos` metadata plus private Storage objects; customer/internal/item note fields | Visibility/caption/contact/access instructions require explicit customer/staff boundaries. A storage path or metadata FK is not public access permission. |

## Aggregates are not a single ownership transaction

The Order is a conceptual operational aggregate for its lines and production timeline, with linked logistics, storage and photos. Payments, Daily Close, Billing and historical REC retain independent canonical lifecycles and authorization. Their FKs to Orders do not authorize cascading economic rewrites or make every event part of an order-edit operation.

Invoice items hold issued commercial/tax snapshots. `invoice_orders` represents invoice/order association, including existing roles and eligibility guards; it is not an unconditional one-invoice-per-order model. `billing_invoice_payment_links` connects the permitted fiscal role to the real order payment. An invoice may include several orders; an order's advances/final history must not be flattened into a single invoice field. See [Billing Event Contract](../04_ARCHITECTURE/Billing_Event_Contract_001.md).

## Persisted, derived and declared data

- **Persisted commercial data:** `orders.subtotal`, `discount_amount`, `total`, currency and line description/unit/quantity/unit price/line total. Domain/UI names such as `unitPrice` map to SQL fields; historical proposed `subtotal_amount` / `unit_price_snapshot` are not current SQL column names.
- **Derived operational/financial views:** payment summary, net collected, outstanding balance, fulfillment/custody presentation and dashboard queues use existing canonical readers. Do not create a mutable `orders.payment_status` or equate `completed` with financial closure. Cancelled-order sales exclusion does not erase payments/refunds.
- **Separate stored attestations/snapshots:** production event times, `received_at`, `completed_at`, Billing `service_performed_on`/declaration metadata, advance declarations, issued invoice/REC snapshots and Daily Close snapshots have different meanings. A declared service date is not automatically the actual fiscal event timestamp.
- **Logical / application relationships:** JSON document snapshots and aggregated Accounting/Customer Account views are not new FKs. Authorship/audit fields reference actors where migrations establish them; a generalized audit table is not assumed.

## Acceptance and unimplemented proposals

**IMPLEMENTED** means the cited schema/path exists; use current checkpoints for scenario-specific UAT. **PARTIAL / ACCEPTANCE LIMITED** applies especially to provider-neutral online payments, Billing edge cases and physical printing. **PLANNED** includes future unified format/copy selection and per-garment tracking. **FISCAL DECISION OPEN** includes Event Contract C1–C4 / D01–D11, rectification and external fiscal compliance. No fiscal classification, new table or changed permission follows from this guide.

Generic `notes`, `order_issues`, `audit_logs` and `customer_service_prices` in the historical model are **NOT VERIFIED** as implemented tables; the specific fields/records above are the verified counterparts. This is a bounded inventory, not a guarantee that every Supabase object or relationship is represented.

## Historical original — 2026-07-28

The complete original is preserved verbatim below. Proposed entities, old mission labels and obsolete payment/Portal descriptions are dated design evidence, not current instructions. The reconciliation above takes precedence only for its verified scope.

<details>
<summary>Original 2026-07-28 document — historical snapshot</summary>

# Domain Model

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-007

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

APP-006 implements the order aggregate for services, order items, production status and status history. APP-007 adds pickup, delivery, manual payments and order photos. Issues are not implemented yet.

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

APP-007 keeps payment status derived rather than mutable on `orders`. Manual payment corrections use void/refund records with actor and reason fields; online payments are not implemented.

## Order Photos

Order photos belong to the order aggregate through tenant-scoped metadata. The file is private in Storage, while `order_photos` stores category, bucket/path, MIME type, size, caption, uploader and active state.

Storage paths use `organization_id/order_id/random_uuid.ext` and must not contain customer names, phone numbers, addresses or other PII. Signed URLs are generated on demand and are short-lived.

Payment records can be voided or refunded later, but no online provider is included in the MVP.

</details>
