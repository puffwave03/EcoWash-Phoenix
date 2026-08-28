# Project Status

Status: Active

Version: 0.1

Last Updated: 2026-08-29

Current Mission: PAYMENTS-ONLINE-001 provider foundation completed

Next Action: PRINT-001

---

## Purpose

Track the current development state of EcoWash Phoenix and provide the handover context required to resume work safely.

---

## Contents

## Current Status

| Item | Status |
| --- | --- |
| Project | EcoWash Phoenix |
| Current phase | Commercial Readiness |
| Current milestone | Milestone 8 — M1 Commercial Pilot Baseline |
| Current mission | PAYMENTS-ONLINE-001 provider-neutral core completed; real provider configuration required |
| Last completed implementation mission | PAYMENTS-ONLINE-001 — hosted checkout, signed confirmation and canonical payment settlement foundation |
| Approved baseline before current closeout | a0f88c5 |
| Remote status | main synchronized with origin/main after approved closeout |
| DEV-010.4 status | Completed, committed and pushed |
| APP-001 status | Approved architecture and MVP definition |
| APP-002 status | Completed and pushed |
| APP-003 status | Completed and pushed |
| APP-004 status | Completed and pushed |
| APP-005 status | Completed and pushed |
| APP-006 status | Completed and pushed |
| APP-007 status | Completed and pushed |
| APP-008 status | Completed and pushed |
| APP-008.1 status | Completed and pushed |
| INFRA-001 status | Completed for EcoWash Staging bootstrap |
| AUTH-001 status | Completed and pushed |
| AUTH-001.1 status | Completed and pushed |
| AUTH-001-E2E status | Completed; owner password recovery/login verified |
| UX-001 status | Completed and pushed |
| INFRA-001-SMOKE status | Completed and pushed; passed with non-blocking issues |
| INFRA-001.1 status | Completed |
| UX-002 status | Completed and pushed |
| UX-002.1 status | Completed and pushed |
| UX-002.2 status | Completed and pushed |
| UX-002.2.1 status | Completed and pushed |
| UX-002.3 status | Completed and pushed |
| UX-002.4 status | Completed and pushed |
| UX-002.5 status | Completed and pushed |
| COMM-001 status | Completed and pushed |
| PRODUCT-001 status | Completed and pushed |
| SEC-001 status | Completed |
| SEC-001.1 status | Completed, applied to staging and pushed |
| SEC-001.2 status | Completed; authenticated mutation regression passed |
| RELEASE-001.2 status | Completed; staging deployment and Auth validated |
| RELEASE-001.3 status | Completed; production design closed without creating production resources |
| OPS-001.1 status | Completed and pushed |
| OPS-001.2A status | Completed and pushed |
| OPS-001.2B status | Completed and pushed |
| OPS-001.3 status | Completed and pushed |
| OPS-001.4 status | Completed and pushed |
| PORTAL-001 / PORTAL-001.1 status | Completed and pushed |
| PORTAL-002.1 status | Completed; Product Owner E2E passed |
| CATALOG-SEGMENTS-001 status | Completed, applied to staging, authenticated E2E passed and pushed |
| CUSTOMER-ACCOUNT-001 status | Completed, applied through 20260826000100, exact financial E2E passed and pushed |
| CUSTOMER-LIFECYCLE-001 status | Completed, applied through 20260826000200, authenticated lifecycle E2E passed and pushed |
| BILLING-001 status | Completed, applied through 20260826000300, exact financial/role/tenant E2E passed and pushed |
| UI-FIX-001 status | Completed; authenticated public chrome removed, segment selector verified and pushed |
| PRICING-SEGMENTS-001 status | Completed; applied through 20260827000100, exact internal/Portal/Billing E2E passed and pushed |
| ENTITLEMENTS-001 status | Completed; applied through 20260827000200, feature/role/tenant/preservation E2E passed and pushed |
| PLATFORM-ADMIN-001 status | Completed; applied through 20260827000300, cross-tenant control/suspension/audit E2E passed and pushed |
| POS-001 status | Completed; applied through 20260828000100, exact financial/role/entitlement/tenant E2E passed and pushed |
| QA-PRODUCT-001 status | PASS WITH NON-BLOCKING ISSUES; 143/143 tests and rollback-only master staging acceptance passed; authenticated visual review unavailable |
| POST-QA-PRODUCT-001 status | Completed; contrast fix pushed, four real EcoWash segments active/Portal-visible, verified Product Owner bootstrapped as Platform Admin, focused staging E2E passed |
| AUTH-CONTEXT-001 status | Completed; dual-access chooser, authoritative direct routes, two-way shell switch, six-identity authenticated E2E and redirect-loop checks passed |
| MANUAL-QA-FIX-001 status | Completed; authenticated Portal support, single capability/entitlement-gated POS nav item, tenant-safe active-session embed and exact EUR 10.00 rollback-only financial E2E passed; discount confirmed monetary |
| PAYMENTS-ONLINE-001 status | Core completed and pushed; applied through corrective 20260829000100, 26/26 focused tests and rollback-only exact/idempotency/failure/concurrency/isolation E2E passed; PROVIDER CONFIGURATION REQUIRED |
| OPS-001.5 status | Completed and pushed |
| OPS-001.6 status | Completed and pushed |
| UI-001 status | Completed and pushed |
| UX-OPS-001.3 through UX-OPS-001.8 status | Completed and pushed |
| UI-003 status | Completed and pushed |
| BUG-ASSIGN status | Completed and pushed |
| BUG-PROD-006 status | Completed and pushed |
| UI-MOBILE-001 status | Completed and pushed |
| UI-BUG-004 status | Completed and pushed |
| UI-FORMAT-005 status | Completed and pushed |
| AUTH-INFRA-001 status | Completed; Resend Custom SMTP operational |
| Staff access/removal refinement | Completed and pushed |
| Current staging test block | None for operational role/workspace validation; endpoint-specific Auth throttling remains possible |
| Public website release state | Release-ready, deployment deferred |
| Production domain | Not selected or purchased yet |
| Backend/SaaS implementation | Supabase Staging aligned through 20260829000100; online attempts settle exactly once into canonical payments after trusted provider verification, with reconciliation-required handling for changed balances |
| Commercial readiness | Online-payment core is production-safe and OFF by default, but no real provider/sandbox configuration exists. Next is PRINT-001. Real online payments, terminals, barcode, subscription collection, onboarding, formal e-invoicing and full accounting remain future work |

