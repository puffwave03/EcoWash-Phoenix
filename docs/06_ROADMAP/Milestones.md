# Milestones

Status: Active

Version: 0.1

Last Updated: 2026-08-28

Current Mission: POS-001 completed, applied and validated

Next Action: QA-PRODUCT-001 — Full Product Acceptance Test

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
- RELEASE-001.0 — Release readiness plan and blockers: Completed and pushed
- RELEASE-001.1 — Staging hosting and environment contract: Completed and pushed
- RELEASE-001.2 — Staging deployment rehearsal and Auth validation: Completed
- RELEASE-001.3 — Production Supabase and environment design: Completed
- OPS-001.1 — Production Queue MVP: Completed and pushed
- OPS-001.2A — Completed logistics corrections: Completed and pushed
- OPS-001.2B — Delivery Queue MVP: Completed and pushed
- OPS-001.3 — Work Assignment MVP: Completed and pushed
- OPS-001.4 — Staff Management MVP: Completed and pushed
- PORTAL-001 / PORTAL-001.1 — Secure Customer Portal MVP: Completed and pushed
- PORTAL-002.1 — Customer Order Request + Pickup: Completed; Product Owner E2E passed
- CATALOG-SEGMENTS-001 — Customer Segment Quick Catalogs: Completed, staging migration aligned and authenticated E2E passed
- CUSTOMER-ACCOUNT-001 — Customer Financial Account Experience: Completed, staging migration aligned, exact financial reconciliation and authenticated E2E passed
- CUSTOMER-LIFECYCLE-001 — Safe Customer Lifecycle Management: Completed, staging migration aligned and authenticated lifecycle E2E passed
- BILLING-001 — Invoicing Foundation and Customer Billing: Completed, staging migration aligned and authenticated financial/role/tenant E2E passed
- UI-FIX-001 — Authenticated Shell Cleanup and Customer Segment Selector Verification: Completed and authenticated route E2E passed
- PRICING-SEGMENTS-001 — Customer Segment Price Overrides with Safe Fallback: Completed, staging migration aligned and exact role/tenant/snapshot E2E passed
- ENTITLEMENTS-001 — SaaS Plans, Modules and Tenant Feature Access: Completed, staging migration aligned and feature/role/tenant/preservation E2E passed
- PLATFORM-ADMIN-001 — Phoenix SaaS Control Center: Completed, staging migration aligned and identity/control/suspension/audit E2E passed
- POS-001 — Vendor-neutral Point of Sale, Cash Register and Payment Operations: Completed, staging migrations aligned and financial/role/tenant E2E passed
- OPS-001.5 — Daily Close MVP: Completed and pushed
- OPS-001.6 — Operational Alerts MVP: Completed and pushed
- UI-001 — Operational Dashboard Visual Refinement: Completed and pushed
- UX-OPS-001.3 — Pickup Workspace: Completed and pushed
- UX-OPS-001.4 — Production Workspace: Completed and pushed
- UX-OPS-001.5 — Quality & Packing Workspace: Completed and pushed
- UX-OPS-001.6 — Delivery Workspace: Completed and pushed
- UX-OPS-001.7 — Owner Operations Control Center: Completed and pushed
- UX-OPS-001.8 — Access & Capabilities Management: Completed and pushed
- UI-003 — Operational primary CTA consistency: Completed and pushed
- BUG-ASSIGN — Persistent capability-aware logistics assignment: Completed and pushed
- BUG-PROD-006 — Terminal operational transition redirects: Completed and pushed
- UI-MOBILE-001 — Mobile order/logistics refinement: Completed and pushed
- UI-BUG-004 — Desktop staff navigation readability: Completed and pushed
- UI-FORMAT-005 — Shared quantity and currency formatting: Completed and pushed
- AUTH-INFRA-001 — Resend Custom SMTP for Supabase Auth: Completed and operational

APP-008.1 added the organization timezone foundation for dashboard day windows. It does not add BI analytics, forecasts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

Current resume task:

- do not start PORTAL-002.2 without approval; next known Portal work is customer address flexibility and delivery preferences
- keep clearer Customers access in owner/manager navigation as a separate UX backlog item

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

- QA-001 repeatable smoke/regression checklist
- production-ready release
- real production environment

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
- PILOT-001 — Commercial pilot portal scope and route architecture. Architecture approved and canonicalized.
- RELEASE-001 — Staging-first release readiness. Staging is online and validated; production is deferred until pilot product completion.
- QA-001 — Repeatable smoke/regression checklist for staging and production release.

Official sequence after SEC-001:

- SEC-001 — completed
- PILOT-001 — architecture approved; roles, permissions, route architecture, portal boundaries, dependencies, implementation order and pilot acceptance criteria
- RELEASE-001.0 — completed; canonicalize release readiness plan and blockers
- RELEASE-001.1 — completed; staging hosting and environment contract
- RELEASE-001.2 — completed; staging deployment rehearsal and Auth validation
- RELEASE-001.3 — completed; production Supabase and environment design
- RELEASE-001.4+ — deferred until the pilot product is functionally complete
- QA-001 — planned
- ORG-001 — planned
- OPS-001.1 — Production Queue MVP, completed
- OPS-001.2A — Completed logistics corrections, completed
- OPS-001.2B — Delivery Queue MVP, completed
- OPS-001.3 — Work Assignment MVP, completed
- OPS-001.4 — Staff Management MVP, completed
- PORTAL-001 / PORTAL-001.1 — Secure Customer Portal MVP, completed
- PORTAL-002.1 — Customer Order Request + Pickup, completed and E2E validated
- CATALOG-SEGMENTS-001 — tenant-defined segments (for example Case Vacanze, Hotel, Ristorazione and Privati), one primary customer assignment and Portal/New Order quick catalogs, completed and E2E validated
- CUSTOMER-ACCOUNT-001 — Owner/Manager customer identity, properties, segment, Portal state, per-currency lifetime order/payment summary and bounded financial histories, completed and E2E validated
- CUSTOMER-LIFECYCLE-001 — Owner/Manager active/inactive transitions, retained history, Portal revocation, inactive-order blocking and dependency eligibility, completed and E2E validated
- BILLING-001 — Owner/Manager draft/issue lifecycle, concurrency-safe numbering, issuer/customer/line snapshots, taxes, printable invoice and Customer Account/payment integration, completed and E2E validated
- UI-FIX-001 — authenticated marketing chrome removal plus segment selector role, tenant and Portal-visibility verification, completed and E2E validated
- PRICING-SEGMENTS-001 — centralized segment override → organization/location base resolution across admin, internal orders and Portal, completed and E2E validated
- ENTITLEMENTS-001 — centralized tenant feature catalog and entitlement resolver with Billing, pricing-management and advanced-branding enforcement, completed and E2E validated
- PLATFORM-ADMIN-001 — isolated platform identity, tenant list/detail, entitlement administration, commercial metadata, suspension/reactivation and audit, completed and E2E validated
- POS-001 — entitlement-gated till sessions, canonical cash/manual-card payments, partial/mixed tender, linked refunds, receipt-ready data and immutable close reconciliation, completed and E2E validated
- OPS-001.5 — Daily Close MVP, completed
- OPS-001.6 — Operational Alerts MVP, completed
- UI-001 — Operational Dashboard Visual Refinement, completed
- UX-OPS-001.3 through UX-OPS-001.8 — operational workspaces, owner control and access management, completed
- UI-003 — operational CTA consistency, completed
- BUG-ASSIGN — persistent capability-aware logistics assignment, completed
- Operational access testing — Pickup, Production, Quality & Packing and Delivery validated end to end
- PILOT-002 or M1 First Laundry Operational Pilot — real operational pilot execution

Current staging validation checkpoint:

- `TEST-PICKUP-01` → Speed; validated in Pickup Workspace and My Day
- `TEST-PRODUCTION-01` → Production Test; validated in Production Workspace and My Day
- `TEST-QUALITY-01` → Quality Test; validated in Quality & Packing Workspace and My Day
- `TEST-DELIVERY-01` → Delivery Test; validated in Delivery Workspace and My Day
- Manager Test validated manager supervision and Staff & Access denial
- Resend Custom SMTP is operational for Supabase Auth; configured limit 30 emails/hour, with endpoint-specific throttling still independent
- `EW-000005` validates customer-selected services, server-side pricing, customer-property isolation, pickup creation and idempotent entry into the operational engine
- PORTAL-002.1 migrations `20260823000100` and corrective `20260823000200` are applied to staging and aligned
- Portal Auth/access hardening is complete and keeps Service Role server-only
- old test orders remain intentionally untouched because safe hard cleanup would require an unnecessarily invasive administrative procedure
- QA-001 remains a planned M1 gate; no QA-001 implementation was started by PORTAL-002.1
- Segment pricing is implemented through `20260827000100`; base fallback and global visibility/orderability remain authoritative, server-created order snapshots ignore tampered client prices, and future customer-specific precedence is reserved but not implemented.
- CUSTOMER-ACCOUNT-001 migration `20260826000100` is applied and aligned; Staff denial, tenant isolation, exact total/paid/outstanding values and fixture cleanup passed.
- CUSTOMER-LIFECYCLE-001 migration `20260826000200` is applied and aligned; Owner/Manager transitions, Staff denial, tenant isolation, Portal/order enforcement and fixture cleanup passed. Anonymization and hard delete remain unavailable.
- BILLING-001 migration `20260826000300` is applied and aligned; Owner/Manager operations, Staff denial, tenant isolation, exact numeric reconciliation and fixture cleanup passed. The foundation is premium-ready, while formal e-invoicing and full accounting remain future work.
- PRICING-SEGMENTS-001 preserved historical order/invoice values and passed rollback-only fixture cleanup; ENTITLEMENTS-001 now controls its management boundary.
- ENTITLEMENTS-001 preserves invoice history, segment overrides and stored branding when access is disabled; EcoWash is bootstrapped only for live modules and future tenants receive no implicit premium access.
- PLATFORM-ADMIN-001 preserves tenant data through feature changes and suspension; EcoWash remains active/entitled and the controlled staging administrator was rolled back.
- POS-001 migrations `20260827000400` and `20260828000100` are aligned; exact EUR 50.00 order, EUR 20.00 cash, EUR 30.00 card, EUR 5.00 refund and EUR -1.00 close difference passed across six identities, entitlement changes and tenant isolation with rollback-only cleanup.

