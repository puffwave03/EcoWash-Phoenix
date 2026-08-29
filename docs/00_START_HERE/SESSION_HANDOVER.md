# Session Handover

Status: Active

Date: 2026-08-29

Approximate closeout time: after PRINT-001 counter printing foundation

Session checkpoint: PRINT-001 completed; BARCODE-001 is next and not started

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

Approved baseline before this mission: `af30d70 DOCS-AUTH-CONTEXT-001 docs: record platform and tenant context switching`

Origin/main status: local `main` and `origin/main` include `3318ea9 PRINT-001 feat: add counter receipt ticket and label printing`.

Working tree status before documentation closeout: application commit pushed; only the minimum handover and project-status documents are being updated.

Application closeout commit: `3318ea9 PRINT-001 feat: add counter receipt ticket and label printing`; working tree expected clean after documentation push.

---

## PRINT-001 Closeout

- Added entitlement- and POS-capability-gated receipt, internal ticket and label previews at `/[locale]/app/orders/[orderId]/print/{receipt|ticket|labels}`, with explicit browser print/Save PDF actions and no automatic printing.
- Reuses canonical order snapshots, confirmed-minus-refunded payment summary, tenant branding and organization timezone. The customer receipt excludes internal/provider data and is explicitly non-fiscal; the internal ticket is operational; labels are one per discrete unit or one per continuous line with a reserved future-code area and no barcode/QR.
- Shop Terminal success and order detail expose all three actions without mixing printing into another order/payment system. Owner/Manager inherit POS capability; Staff requires explicit POS capability; the existing server guards remain authoritative.
- Migration `20260829000300_print_001_output_entitlement.sql` is applied and aligned. It only bootstraps the existing `printing` entitlement for EcoWash with `ON CONFLICT DO NOTHING`; no schema, financial history, privileged function or grant changed.
- Rollback-only staging proof passed exact subtotal/discount/total `EUR 20.00 / EUR 2.00 / EUR 18.00`, cash/card `EUR 8.00 / EUR 10.00`, paid/outstanding `EUR 18.00 / EUR 0.00`, three discrete labels, PAY LATER `EUR 10.00 / EUR 0.00 / EUR 10.00`, tenant isolation and zero fixtures.
- Final gates: PRINT 25/25, Shop Terminal 28/28, POS 31/31, lint, production build and `git diff --check` PASS. Interactive browser control was unavailable; HTML/CSS and route rendering were verified structurally and remain subject to Product Owner visual acceptance.
- Next: `BARCODE-001`, not started. Real provider configuration, `ACCOUNTING-001` and `E-INVOICE-001` remain separate future work.

---

## Completed Milestones