## Operational Access Testing Checkpoint

Completed and available:

- Pickup, Production, Quality & Packing and Delivery staff workspaces
- Owner Operations Control Center
- Access & Capabilities Management
- consistent operational primary CTA styling
- persistent capability-aware pickup and delivery assignment
- owner-only staff invite, access-link, deactivate/reactivate and organization-membership removal flows
- server-side redirect from the legacy staff `/[locale]/app` route to `/[locale]/app/work`, before owner dashboard data is queried
- Auth callback protection against invalid links, stale sessions and email rate-limit errors
- Next.js local development through Webpack for stable route behavior
- terminal operational redirects that return users to valid workspaces without 404
- responsive mobile logistics, readable desktop staff navigation and shared numeric formatting

Authorization model:

- operational capabilities are `pickup`, `production`, `quality`, `delivery` and `supervision`
- owner has full access
- manager has operational supervision but no Staff Access Management
- staff requires an active tenant membership, the relevant capability and the matching assignment
- capability does not replace tenant scope or assignment checks

Staging validation:

- Pickup passed end to end with Speed using `TEST-PICKUP-01`.
- Production passed end to end with Production Test using `TEST-PRODUCTION-01`.
- Quality & Packing passed end to end with Quality Test using `TEST-QUALITY-01`.
- Delivery passed end to end with Delivery Test using `TEST-DELIVERY-01`.
- Manager Test validated manager supervision and denial of Staff & Access management.
- Each operational test covered staff assignment, capability, My Day, dedicated workspace, activity detail, transitions, terminal transition and final redirect without 404.
- Resend Custom SMTP is operational for Supabase Auth; a real Auth email was sent and received. The configured limit is 30 emails/hour, while endpoint-specific throttling remains independent.
- Older test orders were intentionally not deleted because safe hard cleanup would require an unnecessarily invasive administrative procedure.
- No additional fixtures should be created unless a verified test gap requires one.

## Development Status

| Mission | Description | Status |
| --- | --- | --- |
| DEV-001 | Bootstrap Next.js public website | Completed |
| DEV-002 | Executive Luxury design foundation | Completed |
| DEV-002.5 | Internationalization foundation | Completed |
| DEV-003 | Multilingual homepage Hero | Completed |
| DEV-004 | Solutions, Services and Industries sections | Completed |
| DEV-005 | Complete multilingual public homepage | Completed |
| DEV-006 | Integrate official EcoWash logo | Completed |
| DEV-007 | Multilingual Contact and Demo Request page | Completed |
| DEV-008 | Public website navigation refinement | Completed |
| DEV-009 | Multilingual SEO and production readiness | Completed |
| DEV-009.5 | Visual Enrichment and Homepage Layout Upgrade | Completed |
| DEV-010.1 | Verified public release issue fixes | Completed |
| DEV-010.2 | SaaS preview and contact-form clarity fixes | Completed |
| DEV-010.3 | Homepage image optimization | Completed |
| DEV-010.4 | Favicon, app icons and social preview water mark | Completed |
| DEV-010 | Public Website Final Audit and Release Preparation | Release-ready, deployment deferred |
| APP-001 | EcoWash Application Architecture and MVP Definition | Approved |
| APP-002 | Order Domain and Database Design | Completed |
| APP-003 | Supabase Tenant Foundation and Security Baseline | Completed |
| APP-004 | Authentication and Roles | Completed |
| APP-005 | Customers and Properties | Completed |
| APP-006 | Orders and Workflow | Completed |
| APP-007 | Photos, Pickup, Delivery and Payments | Completed |
| APP-008 | Dashboard and Operational Overview | Completed |
| APP-008.1 | Organization Timezone Foundation | Completed |
| INFRA-001 | Supabase project connection and migration bootstrap | Completed for staging |
| AUTH-001 | Password recovery and update flow | Completed |
| AUTH-001.1 | Password reset error handling correction | Completed |
| AUTH-001-E2E | Complete real password recovery and first owner login | Completed |
| UX-001 | Protected app shell refinement and session handover | Completed |
| INFRA-001-SMOKE | First real operational smoke test | Completed and pushed; passed with non-blocking issues |
| INFRA-001.1 | Reconcile Supabase migration history and finalize smoke baseline | Completed |
| UX-002 | App landing/dashboard and operational layout refinement | Completed |
| UX-002.1 | Public login entry and mobile navigation clarity | Completed |
| UX-002.2 | Protected app shell and mobile navigation | Completed |
| UX-002.2.1 | Mobile CTA contrast correction | Completed |
| UX-002.3 | Dashboard hierarchy and quick actions | Completed |
| UX-002.4 | Order detail information architecture and mobile contrast | Completed |
| UX-002.5 | Final responsive and accessibility pass | Completed |
| COMM-001 | Commercial roadmap extraction and prioritization | Completed |
| PRODUCT-001 | Commercial readiness and feature-gap audit | Completed |
| SEC-001 | Supabase security audit | Completed |
| SEC-001.1 | Security remediation and migration design/application | Completed |
| SEC-001.2 | Authenticated mutation regression | Completed |
| PILOT-001 | Commercial pilot portal scope and route architecture | Architecture approved |
| RELEASE-001 | Production deployment readiness | Deferred after staging validation |
| RELEASE-001.0 | Canonicalize release readiness plan and blockers | Completed |
| RELEASE-001.1 | Staging hosting and environment contract | Completed |
| RELEASE-001.2 | Staging deployment rehearsal | Completed; staging Auth validated |
| RELEASE-001.3 | Production Supabase and environment design | Completed; no production resources created |
| OPS-001.1 | Production Queue MVP | Completed |
| OPS-001.2A | Completed logistics corrections | Completed |
| OPS-001.2B | Delivery Queue MVP | Completed |
| OPS-001.3 | Work Assignment MVP | Completed |
| OPS-001.4 | Staff Management MVP | Completed |
| PORTAL-001 / PORTAL-001.1 | Secure Customer Portal MVP | Completed |
| PORTAL-002.1 | Customer Order Request + Pickup | Completed; E2E validated |
| OPS-001.5 | Daily Close MVP | Completed |
| OPS-001.6 | Operational Alerts MVP | Completed |
| UI-001 | Operational Dashboard Visual Refinement | Completed |
| UX-OPS-001.3 | Pickup Workspace | Completed |
| UX-OPS-001.4 | Production Workspace | Completed |
| UX-OPS-001.5 | Quality & Packing Workspace | Completed |
| UX-OPS-001.6 | Delivery Workspace | Completed |
| UX-OPS-001.7 | Owner Operations Control Center | Completed |
| UX-OPS-001.8 | Access & Capabilities Management | Completed |
| UI-003 | Operational primary CTA consistency | Completed |
| BUG-ASSIGN | Persistent capability-aware logistics assignment | Completed |
| BUG-PROD-006 | Terminal operational transition redirects | Completed |
| UI-MOBILE-001 | Mobile order/logistics refinement | Completed |
| UI-BUG-004 | Desktop staff navigation readability | Completed |
| UI-FORMAT-005 | Shared quantity, currency and numeric-input formatting | Completed |
| AUTH-INFRA-001 | Resend Custom SMTP for Supabase Auth | Completed; operational |

