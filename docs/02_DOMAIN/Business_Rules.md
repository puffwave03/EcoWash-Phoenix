# Business Rules

Status: Current reconciliation of implemented rules

Reconciled: 2026-11-05, repository baseline `e511fcbf920ef8c6a05a8e8420fac853604e3880`.

This is a bounded description of existing behavior, not a new business contract or fiscal approval. Migration/code evidence is indexed in [Entities](Entities.md); acceptance and unresolved gates remain in [Project Status](../06_ROADMAP/Project_Status.md). The July rules are preserved below and do not override later checkpoints.

## Identity and authorization — IMPLEMENTED, with acceptance limits

- Tenant roles remain `owner`, `manager`, `staff`; operational capabilities and assignment are additional controls, not additional roles. Server-derived context, RLS and RPC checks establish organization access. Client-supplied organization IDs do not authorize access.
- Portal is implemented through `customer_portal_access`, separately from staff membership. The canonical Portal context scopes customer reads/actions to one usable customer/organization; linked contexts are not implicitly aggregated. Platform administration is a separate boundary, not a tenant role.
- Do not equate hidden UI, route guards, RPC checks and table SELECT policies. Membership-based direct intra-tenant reads can be broader than workspace filters. F03 is **DEFERRED / REASSESS BEFORE SAAS RELEASE**, not a new denial policy or universal security approval. Organization activity/suspension and D03's scoped multi-context correction are detailed in [Database Design](../03_DATABASE/Database_Design.md) and [Security](../04_ARCHITECTURE/Security.md).

## Customers, catalog and commercial snapshots — IMPLEMENTED

- Customers and properties are tenant-scoped; a property's customer relationship is protected by a composite tenant FK. Application deactivation preserves referenced history. Free text, contact data and access instructions are sensitive.
- Occasional customers use the tenant technical customer plus order-local visitor data; a visitor is not automatically a new registered customer or Portal identity.
- Existing server pricing resolves effective base prices and eligible catalog-segment overrides for location/date/currency. Catalog selection and price override are distinct responsibilities. The historical property/customer-specific override hierarchy is not an implemented precedence contract.
- Order lines persist `description`, `unit_type`, `quantity`, `unit_price`, `line_total`; `service_id` can be absent. Catalog changes do not rewrite these commercial snapshots. SQL units are `weight` and `piece`, not `kg` and `piece` enum values.
- Orders persist `subtotal`, `discount_amount`, `total` and `currency`; use controlled mutations and existing financial/document guards. Do not introduce a percentage-discount model or bypass guards for paid/documented orders. Billing's tax-inclusive extraction preserves the agreed gross amount; this is not approval of every IGIC rate or exception.

## Receipt, production and fulfillment — IMPLEMENTED

- Order identity/number, production history, physical custody, fulfillment and payment state are separate. `completed` describes production readiness; it does not mean customer handoff, delivery completion or settlement.
- Canonical `draft` to `received` establishes recorded physical receipt and inbound custody. Inbound pickup completion can perform this transition atomically for a draft order; pickup is customer-to-laundry, not final customer delivery.
- Pickup/delivery records and `order_customer_handoffs` represent their respective events. Warehouse positions, order storage and movement history track custody at order level; they are not proof of a per-garment lifecycle.
- Draft logistics do not become ordinary operational staff work; the scoped inbound-pickup intake exception is preserved. Existing hold/resume, assignment, cancellation and audit/history guards remain authoritative; this reconciliation does not broaden transitions.

Sources: [order workflow](../../supabase/migrations/20260728000200_app_006_orders_workflow.sql), [inbound synchronization](../../supabase/migrations/20260927000300_inbound_custody_sync_001.sql), [final fulfillment/storage exit](../../supabase/migrations/20260926000100_final_fulfillment_storage_exit.sql), [current operational workflow](../01_PRODUCT/Workflow.md).

## Payments, refunds and operational control

| Status | Existing rule and boundary |
|---|---|
| IMPLEMENTED — POS | `record_pos_payment` requires an open same-organization POS session for every method (`cash`, `card`, `bank_transfer`, `other`), with existing actor/location checks. Method and channel are distinct. Staff access requires POS capability/entitlement; this is not a blanket Owner/Manager-only payment rule. Pay Later does not create a payment. |
| IMPLEMENTED — manual external | Owner/Manager records an already verified external payment using `record_manual_external_payment`: `bank_transfer` or `other`, reference, bounded amount and idempotency; no POS session/provider metadata. `other` requires notes. This records money already received; Phoenix does not transfer it. Legacy `channel='order'` remains historical, without a supported new write path. |
| PARTIAL / ACCEPTANCE LIMITED — online | Provider-neutral checkout/attempt/settlement foundations exist, using `channel='online'` and canonical `payments`. The provider factory has only a test adapter restricted to test mode and an unconfigured adapter; a production provider is not established. Do not describe all online payments as absent or as production-ready. |
| IMPLEMENTED — refunds | Refunds are separate `payments` rows with `status='refunded'` and `refunded_from_payment_id`; the confirmed source is retained. `record_pos_refund` requires a confirmed POS source and open POS session. Owner/Manager `record_manual_external_refund` records a verified external reimbursement against an eligible manual-external source; channel-specific guards, limits, references, locking and idempotency remain. Legacy `refund_payment` / `void_payment` must not be re-enabled. Online-provider/historical-order refund workflows are not implemented by these paths. |
| IMPLEMENTED — totals/control | Net collected is confirmed payments minus refunds; cancelled orders are excluded from sales, but their payments/refunds remain financial facts. Accounting and Customer Account derive from those facts. POS session closure and persisted `daily_closes` are operational controls, not statutory fiscal closure. Existing closed-business-day guards remain; online settlement has its own boundary. |

