# Testing

Status: Current validation evidence index

Original security evidence reconciliation: 2026-10-23; baseline `9b03b8b9e2120b1c65668da63410aa8a76c53c35`. Subsequent D03 closeout: 2026-10-24, recorded in the dedicated evidence section below and the canonical checkpoints.

## BILLING-ISSUE-FEEDBACK-001 — closeout evidence (30/10/2026)

| Evidence | Result and limit |
| --- | --- |
| Code and review | Application commit `a7786c3135c198cc2c2fc451c61db825b9383314` maps `billing_invalid_draft` to `invalidDraft` and renders an invoice-page alert translated in IT/ES/EN/FR/DE. CTO patch review PASS. SQL, payments, tax calculations, issuance and numbering were unchanged. |
| Automated validation | Focused tests: **50 PASS / 0 FAIL / 0 SKIP**; TypeScript, scoped lint and diff-check PASS. These tests cover the application error path and translation contracts; they are prior results, not rerun in this documentation closeout. |
| Staging release | Automatic deployment `dpl_CYTEigmDEGwLQf2fbv2XrMmxhExm` on `ecowash-phoenix-staging` verified **READY** for the application commit. |
| PO browser visual UAT | **PASS (30/10):** normal draft opening showed no alert; `?error=invalidDraft` displayed the expected Italian message. Invoice and data remained unchanged; no invoice was issued. A real issuance rejection was not provoked in the browser and the other four languages were not visually checked. |

The earlier observed `generic` response is historical for this resolved feedback defect. This closeout records existing evidence and runs no new application tests or fiscal operations.

## TERMINAL-COUNTER-ORDER-RECEIVED-001 — closeout evidence (30/10/2026)

| Evidence | Result and limit |
| --- | --- |
| Isolated PostgreSQL runtime | [Focused test](../../tests/terminal-counter-order-received-001.test.mjs): **18 PASS / 0 FAIL / 0 SKIP** in `/Volumes/DEV/Phoenix-FINANCIAL-GUARD-2A-LOCAL`. It exercised Terminal paid and unpaid creation, inbound custody and rejection, rollback, replay and historical drafts, Staff/Portal/tenant permissions, Quick Drop, Billing/REC guards and RPC ACL. Test transactions rolled back; laboratory rows, counters, definitions and migration history were preserved. This is local synthetic runtime evidence. |
| Publication and staging postflight | Commit `0fd8ad7a79b14fc9d1f29ce1bc06559d7d9cc823`; Vercel staging deployment `dpl_3gBdS4vhbf4ejk1E8dZBji8oUQUv` **READY** for that SHA. Migration `20261029224950` was applied once to Supabase staging `exthnplfokcucaqydney`, advancing history **112 → 113/113**. Read-only SQL confirmed the RPC body matches the migration, `SECURITY DEFINER`, `search_path`, EXECUTE ACL and active `order_received_inbound_storage` trigger. These checks do not substitute for browser UAT. |
| Product Owner browser UAT | **PASS within observed paths (30/10):** `EW-000166` moved `draft → received` and entered `00 · Stoccaggio`; `EW-000167` was confirmed at EUR 9.50 with EUR 0.00 paid, without a separate status check. Portal order stayed `draft` without warehouse position before pickup; scheduled pickup blocked manual receipt. No broader payment, fulfillment or fiscal behavior is claimed from these observations. |

The 29/10 `OPEN` proposal is historical for this mission; other findings retain their documented status. No application or database test is repeated in this documentation closeout.

## Financial Integrity Guard 2A and Billing lock order — evidence (29/10/2026)

