# Workflow

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Define the initial order workflow model for the EcoWash MVP.

---

## Contents

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
| `ready` | Production is done and the order awaits collection/delivery. | `completed`, `on_hold` |
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
- Owner and manager can correct statuses with a reason.
- Staff can move assigned or operational orders through normal production states.
- Arbitrary jumps require audit and should be limited to owner/manager.
- `completed` means production work is finished. It does not mean delivery, customer collection or payment is complete.
- `cancelled` requires a reason and should not erase order history.
- `on_hold` requires a reason and should preserve the previous production context.

## On-Hold Resume Rule

`on_hold` is a temporary production status. Entering `on_hold` must be recorded in `order_status_history`, and the history must allow the system to identify the last valid production status before the hold. The standard resume path returns to that last valid status. Owner or manager may choose another allowed transition only with a reason, and every resume or alternate transition must be audited. `on_hold` does not delete, overwrite or replace earlier production history. A `previous_status` field on `orders` is not required if the history supports reliable derivation.

## Production Completion Rule

`production_status = completed` means only that production work is finished. Production, fulfillment and payment remain independent dimensions. An order can be production `completed`, fulfillment still pending and payment `unpaid` or `partially_paid`.

Example:

- `production_status`: `completed`
- `fulfillment_status`: `delivery_scheduled`
- `payment_status`: `partially_paid`

Future order closure should be derived from production, fulfillment and payment conditions or modeled separately. It must not be treated as a synonym for production `completed`.

## Fulfillment

Fulfillment is modeled by an order-level fulfillment type plus optional pickup and delivery records.

Supported patterns:

- Customer dropoff and customer collection
- Customer dropoff and EcoWash delivery
- EcoWash pickup and customer collection
- EcoWash pickup and EcoWash delivery

## Issues

Issues are separate records. An order can continue through production with an open issue unless the issue requires `on_hold`.