Sources: [POS payment boundary](../../supabase/migrations/20260930000200_pos_session_payment_boundary_001.sql), [POS refund boundary](../../supabase/migrations/20260930000300_pos_refund_channel_session_boundary_001.sql), [manual payment](../../supabase/migrations/20260930000400_manual_external_payment_001.sql), [manual refund](../../supabase/migrations/20260930000500_manual_external_refund_001.sql), [online provider factory](../../src/features/online-payments/providers/index.ts), [net-collected helper](../../src/features/payments/refunds.ts).

## Billing and printed documents

- **IMPLEMENTED / ACCEPTANCE LIMITED:** Billing owns ordinary/simplified invoices, numbering and issued snapshots. Multiorder invoicing, service declarations, advance attribution and final-after-advances exist within their current guards; this is not coverage of every PO scenario. `invoice_orders` joins orders to invoices; `billing_invoice_payment_links` attributes specific payments within the advance/final contract. An invoice never replaces the payment ledger. **FATTURATO and PAGATO are independent**; a monthly invoice must not imply collection or allow independent duplicate billing of the same operation.
- **FISCAL DECISION OPEN:** C1–C4 and D01–D11 in [Billing Event Contract](../04_ARCHITECTURE/Billing_Event_Contract_001.md) retain their actual states. Payment existence alone does not prove an advance; service/payment timing needs reliable evidence. Commercial value, received money, documented fiscal coverage and customer credit are distinct. Final invoices with credit/multiple balances, simplified-to-ordinary conversion, refunds/rectifications and monthly fiscal eligibility need their approved contracts. Current guards are behavior to preserve, not universal fiscal rules. No full compliance or external fiscal-provider approval is granted.
- **IMPLEMENTED:** EW customer copy, internal work ticket and labels are ordinary operational outputs. Customer copy uses an explicit allowlist and current economics; internal/item notes, operator identity and internal logistics/financial references are excluded. Staff ticket retains operational notes. This does not turn EW into a fiscal document or historic invoice snapshot.
- **IMPLEMENTED:** ordinary REC buttons are removed; protected ordinary `/print/receipt` GET redirects without emission, while `?document=fiscal` remains a Billing branch. Historical REC retain numbering, immutable snapshots, cancellations, events and reprint. Only one issued REC per order; cancelled numbers are never reused. Server action/RPC issuance still exists. The Accounting document registry reads documents; REC issue/print/cancel does not drive financial totals.
- **PLANNED:** configurable A4/58–80 mm and normally two copies belong to `COUNTER-THERMAL-DOCUMENTS-001`. Printing/reprinting and payment registration are distinct from fiscal emission; extra copies do not create extra emissions.

Current Billing guards remain bounded: the direct simplified-service path can raise `billing_advance_workflow_required` when a non-void payment exists; the general final-after-advances path expects documented advances plus a single qualifying balance payment and exact reconciliation. A separate single-full-prepayment branch exists. These constraints do not establish the future fiscal rule for every payment/service chronology. Sources: [service issue guard](../../supabase/migrations/20261029192215_billing_simplified_issue_lock_order_001.sql), [C2 reconciliation](../../supabase/migrations/20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql), [full prepayment](../../supabase/migrations/20261028163423_billing_full_prepayment_001.sql).

## Photos, notes and audit — IMPLEMENTED boundaries

Private Storage and tenant/order photo metadata are implemented. Portal disclosure requires the existing customer-safe category/visibility/context rules; signed URLs do not authorize arbitrary files. Customer/internal notes are existing fields, not proof of a generic `notes` table. Production history, financial facts, document events and Platform audit are distinct records. A universal `audit_logs` / structured `order_issues` subsystem from the July proposal is **NOT VERIFIED** as implemented; do not infer it from operational alerts. See [Entities](Entities.md) and [Security](../04_ARCHITECTURE/Security.md).

## Historical original — 2026-08-01

The complete original is preserved verbatim below. Proposed entities, old mission labels and obsolete payment/Portal descriptions are dated design evidence, not current instructions. The reconciliation above takes precedence only for its verified scope.

<details>
<summary>Original 2026-08-01 document — historical snapshot</summary>

# Business Rules

Status: Active

Version: 0.1

Last Updated: 2026-08-01

Current Mission: RELEASE-001

---

## Purpose

Define MVP business rules for orders, pricing, logistics, payments, issues and audit.

---

## Contents