- APP-002 — Order Domain and Database Design
- APP-003 — Supabase Tenant Foundation and Security Baseline
- APP-004 — Authentication and Roles
- APP-005 — Customers and Properties
- APP-006 — Orders and Workflow
- APP-007 — Photos, Pickup, Delivery and Payments
- APP-008 — Dashboard and Operational Overview
- APP-008.1 — Organization Timezone Foundation
- INFRA-001 — Supabase staging connection and migration bootstrap
- AUTH-001 — Password recovery and update flow
- AUTH-001.1 — Password reset error fall-through correction
- AUTH-001-E2E — Real password recovery and first owner login
- UX-001 — Protected app shell refinement and session handover
- INFRA-001-SMOKE — First real operational smoke test: PASS WITH NON-BLOCKING ISSUES
- INFRA-001.1 — Supabase migration history reconciliation and smoke baseline finalization
- COMM-001 — Commercialization roadmap and production sequencing
- PRODUCT-001 — Commercial readiness and feature-gap audit
- UX-002 — App landing/dashboard and operational layout refinement
- UX-002.1 — Public login entry and mobile navigation clarity
- UX-002.2 — Protected app shell and mobile navigation
- UX-002.2.1 — Mobile CTA contrast correction
- UX-002.3 — Dashboard hierarchy and quick actions
- UX-002.4 — Order detail information architecture and mobile contrast
- UX-002.5 — Final responsive and accessibility pass
- SEC-001 — Supabase security audit
- SEC-001.1 — Database privilege, RPC and Storage policy remediation
- SEC-001.2 — Authenticated mutation regression after hardening
- PILOT-001 — Commercial pilot portal scope and route architecture
- PILOT-001.1 — Pilot portal roles, routes and authorization boundaries
- RELEASE-001.0 — Release readiness plan and blockers
- RELEASE-001.1 — Staging hosting and environment contract
- RELEASE-001.2 — Staging deployment rehearsal and Auth validation
- RELEASE-001.3 — Production Supabase and environment design
- OPS-001.1 — Production Queue MVP
- OPS-001.2A — Completed logistics corrections
- OPS-001.2B — Delivery Queue MVP
- OPS-001.3 — Work Assignment MVP
- OPS-001.4 — Staff Management MVP
- PORTAL-001 / PORTAL-001.1 — Secure Customer Portal MVP
- PORTAL-002.1 — Customer Order Request + Pickup
- CATALOG-SEGMENTS-001 — Customer Segment Quick Catalogs
- CUSTOMER-ACCOUNT-001 — Customer Financial Account Experience
- CUSTOMER-LIFECYCLE-001 — Safe Customer Lifecycle Management
- BILLING-001 — Invoicing Foundation and Customer Billing
- UI-FIX-001 — Authenticated Shell Cleanup and Customer Segment Selector Verification
- PRICING-SEGMENTS-001 — Customer Segment Price Overrides with Safe Fallback
- ENTITLEMENTS-001 — SaaS Plans, Modules and Tenant Feature Access
- PLATFORM-ADMIN-001 — Phoenix SaaS Control Center
- POS-001 — Vendor-neutral Point of Sale, Cash Register and Payment Operations
- QA-PRODUCT-001 — Full Product Acceptance Test: PASS WITH NON-BLOCKING ISSUES
- POST-QA-PRODUCT-001 — Customer Account contrast, real EcoWash segment setup and verified Product Owner Platform Admin bootstrap
- AUTH-CONTEXT-001 — Platform Admin / Tenant Owner login chooser and shell-isolated context switching
- MANUAL-QA-FIX-001 — Authenticated Portal support, unique POS navigation and active till recovery
- PAYMENTS-ONLINE-001 — Provider-neutral customer online payment foundation; provider configuration required
- SHOP-TERMINAL-001 — Dry Cleaning / Laundry Counter Terminal
- PRINT-001 — Customer receipt, internal ticket and label-ready browser printing
- OPS-001.5 — Daily Close MVP
- OPS-001.6 — Operational Alerts MVP
- UI-001 — Operational Dashboard Visual Refinement
- UX-OPS-001.3 — Pickup Workspace
- UX-OPS-001.4 — Production Workspace
- UX-OPS-001.5 — Quality & Packing Workspace
- UX-OPS-001.6 — Delivery Workspace
- UX-OPS-001.7 — Owner Operations Control Center
- UX-OPS-001.8 — Access & Capabilities Management
- UI-003 — Operational primary CTA consistency
- BUG-ASSIGN — Persistent capability-aware logistics assignment
- BUG-PROD-006 — Terminal operational transition redirects
- UI-MOBILE-001 — Mobile order/logistics refinement and desktop/mobile data parity
- UI-BUG-004 — Readable desktop staff sidebar active state
- UI-FORMAT-005 — Shared quantity, currency and numeric-input formatting
- ACCESS-OPS-001 — Refined owner-only staff access and membership removal
- BUG-AUTH-005 — Hardened staff Auth callback and rate-limit handling
- AUTH-INFRA-001 — Resend Custom SMTP for Supabase Auth
- DEV-ENV — Local `next dev --webpack` avoids stale Turbopack localized Orders route manifests; the production build remains unchanged

## Supabase Staging State

Completed on EcoWash Staging:

