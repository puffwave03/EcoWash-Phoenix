# Milestones

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: UX-002

Next Action: refine protected app landing/dashboard and operational layout

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

Status: In Review

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

APP-008.1 added the organization timezone foundation for dashboard day windows. It does not add BI analytics, forecasts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

Current approved task:

- UX-002 — App landing/dashboard and operational layout refinement

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
