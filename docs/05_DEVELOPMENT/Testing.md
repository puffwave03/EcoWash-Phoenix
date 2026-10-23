# Testing

Status: Security evidence index — CTO REVIEW PASS — READY FOR COMMIT

Last reconciled: 2026-10-23; baseline `9b03b8b9e2120b1c65668da63410aa8a76c53c35`.

## Current validation policy

Follow [AGENTS.md](../../AGENTS.md) and the authorized task scope: focused checks first, broader checks only when required. This documentation mission executes no new application, PostgreSQL, staging or browser tests. Results below are previously recorded evidence. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) and [Project Status](../06_ROADMAP/Project_Status.md) own acceptance and remaining gates.

## Terminal catalog performance evidence — 23/10/2026

`TERMINAL-CUSTOMER-CATALOG-PERFORMANCE-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS`, application commit `935c0144835a1823bec0131d373b0e473f67e978`. [Focused query tests](../../tests/terminal-customer-catalog-performance-001.test.mjs): **14/14 PASS**, covering concurrent accessory reads, waiting for completion, customers with/without segment, valid empty catalogs and accessory fallback/transport behavior. The tests execute real query/presentation code with simulated Supabase reads; they do not measure staging latency. [Catalog failure/draft regressions](../../tests/terminal-catalog-failure-draft-001.test.mjs) and [segment contracts](../../tests/terminal-segment-catalog-contract.test.mjs): **30/30 PASS** combined; TypeScript, scoped ESLint and diff-check **PASS** at implementation.

Separate Product Owner staging acceptance reports loading as **“a little faster”**, without stopwatch measurements, percentage reduction or a measured final time. Further optimizations are deferred pending new evidence. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#terminal-customer-catalog-performance-001--complete--technical-pass--product-owner-uat-pass) owns the scoped closeout. No tests or UAT were repeated in this documentation mission; the future documentation commit is distinct from the application SHA.

## Terminal initial-screen evidence — 23/10/2026

`TERMINAL-INITIAL-SCREEN-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS`, application commit `c0af60a12c8149a31c73fd8c5244669bdda2d18a`. [Targeted outer-component test](../../tests/terminal-initial-screen-001.test.mjs): 19/19 PASS; pertinent workspace/draft/submission-recovery regressions: 52/52 PASS; TypeScript, scoped ESLint and diff-check PASS at implementation. The outer-component test runs real component code with simulated hooks/storage/timers, not a browser.

Separate Product Owner Phoenix Staging browser PASS covers operational opening without the empty screen, five available workspaces, simultaneous Sale 1/2 drafts, selected Sale 2 customer/cart and selection retained after reload, and sales retained after Home-return navigation. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) records the complete scoped acceptance. Logout, a new browser, storage loss and new-order creation are not established by this UAT. No tests were rerun in this documentation closeout; its future documentation commit is separate from the application SHA.

## Security evidence index