- Supabase Staging is connected.
- `.env.local` is configured locally and ignored by Git.
- Approved migrations through APP-008.1 were applied before smoke testing.
- First owner Auth user, profile, organization, location and owner membership exist.
- Password recovery E2E completed.
- Owner login completed.
- Real dashboard visible at `/it/app`.
- UX-001 protected app shell completed.
- INFRA-001-SMOKE completed end to end.
- INFRA-001.1 completed.
- Supabase migration history reconciled successfully on 2026-07-30.
- `order-media` bucket verified as private with 1 MB image limit and JPEG/PNG/WebP allowlist.
- SEC-001.1 remediation migration `20260801000100_sec_001_1_security_remediation.sql` is applied and local/remote migration history is aligned.
- SEC-001.2 authenticated mutation regression passed with rollback-only test coverage and no smoke baseline drift.
- Vercel staging project `ecowash-phoenix-staging` is online at `https://ecowash-phoenix-staging.vercel.app`.
- The staging project's main target is configured for this staging deployment path; no real production environment has been created.
- Staging indexing is disabled and `/robots.txt` returns `Disallow: /`.
- Supabase Auth staging Site URL and Redirect URLs are configured and validated.
- Supabase Custom SMTP is enabled and operational through Resend. The verified sending domain is `ecowashlatejita.com`, the sender is `access@ecowashlatejita.com`, and a real Auth email was sent and received successfully.
- The configured Supabase Auth email rate limit is 30 emails/hour. Auth endpoint-specific throttling can still apply independently from SMTP delivery.
- `SUPABASE_SERVICE_ROLE_KEY` is configured only server-side for staff invitations, is not prefixed with `NEXT_PUBLIC_` and is not tracked in Git.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is configured only as a server-side Vercel staging variable for the customer portal review helper.
- Customer portal staging validation passed with no HTTP 500: protected portal routes, customer `/app` denial and customer-scoped order access were verified.
- PORTAL-002.1 passed Product Owner E2E: customer-created `EW-000005` is visible in both the customer Portal and hosted staff application and enters the existing Pickup engine.
- Portal Auth/access hardening is complete: direct linked-user validation replaces the fragile global Auth user list and email/Auth failures remain controlled application errors.
- Automatic deploy from `main` to the Vercel staging project is working.
- CATALOG-SEGMENTS-001 migration `20260824000600` is applied and aligned; authenticated Owner/Manager/Staff/Portal and tenant-isolation checks passed with temporary fixtures fully removed.
- CUSTOMER-ACCOUNT-001 migration `20260826000100` is applied and aligned; authenticated Owner/Manager access, Staff denial, tenant isolation and exact order/payment/balance reconciliation passed with temporary fixtures fully removed.
- CUSTOMER-LIFECYCLE-001 migration `20260826000200` is applied and aligned; authenticated Owner/Manager transitions, Staff denial, Portal revocation, inactive-order blocking and tenant isolation passed with temporary fixtures fully removed.
- BILLING-001 migration `20260826000300` is applied and aligned; authenticated Owner/Manager Billing, Staff denial, tenant isolation, definitive numbering and exact invoice/payment/outstanding reconciliation passed with temporary fixtures fully removed.
- PRICING-SEGMENTS-001 migration `20260827000100` is applied and aligned; segment override → organization/location base precedence, internal/Portal consistency, Owner/Manager access, Staff denial, tenant isolation and historical order/invoice preservation passed in rollback-only E2E.
- ENTITLEMENTS-001 migration `20260827000200` is applied and aligned; Billing, segment-pricing management and full white-label gates, Owner/Manager read-only access, Staff restriction, self-upgrade prevention, expiry, tenant isolation, EcoWash bootstrap and rollback-only fixture cleanup passed.
- PLATFORM-ADMIN-001 migration `20260827000300` is applied and aligned; isolated Platform Admin identity, cross-tenant summaries, entitlement administration, commercial labels, suspension/reactivation, audit, tenant/Portal denial and rollback-only cleanup passed.
- POS-001 migrations `20260827000400` and corrective `20260828000100` are applied and aligned; six-identity rollback-only E2E passed for till lifecycle, cash/manual-card partial and mixed payments, refunds, reconciliation, idempotency, role/capability enforcement, entitlement disable/reenable and cross-tenant denial.
- PAYMENTS-ONLINE-001 migrations `20260828000200` and corrective `20260829000100` are applied and aligned. The Portal CTA, checkout RPC and webhook settlement are gated by `payments.online` plus non-secret tenant configuration; no provider is configured and EcoWash remains OFF. Rollback-only contract E2E proved EUR 15.00 total/paid/outstanding as 15.00/15.00/0.00 with one canonical row after replay, failure with zero canonical rows, cross-customer denial and concurrent EUR 20.00 POS settlement with the external row pending `reconciliation_required`. All fixtures rolled back.
- QA-PRODUCT-001 master staging acceptance passed across nine identities/roles with temporary Tenant B, exact EUR 15.00 financial reconciliation, entitlement and suspension cycles, Tenant A/B isolation and complete rollback cleanup. Interactive authenticated visual QA was unavailable and remains a non-blocking Product Owner check.
- POST-QA-PRODUCT-001 configured four active, Portal-visible EcoWash segments using only existing categories/services and base-price fallback: Case Vacanze / Property Manager (35 explicit services, 4 categories), Hotel (9, 3), Ristorazione (3, 1) and Privati (18, 5). No segment price override was created.
- The sole verified active EcoWash Owner (`f1237796-aa9d-4069-aca2-7a926e0b241e`) was bootstrapped as an active permanent Platform Admin through `platform_admins`; the tenant Owner membership remains active and no other tenant identity gained Platform access.
- Rollback-only staging checks passed for Owner/Manager selector visibility, Manager assignment/removal, Staff and Customer restriction, tenant isolation, Platform cross-tenant reads and Portal personalization. The Portal returned 65 personalized shortcuts plus 138 remaining services, with 203 priced services total and no missing price.
- AUTH-CONTEXT-001 preserves direct context routes: `/[locale]/platform` is always guarded Platform context and `/[locale]/app` is always guarded tenant context. Dual-access login opens `/[locale]/auth/context`; each shell exposes only a compact link to the other authorized context.
- Authenticated HTTP E2E passed for Platform-only, Owner-only, dual Platform Admin + Owner, Manager, Staff and Customer identities, including both direct routes, chooser, two-way switch, Italian locale preservation and redirect-loop prevention. Temporary Platform/Owner fixtures were removed and the real Product Owner retained both permanent access records.
- MANUAL-QA-FIX-001 traced the false Closed POS state to an ambiguous PostgREST `pos_sessions → locations` embed (`PGRST201`). The query now names the composite tenant-safe FK and throws on read failure instead of degrading to Closed. A rollback-only EUR 10.00 cash payment reconciled order, Customer Account, Billing and expected cash; close/reopen, Owner/Manager, Staff capability/anti-hijack, entitlement OFF/ON and tenant isolation passed. POS was restored ON with its original source, the real till remains open and no QA session/payment/capability fixture remains.

