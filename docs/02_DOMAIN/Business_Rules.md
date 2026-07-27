# Business Rules

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Define MVP business rules for orders, pricing, logistics, payments, issues and audit.

---

## Contents

## Tenant Rules

- Every operational record must belong to one organization directly or through an unambiguous parent.
- The first UI may behave as a single EcoWash business, but the data model must be multi-tenant-ready from day one.
- Users access operational data only through organization membership.
- Staff cannot change memberships, global roles or catalog pricing.

## Order Rules

- Orders use an internal UUID and a human-readable order number scoped to organization.
- Production status, fulfillment state, payment state and issues are separate concerns.
- Production phases may be skipped when services do not require them.
- Status changes are recorded in immutable production status history.
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
- Refund handling is documented as a future extension, not an online payment provider integration.

## Logistics Rules

- Pickup and delivery are optional per order.
- Customer dropoff and customer collection must be supported.
- Logistics records keep address snapshots for historical accuracy.
- Address snapshots must be limited to the details needed to complete or audit the service.

## Photo Rules

- Photos belong to an organization and order.
- File names and paths must not contain PII.
- Photos must use short-lived signed URLs, not long-lived public URLs.
- Photo categories are intake, processing, quality, issue, delivery and payment_proof.

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