Approved product sequence after this milestone checkpoint:

1. `QA-PRODUCT-001` — Full Product Acceptance Test
2. `PRINT-001`
3. `BARCODE-001`
4. `ACCOUNTING-001`
5. `E-INVOICE-001`
6. `ACCOUNTING-PRO-001` — optional
7. `ONBOARDING-001`
8. future subscription/commercial billing
9. `PLATFORM-SUPPORT-001` — optional

Premium UI, Calm Operations, mobile-first tenant usability, consumer-grade Customer Portal evolution and white-label architecture remain permanent requirements. EcoWash is the first tenant/reference, Platform Admin is separate from Tenant Owner, and potential Base/Premium/Pro plus add-ons resolve to entitlements rather than hardcoded plan branches. Real TPV/terminal integrations, printing, barcode, full accounting, e-invoicing, subscription payments, Stripe, impersonation, tenant deletion and automated plan templates are not implemented.

PILOT-001 planning scope:

- Administrative dashboard: owner/manager operational overview, attention records, daily workload and payment visibility.
- Processing portal: staff production flow for intake, item handling, order status movement and issue awareness.
- Delivery portal: logistics flow for pickup/delivery assignment, customer/property context and fulfillment state updates.
- Customer portal: pilot-scoped customer-facing order visibility and request surface with strict separation from staff/admin access.
- Define dependencies, implementation order and acceptance criteria for the real pilot.
- Do not implement routes, UI, schema, migrations, policies or Supabase changes in PILOT-001.

PILOT-001 canonical decisions, refined by the completed access model:

- M1 internal roles stay `owner`, `manager` and `staff`; operational access uses the centralized `pickup`, `production`, `quality`, `delivery` and `supervision` capabilities.
- Current operational route architecture includes owner/manager `/[locale]/app/control` and staff-focused `/[locale]/app/work`, `/work/pickups`, `/work/production`, `/work/quality` and `/work/deliveries`, plus the existing localized owner and customer portal routes.
- Do not introduce `/[locale]/app/admin` for M1.
- Customer access uses Supabase Auth magic link/OTP plus a future customer-user link; do not use organization memberships, do not add `customer` to `app_role` and do not use public order tokens as the primary M1 model.
- Location scope is one organization and one operational location for M1; the model is location-aware, while location-based authorization is future work.
- Owner has full access; manager has operational supervision without Staff Access Management; staff requires both the relevant capability and assignment.
- UI hiding is not authorization; server-side guards and RPCs enforce tenant, membership, capability and assignment checks.

Operational pilot definition:

- `PILOT-002` or the M1 First Laundry Operational Pilot is the real pilot execution after planning, release readiness, QA and approved MVP portal implementation.

Commercial exit criteria:

- staging target is documented; production target, domain and environment strategy are documented before production go/no-go
- staging and production requirements are separated
- staging and production blockers are documented
- deployment and rollback checklist are approved
- dashboard supports daily owner decisions without demo data
- pilot routes and role boundaries are defined for administrative, processing, delivery and customer portals
- portal implementation order and operational pilot acceptance criteria are approved
- staging smoke test remains repeatable from login through dashboard
- Daily Close gives owner/manager a daily operational control screen without accounting automation
- Operational Alerts gives owner/manager a lightweight in-app triage screen with severity counts and direct order links
- production environment can be configured without exposing secrets
- no service-role key or private credential is exposed to browser code or public env vars
- RLS, Storage and RPC permissions have a documented review result

## Milestone 9 — M2 First Paid Operations

Status: Planned after M1

Purpose: let the business owner administer the system without developer intervention.

Priority class: P1.

Candidate missions:

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