## Commit History

| Mission | Commit |
| --- | --- |
| DEV-001 | 9b6a030 |
| DEV-002 | 2a68b72 |
| DEV-002.5 | d6e7692 |
| DEV-003 | 4dd528d |
| DEV-004 | 5d692f0 |
| DEV-005 | 68dd15e |
| DEV-006 | f13938f |
| DEV-007 | 076d473 |
| DEV-008 | 22a6075 |
| DEV-009 | 2026943 |
| DEV-009.5 | 2834289 |
| DEV-010.1 | 4b89250 |
| DEV-010.2 | d89b443 |
| DEV-010.3 | aeb9268 |
| DEV-010.4 | 6ef5344 |
| APP-002 | 24e392d |
| APP-003 | d3e1f44 |
| APP-004 | d7e903b |
| APP-005 | 5639183 |
| APP-006 | b5a1c7c |
| APP-007 | 22f6cf0 |
| APP-008 | c62e7a0 |
| APP-008.1 | 210e1ad |
| INFRA-001 temp ignore | f881903 |
| AUTH-001 | f2e970a |
| DOCS-007 | 491091b |
| AUTH-001.1 | 6769365 |
| UX-001 | a607218 |
| INFRA-001-SMOKE | f94df88 |
| DOCS-008 | 6317c65 |
| DOCS-009 | 4ec74d3 |
| UX-002.1 | d20a5d8 |
| COMM-001 | b0f6b81 |
| PRODUCT-001 | df6a166 |
| UX-002.2 | 07c0ce9 |
| UX-002.2.1 | df20f76 |
| UX-002.3 | 732f82c |
| UX-002.4 | d408425 |
| UX-002.5 | 730bcae |
| SEC-001.1 | 3e1579e |

## Documentation Commit History

| Mission | Commit |
| --- | --- |
| DOCS-001 | 5d509b8 |
| DOCS-002 | aa0f210 |
| DOCS-003 | eed5bcf |
| DOCS-004 | 038c9ff |
| DOCS-005 | 56e5125 |

## Known Validated State

- `npm run build` passes
- `npm run lint` passes
- `git diff --check` passes
- Homepage routes work in all five locales
- Contact routes work in all five locales
- Each localized Contact page has one `h1` and one form
- Development-stage notice is visible
- Homepage Contact and Demo links point to localized contact routes
- Multilingual SEO metadata is configured
- Canonical and alternate-language metadata is configured
- Sitemap and robots configuration exist
- Localized not-found experience exists
- Environment-based public site URL configuration exists
- Executive Luxury visual system is integrated
- Optimized WebP photographic imagery is integrated in Hero, Services, Industries and Final CTA
- Operational benefit band is integrated
- Final homepage image assets are real non-empty WebP files
- Favicon, site icon, Apple icon and Open Graph/Twitter preview image exist
- EcoWash product mark master SVG exists at `public/brand/ecowash-product-mark.svg`
- DEV-010.4 water mark is the current approved committed branding asset baseline pending any future visual revision request
- Decorative homepage imagery uses empty alt text where appropriate
- Content-bearing images use translated alt text
- Next.js Image is used for the final homepage photographic imagery
- Object-position decisions are set for responsive crops
- No visible photographic placeholders remain on the approved homepage
- No missing translation keys
- No horizontal overflow
- No new dependencies added during DEV-009.5, DEV-010.3 or DEV-010.4
- No Docker files or configuration added
- Local `main` and `origin/main` pointed to `27b208f` before the approved PORTAL-002.1 closeout.

## DEV-009.5 Completed State

- Technical implementation completed
- Visual completion approved
- Final photographic assets integrated
- Ten homepage image assets are present in approved paths
- Technical validation passed before commit:
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Five homepage and contact locales render
- One `h1` per localized homepage
- No broken image requests were found during review
- No hydration or console errors were found during review
- Commit `2834289` is pushed to `origin/main`

## DEV-010 Completed Work To Date

DEV-010 is the public website final audit and release-preparation phase. The following scoped follow-up missions are completed, committed and pushed:

- `DEV-010.1` fixed verified public release issues in metadata, contact-form clarity and localized content.
- `DEV-010.2` clarified SaaS preview claims and contact/demo behavior so the public site does not imply that backend, billing, payments, live data or a real submission endpoint already exist.
- `DEV-010.3` optimized homepage photographic assets to WebP and kept runtime image references aligned.
- `DEV-010.4` finalized favicon, app icons, Apple icon and Open Graph/Twitter preview assets using the EcoWash water mark.

Latest completed DEV-010 commit:

- `6ef5344 DEV-010.4 feat: replace site icons with EcoWash water mark`

Current DEV-010 state:

