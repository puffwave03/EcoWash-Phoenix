# Milestones

Status: Active

Version: 0.1

Last Updated: 2026-08-01

Current Mission: RELEASE-001

Next Action: review production deployment readiness, environment strategy and rollback plan

---

## Purpose

Track approved EcoWash Phoenix milestones without adding unapproved dates or commitments.

---

## Contents

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

## Milestone 7 — SaaS Platform Foundation

Status: Completed for staging baseline; commercial hardening in progress

Approved and current areas:

- APP-001 — EcoWash Application Architecture and MVP Definition: Approved
- APP-002 — Order Domain and Database Design: Completed and pushed
- APP-003 — Supabase Tenant Foundation and Security Baseline: Completed and pushed
- APP-004 — Authentication and Roles: Completed and pushed
- APP-005 — Customers and Properties: Completed and pushed
- APP-006 — Orders and Workflow: Completed and pushed
- APP-007 — Photos, Pickup, Delivery and Payments: Completed and pushed
- APP-008 — Dashboard and Operational Overview: Completed
- APP-008.1 — Organization Timezone Foundation: Completed and pushed
- INFRA-001 — Supabase project connection and migration bootstrap: Completed for staging
- AUTH-001 — Password recovery and update flow: Completed and pushed
- AUTH-001.1 — Password reset error handling correction: Completed and pushed
- AUTH-001-E2E — Complete real password recovery and first owner login: Completed
- UX-001 — Protected app shell refinement and session handover: Completed and pushed
- INFRA-001-SMOKE — First real operational smoke test: Completed and pushed; passed with non-blocking issues
- INFRA-001.1 — Reconcile Supabase migration history and finalize smoke baseline: Completed
- UX-002 — App landing/dashboard and operational layout refinement: Completed and pushed
- UX-002.1 — Public login entry and mobile navigation clarity: Completed and pushed
- UX-002.2 — Protected app shell and mobile navigation: Completed and pushed
- UX-002.2.1 — Mobile CTA contrast correction: Completed and pushed
- UX-002.3 — Dashboard hierarchy and quick actions: Completed and pushed
- UX-002.4 — Order detail information architecture and mobile contrast: Completed and pushed
- UX-002.5 — Final responsive and accessibility pass: Completed and pushed
- COMM-001 — Commercialization roadmap and production sequencing: Completed and pushed
- PRODUCT-001 — Commercial readiness and feature-gap audit: Completed and pushed
- SEC-001 — Supabase security audit: Completed
- SEC-001.1 — Security remediation and migration application: Completed and pushed
- SEC-001.2 — Authenticated mutation regression: Completed

APP-008.1 added the organization timezone foundation for dashboard day windows. It does not add BI analytics, forecasts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

Current approved task:

- PILOT-001 — Commercial pilot portal scope and route architecture

INFRA-001-SMOKE passed the first real staging flow from owner login through customer, property, service, order, item, production, pickup, delivery, payment, photo, dashboard and logout/login persistence.

Validated operational smoke areas:

- Auth staging
- Customer
- Property
- Service/price
- Order
- Order item
- Production workflow
- Pickup
- Delivery
- Payment
- Photo
- Dashboard
- Session persistence/logout-login

Corrective work committed in `f94df88`:

- forward-only migration for the `app_current_organization_id()` and `create_order()` staging defects
- explicit PostgREST relationship embeds for order, pickup and delivery reads
- order item submit locking and simpler one-row edit UI
- documentation handover after the smoke test

Not yet completed:

- production-ready release
- public deployment
- commercial pilot portal architecture and implementation order

INFRA-001.1 completed:

- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` bucket verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Smoke baseline verified read-only: customer, property, service, order, item, production, pickup, delivery, payments, zero balance and intake photo.

UX-002 scope guard:

- refine dashboard hierarchy, visual density, desktop/mobile operational layout, public login access and action clarity
- do not change stable domain logic, migrations or Supabase remote state without a separate approved task

UX-002 completed scope:

- public login entry and mobile public navigation clarity
- protected app shell and mobile navigation refinement
- dashboard hierarchy and quick actions
- order detail information architecture
- final responsive, contrast, touch target and accessibility pass
- no database, migration, Supabase, Server Action or domain logic changes

---

## Milestone 8 — M1 Commercial Pilot Baseline

Status: In progress

Purpose: convert the validated staging MVP into a product that can be demonstrated, deployed and safely piloted by EcoWash.

Priority class: P0.

Scope:

- UX-002 — App landing, dashboard hierarchy and operational layout refinement. Completed.
- SEC-001 — Full Supabase RLS, Storage, grants, RPC and browser-secret audit. Completed.
- PILOT-001 — Commercial pilot portal scope and route architecture. Architecture approved; no implementation.
- RELEASE-001 — Production deployment readiness, environment review and rollback checklist. Next.
- QA-001 — Repeatable smoke/regression checklist for staging and production release.

Official sequence after SEC-001:

- SEC-001 — completed
- PILOT-001 — architecture approved; roles, permissions, route architecture, portal boundaries, dependencies, implementation order and pilot acceptance criteria
- RELEASE-001 — next
- QA-001 — planned
- AUTH-002 — planned
- ORG-001 — planned
- OPS-001 — Production Portal MVP
- OPS-002 — Delivery Portal MVP
- PORTAL-001.1 — Customer identity, data model and authorization design
- PORTAL-001 — Customer Portal MVP
- PILOT-002 or M1 First Laundry Operational Pilot — real operational pilot execution

PILOT-001 planning scope:

- Administrative dashboard: owner/manager operational overview, attention records, daily workload and payment visibility.
- Processing portal: staff production flow for intake, item handling, order status movement and issue awareness.
- Delivery portal: logistics flow for pickup/delivery assignment, customer/property context and fulfillment state updates.
- Customer portal: pilot-scoped customer-facing order visibility and request surface with strict separation from staff/admin access.
- Define dependencies, implementation order and acceptance criteria for the real pilot.
- Do not implement routes, UI, schema, migrations, policies or Supabase changes in PILOT-001.

PILOT-001 canonical decisions:

- M1 internal roles stay `owner`, `manager` and `staff`; production operator and delivery operator are personas/capabilities only.
- Route architecture uses `/[locale]/app`, `/[locale]/app/orders`, `/[locale]/app/customers`, `/[locale]/app/services`, `/[locale]/app/payments`, `/[locale]/app/production`, `/[locale]/app/production/orders/[orderId]`, `/[locale]/app/delivery`, `/[locale]/app/delivery/pickups`, `/[locale]/app/delivery/deliveries`, `/[locale]/app/delivery/tasks/[taskId]`, `/[locale]/portal`, `/[locale]/portal/orders`, `/[locale]/portal/orders/[orderRef]`, `/[locale]/portal/requests/new` and `/[locale]/portal/access`.
- Do not introduce `/[locale]/app/admin` for M1.
- Customer access uses Supabase Auth magic link/OTP plus a future customer-user link; do not use organization memberships, do not add `customer` to `app_role` and do not use public order tokens as the primary M1 model.
- Location scope is one organization and one operational location for M1; the model is location-aware, while location-based authorization is future work.
- UI hiding is not authorization; Server Actions/RPCs must enforce capability checks.

Operational pilot definition:

- `PILOT-002` or the M1 First Laundry Operational Pilot is the real pilot execution after planning, release readiness, QA and approved MVP portal implementation.

Commercial exit criteria:

- production target, domain and environment strategy are documented
- dashboard supports daily owner decisions without demo data
- pilot routes and role boundaries are defined for administrative, processing, delivery and customer portals
- portal implementation order and operational pilot acceptance criteria are approved
- staging smoke test remains repeatable from login through dashboard
- production environment can be configured without exposing secrets
- no service-role key or private credential is exposed to browser code or public env vars
- RLS, Storage and RPC permissions have a documented review result

## Milestone 9 — M2 First Paid Operations

Status: Planned after M1

Purpose: let the business owner administer the system without developer intervention.

Priority class: P1.

Candidate missions:

- AUTH-002 — Staff invitation, activation and deactivation.
- ORG-001 — Organization and location settings.
- CATALOG-002 — Service catalog and price management hardening.
- SEARCH-001 — Search across orders, customers, properties and services.
- AUDIT-001 — User-facing audit trail for sensitive changes.

Commercial value:

- owner can manage employees and business settings
- catalog and price changes are controlled
- common records can be found quickly
- staff/member changes are auditable

## Milestone 10 — M3 Operational Scale And Management Control

Status: Planned after M2

Purpose: improve throughput, operational control, financial closeout and accounting handoff.

Priority class: P2.

Candidate missions:

- OPS-001 — Production Portal MVP.
- OPS-002 — Delivery Portal MVP.
- PORTAL-001.1 — Customer identity, data model and authorization design.
- PORTAL-001 — Customer Portal MVP.
- REPORT-001 — Daily payment close by currency and method.
- REPORT-002 — Open balance and overdue collection report.
- EXPORT-001 — CSV export for accounting or operational handoff.
- QR-001 — QR order lookup without personally identifiable information.

Commercial value:

- faster counter and production work
- clearer responsibility for orders
- fewer missed issues or blocked tasks
- owner can reconcile daily payments and act on unpaid balances
- accounting handoff no longer depends on manual screen reading

## Milestone 11 — P3 Customer-Facing Growth

Status: Future after M1-M3

Purpose: add customer-facing and automation features after internal operations are commercially stable.

Priority class: P3.

Deferred candidate missions:

- PAY-001 — Online payment provider integration.
- DOC-001 — Fiscal invoices and advanced PDFs.
- NOTIFY-001 — Customer/staff notifications.
- MOBILE-001 — Native mobile app.
- OCR-001 — OCR intake support.
- ANALYTICS-001 — Advanced analytics.
- OFFLINE-001 — Offline mode.
- REALTIME-001 — Realtime views only when operationally justified.
- EDGE-001 — Edge Functions only after a verified backend need appears.

Scope guard:

- do not start P3 before the internal operational product is stable, deployed and commercially validated
- the first customer portal boundary is now part of M1 pilot scope; do not expand it into payments, fiscal documents or notifications without separate approval
- do not introduce online payments, fiscal invoices, OCR, Realtime or Edge Functions without a separate approved architecture task
