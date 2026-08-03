# Roadmap

Status: Active

Version: 0.1

Last Updated: 2026-08-03

Current Mission: UI-001

Next Action: Refine operational dashboard visuals without changing logic

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

- UX-002 app landing/dashboard and operational layout refinement completed through UX-002.5
- Public deployment
- Production-ready release
- Reporting beyond the MVP operational dashboard

---

## Commercial Readiness Roadmap

PRODUCT-001 treats code, migrations, Server Actions, routes, smoke results and active documentation as separate evidence sources. A feature is commercial-ready only when it exists in code or schema, is reachable through the app where needed, and has a clear verification path.

### Current Implemented Baseline

Status: Staging MVP validated and online, not yet production-commercial.

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
- Production Queue
- Delivery Queue
- production and logistics assignment with All, Assigned to me and Unassigned filters
- owner/manager staff management, invitation, activation and deactivation
- secure customer portal with customer-scoped order visibility and access management
- Daily Close dashboard for owner/manager operational review
- Operational Alerts dashboard for owner/manager issue triage
- Supabase RLS, Storage, grant, RPC and browser-secret audit completed through SEC-001
- first real staging smoke flow through order `EW-000001`

Partially implemented:

- catalog/pricing: service and standard price management exists, but no customer/property price override UI
- audit: status/payment/logistics histories exist for specific flows, but no canonical user-facing audit log module exists
- reporting: dashboard, Daily Close and Operational Alerts have operational summaries, but no open balance report or export workflow

Missing for commercial readiness:

- production deployment and domain readiness, deferred until the pilot product is functionally complete
- repeatable smoke/regression checklist for production release
- visual refinement of operational dashboards before the next pilot review pass
- organization and location settings UI
- global search
- structured notes and issues
- management reports and CSV exports
- online payments, invoices/PDFs and notifications

### Priority Classes

P0 — required before a commercial pilot:

- UX-002 — Protected app landing, dashboard hierarchy and operational layout refinement. Completed.
- SEC-001 — Full Supabase RLS, Storage, grants, RPC and browser-secret audit. Completed.
- PILOT-001 — Commercial pilot portal scope and route architecture. Architecture approved; no implementation.
- RELEASE-001 — Production deployment readiness. Staging is online and validated; real production is deferred.
- QA-001 — Repeatable smoke/regression checklist using staging and later production.

P1 — required for first paid internal operations:

- ORG-001 — Organization and location settings.
- CATALOG-002 — Catalog and standard price management hardening.
- SEARCH-001 — Search across orders, customers, properties and services.
- AUDIT-001 — User-facing audit trail for sensitive operational changes.

P2 — remaining portal MVPs and strong commercial differentiators after the first paid baseline:

- OPS-001.1 — Production Queue MVP. Completed.
- OPS-001.2A — Completed logistics corrections. Completed.
- OPS-001.2B — Delivery Queue MVP. Completed.
- OPS-001.3 — Work Assignment MVP. Completed.
- OPS-001.4 — Staff Management MVP. Completed.
- PORTAL-001 / PORTAL-001.1 — Secure Customer Portal MVP. Completed.
- OPS-001.5 — Daily Close MVP. Completed.
- OPS-001.6 — Operational Alerts MVP. Completed.
- UI-001 — Operational Dashboard Visual Refinement. Next.
- REPORT-001 — Daily payment close by currency and method.
- REPORT-002 — Open balance and overdue collection report.
- EXPORT-001 — CSV export for accounting or operational handoff.
- QR-001 — QR order lookup without personally identifiable information.

P3 — future growth after internal operations are stable:

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

- UX-002 — completed
- SEC-001 — completed
- PILOT-001 — architecture approved
- RELEASE-001.0 — completed; canonicalize release readiness plan and blockers
- RELEASE-001.1 — completed; staging hosting and environment contract
- RELEASE-001.2 — completed; staging deployment rehearsal and Auth validation
- RELEASE-001.3 — completed; production Supabase and environment design
- RELEASE-001.4+ — deferred until pilot product completion
- QA-001 — planned
- ORG-001 — planned
- OPS-001.1 — Production Queue MVP, completed
- OPS-001.2A — Completed logistics corrections, completed
- OPS-001.2B — Delivery Queue MVP, completed
- OPS-001.3 — Work Assignment MVP, completed
- OPS-001.4 — Staff Management MVP, completed
- PORTAL-001 / PORTAL-001.1 — Secure Customer Portal MVP, completed
- OPS-001.5 — Daily Close MVP, completed
- OPS-001.6 — Operational Alerts MVP, completed
- UI-001 — Operational Dashboard Visual Refinement, next
- PILOT-002 or M1 First Laundry Operational Pilot — planned after release, QA and approved MVP portal implementation

PILOT-001 planning scope:

- Administrative dashboard: owner/manager control surface for daily operational decisions, payment attention and queue visibility.
- Processing portal: production-side staff workspace for intake, items, status movement and work-in-progress visibility.
- Delivery portal: logistics-side workspace for pickup/delivery tasks, assignment context and fulfillment updates.
- Customer portal: pilot-scoped customer-facing access for order visibility and service-request interaction, with separate authorization boundaries from staff/admin portals.
- Define roles, permissions, route architecture, dependencies, implementation order and acceptance criteria.
- No route, UI, schema, migration, policy or Supabase implementation is part of PILOT-001.

PILOT-001 canonical decisions:

- M1 internal roles stay `owner`, `manager` and `staff`.
- Production operator and delivery operator are personas/capabilities, not new `app_role` values.
- Do not introduce `/[locale]/app/admin` for M1; `/[locale]/app` remains the administrative dashboard surface.
- Customer access uses Supabase Auth magic link/OTP plus a future customer-user link; magic link is authentication, not authorization.
- Customer portal must not use `organization_memberships`, must not add `customer` to `app_role` and must not call internal staff RPCs directly.
- Location scope is one organization and one operational location for M1; the model remains location-aware, but location-based authorization is future work.
- UI hiding is not authorization; Server Actions/RPCs must enforce capability checks.

Operational pilot definition:

- `PILOT-002` or the M1 First Laundry Operational Pilot is the real business pilot execution task.
- It starts only after PILOT-001 planning, RELEASE-001, QA-001 and the approved MVP portal implementation tasks are reviewed.

Exit criteria:

- staging target is documented; production target and domain decision are documented before production go/no-go
- environment variables are reviewed without exposing secrets
- staging and production requirements are separated
- staging and production blockers are documented
- deployment and rollback checklist are approved
- no service-role key or private credential reaches browser code
- RLS, Storage and RPC permissions have a documented review result
- role, route and data boundaries are defined for administrative, processing, delivery and customer portals
- implementation order and acceptance criteria for the operational pilot are approved
- smoke test can be repeated from login through dashboard
- app dashboard and order detail are clear enough for owner/staff daily use

### Milestone M2 — First Paid Operations

Goal: let EcoWash operate without developer intervention for everyday administration.

Scope:

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

- UI-001
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

Customer portal is now part of M1 pilot scoping. Do not start online payments, invoices/PDFs, notifications, native mobile, OCR, advanced analytics, offline mode, Realtime, Edge Functions or a workflow builder until M1-M3 are complete or a new commercial decision explicitly changes priority.