- Release-ready, deployment deferred.
- Lint and build have passed in the validated DEV-010 state.
- Production deployment is deferred until domain selection and purchase.
- SaaS foundation through APP-008.1 is implemented locally in the repository.
- Supabase EcoWash Staging is connected.
- The five approved migrations have been applied successfully to staging.
- Local and remote migration histories were aligned through APP-008.1 before smoke.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` Storage bucket exists and is private with 1 MB image limit.
- First owner Auth user, profile, organization, location and owner membership exist in staging.
- APP-001 is approved.
- APP-002 is completed and pushed.
- APP-003 is completed and pushed.
- APP-004 is completed and pushed.
- APP-005 is completed and pushed.
- APP-006 is completed and pushed.
- APP-007 is completed and pushed.
- APP-008 is completed and pushed.
- APP-008.1 is completed and pushed.
- INFRA-001 staging bootstrap is completed.
- AUTH-001 is completed and pushed.
- AUTH-001.1 is completed and pushed.
- AUTH-001-E2E is completed; owner password recovery, login and `/it/app` access were verified.
- UX-001 is completed and pushed.
- INFRA-001-SMOKE passed on EcoWash Staging and is committed at `f94df88`.
- INFRA-001.1 reconciled migration history after the manual SQL correction used during smoke.
- UX-002 is completed and pushed through UX-002.5.
- UX-002.1 added localized protected-app entry from desktop and mobile public navigation.
- UX-002.2 refined the protected app shell, mobile navigation, active states and internal header.
- UX-002.3 improved dashboard hierarchy and quick actions using existing dashboard data only.
- UX-002.4 reorganized order detail information architecture without changing order logic.
- UX-002.5 completed the final responsive/accessibility pass for contrast and touch targets.

## PRODUCT-001 Commercial Readiness State

PRODUCT-001 compares documentation against code, migration, route, component, Server Action and smoke evidence. The current app is a validated staging MVP, not yet a production-commercial product.

Implemented features:

- multilingual public website
- protected app entry from public navigation
- Supabase Auth login, logout and password recovery
- tenant foundation with organizations, locations, profiles and memberships
- customers and properties
- service catalog and standard prices
- orders, order items, totals and discounts
- production workflow and status history
- pickup and delivery
- manual payments with derived payment summary
- private order photos with short-lived signed URLs
- operational dashboard using real tenant data
- organization timezone for dashboard day windows
- Production Queue
- Delivery Queue
- production and logistics assignment
- All, Assigned to me and Unassigned queue filters
- owner-only staff access management, invitations, activation, deactivation and organization-membership removal
- secure customer portal under `/[locale]/portal`
- customer-scoped overview, order list, order detail, pickup/delivery, essential history and customer-visible photos
- owner/manager customer access management with resend, reset password and rate-limit handling
- first real staging smoke baseline through order `EW-000001`

Partially implemented features:

- service catalog and standard prices exist, but customer/property override pricing remains future scope
- workflow history and payment/logistics actor fields exist, but no general user-facing audit log module exists
- dashboard, Daily Close and Operational Alerts summarize operations, but open balance reports and exports are not implemented

Missing commercial-readiness features:

- production deployment readiness and domain/environment decision, deferred until pilot product completion
- repeatable smoke/regression checklist for release
- organization and location settings UI
- global search
- structured notes and issues
- daily payment close and open balance reports
- CSV export for accounting or operational handoff
- online payments, formal e-invoicing/advanced fiscal PDFs, notifications and mobile app

Priority classification:

| Priority | Meaning | Features |
| --- | --- | --- |
| P0 | Required before commercial pilot | UX-002, SEC-001, PILOT-001 and staging release validation completed; QA-001 pending |
| P1 | Required for first paid internal operations | ORG-001, CATALOG-002, SEARCH-001, AUDIT-001 |
| P2 | Operational/commercial differentiators after portal MVP | REPORT-001, REPORT-002, EXPORT-001, QR-001 |
| P3 | Future growth after internal stability | PAY-001, DOC-001, NOTIFY-001, MOBILE-001, OCR-001, ANALYTICS-001, OFFLINE-001, REALTIME-001, EDGE-001 |

M1 — Commercial Pilot Baseline:

- UX-002 app layout/dashboard refinement — completed
- SEC-001 Supabase security audit, remediation and authenticated mutation regression — completed
- PILOT-001 commercial pilot portal scope and route architecture — architecture approved
- RELEASE-001 production deployment readiness — staging complete; production deferred
- RELEASE-001.0 canonicalize release readiness plan and blockers — completed
- RELEASE-001.1 staging hosting and environment contract — completed
- RELEASE-001.2 staging deployment rehearsal — completed; staging Auth validated
- RELEASE-001.3 production Supabase and environment design — completed
- QA-001 repeatable smoke/regression checklist — planned
- ORG-001 organization/location settings — planned
- OPS-001.1 Production Queue MVP — completed
- OPS-001.2A Completed logistics corrections — completed
- OPS-001.2B Delivery Queue MVP — completed
- OPS-001.3 Work Assignment MVP — completed
- OPS-001.4 Staff Management MVP — completed
- PORTAL-001 / PORTAL-001.1 Secure Customer Portal MVP — completed
- PORTAL-002.1 Customer Order Request + Pickup — completed; `EW-000005` validated customer-to-operational-engine integration
- OPS-001.5 Daily Close MVP — completed
- OPS-001.6 Operational Alerts MVP — completed
- UI-001 Operational Dashboard Visual Refinement — completed
- UX-OPS-001.3 through UX-OPS-001.8 operational workspaces, owner control and access management — completed
- UI-003 operational CTA consistency — completed
- PILOT-002 or M1 First Laundry Operational Pilot — planned after release, QA and approved operational closeout support

PILOT-001 planning scope:

- Administrative dashboard: owner/manager overview for daily operations, balances, queues and attention records.
- Processing portal: staff-focused production queue for order intake, item handling, status movement and issue visibility.
- Delivery portal: pickup/delivery task flow for assigned logistics work, completion states and customer/property context.
- Customer portal: controlled customer-facing order visibility and service-request surface, scoped to pilot needs and designed separately from staff access.
- Define roles, permissions, route architecture, dependencies, implementation order and acceptance criteria.
- Do not implement routes, UI, schema, migrations, policies or Supabase changes in PILOT-001.

PILOT-001 canonical decisions:

- M1 internal roles stay `owner`, `manager` and `staff`; operational access is further constrained by centralized capabilities.
- `/[locale]/app` remains an owner/manager dashboard surface; staff is redirected server-side to `/[locale]/app/work` before dashboard data loads.
- Current operational routes include owner/manager `/[locale]/app/control` and staff-focused `/[locale]/app/work`, `/work/pickups`, `/work/production`, `/work/quality` and `/work/deliveries`, all under the localized app prefix.
- Customer routes are `/[locale]/portal`, `/[locale]/portal/orders`, `/[locale]/portal/orders/[orderRef]`, `/[locale]/portal/requests/new` and `/[locale]/portal/access`.
- PORTAL-002.1 uses customer-safe RPCs for server-side current pricing, active customer-property isolation, atomic order/items/history/pickup creation and request-id idempotency.
- Customer access uses Supabase Auth magic link/OTP plus a future customer-user link; magic link is authentication, not authorization.
- Customer portal must not use `organization_memberships`, must not add `customer` to `app_role`, must not use public order tokens as the primary M1 model and must not call internal staff RPCs directly.
- Location scope is one organization and one operational location for M1; the model is location-aware, while location-based authorization is future work.
- Owner has full tenant and Staff Access Management control; manager has operational supervision without Staff Access Management; staff requires both the relevant capability and assignment.
- Staff cannot apply discounts, void/refund payments or access catalog/settings. Delivery assignment/scheduling are owner/manager capabilities; delivery status transitions are for assigned staff, manager and owner. Staff payment recording is conditional and must be decided in OPS-002.
- UI hiding is not authorization; Server Actions/RPCs must enforce capability checks.

Operational pilot definition:

- `PILOT-002` or the M1 First Laundry Operational Pilot is the real pilot execution after planning, release readiness, QA and approved MVP portal implementation.

Staging state:

- Vercel project `ecowash-phoenix-staging` is online at `https://ecowash-phoenix-staging.vercel.app`.
- The staging project uses the configured main target for automatic deploys from `main`.
- Indexing is disabled; `/robots.txt` disallows crawling.
- Supabase Auth staging is configured and validated.
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only, not public, not tracked and used for staff invitations and customer access management.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is server-side only on staging for customer portal review and must not be enabled in future real production.
- PORTAL-001 customer test fixture remains active for review; do not document its email, UUID or credentials.
- PORTAL-002.1 migrations `20260823000100` and `20260823000200` are applied to staging and aligned; `EW-000005` is the successful E2E validation order.
- Portal Auth/access hardening is complete; no Portal flow depends on global Auth `listUsers`, and external Auth/email failures are surfaced without browser 500s.
- Next known Portal work is customer address flexibility and delivery preferences. Clear owner/manager Customers navigation remains a separate UX backlog item.