| Evidence | Result and limit |
| --- | --- |
| Guard focused suite | [Guard test](../../tests/order-financial-integrity-guard-001.test.mjs): **12 PASS / 0 FAIL / 0 SKIP** in the latest reported focused run. It covers synthetic PostgreSQL payment, Billing/REC, Portal, tenant and role cases in its stated scope; separate canonical concurrency runs are not part of this count. The guard blocks economic/document-snapshot edits once relevant payments, Billing links or issued REC documents exist, while permitted metadata-only updates remain governed by existing write policies. |
| Original deadlock and correction | Pre-correction `40P01` was reproduced between simplified direct issue and advance declaration/issue; the opposite order of invoice/order locks predated Guard 2A. [Billing test](../../tests/billing-deadlock-40p01-postgres.test.mjs) reports **8 distinct runtime cases PASS + 1 static case PASS** across the saved evidence. The latest Node invocation reported **9 PASS / 0 FAIL / 0 SKIP**, without necessarily rerunning every earlier runtime case. Original and inverse interleavings, partial/full advances, final balance, replay, numbering, rollback and privilege/tenant checks were covered. A synthetic EUR 35.00 final reconciliation was EUR 32.71 base + EUR 2.29 IGIC; it is not general fiscal certification. |
| Isolated environment | `/Volumes/DEV/Phoenix-FINANCIAL-GUARD-2A-LOCAL`, project `phoenix-financial-guard-2a-local-001`: PostgreSQL 17.6, separate Docker cluster/volume with Auth, PostgREST and Kong; API/DB ports 56321/56322 bound to loopback, synthetic fixtures and **112 applied migrations** after the correction. Concurrent tests used independent PostgreSQL sessions and canonical RPCs. This is SQL runtime evidence, not complete HTTP/browser concurrency coverage. The laboratory and earlier Toshiba C2/disposable resources remain preserved. |
| Git and staging structure | Guard commit `28898f4a81966c96b9713a107dd4832ddc62be04`; Billing commit `fac70bbf636bd67e4e8ae5a973490ec3c1defe92`; one ordinary push to `main`. Supabase staging `exthnplfokcucaqydney` advanced **110 → 112/112** with migrations `20261029173145` then `20261029192215`; project **ACTIVE_HEALTHY** and expected functions, triggers and privileges observed. Migration/structure presence is not functional staging UAT. Vercel staging deployment `dpl_27F8pPwatN9M4UBZn6voJn2u5jNe` was verified **READY** for the Billing commit. |
| Product Owner staging browser UAT | **5/5 PASS**: editing an unpaid synthetic order; rejecting economic modification of a paid order; authorized synthetic Portal order creation; one synthetic POS payment with coherent balance; Billing draft preparation with coherent totals. These are PO browser observations, not an independent SQL audit of the five scenarios. The Billing case did not issue a numbered invoice or reproduce two concurrent browser issuers. |

**Scope boundary:** Phase 2A does not implement post-payment economic revisions, automatic customer credit, controlled refund flows or fiscal corrections. No commercial production, complete fiscal conformity, VeriFactu/provider compatibility, universal deadlock freedom or full disaster recovery is established. The 110/110 staging count in the earlier Billing closeout below is historical for that checkpoint. No tests are rerun for this documentation patch.

## TERMINAL-DOCUMENTS-NAV-001 — verification and UAT evidence (29/10/2026)

| Evidence | Result and limit |
| --- | --- |
| Publication | Eight application files were published in commit `65ce351c37eb934b5a60dd88e19bc2a3a29adb4a`. |
| Focused suite | `node --test tests/billing-direct-entry-001.test.mjs tests/print-contract.test.mjs`: **62 PASS / 0 FAIL / 0 SKIP**. These are prior results; no tests were rerun for this documentation patch. |
| Billing fixture comparison | The initial **11** Billing failures were reproduced on the published baseline and classified as stale fixtures missing `billing_link_role`. Fixture alignment alone restored the contract; Billing resolver, SQL and fiscal logic were not changed. The final count includes the Terminal document-navigation tests. |
| Staging deployment | Deployment `dpl_43HGGa59Qfr6TPPhka1qmQzoKVyr` was reported READY by the PO/CTO for the application commit. This documentation update did not independently query Vercel. |
| Product Owner browser UAT | «Documenti dell’ordine» section and receipt pre-issue warning passed visual review; ticket `EW-000162` opened and its contents passed visual review; registered-customer Billing navigation for `EW-000162` passed with the order preselected. |
| UAT limits | Physical printing, QR scanning and new operational-receipt or fiscal-invoice issuance were **NOT TESTED** in this UAT. The navigation UAT is not completion of the full operating/fiscal lifecycle. |
| EW-000163 diagnosis | Supplied read-only staging evidence identifies persisted `draft` as explicitly excluded by the simplified occasional-customer resolver. Anonymous status and missing address/NIF were not the cause. No invoice or fiscal payment attribution was present. This is diagnosis, not a runtime re-test or an issuance test; `received` alone does not satisfy remaining declaration, payment and fiscal-date requirements. |

