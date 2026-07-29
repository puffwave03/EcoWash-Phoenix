# Milestones

Status: Active

Version: 0.1

Last Updated: 2026-07-29

Current Mission: AUTH-001-E2E

Next Action: wait for Supabase email rate limit to clear, complete owner password recovery and verify first owner login

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
- AUTH-001-E2E — Complete real password recovery and first owner login: Pending

APP-008.1 added the organization timezone foundation for dashboard day windows. It does not add BI analytics, forecasts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

Current approved task:

- AUTH-001-E2E — Complete real password recovery and first owner login

AUTH-001-E2E must wait for Supabase email rate limiting to clear. Request one recovery email, use only the latest message, set the owner password, log in, then verify dashboard access. Do not begin the operational smoke test before owner login succeeds.

Next phase after owner login:

- INFRA-001-SMOKE — First real operational smoke test