Production state:

- No real production Supabase project, Vercel project, domain, DNS or environment has been created.
- Production is deferred until the pilot product is functionally complete.

M2 — First Paid Operations:

- ORG-001 organization/location settings
- CATALOG-002 catalog hardening
- SEARCH-001 global search
- AUDIT-001 audit trail

M3 — Operational Scale And Management Control:

- REPORT-001 daily payment close
- REPORT-002 open balance report
- EXPORT-001 CSV export
- QR-001 PII-safe QR lookup

Commercial scope guard:

- customer portal is now explicitly reprioritized into M1 pilot scope, but online payments, formal e-invoicing/advanced fiscal PDFs, notifications, native mobile, OCR, advanced analytics, offline mode, Realtime and Edge Functions remain deferred unless separately approved
- do not combine currencies in financial reporting
- do not expose service-role credentials or privileged membership controls to browser code
- keep production, fulfillment, payment and issues as independent dimensions

## APP-007 Implementation State

APP-007 implements photos, pickup, delivery and manual payment foundations in implementation review:

- versioned migration for `pickups`, `deliveries`, `payments` and `order_photos`
- private Supabase Storage bucket `order-media`
- tenant-scoped Storage policies using `organization_id/order_id/random_uuid.ext`
- short-lived signed URLs generated on demand
- 1 MB JPEG/PNG/WebP upload path through Server Actions
- narrow PostgreSQL RPCs for logistics save/transition, payment record/void/refund and photo metadata registration/deactivation
- derived read-only payment summary from order total and valid payment records
- order detail sections for pickup/delivery, payments and order photos
- translation keys for English, Spanish, Italian, French and German

APP-007 keeps production, fulfillment and payment separate. `production_status = completed` still means only that production work is finished; delivery and payment can remain pending. Manual payment status is derived from confirmed and refunded payment records, void payments do not count, and overpayment is rejected for the MVP.

APP-007 does not implement analytics, push notifications, QR, OCR, fiscal invoices, PDF generation, online payment providers, customer portal, mobile app, Realtime, Edge Functions or APP-008 dashboard analytics.

APP-008 is completed and pushed.

## APP-008 Implementation State

APP-008 implements a protected operational dashboard overview:

- tenant-scoped summary metrics for open, late, express, on-hold and ready orders
- derived balance due total from valid manual payment records
- production, ready and on-hold queues with links to real orders
- pickup and delivery tasks scheduled for the organization timezone day window after APP-008.1
- logistics attention for overdue scheduled/in-progress pickup and delivery tasks
- payment overview and balances requiring attention
- recent activity from status history, payments, completed logistics tasks and photo uploads
- localized dashboard copy in English, Spanish, Italian, French and German

APP-008 does not add migrations, analytics forecasts, BI charts, exports, fiscal reporting, Realtime, notifications, customer portal or mobile app.

APP-008.1 added `organizations.timezone` with default `Atlantic/Canary` and uses it for dashboard “today” windows. The timezone is read server-side from membership context, validated at runtime with `Intl.DateTimeFormat`, falls back to `Atlantic/Canary`, converts local day boundaries to UTC and keeps the daily payment aggregate reserved to owner/manager.

APP-008 financial aggregates are role-limited in the server payload: owner/manager receive global balance and payment counts, while staff receives only per-order collection balances and statuses. Cross-currency totals remain separated by currency.

## INFRA-001 Staging Bootstrap State

INFRA-001 connected EcoWash Phoenix to Supabase EcoWash Staging and completed the initial database/bootstrap work:

- `.env.local` configured locally and ignored by Git.
- Supabase CLI login completed.
- Repository linked to staging.
- Migration dry-run passed.
- Five approved migrations applied successfully.
- Local and remote migration history aligned through APP-008.1 before the smoke corrective SQL.
- 15 tables verified in the Dashboard.
- `order-media` bucket created, private and limited to 1 MB.
- Bucket MIME allowlist: `image/jpeg`, `image/png`, `image/webp`.
- First owner Auth user created.
- `auth.users -> profiles` trigger verified.
- Organization `EcoWash La Tejita` created.
- Primary location created.
- Active owner membership created.
- Bootstrap verification queries passed.

Applied migrations:

- `20260727000100_app_003_tenant_foundation.sql`
- `20260728000100_app_005_customers_properties.sql`
- `20260728000200_app_006_orders_workflow.sql`
- `20260728000300_app_007_logistics_photos_payments.sql`
- `20260728000400_app_008_1_organization_timezone.sql`

Do not reapply these migrations. Do not run `supabase db reset --linked`.

## AUTH-001 Implementation State

AUTH-001 implemented password recovery and password update:

- localized forgot-password link from login
- `/{locale}/forgot-password`
- Supabase recovery email request
- `/{locale}/update-password`
- recovery code exchange through SSR
- temporary recovery cookie/session guard
- new password and confirmation form
- `supabase.auth.updateUser`
- sign-out after successful update
- login redirect after success
- translations for `en`, `es`, `it`, `fr`, `de`
- explicit handling for Supabase email rate-limit responses
- anti-enumeration recovery copy

AUTH-001 quality gates passed:

- `npm run lint`
- `npm run build`
- `git diff --check`
- translation parity

AUTH-001.1 corrected the residual forgot-password fall-through so non-rate-limit Supabase errors redirect to `temporaryError` instead of `sent`.

Real recovery E2E is complete: the owner password was updated, login succeeded and the real dashboard opened at `/it/app`.

## UX-001 Implementation State

UX-001 completed and pushed the protected application shell and handover state:

- dedicated full-height protected app shell under `/[locale]/app`
- protected navigation visually separated from the public website
- dashboard KPI summary rendered as top-level metric tiles instead of nested cards
- provisional dashboard foundation copy removed from `en`, `es`, `it`, `fr` and `de`
- application data logic unchanged
- no database, migration, Supabase remote or dependency changes

## INFRA-001-SMOKE State

INFRA-001-SMOKE validated the first real operational MVP path on EcoWash Staging:

- owner logout/login and protected app shell
- customer and property flow
- service price flow
- order creation and detail access
- order item creation, edit and removal
- production transitions through ready
- pickup and delivery completion
- partial and final cash payments
- photo upload and preview
- dashboard coherence after real activity

Result:

- `PASS WITH NON-BLOCKING ISSUES`

Corrective work committed in `f94df88`:

- `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql` fixes `app_current_organization_id()` and `create_order()` without editing prior migrations; the retest validated order creation on staging.
- Order, pickup and delivery Supabase selects now use explicit foreign-key embeds where PostgREST saw multiple relationships to `profiles`.
- Order item UI blocks repeated submits immediately and shows only one edit form at a time.
- Diagnostic order-create logging was reduced to a production-safe error code only.

Smoke staging data remains present for UX and follow-up validation.

Migration history state:

- Supabase migration history reconciled successfully on 2026-07-30.
- The corrective SQL was applied manually in Supabase SQL Editor during smoke, and INFRA-001.1 reconciled the matching migration history entry.
- Do not rerun the corrective migration.

INFRA-001.1 read-only verification:

- `order-media` bucket exists, is private, has a 1 MB limit and allows JPEG, PNG and WebP.
- Smoke customer, property, service, order `EW-000001`, one active item, total `25,00 EUR`, production ready, completed pickup, completed delivery, payments totaling `25,00 EUR`, zero balance and one intake photo were verified.

SEC-001 completion state:

- SEC-001 diagnostic audit found excessive function/table privileges, anonymous RPC exposure, an exposed internal totals helper and Storage object SELECT not requiring active photo metadata.
- SEC-001.1 applied `20260801000100_sec_001_1_security_remediation.sql` on staging, hardened function grants, reduced table privileges, kept authenticated RPC allowlisting explicit and required active `order_photos` metadata for `order-media` SELECT.
- SEC-001.2 authenticated mutation regression passed with rollback-only tests for the mutative RPCs used by the app. The smoke order remained unchanged.
- Anonymous RPC calls are blocked, internal helpers are not client-executable, RLS tenant isolation remains intact and Storage reads are limited to active metadata in the authorized tenant.

OPS-001.5 completion state:

- `OPS-001.5 — Daily Close MVP` is completed and pushed in `48cd1a1`.

OPS-001.5 added `/[locale]/app/daily-close` for owner and manager. It shows orders completed today, orders still open, paused orders, late orders, unfinished pickups and deliveries, missing or partial payments, operational anomalies and direct order links. It uses the organization's timezone, filters all queries by `organization.id`, requires membership and redirects staff to access-denied.

Validation passed: real owner access, mobile layout, counts/sections, static owner/manager/staff guard review, static cross-tenant filtering review, static order-link review, lint, build, diff-check, staging deploy, unauthenticated safe redirect and robots `Disallow: /`.

Still to verify when dedicated accounts are available: real manager access, real staff denial and real order-link click with a dedicated session. These are not FAIL results and are not blocking.

OPS-001.6 completion state:

- `OPS-001.6 — Operational Alerts MVP` is completed and pushed in `8ce8a8e`.

OPS-001.6 also added `/[locale]/app/alerts` for owner and manager. It shows late orders, on-hold orders, open unassigned orders, imminent and overdue pickups/deliveries, missing or partial payments and logistics assignment anomalies. It uses organization timezone, severity counts, a navigation badge, direct order links, deduplication and organization-scoped queries.

Validation passed: real owner access, local UI review, badge/page total consistency, severity counts and urgency ordering, duplicate review, mobile layout, order links, lint, build, diff-check, staging deploy, unauthenticated safe redirect and robots `Disallow: /`.

Manager Test access and real staff denial are validated for Operational Alerts.

Current resume task:

- preserve the validated operational fixtures, account purposes and customer-created `EW-000005`
- scope customer address flexibility and delivery preferences as separate future Portal increments
- keep clear Customers access in owner/manager navigation as a separate UX backlog item
- do not start PORTAL-002.2 without explicit Product Owner approval

Production remains deferred until the pilot product is functionally complete. The real operational pilot must not use the `PILOT-001` identifier. Track that later as `PILOT-002` or as the M1 First Laundry Operational Pilot.

## APP-002 Documentation State

APP-002 defined the initial order domain and database design for the future EcoWash MVP. It documents:

- organization-scoped, multi-tenant-ready data ownership
- owner, manager and staff roles for the MVP
- customers, properties, services, prices, orders and order items
- separated production, fulfillment, payment and issue models
- optional pickup and delivery per order
- manual payments and derived payment state
- order photos and private storage ownership principles
- RLS strategy and APP-003 security invariants
- audit log boundaries

APP-002 did not implement code, migrations, Supabase configuration, authentication, database tables or a SaaS dashboard.

## APP-003 Implementation State

APP-003 implements the Supabase tenant foundation only:

- versioned Supabase local configuration
- environment variables for Supabase URL and anon key
- browser and server Supabase client factories
- PostgreSQL tenant root table `organizations`
- operating site table `locations`
- application profile table `profiles`
- organization membership table `organization_memberships`
- MVP role enum for `owner`, `manager` and `staff`
- PostgreSQL helper functions for membership and role checks
- initial RLS policies for foundation tables

