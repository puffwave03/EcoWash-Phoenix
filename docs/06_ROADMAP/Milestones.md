# Milestones

Status: Active

Version: 0.1

Last Updated: 2026-07-31

Current Mission: PRODUCT-001

Next Action: close commercial readiness and feature-gap audit

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
- UX-002 — App landing/dashboard and operational layout refinement: Next
- COMM-001 — Commercialization roadmap and production sequencing: Completed and pushed
- PRODUCT-001 — Commercial readiness and feature-gap audit: In progress

APP-008.1 added the organization timezone foundation for dashboard day windows. It does not add BI analytics, forecasts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

Current approved task:

- PRODUCT-001 — Commercial readiness and feature-gap audit
- UX-002 — App landing/dashboard and operational layout refinement remains the next implementation task after PRODUCT-001

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
- full security audit
- public deployment

INFRA-001.1 completed:

- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` bucket verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- Smoke baseline verified read-only: customer, property, service, order, item, production, pickup, delivery, payments, zero balance and intake photo.

UX-002 scope guard:

- refine dashboard hierarchy, visual density, desktop/mobile operational layout, public login access and action clarity
- do not change stable domain logic, migrations or Supabase remote state without a separate approved task

---

## Milestone 8 — M1 Commercial Pilot Baseline

Status: Planned next

Purpose: convert the validated staging MVP into a product that can be demonstrated, deployed and safely piloted by EcoWash.

Priority class: P0.

Scope:

- UX-002 — App landing, dashboard hierarchy and operational layout refinement.
- RELEASE-001 — Production deployment readiness, environment review and rollback checklist.
- SEC-001 — Full Supabase RLS, Storage, grants, RPC and browser-secret audit.
- QA-001 — Repeatable smoke/regression checklist for staging and production release.

Commercial exit criteria:

- production target, domain and environment strategy are documented
- dashboard supports daily owner decisions without demo data
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

- OPS-001 — Production queue filters, assignment views and staff worklists.
- OPS-002 — Notes and structured issues.
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

Scope guard:

- do not start P3 before the internal operational product is stable, deployed and commercially validated
- do not expose customer-facing data until staff/customer access boundaries are explicitly designed
- do not introduce online payments, fiscal invoices, OCR, Realtime or Edge Functions without a separate approved architecture task