## Tenant Rules

- Every operational record must belong to one organization directly or through an unambiguous parent.
- The first UI may behave as a single EcoWash business, but the data model must be multi-tenant-ready from day one.
- Internal users access operational data only through organization membership.
- Staff cannot change memberships, global roles or catalog pricing.
- M1 internal roles remain `owner`, `manager` and `staff`; production operator and delivery operator are personas/capabilities, not new role values.
- Customer portal users must use a separate future customer-user relationship and customer-scoped authorization model, not organization membership.

## Customer And Property Rules

- Customers are organization-scoped records for individual or business clients.
- Properties are organization-scoped records linked to exactly one customer in the same organization.
- Customer and property records are deactivated, not hard-deleted, from the application.
- Customer and property create/update operations use server-side membership context for `organization_id`, `created_by` and `updated_by`.
- Property records must not be linked to a customer from another organization.
- Customer and property notes may contain operational details and must be treated as sensitive free text.

## Order Rules

- Orders use an internal UUID and a human-readable order number scoped to organization.
- Production status, fulfillment state, payment state and issues are separate concerns.
- APP-006 implements production status only. APP-007 implements fulfillment records and manual payments as separate dimensions; issues remain a future dimension.
- Production phases may be skipped when services do not require them.
- Status changes are recorded in immutable production status history.
- Order creation must atomically create initial status history.
- Item changes must atomically recalculate order subtotal and total.
- Order items snapshot description, unit type, quantity, unit price and line total.
- `completed` means production work is complete, not that delivery, customer collection or payment is complete.
- `cancelled` requires reason and audit.
- `on_hold` is temporary, requires reason and audit, and must preserve the previous production context through `order_status_history`.
- Standard resume from `on_hold` returns to the last valid production status before the hold.
- Owner or manager can resume to another allowed status only with a reason and audit.
- Order closure must be derived or modeled separately in the future. It is not a synonym for production `completed`.

## Pricing Rules

- Standard organization prices are the default.
- Location prices may override organization default prices.
- Customer-specific prices may override location prices.
- Property-specific prices may override customer prices when approved.
- Order items must snapshot description, unit type, unit price, quantity and line total at order time.
- Historical orders must not change when the service catalog or active prices change.

## Payment Rules

- Payments are manual only in the MVP.
- Supported methods are `cash`, `card`, `bank_transfer` and `other`.
- One order can have multiple payment records.
- Payment status is derived from order total and valid payment records.
- Confirmed payments count toward `total_paid`; refunds subtract; void payments do not count.
- MVP overpayment is rejected.
- Staff payment recording is conditional for the pilot and must be decided in OPS-002 capability design.
- Owner/manager can void or refund payments only with a reason.
- Staff cannot apply discounts, void payments or refund payments.
- Refund handling is manual and does not introduce an online payment provider integration.

## Logistics Rules

- Pickup and delivery are optional per order.
- Customer dropoff and customer collection must be supported.
- Logistics records keep address snapshots for historical accuracy.
- Address snapshots must be limited to the details needed to complete or audit the service.
- Delivery assignment and scheduling are owner/manager capabilities for M1.
- Delivery status transitions are allowed for assigned staff, manager and owner.

## Customer Portal Rules

- Magic link/OTP is the M1 authentication direction for customers, but authorization requires a customer-user link and customer-scoped checks.
- The customer portal must use a field whitelist and must not expose internal notes, staff-only financial history, raw Storage paths or internal staff RPCs.
- Customer-visible photos require approved customer-safe categories, active metadata, expiry/revocation and audit rules.
- Public order tokens are not the primary M1 access model.

## Photo Rules

- Photos belong to an organization and order.
- File names and paths must not contain PII.
- Photos must use short-lived signed URLs, not long-lived public URLs.
- Photo categories are intake, processing, quality, issue, delivery and payment_proof.
- APP-007 stores order photo metadata in `order_photos` and files in private Storage.
- Signed URLs are generated on demand and short-lived.
- Removing a photo is logical deactivation; client hard delete is not exposed.

## Dashboard Rules

- Dashboard metrics must be scoped to the active organization.
- Open orders exclude `completed` and `cancelled` production statuses.
- Late orders are active open orders with `due_at` before the current time window.
- Balance due is derived from order totals and valid payment records.
- Global financial aggregates are visible only to `owner` and `manager`.
- `staff` can see per-order balance and payment status for operational collection, but must not receive global balance, unpaid/partially-paid counts, today's payment count or recent void/refund totals.
- Dashboard financial totals must not combine different currencies into a single amount.
- Dashboard queues must link to real records and must not include demo or invented data.

## Notes And Issues Rules

- Notes are general comments scoped to an entity.
- Issues are structured operational problems with category, status and resolution.
- An open issue does not replace production status.
- Issues can optionally link to photos.

## Audit Rules

Audit is required for order creation/editing, production status changes, price changes, payments, cancellations, issue resolution, role changes and deletions.

Business status history and security audit logs are different records:

- `order_status_history` explains production movement.
- `audit_logs` explains sensitive user/system actions.

</details>