APP-003 does not implement login UI, signup UI, reset password, protected dashboard, customers, properties, services, orders, order items, payments, order photos, operational Storage buckets, pickup/delivery, notifications, OCR, PDF, Realtime, Edge Functions, customer portal or mobile app.

## APP-004 Implementation State

APP-004 implements authentication and role guards only:

- localized login route
- email/password login through Supabase SSR
- server-side logout
- session refresh in the existing Next.js proxy middleware
- protected dashboard route under `/[locale]/app`
- server-side current user, profile and membership loading
- server-side role helpers for `owner`, `manager` and `staff`
- access-denied route for authenticated users without operational access
- manual first-owner bootstrap documentation

APP-004 does not implement public signup, reset password, magic link, OAuth, MFA, customers, properties, services, orders, payments, order photos, pickup/delivery, Realtime, Edge Functions, customer portal or mobile app.

## APP-005 Implementation State

APP-005 implements the customers and properties module only:

- versioned migration for `customers` and `properties`
- customer type enum for `individual` and `business`
- property type enum for `apartment`, `holiday_home`, `hotel`, `business` and `other`
- tenant-scoped customer and property tables with RLS
- composite property/customer tenant foreign key
- logical deactivation through `is_active`
- protected customer list, create, detail and edit routes
- protected property create, detail and edit routes
- customer search and active/inactive filtering
- localized UI text in all five existing locales

APP-005 does not implement services, pricing, orders, order items, payments, order photos, operational Storage buckets, pickup/delivery, notifications, OCR, PDF, Realtime, Edge Functions, customer portal or mobile app.

## APP-006 Implementation State

APP-006 implements orders and production workflow only:

- versioned migration for `services`, `service_prices`, `orders`, `order_items` and `order_status_history`
- service unit types for weight and piece services
- standard service pricing with order item snapshots
- server-side order number generation
- atomic RPCs for order creation, item mutation, discount update and production status transitions
- append-only production status history
- protected services and orders dashboard routes
- localized UI text in all five existing locales

APP-006 does not implement pickup, delivery, payments, order photos, proof photos, QR, OCR, notifications, invoices, PDFs, Realtime, Edge Functions, customer portal, mobile app or advanced analytics.

## Current Route Architecture

- `src/app/[locale]/`
- `src/app/[locale]/contact/`
- `src/app/[locale]/not-found.tsx`
- `src/app/[locale]/[...not-found]/page.tsx`
- `src/app/robots.ts`
- `src/app/sitemap.ts`

## Current Component Areas

- `src/components/`
- `src/components/home/`
- `src/components/contact/`

## Current i18n Areas

- `src/i18n/en/`
- `src/i18n/it/`
- `src/i18n/es/`
- `src/i18n/fr/`
- `src/i18n/de/`

## Current Public Website Status

- Homepage: complete first version
- Homepage visual enrichment: complete first version
- Contact page: complete presentation layer
- Official EcoWash logo: integrated
- Header and Footer: responsive and localized
- Navigation: localized homepage anchors and contact route
- Homepage anchors: `solutions`, `services`, `industries`, `value`, `principles`, `contact`
- Hero, Services, Industries and Final CTA: optimized WebP photographic imagery integrated
- Operational benefit band: integrated
- SEO metadata: multilingual metadata, canonical and alternate links configured
- Brand/social assets: favicon, site icon, Apple icon and Open Graph/Twitter preview configured
- Sitemap: configured
- Robots: configured
- Not-found: localized experience configured
- Demo form backend: not implemented
- Public secondary pages: not implemented
- Deployment: deferred until production domain selection and purchase

Current routes:

- `/en`
- `/it`
- `/es`
- `/fr`
- `/de`
- `/en/contact`
- `/it/contact`
- `/es/contact`
- `/fr/contact`
- `/de/contact`

Supported locales:

- `en`
- `it`
- `es`
- `fr`
- `de`

## Final Homepage Image Assets

The approved homepage image set is present, integrated and committed at these final paths:

Hero:

- `public/images/home/hero/industrial-laundry-background.webp`
- `public/images/home/hero/folded-white-linen.webp`
- `public/images/home/hero/folded-green-textiles.webp`

Services:

- `public/images/home/services/industrial-laundry.webp`
- `public/images/home/services/dry-cleaning.webp`
- `public/images/home/services/ironing-finishing.webp`

Industries:

- `public/images/home/industries/hotel-resort.webp`
- `public/images/home/industries/vacation-rental.webp`
- `public/images/home/industries/professional-laundry.webp`

Final CTA:

- `public/images/home/cta/green-linen-texture.webp`

These assets are real non-empty WebP files. They are integrated through Next.js Image with preserved aspect ratios. Decorative Hero imagery uses empty alt text. Services and Industries imagery uses translated alt text. Crop and object-position choices are deliberate for desktop, tablet and mobile layouts. Placeholder SVGs are not used as visible replacements where final photographic assets exist.

## Current Brand and Social Assets

The current site icon and social-preview set is committed at:

- `public/brand/ecowash-logo.png` — official full EcoWash logo used in Header, Footer and DashboardPreview
- `public/brand/ecowash-product-mark.svg` — master vector water mark for favicon/app/social assets
- `src/app/favicon.ico` — multi-size favicon
- `src/app/icon.png` — 512x512 site icon
- `src/app/apple-icon.png` — 180x180 Apple touch icon
- `public/social/ecowash-og.png` — 1200x630 Open Graph and Twitter preview image

The DEV-010.4 mark follows the Product Owner reference direction: green side form, blue central drop, blue lower wave and three bubbles. It does not use the old "EcoWash La Tejita" lockup, the old URL, or embedded raster artwork. Metadata paths are configured and verified for `/favicon.ico`, `/icon.png`, `/apple-icon.png` and `/social/ecowash-og.png`.

## Current Limitations

- Supabase tenant foundation exists
- Login UI exists
- Protected dashboard shell exists
- Customers/properties/services/orders/workflow/logistics/photos/payments/dashboard foundations exist
- Supabase Staging is connected and bootstrapped
- First real owner login after password recovery is complete
- First real operational smoke test passed on staging and corrective code is committed
- Supabase migration history reconciled successfully on 2026-07-30
- Staging Vercel deployment is online and deploys automatically from `main`
- No public signup
- No real contact-form transmission
- No public contact-form email sending
- No analytics
- No billing
- No Realtime dashboard
- No production deployment
- No production domain selected or purchased
- No completed SaaS platform
- No Docker
- No pricing, legal or social pages
- No unsupported metrics, customer logos, certifications or marketing claims