Applied baseline migrations:

- `20260727000100_app_003_tenant_foundation.sql`
- `20260728000100_app_005_customers_properties.sql`
- `20260728000200_app_006_orders_workflow.sql`
- `20260728000300_app_007_logistics_photos_payments.sql`
- `20260728000400_app_008_1_organization_timezone.sql`

Smoke corrective migration:

- `20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql`

Security remediation migration:

- `20260801000100_sec_001_1_security_remediation.sql`

Recent operations migrations applied on staging:

- `20260802000100_ops_001_2a_fix_completed_logistics_updates.sql`
- `20260802000200_ops_001_3_work_assignment.sql`
- `20260802000300_ops_001_4_staff_management.sql`
- `20260802000400_ops_001_4_fix_staff_membership_role_variable.sql`

Customer portal migrations applied on staging:

- `20260803000100_portal_001_customer_portal.sql`
- `20260803000200_portal_001_safe_customer_rpc.sql`
- `20260803000300_portal_001_fix_customer_storage_policy.sql`
- `20260823000100_portal_002_1_customer_order_request.sql`
- `20260823000200_portal_002_1_fix_order_request_rpc.sql`

## Migration History State

Supabase migration history is aligned through `20260829000300`; SHOP-TERMINAL-001 and the additive PRINT-001 entitlement bootstrap are applied to staging.

During INFRA-001-SMOKE, the corrective SQL for `app_current_organization_id()` and `create_order()` was applied manually in EcoWash Staging through SQL Editor so the smoke test could continue. INFRA-001.1 reconciled the remote migration history so local and remote now both include `20260730000100`.

Do not rerun the corrective migration. Do not use `supabase db reset --linked`, `supabase migration up`, or `supabase db push` unless a future task explicitly approves it.

SEC-001.1 added database privilege hardening, explicit authenticated RPC allowlisting, `recalculate_order_totals(uuid)` client execution revocation, table privilege reduction and active-metadata enforcement for `order-media` SELECT. SEC-001.2 verified rollback-only authenticated mutation regression with no persistent data changes.

OPS-001.2A added the minimum migration needed to allow owner/manager corrections to completed pickup and delivery logistics without reopening logistics architecture. OPS-001.3 added assignment support for production and logistics using existing role boundaries. OPS-001.4 added staff-management and invite flows using server-only Supabase Auth Admin access.

## Current Functional State

Available now:

- public multilingual website
- Auth login, logout and password recovery
- protected dashboard
- customers, properties, services and prices
- orders, order lines and workflow statuses
- manual payments
- private order photos
- pickup and delivery logistics
- Production Queue at `/[locale]/app/production`
- Delivery Queue at `/[locale]/app/delivery`
- production and logistics assignment
- queue filters: All, Assigned to me, Unassigned
- staff management at `/[locale]/app/staff`
- owner-only invitation and access-management flow for staff and managers
- staff activation and deactivation
- centralized operational capability and assignment authorization rules
- staff legacy `/[locale]/app` server-side redirect to `/[locale]/app/work`
- hardened Auth callback for invalid links, stale sessions and email rate-limit errors
- operational Auth email delivery through Resend Custom SMTP
- secure customer portal routes under `/[locale]/portal`
- customer overview, order list and order detail
- mobile-first customer order request with server-side service pricing, customer-property isolation, pickup scheduling and idempotent creation
- customer-visible pickup, delivery and essential status history
- customer-visible order photos only
- customer-scoped isolation through separate Auth user to customer access
- customer users are excluded from `/[locale]/app`
- owner/manager customer portal access management
- customer access link resend, password reset and rate-limit handling
- localized Auth callback with SSR cookie persistence
- staging-only customer preview behind `ENABLE_STAGING_CUSTOMER_PREVIEW=true`
- Daily Close dashboard at `/[locale]/app/daily-close`
- owner/manager daily control sections for completed orders, open orders, paused orders, late orders, open logistics, payment issues and operational anomalies
- Daily Close links directly to affected orders and uses organization timezone for daily windows
- Operational Alerts dashboard at `/[locale]/app/alerts`
- owner/manager alert triage for late orders, paused orders, unassigned open orders, imminent or overdue pickups/deliveries, missing or partial payments and logistics assignment anomalies
- alert severity counts, navigation badge, deduplication, direct order links and organization-scoped data filtering
- tenant-defined customer segments such as Case Vacanze, Hotel, Ristorazione or Privati, with one optional primary segment per customer
- Owner/Manager segment management and customer assignment; Staff is denied
- personalized Portal and New Order quick catalogs that reference existing services/categories while the complete organization catalog remains available
- dated segment-specific price overrides with centralized precedence `segment override → organization/location base`; hidden/non-orderable services remain unavailable and missing overrides fall back safely
- internal order selection, Customer Portal estimates and final server-side order snapshots use the same resolver; client price tampering is overwritten by server truth
- existing order lines and Billing invoice items remain historical snapshots when segment pricing changes
- premium Owner/Manager Customer Account at `/[locale]/app/customers/[customerId]`
- server-side, per-currency lifetime order value, confirmed payments, refunds, net paid and outstanding balances using existing order/payment semantics
- bounded recent/current-year/all order and payment histories, properties, primary segment, Portal access and billing-readiness context
- Staff is denied the broad financial Customer Account; its existing operational customer context is unchanged
- Owner/Manager can safely deactivate and reactivate customers; deactivation preserves linked history, removes customers from active order selectors and atomically disables Portal access
- inactive customers cannot create internal or Portal orders; reactivation never silently re-enables Portal access
- lifecycle eligibility reports tenant-scoped dependencies server-side; anonymization and hard delete remain unavailable until a separately approved, legally and technically safe policy exists
- Owner/Manager Billing at `/[locale]/app/billing` with draft creation from one or more eligible orders, concurrency-safe definitive numbering on issue and preserved issuer/customer/line snapshots
- percentage-point tax configuration, Customer Account invoice integration, printable V1 invoice and payment/outstanding values derived from existing order-linked payment truth
- Staff Billing denial and tenant-scoped invoice/order/customer links; no formal e-invoicing compliance or full accounting is claimed
- the Billing foundation is entitlement-gated without introducing subscription logic or payment collection
- centralized stable feature keys and tenant-scoped entitlements now separate platform access from tenant roles; application logic checks features, never plan names
- Billing, segment-pricing management and advanced branding are gated in navigation, server code and database enforcement; disabling access preserves invoices, overrides and stored identity
- existing EcoWash tenants were explicitly bootstrapped for already-live modules, while tenants created after the migration receive no implicit premium access
- dedicated localized `/[locale]/platform` console with overview, bounded organization directory and organization commercial/detail controls
- Platform Admin identity is stored outside tenant memberships; Owner, Manager, Staff and Customer cannot access platform routes, RPCs or audit data
- suspension blocks tenant app, Server Actions, database API and Customer Portal while preserving data; reactivation restores normal role/entitlement access
- platform entitlement, status and commercial-label mutations are audited; impersonation, tenant deletion, subscription collection and automated plan templates are not implemented
- localized POS workspace at `/[locale]/app/pos`, entitlement-gated for Owner/Manager and Staff with explicit `pos` capability, with one open till per tenant, optional location scope and immutable close reconciliation
- cash and provider-neutral manual-card payments reuse the canonical payment ledger; partial and mixed tender are represented by separate real payment rows, refunds link to their source payment, and tenant-scoped idempotency plus database row locks protect retries and concurrent close/payment operations
- Customer Account and Billing continue to derive exact confirmed-minus-refunded values from the same canonical order-linked payment truth; staging E2E reconciled a EUR 50.00 order, EUR 20.00 cash plus EUR 30.00 card, a EUR 5.00 cash refund, expected cash EUR 115.00, counted cash EUR 114.00 and difference EUR -1.00
- receipt-ready data and a provider adapter boundary exist, but real payment-terminal integrations, Stripe Terminal, Redsys, SumUp, hardware printing, barcode workflows, full accounting and formal e-invoicing are not implemented
- authenticated `/app` and `/portal` routes now bypass public marketing chrome while preserving compact page context, organization, identity, role, account/logout controls and mobile application navigation
- the Customer Account selector correctly lists active tenant segments regardless of Portal visibility; EcoWash La Tejita currently has no real segments, so “Nessun segmento” is truthful until an Owner/Manager creates one

Next roadmap task: `BARCODE-001`, not started. PAYMENTS-ONLINE-001 core is complete but remains `PROVIDER CONFIGURATION REQUIRED`; no real sandbox or live provider is claimed.

Platform Admin bootstrap is intentionally not automatic. After verifying the intended Supabase Auth user UUID out of band, a trusted database operator inserts exactly that `user_id` into `public.platform_admins`; no tenant-facing route or RPC can perform this step. The same Auth user may also have normal tenant memberships, but the two access models remain additive and independently guarded.

```sql
insert into public.platform_admins (user_id, created_by)
values ('<verified-auth-user-uuid>'::uuid, null);
```

Commercial direction may use Base, Premium, Pro and add-ons, but packaging is intentionally not hardcoded: plan templates must resolve to stable entitlements. Tenant Owner access alone is not Platform Admin access and cannot grant paid features.

