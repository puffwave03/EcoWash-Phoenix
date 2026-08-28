# Roadmap

Status: Active

Version: 0.1

Last Updated: 2026-08-29

Current Mission: PAYMENTS-ONLINE-001 provider foundation completed

Next Action: PRINT-001

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

Remaining areas:

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
- owner-only Staff Access Management, invitation, activation, deactivation and organization-membership removal
- capability-aware Pickup, Production, Quality & Packing and Delivery workspaces
- Owner Operations Control Center
- staff My Day filtered by capability and assignment
- end-to-end validation of Pickup, Production, Quality & Packing and Delivery, including terminal redirects without 404
- validated owner, manager and staff route/access boundaries
- Resend Custom SMTP for operational Supabase Auth email delivery
- secure customer portal with customer-scoped order visibility and access management
- organization-scoped customer segment quick catalogs, one primary segment assignment per customer and personalized Portal/New Order discovery
- Owner/Manager invoicing foundation with drafts, definitive issue numbering, legal/line snapshots, configurable percentage-point taxes, printable V1 invoices and Customer Account/payment integration
- centralized tenant entitlement foundation with stable feature keys, optional limits/validity windows and tenant-safe read-only resolution
- Billing, segment-pricing management and advanced branding gated without destroying existing commercial or customer-facing data
- isolated Phoenix Platform administration for bounded tenant listing/detail, entitlement control, commercial labels, suspension/reactivation and audited platform changes
- provider-neutral customer online payment attempts, hosted-checkout boundary, signed-webhook settlement, canonical ledger integration and `payments.online` entitlement; disabled until a real provider is configured
- Daily Close dashboard for owner/manager operational review
- Operational Alerts dashboard for owner/manager issue triage
- Supabase RLS, Storage, grant, RPC and browser-secret audit completed through SEC-001
- first real staging smoke flow through order `EW-000001`

Partially implemented:

- catalog/pricing: service and standard price management plus segment presentation shortcuts exist, but no segment/customer/property price override UI
- audit: status/payment/logistics histories exist for specific flows, but no canonical user-facing audit log module exists
- reporting: dashboard, Daily Close and Operational Alerts have operational summaries, but no open balance report or export workflow

Missing for commercial readiness:

- production deployment and domain readiness, deferred until the pilot product is functionally complete
- repeatable smoke/regression checklist for production release
- organization and location settings UI
- global search
- structured notes and issues
- management reports and CSV exports
- real online payment provider configuration/sandbox acceptance, formal e-invoicing/advanced fiscal PDFs and notifications

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
- UI-001 — Operational Dashboard Visual Refinement. Completed.
- UX-OPS-001.3 through UX-OPS-001.8 — Operational workspaces, owner control and access management. Completed.
- UI-003 — Operational primary CTA consistency. Completed.
- UI-MOBILE-001 — Mobile order/logistics refinement with desktop/mobile data parity. Completed.
- UI-BUG-004 — Desktop staff sidebar active-state readability. Completed.
- UI-FORMAT-005 — Shared quantity, currency and numeric-input formatting. Completed.
- BUG-PROD-006 — Terminal operational transition redirects. Completed.
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
- CUSTOMER-ACCOUNT-001 — Owner/Manager customer identity, properties, segment, Portal state, lifetime order value, payment history and outstanding balances, completed and E2E validated
- CUSTOMER-LIFECYCLE-001 — safe active/inactive lifecycle, Portal revocation, new-order enforcement and dependency eligibility, completed and E2E validated
- OPS-001.5 — Daily Close MVP, completed
- OPS-001.6 — Operational Alerts MVP, completed
- UI-001 — Operational Dashboard Visual Refinement, completed
- UX-OPS-001.3 through UX-OPS-001.8 — operational workspaces, owner control and access management, completed
- UI-003 — operational CTA consistency, completed
- UI-MOBILE-001, UI-BUG-004 and UI-FORMAT-005 — mobile, navigation and numeric-format refinement, completed
- BUG-PROD-006 — terminal operational transition redirects, completed
- AUTH-INFRA-001 — Resend Custom SMTP enabled and operational for Supabase Auth
- BILLING-001 — invoice/document model, draft/issue lifecycle, concurrency-safe numbering, snapshots, taxes, printable view and Customer Account/payment integration, completed and E2E validated
- UI-FIX-001 — authenticated public-chrome removal, compact app shell preservation and Customer Segment selector role/tenant/Portal-visibility verification, completed and E2E validated
- PRICING-SEGMENTS-001 — dated segment price overrides with centralized `segment → organization/location base` precedence, internal/Portal consistency, server-enforced snapshots and historical Billing preservation, completed and E2E validated
- ENTITLEMENTS-001 — platform entitlement access separated from tenant roles, with Billing, segment-pricing management and advanced branding gates, completed and E2E validated
- PLATFORM-ADMIN-001 — SaaS operator control plane separated from Tenant Owner, with cross-tenant commercial controls and no impersonation or deletion, completed and E2E validated
- POS-001 — entitlement-gated till sessions, canonical cash/manual-card partial and mixed payments, linked refunds, receipt-ready data and immutable reconciliation, completed and E2E validated
- QA-PRODUCT-001 — full Platform/Tenant/Portal integration, financial consistency, entitlement, suspension and Tenant A/B acceptance, PASS WITH NON-BLOCKING ISSUES
- MANUAL-QA-FIX-001 — authenticated Portal support, single POS navigation entry and active till recovery, completed with exact rollback-only financial validation
- PAYMENTS-ONLINE-001 — hosted-checkout and signed-confirmation foundation over canonical payments, completed and contract-E2E validated; real provider configuration required
- PILOT-002 or M1 First Laundry Operational Pilot — planned after release, QA and approved MVP portal implementation