See [Project Status](../06_ROADMAP/Project_Status.md#terminal-and-order-workflow-findings--29102026) for the new Terminal findings and the existing recovery UAT boundary. No application tests, database operations or staging checks are performed in this documentation phase.

## BILLING-FULL-PREPAYMENT-001 — closeout evidence at 29/10/2026

| Evidence | Result and limit |
| --- | --- |
| Publication and database history | GitHub `main` commit `c79de74896fcda88111b4562eba0af49cd8e7d36`; migration `20261028163423_billing_full_prepayment_001.sql` applied to Supabase staging `exthnplfokcucaqydney`. Subsequent migration list showed **110/110 aligned**. This is migration presence, not an authenticated staging SQL behavior audit. |
| Vercel staging | Automatic deployment `dpl_7PUeXQoqVB1L6nsMtCcVcHhq82CS` on `ecowash-phoenix-staging` was independently observed **READY** for that commit. The Vercel `production` target within this staging project is not commercial production. |
| Isolated local PostgreSQL C2 | **1 PASS / 0 FAIL / 0 SKIP** in a separate `phoenix_series_test_*` database on the already-running C2 server. The test exercised 35/35 original-draft issuance, fiscal totals, single attribution/number, trigger guards, replay, concurrence, negative cases, subsequent refund/cancellation and the existing C2 partial path. Historical C2 order/payment/invoice/counter fingerprints were unchanged. This synthetic SQL proof does not establish the staging browser path. |
| Product Owner staging browser UAT | **PASS** on synthetic walk-in order `EW-000159`: EUR 28.50 full card prepayment, simplified full-prepayment invoice `2026-UAT-S-000001`, EUR 26.64 taxable base + EUR 1.86 IGIC 7%, EUR 0.00 outstanding, Paid. Customer and laundry printable views passed visual inspection. This is PO-supplied browser evidence; no new SQL audit or physical print is claimed. |
| Separate operational documents | Non-fiscal receipt `REC-2026-000029` and internal work ticket `EW-000159` with operational QR were observed as distinct from the fiscal invoice. Order and payment remain separate facts. |

**Evidence still open:** physical printing and subsequent operational completion without a second invoice were not verified by the PO. VeriFactu/AEAT integration was not implemented and definitive fiscal compliance is not certified. The Terminal direct «Fattura» discrepancy remains a separate observation without a confirmed cause; no new auto-issuance rule follows. Earlier 28/10 full-prepayment OPEN and older migration/UAT-pending statements are **HISTORICAL / SUPERSEDED** for this mission by the dated checkpoint above. Prior C2 partial and Platform Admin evidence below retain their own scope; no tests are repeated for this documentation patch.

## SAAS-SIMPLIFIED-INVOICING-TENANT-CONTROL-001 — closeout evidence at 28/10/2026

| Evidence | Result and limit |
| --- | --- |
| Dedicated local static contracts | **5/5 PASS** for Platform Admin guard/grants, Billing-off disable exception, enable prerequisites, audit/no-op boundary and localized panel wiring. These inspect source; they do not exercise live PostgreSQL roles or browser behavior. |
| Application build | Local `next build --webpack` **PASS**, including TypeScript and page generation. The default Turbopack build failed in the sandbox while binding a port (`Operation not permitted`); this does not establish an application defect. |
| Staging migration presence and definition parity | Supabase staging `exthnplfokcucaqydney` lists `20261028090700` once; read-only hashes of both applied RPC bodies and the narrowed Billing-entitlement trigger match the local migration. This is not a behavioral permission test. |
| Publication | Exactly 12 reviewed functional files committed/pushed as `69ea49c68c8e7689aafd54f9251eb948e05fcd21`. Automatic Vercel deployment `dpl_F2NsptMYkGFp9kTUVDuedyWwtJ4T` on `ecowash-phoenix-staging` was verified **READY**, sourced from that SHA. The pre-existing `AGENTS.md` change and six prepared documents were excluded. |
| Product Owner staging functional UAT | **PASS**, explicitly reported for Platform Admin enable and disable of simplified invoicing. This report does not separately prove a non-admin denial, Billing-off disable, or persisted audit row. |

**Security evidence still open:** authenticated runtime denial for Owner and other non-authorized roles; the PO report also leaves Billing-off disable and audit-row behavior individually unconfirmed. Static SQL review and definition parity cannot be counted as behavioral PASS. No commercial production or external provider integration is approved. This documentation update runs no new application, database, staging or browser tests; it records prior evidence without repeating PASS results.

**Separate Billing/POS staging observations:** PO reports `EW-000155` ordinary invoice `2026-A-000004` issued; `EW-000156` EUR 35.00 order with confirmed EUR 10.00 POS advance, EUR 25.00 balance, correct history and an **unissued** ordinary draft. For `EW-000154`, the prior read-only staging diagnosis found draft/payment both EUR 35.00 and PostgreSQL `billing_invalid_draft` (`22023`) in `issue_billing_advance_invoice`; application mapping produced `generic`. This establishes the rejection and feedback cause, not a new fiscal acceptance path. The isolated local C2 partial-advance/final reconciliation PASS below retains its own scope. The [current findings register](../06_ROADMAP/Project_Status.md#billing-and-pos-findings--28102026) holds classifications and unresolved decisions.

## Billing C2 local RLS and fiscal UAT evidence — 26/10/2026

| Evidence | Result and limit |
| --- | --- |
| RLS regression, PostgreSQL 17 disposable | Previously reported [Billing test](../../tests/billing-c2-rls-42501-fix-001.test.mjs) **7 PASS** and D03 **16 PASS**. Synthetic isolated database, not staging/production; no rerun in this documentation mission. |
| C2 RLS application and browser | [Migration `20261026105505`](../../supabase/migrations/20261026105505_billing_c2_rls_42501_fix_001.sql) applied only to local C2; browser `42501` UAT **PASS** and CTO security review **PASS** as previously reported. Direct resolver EXECUTE remains denied to `PUBLIC`, `anon` and `authenticated`; the new helper provides only the guarded Billing declaration SELECT. No cloud application is claimed. |
| Local fiscal UAT — **PASS** | In synthetic Toshiba laboratory `phoenix-c2-uat-local-001`, order `C2UAT-000001` gross **EUR 7.00**, IGIC 7% included; confirmed POS advance **2.00** and balance **5.00**. Simplified documents `2026-UAT-S-000001` (**1.87** base + **0.13** IGIC) and final `2026-UAT-S-000002` (**4.67** base + **0.33** IGIC) reconcile to **6.54** base + **0.46** IGIC = **7.00** gross. |
| Read-only post-issuance audit | Local PostgreSQL SELECTs **PASS**: exactly two issued numbered invoices and no residual final draft; original draft UUID `a3d76e49-335c-4434-be1f-3eb4d6a98460` is the final document; unique sequences 1–2, counter `next_value=3`; two distinct confirmed POS payments, each linked once, no refunds; advance/final references preserved. `service_performed_on=2026-10-26` is a declared fiscal date; operational production completion is separate and does not independently prove handoff. |
| Staging boundary | Last documented `exthnplfokcucaqydney` history: **107 applied migrations** through `20261023192656`. The published `20261026105505_billing_c2_rls_42501_fix_001.sql` is **not applied on staging**; authenticated staging `42501` UAT is **NOT VERIFIED**. Local C2 PASS does not authorize real fiscal issuance. |

These are scoped C2 laboratory and previously reported browser/test results, not new tests in this documentation phase. Local SELECTs observed one synthetic organization; they cannot establish that no historical cloud change occurred. The published correction is commit `5c9a81a93e10b2118341758a97ec11fbd2c4033a`; the current observed Git baseline before this edit is local `main` = `origin/main` = `6daa4b9a835ab449ccc0f4982fe73ad96b997186`. The 24–25/10 local UAT-pending statements below are preserved as historical checkpoints and superseded for this isolated scenario. Separate staging approval/application and authenticated UAT, C2-specific backup/restore proof, obsolete Spanish recipient-help text, `AUTH-DR-001C`, fiscal adapter/provider integration and Production Readiness remain open: **production fiscal readiness NOT APPROVED**. Recovery RETRY-002 PASS concerns public DB + Storage, not the local C2 laboratory or managed Auth. See [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#billing-c2-uat-docs-closeout-001--26102026).

## Billing C2 local bootstrap and persistence evidence — 25/10/2026

The 24/10 isolated Toshiba laboratory (`/Volumes/DEV/Phoenix-C2-UAT-LOCAL`, `phoenix-c2-uat-local-001`, Next.js `http://localhost:3300`) reported `LOCAL_C2_NETWORK_PASS`, `LOCAL_NEXTJS_READY`, `LOCAL_C2_AUTH_EMAIL_PASS` and `LOCAL_SYNTHETIC_BOOTSTRAP_PASS`. Canonical Phoenix form/Server Action created separate synthetic Platform Admin and Owner Auth identities, one organization, one location, active Owner membership, four initial entitlements (`core.orders`, `core.customers`, `core.operations`, `catalog.management`), bootstrap receipt and audit. Billing premium and simplified issuance stayed off. These 24/10 results are supplied evidence; this documentation mission does not repeat those flows.

On 25/10, `LOCAL_C2_PERSISTENCE_PASS / CTO REVIEW PASS` covers a read-only post-restart inspection: Toshiba copy/configuration present; four C2 containers running; PostgreSQL healthy; SELECT counts of two Auth users, one Platform Admin, organization, location and Owner membership, four entitlements, one bootstrap receipt and one `tenant_bootstrap` audit entry. All five expected UUIDs and their relationships matched, with 24/10 UTC creation timestamps for Auth users, organization and receipt. Counts were zero for orders, payments, invoices, Billing invoice-number counters, operational receipts and their counters. Already-running Next.js returned HTTP 307, a redirect response rather than functional UAT. Main `main`/local `origin/main` matched `5d93add0be8b844830c67cd705b24b79cd15b5f0` with clean index/worktree. The inspection made no changes.

**Evidence boundary:** the synthetic Billing entitlement, synthetic fiscal setup and simplified issuance authorization remain pending; advance/final browser/HTTP UAT and IGIC reconciliation for the unexecuted €7.00 IGIC-inclusive scenario are **OPEN**. Staging Phase B2 is unauthorized, the real Tenerife tenant is excluded, and no real issuance or external fiscal integration is approved. Previously shared local credentials require reassessment before network exposure or real-data use; no secrets are recorded. The 24/10 section below remains historical for its then-pending local Next.js and bootstrap state. No application test, browser UAT, database mutation, staging/production access, commit, push or deploy is performed for this documentation checkpoint. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) owns the detailed acceptance, amounts and identifiers.

## Billing C2 local UAT evidence boundary — 24/10/2026

Previously accepted C2 evidence remains **63/63 application tests, 1/1 isolated PostgreSQL C2 test, TypeScript, scoped ESLint and diff-check PASS**; staging C2 migration/postflight passed. The specific simplified advance/final **browser/HTTP UAT remains OPEN**. Staging preparation of `UAT-S` and fiscal profile `ES-CN` / `IGIC-GENERAL` passed for the historical synthetic EcoWash La Tejita tenant, while simplified issuance stayed disabled; Phase B2 was not authorized. The new Tenerife tenant is excluded.

The dedicated Toshiba Supabase stack (`phoenix-c2-uat-local-001`, CLI 2.84.2) applied canonical migrations including C2 and passed local health checks. **LOCAL_C2_NETWORK_PASS / CTO REVIEW PASS** covers PostgreSQL `pg_isready`/`SELECT 1`, Auth/REST HTTP 200, loopback-only Docker binds for ports 55321/55322, no listener on 55320/55323/55324, and tested non-loopback IPv4 denial. These checks do not prove fiscal behavior or complete Docker/host security. No application seed, synthetic user or transaction was created. Next.js local configuration, synthetic fixtures, local C2 enablement, the proposed €7.00 advance/balance browser/HTTP scenario and IGIC reconciliation remain untested and subject to separate authorization. Previously exposed local credentials require review and possible regeneration before reuse; no credential is recorded here. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#docs-billing-c2-local-uat-checkpoint-001--24102026) owns the detailed current checkpoint. No new test is run for this documentation update.

## TERMINAL-TRANSACTIONAL-RECOVERY-UAT-001 — 24/10/2026

**COMPLETE / CTO REVIEW PASS / PRODUCT OWNER BROWSER UAT PASS / STAGING SQL VERIFIED**

**Environment and baseline:** Vercel/Supabase Staging, Supabase `exthnplfokcucaqydney`; historical synthetic tenant **EcoWash La Tejita** only. The new EcoWash La Tejita Tenerife pilot tenant was not involved. Documentation baseline: `main`, local HEAD = `origin/main` = GitHub `af760dbbb5fd0068a39d41042a7cf8eb04ac6951`, clean worktree/index before these edits.

**Scenario A — PASS (Product Owner browser UAT and supplied staging SQL evidence):** Chrome connectivity was disabled before submission. Phoenix showed an unknown outcome without automatic resubmission; lookup returned `not_found`, refresh retained the pending request, and manual retry used the same identity. `not_found` was a point-in-time result, not a general guarantee that processing could not occur. Order **EW-000152**, total **€3.00**: **1 order, 1 associated submission, 1 item, 0 payments**. Independent Sale 2, **€4.50**, survived interruption, refresh and recovery.

**Scenario B — PASS:** temporary Playwright **1.64.1**, installed Chrome with sandbox enabled and a separate persistent temporary profile. The one-shot interceptor matched the expected submission Server Action. Controller events on **24/10/2026 UTC**: `route.fetch()` once with no retry at **11:24:35.250**; valid Server Action response **HTTP 200** at **11:24:42.413**; `route.abort()` completed at **11:24:42.433**, preventing response delivery to the browser. The interceptor disarmed on its first match. HTTP success alone was not treated as proof of commit.

**Separate PO/CTO evidence for Scenario B:** Phoenix showed an unknown outcome; manual **Verifica stato ordine** recovered **EW-000153** without a new submission. After refresh, the Terminal was available with no pending marker left. Direct CTO Supabase verification confirmed **exactly 1 order**, **Abrigo solo planchar × 1**, total **€7.00**, **1 associated submission**, **1 confirmed cash payment totaling €7.00**, associated POS session and no duplicate payment key detected. Final SQL check after refresh: **PASS**. Browser recovery and SQL results are supplied PO/CTO evidence; the HTTP interception events were observed directly by Codex.

**Evidence retention:** synthetic orders **EW-000152 / EW-000153** and the payment remain in staging as audit evidence; no deletion or correction is authorized or performed. Temporary tooling cleanup removes only this mission's controller, Chrome profile/session, scripts, dedicated Playwright installation and cache; the original Chrome, its profiles and drafts remain untouched. This documentation phase performs no SQL or new UAT and no commit/push.

**Scope and history:** previous UAT PENDING statements for these two scenarios are **HISTORICAL / SUPERSEDED** by this checkpoint; historical records remain intact. No application defect was detected and no software change was required. Acceptance covers only these two scenarios, not universal idempotency, offline continuity, financial security or commercial readiness. The separate real environment, security, backup/restore, managed Auth (`AUTH-DR-001C`), GDPR, fiscal, physical-printer and Production Readiness Review gates remain unchanged. No tests were rerun during documentation closeout.

## Current validation policy

Follow [AGENTS.md](../../AGENTS.md) and the authorized task scope: focused checks first, broader checks only when required. This documentation mission executes no new application, PostgreSQL, staging or browser tests. Results below are previously recorded evidence. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) and [Project Status](../06_ROADMAP/Project_Status.md) own acceptance and remaining gates.

## D03 multicontext suspension evidence — 24/10/2026

`SECURITY-D03-MULTICONTEXT-SUSPENSION-001B — COMPLETE / CTO PASS / STAGING HTTP UAT PASS`. Publication baseline: `13d1b3470ebe82c7d80c2d8961cf77634c98a76e`. [Migration `20261023192656`](../../supabase/migrations/20261023192656_security_d03_multicontext_suspension_001b.sql) changes only the pre-request gate and Staff organization resolver. [Focused contracts and disposable PostgreSQL harness](../../tests/security-d03-multicontext-suspension-001b.test.mjs) preserve the implementation evidence; no tests are repeated in this closeout.

| Evidence level | Completed result | Boundary |
| --- | --- | --- |
| Static contracts and pertinent regressions | **4/4 new contracts + 36/36 regressions PASS**. Contracts check the two-function scope/properties, eligible Staff contexts and ambiguity, canonical Portal reuse, and existing suspended-tenant helper/RLS/RPC guards. | Source assertions, not runtime PostgreSQL or HTTP proof. |
| Isolated local PostgreSQL | **11/11 SQL matrix + 4/4 additional local RPC checks PASS** against the pertinent function definitions. | Disposable synthetic schema/dependencies and simulated identity; not a full Supabase stack. The harness skips when no disposable target is supplied; a skip is not a PASS. |
| Original staging defect | **2/2 real authenticated PostgREST HTTP checks** reproduced the unwanted request-wide `organization_suspended` denial before D03. | Separate before-correction evidence; not rerun after application. |
| Post-correction staging HTTP | **5**, then **23** completed checks PASS, followed by final **3/3 Portal scenarios / 7/7 HTTP checks PASS** using dedicated synthetic `authenticated` JWTs. | Tested SELECT/helper/RPC paths only. Earlier invalid request/fixture attempts are excluded from PASS counts; their pending cases were subsequently completed. No service-role identity simulated ordinary authorization. |
| Staging postflight and cleanup | **107 migration entries**, D03 **once**; function definitions/properties/ACLs and pre-request unchanged at final verification. Synthetic fixtures/accounts removed; zero checked residues; ten checked public-table counts/fingerprints preserved. | Recorded UAT evidence; no remote SQL, migration application or new runtime verification during publication. |

HTTP coverage includes A usable while B is suspended, B denied through the verified tenant-access paths, mixed Staff/Portal identities, suspended-only denial, ambiguous Staff context denial, separate Platform Admin management without raw tenant-read escalation, and canonical Portal without fallback. The final cases specifically verify (1) B association inactive with valid synthetic `disabled_by` and `disabled_at`, A still usable; (2) B customer disabled with a coherent inactive association, A still usable; (3) canonical A entitlement denied without switching to later eligible B. No deliberately incoherent fixture was forced. These are actual authenticated HTTP results, not browser UAT or universal RLS/RPC coverage. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) owns the scoped acceptance and historical supersession; F03, `AUTH-DR-001C` and all other open gates remain preserved.

