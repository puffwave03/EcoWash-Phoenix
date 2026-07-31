# Roadmap

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: COMM-001

Next Action: Commercial roadmap audit and app UX refinement

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

## Commercialization Roadmap

The first marketable EcoWash product should prioritize reliability, clarity and daily operational value before adding broad platform features. The project already has a working staging MVP; the next roadmap should turn it into a sellable internal operations product for the first EcoWash business.

### Priority 1 — Sellable Operations Baseline

Status: Next

Goal: make the existing MVP safe, clear and credible for real daily use.

Recommended missions:

- UX-002 — App landing, dashboard hierarchy and operational layout refinement.
- UX-002.1 — Public login entry and mobile navigation clarity.
- RELEASE-001 — Production deployment readiness and environment verification.
- QA-001 — Repeatable smoke test checklist for customer, property, service, order, logistics, payment, photo and dashboard flows.
- SEC-001 — Full RLS, storage and browser-secret audit before production.

Commercial value:

- owner can reliably log in, understand the day and operate the business
- staff can work without confusing public-site and protected-app navigation
- the system can be demonstrated without demo data or fragile manual explanations

### Priority 2 — Business Administration

Status: Planned

Goal: let EcoWash manage day-to-day business configuration without developer intervention.

Recommended missions:

- AUTH-002 — Owner-managed staff invitations and membership lifecycle.
- ORG-001 — Organization and location settings screen.
- CATALOG-002 — Safer service catalog and price management workflow.
- AUDIT-001 — User-facing audit trail for sensitive operational changes.

Commercial value:

- the owner can add or disable staff
- prices and locations can be maintained safely
- operational accountability becomes visible enough for real business use

### Priority 3 — Operational Speed

Status: Planned

Goal: reduce time spent finding records and moving orders.

Recommended missions:

- SEARCH-001 — Global search across orders, customers, properties and services.
- OPS-001 — Production queue filters, assignment views and staff worklists.
- OPS-002 — Notes and structured issues for discrepancies, customer questions and operational blockers.
- QR-001 — QR order lookup without personally identifiable information.

Commercial value:

- staff can find orders faster
- owner/manager can see blocked work without reading every order
- QR lookup can improve counter operations without exposing sensitive data

### Priority 4 — Management Reporting

Status: Planned after operational speed

Goal: provide enough reporting for daily control without becoming a BI platform.

Recommended missions:

- REPORT-001 — Daily cash and payment close by currency and method.
- REPORT-002 — Open balance report and overdue collection list.
- REPORT-003 — Service volume and order throughput summaries.
- EXPORT-001 — CSV export for operational and accounting handoff.

Commercial value:

- owner can reconcile cash and card payments
- unpaid work is visible
- reporting supports commercial trust without premature analytics complexity

### Priority 5 — Customer-Facing Growth

Status: Future

Goal: add customer-facing capabilities only after internal operations are stable.

Deferred feature groups:

- customer self-service portal
- online payment providers
- fiscal invoices and advanced PDFs
- customer notifications
- native mobile app

Commercial value:

- expands customer convenience after the internal system is trustworthy
- avoids exposing unfinished operational processes to customers

### Priority 6 — Advanced Automation

Status: Later

Deferred feature groups:

- OCR
- advanced analytics
- offline mode
- Realtime features
- Edge Functions unless a verified backend need appears
- generic workflow builder

These should not be implemented before the core commercial product is stable, deployed and tested with real daily operations.