Current staging validation checkpoint:

- Pickup, Production, Quality & Packing and Delivery passed end to end using `TEST-PICKUP-01`, `TEST-PRODUCTION-01`, `TEST-QUALITY-01` and `TEST-DELIVERY-01`.
- Operational test purposes are Speed for Pickup, Production Test for Production, Quality Test for Quality & Packing, Delivery Test for Delivery and Manager Test for manager access validation.
- Supabase Custom SMTP through Resend is operational; a real Auth email was sent and received. The configured limit is 30 emails/hour, while endpoint-specific throttling remains independent.
- `QA-001` is the next existing M1/P0 gate. After it is prepared, the Product Owner selects full-app visual/product refinement or the next approved business module.
- Old test orders remain intentionally untouched; do not create more fixtures unless a verified gap requires one.
- CUSTOMER-ACCOUNT-001 is applied through migration `20260826000100`; Owner/Manager access, Staff denial, tenant isolation and exact financial reconciliation passed, with all temporary fixtures removed.
- CUSTOMER-LIFECYCLE-001 is applied through migration `20260826000200`; Owner/Manager transitions, Staff restriction, tenant isolation, Portal revocation, inactive-order rejection and fixture cleanup passed. Anonymization and hard delete remain intentionally unavailable.
- BILLING-001 is applied through migration `20260826000300`; Owner/Manager operations, Staff denial, tenant isolation, exact order/invoice/payment/outstanding reconciliation and fixture cleanup passed. It is premium-ready for future entitlements, but formal e-invoicing and full accounting are not implemented.
- PRICING-SEGMENTS-001 is applied through migration `20260827000100`; Owner/Manager administration, Staff denial, tenant isolation, exact base/override/fallback totals and rollback-only fixture cleanup passed. Future precedence is reserved as `customer-specific → segment → organization`, without implementing customer-specific pricing.
- ENTITLEMENTS-001 is applied through migration `20260827000200`; EcoWash retained all already-live modules, future tenants receive no implicit premium access, and disabled modules preserve invoice history, configured overrides and stored branding.
- PLATFORM-ADMIN-001 is applied through migration `20260827000300`; suspension enforcement, tenant/Portal denial, entitlement preservation, audit and reactivation passed with transaction-only fixtures and no permanent staging admin assignment.
- POS-001 is applied through migrations `20260827000400` and `20260828000100`; six identities validated Owner/Manager/Staff capability boundaries, entitlement disable/reenable, tenant isolation, idempotency, concurrent close/payment locking and exact EUR 50.00 order/payment/refund/reconciliation values with complete rollback cleanup.
- QA-PRODUCT-001 passed 143/143 focused tests and a nine-identity rollback-only master scenario with exact EUR 15.00 order/POS/Customer Account/Billing/Portal consistency. Authenticated visual desktop/mobile review remains a non-blocking Product Owner follow-up; the reported external-PC loading issue was not reproduced by current staging HTTP checks.
- PAYMENTS-ONLINE-001 is applied through `20260828000200` plus corrective `20260829000100`; 26/26 focused tests and POS/Billing/Customer Account/Entitlements/Platform regressions passed. Transactional staging proof covered EUR 15.00 exact settlement, replay idempotency, failure, cross-customer denial and concurrent POS reconciliation with zero persistent fixtures. No real provider credentials exist, so status is `PROVIDER CONFIGURATION REQUIRED`.