## Important Project Rules

- One mission per commit
- Codex implements
- ChatGPT performs architectural review
- Product Owner approves
- No commit before approval
- No unnecessary Markdown files
- No Docker unless explicitly approved
- No new dependencies without justification
- No unsupported marketing claims
- No fake backend behavior
- No accidental reset of uncommitted approved work
- No hardcoded visible strings
- Identical translation-key structures
- Centralized design tokens must be reused
- Documentation-only commits must not include application changes
- Docs remain the single source of truth for architecture and business decisions
- No redesign of approved areas without a verified defect
- Check worktree before each mission
- Confirm local and remote `main` synchronization before new implementation

## Next Session

Restart phrase:

“Buongiorno, riprendiamo EcoWash Phoenix da PAYMENTS-ONLINE-001 core completato e avviamo PRINT-001.”

Exact starting state:

- Branch `main`
- Working tree expected clean
- MANUAL-QA-FIX-001 is completed in `b7ac1e5`; Portal support stays under `/[locale]/portal/support`, POS appears once, and the active till query names `pos_sessions_location_same_org`
- PAYMENTS-ONLINE-001 application foundation is completed in `a0f88c5`; migrations `20260828000200` and `20260829000100` are aligned, EcoWash remains OFF/unconfigured, and real-provider status is `PROVIDER CONFIGURATION REQUIRED`
- The order discount is a monetary `discount_amount`, not a percentage; no historical financial data was changed
- Rollback-only staging E2E proved EUR 10.00 outstanding → EUR 10.00 cash payment → EUR 0.00 outstanding, with Customer Account, Billing and expected cash delta EUR 10.00; role, capability, entitlement and tenant isolation passed with zero QA fixtures
- POS-001 is completed in `28b5e26`, applied, validated and pushed; local `main` and `origin/main` are expected synchronized
- QA-PRODUCT-001 passed 143/143 focused tests plus the rollback-only master staging scenario; no application fix or migration was required
- Interactive authenticated visual QA was unavailable; the reported external-PC loading issue was not reproduced, while current staging root and protected routes returned healthy 200/307 responses
- Current release state is staging online and validated; production deployment still deferred
- Production domain selection and purchase are still pending
- PRODUCT-001 is completed and pushed
- UX-002 is completed and pushed through UX-002.5
- UI-001, UX-OPS-001.3 through UX-OPS-001.8, UI-003 and the capability-aware assignment/access hardening are completed
- Pickup, Production, Quality & Packing and Delivery passed end to end with their dedicated test accounts and fixtures
- Resend Custom SMTP is operational; do not store API keys, SMTP passwords, tokens or access links in documentation
- Customer-created `EW-000005` validates the customer → operational order → pickup path
- PORTAL-002.1 migrations `20260823000100` and `20260823000200` are applied to staging and aligned
- CUSTOMER-ACCOUNT-001 migration `20260826000100` is applied to staging and aligned; Owner/Manager/Staff and tenant-isolation E2E passed with exact financial reconciliation and zero remaining temporary fixtures
- CUSTOMER-LIFECYCLE-001 migration `20260826000200` is applied to staging and aligned; Owner/Manager transitions, Staff denial, tenant isolation, Portal revocation and inactive-order rejection passed with zero remaining temporary fixtures
- BILLING-001 migration `20260826000300` is applied to staging and aligned; invoice numbering, exact totals/payment/outstanding, Owner/Manager access, Staff denial and tenant isolation passed with zero remaining temporary fixtures
- UI-FIX-001 removed public marketing chrome from authenticated shells and verified Owner/Manager assignment of active Portal-hidden tenant segments; EcoWash currently has no persisted segment records
- PRICING-SEGMENTS-001 migration `20260827000100` is aligned; precedence is segment override → organization/location base, Portal and internal orders share server resolution, historical order/invoice snapshots are preserved, and E2E fixtures rolled back completely
- ENTITLEMENTS-001 migration `20260827000200` is aligned; stable feature access is separate from tenant roles, tenant Owner cannot self-upgrade, EcoWash retains live modules, and Billing/pricing/branding data remains non-destructive when disabled
- PLATFORM-ADMIN-001 migration `20260827000300` is aligned; Platform Admin is outside tenant roles, cross-tenant mutations are audited, suspension is non-destructive and staging E2E left no persistent test identities
- POS-001 migrations `20260827000400` and `20260828000100` are aligned; till lifecycle, partial/mixed payments, refunds, exact reconciliation, idempotency, Staff capability, entitlement denial and cross-tenant isolation passed with rollback-only fixtures
- Anonymization and permanent customer deletion remain unavailable by policy; formal e-invoicing and full accounting are not implemented
- Customer address flexibility and delivery preferences are known future Portal work; owner/manager Customers navigation clarity is a separate UX backlog item
- Do not modify approved migrations unless a specific implementation task authorizes it
- Do not use Docker unless a new decision explicitly approves it
- Do not put service-role keys in browser-exposed code or env vars
- Do not apply migrations or alter Supabase remote state during RELEASE-001
- Do not run `supabase db reset --linked`
- Keep one task per commit
- Preserve the validated capability-plus-assignment authorization model

First checks:

1. Run:
   - `git status --short`
   - `git branch --show-current`
   - `git log -10 --oneline --decorate`
   - `git ls-remote origin refs/heads/main`
2. Read:
   - `README.md`
   - `docs/00_START_HERE.md`
   - `docs/00_START_HERE/SESSION_HANDOVER.md`
   - `docs/04_ARCHITECTURE/Security.md`
   - `docs/03_DATABASE/Database_Design.md`
   - `docs/06_ROADMAP/Project_Status.md`
   - `docs/06_ROADMAP/Milestones.md`
3. Start only `PRINT-001`; keep real provider configuration, barcode, accounting, e-invoicing, onboarding and subscription scope separate.
4. Preserve the completed lifecycle rule: inactive customers retain history, lose Portal access and cannot create new orders.
5. Reuse the validated operational fixtures and avoid creating additional fixtures unless a verified regression gap requires one.
6. Keep the Product Owner's technical burden minimal and keep one task per logical commit.