| Evidence level | Existing evidence and reference | What it establishes / limits |
| --- | --- | --- |
| Static inspection | SEC-001 RLS/grant/definer/search-path audit; the reviewed SECURITY-EVIDENCE-RECONCILIATION-001 checkpoint in the canonical documents. | Source and documented policy semantics; not fresh database execution or a complete current remote-catalog audit. |
| Automated contract and local application tests | [Platform contracts](../../tests/platform-admin-contract.test.mjs), [F01 callback](../../tests/security-auth-callback-xss-001b.test.mjs), [F02 Preview](../../tests/security-portal-preview-containment-001c.test.mjs), [F02 identity binding](../../tests/security-portal-identity-binding-001e.test.mjs). [QA-PRODUCT-001](../07_QA/QA-PRODUCT-001.md) records 143/143 focused tests, including Platform 20/20. | Source assertions and application execution with doubles have different coverage; neither proves actual PostgreSQL authorization or full browser E2E. No suites rerun here. |
| PostgreSQL with simulated identity and rollback | PORTAL-REVOCATION-LOCAL-UAT-001B scenarios A–D, recorded in the PORTAL-UAT-006 checkpoint; F04 CTO staging SQL test: each of three helpers TRUE for active / FALSE for inactive, 3/3 PASS, explicit rollback and no temporary organization residue. | SQL behavior for controlled identities and cases; F04 ran on staging but its Auth identity was simulated. Neither result proves real Auth session persistence or browser behavior. |
| PostgreSQL harness availability | [F02 identity harness](../../tests/security-portal-identity-binding-001e-postgres.test.mjs). | Uses synthetic Auth dependencies and a disposable local target. Harness existence is not proof of execution; absence of a target/skip must never be counted as PASS. |
| Authenticated staging mutation and suspension tests | SEC-001.2 rollback-only RPC regression; [QA-PRODUCT-001 controlled transaction](../07_QA/QA-PRODUCT-001.md), with nine identities/roles, capability/assignment boundaries, Tenant A/B isolation and tenant/Portal suspension/reactivation. | Previously documented database scenarios; the QA separately reports that interactive authenticated visual tooling was unavailable. |
| Real authenticated staging reads | SAAS-DEMO-TENANT-ISOLATION-001F in [Session Handover](../00_START_HERE/SESSION_HANDOVER.md): ordinary authenticated Demo Owner and EcoWash Staff sessions, own-tenant reads, foreign-ID zero-row results, plus rejected foreign-ID mutations. | Direct customer/service/order/payment isolation was tested. Does not establish assignment/capability filtering for every same-tenant Staff read. |
| Staging structural postflight | PHX-POST-F02-DOCS-001: 001E definitions, owner/search-path/grants and unique history; F04: unique migration among 106 entries and preserved function properties/permissions. | CTO/PO-supplied state checks; distinct from behavioral or browser acceptance. |
| Product Owner browser checks | PHOENIX-ROLE-AUTH-BROWSER-UAT-DOCS-001: specified Manager/Staff route denials; PORTAL-UAT-006: refreshed protected read denied after revocation, then all 17 orders returned after reactivation without new login. Both recorded in [Session Handover](../00_START_HERE/SESSION_HANDOVER.md). | Real observed browser cases only; does not prove all direct SQL/RPC paths, Auth session termination or immediate signed-URL revocation. |
| Historical operational staging E2E | Pickup, Production, Quality and Delivery capability/assignment/workspace flows in the preserved record below. | Keep the accepted flows; do not restart them merely because a later evidence gap concerns direct reads. |

**Remaining evidence boundaries:** F03 concerns Staff intra-tenant read visibility; D03 concerns multiple identity contexts and suspension interactions. F01/F02/F04 are completed within the accepted scopes described in [Security](../04_ARCHITECTURE/Security.md). Portal TTL/cache and remaining invitation/consent/identity cases retain their separate limits. [AUTH-DR-001C](Recovery_Runbook.md) remains a hard pre-production gate.

**Evidence availability:** some historical transaction scripts were deliberately removed after rollback; their dated reports remain the available evidence. The F04 closeout commit contains the migration and two canonical documents, not a persistent F04 contract test. The earlier local 3/3 static result and the CTO's 3/3 PostgreSQL behavioral result are distinct; neither is a new test run in this mission.

## Historical validation record — through 2026-08-22

The original record below is preserved verbatim. Its “current” and “next QA-001” wording and APP-era commands describe the original phase; they do not assign today's mission or override current validation policy. Historical refund/void regression does not authorize legacy RPC reuse.

<details>
<summary>Original quality gates, operational evidence and SEC-001 results</summary>

Status: Active

Version: 0.1

Last Updated: 2026-08-22

Current Mission: Operational role/workspace phase validated; QA-001 next

---

## Purpose

Track required validation commands for the current EcoWash Phoenix implementation.

---

## Contents

## Current Quality Gates

Run before APP implementation review:

- `npm run lint`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build`
- `git diff --check`
- translation key parity check across `src/i18n/en`, `src/i18n/it`, `src/i18n/es`, `src/i18n/fr` and `src/i18n/de`

APP-007 does not run remote Supabase migrations, Docker or production deployment checks. Database behavior for RLS/RPC and Storage policies requires a real Supabase/PostgreSQL environment for execution testing.

APP-008.1 adds the `organizations.timezone` migration. Dashboard query behavior still requires a real Supabase/PostgreSQL environment with tenant data for full execution testing.

Validate dashboard “today” windows against the active organization timezone. The EcoWash default is `Atlantic/Canary`.

AUTH-001 also requires manual staging validation with Supabase Auth redirect URLs configured:

- forgot-password form sends a recovery email
- when Supabase returns an endpoint-specific email-throttling response, the UI shows a safe retry-later message
- recovery link opens `/{locale}/update-password`
- invalid or expired recovery links show a safe error
- mismatched or weak passwords are rejected
- successful update signs out the recovery session and redirects to login
- login succeeds with the new password
- no service-role key is used in browser or Server Actions

Current real-test status:

- PRODUCT-001 completed the commercial readiness and feature-gap audit.
- UX-002 completed app layout, dashboard hierarchy, order detail information architecture, mobile navigation, contrast and touch target refinements.
- UX-002.5 quality gates passed: `npm run lint`, `npm run build`, `git diff --check`.
- AUTH-001 quality gates passed.
- Password recovery E2E completed.
- Owner login and `/it/app` access completed.
- INFRA-001-SMOKE completed with `PASS WITH NON-BLOCKING ISSUES`.
- INFRA-001-SMOKE corrective work is committed at `f94df88`.
- INFRA-001.1 completed remote migration history reconciliation.
- Supabase migration history reconciled successfully on 2026-07-30.
- SEC-001 completed the Supabase security audit.
- SEC-001.1 applied database privilege, RPC and Storage policy hardening through migration `20260801000100`.
- SEC-001.2 authenticated mutation regression passed with rollback-only tests and no smoke baseline drift.
- Pickup, Production, Quality & Packing and Delivery passed real end-to-end staging validation.
- Owner, manager and staff access boundaries passed real functional validation.
- Resend Custom SMTP sent and delivered a real Supabase Auth email successfully.

Final operational fixtures and account purposes:

- `TEST-PICKUP-01` → Speed → Pickup
- `TEST-PRODUCTION-01` → Production Test → Production
- `TEST-QUALITY-01` → Quality Test → Quality & Packing
- `TEST-DELIVERY-01` → Delivery Test → Delivery
- Manager Test → manager supervision and Staff & Access denial

Each workspace validation covered assignment, capability, My Day visibility, dedicated workspace, activity detail, operational transitions, terminal transition and final redirect without 404. BUG-PROD-006 redirects terminal Production, Quality, Pickup and Delivery flows to their valid workspace list. No credentials, access links, tokens or test-account email addresses belong in this document.

AUTH-INFRA-001 uses Resend Custom SMTP with the verified `ecowashlatejita.com` domain and `access@ecowashlatejita.com` sender. The configured Supabase Auth email limit is 30 emails/hour; endpoint-specific throttling remains independent from SMTP transport.

`QA-001` is the next approved M1/P0 gate: turn the validated paths into a repeatable staging and future production regression checklist without creating new fixtures unless a verified gap requires one.

INFRA-001-SMOKE validated with real staging data:

- first customer
- first property
- first service/price
- first order
- pickup/delivery
- production transition
- payment
- photo
- populated dashboard
- logout/login persistence

Smoke checkpoints:

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
| 10 | Payment | PASS |
| 11 | Photo | PASS |
| 12 | Dashboard | PASS |
| 13 | Logout/login | PASS |

Smoke final state:

- order `EW-000001`
- order total `25,00 EUR`
- production status `Pronto`
- pickup completed
- delivery completed
- balance zero after two payments
- one intake photo uploaded and previewed
- data persisted after logout/login

INFRA-001.1 read-only verification:

- `order-media` bucket exists
- `order-media` is private
- file size limit is 1 MB
- MIME allowlist contains JPEG, PNG and WebP
- `Cliente Smoke Test` present
- `Appartamento Smoke Test` present
- `Lavaggio e asciugatura test` present
- order `EW-000001` present
- one active order item
- order total `25,00 EUR`
- production status `Pronto`
- pickup completed
- delivery completed
- payments total `25,00 EUR`
- balance due `0,00 EUR`
- one active intake photo

Smoke bugs resolved in the corrective diff:

- BUG-001: `create_order` failed on staging due to `min(uuid)` and an ambiguous `id` reference.
- BUG-002: order list embed used an ambiguous `profiles` relationship.
- BUG-003/BUG-004: pickup and delivery embeds used ambiguous `profiles` relationships.
- BUG-005: item creation needed immediate repeated-submit protection.
- BUG-006: order item editing needed a single active edit form.

Known non-blocking gaps from the smoke run:

- Storage bucket privacy was not directly re-verified during the photo checkpoint, though the private bucket had been confirmed during INFRA-001.
- Negative MIME/size upload tests were not executed during this smoke run.
- Overpayment behavior was not documented with a definitive result.
- Payment actor visibility was not documented with a definitive result.
- Final read-only database verification via CLI completed during INFRA-001.1.
- Remote migration history is reconciled for the manually applied smoke corrective SQL.
- Staging smoke records remain present and should only be cleaned up in a separate approved task.

## SEC-001 Completed Security Verification

SEC-001 verified RLS, Storage policies, grants, RPC permissions, `security definer` functions, `search_path`, tenant helper functions and browser/server environment boundaries.

SEC-001.1 remediation result:

- anonymous RPC execution is blocked
- internal helpers such as `recalculate_order_totals(uuid)` and `app_current_organization_id()` are not client-executable
- authenticated RPCs used by the app remain explicitly allowlisted
- anonymous table SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges are removed
- authenticated table privileges are reduced to the operations used by the app
- `order-media` SELECT requires active `order_photos` metadata matching bucket, path, organization and order

SEC-001.2 regression result:

- authenticated rollback-only mutation tests passed for order detail, item save/remove, discount, logistics, payment, refund, void, photo registration/deactivation and status transition RPCs
- `create_order` was verified as reachable by authenticated users up to domain validation without consuming the order-number sequence
- rollback fixture data did not persist
- smoke order `EW-000001` remained unchanged

PILOT-001 must preserve these security assumptions while defining portal scope, roles, permissions, route architecture, dependencies, implementation order and acceptance criteria. It must not implement routes or UI, apply migrations, alter Supabase remote state, modify staging data, expose secrets or use service-role credentials in browser code.

## APP-007 Static Security Simulation

Expected outcomes before review:

- tenant A reads tenant B photos: DENIED
- tenant A uses tenant B order for logistics/payment/photo RPC: DENIED
- staff voids payment: DENIED
- owner voids payment with reason: ALLOWED
- refund greater than refundable amount: DENIED
- payment greater than balance due: DENIED
- duplicate payment submit that exceeds remaining balance: SAFE FAILURE
- delivery assigned to user from another tenant: DENIED
- direct payment update: DENIED
- direct manipulated photo metadata insert: DENIED
- Storage path cross-tenant upload/read: DENIED
- anonymous signed URL creation: DENIED
- expired signed URL access: SAFE FAILURE
- cancelled delivery to completed: DENIED
- completed delivery changes production: DENIED
- paid order changes production: DENIED
- photo deactivate preserves metadata: ALLOWED
- hard delete: DENIED
- inactive membership RPC: DENIED
- invalid MIME or size: DENIED
- logistics fee changes order total: DENIED, fee is informational in APP-007
- direct Storage object update/delete: DENIED

</details>
