# Session Handover

Status: Active

Date: 2026-08-23

Approximate closeout time: after PORTAL-002.1 Product Owner E2E approval

Session checkpoint: customer order and pickup requests validated end to end against the existing operational engine

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

Approved baseline before this mission: `27b208f STAFF-POLISH-001 feat: add secure logout and user switching`

Origin/main status: local `main` and `origin/main` pointed to `27b208f` before PORTAL-002.1 closeout.

Working tree status before PORTAL-002.1: clean

Closeout commit: `PORTAL-002.1 feat: add customer order and pickup requests`; working tree expected clean after push.

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

Supabase migration history is aligned through `20260823000200`; both PORTAL-002.1 migrations are applied to staging.

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

Role summary:

- `owner`: full Control Center, Orders, operational workspaces, Staff & Access, Alerts, Daily Close and capability management; all operational capabilities are available.
- `manager`: Control Center, Orders, My Day, Alerts and operational supervision; no Staff Access Management, and direct `/[locale]/app/staff` access is denied or redirected.
- `staff`: capability-based navigation and assignment-scoped work; `/[locale]/app` redirects server-side to `/[locale]/app/work` before owner data loads; no Control Center or Staff Access Management.
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

PORTAL-002.1 is completed and Product Owner approved. Customer-created `EW-000005` validated customer → operational order → pickup integration, including server-side pricing, property isolation, atomicity and idempotency. Resume without reopening this foundation:

1. Preserve `EW-000005` as the successful PORTAL-002.1 E2E record.
2. Scope customer address flexibility and delivery preferences as separate future Portal increments.
3. Keep clearer Customers access in owner/manager navigation as a separate known UX backlog item.
4. Do not start PORTAL-002.2 until explicitly approved.
5. Record only real functional or visual defects and keep one task per logical commit.

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
```