PILOT-001 planning scope:

- Administrative dashboard: owner/manager control surface for daily operational decisions, payment attention and queue visibility.
- Processing portal: production-side staff workspace for intake, items, status movement and work-in-progress visibility.
- Delivery portal: logistics-side workspace for pickup/delivery tasks, assignment context and fulfillment updates.
- Customer portal: pilot-scoped customer-facing access for order visibility and service-request interaction, with separate authorization boundaries from staff/admin portals.
- Define roles, permissions, route architecture, dependencies, implementation order and acceptance criteria.
- No route, UI, schema, migration, policy or Supabase implementation is part of PILOT-001.

PILOT-001 canonical decisions:

- M1 internal roles stay `owner`, `manager` and `staff`; capabilities are `pickup`, `production`, `quality`, `delivery` and `supervision`.
- Owner has full access; manager has operational supervision without Staff Access Management; staff requires both capability and assignment.
- Do not introduce `/[locale]/app/admin` for M1; staff visiting `/[locale]/app` is redirected server-side to `/[locale]/app/work` before owner dashboard data loads.
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

Customer portal is now part of M1 pilot scoping. The online-payment core is implemented but real provider onboarding/configuration remains separate future work. Do not combine it with formal e-invoicing/advanced fiscal PDFs, notifications, native mobile, OCR, advanced analytics, offline mode, Realtime, Edge Functions or a workflow builder.

### Product Decision After PAYMENTS-ONLINE-001

The provider-neutral core is complete and safely disabled. No Stripe, Redsys, SumUp or other provider credentials/configuration were present, so real payment readiness remains blocked on a separately approved official adapter and sandbox validation. Phoenix never stores raw card data and never confirms from a browser redirect.

The approved sequence continues:

1. `PRINT-001`
2. `BARCODE-001`
3. `ACCOUNTING-001`
4. `E-INVOICE-001`
5. `ACCOUNTING-PRO-001` — optional
6. `ONBOARDING-001`
7. future subscription/commercial billing
8. `PLATFORM-SUPPORT-001` — optional

Product invariants across this sequence:

- premium UI, Calm Operations and mobile-first usability are mandatory
- Customer Portal continues toward consumer-grade premium UX
- white-label architecture keeps EcoWash as first tenant/reference, never hardcoded product identity
- Owner, Manager, Staff and Customer remain tenant roles; Platform Admin is a separate SaaS role
- potential Base, Premium, Pro and add-on packaging resolves to entitlements; feature logic never branches directly on plan names
- Platform Admin is separate from tenant roles; no impersonation, hard tenant deletion, subscription collection or automatic plan templates exist yet
- future accounting, POS and other optional modules may reuse the entitlement boundary; Billing, segment pricing management and advanced branding already do
- POS is provider-neutral and receipt-ready, not a claim of real TPV/terminal, card-acquirer, fiscal printer, barcode, full-accounting or e-invoice integration
- `PREMIUM-DESIGN` / `CUSTOMER-PORTAL POLISH` remains known visual work: stronger media, richer service visuals, premium timeline, refined financial presentation and continued authenticated-app polish
- no full accounting or e-invoice compliance is claimed before their dedicated missions
