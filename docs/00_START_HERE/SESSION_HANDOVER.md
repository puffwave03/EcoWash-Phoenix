# Session Handover

Status: Active

Date: 2026-08-21

Approximate closeout time: after clean staging operational fixtures were created and verified

Session checkpoint: operational access model is implemented; Pickup passed end to end; remaining workspace tests wait on the Supabase Auth email rate limit

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

Latest approved and pushed commit: `ecf0c8a BUG-AUTH-005 fix: harden staff auth callback and rate-limit handling`

Origin/main status: local `main` and `origin/main` point to `ecf0c8a` before this documentation-only update.

Working tree status before DOCS-OPS-016: clean

Commit status: no code commit pending.

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
- ACCESS-OPS-001 — Refined owner-only staff access and membership removal
- BUG-AUTH-005 — Hardened staff Auth callback and rate-limit handling
- DEV-ENV — Next.js local development switched to Webpack for stable routing

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
- `SUPABASE_SERVICE_ROLE_KEY` is configured only server-side for staff invitations, is not prefixed with `NEXT_PUBLIC_` and is not tracked in Git.
- `ENABLE_STAGING_CUSTOMER_PREVIEW=true` is configured only as a server-side Vercel staging variable for the customer portal review helper.
- Customer portal staging validation passed with no HTTP 500: protected portal routes, customer `/app` denial and customer-scoped order access were verified.
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

## Migration History State

Supabase migration history reconciled successfully on 2026-07-30.

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
- secure customer portal routes under `/[locale]/portal`
- customer overview, order list and order detail
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

- `owner`: full organization, staff-access and operational control; all operational capabilities are available.
- `manager`: operational supervision, without Staff Access Management.
- `staff`: only work allowed by both an active organization membership, the required capability and the matching assignment; no Staff Access Management.
- `customer`: separate portal user linked to `customers`, never an `organization_memberships` role.

Test data notes:

- Capability values are `pickup`, `production`, `quality`, `delivery` and `supervision`.
- Pickup passed end to end with Speed, including assignment persistence and visibility in Pickup Workspace and My Day.
- `TEST-PICKUP-01` is assigned to Speed.
- `TEST-PRODUCTION-01` is assigned to Production Test.
- `TEST-QUALITY-01` and `TEST-DELIVERY-01` are assigned to EcoWash staff test.
- Production Test has a valid Supabase Auth record. Do not diagnose it as malformed unless new evidence appears.
- Production, Quality and Delivery real functional tests are pending only because Auth email sending is rate-limited with `429 over_email_send_rate_limit`.
- Older test orders were intentionally not deleted; safe hard cleanup would require an unnecessarily invasive administrative procedure.
- The PORTAL-001 customer test fixture remains active for review.
- Do not document credentials, email addresses, UUIDs or customer personal data.

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

Still to verify when dedicated accounts are available:

- real manager access
- real staff denial

These are not FAIL results and are not blocking.

Out of scope confirmed:

- email, push, WhatsApp, SMS, webhook, cron or external automation
- persistent notification records
- new tables, migrations or RPCs
- new dependencies

## Current Block And Resume Point

Supabase Auth is currently refusing staff access and reset emails with `429 over_email_send_rate_limit`. Production Test's Auth record is valid; do not repeat the malformed-record diagnosis unless new evidence appears. Do not send repeated emails while the rate limit is active.

When the rate limit clears:

1. Send exactly one access link to Production Test.
2. Open only the newest email in a fresh incognito session.
3. Test `TEST-PRODUCTION-01` in My Day and Production Workspace.
4. Test `TEST-QUALITY-01` in My Day and Quality & Packing Workspace.
5. Test `TEST-DELIVERY-01` in My Day and Delivery Workspace.
6. Record real functional or visual defects found during those checks.
7. Avoid creating more fixtures unless a verified test gap requires one.

Production remains deferred until the pilot product is functionally complete. The real operational pilot must not use the `PILOT-001` identifier; track that later as `PILOT-002` or as the M1 First Laundry Operational Pilot.

Official working loop:

1. The Product Owner defines the desired behavior and performs simple visual or functional checks.
2. ChatGPT acts as CTO, architect and reviewer, then prepares the Codex task.
3. Codex implements and validates the scoped change.
4. Keep the Product Owner's technical workload minimal.
5. Commit, push and deploy only after Product Owner approval.

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
