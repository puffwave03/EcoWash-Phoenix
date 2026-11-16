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