## Daily Close clarity evidence — 23/10/2026

`DAILY-CLOSE-CLARITY-UX-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER VISUAL UAT PASS`, application commit `e6309172ff6c4579b126dfd3d5482e23b1f8fc99`. [P1 contracts](../../tests/pos-daily-close-p1-contract.test.mjs) and [P2B contracts](../../tests/pos-daily-close-p2b-contract.test.mjs): **45/45 PASS**, including **7 new tests**. The additions check rendering-source references and translated copy for POS → Daily Close → confirmation, definitive snapshot immutability, live/saved distinction, selected-day outstanding scope and removal of the obsolete future Phase 2 reference; key parity covers IT/ES/EN/FR/DE. These copy/source contracts do not establish browser rendering or database runtime behavior. TypeScript, scoped ESLint and diff-check **PASS** at implementation; calculations, snapshots, payments and database were unchanged.

Separate Product Owner visual staging acceptance is limited to the screens shown and judged visually positive. No new daily close, financial verification or complete UAT in all five languages is claimed. No tests or UAT were repeated and no deployment was independently verified in this documentation closeout. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#daily-close-clarity-ux-001--complete--technical-pass--product-owner-visual-uat-pass) owns the scoped acceptance checkpoint; this documentation commit is distinct from the application SHA.