Lifecycle policy delivered by CUSTOMER-LIFECYCLE-001: `ACTIVE ↔ INACTIVE` is implemented with historical retention, Portal/order enforcement and Owner/Manager authorization. `ANONYMIZED where appropriate → HARD DELETE only when legally and technically safe` remains policy/readiness only; no anonymization or permanent deletion action exists.

Billing foundation delivered by BILLING-001: organization → customer → one or more orders → invoice/document is explicit, while existing order-linked payments remain the financial source of truth. Formal e-invoicing, credit notes and full accounting remain future approved work.

Final completed sequence for this session:

1. `CATALOG-SEGMENTS-001`
2. `CUSTOMER-ACCOUNT-001`
3. `CUSTOMER-LIFECYCLE-001`
4. `BILLING-001`
5. `UI-FIX-001`
6. `PRICING-SEGMENTS-001`
7. `ENTITLEMENTS-001`
8. `PLATFORM-ADMIN-001`
9. `POS-001`
10. `QA-PRODUCT-001`
11. `AUTH-CONTEXT-001`
12. `MANUAL-QA-FIX-001`
13. `PAYMENTS-ONLINE-001` — provider-neutral core; provider configuration required

Approved next product roadmap:

1. `BARCODE-001`
2. `ACCOUNTING-001`
3. `E-INVOICE-001`
4. `ACCOUNTING-PRO-001` — optional
5. `ONBOARDING-001`
6. future subscription/commercial billing
8. `PLATFORM-SUPPORT-001` — optional, without impersonation until separately designed

Permanent product requirements:

- premium UI is mandatory, not optional polish; Calm Operations and mobile-first usability remain the product language
- Customer Portal must continue toward consumer-grade premium UX, including stronger hero/media, richer category/service visuals, a premium order timeline and refined financial/Billing presentation
- white-label architecture remains required; EcoWash is the first tenant/reference, not hardcoded product identity
- Owner, Manager, Staff and Customer remain tenant roles; Platform Admin is separate from tenant Owner even when one Auth user holds both access records
- future accounting, POS and other optional modules may be gated by the same entitlement foundation
- no full accounting or e-invoice compliance is claimed yet
- known future visual stream: `PREMIUM-DESIGN` / `CUSTOMER-PORTAL POLISH`, including continued authenticated-app refinement

Role summary:

- `owner`: full Control Center, Orders, operational workspaces, Staff & Access, Alerts, Daily Close and capability management; all operational capabilities are available.
- `manager`: Control Center, Orders, My Day, Alerts, operational supervision and full Customer Account access; no Branding or Staff Access Management, and direct privileged access is denied or redirected.
- `staff`: capability-based navigation and assignment-scoped work; `/[locale]/app` redirects server-side to `/[locale]/app/work` before owner data loads; no Control Center, Staff Access Management or broad financial Customer Account.
- `customer`: separate portal user linked to `customers`, never an `organization_memberships` role.

Test data notes:

- Capability values are `pickup`, `production`, `quality`, `delivery` and `supervision`.
- Operational accounts are Speed for Pickup, Production Test for Production, Quality Test for Quality & Packing, Delivery Test for Delivery and Manager Test for manager validation.
- `TEST-PICKUP-01`, `TEST-PRODUCTION-01`, `TEST-QUALITY-01` and `TEST-DELIVERY-01` are the clean operational fixtures used for validation.
- Pickup, Production, Quality & Packing and Delivery all passed end to end: assignment, capability, My Day, dedicated workspace, activity detail, transitions, terminal transition and final redirect without 404.
- Older test orders were intentionally not deleted; safe hard cleanup would require an unnecessarily invasive administrative procedure.
- The PORTAL-001 customer test fixture remains active for review.
- Do not document test-account/customer email addresses, credentials, UUIDs or customer personal data; the approved SMTP sender identity above is the only intentional email address in this handover.

## Final Operational Validation

Validated consistency for all four operational workspaces:

- assignment uses the persisted profile ID and explicit profile relation
- staff capability and matching assignment are both required
- My Day and the dedicated workspace read the same operational identity
- activity detail supports the approved transitions
- terminal transitions leave detail routes that are no longer operationally valid

BUG-PROD-006 final redirects:

- Production `completed` → Production workspace
- Quality `packing → ready` → Quality workspace
- Pickup `completed` → Pickup workspace
- Delivery `completed` → Delivery workspace

BUG-ASSIGN is validated with capability-aware, organization-scoped, active-membership assignment; Pickup and Delivery use separate compatible-staff lists, the controlled select preserves the saved value, and order summary/workspace/My Day remain consistent while the activity is operational and within date rules.

UI validation completed:

- UI-003 shared high-contrast operational CTA styling across My Day and all four workspaces
- UI-MOBILE-001 responsive order/logistics layout with the same data and business logic as desktop; staff dropdown verified on iPhone staging
- UI-BUG-004 readable desktop staff sidebar active item
- UI-FORMAT-005 shared formatting: integer quantities have no unnecessary decimals, real fractional quantities keep only needed decimals, and EUR values always show two decimals

Auth hardening preserved:

- staff invitation no longer depends on Admin `listUsers` enumeration
- invalid or expired callback links clear stale browser sessions before showing an error
- a failed link for one user cannot silently appear authenticated as another cached session
- Auth throttling failures are returned as clear application messages rather than browser 500s
- passwords are never readable or stored by the application
- owner can send passwordless access links and password-reset emails without exposing generated links or tokens
- normal account removal is conservative and membership-oriented; Auth deletion remains separate technical maintenance

## INFRA-001-SMOKE Result

Final result:

`PASS WITH NON-BLOCKING ISSUES`

Validated checkpoints:

| Checkpoint | Area | Result |
| --- | --- | --- |
| 1 | Login e app shell | PASS |
| 2 | Cliente | PASS |
| 3 | Proprietà | PASS |
| 4 | Servizio e prezzo | PASS |
| 5 | Ordine | PASS |
| 6 | Item e totale | PASS |
| 7 | Produzione | PASS |
| 8 | Pickup | PASS |
| 9 | Delivery | PASS |
| 10 | Pagamento | PASS |
| 11 | Foto | PASS |
| 12 | Dashboard | PASS |
| 13 | Logout/login | PASS |

Smoke staging records retained:

- `Cliente Smoke Test`
- `Appartamento Smoke Test`
- `Lavaggio e asciugatura test`
- order `EW-000001`
- one valid order item
- total `25,00 EUR`
- production status `Pronto`
- pickup completed
- delivery completed
- two payments totaling `25,00 EUR`
- balance `0,00 EUR`
- one intake photo

Smoke records remain available on staging for UX and follow-up validation.

## Bugs Resolved During Smoke

- BUG-001 — `create_order` failed because `app_current_organization_id()` used `min(uuid)` and `create_order()` had an ambiguous `id` reference.
- BUG-002 — order list query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-003 — pickup query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-004 — delivery query failed with `PGRST201` because the `profiles` embed was ambiguous.
- BUG-005 — order item creation needed immediate submit locking to reduce repeated-submit risk.
- BUG-006 — order item editing showed too many simultaneous edit forms and save points.

## Unverified or Non-Final Items

- Negative MIME/size upload tests were not executed during smoke.
- Overpayment behavior was not documented with a definitive result.
- Payment actor visibility was not documented with a definitive result.
- `order-media` bucket privacy, file size limit and MIME allowlist were verified read-only during INFRA-001.1.
- Final smoke baseline read-only verification passed during INFRA-001.1.

## Security Notes

- Do not delete the owner Auth user.
- Do not recreate organization, location or membership.
- Do not expose service-role keys, Auth tokens, magic links or passwords in browser code, logs, docs or `NEXT_PUBLIC_*` variables.
- Do not commit `.env.local`.
- Keep `order-media` private.
- Keep `supabase/.temp/` ignored.
- Do not use Docker unless a new decision explicitly approves it.
- Keep one task per commit.
- Do not modify Supabase remote state unless a separate approved implementation task explicitly authorizes it.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is server-only and staging-only. It must not be enabled in a future real production environment.

## UX-002 Completed State

UX-002 is completed and pushed through `730bcae`.

Completed UX scope:

- localized public access to the protected login from desktop and mobile navigation
- iPhone Safari dev-origin hydration fix through Next.js dev configuration
- protected app shell, sidebar, internal header and mobile bottom navigation refinement
- active navigation states and mobile CTA contrast corrections
- operational dashboard hierarchy and quick actions
- order detail information architecture with clearer section order and sticky internal navigation
- final responsive/accessibility pass for contrast and touch targets

UX-002 did not change database schema, migrations, Supabase remote state, RPCs, Server Actions, workflow logic, pricing, payment logic, logistics logic, photo handling or authentication boundaries.

## OPS-001.5 Daily Close Result

Status: Completed and pushed.

Route:

- `/[locale]/app/daily-close`

Access and data boundaries:

- membership is required
- owner and manager are allowed
- staff is redirected to access-denied
- queries are filtered by `organization.id`
- no new migration, RPC, table or role was added

Daily Close shows:

- orders completed today
- orders still open
- orders on hold
- late orders
- pickups not completed
- deliveries not completed
- missing or partial payments
- operational anomalies
- direct order links

Validation:

- owner real access: PASS
- mobile layout: PASS
- counts and sections: PASS
- owner/manager/staff guard: PASS static review
- cross-tenant filtering: PASS static review
- order links: PASS static review
- lint/build/diff-check: PASS
- Vercel staging deployment: Ready
- unauthenticated route access: safe 307 redirect to login
- robots remains `Disallow: /`

