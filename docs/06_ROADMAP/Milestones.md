# Milestones

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: COMM-001

Next Action: finalize commercial roadmap priorities and refine protected app UX

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
- COMM-001 — Commercialization roadmap and production sequencing: Documentation in progress

APP-008.1 added the organization timezone foundation for dashboard day windows. It does not add BI analytics, forecasts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

Current approved task:

- UX-002 — App landing/dashboard and operational layout refinement
- COMM-001 — Commercial roadmap extraction from approved project documentation

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

## Milestone 8 — Commercial Readiness

Status: Planned

Purpose: convert the validated staging MVP into a product that can be demonstrated, piloted and operated commercially by EcoWash without developer hand-holding.

Priority order:

1. UX-002 — App landing, dashboard hierarchy and operational layout refinement.
2. UX-002.1 — Public login entry and mobile navigation clarity.
3. RELEASE-001 — Production deployment readiness, environment review and release checklist.
4. QA-001 — Repeatable end-to-end smoke checklist for real operational flows.
5. SEC-001 — Full Supabase RLS, Storage and browser-secret audit before production.

Commercial exit criteria:

- protected app entry is obvious from the public website
- dashboard supports daily owner decisions without demo data
- mobile navigation works reliably on iPhone Safari and common mobile browsers
- staging smoke test remains repeatable
- production environment can be configured without exposing secrets
- no service-role key or private credential is exposed to browser code

## Milestone 9 — Business Administration

Status: Planned after commercial readiness

Purpose: let the business owner administer the system without developer intervention.

Candidate missions:

- AUTH-002 — Staff invitation, activation and deactivation.
- ORG-001 — Organization and location settings.
- CATALOG-002 — Service catalog and price management hardening.
- AUDIT-001 — User-facing audit trail for sensitive changes.

Commercial value:

- owner can manage employees and business settings
- catalog and price changes are controlled
- staff/member changes are auditable

## Milestone 10 — Operational Efficiency

Status: Planned

Purpose: make daily work faster once the core app is commercially stable.

Candidate missions:

- SEARCH-001 — Search across orders, customers, properties and services.
- OPS-001 — Production queue filters, assignment views and staff worklists.
- OPS-002 — Notes and structured issues.
- QR-001 — QR order lookup without personally identifiable information.

Commercial value:

- faster counter and production work
- clearer responsibility for orders
- fewer missed issues or blocked tasks

## Milestone 11 — Management Reporting

Status: Planned after operational efficiency

Purpose: provide practical business reporting without prematurely building a BI platform.

Candidate missions:

- REPORT-001 — Daily payment close by currency and method.
- REPORT-002 — Open balance and overdue collection report.
- REPORT-003 — Service volume and order throughput summaries.
- EXPORT-001 — CSV export for accounting or operational handoff.

Commercial value:

- owner can reconcile payments
- unpaid balances become actionable
- management can monitor throughput and demand

## Milestone 12 — Customer-Facing And Advanced Growth

Status: Future

Deferred until internal operations are stable:

- customer portal
- online payment providers
- fiscal invoices and advanced PDFs
- customer notifications
- native mobile app
- OCR
- advanced analytics
- offline mode
- Realtime features
- Edge Functions
- generic workflow builder
