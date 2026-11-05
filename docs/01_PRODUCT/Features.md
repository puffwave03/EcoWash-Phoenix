# Features

Status: Active — product scope and domain boundaries

Last consolidated: 2026-10-16

## Role and references

This file describes product boundaries. [Project Status](../06_ROADMAP/Project_Status.md) owns the current implementation and acceptance inventory; [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) owns continuation. The earlier MVP gap list below is historical and must not be used to propose already implemented modules again.

## Established feature boundaries

- Multi-tenant customer, catalog, order, payment and Billing domains use canonical records and server-derived organization context.
- Terminal has five independent Venta workspaces and recoverable drafts. Occasional identity uses the tenant technical customer plus order-local visitor snapshots; regular customers keep their canonical identity.
- Tenant-configurable catalogs, segments and server pricing preserve commercial order snapshots. Current EcoWash prices include IGIC; tax extraction preserves the agreed gross total.
- Production and quality/packing are existing workflows. Warehouse and custody are order-level; final placement completes production. Fulfillment and payment remain separate. See [Workflow](Workflow.md).
- EW customer order copies, internal work tickets and labels are the ordinary operational print outputs. REC issuance is removed from ordinary Terminal/Order UI; the protected ordinary `/print/receipt` GET redirects to Order detail without emission, while its `?document=fiscal` branch toward Billing is preserved. Historical REC numbering, snapshots, consultation/reprint, cancellation, audit and economic guards remain intact. The REC server action and RPC still exist; backend issuance is not technically disabled. Operational copies and REC remain non-fiscal. See the [REC closeout](../06_ROADMAP/Project_Status.md#rec-optional-workflow-001--final-closeout-05112026).
- Billing owns invoice snapshots and numbering; POS/payments/refunds own financial facts. Accounting and Daily Close provide operational reporting/control, not statutory accounting or fiscal closure.
- Billing includes ordinary and simplified document types and bounded service, advance and final-invoice paths. Simplified invoices are the approved habitual direction where permitted, with acceptance limited to the recorded scenarios. Advance classification, remaining service-issuance cases, final reconciliation, refunds/rectifications and the fiscal decisions in the [Billing Event Contract](../04_ARCHITECTURE/Billing_Event_Contract_001.md) remain open. Ordinary-invoice compliance and external fiscal-provider integration remain separately gated; full fiscal conformity is not approved. Use [Project Status](../06_ROADMAP/Project_Status.md) for the latest acceptance evidence.
- Per-garment lifecycle, scan-event history and partial ready/fulfillment are deferred beyond V1. Individual label identifiers do not imply those capabilities.

## Historical MVP feature assessment — 2026-07-31

The original assessment is preserved below. Its missing/partial lists predate staff management, Portal, Billing, POS, Accounting/exports, QR, tenant settings and subsequent catalog work. They are not the current backlog. No open finding is closed without later implementation/UAT evidence in Project Status.

<details>
<summary>Original PRODUCT-001 feature assessment — historical scope</summary>

Status: Active

Version: 0.1

Last Updated: 2026-07-31

Current Mission: PRODUCT-001

---

## Purpose

Define the approved MVP feature boundary for the future EcoWash operations platform.

---

## Contents

APP-006 implements the first operational order workflow slice: services, standard prices, orders, order items and immutable production status history. APP-007 adds pickup, delivery, private order photos and manual payments. APP-008 adds the protected operational overview dashboard. APP-008.1 adds organization timezone support. INFRA-001-SMOKE validates the first real staging flow end to end.

## Implemented MVP Baseline

- Organization boundary for all operational data
- Owner, manager and staff profiles with role-based access
- Customer records
- Property/apartment records linked to customers
- Order creation and editing
- Order items for weight-based services and piece-based services
- Service catalog and effective pricing
- Production workflow with auditable state history
- Optional pickup and delivery per order
- Order photos for intake, processing, quality, issues, delivery and payment proof
- Manual payments
- Base dashboard metrics from real operational records
- Organization timezone for daily dashboard windows
- Public login access to the protected app

## Partial Features

- Role model exists, but owner-facing staff invitation and lifecycle management are not implemented.
- Assignment fields exist for orders/logistics, but staff worklists and assignment-centered views are not implemented.
- Service catalog and standard pricing exist, but customer/property price overrides are not implemented in the app.
- Production status history and payment/logistics actors exist, but a general user-facing audit log is not implemented.
- Dashboard metrics exist, but daily close, open balance reporting and exports are not implemented.

## Missing Commercial Features

- Production deployment readiness and domain/environment decision
- Full Supabase RLS, Storage, grants, RPC and browser-secret audit
- Repeatable smoke/regression checklist for commercial release
- Staff invitation, activation and deactivation
- Organization and location settings UI
- Internal notes and future customer-visible notes
- Order issues/discrepancies separated from production status
- Search across orders, customers, properties and service status
- Daily payment close by currency and method
- Open balance and overdue collection report
- CSV export for operational/accounting handoff

## APP-008 Operational Dashboard

The protected dashboard overview shows real tenant-scoped operational data:

- open, late, express, on-hold and ready orders
- total balance due from valid manual payment records
- production, ready and on-hold queues
- pickup and delivery tasks for today
- overdue logistics attention
- balances requiring attention
- recent activity from status history, payments, completed logistics tasks and photo uploads

APP-008 is not a business intelligence module and does not add advanced analytics, forecasts, exports, fiscal reporting or invented KPIs.

## Post-Core Should Have

- QR order lookup without personally identifiable information
- More granular staff assignment views
- Location-specific operating views after a second location exists

## Later

- Customer self-service portal
- Native mobile app
- OCR
- Push notifications
- Online payment providers
- Fiscal invoices and advanced PDFs
- Advanced analytics
- Offline mode
- Generic workflow builder
- Realtime features
- Edge Functions unless a verified backend need appears

## Product Boundaries

- Payment status is economic and must remain separate from production status.
- Pickup and delivery are logistics concerns and must remain separate from production status.
- Issues do not replace the active production status. An order can be `washing` and still have an open issue.
- Current service prices may change, but each order item must keep a price snapshot for historical accuracy.

</details>
