# Workflow

Status: Active

Version: 0.1

Last consolidated: 2026-10-16

Scope: maintained domain workflow. Current acceptance and continuation: [Project Status](../06_ROADMAP/Project_Status.md) and [Session Handover](../00_START_HERE/SESSION_HANDOVER.md). Original APP-008.1 design date: 2026-07-28; the implemented refinements below supersede its early assumptions.

---

## Purpose

Describe the implemented order-level V1 workflow and preserve its approved boundaries. This reference does not assign missions or authorize workflow changes.

---

## Workflow Principles

Production, fulfillment, payment and issues are separate dimensions. The MVP must not use one mixed status enum for all of them.

- Production describes laundry work.
- Fulfillment describes dropoff, pickup, customer collection and delivery.
- Payment is derived from payment records and order totals.
- Issues describe discrepancies or problems without replacing the production status.

## Production Statuses

| Status | Meaning | Normal next states |
| --- | --- | --- |
| `draft` | Order is being prepared and may not be accepted yet. | `received`, `cancelled` |
| `received` | Order accepted by EcoWash. | `washing`, `ironing`, `quality_check`, `on_hold`, `cancelled` |
| `washing` | Wash work is active. | `drying`, `quality_check`, `on_hold` |
| `drying` | Drying work is active. | `ironing`, `quality_check`, `packing`, `on_hold` |
| `ironing` | Ironing or finishing is active. | `quality_check`, `packing`, `on_hold` |
| `quality_check` | Items are being checked before handoff. | `packing`, `on_hold` |
| `packing` | Items are being prepared for return. | `ready`, `on_hold` |
| `ready` | Final-placement transition stage; older existing ready orders retain manual advancement. | `completed`, `on_hold` |
| `completed` | Production work is finished. | No normal production transition |
| `cancelled` | Order is cancelled with reason. | No normal transition |
| `on_hold` | Work is paused for customer, pricing, issue or operational reason. | Prior active status, `cancelled` |

## Skippable Phases

- Washing and drying can be skipped for piece-only dry cleaning or ironing-only services.
- Ironing can be skipped for wash-only services.
- Pickup can be skipped for customer dropoff.
- Delivery can be skipped for customer collection.

## Transition Rules

- Every production status change creates immutable `order_status_history`.
- APP-006 enforces normal transitions through a dedicated workflow RPC, not through direct status updates.
- Owner/Manager supervise operations; Staff requires the relevant capability and matching assignment. Transitions from `quality_check`/`packing` require `quality`; other production transitions require `production`. Server/RPC checks remain authoritative.
- Generic rollback and workflow builder behavior is not implemented.
- `completed` means production work is finished. It does not mean delivery, customer collection or payment is complete.
- `cancelled` requires a reason and should not erase order history.
- `on_hold` requires a reason and should preserve the previous production context.

## On-Hold Resume Rule

`on_hold` is a temporary production status. Entering `on_hold` must be recorded in `order_status_history`, and the history must allow the system to identify the last valid production status before the hold. The implemented resume path returns to that last valid status, or allows cancellation with a reason. The initial APP-008.1 design mentioned alternate manager resume transitions; that text did not implement a generic rollback or arbitrary alternate-state mechanism. `on_hold` does not delete, overwrite or replace earlier production history. A `previous_status` field on `orders` is not required if the history supports reliable derivation.

## Production Completion Rule

`production_status = completed` means only that production work is finished. Production, fulfillment and payment remain independent dimensions. An order can be production `completed`, fulfillment still pending and payment `unpaid` or `partially_paid`.

Example:

- `production_status`: `completed`
- `fulfillment_status`: `delivery_scheduled`
- `payment_status`: `partially_paid`

The displayed operational status is already derived from production, inbound pickup, outbound delivery and customer handoff. `ready_for_customer_pickup` is a derived label, not an additional stored production state. Do not add a parallel closure or fulfillment model from the original prospective wording.

## Fulfillment

Fulfillment uses canonical pickup, delivery and customer-handoff records linked to the order. Pickup is inbound customer→EcoWash; delivery is outbound EcoWash→customer.

APP-007 implements pickup and delivery records as separate logistics dimensions. Pickup/delivery completion does not change production status, and production `completed` does not imply customer collection or delivery completion.

Payments and refunds remain separate canonical financial facts. POS recording/refund requires established POS access and an open session for every POS method; Staff additionally needs explicit POS capability. Owner/Manager manual-external payment/refund has its own sessionless boundary. Net collected is confirmed payments minus separate refunds. Legacy `void_payment`/`refund_payment` must not be re-enabled. Payment or receipt issue does not complete production or handoff.

APP-007 implements order photos through private Storage and active/inactive metadata. Photos can document intake, processing, quality, issues, delivery and payment proof, but no public media URL is stored.

APP-008 summarizes the existing operational workflow in the protected dashboard. It does not create new workflow states; it derives attention queues from production status, due dates, logistics schedules and payment balances.

Supported patterns:

- Customer dropoff and customer collection
- Customer dropoff and EcoWash delivery
- EcoWash pickup and customer collection
- EcoWash pickup and EcoWash delivery

## Issues

The original MVP model treats issues as a dimension separate from production; it does not establish that a dedicated issue-record module is implemented. Preserve existing notes/photos and reasoned `on_hold` behavior. Do not add or infer an issue workflow from this reference alone.

## Intake, final placement and custody

- Normal manual draft→received requires an active item and rejects an open inbound pickup. Completing the canonical inbound pickup establishes receipt; Quick Drop retains its distinct received-but-undetailed path.
- Zero-item intake exceptions cannot enter actual production or final fulfillment until an active item exists.
- Final Warehouse position, package count and storage mode confirmation atomically records packing→ready→completed, `completed_at` and status history. A failed placement rolls back completion; no second manual completion step is needed for this path.
- Warehouse current placement is order-level physical storage. Outbound departure records an exit and removes current storage; failed delivery may return goods to a real position. Production completion preserves custody until actual handoff/delivery, while in-transit custody is distinct from current Warehouse stock.
- Handoff requires completed production and no conflicting delivery; an outstanding balance requires explicit acknowledgement. Delivery completion and payment remain independent events.

## Quality and fiscal boundary

An explicit quality/packing workspace and persistent `quality_check` state exist. Existing paths drying→packing and ironing→packing remain valid; `completed` alone does not prove a distinct passed-quality record for every order.

Approved EcoWash business definition: the service is operationally complete when quality is passed and the goods are ready for collection. This is not automatic fiscal timing or authorization to emit on a state transition. Fiscal mapping requires external validation and separately approved design. Operational receipts remain non-fiscal; simplified and ordinary fiscal documents remain distinct from production/payment events.

## Physical item V1 boundary

Catalog/services → commercial `order_items` snapshot → ticket/labels → order-level production → order-level Warehouse → fulfillment. Label QR identifies order/line/unit; it is not a garment entity or scan history. Commercial quantity and physical package count are distinct. Per-garment/package workflow and partial ready/fulfillment remain deferred beyond V1.
