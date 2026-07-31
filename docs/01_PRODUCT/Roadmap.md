# Roadmap

Status: Active

Version: 0.1

Last Updated: 2026-07-31

Current Mission: PRODUCT-001

Next Action: Close commercial readiness and feature-gap audit

---

## Purpose

Track the approved high-level EcoWash Phoenix roadmap without adding unapproved dates or guarantees.

---

## Milestone 1 — Repository and Framework Foundation

Status: Completed

Includes:

- DEV-001

## Milestone 2 — Visual and International Foundation

Status: Completed

Includes:

- DEV-002
- DEV-002.5

## Milestone 3 — Public Homepage Foundation

Status: Completed

Includes:

- DEV-003
- DEV-004
- DEV-005
- DEV-006

## Milestone 4 — Public Website Pages and Technical Readiness

Status: Completed

Includes:

- DEV-007
- DEV-008
- DEV-009

## Milestone 5 — Public Website Visual Completion

Status: Completed

Includes:

- DEV-009.5

## Milestone 6 — Public Website Final Review and Release Decision

Status: Release-ready, deployment deferred

Expected scope:

- Final desktop, tablet and mobile review
- Content and translation review
- Accessibility review
- Image performance and oversized asset optimization — completed in DEV-010.3
- Favicon, app icons and Open Graph/Twitter preview assets — completed in DEV-010.4
- Environment configuration review
- Deployment target confirmation deferred until production domain selection and purchase
- Release checklist
- Documentation update after final approval
- Final content review

## Milestone 7 — SaaS Platform Foundation

Status: Completed for staging baseline; commercial hardening in progress

Completed or validated areas:

- App shell
- Authentication architecture
- Organization and user model
- Customers
- Properties
- Services and prices
- Orders and order items
- Production workflow
- Pickup and delivery
- Manual payments
- Private order photos
- Operational dashboard
- First real staging smoke test
- Supabase migration history reconciliation
- Public login entry and mobile navigation correction

Pending areas:

- UX-002 app landing/dashboard and operational layout refinement
- Public deployment
- Production-ready release
- Reporting beyond the MVP operational dashboard

---

## Commercial Readiness Roadmap

PRODUCT-001 treats code, migrations, Server Actions, routes, smoke results and active documentation as separate evidence sources. A feature is commercial-ready only when it exists in code or schema, is reachable through the app where needed, and has a clear verification path.

### Current Implemented Baseline

Status: Staging MVP validated, not yet production-commercial.

Implemented and smoke-validated:

- public multilingual website and contact/demo presentation flow
- localized protected login entry from the public header
- Supabase Auth login, logout and password recovery
- tenant foundation with organizations, locations, profiles and memberships
- customers and properties
- services and standard prices
- orders, order items, production workflow and status history
- pickup and delivery
- manual payments
- private order photos with signed previews
- operational dashboard over real tenant data
- organization timezone for dashboard day windows
- first real staging smoke flow through order `EW-000001`

Partially implemented:

- role model: `owner`, `manager` and `staff` exist, but there is no owner-facing invitation or staff lifecycle UI
- catalog/pricing: service and standard price management exists, but no customer/property price override UI
- assignments: order/logistics assignment fields exist, but staff worklists and assignment-centered views are still planned
- audit: status/payment/logistics histories exist for specific flows, but no canonical user-facing audit log module exists
- reporting: dashboard has operational summaries, but no daily close, open balance report or export workflow

Missing for commercial readiness:

- production deployment and domain readiness
- full Supabase RLS, Storage, grant and browser-secret audit
- repeatable smoke/regression checklist for production release
- owner-managed staff invitations and deactivation
- organization and location settings UI
- global search
- structured notes and issues
- management reports and CSV exports
- customer-facing portal, online payments, invoices/PDFs and notifications

### Priority Classes

P0 — required before a commercial pilot:

- RELEASE-001 — Production deployment readiness, domain/environment review and rollback checklist.
- SEC-001 — Full Supabase RLS, Storage, grants, RPC and browser-secret audit.
- QA-001 — Repeatable smoke/regression checklist using staging and later production.
- UX-002 — Protected app landing, dashboard hierarchy and operational layout refinement.

P1 — required for first paid internal operations:

- AUTH-002 — Owner-managed staff invitations, activation and deactivation.
- ORG-001 — Organization and location settings.
- CATALOG-002 — Catalog and standard price management hardening.
- SEARCH-001 — Search across orders, customers, properties and services.
- AUDIT-001 — User-facing audit trail for sensitive operational changes.

P2 — strong commercial differentiators after the first paid baseline:

- OPS-001 — Production queue filters, assignment views and staff worklists.
- OPS-002 — Notes and structured order issues.
- REPORT-001 — Daily payment close by currency and method.
- REPORT-002 — Open balance and overdue collection report.
- EXPORT-001 — CSV export for accounting or operational handoff.
- QR-001 — QR order lookup without personally identifiable information.

P3 — future growth after internal operations are stable:

- CUSTOMER-001 — Customer self-service portal.
- PAY-001 — Online payment provider integration.
- DOC-001 — Fiscal invoices and advanced PDFs.
- NOTIFY-001 — Customer/staff notifications.
- MOBILE-001 — Native mobile app.
- OCR-001 — OCR intake support.
- ANALYTICS-001 — Advanced analytics.
- OFFLINE-001 — Offline mode.
- REALTIME-001 — Realtime views only when operationally justified.
- EDGE-001 — Edge Functions only after a verified backend need appears.

### Milestone M1 — Commercial Pilot Baseline

Goal: make the current staging MVP demonstrable, deployable and safe enough for a controlled EcoWash pilot.

Scope:

- UX-002
- RELEASE-001
- SEC-001
- QA-001

Exit criteria:

- production target and domain decision are documented
- environment variables are reviewed without exposing secrets
- no service-role key or private credential reaches browser code
- RLS, Storage and RPC permissions have a documented review result
- smoke test can be repeated from login through dashboard
- app dashboard and order detail are clear enough for owner/staff daily use

### Milestone M2 — First Paid Operations

Goal: let EcoWash operate without developer intervention for everyday administration.

Scope:

- AUTH-002
- ORG-001
- CATALOG-002
- SEARCH-001
- AUDIT-001

Exit criteria:

- owner can invite, activate and deactivate staff
- owner/manager can maintain business settings and catalog data safely
- staff cannot access privileged settings
- users can find orders/customers/properties/services quickly
- sensitive changes are visible in an audit-oriented view

### Milestone M3 — Operational Scale And Management Control

Goal: improve throughput, financial control and handoff to accounting/management.

Scope:

- OPS-001
- OPS-002
- REPORT-001
- REPORT-002
- EXPORT-001
- QR-001

Exit criteria:

- staff worklists reduce navigation friction
- notes/issues capture operational blockers without replacing production status
- owner can close the payment day by currency and method
- open balances are actionable
- key operational data can be exported safely
- QR lookup does not expose PII

### Deferred Until After M3

Do not start customer portal, online payments, invoices/PDFs, notifications, native mobile, OCR, advanced analytics, offline mode, Realtime, Edge Functions or a workflow builder until M1-M3 are complete or a new commercial decision explicitly changes priority.