## POS counted-cash evidence — 23/10/2026

`POS-COUNTED-CASH-UX-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS`, application commit `73f9ccfa453b175e647d902555db9cedbbc349e9`. [Focused tests](../../tests/pos-counted-cash-ux-001.test.mjs): **8/8 PASS**, covering an initially empty counted-cash field with positive expected cash and preserved input constraints; missing, empty, whitespace-only, negative and nonnumeric input rejected before the close RPC; explicit zero and a valid positive amount accepted. The tests execute the actual workspace/internal form, validation and action with simulated hooks/server dependencies, not a browser or PostgreSQL target. [POS contracts](../../tests/pos-contract.test.mjs): **31/31 PASS**; [POS session UX contracts](../../tests/pos-session-ux-contract.test.mjs): **7/7 PASS**, totaling **38/38** pertinent regressions. TypeScript, scoped ESLint and diff-check **PASS** at implementation.

Separate Product Owner UAT confirms only that session closure requires entering the counted amount. No additional browser validation cases, deployment verification or new database proof are claimed. Calculations, payments, reconciliation and database remain unchanged. No tests or UAT were repeated in this documentation closeout; [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#pos-counted-cash-ux-001--complete--technical-pass--product-owner-uat-pass) owns the acceptance checkpoint, distinct from this documentation commit.

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

**Remaining evidence boundaries:** F03 concerns Staff intra-tenant read visibility and remains DEFERRED / REASSESS BEFORE SAAS RELEASE. D03 is complete only within the multicontext suspension scope and tested paths recorded above, superseding its earlier evidence-gap status. F01/F02/F04 retain their accepted scopes described in [Security](../04_ARCHITECTURE/Security.md). Portal TTL/cache and remaining invitation/consent/identity cases retain their separate limits. [AUTH-DR-001C](Recovery_Runbook.md) remains a hard pre-production gate; no complete SaaS security certification follows.

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