Still to verify when dedicated accounts are available:

- real manager access
- real staff denial
- real order-link click with a dedicated session

These are not FAIL results and are not blocking.

Out of scope confirmed:

- advanced accounting
- invoices
- export
- automatic cash close
- mass updates
- new migrations
- new RPCs

## OPS-001.6 Operational Alerts Result

Status: Completed and pushed.

Route:

- `/[locale]/app/alerts`

Access and data boundaries:

- membership is required
- owner and manager are allowed
- staff is denied
- queries are filtered by `organization_id`
- no cross-tenant data is exposed
- no new migration, RPC, table, dependency or role was added

Operational Alerts includes:

- late orders
- on-hold orders
- open orders without an assignee
- pickups due within 2 hours
- overdue pickups
- deliveries due within 2 hours
- overdue deliveries
- missing or partial payments
- operational anomalies from logistics without an assignee

Rules:

- severity is `critical`, `warning` or `info`
- organization timezone is used
- due-soon means within the next 2 hours
- overdue logistics means the scheduled time is in the past and the activity is not completed
- completed or cancelled orders are excluded from lateness alerts
- orders without `due_at` are not marked late
- completed logistics are excluded
- payment residuals are clamped so they never become negative
- alerts are deduplicated

Validation:

- real owner access: PASS
- local UI review: PASS
- badge and page total: PASS
- severity counts and urgency ordering: PASS
- duplicate review: PASS
- mobile layout: PASS
- order links: PASS
- lint/build/diff-check: PASS
- Vercel staging deployment: Ready
- unauthenticated route access: safe 307 redirect to login
- robots remains `Disallow: /`
- no HTTP 500 observed
- real manager access with Manager Test: PASS
- real staff denial: PASS

These are not FAIL results and are not blocking.

Out of scope confirmed:

- email, push, WhatsApp, SMS, webhook, cron or external automation
- persistent notification records
- new tables, migrations or RPCs
- new dependencies

## Current Resume Point

There is no current SMTP delivery block. AUTH-INFRA-001 enabled Resend Custom SMTP and a real Supabase Auth email was sent and received successfully. The configured limit is 30 Auth emails/hour; endpoint-specific throttling can still apply, so access/reset actions should remain deliberate and application errors must stay user-friendly.

PRINT-001 is completed and uses browser-native printing without barcodes or hardware dependencies. Resume with `BARCODE-001`; do not reopen accepted foundations unless a reproducible defect is found:

1. Perform the separate authenticated desktop/mobile Product Owner visual check when practical; it was unavailable during automated QA.
2. If the external-PC loading observation recurs, capture exact URL, timestamp, browser and visible error before classifying it.
3. Preserve `EW-000005` as the successful PORTAL-002.1 E2E record.
4. Scope customer address flexibility and delivery preferences as separate future Portal increments.
5. Keep clearer Customers access in owner/manager navigation as a separate known UX backlog item.
6. Do not start PORTAL-002.2 until explicitly approved.
7. Record only real functional or visual defects and keep one task per logical commit.
8. Preserve the order discount as an absolute monetary amount; it is not a stored fraction or percentage.
9. Do not enable `payments.online` until an official provider adapter, tenant merchant configuration and real sandbox credentials pass signed-webhook E2E. Phoenix stores no raw card data and never trusts a redirect as confirmation.

Production remains deferred until the pilot product is functionally complete. The real operational pilot must not use the `PILOT-001` identifier; track that later as `PILOT-002` or as the M1 First Laundry Operational Pilot.

Official working loop:

1. The Product Owner defines the desired behavior and performs simple visual or functional checks.
2. ChatGPT acts as CTO, architect and reviewer, then prepares the Codex task.
3. Codex implements and validates the scoped change.
4. Keep the Product Owner's technical workload minimal.
5. Keep one task per logical commit; commit, push and deploy only after Product Owner approval.

## Resume Commands

```bash
cd /Users/cristianomegale/EcoWash-Phoenix
git status --short
git branch --show-current
git log -10 --oneline --decorate
git ls-remote origin refs/heads/main
```

Useful URLs:

```text
http://localhost:3000/it/login
http://localhost:3000/it/app
http://localhost:3000/it/app/customers
http://localhost:3000/it/app/services
http://localhost:3000/it/app/orders
http://localhost:3000/it/app/pos
http://localhost:3000/it/app/control
http://localhost:3000/it/app/work
http://localhost:3000/it/app/work/pickups
http://localhost:3000/it/app/work/production
http://localhost:3000/it/app/work/quality
http://localhost:3000/it/app/work/deliveries
http://localhost:3000/it/app/staff
http://localhost:3000/it/app/alerts
http://localhost:3000/it/portal
http://localhost:3000/it/portal/orders
http://localhost:3000/it/portal/support
```
