# Project Status

Status: Active — canonical implementation and acceptance inventory

Last consolidated: 2026-10-16 (`PHOENIX-DOCUMENTATION-CONSOLIDATION-001`, CTO PASS; published as `2aac81acf2554622fdf0a53bd064e0ee82651e47`). Billing release checkpoint: 19/10/2026. Fiscal onboarding and save-feedback closeout: 20/10/2026. Local Billing C2 bootstrap checkpoint: 25/10/2026; local C2 UAT checkpoint: 26/10/2026.

## PHOENIX-RECOVERY-RETRY-002-001 — 27/10/2026

**MILESTONE: RECOVERY_RETRY_002_PASS for logical public DB + Storage recovery; CTO-reviewed backup fix and documentation published.** The 26/10 RETRY-002 protected staging checkpoint restored **107/107** migrations (later `20261026105505` excluded), **56/56 COPY** sections and **3019/3019** data rows, and **420/420** Storage objects with downloaded SHA-256 parity (46,162,357 bytes). Schema/seeds, 183 FK checks with two expected Auth-only exceptions, 73 tenant relationships, financial aggregates and numbering passed. Five active photo references resolve; eight inactive references were already missing files in the source. The Mac and Toshiba AES-256 images were both locally re-hashed to the expected SHA-256 and remain protected with manifests. At the prior publication checkpoint, local `main` = `origin/main` at `93d00b4ed49b83ca7fb4da1a65b9f95091b02f3f`; staging Vercel deployment `dpl_H8gQw6cqwMEv4rTPJAqWCxuEioAk` is `READY`, with `/en` HTTP 200. The PO reports authorized permanent deletion of isolated Recovery `lslomiphzvpatmqpsstg`, FitIQtracker `xvqdwtwnmmdswfehekjo` resumed `ACTIVE_HEALTHY`, and Phoenix staging `exthnplfokcucaqydney` `ACTIVE_HEALTHY`; these final cloud states were not independently re-queried in this local-only closeout. Only the unused RETRY-002 migration workdir was removed after PO authorization and a fresh process/mount/content check; the pre-existing unstaged `AGENTS.md` change and all other resources are preserved. [Recovery Runbook](../05_DEVELOPMENT/Recovery_Runbook.md) holds the evidence and procedure.

**Remaining gate and next Phoenix scope:** managed Auth recovery `AUTH-DR-001C` is **NOT VERIFIED**, DB and Storage snapshots are non-atomic, and full SaaS disaster recovery/Production Readiness remain open. After this closeout, the previously recorded `ECOWASH-STORE-READINESS-AUDIT-001` awaits its own CTO scope and authorization; no new development mission starts here.

**Local cleanup gate:** CTO reviewed the inventory and the PO authorized removal of only `/private/tmp/phoenix-recovery-retry-002-001`. It contained 107 repository-identical migrations, matching configuration and one small CLI marker; no process or Docker mount used it, and removal was verified. The active historical Docker container, volume and SQL directory, Keychain entries, backups, mounted older DMG, Homebrew, C2 and shared images remain untouched. The PO authorized one local commit of these three documents only; push remains unauthorized and `AGENTS.md` stays outside the index.

## BILLING-C2 local fiscal UAT closeout — 26/10/2026

**LOCAL C2 UAT PASS / PRODUCTION FISCAL READINESS NOT APPROVED.** Isolated synthetic Toshiba project `phoenix-c2-uat-local-001`: order `C2UAT-000001`, EUR 7.00 with 7% IGIC included; confirmed POS advance EUR 2.00 and balance EUR 5.00. Simplified invoice `2026-UAT-S-000001` records base 1.87 / IGIC 0.13 / gross 2.00; final `2026-UAT-S-000002` records base 4.67 / IGIC 0.33 / gross 5.00. Combined base **6.54**, IGIC **0.46**, gross **7.00**. The original EUR 7.00 draft became the EUR 5.00 final invoice without a duplicate document. Read-only local SELECT audit: two issued invoices, no residual draft, sequences 1–2 and `UAT-S` counter `next_value=3`, two distinct POS payments each attributed once, coherent advance/final links. Fiscal `service_performed_on=2026-10-26` is declared, not independent proof of handoff.

The Billing `42501` read-policy correction ([migration](../../supabase/migrations/20261026105505_billing_c2_rls_42501_fix_001.sql), [test](../../tests/billing-c2-rls-42501-fix-001.test.mjs)) is published in `5c9a81a93e10b2118341758a97ec11fbd2c4033a`; local `main` = local `origin/main`, clean index/worktree at the documentation baseline. It was applied only to C2. Previously reported PostgreSQL 17 disposable checks: Billing **7 PASS**, D03 **16 PASS**; local browser `42501` UAT and CTO security review **PASS**. No test or UAT is repeated here. The 24–25/10 local pending statements below are historical for their dates, not the current C2 UAT state. Historical staging Phase B2 and real-tenant issuance remain unauthorized; no cloud change is intentionally made or inferred from local checks.

**Still open:** untested C2 backup restore, obsolete Spanish simplified-issuance help text, broader SaaS and fiscal checks, `AUTH-DR-001C` and Production Readiness Review. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#billing-c2-uat-docs-closeout-001--26102026) owns the detailed checkpoint; [Testing](../05_DEVELOPMENT/Testing.md) separates evidence types. No code, schema, database, Docker or cloud change, commit, push or deploy occurs in this documentation mission.

## BILLING-C2 local bootstrap and persistence checkpoint — 25/10/2026

`DOCS-BILLING-C2-LOCAL-BOOTSTRAP-CHECKPOINT-001 — DOCUMENTATION / CTO REVIEW PASS`. Starting `main` HEAD = local `origin/main` = `5d93add0be8b844830c67cd705b24b79cd15b5f0`, clean index/worktree. The isolated Toshiba copy `/Volumes/DEV/Phoenix-C2-UAT-LOCAL` (`phoenix-c2-uat-local-001`) reached `LOCAL_C2_NETWORK_PASS`, `LOCAL_NEXTJS_READY`, `LOCAL_C2_AUTH_EMAIL_PASS` and `LOCAL_SYNTHETIC_BOOTSTRAP_PASS` on 24/10. At `http://localhost:3300`, the canonical Phoenix form/Server Action bootstrapped a synthetic organization with separate Platform Admin and Owner Auth users, one location, active Owner membership, four initial entitlements, receipt and audit. Billing premium and simplified issuance remained disabled.

`LOCAL_C2_PERSISTENCE_PASS — CTO REVIEW PASS` on the 25/10 read-only Codex report: Toshiba copy/configuration present, four C2 containers running, PostgreSQL healthy; both Auth users, Platform Admin, organization, location, Owner membership, four entitlements, receipt and audit persisted with all five expected UUIDs matching. Orders, payments, invoices and Billing invoice-number counters were zero; operational receipts/counters were also zero. Already-running Next.js returned HTTP 307, proving a redirect response only. Main repository remained clean at the baseline SHA. No changes or new functional UAT occurred. The earlier 24/10 setup section below is historical for its then-pending Next.js/identity/bootstrap state; its network and staging evidence remain valid.

**Open:** synthetic Billing entitlement, synthetic fiscal setup, authorization for simplified issuance, C2 advance/final browser/HTTP UAT and IGIC reconciliation. The €7.00 IGIC-inclusive advance/balance scenario remains unexecuted; [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) records its exact amounts and the five identifiers. Historical staging Phase B2 remains unauthorized; the real EcoWash La Tejita Tenerife tenant and external fiscal integration remain excluded. Previously shared local credentials require reassessment before network exposure or real-data use; none are reproduced. [Testing](../05_DEVELOPMENT/Testing.md) separates evidence levels. This documentation checkpoint changes no application, migration, database, Docker or configuration state and performs no staging/production access, commit, push or deploy.

## BILLING-C2 local UAT checkpoint — 24/10/2026

`DOCS-BILLING-C2-LOCAL-UAT-CHECKPOINT-001 — DOCUMENTATION / CTO REVIEW REQUIRED`. Starting `main`/`origin/main` baseline `ffa39cbb26943b4ea8cbe5437a342aff7d78b632`. C2 implementation and technical validation remain **PASS**; its specific simplified-invoice browser/HTTP UAT remains **OPEN**. On Supabase Staging `exthnplfokcucaqydney`, the historical synthetic EcoWash La Tejita tenant has Phase A `UAT-S` reservation **PASS** and Phase B1 fiscal declarations `ES-CN` / `IGIC-GENERAL` **PASS**, preserving country `ES`, ordinary series `A`, IGIC 7% and `simplified_invoicing_enabled=false` at last verification. Phase B2 is **STOP_REVIEW_REQUIRED / not authorized** because persistent numbered documents could carry the historical tenant's real fiscal identity; activation/disable procedures were proposed but not run. CTO selected isolated synthetic UAT. The new EcoWash La Tejita Tenerife tenant is excluded, and no external fiscal integration is authorized.

The separate Toshiba environment `/Volumes/DEV/Phoenix-C2-UAT-LOCAL` (`phoenix-c2-uat-local-001`, Supabase CLI 2.84.2) has the minimal PostgreSQL/Auth/PostgREST/Kong stack, canonical migrations including C2, and health checks **PASS**; no application seed was present and no synthetic user or transaction was created. **LOCAL_C2_NETWORK_PASS / CTO REVIEW PASS:** after Docker Desktop's global `Localhost only` port-binding change and restart, only 55321/55322 listened within 55320–55324, on IPv4/IPv6 loopback; PostgreSQL read check and Auth/REST HTTP 200 passed, with no wildcard bind or tested non-loopback IPv4 access. This is scoped network evidence, not platform security certification; the global setting may affect future LAN-accessible services. Local credentials previously shown in initialization output require review and possible regeneration before reuse; they are distinct from staging credentials and are not recorded here. Next.js on localhost:3300, exclusive local wiring, authorized synthetic fixtures, local C2 enablement, browser/HTTP UAT and IGIC reconciliation remain **OPEN**. The proposed €7.00 = €2.00 advance + €5.00 balance, €6.54 base + €0.46 IGIC scenario is expected only, not executed. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#docs-billing-c2-local-uat-checkpoint-001--24102026) holds the detailed boundary. Historical checkpoints and other release gates remain intact.

## TERMINAL-TRANSACTIONAL-RECOVERY-UAT-001 — 24/10/2026

**COMPLETE / CTO REVIEW PASS / PRODUCT OWNER BROWSER UAT PASS / STAGING SQL VERIFIED**

Staging acceptance on **24/10/2026**, historical synthetic EcoWash La Tejita tenant only; the new Tenerife pilot tenant was not involved. Baseline `af760dbbb5fd0068a39d41042a7cf8eb04ac6951`.

**Scenario A PASS:** pre-send disconnection, pending request preserved across refresh, point-in-time `not_found`, manual retry with original identity; **EW-000152 / €3.00**, 1 order/submission/item, 0 payments; independent Sale 2 **€4.50** preserved.

**Scenario B PASS:** one-shot Playwright forwarding followed by response suppression, unknown browser outcome and manual status recovery without resubmission; **EW-000153 / €7.00**, 1 order/submission and 1 confirmed cash payment associated with a POS session, no duplicate payment key detected; refresh leaves no pending marker. PO browser acceptance and CTO final staging SQL verification are PASS. [Session Handover](../00_START_HERE/SESSION_HANDOVER.md#terminal-transactional-recovery-uat-001--24102026) records exact HTTP timings, attribution and evidence retention. Orders/payment remain as synthetic audit evidence.

**Scope and history:** previous UAT PENDING statements for these two scenarios are **HISTORICAL / SUPERSEDED** by this checkpoint; historical records remain intact. No application defect was detected and no software change was required. Acceptance covers only these two scenarios, not universal idempotency, offline continuity, financial security or commercial readiness. The separate real environment, security, backup/restore, managed Auth (`AUTH-DR-001C`), GDPR, fiscal, physical-printer and Production Readiness Review gates remain unchanged. No tests were rerun during documentation closeout.

## SECURITY-D03-MULTICONTEXT-SUSPENSION-001B — COMPLETE / CTO PASS / STAGING HTTP UAT PASS

**24/10/2026 — approved D03 closeout**, pre-publication baseline `13d1b3470ebe82c7d80c2d8961cf77634c98a76e`; published in commit `a18b45733ee9d53483317f0c677ebda5af33331d` (`fix(security): scope suspended tenant denial to valid contexts`), with local `main` / `origin/main` / GitHub synchronized and clean worktree/index verified after push. Migration `20261023192656_security_d03_multicontext_suspension_001b.sql` changes only pre-request `platform_assert_request_allowed()` and Staff resolver `app_current_organization_id()`: usable A is no longer globally vetoed by suspended B; the tenant-specific authorization boundaries, unique Staff context, canonical Portal without fallback and separate Platform Admin privileges remain intact. B stayed denied in the verified tenant-access paths; Platform Admin's authorized management of suspended tenants remains separate.

**Accepted evidence, not repeated for publication:** original denial reproduced **2/2 HTTP**; **11/11 local SQL**, **4/4 local RPC**, **4/4 new static contracts** and **36/36 pertinent regressions PASS**. Subsequent real authenticated PostgREST checks passed in groups of **5**, **23**, and final **3/3 Portal scenarios / 7/7 checks**. Final edge cases cover audited inactive B associations, disabled B customers with coherent associations, and denied canonical A entitlement without fallback to eligible B. Local SQL uses synthetic dependencies/simulated identity; HTTP uses real dedicated synthetic Auth JWTs. Invalid fixture/request attempts are not counted as authorization PASS. No browser UAT or universal RLS/RPC coverage is claimed.

**Staging/postflight PASS:** target `exthnplfokcucaqydney`, **107 migrations**, D03 recorded **once**. Local proposed function bodies match saved applied definitions; signatures, owners, ACLs, security properties and pre-request configuration were preserved. Synthetic fixtures/accounts were deleted with zero checked residues; the ten checked public-table counts/fingerprints matched their pre-test baselines. The [full checkpoint](../00_START_HERE/SESSION_HANDOVER.md#security-d03-multicontext-suspension-001b--complete--cto-pass--staging-http-uat-pass) distinguishes evidence levels and earlier interrupted attempts.

This supersedes earlier D03 OPEN/PARTIAL/EVIDENCE GAP status for this scope without deleting history or repeating completed ordinary suspension QA. **F03 remains DEFERRED / REASSESS BEFORE SAAS RELEASE**; `AUTH-DR-001C` and remaining Portal/Auth, TTL/cache, fiscal, GDPR, operational and Production Readiness Review gates are preserved. This is not complete SaaS security certification. No further mission starts here.

## DAILY-CLOSE-CLARITY-UX-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER VISUAL UAT PASS

**23/10/2026 — application commit `e6309172ff6c4579b126dfd3d5482e23b1f8fc99`.** IT/ES/EN/FR/DE texts clarify relevant POS session closure → Daily Close review → confirmation, definitive snapshot immutability through the current interface, live versus saved data, and outstanding amounts limited to orders attributed to the selected business day. The obsolete future Phase 2 reference is removed. Calculations, snapshot behavior, payments, operational workflow and database remain unchanged; no migration.

Existing technical evidence: **45/45 tests PASS**, including **7 new tests**, plus TypeScript, scoped ESLint and diff-check **PASS**. Product Owner **visual staging UAT PASS covers only the shown screens**: no new daily close, financial verification or complete five-language UAT. No tests/UAT were repeated or deployment independently verified in this documentation closeout. The [full acceptance checkpoint](../00_START_HERE/SESSION_HANDOVER.md#daily-close-clarity-ux-001--complete--technical-pass--product-owner-visual-uat-pass) separates application and documentation commits and supersedes the historical not-started statements for this mission. Historical checkpoints and unrelated gates remain preserved; no new mission is opened.

## POS-COUNTED-CASH-UX-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS

**23/10/2026 — application commit `73f9ccfa453b175e647d902555db9cedbbc349e9`.** Counted cash starts empty at POS session close and requires explicit entry, including zero (`0,00`). Missing, empty and whitespace-only input is rejected; valid zero/positive amounts are accepted and negative/nonnumeric amounts remain rejected. Expected cash, reconciliation calculations, session lifecycle, payments/refunds, authorization, online flows, Daily Close snapshots and database are unchanged; no migration.

Existing technical evidence: **8/8** new focused tests, **38/38** pertinent regressions, TypeScript, scoped ESLint and diff-check **PASS**. Product Owner UAT confirms that closure is possible only after entering the amount; other validation cases are automated evidence, not additional browser claims. No tests or UAT were repeated and no deployment was independently verified in this documentation closeout. The [full acceptance checkpoint](../00_START_HERE/SESSION_HANDOVER.md#pos-counted-cash-ux-001--complete--technical-pass--product-owner-uat-pass) distinguishes application and documentation commits. Historical evidence and unrelated gates remain unchanged; `DAILY-CLOSE-CLARITY-UX-001` is not started.

## TERMINAL-CUSTOMER-CATALOG-PERFORMANCE-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS

Application commit: `935c0144835a1823bec0131d373b0e473f67e978`. Three accessory reads in `listShopServices` are parallelized; prices, access controls and order logic remain unchanged. Existing validation: **14/14** new tests, **30/30** pertinent regressions, TypeScript, scoped ESLint and diff-check **PASS**. No tests were rerun for this documentation closeout.

Product Owner Phoenix Staging UAT: catalog loading perceived as **“a little faster”**. This is qualitative acceptance, without stopwatch measurements, a percentage improvement or a measured final time. Further optimizations are deferred unless new evidence emerges. The [full scoped checkpoint](../00_START_HERE/SESSION_HANDOVER.md#terminal-customer-catalog-performance-001--complete--technical-pass--product-owner-uat-pass) preserves evidence limits and history. Documentation is prepared locally for CTO review; no documentation commit/push yet and no independent deployment verification claimed.

## UX-NOTIFICATIONS-001 — BACKLOG / DESIGN PENDING

**Priority: MEDIUM. Product Owner functional decision, recorded 23/10/2026.** This is the current scoped refinement of the historical `NOTIFY-001 — Customer/staff notifications` candidate in [Roadmap](../01_PRODUCT/Roadmap.md) and [Milestones](Milestones.md), not an additional duplicate notification initiative. Those historical records remain preserved.

| Event | Intended recipients |
| --- | --- |
| New Portal order | Authorized operators of the same organization. |
| New production assignment | The assigned employee. |
| New pickup or delivery | The assigned employee. |
| Administrative notification | Authorized Owner/Manager users. |

The approved direction includes an internal bell with a counter, persisted notifications, read/unread state and a link to the relevant activity. Real-time delivery is to be evaluated during design, not assumed or authorized now. Notifications never grant additional access: organization isolation and the recipient's current authorization remain mandatory for notification content and the linked activity.

Before proposing implementation, inspect and reuse suitable existing notification mechanisms; distinguish existing operational alerts from any proposed persistent notification behavior. No new table, RPC, transport, real-time mechanism or implementation is approved by this backlog entry. Design and implementation each require their own authorized scope; no notification mission starts here.

## TERMINAL-INITIAL-SCREEN-001 — COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS

**Application published:** `c0af60a12c8149a31c73fd8c5244669bdda2d18a`. Product Owner browser UAT on Phoenix Staging passed: immediate operational-sale opening without the empty initial screen; five available workspaces; Sale 1 and Sale 2 in progress concurrently; selected Sale 2 customer/cart and selection retained after reload; sales retained after leaving for Home and returning. Full evidence and boundaries are in [Session Handover](../00_START_HERE/SESSION_HANDOVER.md).

**Existing technical PASS:** 19/19 targeted tests, 52/52 pertinent regressions, TypeScript, scoped ESLint and diff-check. No tests rerun or deployment status remotely rechecked in this documentation phase. Browser PASS is limited to the listed scenarios; logout, a new browser, storage loss and new-order creation are not established. This supersedes earlier unimplemented initial-screen wording, while preserving historical evidence, submission/financial UAT limits, loading-performance findings, POS/multi-till work and other release gates.

**Documentation closeout pending CTO review:** only the local documents are updated; a future documentation commit remains separate from the application commit above. No commit/push or next mission is authorized by this checkpoint.

## SECURITY-F03-DEFERRED-DECISION-001 — Product Owner / CTO decision (23/10/2026)

**SECURITY-F03 — DEFERRED / REASSESS BEFORE SAAS RELEASE.** PO/CTO retain the current Staff authorization model to avoid a broad, risky change in this phase. `SECURITY-F03-STAFF-READ-PERMISSIONS-DESIGN-001` analyzed Owner-configurable read permissions independent of mutation rights; that alternative is not authorized for implementation.

**Rationale:** tenant isolation already has PASS evidence within its documented scope; operational role, capability and assignment controls are implemented. Configurable reads would require coordinated RLS, grants, RPC and application-reader changes, with potential Terminal, POS and operational-workflow regressions. The F03 investigation confirmed no new critical defect.

**Preserved limitation and history:** some membership-based direct reads within a tenant remain broader than workspace filters. This limitation is unresolved and is not certified acceptable for every future SaaS deployment. This decision supersedes the earlier F03 continuation status in `SECURITY-EVIDENCE-RECONCILIATION-001`; its findings and evidence remain valid. Reassess F03 before SaaS release. Existing pre-production gates, including `AUTH-DR-001C` and Production Readiness Review, remain mandatory. SEC-001, F01, F02, F04 and D03 retain their recorded states; no implementation or other mission is opened by this documentation decision.

## SECURITY-EVIDENCE-RECONCILIATION-001 — AUDIT COMPLETE / CTO REVIEWED

**23/10/2026 — accepted evidence reconciliation.** SEC-001/.1/.2 remain historically completed. F01 callback hardening, F02 Preview containment/identity binding and F04 inactive-organization helper enforcement are complete within their verified scopes. Existing tenant-isolation, Staff capability/assignment and ordinary tenant/Portal suspension/reactivation PASS evidence remains valid for its tested cases. The F04 staging checkpoint below supersedes historical F04 OPEN/BLOCKED wording; PORTAL-UAT-006 supersedes the earlier pending browser revocation/reactivation status for its observed sequence.

**Residual gaps, not newly demonstrated vulnerabilities:** F03 concerns Staff visibility within the same tenant through direct SELECT/RPC paths; existing tenant isolation and privileged-operation denials do not settle that read contract. D03 concerns identities with multiple contexts and suspension of a different associated tenant; ordinary suspension QA is already complete. CTO must delimit intended behavior and any targeted verification before authorizing correction. No F03, D03 or subsequent mission starts here.

**Preserved gates:** `AUTH-DR-001C` remains mandatory before production. Portal photographs remain enabled under the existing PO/CTO decision; the recorded 600-second signed-URL/cache risk remains separate from the passed browser revocation flow. Remaining Portal/Auth, fiscal, GDPR, operational and Production Readiness Review gates are unchanged; no overall security or production-readiness approval is claimed.

**SECURITY-DOCS-RECONCILIATION-001 — CTO REVIEW PASS — READY FOR COMMIT.** Documentation-only patch on `main`, baseline `9b03b8b9e2120b1c65668da63410aa8a76c53c35`, initially clean worktree/index. The five authorized documents now distinguish current architecture, evidence levels and historical records. No new tests or remote verification are claimed; no code, migration, database, Docker or environment change, commit, push or deployment is part of this phase.

## SECURITY-F04-INACTIVE-ORG-HELPERS-001A — STAGING POSTFLIGHT + BEHAVIORAL PASS — 23/10/2026

**Scoped F04 gate PASS on Supabase staging `exthnplfokcucaqydney`, per CTO/Product Owner evidence.** Migration `20261023122144_security_f04_inactive_org_helpers_001a.sql` is present exactly once among 106 recorded migrations. The three approved helpers require `organization.status = 'active'`; the CTO confirmed their signatures, owner, `STABLE`, `SECURITY DEFINER`, `search_path` and grants remain unchanged. Controlled PostgreSQL tests with a temporary organization, two isolated profiles and simulated Auth identity returned TRUE for active and FALSE for inactive tenants for each helper (**3/3 PASS**). The test transaction was explicitly rolled back; post-check found four organizations total and no temporary organization remaining. Codex did not repeat SQL or change Supabase in this documentation closeout.

**Evidence limit and remaining gates:** this newer checkpoint supersedes the historical F04 OPEN/BLOCKED statements below for the three helpers, while retaining the local Docker diagnosis as historical evidence. The test does not establish browser end-to-end behavior or all RLS/RPC combinations. D03, F03, remaining Portal/Auth and cross-tenant cases, `AUTH-DR-001C`, fiscal, GDPR, operational and Production Readiness Review gates remain open. Phoenix is not declared fully secure or production ready.

## LOCAL-POSTGRES-SAFETY-HANDOVER-001 — F04 local proof gate (23/10/2026)

**F04 static analysis OPEN; local PostgreSQL proof BLOCKED / NOT VERIFIED.** The historical container and volume `supabase_db_ecowash-phoenix` remain identified for preservation under the existing `LOCAL-SUPABASE-VOLUME-CORRUPTION-001` finding. Read-only Docker inventory found one stopped container, that volume and the separate `supabase_db_phoenix-bootstrap-001b-local` volume; no isolated F04 container has been created. Inspect/log signals include invalid `PG_VERSION` and a missing-network error; the exact final-stop cause is unproven. Disk checks found 15 GiB available on `/` and 461 GiB on `/Volumes/DEV`; the apparent `Docker.raw` file size is not physical consumption. Next CTO gate: review [the full diagnosis](../00_START_HERE/SESSION_HANDOVER.md), available space and a unique-container/unique-volume isolation plan. This mission started no infrastructure and made no application, SQL or database change.

## PORTAL-UAT-006-DOCS-001 — Scoped browser acceptance (22/10/2026)

**PORTAL-UAT-006: PASS, per Product Owner live-browser evidence** on Phoenix staging, EcoWash La Tejita, dedicated **Cliente Smoke Test** account. Owner disabled only the Portal association while the customer remained active and its Chrome incognito session stayed open. Refreshing a previously accessible protected order returned unauthorized/no-linked-customer-Portal feedback instead of the order content. Owner then re-enabled the same association; a fresh order-list reload in the retained session returned **all 17 existing orders without a new login or invitation**. Codex did not repeat this UAT or perform remote operations in this documentation mission. The full observed sequence is recorded in [Session Handover](../00_START_HERE/SESSION_HANDOVER.md).

**Evidence boundary:** earlier `PORTAL-REVOCATION-LOCAL-UAT-001B` A–D canonical PostgreSQL authorization checks passed separately with synthetic fixtures, simulated identity and rollback. They complement this browser result without proving real Auth session persistence themselves. The preceding PHX-POST-F02 checkpoint remains historically correct: browser UAT was pending then; only the observed revocation/reactivation sequence is accepted now. F01/F02 implementation and staging migration/postflight records remain intact. All RPC/RLS combinations, direct Storage/signed-URL revocation, every cross-tenant or disabled-customer/organization path, remaining invitation, consent/binding, identity reassignment and Auth cases are not established by PORTAL-UAT-006. D03, F03, F04, `AUTH-DR-001C` and the fiscal/GDPR/operational/Production Readiness Review gates remain open.

**PO/CTO photo decision:** keep customer order photographs enabled and staff photo functionality unchanged; do not delete/deactivate photographs or implement the considered Portal-photo suspension. `PORTAL-REVOCATION-MEDIA-TTL-001` remains **OPEN / lower-priority bounded privacy risk**: 600-second signed URLs may outlive Portal revocation, with possible additional cache availability. Shorter expiry and cache mitigations require review before commercial SaaS release. This UAT demonstrated no photo-URL misuse, general intrusion or cross-tenant exploit and does not close the media finding or establish complete Portal security/production readiness. GitHub canonical documentation remains authoritative over the deferred-improvements chat register. Minor UX work stays separate; the next activity requires an explicit PO/CTO decision.

## PHX-POST-F02-DOCS-001 — Security and backup evidence (21–22/10/2026)

**PRODUCT OWNER/CTO-SUPPLIED CHECKPOINT; NO REMOTE VERIFICATION REPEATED BY CODEX.** Published application baseline: `726818126a78c8ee7c4e93a13b09e252769548c2`. F01 Auth callback hardening is published to staging. F02-001C Preview containment is implemented: source/local tests establish unconditional 404/no-store, no Auth operations and no preview-link generation. Previously reported live endpoint 404 evidence is limited to that endpoint and does not constitute complete browser Portal UAT. F02-001E removes global Auth login metadata from the customer panel and verifies authoritative UUID/email consistency before association replacement or reactivation.

**Staging database application/postflight PASS:** following a successful single-migration dry-run, the Product Owner applied `20261021000100_security_portal_identity_binding_001e.sql` to `exthnplfokcucaqydney`. Independent CTO verification through the Supabase connector confirmed **105 unique migration entries**, this version present once, updated definitions of both management RPCs, ownership, `SECURITY DEFINER`, empty `search_path` and EXECUTE boundaries (authenticated allowed; anon/PUBLIC denied). The two existing Portal associations remain **one active and one inactive**, with **zero UUID/email mismatches at verification time**. Migration did not repair or reactivate customer associations.

**Still OPEN:** Product Owner runtime Portal invitation/binding/reactivation and Auth/authorization UAT; association consent and identity-reassignment policy; prior-session concerns; D03 platform-suspension interference; F03 Staff read permissions; F04 inactive-organization authorization; and other genuine residual findings already recorded. Database postflight is not runtime acceptance or closure of all Portal/security/production gates. No new UAT or UX mission is started here.

**Updated logical backup/custody evidence, separate from historical restore sets:** PO/CTO report `~/EcoWash-Backups/PHOENIX-STAGING-20261021-POST-001E` with SHA-256 PASS for `roles.sql`, `schema.sql` and `data.sql`. Storage at capture: `brand-media` **414 files / 42,635,604 bytes**, `order-media` **6 / 3,526,753**, `accounting-exports` **zero files**; total **420**, all local checksums PASS. AES-256 image `PHOENIX-STAGING-20261021-AES256-PROTETTO.dmg` was created and password-mounted read-only; SQL and all 420 Storage checksums passed inside the image. Its external Toshiba APFS copy on `/Volumes/DEV` matched the original SHA-256. Codex did not access or independently verify these artifacts. Encrypted local/external-device custody is evidenced; geographically independent off-site custody is not.

**Recovery remains incomplete:** the new snapshot has not been separately restored. Circular-FK warnings for `payments` and `invoice_orders` in the data-only dump require restore planning; they do not prove export failure or a restore defect. B4 protected Auth/configuration inventory inclusion in the image is not independently evidenced. Logical backup and checksum evidence do not establish managed Auth recovery, password continuity or full authenticated application recovery. `AUTH-DR-001C` stays a **hard pre-production gate**; Supabase Pro expenditure stays deferred. Preserve BACKUP-DR-001D and prior snapshot evidence. [Recovery Runbook](../05_DEVELOPMENT/Recovery_Runbook.md) records the current dated custody limits alongside that history.

## PHOENIX-ROLE-AUTH-BROWSER-UAT-DOCS-001 — Scoped browser authorization UAT (20/10/2026)

**INDIVIDUALLY OBSERVED MANAGER/STAFF BROWSER CHECKS PASS / DOCUMENTATION ONLY.** Environment: Phoenix staging, `Phoenix UAT Tenant 001C`; repository baseline `main`/`origin/main` at `8e67e51689eba0ae690c9e91375b0d5289f2cf3a`. This checkpoint records Product Owner browser observations; no checks were repeated against the application or remote services in this documentation mission.

**Manager — specific results PASS:** the invited Manager account was activated and accessed the application; the Manager role was retained after invitation acceptance. Billing opened successfully, the fiscal issuer editing form was unavailable, and missing issuer information was reported. Direct navigation to `/es/app/staff` redirected to `/es/app/access-denied`.

**Staff — specific results PASS:** the invited account had only the `pickups` operational capability. The workspace exposed only **Mi día** and **Recogidas**; Recogidas loaded successfully. Staff password recovery and subsequent Safari login succeeded according to the Product Owner's report; these authentication observations are distinguished from screenshot evidence and are not independently proven by screenshots.

**Observed direct browser access denials — each PASS:**

| Role | Requested path | Observed result |
| --- | --- | --- |
| Manager | `/es/app/staff` | Redirect to `/es/app/access-denied` |
| Staff | `/es/app/billing` | Access Denied |
| Staff | `/es/app/production` | Access Denied |
| Staff | `/es/app/staff` | Access Denied |
| Staff | `/es/app/shop` | Access Denied |
| Staff | `/es/app/pos` | Access Denied |

The initial `/es/app/terminal` attempt used an incorrect URL and is **excluded from security-test results**. No orders, invoices, payments, POS sessions or pickup records were created during these tests.

**Invitation/session observation — separate from authorization PASS:** opening the one-time Staff invitation link in the Owner's Chrome session replaced that browser session. The same link subsequently failed in Safari, as expected for a consumed link. Staff password recovery and subsequent Safari login then succeeded, as reported by the Product Owner. This does not establish a general authentication vulnerability or a root cause for the earlier Auth UX findings. No credentials, invitation/recovery URLs, tokens or password details are recorded; no Auth fix is implemented or approved here.

**Evidence limits / remaining security verification:** PASS applies only to the listed role/capability presentation and browser navigation outcomes. It does not comprehensively verify PostgreSQL/RLS, cross-tenant isolation, direct RPC calls, server-action authorization, hostile requests or unobserved role/capability combinations. These require independent testing; the earlier local authorization evidence retains its original scope. No tenant membership/capability, fiscal setting or historical document was modified by this documentation mission; no fiscal issuance eligibility or compliance is established.

**UX findings — OPEN, separate future missions requiring independent approval:**

- `UX-STAFF-ROLE-CAPABILITIES-001`: invite and capability forms do not clearly distinguish capabilities managed by role. The displayed supervision message is misleading for Staff; Manager checkboxes may suggest choices that server-side role defaults ignore. No fix is implemented.
- `UX-ACCESS-DENIED-MESSAGE-001`: the generic “Esta cuenta no tiene acceso operativo” suggests the account has no operational membership when only the requested page or capability is denied. No fix is implemented.

## UX-BILLING-SAVE-FEEDBACK-001 — CTO-approved closeout (20/10/2026)

**IMPLEMENTED / CTO CODE REVIEW PASS / COMMITTED / PUSHED / VERCEL READY / PRINCIPAL OWNER BROWSER UX UAT PASS.** This status covers the validated happy-path save-feedback behavior; browser and accessibility edge cases remain open. The Product Owner identified insufficient visual feedback when saving Billing issuer settings. A small form-scoped client component uses `useFormStatus` for a localized pending label, native disabled submit control and accessible live progress. Confirmed issuer save redirects to `?saved=issuerSettings#issuer-save-feedback`; the disclosure opens and focus/scroll moves to the localized confirmation beside the submit button. The page-level confirmation remains available. Error results suppress success messages and preserve server error handling with an accessible alert. The simplified-series form retains its own action, button and original redirect. English, Italian, Spanish, French and German are covered. Success confirms configuration persistence only; it does not imply official identity verification or permission to issue.

**Publication verified:** commit `caf925966aaeccfa0c7f1b29a02f7d06fb1a0754`, `fix: improve billing issuer save feedback and update project status`, is committed and pushed. The Vercel deployment was independently verified through the Vercel connector. Verified project: `ecowash-phoenix-staging`; deployment: `dpl_3Dg7stZS9YQowM8kjNn5U5X1ScVC`; status: **READY**. The matching GitHub commit was verified; GitHub comparison confirmed one commit and exactly the 15 authorized files. The Product Owner supplied the separate browser UAT screenshots and observations recorded below. This evidence supersedes `DEPLOYMENT_NOT_VERIFIED` for this specific commit. **Historical verification limit preserved:** the agent's earlier Vercel API read returned HTTP 403 and could not confirm READY at that time; this was an unavailable verification, not evidence of a failed deployment. Publication started at `cad60c9a1c19e1cd5bd3272a14a8a3c20a8e13af`; the 13 application/test files remained SHA-256-identical to the reviewed patch while only the two canonical documents were reconciled. Final Git postflight confirmed local HEAD = origin/main = GitHub SHA, clean worktree/index and the exact 15-file commit. No manual deployment or Supabase/tenant operation occurred in that closeout. This documentation-only UAT update records supplied evidence without repeating deployment/browser checks or accessing Supabase.

**Product Owner browser UX UAT — 20 October 2026:** Phoenix staging, `Phoenix UAT Tenant 001C`, Owner role, Billing issuer settings, Spanish locale. The Product Owner supplied screenshots and observations supporting the following specific checks, recorded as **PASS**:

1. Existing issuer settings displayed correctly before submission.
2. The initial save label was “Guardar datos del emisor”.
3. During actual submission the button changed to “Guardando...” (localized pending feedback).
4. The submit button visibly entered its disabled state.
5. Progress text was visible beside the button; the implementation exposes accessible progress semantics, while screen-reader behavior remains unverified.
6. Successful submission navigated to the issuer-settings saved state.
7. “Datos del emisor guardados.” appeared immediately beside the save button.
8. The issuer settings disclosure remained open.
9. The confirmation was positioned within the visible browser viewport without scrolling to the page top.
10. Existing country **ES** remained unchanged.
11. Existing ordinary invoice series **UAT-A** remained unchanged.
12. Existing default tax rate **7%** remained unchanged.
13. Issuer fiscal identification remained deliberately empty.
14. The configuration continued to report missing fiscal information.
15. Simplified invoicing remained disabled.
16. The simplified-series reservation form remained visually separate.

No invoices or fiscal documents were created during this UAT. **Evidence boundary:** this is a principal Owner browser UX happy-path PASS, not completion of all browser/accessibility checks. Screenshots support visible pending state, disabled styling, successful navigation and visible inline confirmation. They do not independently establish rapid repeated-click prevention under adverse network conditions, actual accessibility focus destination or screen-reader behavior, mobile layout, server-error feedback, Manager/Staff browser authorization, remote PostgreSQL/RLS authorization or real fiscal issuance eligibility. These limits describe the Owner save-feedback evidence. The subsequent scoped Manager/Staff browser outcomes recorded above provide separate evidence for their listed checks; all other unverified scenarios still require independent testing. No official issuer identity verification, fiscal compliance or issuance readiness is granted by this UAT.

**Validation:** the 175 applicable focused UX/Billing regressions PASS, including 13 new UX tests; TypeScript, scoped ESLint and diff-check PASS. The unfiltered 176-test selection has **175 PASS / 1 historical FAIL**, not a fully passing suite. `tests/billing-simplified-invoice-001d.test.mjs` still expects simplified document selection to be universally blocked, whereas the current controlled assessment/preparation workflow permits selection without automatically authorizing issuance. The failure was reproduced using the exact test from committed baseline `cad60c9a1c19e1cd5bd3272a14a8a3c20a8e13af`; its SQL hashes remain valid. This expectation is preserved, not disabled or corrected. Its maintenance is separate technical debt requiring independently approved review. The previously reported 175/175 result refers only to the explicitly filtered selection excluding that known failure. Render tests use form-status and DOM-effect doubles and do not establish browser layout, real network submission, hydration, assistive-technology behavior or runtime remote RLS.

**Compatibility:** the only server-action change is the successful issuer redirect. Canonical persistence/data merging, existing error paths, role/entitlement checks, tenant isolation, SQL/RLS, invoice issuance, numbering/series, tax calculations, payments/refunds/POS, C2 advances/final reconciliation, historical documents and fiscal assessment remain unchanged. No provider or simplified-invoicing activation is introduced. Generic Button and DisclosureSection implementations are unchanged.

## SAAS-FISCAL-IDENTITY-ASSESSMENT-001 — Published foundation (20/10/2026)

**IMPLEMENTED / CTO REVIEWED / COMMITTED AND PUSHED:** `b63802d170d66491808354ba30d1339d1834d948`, `feat: add fiscal identity assessment foundation`. The Product Owner's closeout authorization records the Vercel staging deployment as **independently verified READY**. This supplied deployment evidence supersedes the earlier agent report of API HTTP 403 / `DEPLOYMENT_NOT_VERIFIED` for this commit; the failed earlier API check remains a historical fact, not a failed deployment.

Pure deterministic assessment distinguishes configuration completeness, formal identifier validity, jurisdiction and unavailable verifications using a projection of canonical `organization_billing_settings`, without a second mutable store. Formal Spanish DNI and NIE X/Y/Z checksum validation is implemented, with an extension boundary for future countries/jurisdictions. Corporate NIF and unsupported identifier cases are not formally validated; official identity verification and authorization to represent a legal entity are not provided. Country ES alone does not select IGIC or IVA. Issuance eligibility is neither assessed nor granted. The 19/19 focused tests, TypeScript, ESLint and diff-check passed at publication; no issuance or provider behavior was introduced.

## SAAS-FISCAL-ONBOARDING-PARTIAL-SAVE-001A — Published and scoped Owner UAT PASS (20/10/2026)

**IMPLEMENTED / CTO REVIEWED / COMMITTED AND PUSHED:** `cad60c9a1c19e1cd5bd3272a14a8a3c20a8e13af`, `feat: allow progressive fiscal issuer settings`. The Product Owner's closeout authorization records the Vercel staging deployment as **independently verified READY**, superseding the earlier agent API HTTP 403 / unverified-deployment report for this commit. **76/76 focused tests PASS**, TypeScript, scoped ESLint and diff-check PASS at publication.

Owners with Billing entitlement can save incomplete issuer details without fictional fiscal IDs through the existing canonical settings RPC. Series and default tax rate remain mandatory. Blank/omitted issuer fields preserve previously saved values; nonempty values replace them. Intentional clearing is unavailable through this partial-save form. The preservation read uses authenticated tenant context and aborts on errors. The RPC remains a full-profile writer with existing concurrency behavior, not an atomic field-patch protocol. All five locales distinguish saved configuration, missing information and complete fields, and explain that official verification and fiscal issuance readiness have not been established. Existing readiness/issuance and authorization rules are unchanged; fiscal assessment remains separate from issuance authorization.

**Actual Owner browser UAT — specific checks PASS, supplied by the Product Owner:** on `Phoenix UAT Tenant 001C`, the correct tenant and Owner session were confirmed and Billing entitlement was available. Partial settings saved successfully with country **ES**, default ordinary series **UAT-A** and default tax rate **7%** persisted. Fiscal ID was deliberately empty and the missing-fiscal-information warning remained visible. Values persisted after page reload. A later save with an empty country field preserved the existing **ES**. The successful save returned `?saved=settings` and the browser displayed confirmation. No invoices or fiscal documents were created in these checks. This remains evidence for the published 001A behavior with its original `?saved=settings` redirect. The subsequent 20 October UX UAT above validates the new save-feedback happy path; the two checkpoints cover their respective published versions.

**Authorization evidence limits:** local Owner/Manager/Staff and tenant-boundary tests passed in their stated scope. The Owner checks do not establish Manager/Staff authorization or remote PostgreSQL/RLS. The separate 20 October role UAT above records only its individually observed Manager/Staff browser checks as PASS; additional authorization scenarios and remote PostgreSQL/RLS verification remain open.

## International SaaS fiscal architecture — approved direction, implementation bounded

Product Owner decisions: one legal business entity per tenant, with multiple operational locations; international fiscal architecture with country- and jurisdiction-specific validation; a provider-neutral fiscal core. Independent provider selection per tenant is a **future capability**; provider integration begins only after individual selection and approval. Completeness, formal validity, official identity verification, legal representation and legal issuance eligibility remain distinct. Current implemented foundations are the isolated assessment and progressive canonical issuer settings, alongside the established Billing C2 pilot; the full international onboarding flow, broader country modules and provider integrations are not implemented by these missions.

Fiscal-register responsibility allocation and the tenant-by-tenant transition to issuance remain **unresolved decisions**. Preserve canonical Billing numbering and C2 reconciliation, existing tenant/security boundaries and the single-rate IGIC 7% pilot limits. Mixed-rate/international fiscal issuance, external provider/VERI*FACTU integration and complete fiscal-readiness work remain separately scoped. No complete legal compliance, provider readiness or new tenant activation is claimed.

## Open Auth investigation and remaining UAT/UX findings

**Separate unresolved UX/Auth observations, reported by the Product Owner:** the incognito session ended after Chrome restart; initial login failed; two recovery links returned invalid/expired feedback. Controlled password recovery in the same incognito context succeeded. After password update, login temporarily showed persistent loading; opening the protected application URL in that same session confirmed successful authentication. No authentication fix has been implemented or approved, and these observations do not establish a root cause. No credentials, recovery links, tokens or password details are recorded.

**Still OPEN:** UX-BILLING-SAVE-FEEDBACK-001 browser/accessibility edge checks (rapid repeated clicks under adverse network conditions, actual focus destination and screen-reader behavior, mobile layout, server-error feedback, and functional series independence beyond visual separation); additional Manager/Staff authorization/security scenarios beyond the listed browser checks; `UX-STAFF-ROLE-CAPABILITIES-001`; `UX-ACCESS-DENIED-MESSAGE-001`; Platform tenant-creation button contrast; General Settings save-feedback visibility; historical simplified-selection test maintenance; further fiscal-readiness and provider-integration missions; unresolved fiscal-register responsibility and tenant-specific issuance transition. No task starts automatically from this closeout. The C2 and earlier checkpoints below remain historical evidence for their stated phases.

## BILLING-SIMPLIFIED-INVOICE-001G-C2 — Final closeout (19/10/2026)

**IMPLEMENTATION COMPLETE / FINAL CTO REVIEW PASS / STAGING MIGRATION AND POSTFLIGHT PASS; FISCAL UAT OPEN.** Canonical Billing supports fiscal advances and a linked final balance document in the **single-rate IGIC 7% pilot**. Fiscal numbers are allocated atomically, committed replay is idempotent, and each POS payment belongs to its attributed document. Refunds affect collection totals without rewriting issued fiscal amounts. Historical ordinary invoices without attributions, tenant/RLS/role/entitlement protections, `WALKIN-SHARED`, series ownership and canonical POS RPCs retain their boundaries. Reading/reprinting uses persisted fiscal data and document-specific collections.

**Reconciliation approved:** €2 + €5 gives **€6.54 taxable base + €0.46 IGIC**. €1 + €1 + €1 gives **€2.79 documented taxable base + €0.21 IGIC**; the separate commercial snapshot retains **€2.80 + €0.20**, with tracked base-rounding difference **−€0.01**. Previously issued advances remain unchanged; no double taxation or mixed-rate support is introduced.

**All four CTO defects closed:** null-safe immutability of the eight new summary/snapshot fields, including authorized SQL writers; database/UI protection against deleting a final draft with issued advances, with concurrent lock handling; tenant-timezone comparison rejecting service dates before advance collection before numbering; and canonical final-draft/issued-final reopening despite one or more advance links, without duplicates. Final delta review: **`BILLING_SIMPLIFIED_INVOICE_001G_C2_CTO_REVIEW_PASS`**.

**Validation reused, not repeated at closeout:** **63/63 application tests**, **1/1 isolated PostgreSQL C2 test**, TypeScript, scoped ESLint and diff-check **PASS**. Internal assertions cover the four fixes, both delete/advance concurrency outcomes, preserved snapshots/rounding, payment/refund attribution, numbering/idempotency, tenant/authorization and ordinary compatibility in the covered cases. Synthetic Auth/source dependencies mean these results do not establish real HTTP end-to-end or browser acceptance.

**Already applied on staging, per Product Owner evidence:** `20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql` on **EcoWash Phoenix `exthnplfokcucaqydney`**, approved SHA-256 **`745d90eab7f4ccf4ce2aa97085aae7f1994354d17014d544d27cd1b1c5d215fc`**. SQL application succeeded; subsequent `supabase db push --linked` returned `Remote database is up to date`; local/remote history aligns through C2. Structural postflight **9/9 PASS**, with comparable historical fingerprints identical across **7/7 tables**. No new invoice, fiscal emission or business-data change occurred in those checks. **Do not reapply the migration or repeat db push.** This closeout makes no Supabase access or business write.

**Repository closeout:** synchronized starting baseline `main`/`origin/main`/GitHub **`e8a671df798058710fb329d1916b8c6d25a2d103`**, empty index, 14 modified and two new C2 files. Before/after SHA-256 checks preserve all **16** approved implementation files and the approved migration hash. The closeout in progress is completed locally by the single **18-file** commit containing this status, `feat(billing): complete simplified advance and final reconciliation`; Git history/final report record the resulting SHA, normal push and final synchronization. Only Session Handover and Project Status are added. Existing Git deployment targets **`ecowash-phoenix-staging`**; Vercel verification returned **403**, so new-deployment source/Ready is **`DEPLOYMENT_NOT_VERIFIED`**. Git publication does not establish Ready. No manual deployment/configuration change or commercial-production operation.

**Remaining gates:** browser/print UAT, real HTTP end-to-end, controlled tenant activation under separate authorization, mixed-rate/international fiscal support, corrective fiscal workflows and external fiscal-provider/VERI*FACTU integration. Mixed-rate orders remain blocked in C2; no tenant is activated here. Date-only declarations do not prove intraday chronology. **No complete fiscal conformity or commercial-production readiness is declared.** All historical checkpoints are preserved; their earlier advance-issuance blocks and pending rounding decision remain historical evidence for their respective phases. Other open findings remain open and no new mission is started.

## BILLING-SIMPLIFIED-INVOICE-001G-C1 — Advance declaration foundation (19/10/2026)

**FOUNDATION COMPLETE ON STAGING / CTO PASS / POSTFLIGHT PASS; ADVANCE ISSUANCE BLOCKED.** Migration `20261018000300` adds immutable, tenant/order/payment-bound pre-service declarations with canonical POS amount/date and authenticated Owner/Manager identity/timestamp. A payment can have only one declaration. The corrected payment-before-order lock protocol and scoped `READ COMMITTED` requirement prevent the tested refund/declaration deadlock and detect the committed refund. RLS requires tenant, Owner/Manager and Billing entitlement; clients have no direct mutation grants. Ordinary Billing, POS RPCs, fiscal snapshots, IGIC and numbering are unchanged.

**Evidence:** C1 CTO PASS; isolated PostgreSQL **2/2 PASS** and C1/G-B static contracts **2/2 PASS**, reused without repetition. Isolated runtime fixtures cover the canonical lock protocol, not the complete HTTP flow. The approved migration (SHA-256 `6b58b1df164343027b8e4de56fac86869f200e35056b15258d29da1a0c5a19fc`) was applied once to `exthnplfokcucaqydney`; **103 migrations are aligned**. Postflight verified the matching trigger body, active guards, validated constraints, RLS and privileges. Six comparable table fingerprints are identical pre/post; 34 pre-existing Billing/POS/helper functions are unchanged. No declaration or invoice was created. Do not reapply this migration.

**Remaining gates:** fiscal advance/balance issuance is still blocked. The cent-reconciliation convention requires CTO/adviser confirmation; fiscal UAT and external provider/VERI*FACTU integration remain open. This checkpoint does not declare simplified invoicing complete or full fiscal conformity. All earlier checkpoints and other open findings remain preserved; C1 closeout does not authorize C2.

## BILLING-SIMPLIFIED-INVOICE-001G-B — Advance payment link foundation (18/10/2026)

**STAGING FOUNDATION COMPLETE / CTO PASS / POSTFLIGHT PASS; FISCAL ADVANCE ISSUANCE BLOCKED.** The single preparatory migration `20261018000200` is installed on EcoWash Phoenix staging `exthnplfokcucaqydney`; **102 local/remote migrations are aligned**. Canonical `invoice_orders` now distinguishes advance and final roles while preserving historical ordinary links as final and one active final per order. `billing_invoice_payment_links` binds a complete confirmed POS payment to its invoice and order within one tenant, without creating a second payment ledger. The schema reserves a reference from an advance to its final document; the linking workflow is not enabled. The new RLS policy requires Owner/Manager **and** the Billing entitlement; authenticated clients have no direct write permission.

**Evidence:** final CTO RLS review PASS; **2/2 isolated PostgreSQL tests PASS**. Read-only staging postflight confirmed validated constraints, triggers, policy and privileges. Comparable pre/post fingerprints for invoices, payments, counters and original order-link columns match; six Billing/POS RPC definitions remain identical. Ordinary invoicing, POS, IGIC and numbering are unchanged. No business write or fiscal document was created by the migration checks.

**Next gate:** the 001F payment-history block and new advance-issuance guard remain active. **001G-C** must complete coordinated advance/balance fiscal emission, allocation, refund/correction rules and reconciliation before tenant activation and HTTP/browser fiscal UAT. External provider/VERI*FACTU integration remains separate. No complete fiscal conformity or commercial-production readiness is claimed. Earlier checkpoints below describe their historical phases.

## BILLING-SIMPLIFIED-INVOICE-001F — Service issuance closeout checkpoint (18/10/2026)

**IMPLEMENTED / CTO PASS / STAGING SCHEMA APPLIED / STRUCTURAL POSTFLIGHT PASS; FISCAL UAT OPEN.** The canonical Billing path prepares simplified issuance for an eligible local laundry/dry-cleaning service order with no prior non-`void` payment. Owner/Manager must declare and confirm the effective service date; actor and timestamp are persisted and the issued snapshot is immutable. Existing operational dates remain informational. The 001D series ownership and atomic Billing numbering, order–invoice uniqueness, idempotent replay, two labelled copies of one persisted fiscal document and canonical reprint are reused. The one-argument ordinary issue RPC and ordinary economic behavior remain compatible. Prices, IGIC snapshots, payment ledger, tenant/RLS and `WALKIN-SHARED` protections remain unchanged.

**Safety boundary:** only the new simplified issuance requires `READ COMMITTED`. Its order lock coordinates with the canonical POS payment writer; any prior payment record except `void` blocks issuance before a fiscal progressive is allocated. Advance/final-document linkage, balance settlement and corrective documents are not supported by this path. The migration makes no automatic tenant activation; actual live tenant configuration needs separate verification and explicit approval.

**Recorded validation, reused without rerun:** CTO 001F final review PASS; **147/147 application tests**, **48/48 isolated PostgreSQL tests** after the POS race correction, **16/16 focused contracts**, TypeScript, scoped ESLint, five-locale translations and diff checks PASS. The PostgreSQL harness used canonical Billing/POS RPC bodies with synthetic Auth/source dependencies, not full HTTP end-to-end. The Product Owner applied only **`20261018000100_billing_simplified_invoice_001f_service_issuance.sql`** to staging **`exthnplfokcucaqydney`**; approved SHA-256 **`5b4ffc32367818633a8e7ae96c350dd1b6cf93e1d878ce81267c6cbd3dbefd7b`**. Migration-list evidence shows **101 local/remote versions aligned**; do not reapply it.

**Postflight scope:** local comparison of the staging schema dump with the approved SQL and prior function snapshot is **PASS for structure**: installed RPC/trigger bodies, coordinated constraints, privileges, RLS, tenant and recipient guards, `READ COMMITTED` gate and non-`void` payment check match the approved design. The ordinary function's only body change is the intended simplified branch. **`DATA_COMPARISON_NOT_VERIFIED`:** five current Billing-table fingerprints lack a comparable pre-migration baseline using the same algorithm. The schema dump cannot establish unchanged historical invoices, payments, counters, current tenant flag values or absence of new records. There is no demonstrated structural defect; no data-integrity PASS is claimed.

**Remaining gates:** tenant activation, real staging HTTP end-to-end, browser/print and Product Owner fiscal UAT, advance/saldo and corrective treatment, and later external provider/VERI*FACTU integration. No complete fiscal conformity or commercial-production readiness is declared. The 001E and earlier sections remain historical checkpoints for their original phases.

## BILLING-SIMPLIFIED-INVOICE-001E — Draft persistence foundation closeout (17/10/2026)

**FOUNDATION COMPLETE / CTO SQL PASS / POSTGRESQL RUNTIME PASS / STAGING MIGRATION AND POSTFLIGHT PASS. SIMPLIFIED ISSUANCE STILL DISABLED.** Canonical Billing supports persisted simplified drafts with fiscal type and an anonymous or explicitly identified recipient snapshot. Occasional identity does not require a permanent customer; an identified registered-customer reference is derived from the linked tenant order. Ordinary creation/editing contracts remain compatible, with registered customer identity required and `WALKIN-SHARED` still blocked. Detail, editing and reopening reuse the same invoice/order links. No second register, numbering system or financial source is introduced.

**Preserved boundaries:** server-derived tenant/permissions/entitlements, same-organization FK, RLS, active invoice/order uniqueness, historical snapshot/type immutability and concurrency protection remain enforced. IGIC-inclusive commercial prices, canonical discounts/taxes/totals, payments and 001D series ownership/ordinary numbering are unchanged. Operational receipts, tickets and labels remain non-fiscal. The PO decision against manual per-service whitelisting is preserved; operation-level fiscal approval is distinct from draft persistence and is not inferred from catalog, amount or submitted flags.

**Validation reused, not rerun at closeout:** **155/155 focused tests PASS**, **30/30 repeated after the last refinement PASS**, **44/44 isolated PostgreSQL 17.6 checks PASS**, **9/9 static contracts PASS**, TypeScript, scoped ESLint, IT/ES/EN/FR/DE and diff checks PASS; **CTO SQL review PASS**. Runtime evidence uses real Billing SQL with synthetic operational/auth dependencies, including concurrent duplicate preparations under all three relevant isolation levels; it does not prove full Supabase/PostgREST HTTP integration or fiscal acceptance.

**Staging:** only migration **`20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql`** was applied to verified **`exthnplfokcucaqydney` (EcoWash Phoenix), database `postgres`**, following single-file dry-run PASS. SHA-256 **`8d82a6230bd733011481b852636b472ca15f59db8666dd170b7f4944c1bddf91`**. **100 migrations aligned, none pending; do not reapply 001E.** Read-only postflight PASS: original-row counts/fingerprints unchanged across ten tables, including invoices/items/order links, settings, ownership/counters, orders/items, payments and customers. The new recipient-mode field alone is excluded from the original-invoice fingerprint. Three existing ordinary invoices (one draft/two issued) remain unchanged and classified `registered`; no business record, new draft, fiscal document or progressive was created. Nine installed definitions match the approved SQL; existing function signatures/ACLs/attributes, prior triggers, table access, RLS/policies and indexes are preserved apart from the explicitly approved function bodies and additive schema/guard changes. See [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) for the comparison scope.

**Issuance remains BLOCKED:** the 001B `ordinary-only` CHECK is now atomically replaced by validated **`invoices_simplified_draft_only`**. The issue RPC separately refuses simplified before allocating any counter. Fiscal Profile's disabled CHECK remains active; **`simplified_invoicing_enabled = false`**, no simplified series configured, no simplified document/counter on staging. Private helpers remain inaccessible to anon/authenticated; only explicit public overloads are granted. The simplified operator choice/full issuance workflow remains unavailable; schema-level draft persistence is not fiscal approval.

**Next separately scoped mission:** complete simplified fiscal issuance and effective numbering, fiscal timing, advance/final-document linkage, balance reconciliation and corrective handling, then HTTP end-to-end and fiscal/browser/print UAT. These gates remain **OPEN**. Future VERI*FACTU provider integration is separate. **No complete fiscal conformity or commercial readiness is declared.** Existing PO decisions, UAT and unrelated findings remain unchanged; no new mission starts automatically.

**Closeout scope:** baseline `main`/`origin/main` **`3e42f88cc610cc991df3d0ccec9ebb647f146cdd`**, 20 approved files preserved by SHA-256 plus only the two canonical documents: **22 files**, one commit `feat(billing): prepare simplified invoice draft persistence`. **Staging-only Git target gate PASS:** after the MCP project read returned 403, the already available Vercel CLI verified the authorized owner/project and complete team inventory; only `ecowash-phoenix-staging` is linked to this Phoenix repository, on branch `main`. The team's other project uses a different repository. No configuration or Cron changes were made. Normal push is authorized only to that established staging path. No further SQL/migration, business write, functional change, manual deployment or commercial-production operation. New deployment/source/Ready must be verified independently or reported `DEPLOYMENT_NOT_VERIFIED`. Historical checkpoints below remain evidence for their recorded phases, including the earlier ordinary-only/no-persistence limitations.

## BILLING-SIMPLIFIED-INVOICE-001D — Series ownership and closeout checkpoint (17/10/2026)

**TECHNICAL FOUNDATION COMPLETE / SQL REVIEW PASS / POSTGRESQL RUNTIME PASS / STAGING APPLICATION AND POSTFLIGHT PASS. SIMPLIFIED ISSUANCE REMAINS DISABLED.** Canonical Billing now has exclusive, immutable fiscal-series ownership per organization/series/type, with historical collision detection/backfill, typed invoice/counter FKs and guards on relevant writers. The authenticated Owner/Billing reservation path selects a verified series only; it neither assigns a number nor authorizes fiscal operations. Ordinary invoicing remains compatible without simplified configuration. No second invoice register, numbering truth or print engine is introduced.

**Preserved evidence:** **195/195 contracts/regressions PASS**, TypeScript, scoped ESLint, five-locale validation and diff checks PASS. The initially skipped PostgreSQL parent is separate evidence, not an extra PASS. Following the valid SERIALIZABLE fixture correction, **11/11 pertinent static contracts PASS**. Subsequently **31/31 PostgreSQL 17.6 tests PASS** in a dedicated temporary local Docker database: concurrency, all three relevant isolation levels, ownership, counters, collisions/backfill, privileges and rollback/deadlock handling. The synthetic schema/canonical allocation fragment does not establish full invoice-RPC integration or fiscal issuance. Temporary resources were removed and the pre-existing Supabase container remained unchanged. These suites are not rerun during this documentation/release closeout.

**Staging:** applied only `20261017000100_billing_simplified_invoice_001d_series_configuration.sql` to verified **`exthnplfokcucaqydney` (EcoWash Phoenix), database `postgres`**, after preflight and single-file dry-run PASS. SQL SHA-256 **`2dbf3ab760d8d677b87e1c3e4cb9ed37593c8158d44850043beb98beeb34c4d9`**. **99 migrations aligned; none pending. Do not reapply it.** Postflight confirms the ownership backfill/structure, typed FKs, active triggers, RLS and client privilege restrictions. Original-data fingerprints across **nine tables**, and **15 pre-existing Billing functions**, remain unchanged; the two existing ordinary issued invoices, their links/amounts/numbers/states and historical counter values are preserved. The new counter type is ordinary. No business record or fiscal document was created/changed by this application/verification.

**Presentation:** explicit fiscal printing resolves existing Billing without silent operational-receipt fallback or new issuance. Prepared double-copy printing uses one fiscal document and its persisted snapshot, with separate customer/laundry labels and no live payment-status substitution. Ordinary print, operational receipts, tickets and labels retain their boundaries. **Fiscal two-copy browser/physical-print UAT is still OPEN**; local synthetic evidence does not replace it.

**Remaining gates:** both 001B **`invoices_fiscal_document_type_ordinary_only`** and Fiscal Profile **`organization_billing_settings_simplified_disabled`** remain validated/active. **`simplified_invoicing_enabled = false`**, simplified series unconfigured, no simplified invoice emitted. Allowed services/fiscal conditions, advances/balance and timing, occasional-recipient handling, simplified creation/issuance and fiscal corrections still require approved rules and complete enforcement. Neither guard may be removed independently of that workflow. `WALKIN-SHARED`, tenant isolation, authorizations, ordinary RPCs, IGIC, prices, rounding, snapshots and payments are preserved. **VERI*FACTU integration remains a separate future scope. No full fiscal compliance or commercial readiness is declared.** No next mission is started automatically.

**Release scope:** synchronized baseline **`fc78b001bf04a7550c34040bd680ced79a4f2e34`**, empty index and exactly 18 tested/applied mission files, protected by SHA-256 comparison. Only Session Handover and Project Status are added: **20 authorized files**, one commit `feat(billing): prepare safe simplified invoice series and printing`, followed by normal push after gates. Local project metadata and the baseline's single successful GitHub Vercel status identify **`ecowash-phoenix-staging`** (`prj_u7MwRwQOLyRSRvbuhRLdURx653aZ`, team `team_nhXOvQKcrv9yeHjZ4aoMOak3`); no other destination is observed. Vercel returns **403**: live inventory and the new source/deployment Ready state remain **DEPLOYMENT_NOT_VERIFIED** pending independent evidence. No manual deployment, Cron/configuration change, further SQL or business write, commercial-production operation or additional functional change in this closeout. Historical checkpoints, acceptance evidence and unrelated open findings below are preserved; previous preparation limits describe their original phases.

## BILLING-SIMPLIFIED-INVOICE-001C — Staging application and closeout checkpoint (16/10/2026)

**TECHNICAL PREPARATION COMPLETE / CTO REVIEW PASS / STAGING MIGRATION PASS / POSTFLIGHT PASS / SIMPLIFIED DISABLED.** Existing Billing preparation offers the fiscal-type selector: ordinary remains available; simplified is visibly disabled with translated explanation. Authenticated/entitled server handling rejects simplified and invalid/ambiguous selections before database access, while ordinary and legacy requests preserve the canonical RPC/payload. Detail/print reads and presents the existing fiscal discriminator; ordinary rendering/calculations and order/document links remain canonical. No new archive, numbering engine or financial source is introduced.

**Evidence distinguished:** prior implementation **160/160 focused tests PASS**, TypeScript, scoped ESLint, five locales and whitespace checks PASS. Later read-only CTO review repeated **46/46 pertinent tests PASS**. These results are reused during closeout, not reported as a new full-suite run. Coverage combines synthetic local execution of actual action/query/form/view functions with static SQL contracts; it is not PostgreSQL write/concurrency or fiscal-compliance proof.

**Staging migration:** only **`20261016000300_billing_simplified_invoice_001c_series_reservation.sql`** applied to **`exthnplfokcucaqydney` (EcoWash Phoenix)** after all target/schema/history/dry-run gates. SHA-256 **`410b512e8499d3d174e990b551e9b641aff1e163d9b33148059df739b861536b`**. **98 migrations aligned; none pending.** Do not reapply. It adds nullable text `simplified_series` and a validated format constraint to the existing Billing settings, with no assigned series/default/counter or changes to existing RPCs/RLS/privileges. Application reads do not yet depend on that field.

**Postflight PASS:** the existing configuration's identity is unchanged, `simplified_series` remains NULL, ordinary series is unchanged and its flag remains false. Counts/fingerprints of original values match baseline across nine tables; only the new column is excluded. Invoice/line/link data, ordinary numbering counters, orders and payments are unchanged. All **15 Billing-related functions**, existing triggers, policies, RLS/grants, previous columns/constraints and canonical IGIC/snapshot behavior remain intact; both invoices are ordinary and none is simplified. Comparison details are in [Session Handover](../00_START_HERE/SESSION_HANDOVER.md).

**Activation still BLOCKED:** 001B `invoices_fiscal_document_type_ordinary_only` and Fiscal Profile `organization_billing_settings_simplified_disabled` remain active. The dedicated simplified series still requires configuration/approval and verification against every ordinary historical/custom series; canonical organization/series counters and uniqueness will be reused. Fiscal eligibility, recipient requirements, limits/conditions, dates/mentions and coordinated server controls/guard migration remain to be completed under separate approval. **VERI*FACTU remains separate.** No simplified fiscal readiness or complete conformity claim.

**Acceptance:** browser UAT **NOT EXECUTED / OPEN**; local markup does not establish browser/PDF/physical-print acceptance. No runtime invoice creation/update/issuance or concurrent-write test, fiscal emission or business record mutation occurred. Only the authorized staging DDL was applied; no additional migration or production operation.

**Release scope:** baseline `main`/`origin/main`/GitHub `2b2653c93220ec4bbaa5c4baaafdaff8277b42f6`, 11 modified/3 new mission files and empty index; all 14 hashes match CTO PASS. Add only the two canonical documents for **16 files total**, one commit `feat(billing): prepare simplified invoice workflow`, then normal push after final gates. Local Vercel metadata and the baseline's single successful GitHub Vercel status identify only `ecowash-phoenix-staging` in the observed path. No commercial target is observed; its Production label is the staging project's target. Report new source/Ready separately, or **DEPLOYMENT_NOT_VERIFIED** when inaccessible. No manual deployment, Cron/settings change, rollback or commercial-production intervention. Historical checkpoints and unrelated open work remain preserved; no next mission starts here.

## BILLING-FISCAL-PROFILE-001 — Final closeout checkpoint (16/10/2026)

**MINIMAL CONFIGURATION FOUNDATION COMPLETE / CTO REVIEW PASS / STAGING MIGRATION PASS / POSTFLIGHT PASS.** Migration **`20261016000200`**, `billing_fiscal_profile_001_minimal_configuration`, is already applied only to Supabase staging **`exthnplfokcucaqydney` (EcoWash Phoenix)**. Target/schema/history checks, single-file dry-run and application passed. **97 migrations are aligned locally/remotely**; do not reapply SQL. Approved SHA-256: **`d0abe9affbd95229233938ba87350bf9bfc352cec098ac569b339c72f4bfe8ab`**.

The existing `organization_billing_settings` receives only **`fiscal_territory_code`** and **`declared_tax_regime_code`** (nullable text identifiers) plus **`simplified_invoicing_enabled`** (NOT NULL boolean, default `false`, CHECK preventing `true`). Codes are declarations, not approved rules; no tenant receives inferred fiscal values. Existing identity/country, series, rates, permissions and Owner-only settings RPC remain unchanged; there is no new application editing path or duplicate configuration system.

**Simplified invoices remain disabled** by the settings CHECK and independently by the unchanged 001B **`invoices_fiscal_document_type_ordinary_only`** guard. No preparation, persistence, issuance or provider integration for simplified documents is enabled. Activation requires separate approved server controls/workflow and migration.

**Evidence:** **11/11 dedicated static contracts PASS**, repeated during CTO final review; prior **46/46 focused implementation contracts PASS** is historical, not rerun during this closeout. Read-only postflight confirms column types/defaults and validated constraints; the single existing configuration has unchanged identity, NULL codes and false flag. Original-row fingerprints/counts match baseline in nine relevant tables. **15 Billing-related functions**, RLS, grants, policies and existing triggers are unchanged. Both invoices remain `ordinary`; zero `simplified`. No changes to invoices, orders, payment registrations, numbering, snapshots or canonical IGIC calculations. See [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) for comparison scope and limitations.

**Runtime write tests NOT EXECUTED.** Catalog/SELECT and static checks do not certify complete fiscal conformity. No business record was created or altered; this closeout does not access Supabase or apply any SQL/additional migration. The authorized staging schema application is a completed preceding phase.

**Release scope:** baseline `main`/`origin/main`/GitHub `8087474f1ce15443c16b8e5c1602edc7f6e05cf2`, only two approved untracked mission files and empty index. One authorized four-file commit `feat(billing): add minimal fiscal profile configuration` includes the unchanged SQL/test and the two canonical documents; normal push follows the final gates. Local project metadata and the baseline's single successful GitHub Vercel status identify `ecowash-phoenix-staging` in the observed release path. No other destination was observed; no application/configuration/Cron change or manual deployment is authorized. Report the new deployment separately as verified or **NOT_VERIFIED**; prior success is not evidence of the new commit's Ready state. Commercial Phoenix production is untouched.

**Next objective:** complete the simplified-invoice workflow using canonical Billing numbering and traceability, under separate scope/approval. Fiscal conditions still require approval; **VERI*FACTU provider integration remains separate**. No new mission starts here and no full fiscal-compliance or commercial-readiness claim is made. Earlier checkpoints, decisions, UAT and unrelated open findings are preserved; prior next-task wording below is historical for this foundation.

## BILLING-SIMPLIFIED-INVOICE-001B — Staging postflight and release checkpoint (16/10/2026)

**FISCAL TYPE FOUNDATION IMPLEMENTED / CTO SQL REVIEW PASS / STAGING MIGRATION APPLIED / READ-ONLY POSTFLIGHT PASS.** Migration `20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql` is already applied to **`exthnplfokcucaqydney` (EcoWash Phoenix staging)**; **do not reapply it**. Target verification, single-file dry-run and application passed in the preceding phase; migration history now has **96 aligned entries**. SQL SHA-256 remains `74f904597f2e802e684496fd7bd0724410108555763283a332debcc8db5e307b`.

The `ordinary`/`simplified` discriminator is prepared on canonical Billing invoices, with NOT NULL/default `ordinary`, a validated ordinary-only CHECK and an enabled independent non-draft immutability trigger. Function EXECUTE is revoked from PUBLIC, anon and authenticated. **Simplified invoices remain blocked, including drafts**; no simplified issuance, new numbering system, document archive, print engine or provider integration is implemented.

**Postflight:** after the earlier temporary CLI-role authentication stop, this read-only continuation succeeded using the established access. Counts and fingerprints of all original row values match the saved pre-migration baseline across nine tables, including both invoices, their three items/two order links, numbering counters, orders/items, payments, customers and Billing settings. The new fiscal-type field alone is excluded from the invoice comparison. Existing IDs/numbers/statuses, amounts, taxes, links and payment registrations are unchanged; both invoices are readable and `ordinary`, with zero `simplified`/NULL types. Eight existing Billing function bodies/signatures, invoice active-order uniqueness, previous columns, compared policies/grants and existing triggers remain unchanged. Full comparison details and limits are in [Session Handover](../00_START_HERE/SESSION_HANDOVER.md).

**Validation:** prior implementation **51/51 local tests PASS**; closeout repeated **14/14 dedicated static contracts PASS**. Read-only catalog checks confirm deployed schema protections, not runtime rejection/issuance or concurrency testing. Runtime write tests remain **NOT TESTED**. Fingerprint equality proves no observed change against that baseline; it does not establish historical fiscal validity, absence of pre-existing duplicate payments, full fiscal conformity or production readiness. Other Direct Entry verification/UAT findings remain open as previously documented.

**Release scope:** baseline `main`/`origin/main`/GitHub `6cad22715fe45c06b5613cdf95f7cfbe1ea63a84`, empty index, only two new 001B files. One authorized commit `feat(billing): prepare fiscal document type foundation` contains exactly the migration, its contract test and the two canonical documents, followed by normal push after final gates. This continuation does not reapply SQL, create/alter business data, modify application code/existing RPCs or start 001C. No commercial-production operation or manual deployment.

**Deployment gate:** unchanged local metadata and the baseline's single successful GitHub Vercel status identify `ecowash-phoenix-staging` (`prj_u7MwRwQOLyRSRvbuhRLdURx653aZ`, team `team_nhXOvQKcrv9yeHjZ4aoMOak3`), matching the established gate with no new destination observed. Vercel project/catalog inspection returns **403**; exhaustive live project inventory and the new deployment/source/Ready state remain **DEPLOYMENT_NOT_VERIFIED** pending PO evidence. The staging project's Production target is distinct from commercial Phoenix production. Existing Cron and deployment settings remain unchanged and are not manually activated.

**Next mission: `BILLING-SIMPLIFIED-INVOICE-001C`**, requiring separate scope/authorization. Shared walk-in invoicing and the external provider remain separate; full fiscal compliance is not declared. All historical checkpoints and unrelated findings below are preserved. Their earlier simplified-as-future wording remains historical; only the technical type foundation is now implemented.

## BILLING-DIRECT-ENTRY-001 — Product Owner UAT checkpoint (16/10/2026)

**ORDERS → BILLING VISUAL UAT PASS / RESIDUAL CHECKS OPEN.** Implementation **`d3c9a6074579efb35361a7f060d368dc2e258d93`** is released on `main`, with prior **CTO PASS / 89/89 tests PASS**, TypeScript, scoped ESLint, IT/ES/EN/FR/DE and integrity checks PASS. These remain implementation/review evidence, not suites rerun during documentation closeout. The PO visually confirmed **Ready** on **`ecowash-phoenix-staging`** for `d3c9a60`; this supplements the preserved historical API 403/`DEPLOYMENT_NOT_VERIFIED` report without claiming a new API verification.

**PO browser evidence, 16 October 2026:** order **`EW-000147`**, customer **Carletto**, showed **Prepara fattura** in Order detail. Billing opened with the correct customer/order preselected, detected missing billing data and allowed the PO to save the requested fields. After draft creation, returning to the order showed **Riprendi bozza fattura**; reopening the same draft and viewing its printable layout both passed visually. The PO then experimentally issued invoice **`2026-A-000001`**, linked to `EW-000147`; **Pagata** status and presence in the Billing list were visually observed. Displayed amounts: **total EUR 13.50; taxable base EUR 12.62; IGIC 7% EUR 0.88; confirmed payment shown EUR 13.50; outstanding shown EUR 0.00**. The earlier **EUR 72.00 draft for `EW-000077`** remains present and separate according to the PO. No technical ledger or organization-ownership proof is inferred from these screenshots/observations.

**Still OPEN:**

1. Read-only identification of the organization owning the experimental invoice, explicitly distinguishing old tenant and new pilot.
2. Read-only verification of the absence of external fiscal transmissions.
3. Read-only verification of the absence of duplicate payments; a displayed zero balance is not that proof.
4. Terminal-success → Billing browser UAT.
5. Order detail → an already issued invoice browser UAT, unless equivalent evidence is subsequently documented; issuance and list visibility do not themselves cover this access.

The tested Orders → Billing path has visual PASS, but residual Direct Entry acceptance and complete fiscalization are not closed. Technical issue/numbering does **not** establish fiscal validity. No complete fiscal conformity, physical-print acceptance or commercial-production-readiness claim. Other findings, prior UAT, canonical financial/tenant boundaries and historical checkpoints retain their status. Operational receipts/internal tickets remain non-fiscal; no architecture changes.

Documentation-only scope: this status and Session Handover, from synchronized/clean baseline **`d3c9a6074579efb35361a7f060d368dc2e258d93`**. One authorized commit `docs(billing): record direct invoice entry UAT` and normal push after staging gates; no application/test/configuration change, SQL/migration, Supabase write, new invoice/payment, cancellation or manual deployment in this task. The recorded draft creation and experimental issue were PO UAT operations, not actions of this closeout. **Next mission: `BILLING-SIMPLIFIED-INVOICE-001`**, separately designed/authorized; it is not implemented here. Shared walk-in invoicing and the external provider remain separate missions.

The following release checkpoint retains its original pre-UAT acceptance state as history; the visual PASS above supersedes only the tested path.

## BILLING-DIRECT-ENTRY-001 — Release checkpoint (16/10/2026)

**IMPLEMENTED / CTO REVIEW PASS / 89/89 TESTS PASS / STAGING BROWSER UAT OPEN.** Order detail exposes **Prepare invoice**, **Resume invoice draft** or **View invoice** to Billing-entitled Owner/Manager users. The existing Terminal success link uses the same server-side resolver through the existing Billing preparation route. Server-derived organization/customer context and canonical eligibility select the exact order; active drafts/issued invoices open their existing detail instead of offering another preparation. Cancelled invoices preserve their history and canonical inactive-link/eligibility behavior. `WALKIN-SHARED` and ineligible orders remain protected, with an explicit explanation where applicable and the existing Terminal walk-in exclusion retained. Access alone creates no record. No second Billing model, archive, numbering system or print engine was introduced.

**Evidence:** **89/89 focused tests PASS**, including 30 direct-entry regressions, both during implementation and the subsequent read-only CTO review. TypeScript, scoped ESLint, five-locale translations and `git diff --check` PASS. The 13 implementation/test/translation SHA-256 hashes matched before and after CTO review and again at release preflight. Closeout reuses those results without indiscriminate suite repetition. Tests execute real resolver/query/page/component functions with read-only doubles plus existing contracts; browser behavior and live database concurrency still require their appropriate validation. The unchanged canonical draft RPC and active-invoice unique constraint remain the final duplicate-prevention authority, including races after navigation lookup.

**Invariants:** no change to numbering, fiscal/financial snapshots, commercial prices, IGIC calculations, payments/refunds, POS sessions, RPC, RLS, authorization or tenant isolation. No database/schema/migration change or Supabase write, invoice emission or business-data creation. Terminal creation, checkout, idempotency, five Venta and draft/submission recovery remain unchanged; the Terminal diff changes only its Billing URL. Operational receipts, tickets and the document registry remain canonical and unchanged. Simplified invoices (`BILLING-SIMPLIFIED-INVOICE-001`), shared walk-in invoicing and fiscal-provider integration remain separate, unimplemented missions. This does not establish full fiscal compliance or commercial-production readiness.

**Release:** authorized baseline `main`, local/`origin/main`/GitHub `650fb8923c7e2cbd3ac23888c047ef30dc14ae53`, empty index and exactly 10 modified plus 3 new mission files. Only the two canonical documents are added for **15 files total**, one commit `feat(billing): add direct invoice entry from orders and terminal`, followed by normal push after gates. Git history/release evidence provides the resulting SHA. Local Vercel metadata and the baseline's single successful GitHub Vercel status identify only `ecowash-phoenix-staging` (`prj_u7MwRwQOLyRSRvbuhRLdURx653aZ`, team `team_nhXOvQKcrv9yeHjZ4aoMOak3`) in the verified release path. Project inspection returned **403**: new deployment/source/Ready state remains **DEPLOYMENT_NOT_VERIFIED** until PO confirmation. The existing accepted daily Accountant Pack Cron and configuration are unchanged; no manual invocation, deployment, Vercel change or commercial-production intervention is authorized.

**Acceptance OPEN:** PO confirms staging Ready and checks existing-order action/preselection, existing draft and issued-invoice opening, Terminal confirmation navigation, walk-in/ineligible handling and role visibility. **No new invoice during the first browser UAT.** Other findings, earlier UAT and physical-print/fiscal gates retain their status. Earlier direct-entry-as-future statements below are historical for this navigation scope only; all checkpoints are retained.

## BILLING-INVOICE-PRESENTATION-UX-001 — Product Owner visual UAT checkpoint (16/10/2026)

**UAT VISIVA BROWSER E ANTEPRIMA A4: PASS. PHYSICAL PRINT: NOT EXECUTED.** On **16 October 2026**, the Product Owner confirmed deployment **Ready** on `ecowash-phoenix-staging` for application commit `df3c35c1d9df30c945c52b8d07730e5a5d18a6a1`. The existing Billing **draft linked to `EW-000077`** correctly displayed the net unit price and translated unit; print-preview columns were readable. Chrome preview showed **one A4 page**, without visible clipping or overlap. Displayed amounts verified: **taxable base EUR 67.29; IGIC 7% EUR 4.71; total EUR 72.00**. **No new invoice was issued during the UAT.**

This is PO-reported staging/visual evidence, not an independent new API or automated-browser verification. The earlier API **403 / DEPLOYMENT_NOT_VERIFIED** and pre-UAT OPEN checkpoints below remain historical evidence; the later Ready confirmation and browser/A4-preview PASS update the current acceptance state for this tested draft path.

**Remaining limits:** no physical printing was performed; the tested invoice was a draft. Full fiscal compliance is not demonstrated and Phoenix is not declared commercially ready or fiscally certified. Simplified invoices remain unimplemented. A direct-invoicing button from Orders and Terminal remains a future separate mission, not work authorized by this closeout. Operational receipts remain non-fiscal and separate from Billing invoices. Other module/finding states, previous UAT and architectural decisions are unchanged; no new mission is opened.

This phase updates only Session Handover and Project Status from synchronized baseline `df3c35c1d9df30c945c52b8d07730e5a5d18a6a1`, initially clean with an empty index. No code, test, invoice or business-data change, Supabase write, migration, commit, push or deployment is authorized. The preceding implementation/CTO/test checkpoints are retained below.

## BILLING-INVOICE-PRESENTATION-UX-001 — Release checkpoint (16/10/2026)

**LOCAL IMPLEMENTATION COMPLETE / CTO REVIEW PASS / STAGING BROWSER AND PHYSICAL-PRINT UAT OPEN.** Ordinary-invoice detail/print now presents a single **net unit price, tax excluded, before discounts**, with the existing translated rounding note. The bulky vertical gross/net duplication is removed; commercial gross catalog/Order prices remain unchanged. Missing Billing labels for `service`, `area`, `cycle` and `day` are completed in IT / ES / EN / FR / DE using the existing catalog vocabulary. No technical Billing translation key appears in the tested rendering.

Desktop columns and totals are spaced/aligned, descriptions wrap and narrow screens scroll within the table. Billing-specific CSS selects A4 portrait with 12 mm margins, removes redundant print padding, repeats headings and keeps the summary together. Read-only CTO inspection confirmed exclusive `.billing-invoice-*` usage, print overrides scoped to `.invoice-print-document`, unchanged non-Billing rules and unchanged receipt/58 mm/receipt-PDF/ticket/label formats. No receipt, ticket, label or Daily Close printing behavior was changed.

**Recorded implementation evidence:** **75/75 tests PASS** (25 invoice rendering, 16 invoice-item read-error/recovery, 9 inclusive-pricing, 12 Billing and 13 counter-Billing contracts), **25/25 local browser geometry checks PASS** across the five locales, TypeScript, scoped ESLint, translations and diff checks PASS. Local PDF verification covered A4 dimensions/margins, long descriptions, one-page short invoices and a 35-line multipage fixture with all rows present once and repeated headings. **Subsequent read-only CTO review PASS:** 25/25 rendering tests, **4/4 selected print contracts**, CSS structural/isolation comparison, five-locale validation, TypeScript and `git diff --check`; a further read-only confirmation reused that evidence after verifying identical SHA-256 hashes. These are prior implementation/review results, not a new full-suite run during release closeout. Earlier 44/44 and 69/69 unit-price evidence is preserved below.

Canonical IGIC calculations, persisted prices/snapshots, discounts, bases, taxes, totals, numbering, emission/cancellation, payments/refunds, RPC, tenant isolation and auth/RLS are unchanged. Rounded display units never drive taxable bases or totals. No schema/migration or Supabase write, fiscal emission, invoice/order/customer/payment mutation, Terminal/POS or invoice-entry-button change. Simplified invoices remain in design and are not implemented; external fiscal integration stays separate. **No full fiscal-compliance claim.**

Release authorization: exactly the eight CTO-approved mission files plus the two canonical documents, one commit `fix(billing): refine invoice layout and translations` and normal push from synchronized baseline `beb1d65537a247c1faa0f7052f618590aa4a084c`. SHA-256 protects the reviewed implementation. Only automatic Git deployment to `ecowash-phoenix-staging` is authorized; local project metadata and the baseline GitHub Vercel status identify that target. The staging project API returned 403, so new-deployment verification is **DEPLOYMENT_NOT_VERIFIED** until independently confirmed; Git history/final report supply the release SHA and Git state. No manual deploy, commercial-production operation or Vercel/Cron configuration change.

**Acceptance remains OPEN:** Product Owner staging browser/print-preview/A4/PDF and physical-printer UAT on an existing suitable invoice. Synthetic local rendering and geometry checks do not replace this acceptance. Do not mark the finding CLOSED. Other Billing and Terminal findings retain their previous status.

The following unit-price release checkpoint is historical for presentation and release instructions; its original evidence and canonical financial boundaries remain preserved.

## BILLING-ORDINARY-INVOICE-NET-UNIT-PRICE-001 — Release checkpoint (16/10/2026)

**IMPLEMENTED / CTO REVIEW PASS / 44/44 REPEATED TESTS PASS / VISUAL UAT OPEN.** Detail and print now distinguish the commercial gross unit price (IGIC included for current EcoWash snapshots) from the net unit price before discounts, with a translated pre-discount/rounding note in IT / ES / EN / FR / DE. Unit values use the existing two-decimal currency display; canonical line taxable bases, discounts, taxes and document totals are read from snapshots and remain unchanged. No total is rebuilt from the rounded net unit. Quantity fractions, zero rate, repeating rounding and historical `pricesIncludeTax=false` snapshots are covered.

The 44 repeated tests comprise 19 dedicated render cases, 16 item-read failure/recovery regressions and 9 inclusive-pricing contracts, all PASS. Earlier **69/69 PASS** remains historical evidence. TypeScript (`--noEmit --incremental false`), scoped ESLint and five-locale validation PASS; final Git gates are required before the authorized commit. Tests establish HTML rendering, not visual browser/print/PDF acceptance. PO browser/stampa UAT remains OPEN; do not mark the finding CLOSED.

No RPC, migration/schema, numbering, issue/cancel state, canonical pricing/tax calculation, payment/refund, idempotency, auth/RLS or tenant change. No fiscal/financial snapshot or business data was written. Simplified invoices remain in design, not implemented; the external fiscal provider remains separate. Full fiscal compliance is not declared.

Release scope: exactly seven reviewed Billing files and the two canonical documents. The PO authorizes one commit named `fix(billing): show gross and net unit prices on invoices` and normal push only after final gates pass, with automatic Git deployment exclusively to `ecowash-phoenix-staging`. The PO confirms the previous `2aac81a` staging deployment Ready; this is not proof of the new deployment. An API 403 is `DEPLOYMENT_NOT_VERIFIED`, with visual verification left to the PO. No manual deploy, configuration/Cron/Supabase change or commercial-production operation. Git history and the release report identify the resulting commit and synchronization state.

## Current checkpoint

Use [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) for Git, preserved WIP and immediate continuation. This document owns the current product inventory; historical tables below do not assign new work. Staging acceptance is not commercial-production or fiscal-compliance approval.

## Implemented baseline and acceptance limits

| Area | Verified state and remaining boundary |
| --- | --- |
| Terminal | Five independent Venta workspaces, customer A/B/A drafts, occasional customers and refresh recovery passed PO staging UAT on 2026-10-15. Controlled transactional submission-recovery UAT remains separate. |
| Submission feedback | `TERMINAL-SUBMISSION-CONFIRMATION-UX-001` CLOSED; PO staging UAT PASS on 2026-10-16 (`EW-000150`, EUR 5.00 total, EUR 0.00 payment). |
| Catalog-failure draft protection | Released in `ca1923260b1944bc43fa04de50fed9a6246cf61d`; 73/73 pertinent tests and CTO PASS. Browser staging UAT OPEN; not CLOSED. |
| Production and quality | Production, explicit quality/packing workspace, capability/assignment checks and persistent status history implemented and operationally UAT-tested. Final Warehouse placement atomically completes production. This does not prove an explicit passed-quality event for every possible workflow path. |
| Inbound custody | Scheduled/in-progress inbound pickup blocks manual receipt. Canonical pickup completion and Quick Drop retain their existing receipt/item exceptions. |
| Warehouse and fulfillment | Order-level storage and movement history implemented. Outbound departure removes current storage and records transit; failed delivery can return to Warehouse. Actual handoff or completed delivery remains separate from production and payment. |
| POS, payments and refunds | Sessions, partial/mixed payments, balances, reconciliation and dedicated POS/manual-external refunds implemented. Confirmed payments minus separate refunds remain canonical. Till-close UX refinements are not absence of reconciliation. |
| Daily Close and Accounting | Operational close, snapshots, history, exports and operational financial reporting implemented. They are not statutory accounting or fiscal closure. |
| Catalog and pricing | Tenant catalog/categories, locale presentation, segments, server pricing, configured currency and previewed CSV catalog/pricing exchange implemented. Pilot catalog/prices UAT passed; import is now up to 2,000 rows / 1 MB under 002J, superseding earlier 500-row checkpoints. |
| Printing | Browser/system receipt, ticket and label output, printer profiles and QR implemented. Verification of the two physical Windows USB printers remains open; driver/silent printing is not claimed. |
| Billing | Canonical invoice drafts, numbering/issue, immutable financial snapshots, detail/print, customer/order links and tax-inclusive extraction implemented. Full ordinary/simplified-invoice fiscal compliance remains unverified. |
| Billing line-read protection | Released in `6d82aeb156e1b6384dde84cd075a9d8a81b2dd86`; 50/50 pertinent tests and CTO PASS. Browser error/recovery UAT OPEN. |
| Ordinary invoice net unit price | `BILLING-ORDINARY-INVOICE-NET-UNIT-PRICE-001` released in `beb1d65537a247c1faa0f7052f618590aa4a084c`; CTO PASS, 44/44 repeated and earlier 69/69 historical PASS. Net units before discounts and canonical snapshot amounts are preserved by the presentation refinement above. No full fiscal-compliance claim. |
| Invoice presentation | Released in `df3c35c1d9df30c945c52b8d07730e5a5d18a6a1`; PO staging Ready confirmed and browser/A4-preview UAT PASS on 16/10/2026 using the existing draft for `EW-000077` (EUR 67.29 base + EUR 4.71 IGIC = EUR 72.00). Net unit, translated unit and one-page Chrome A4 preview verified. Earlier CTO/test/PDF evidence is preserved above. Physical print NOT EXECUTED; no full fiscal-compliance claim. |
| Customers and Portal | Customer lifecycle/account, Portal requests/history, context isolation and entitlement boundary implemented. PORTAL-UAT-006 scoped revocation/reactivation browser PASS (22/10/2026): retained session denied on protected-order refresh after association disable; 17 existing orders reloaded after re-enable without new login/invitation. Earlier “future Portal” statements are historical. Remaining invitation/identity/security cases, signed-media TTL, Portal translation and legacy-deployment Auth findings remain open; see the current acceptance checkpoint above. |
| SaaS foundation | Organization defaults, tenant numbering, onboarding, Owner location editing and Demo isolation proofs implemented/UAT-tested under their recorded boundaries. This is not complete commercial onboarding or production approval. |

Detailed UAT, migration, commit and limitation evidence remains in the historical checkpoints below and in Session Handover. This consolidation does not rerun or upgrade that evidence.

## Approved decisions to preserve

- Five independent Venta workspaces and draft recovery; canonical customer/order/payment identities.
- Order-level production, quality and Warehouse custody. Final placement completes production; actual delivery and payment remain independent. Garment/package lifecycle, scan history and partial ready/fulfillment are deferred beyond V1.
- For EcoWash, the PO defines operational service completion as quality passed and ready for collection. Mapping that business definition to fiscal timing requires external fiscal validation; do not add automatic fiscal issuance on a status change.
- Tenant-configurable catalog/prices. Current EcoWash commercial prices include IGIC; canonical Billing extracts tax after discounts without changing agreed gross totals or historical snapshots.
- Operational receipts remain non-fiscal. Simplified invoices are the approved habitual mode where permitted, but the fiscal document type is not implemented. Ordinary invoices are used when needed/requested; the current Billing foundation does not itself prove legal compliance.
- Provider-neutral external fiscal integration remains approved future architecture, not an implemented provider. Ordinary invoicing obligations, SIF/VERI*FACTU, B2B e-invoice exchange and management Accounting remain distinct.

## Remaining gates and findings

- Billing presentation released as `df3c35c1d9df30c945c52b8d07730e5a5d18a6a1`, CTO PASS and PO browser/A4-preview UAT PASS on the existing draft for `EW-000077`. Physical-printer validation remains outstanding; draft preview does not establish issued-document or full fiscal compliance. This phase authorizes only the two-document UAT update, with no commit/push or new implementation.
- Browser UAT for catalog draft protection and Billing line-read error/recovery remains OPEN; controlled Terminal transactional recovery remains separate. This Billing visual UAT does not close those findings.
- Terminal customer/catalog loading around five seconds, initial-screen and post-order UX refinement, till-closing procedure and two physical USB printers require their own scope. Existing implementations must not be proposed again as absent.
- Catalog/treatment business clarification and network-loss/recovery procedures remain operational-readiness work; do not infer missing catalog implementation from those questions.
- `AUTH-DR-001C` physical/authenticated recovery remains deferred until pre-production as a hard gate; encrypted off-device backup custody remains open. DB/Storage recovery evidence does not close Auth recovery.
- Preserve the independent Portal legacy-deployment Auth risk, Spanish catalog translations, location-policy/grant drift, country-code onboarding validation, `TEST-DEBT-WALKIN-CONTRACT-001`, monitored dependency finding and remaining valid historical findings. No closure is inferred solely from age.
- Fiscal profile/timing validation, simplified document support, advance/final coverage, rectifications, external-provider integration and SIF responsibilities remain separately scoped. `PHX-FISCAL-RECTIFICATION-001` is not implemented; no financial/fiscal architecture is changed here.
- Commercial production still requires the established security, backup/restore, Auth DR, GDPR, fiscal and Production Readiness Review gates.

## Approved launch targets

EcoWash La Tejita: operational by **20 December 2026**. First controlled SaaS commercialization: **beginning of 2027**. These are PO targets, not completion percentages, guarantees or authorization to bypass remaining gates. Sequencing constraints belong in [Roadmap](../01_PRODUCT/Roadmap.md).

## Historical checkpoints

The previous status body is retained intact below. Its “current”, “next”, absent-feature lists, SHAs and pending migration/deployment statements describe their original dates. Later implementation/UAT evidence and the current inventory above supersede old execution queues. All earlier approvals, UAT and still-valid limitations remain available.

<details>
<summary>Historical status and release checkpoints through 2026-10-16 — expand for original evidence</summary>

Status: Active

Version: 0.1

Last Updated: 2026-10-16

Current Mission: `BILLING-INVOICE-ITEMS-READ-FAILURE-001` IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS. One commit and normal push from `ca1923260b1944bc43fa04de50fed9a6246cf61d` are authorized for automatic deployment only to `ecowash-phoenix-staging`. Browser UAT of the error/recovery path remains OPEN; no fiscal-compliance approval is implied.

Previous mission checkpoint (2026-10-16): `TERMINAL-CATALOG-FAILURE-DRAFT-001` IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS. One reviewed commit and normal push from `8859a9ae638922d4f32adbe5faca885c42724f44` are authorized, targeting only automatic deployment in `ecowash-phoenix-staging`. Browser staging UAT remains OPEN; the finding is NOT CLOSED.

Previous mission checkpoint (2026-10-16): `TERMINAL-SUBMISSION-CONFIRMATION-UX-001` CLOSED / PRODUCT OWNER STAGING UAT PASS on 2026-10-16. Released correction `77c251f48e8a97eec232c6fa74d93840e4c245b7` is synchronized on local `main` and `origin/main` before this documentation update. The Product Owner verified the waiting-to-success presentation using `EW-000150`; no next implementation mission is authorized.

Next Action: Product Owner visually verifies the automatic staging deployment and the Billing error/recovery path on an existing invoice. A failed item read must block the invoice view/print output, and a subsequent successful read must restore the original lines. Terminal catalog-protection UAT and the existing open Billing/fiscal findings, including visual net-unit-price verification, remain separate and OPEN.

Previous next-action checkpoint (2026-10-16): Product Owner verifies the automatic staging deployment and performs browser UAT for catalog-failure draft preservation, explicit retry, checkout blocking, A→B→A, refresh and five independent Venta workspaces. Controlled transactional recovery UAT remains separately scoped. No new implementation mission or commercial production release is authorized.

Previous next-action checkpoint (2026-10-16): review this documentation-only closeout. Controlled transactional Terminal recovery UAT after timeout, including idempotency and payment integrity, remains separately scoped; preserve the other Terminal findings below. `TEST-DEBT-WALKIN-CONTRACT-001` remains open and unrelated. Keep `PORTAL-LEGACY-DEPLOYMENT-AUTH-001` open and assess it before commercial production. Security, backup/restore, managed Auth recovery, GDPR, fiscal compliance and Production Readiness Review remain production gates; Phoenix is not public-production ready.

**Auth DR decision (2026-10-06):** AUTH-DR-001B3 **CLOSED / PASS**; AUTH-DR-001B4 **COMPLETE / PASS**. The Product Owner/CTO deferred the Supabase Pro upgrade because current staging is a pilot/test tenant rather than the near-final real production state. AUTH-DR-001C is **DEFERRED UNTIL PRE-PRODUCTION** and remains a **HARD PRE-PRODUCTION / RELEASE GATE**, requiring a completed eligible physical backup and an isolated authenticated recovery rehearsal. Encrypted off-device custody remains a separate pre-production finding.

---

## BILLING-INVOICE-ITEMS-READ-FAILURE-001 — 2026-10-16 Release Checkpoint

**IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS / STAGING BROWSER ERROR-PATH UAT OPEN.** Root cause: `getBillingInvoice` ignored `itemsResult.error` and mapped `data ?? []`, allowing a failed line read to return a seemingly valid invoice with no items. The correction explicitly throws item-read errors, rejects non-array/unavailable responses and maps only valid item arrays. Detail and print routes await the query, so failure blocks the invoice view through the existing server-error path. Successful manual re-reading restores the original lines; legitimate empty successful results and the existing header-error/not-found behavior remain unchanged. No automatic retry or new UI was added.

**Evidence:** **50/50 pertinent tests PASS** (16 new regressions and 34 existing Billing/tax-inclusive/counter-Billing contracts); four regressions reproduced the baseline defect before correction. TypeScript, scoped ESLint and whitespace checks PASS. Final CTO review PASS. Tests execute the real query and page functions using read-only in-memory Supabase/auth doubles, covering failure, blocked detail/print output, recovery, normal values, empty drafts, not-found behavior, auth/entitlements and tenant filtering. They do not prove browser error presentation or live database/RLS behavior. Release review reuses the completed focused validation.

**Scope and boundaries:** exactly four files: `src/features/billing/server/queries.ts`, `tests/billing-invoice-items-read-failure-001.test.mjs`, Session Handover and Project Status. No persistent invoice/financial data change; numbering, series, prices, tax bases, taxes, snapshots, issue/cancel transitions, payments/refunds, permissions, RLS, RPC and migrations are unchanged. No live invoice, order, customer or payment was created or issued; no Supabase write. Commit message: `fix(billing): reject incomplete invoice item reads`; Git history/release evidence provides the final SHA and push state. Only normal push to `origin/main` and automatic deployment to `ecowash-phoenix-staging` are authorized; deployment verification remains with the Product Owner. No manual deployment or commercial production operation.

**Remaining gates:** browser UAT of failed item reads and subsequent successful recovery remains OPEN. Other Billing findings, including net-unit-price output and its visual verification, remain unchanged and separately scoped. This release does not complete fiscal compliance for ordinary or simplified invoices, IGIC or SIF/VERI*FACTU. Terminal catalog-protection UAT remains separately OPEN. All previous checkpoints and findings below are preserved.

---

## TERMINAL-CATALOG-FAILURE-DRAFT-001 — 2026-10-16 Release Checkpoint

**IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS / STAGING BROWSER UAT OPEN — NOT CLOSED.** Root cause: catalog query errors returned a successful-looking `services: []`; restoring a paused customer draft could therefore reconcile away its items and persist the result. Failed catalog reads and invalid requests now reject. A localized error offers explicit retry; loading/error states keep the catalog readiness reference unset, preserve the stored draft map and block checkout controls plus synchronous submission. Only a successful catalog response reconciles the draft. Genuine empty catalogs and services no longer available retain their existing behavior. Request identifiers discard stale success/error responses; keyed Venta instances and tenant/location storage namespaces remain unchanged. Existing authentication and authorization checks remain in force, with failure distinguished from a valid empty catalog.

**Evidence:** **73/73 pertinent local tests PASS** (62 Terminal/catalog/recovery/workspace cases, including 20 new regressions, plus 11 customer-switching/persistence contracts); TypeScript, scoped ESLint, translation consistency and `git diff --check` PASS. Final targeted CTO review PASS. Existing submission-confirmation test bodies are retained through a shared in-memory TSX harness. Release review reuses this validation without repeating the full 73-test set. Hooks/storage simulations do not replace browser UAT or prove React scheduling.

**Preserved boundaries:** five independent Venta workspaces; registered and occasional customers; A→B→A draft fields, quantities, notes, dates, discounts and delivery; server pricing/eligibility; submission idempotency, frozen payloads, payment keys, POS sessions and recovery; tenant/location authorization. No financial, database, RLS, SQL migration or order-submission RPC change, and no new customer/order/payment/business data. Fiscal/Billing findings are outside this mission.

**Release and acceptance:** exactly 11 approved implementation/translation/test files plus Session Handover and Project Status, in one commit named `fix(terminal): preserve drafts when catalog loading fails`. Git history/release evidence supplies the final SHA and push state. Only normal push to `origin/main` and its automatic deployment to `ecowash-phoenix-staging` are authorized. No manual deployment, new Vercel authorization or commercial production change. The Product Owner will verify the staging deployment and browser behavior; the finding stays OPEN until UAT PASS. Draft-protection UAT can use existing drafts without confirming an order. `TERMINAL-SUBMISSION-CONFIRMATION-UX-001` remains CLOSED; transactional recovery UAT, `TEST-DEBT-WALKIN-CONTRACT-001` and the other documented findings remain separate and unchanged. All previous checkpoints below are preserved.

---

## TERMINAL-SUBMISSION-CONFIRMATION-UX-001 — 2026-10-16 Product Owner UAT Closeout

**CLOSED / LOCAL VALIDATION PASS / FINAL CTO REVIEW PASS / PRODUCT OWNER STAGING UAT PASS.** On 2026-10-16 the Product Owner completed staging UAT with test order `EW-000150`: total **EUR 5.00**, payment **EUR 0.00**. During approximately four seconds of processing, “Guardando pedido… Por favor, espera.” appeared correctly, followed by “Pedido guardado”. The targeted visual confirmation flow passed and the premature unknown-outcome finding is closed.

Functional release: `77c251f48e8a97eec232c6fa74d93840e4c245b7` (`fix(terminal): clarify order submission progress`), committed and pushed on `main`. The historical pre-UAT release checkpoint below, including the Vercel API **403 / DEPLOYMENT_NOT_VERIFIED** limitation, is preserved. Product Owner staging acceptance does not independently verify the deployment source SHA or API Ready state. Controlled transactional timeout/recovery/idempotency/payment UAT remains separately scoped; `TEST-DEBT-WALKIN-CONTRACT-001` and other existing findings remain open and unrelated.

This phase only records the Product Owner's existing UAT evidence in the two canonical documents. No additional order/payment, code or database change, migration, deployment, commit or push was performed. No next implementation mission is authorized.

---

## TERMINAL-SUBMISSION-CONFIRMATION-UX-001 — 2026-10-16 Release Checkpoint

**IMPLEMENTED / LOCAL VALIDATION PASS / FINAL CTO REVIEW PASS / VISUAL STAGING UAT OPEN.** Confirmed diagnosis: a persisted pending attempt selected unknown-outcome feedback before the active original submission had returned. The normal successful response could subsequently show “Pedido guardado” and free the Venta without a manual lookup. No cause was assigned to network/server slowness or to the observed 5–6-second interval.

The rendering now shows waiting while `isSubmitting` or `retrying` is active; genuinely uncertain attempts retain their warning and recovery controls. Only the new `submissionSaving` label was added in IT / ES / EN / FR / DE. Existing success, definitive rejection, `pending`, `not_found`, `completed` and storage-error behavior are preserved. No changes to idempotency, frozen payloads, payment keys, concurrent-send blocking, recovery, five Venta isolation, customer drafts, payments, POS sessions, Server Actions, RPCs, migrations, tenant/RLS or authentication. No artificial timer, polling or automatic retry; no new order/payment or other staging data was created during the correction.

Local validation: **32/32** Terminal/recovery/workspace tests, including **9** dedicated cases; **10/10** customer-switching/persistence regressions; TypeScript, scoped ESLint, translations and whitespace checks **PASS**. Hook-simulated tests do not replace browser visual UAT. Final read-only CTO review **PASS**. The extra customer suite passed **8/9**; its stale Billing assertion fails identically on baseline `9a5cbd3`. `TEST-DEBT-WALKIN-CONTRACT-001` remains **OPEN / PRE-EXISTING / UNRELATED** and was not corrected here.

Authorized release: one commit, `fix(terminal): clarify order submission progress`, with seven approved implementation/test files plus Session Handover and Project Status; Git history/release evidence provide the resulting SHA and push state. Only Git-triggered deployment to `ecowash-phoenix-staging` is authorized. A read of the exact staging Vercel project `prj_u7MwRwQOLyRSRvbuhRLdURx653aZ` under team `team_nhXOvQKcrv9yeHjZ4aoMOak3` returned **403 forbidden**: **DEPLOYMENT_NOT_VERIFIED**, with source SHA and Ready state unconfirmed. No manual deployment, Vercel/Cron change, Supabase write or commercial production operation. Visual staging UAT and the separate controlled transactional recovery UAT remain open.

---

## TERMINAL-FIVE-WORKSPACES-RECOVERY — 2026-10-15 Staging UAT

**IMPLEMENTED / PRODUCT OWNER NON-TRANSACTIONAL UAT PASS.** Commit `8cca0c4374a92776202f592967930a73e354b151` contains five independent Terminal sales workspaces, browser draft-storage failure protection and recoverable submission identity. Local and remote `main` are synchronized. The Product Owner verified the automatic Vercel deployment for commit `8cca0c4` as **Ready** on `ecowash-phoenix-staging`. The read-only status-lookup migration `20261015000100_terminal_order_submission_recovery_001a.sql` is applied to Supabase staging `exthnplfokcucaqydney`; the Git release did not reapply it.

Product Owner non-transactional UAT on 2026-10-15 passed cart isolation, registered-customer A/B/A, distinct occasional customers and refresh recovery. No order or payment was confirmed during that initial UAT. Subsequently, the Product Owner independently tried order confirmations on the EcoWash test account in staging and reported observing orders `EW-000145`, `EW-000146`, `EW-000147` and `EW-000148`. Repeatedly, a temporary unknown-outcome message appeared after submission; without pressing “Comprobar estado del pedido”, after about 5–6 seconds “Pedido guardado” appeared automatically and the Venta workspace was freed. These are Product Owner observations, not independent technical verification of the four order records, actual idempotency, payments or confirmation path. The orders appear created according to available evidence, but controlled transactional UAT and financial integrity verification remain open; Terminal is not yet accepted for live shop operation or commercial production.

**Historical finding — `TERMINAL-SUBMISSION-CONFIRMATION-UX-001`:** at this 2026-10-15 checkpoint, the behavior was open and no cause had been established. See the 2026-10-16 checkpoint above for the confirmed diagnosis, correction, CTO PASS and remaining visual staging UAT.

**OPEN / DEFERRED:** customer/catalog/cart loading of about five seconds; approved but unimplemented initial Terminal screen improvement; future analysis of the POS till-closing procedure; deferred multi-till implementation. Total browser-storage loss still requires manual order verification. The separate Portal legacy-deployment Auth risk, Spanish Portal catalog translation finding, `AUTH-DR-001C` and other production gates remain open.

---

## PORTAL-ENTITLEMENT-BOUNDARY-001 — Staging Validation

**CTO TECHNICAL PASS / STAGING PHASES 1 AND 2 PASS / PRODUCT OWNER READ-ONLY PORTAL UAT PASS.** Phase 1 application guards were deployed to the dedicated Vercel staging project as `dpl_4PYbB5BcRBJhFqPa2CmQgaHaih1i`: Portal requires effective tenant `core.portal`, and invitation/recovery Auth operations are guarded before email or link actions. Invitation also checks that the customer is active in the current tenant before Auth. Phase 2 applied migration `20261014000200_portal_entitlement_boundary_001.sql` once on staging Supabase `exthnplfokcucaqydney`. Eleven functions and two RLS policies were updated; owner, `SECURITY DEFINER`, fixed search paths and required ACLs were preserved. Local and remote migration histories align.

The Product Owner completed **read-only** Historical EcoWash Portal UAT: login, customer order history, `EW-000144` detail, catalog and prices PASS; logout completed. No test orders or payments were created. This was a positive-path UAT, not a manual staging test of every negative authorization case. Historical EcoWash retains authorized Portal access. The new EcoWash pilot retains 219 active services and 219 current EUR prices, zero customers, Portal grants, orders and payments, and no effective `core.portal` entitlement. Functional implementation is recorded in commit `f893a8e41d831c5443ef06e13d451b6abf67bc29`. At the pre-closeout checkpoint, local `main` included that commit while `origin/main` was `aacacdf8e85c6dc1b071cb03c902a185509d68e8`; the documentation commit and push had not yet occurred.

**OPEN — `PORTAL-LEGACY-DEPLOYMENT-AUTH-001`:** authorized team members may still reach immutable old Vercel deployment URLs and run application code without the new pre-Auth guard. The database entitlement boundary is deployed, but older code may still trigger Auth email side effects. Review this risk in a separate approved task before commercial production. Separately, the Spanish Portal catalog contains untranslated Italian descriptive text (**OPEN / NON-BLOCKING**); it is outside this security mission. Managed Supabase Auth recovery (`AUTH-DR-001C`) and other production-readiness gates remain open. No real production access or deployment was part of this mission.

---

## PHOENIX-UNIFIED-CATALOG-002J Staging Closeout

**STAGING IMPLEMENTATION PASS / PRODUCT OWNER UAT PASS / INDEPENDENT POST-IMPORT AUDIT PASS.** Unified catalog CSV export/import carries multilingual service data, existing image references and global base prices. **Prices only** and **Catalog and prices** modes require a detailed preview of catalog and price operations, amounts, effective dates, skipped/excluded rows and errors before transactional confirmation. Tenant-scoped Owner/Manager authorization, exact service-code matching, stale-preview detection and database locking preserve isolation and atomicity. Effective-date price versioning retains history, avoids redundant versions, supports idempotent repeat imports and rejects overlapping active periods; the manual price editor follows the same rules. CSV imports accept up to **2,000 rows / 1 MB**. Tested Spanish Excel/Numbers semicolon and comma-decimal CSV handling rejects ambiguous amounts. XLSX files with embedded thumbnails remain a future separately reviewed product enhancement; CSV does not upload or replace images.

Migrations `20261013000100_phoenix_unified_catalog_002j.sql` and additive `20261014000100_phoenix_unified_catalog_002j_pouat_002.sql` are applied once on staging Supabase `exthnplfokcucaqydney`. UAT-001 fixed preview of excluded archived source rows without codes; UAT-002 aligned the SQL RPC's archived-row skip with that preview. Product Owner confirmation through the standard staging UI passed. The dedicated staging Vercel project was verified **READY** at `https://ecowash-phoenix-staging.vercel.app`; the current alias deployment may change after later pushes. No real production deployment or access occurred.

EcoWash La Tejita Tenerife (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`) now has **219 active services and 219 current active global EUR base prices**, effective `2026-10-14`, open-ended, with exactly two `is_from=true`. All 219 approved active source codes have one eligible current base price, and three archived source services were excluded. The independent read-only audit compared **53 public tables** across pre/post logical dumps: only 219 expected pilot price rows were added. Pilot services, categories and media references were unchanged by the import; historical EcoWash price rows stayed at 235 and Demo at one, with unchanged price fingerprints. Pilot segment prices and operational orders are zero; no active base-price period overlaps were found. This audit does not claim managed Auth or Storage-byte preservation.

Pilot service configuration has **219 visible, 219 customer-orderable and 173 featured flags**. Actual customer Portal access was **not validated or enabled by 002J**; the pilot has no customer or Portal access records. Separate outstanding findings are backup-script robustness, a payments circular-FK warning during logical data dump/restore planning, the pre-existing historical EcoWash `dry_cleaning.portal_featured` drift, and future XLSX/embedded-thumbnail support. Pricing UAT does not constitute production readiness or fiscal approval.

Earlier closeouts below retain their original checkpoints; zero-price statements there predate 002J.

---

## ECOWASH-PILOT-CATALOG-MEDIA-002H Closeout

**COMPLETE / CTO TECHNICAL PASS / PRODUCT OWNER VISUAL UAT PASS.** Functional commit `bc6cc368ac475e563d694a29127da0f5f94b77dd` contains the reviewed runner, frozen manifest and focused tests with execution authorization disabled. Controlled staging transfer to EcoWash La Tejita Tenerife (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`) created 188 tenant-owned `brand-media` objects: 179 managed service images and 9 managed category images. All 219 pilot services remain active and have approved image associations, including 40 application-static references. Nine category images bring the total to 228 associations. `home_textiles` remains NULL; `special_services` is excluded. Pilot prices and operational orders remain zero.

The runner reported `EXECUTION_VERIFIED_COMPLETE` after final read-back. Independent read-only staging verification checked exact pilot ownership and paths, all 228 associations, no extra pilot objects, and 376 source/destination object reads against approved SHA-256, size and MIME evidence. Historical EcoWash's 219 approved active service mappings and 188 source bytes still matched the frozen baseline; its current catalog has 222 services and 13 categories. Demo/UAT catalog rows had no pilot media references. These checks do not establish full before/after preservation of out-of-scope historical or Demo/UAT data. The Product Owner's pilot Owner visual UAT passed. Execution authorization is disabled again (`APPROVED_EXECUTION_ID = null`). Focused tests passed 8/8; TypeScript, scoped ESLint and whitespace checks passed. The operation was staging-only; no application deployment, migration or real production access occurred. Next planned work is a separate pilot pricing mission using reviewed historical EcoWash pricing. This closeout does not mark Phoenix production-ready or fiscally approved.

---

## SAAS-OWNER-LOCATION-SETTINGS-001A Closeout

**COMPLETE / CTO PASS / PRODUCT OWNER UAT PASS.** Functional commit `7ef4843b78a7eab80e9036f8904bfedcb9451aef` adds Owner-only Settings > Locations listing/editing for existing tenant locations in IT / ES / EN / FR / DE. It supports exactly eight editable fields: name, address lines 1 and 2, city, region, postal code, ISO country code and phone. The French location-save failure message was corrected before the manual staging deployment and subsequent Git deployments. Authenticated server context and the Owner-guarded `public.update_owner_location_settings` RPC enforce active membership, organization/location status and same-tenant ownership; foreign IDs disclose no location data. Existing Manager RLS and direct table grants were not widened.

Migration `20261012000100_saas_owner_location_settings_001a.sql` is applied once to staging `exthnplfokcucaqydney`. The RPC remains `postgres`-owned, `SECURITY DEFINER`, empty search path, authenticated-executable only; direct `authenticated` table UPDATE remains unavailable. Manual staging deployment `dpl_9FFiEGrwN1ZguJZUM577tJL584or` was **READY**. Git pushes to `main` then automatically created READY staging deployments `dpl_GT64cw1WjCeNBiScvDoCoEzeKrnP` from functional commit `7ef4843b78a7eab80e9036f8904bfedcb9451aef` and `dpl_4php3vXvaA1EQKAaPCJw7ZUba1Dk` from original documentation closeout commit `4d1018c80f8c129999f1d1c00178396121a89516`. At reconciliation, the alias served the latter from the dedicated staging project; its Git source includes the functional commit and corrected French text. `https://ecowash-phoenix-staging.vercel.app` remains the canonical staging URL. Later `main` pushes may create newer deployments and move the alias; no listed ID is a permanent current target. Unauthenticated location list/detail routes redirected to `/es/login`, and the staging RPC remained available with approved grants. Final validation: **47/47** focused/adjacent tests, TypeScript, scoped ESLint and `git diff --check` PASS.

Cristiano's Owner UAT on pilot organization **EcoWash La Tejita Tenerife** (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`) and location **EcoWash La Tejita** (`aefb7c3d-833c-40aa-a0f5-06020f2c6f97`) passed save, persistence, invalid `SP` rejection, `ES` preservation and restoration of the original empty address/phone. Foreign Demo location access returned 404 without data disclosure; Almacén opened and offered only the pilot location. Read-only staging verification reconfirmed the restored values. No real production deployment.

`SAAS-LOCATION-MANAGER-POLICY-001`, `SAAS-LOCATION-GRANT-DRIFT-001` and `ONBOARDING-COUNTRY-VALIDATION-001` remain **OPEN** for separate review. The new UI/RPC are Owner-only; existing database Manager location policy is not claimed to be globally Owner-exclusive. The next planned phase is **ECOWASH PILOT STANDARD SAAS CONFIGURATION**; pilot catalog, pricing and customer configuration have not yet started.

---

## ECOWASH-PILOT-SIMPLE-ONBOARDING-001C Closeout

**COMPLETE / CTO FINAL REVIEW PASS / PRODUCT OWNER UAT PASS.** Standard Platform Admin SaaS onboarding on staging `exthnplfokcucaqydney` created **EcoWash La Tejita Tenerife** (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`, slug `ecowash-la-tejita-tenerife`) with active Owner `ecowash.tenerife+phoenixpilot@gmail.com` (`375e3f75-e081-4012-9891-6d0bfc0a22d4`) and first active location **EcoWash La Tejita** (`aefb7c3d-833c-40aa-a0f5-06020f2c6f97`). Defaults are EUR / Atlantic/Canary / es / ES; the organization-wide order counter has prefix `ELT` and next number `1`. The approved, narrowly targeted staging correction changed the organization and location country values from `SP` to `ES`, and independent read-only checks confirmed both persisted as `ES`. No product code, schema or migration changed.

The Owner invitation arrived in Spam; normal incognito login passed with `/es/app`, Owner role, correct organization and Settings access. Password authentication UAT also passed: the Owner used Forgot Password, opened the recovery flow, set a new password and signed in successfully with it; no credential or recovery link is recorded. **Pedidos** and **Clientes** were empty, with no foreign tenant records observed. Staging verification found no operational records or Portal grants; old EcoWash, Phoenix Demo and Phoenix UAT remained unchanged. This is a staging pilot baseline, not a production launch or fiscal approval. `ONBOARDING-COUNTRY-VALIDATION-001` remains **OPEN / NON-BLOCKING**: the onboarding form accepted `SP`; review supported country-code validation in a separate mission. Next planned work is standard pilot organization configuration, catalog/pricing setup and onboarding UX review through supported SaaS interfaces; future catalog, pricing and customer configuration has not started. No real transactions, fiscal issuance or live payments are approved by this closeout.

---

## SAAS-DEMO-TENANT-PROOF-001E / SAAS-DEMO-TENANT-ISOLATION-001F Closeout

`001E` is **COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS**; `001F` is **COMPLETE / TECHNICAL PASS**. Phoenix Demo Laundry — Staging (`64584e90-6dc8-465a-8f03-fa2426f54921`) is retained as **STAGING DEMO PROOF DATA**, with active Owner `oceanparadisetejita+phoenixdemo@gmail.com` (Auth UUID `9017e8ca-5ad6-4c10-8472-47d667b149ed`), GBP / Europe/London / en / GB configuration and Demo Counter location.

The Product Owner completed the real staging UI path: tenant configuration → service/catalog → customer → order → inbound Warehouse custody → production → finished custody → POS cash payment → final customer handoff → Warehouse exit. Primary order `EW-000140` (`a3f6d007-73d2-4ad0-84dd-d04f7efc3699`) totaled GBP 10.00; GBP 10.00 was confirmed, final balance was GBP 0.00, handoff completed and Warehouse custody ended. Daily operational evidence showed completed production and handoff, no open orders, unfinished pickup/delivery or open POS sessions. First POS session expected £10, counted £0 and differed by −£10: **TEST RECONCILIATION VARIANCE**, not a product defect. The second empty session closed £0 / £0 / £0. No Daily Close was executed.

The Demo proof discovered `SAAS-ORDER-REFERENCE-TENANT-SCOPING-001`: the former EW/global sequence interleaved EcoWash `EW-000139`, Demo `EW-000140`/`EW-000141` and EcoWash `EW-000142`. It was a **PRODUCTIZATION GAP — FIX BEFORE REAL MULTI-TENANT PILOT**. `001B` resolved it with independent EW, PD and PU tenant counters. Product Owner UAT proved Demo `PD-000001`/`PD-000002` and EcoWash `EW-000143`/`EW-000144`, including EcoWash Portal creation of `EW-000144`; historical references remain unchanged.

`001F` used supported staging Admin-generated one-time Auth links and ordinary authenticated user sessions without persisting or exposing credentials. The Demo Owner read its own organization, customer, service, `EW-000140` and confirmed GBP 10.00 payment. Direct EcoWash customer/service/order/payment IDs returned zero rows each; its full lists held 1 customer, 1 service, 4 orders and 1 payment, with zero foreign-owned rows. EcoWash staff `holidayshosttenerife@gmail.com` (`738f2993-5501-4fbd-8efc-0d4d9c447da2`) read legitimate EcoWash data; direct Demo customer/service/`EW-000140`/payment IDs returned zero rows each. Its full lists held 22 customers, 222 services, 106 orders and 99 payments, with zero foreign-owned rows. The Demo payment and order remained GBP; neither tenant could read the other's payments. No cross-tenant financial aggregation or currency conversion was observed in the tested reads.

Live Demo-session requests with an EcoWash customer ID and, separately, an EcoWash service ID rejected as `invalid customer` and `invalid service`. Before/after staging snapshots matched for orders, order items, status history, payments, pickups, deliveries, storage, Warehouse movements and numbering. Demo remained PD next 3; EcoWash remained EW next 145. There was no allocation or operational side effect and no tenant isolation/security defect in the tested boundaries. Platform Admin retains intended bounded organization summary/detail/configuration access; raw tenant customer/order/payment visibility was not established. Its focused contract suite passed 20/20.

`DEMO-READY-STORAGE-MODE-001` remains **OPEN / NON-BLOCKING**: original `EW-000140` persisted `other → other` despite the reported Piegato selection, while controlled `EW-000141` had CTO-visible Pronto / Demo Finished / one package / Piegato pre-submit evidence and persisted `other → folded` with current mode `folded`. Classification **NOT REPRODUCED**; no product-code fix is justified without recurrence. Retain `EW-000141` as **STAGING DEMO STORAGE-MODE PROBE DATA**. `AUTH-INVITE-DELIVERY-001` is **INVALIDATED / OWNER EMAIL TYPO**; `AUTH-INVITE-RECOVERY-001` is **OPEN / NON-BLOCKING PRODUCTIZATION**.

This completes second-tenant bootstrap, independent Owner access, tenant configuration, catalog/customer/order operation, Warehouse/production/payment/handoff, tenant-scoped numbering, authenticated RLS/read and foreign-object isolation, live foreign-ID rejection and financial isolation. Next phase: **ECOWASH REAL PILOT DATA / OPERATIONAL READINESS** with REAL / TEST / CORRECT classification. Later work remains reliability/failure-mode hardening, backup/restore/DR evidence, `AUTH-DR-001C` as a hard pre-production gate, Production Readiness Review and separate fiscal/VeriFactu design and implementation. No next feature is authorized by this closeout.

---

## SAAS-ORDER-REFERENCE-TENANT-SCOPING-001B Closeout

**COMPLETE / CTO PASS / STAGING PASS / PRODUCT OWNER UAT PASS.** Functional commit `79f1da89cc453fafb627edd636fa1b7a2f2bb7b7`; migration `20261010000100_saas_order_reference_tenant_scoping_001b.sql` applied and aligned on staging Supabase `exthnplfokcucaqydney`; dedicated staging deployment `dpl_FtaWJdLSRMHCkJQpimrAAA9jmkeV` READY at `https://ecowash-phoenix-staging.vercel.app`. Before the fix, one hardcoded `EW` prefix and global sequence produced EcoWash `EW-000139` → Demo `EW-000140`/`EW-000141` → EcoWash `EW-000142`. This was a multi-tenant productization gap, not a direct tenant-isolation defect. Real production was untouched.

Future references use one atomic organization-wide counter per tenant, with trusted prefixes EW (EcoWash), PD (Demo) and PU (UAT). New Platform Admin onboarding requires an explicit prefix of 2–6 uppercase ASCII letters/digits with no spaces or embedded hyphen; ambiguous existing tenants never receive an invented prefix. Format is `PREFIX-NNNNNN`. There is no location/annual reset, ordinary tenant-user editing, application counter, runtime `MAX()+1`, or per-tenant PostgreSQL sequence. Staff and Portal order creation use the same allocator; Terminal and Quick Drop inherit `create_order`. Human-reference lookups stay tenant-scoped, and Shop parsing accepts the approved prefix format. Historical references/UUIDs remain unchanged, including Demo `EW-000140`/`EW-000141`; `(organization_id, order_number)` uniqueness remains. Legacy `public.order_number_sequence` is retained but no longer authoritative for new creation.

Authenticated Product Owner staging UAT observed Demo `PD-000001` → `PD-000002` and EcoWash `EW-000143` → `EW-000144`, proving independent counters. `EW-000144` was created through the EcoWash Customer Portal, so UAT covered both staff and Portal paths. Post-UAT next counters are EW/145, PD/3 and PU/1; historical fingerprints stayed unchanged. No payment, POS, logistics, fiscal or production progression was needed for numbering UAT. `DEMO-READY-STORAGE-MODE-001` remains **OPEN / NON-BLOCKING**: controlled `EW-000141` Piegato → folded persisted, so the issue was not reproduced and no product fix is justified now. `AUTH-INVITE-DELIVERY-001` is **INVALIDATED / OWNER EMAIL TYPO**. `AUTH-INVITE-RECOVERY-001` remains **OPEN / NON-BLOCKING PRODUCTIZATION**. The later `001F` authenticated isolation proof passed and closed the `001E` technical gate as recorded above.

---

## CATALOG-CSV-COMPLETENESS-001 Closeout

**COMPLETE / CTO REVIEW PASS / PRODUCT OWNER UAT PASS / DEDICATED STAGING VALIDATION PASS.** Functional commit `75f81fc134c3c4bfde5c69bf37db799fa0106dab` makes CSV export complete for the authorized tenant beyond 500 services using deterministic tenant-scoped paging and chunked translation reads. A failed page/chunk aborts without a partial CSV. The CSV schema and primary ordering remain, with service ID as a tie-break; tests covered 499, 500, 501 and 1,203 services without gaps or duplicates. Normal catalog admin and shared service-list 500-row UI limits are unchanged. Import remains limited to **500 service rows per operation**; preview and confirmation reject 501+ with an explicit localized error before the import RPC or mutation, and the DB RPC's 500-row guard remains. This is an intentional supported limit. Pricing, segments and tenant authorization are unchanged; no DB/schema/migration change occurred.

Dedicated staging deployment `dpl_BTN9FT4LEvk2hBVy71UNZReEM5tq` is **READY** at `https://ecowash-phoenix-staging.vercel.app`, using the Production target of `puffwaves-projects/ecowash-phoenix-staging`, not real Phoenix production. Public `/es` returned 200; unauthenticated Catalog settings and export redirected to login; recent deployment error logs were empty. Product Owner UAT passed a non-empty UTF-8 CSV export with expected headers and data, and rejected a synthetic 501-row import with the localized maximum-500/no-changes message, no confirmation and no catalog mutation. Final validation passed 121/121 focused and regression tests, scoped ESLint, TypeScript, `git diff --check` and Webpack build. Real production was untouched. `CATALOG-LARGE-IMPORT-001` is **FUTURE / NOT ACTIVE**; supporting imports above 500 requires separate decisions on batching, atomicity, rollback, error recovery and performance. No next implementation mission has started.

## SAAS-TENANT-BOOTSTRAP-001C Closeout

**COMPLETE / CTO REVIEW PASS / PRODUCT OWNER UAT PASS / DEDICATED STAGING VALIDATION PASS.** Functional commit `0d4d3ed251dea0449b70c71ab4919ff2884296d2` adds `/[locale]/platform/organizations/new` for Platform Admin onboarding. Invite-new-Owner is the primary path; an existing Auth identity can be used for recovery. The Server Action requires Platform Admin authorization before Auth Admin prepares and verifies the Owner identity. The authenticated user-session client calls 001B, which independently re-verifies Platform Admin authorization. The invitation is requested and the Auth/Profile identity verified before the tenant is accepted; Owner invitation acceptance is not required first. UUID/email mismatch, active Owner membership, owner Portal conflict and slug collision retain safe rejection semantics without silent mutation. Recovery mode, UUID/email and submitted tenant defaults remain visually coherent after an error; recovery rendering does not invite again. Invitation resend behavior is not promised.

Dedicated staging deployment `dpl_NfXmdECw8woikuUFmjvJUXcA9QqK` is READY at `https://ecowash-phoenix-staging.vercel.app`; `/it` and unauthenticated protected-route checks passed. It used the **Production target of the dedicated staging Vercel project** `puffwaves-projects/ecowash-phoenix-staging` because its Preview environment lacks `SUPABASE_SERVICE_ROLE_KEY`. It did not touch real Phoenix production. Product Owner UAT passed happy-path onboarding, first Owner Auth/login and automatic tenant resolution; non-Platform-Admin denial, UUID/email mismatch, active membership conflict and slug collision; and final recovery UI persistence after the membership conflict. The TEST/STAGING tenant is `Phoenix UAT Tenant 001C`, ID `89d79a7d-79c2-4d39-8a9f-92b38f2032f9`, slug `phoenix-uat-tenant-001c`, with Owner `info@ecowashlatejita.com`, UUID `bbe65ced-320d-4bab-b2a4-ffa5f1ad1e36`. Final local validation passed 23/23 001C tests, 37/37 focused regressions, scoped ESLint, TypeScript, `git diff --check` and Webpack build. No 001C database migration; 001B unchanged. `PLATFORM-ACCESS-DENIED-COPY-UX` remains **NON-BLOCKING / DEFERRED**. The separate Demo Tenant proof is complete as recorded above.

## SAAS-TENANT-BOOTSTRAP-001B Closeout

**COMPLETE / CTO REVIEW PASS / LOCAL DB RUNTIME VALIDATED / STAGING DB VALIDATED.** Functional commit `921424a5f9dc8d83063bdc4214849ce7dd2d1d5d`; migration `20261007000400_saas_tenant_bootstrap_001b.sql`. The trusted Platform Admin RPC atomically creates the organization, first active Owner membership, exactly four baseline entitlements (`core.orders`, `core.customers`, `core.operations`, `catalog.management`), first active location, provisioning receipt and platform audit. The RPC enforces Platform Admin authorization. It requires an existing valid Auth/Profile identity, without email confirmation, invitation acceptance or prior tenant login. It rejects an already active Owner membership, active Portal identity and slug collision; the idempotency key and fingerprint protect replay. Same-Owner and same-slug concurrency and failed-call rollback were validated; no global unique active-membership constraint was added. The full local chain applied 89/89 migrations, and staging `exthnplfokcucaqydney` applied 00400 with local/remote history aligned. Direct staging schema introspection was unavailable because the temporary DB login required `SUPABASE_DB_PASSWORD`; no new credential was added. The bootstrap RPC was not invoked on staging. EcoWash was untouched; no Demo Tenant was created. Production and Vercel were untouched.

`LOCAL-SUPABASE-VOLUME-CORRUPTION-001` — **NON-BLOCKING / DEFERRED**. Preserved original local Docker volume `supabase_db_ecowash-phoenix` cannot start PostgreSQL: `postgresql.auto.conf` was zero-filled; after repair, `PG_VERSION` was also invalid. This indicates broader local filesystem corruption. No EcoWash business data was read or modified. The original volume remains preserved and 001B was validated with a separate disposable local volume. Do not delete or further repair the original volume in 001B.

**Planning only — `PHX-FISCAL-001`:** Keep operational orders/payments, Spain SIF / VERI*FACTU fiscal records, and B2B electronic-invoice exchange with status/payment reporting separate. Future architecture must be provider-neutral, tenant/jurisdiction aware, capable of separating IGIC / IVA and legal fiscal profiles, explicit about document series/corrections, idempotent/auditable, compatible with outbox/reconciliation/retention/DR, and isolated by organization and fiscal identity. Sequence: SaaS productization/onboarding → remaining approved operational scalability → stable baseline/UAT → `PHX-FISCAL-001` architecture and compliance boundary → separate Spain SIF and B2B design → sandbox PoC → separately authorized fiscal implementation. No fiscal schema, code, UI or provider work is authorized here.

The 001B closeout above is historical; 001C and the subsequent separate Demo Tenant proof are complete.

## Purpose

Track the current development state of EcoWash Phoenix and provide the handover context required to resume work safely.

---

## Contents

## Historical Status — 2026-10-12 Checkpoint

| Area | Current state |
| --- | --- |
| Repository | `main`, `origin/main` and remote main aligned at original documentation closeout commit `4d1018c80f8c129999f1d1c00178396121a89516` before this deployment-history reconciliation; working tree clean. Functional commit: `7ef4843b78a7eab80e9036f8904bfedcb9451aef`. |
| Current major phase | **ECOWASH PILOT STANDARD SAAS CONFIGURATION / OPERATIONAL READINESS**. Standard staging tenant onboarding `001C` and Owner location settings `001A` passed Product Owner UAT; the Product Owner will configure the pilot through supported SaaS interfaces. Historical EcoWash and Demo/UAT remain separate. No production launch or fiscal approval. |
| New EcoWash pilot tenant | `ECOWASH-PILOT-SIMPLE-ONBOARDING-001C` **COMPLETE / CTO FINAL REVIEW PASS / PRODUCT OWNER UAT PASS**. EcoWash La Tejita Tenerife (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`, slug `ecowash-la-tejita-tenerife`) has an active Owner, first location EcoWash La Tejita, EUR / Atlantic/Canary / es / ES, and `ELT` next `1`. Organization and location country were corrected to and verified as `ES`. Owner UAT showed empty Pedidos and Clientes with no foreign tenant records. `ONBOARDING-COUNTRY-VALIDATION-001` remains open and non-blocking. |
| Owner location settings | `SAAS-OWNER-LOCATION-SETTINGS-001A` **COMPLETE / CTO PASS / PRODUCT OWNER UAT PASS**. Owner-only Settings listing/editing and guarded staging RPC; eight existing location fields, five locales, migration applied once, corrected French message and historical manual/Git deployments READY. The staging URL is canonical; `main` pushes move its alias to newer deployments. Owner save/persistence, validation, restoration, foreign 404 and Almacén location UAT passed; 47/47 tests. `SAAS-LOCATION-MANAGER-POLICY-001` and `SAAS-LOCATION-GRANT-DRIFT-001` remain open; no real production deployment. |
| Tenant-scoped order references | `SAAS-ORDER-REFERENCE-TENANT-SCOPING-001B` — **COMPLETE / CTO PASS / STAGING PASS / PRODUCT OWNER UAT PASS**. Staging migration/deployment and four authenticated UAT orders passed; EW and PD counters advanced independently, including EcoWash Portal creation. Historical references remain intact. `001F` subsequently passed live authenticated isolation, completing the `001E` technical gate. |
| SaaS configuration foundation | `SAAS-PRODUCTIZATION-CONFIGURATION-FOUNDATION-001` (`804bbe917ef31bbfed5b3c9ed18ebdb042efda2e`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. `public.organizations` is authoritative for internal name, default currency, timezone, default locale and default country; branding and Billing legal identity remain separate. Migration `20261007000300_saas_productization_configuration_foundation_001.sql` is applied only to staging Supabase `exthnplfokcucaqydney`, with history aligned through `20261007000300`; Vercel staging deployment `dpl_9AxE4xixvkB864mHSGEQ7aeP1CpS` is READY. EcoWash pilot settings are EUR / Atlantic/Canary / es / ES. Owner-only mutation derives tenant context server-side, fixes `search_path`, uses explicit RPC grants, narrows authenticated direct UPDATE, and preserves RLS, tenant isolation and separate Platform Admin paths. Name/locale/country are editable; currency changes stop after service/segment prices, Orders, invoices or expenses; timezone changes stop after Orders, POS sessions, persisted Daily Closes, invoices or expenses; unchanged values remain allowed. Customer/Property/Service/Pricing/POS/Shop defaults use tenant configuration. UAT passed locale es→it→es, country ES→IT→ES, rejection of EUR→USD and Atlantic/Canary→Europe/Madrid, and Customer, Property, Service and Shop/Terminal defaults. The locale selector/read-back correction required no new migration. No historical financial, customer/property or timestamp rewrite; tax-inclusive Billing remains unchanged; public production was untouched. Final 9/9 Productization and 4/4 Settings contracts passed; earlier 145/145 initial, 243/243 mutability, 13/13 locale-fix tests and scoped ESLint, TypeScript, locale JSON parse, `git diff --check` and Webpack builds passed. |
| Billing eligible Order selector | `BILLING-ELIGIBLE-ORDER-SELECTOR-001` (`f92e0f5b67c9cc87752fafd0c713dd55286a9143`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. Read-only RPC applies canonical tenant/Order/customer/invoice-link eligibility and search before the final bound; `created_at DESC, id DESC` yields 100 visible Orders plus a 101st `hasMore` sentinel. Exact old `orderId` resolution and inactive-customer warning remain. Migration `20261007000100_billing_eligible_order_selector_001.sql` is applied only to Supabase staging `exthnplfokcucaqydney`, with local/remote history aligned through `20261007000100`; Vercel staging `dpl_CdbLFUsoo9rZPhHhyNn58ot3d75y` is READY. Owner UAT passed. No Billing mutation/payment/fiscal semantics changed and public production was untouched. |
| Billing tax-inclusive pricing | `BILLING-TAX-INCLUSIVE-PRICING-001` (`f679b482194e4246ca10e691473057fe23095fa6`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. Canonical Order totals are final customer-facing gross amounts: `invoice.total = sum(selected orders.total)`; Billing extracts tax after discount and never adds it to gross. Migration `20261007000200_billing_tax_inclusive_pricing_001.sql` adds `prices_include_tax` to invoices/items, converts safely reconcilable drafts, preserves issued/cancelled legacy snapshots, and was applied only to Supabase staging `exthnplfokcucaqydney`; local/remote history aligns through `20261007000200`. Vercel staging `dpl_AKRVsyrxAjkAqZqXxSFkJ2inbwtN` is READY. Product Owner UAT PASS: at 7%, `12.50 - 10.00 = 2.50` gross → base `2.34`, included tax `0.16`, total/paid `2.50`, outstanding `0.00`, with “Imposta inclusa” displayed; changing to 21% changed base/tax to `2.07`/`0.43` while total/paid stayed `2.50` and outstanding `0.00`. No definitive legacy invoice was naturally available for visual comparison; automated immutability coverage passed. Orders, Order Items, Payments and Refunds were not rewritten; payment truth, tenant/security boundaries and VeriFactu/fiscal behavior are unchanged. No Billing-only tax-mode toggle was added. Public production was untouched. |
| Customer Portal validation | `PORTAL-ORDER-VALIDATION-SUMMARY-001` (`c726182074c82cf85c8326548b51f34f1eb2ca50`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. New-order requests show an order-level validation summary with accessible focus and navigation to invalid sections; field errors resolve interactively. Existing server validation and Order semantics are unchanged. Product Owner UAT passed; canonical staging deployment `dpl_BTiUJFZDuwcRMQqGPFcDpqrdZoVC` is READY. |
| Dependency security | `DEPENDENCY-SECURITY-001` (`976b747f7f291550a605ecd1d789d0a0e70db720`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. Direct `next` and `eslint-config-next` moved in lockstep from `16.2.11` to `16.3.8`; React/React DOM remain `19.2.8`, while Supabase, archiver and tus-js-client are unchanged and have no resolved advisory. Production `npm audit --omit=dev` is **0 critical / 0 high**. Full audit is **0 critical / 5 high packages** on only the dev/tooling `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3` chain. `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` (`GHSA-vfj7-8cjw-p6xm`) is **OPEN / MONITORED / DEV-TOOLING ONLY**, with no patched compatible release and no public-runtime exposure identified; do not claim the repository is vulnerability-free. Accountant Pack focused tests passed 6/6; domain regressions 411/411, five locale JSON files, ESLint (0 errors, two pre-existing warnings), TypeScript, `git diff --check` and Next 16.3.8 Webpack production build passed. General suite passed 1063/1069; the six static contract failures were reproduced identically on the pre-change baseline. `npm ci` succeeded and targeted graphs passed; full local `npm ls --all` retains optional cross-platform sharp WASM anomalies. Product Owner local security UAT passed homepage/images, dashboard, Orders, Accounting, existing pack download and navigation. Dedicated staging deployment `dpl_6do2bMybjgY5DeYFLVQ9cc3rEQkb` is READY on the functional commit and canonical alias; home/login, protected redirects, static/optimized local images, Cron registration and worker auth passed. Missing/wrong authorization returned 401; one registered Cron invocation returned 200. Build/runtime logs had no sharp/libvips/WASM, ZIP/TUS, Storage or Supabase errors or 500 in the smoke window. Both existing jobs remain completed; no new pack was created. Authenticated staging history/download was unavailable to the technical session and was covered by Product Owner local UAT. Public production, Supabase migrations and Docker were untouched. The prior Next runtime security blocker is removed after this staging verification; Auth DR remains a separate hard blocker for public production. |
| Async Accountant Pack | `DATA-RETENTION-AND-SCALE-001K-C` (`2d3cce6821beeadf1f9ac1c65f8f9a52b2ef9bc3`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Durable database-backed Owner/Manager jobs support request/history/private download with active deduplication, leased claims, finite retry/recovery, `after()` normal-path acceleration and secured daily Vercel Cron (`/api/internal/accountant-pack/worker`, `17 3 * * *`) for recovery/cleanup. The private `accounting-exports` bucket holds immutable ZIPs with `summary.csv`, `sales.csv`, posted-only `expenses.csv`, persisted `daily-closes.csv` and `manifest.json` with SHA-256 metrics. Organization/location isolation is server-derived. Source exports use bounded keyset traversal without arbitrary overall row caps or offset bulk traversal; CSVs stream into ZIP without full CSV RAM materialization, the final ZIP uses a bounded temporary file, and TUS upload was proven on staging with a synthetic object >6 MiB. The 450 MiB application safety ceiling fails without truncation; it is not a proven Supabase Storage maximum, and real UAT packs were far below runtime/storage thresholds. Signed private download, 14-day artifact expiry, 90-day job metadata retention and bounded cleanup keep artifact expiry separate from source/fiscal evidence retention. Generation-window semantics permit live Sales/Expenses/Summary changes during or after generation and new persisted Daily Close rows while saved snapshots remain immutable; completed ZIP bytes are immutable and regeneration may differ. The pack is accounting support material, not an immutable accounting snapshot, tax return, fiscal evidence, Modelo 420/130, IGIC/IVA calculation, VERI*FACTU, Spain B2B e-invoice, AEAT submission or fiscal book. Migration `20261005000500_data_retention_scale_001k_c_accountant_pack.sql` was already applied only to staging `exthnplfokcucaqydney` and was not reapplied. Product Owner UAT passed two real jobs, including automatic second-job completion, Ready/download and the five-file ZIP/manifest; no third pack was created. Valid PostgreSQL v4 UUID rejection and download redirect HTTP 500 were fixed in the functional commit through one shared validator and atomic redirect headers. Dedicated staging Vercel production-target deployment `dpl_ALDjEqZuhDRCwdmVy4u5VJEEEARW` is READY on the same functional commit with sensitive server-only `CRON_SECRET`; registered Cron is enabled, missing/wrong Authorization yielded 401, correct secret yielded 200 JSON, one manual Cron run succeeded, runtime logs show no 500/unhandled/Storage/Supabase error or secret leakage, and both existing jobs remain completed. Public production was untouched. |
| Quarterly accountant-support exports | `DATA-RETENTION-AND-SCALE-001K-B` (`ac0d3e88416a9204774a693aaf0a9ed437c07281`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Accounting supports Today, Week, Month, Previous Month, Quarter and Custom. Historical year plus Q1–Q4 use organization-local dates and timezone: Jan 1–Apr 1, Apr 1–Jul 1, Jul 1–Oct 1 and Oct 1–next Jan 1, with exclusive ends; invalid year/quarter inputs follow invalid-period behavior. The selected quarter or custom period offers Sales, Accountant Expenses, Period Summary and Daily Close Register CSVs, all accounting support/non-fiscal. Sales reuses 001K-A streamed 250-row keyset pages, unchanged schema, `event_date DESC, event_type ASC, event_id ASC`, `orders.created_at` for active/non-cancelled Orders, `payments.paid_at` for confirmed payments and separate refunds, excluding pending/void and undetailed Quick Drops, without currency conversion. New Accountant Expenses is posted-only, with captured document/payment fields, 250-row `expense_date ASC, id ASC` keyset pages, page-local name hydration and streaming; standalone Expenses still contains draft, posted and void. No inferred tax base, deductible tax or fiscal treatment. Period Summary iterates live canonical events in bounded pages into small per-currency state, never sums Daily Close snapshots, and preserves `collected_net = collected_gross - refunds` and `operational_result = sales_net - posted_expenses`; Online Card is not counted again as ordinary Card. Its four explicit date bases are `orders.created_at`, `payments.paid_at`, `expenses.expense_date` and `daily_closes.business_date`. Operational result is not taxable or statutory profit. Daily Close Register reads persisted snapshots only by `business_date`, one row per close, in 250-row keyset pages ordered `business_date ASC, closed_at ASC, id ASC`; it preserves organization/location scope, location, timezone, snapshot hash and schema/calculation versions, with deterministic per-currency JSON and blanks for unavailable fields. Organization-wide and location closes may coexist and must not be blindly summed. Individual close PDFs are unchanged; no bulk PDFs. All exports enforce Owner/Manager, server-derived organization and 001K-A fail-closed validation of explicit active, non-deleted, same-organization locations. Attachment, UTF-8 BOM, CSV injection protection and `Cache-Control: private, no-store` remain. Multi-row exports stream without full-period `getAccountingWorkspace()`, offset/range traversal or arbitrary total cap, reusing 001K-A/001I indexes. No migration, index, RPC, DB/schema/RLS/table/trigger/source mutation, async jobs or fiscal implementation. Product Owner UAT passed. Final 261/261 selected tests, five locale JSON checks, scoped ESLint, TypeScript, `git diff --check` and prior final Webpack build passed. Live Sales/Expenses/Summary sources may change between pages; individual Daily Close snapshots remain immutable but the register's set may change if a close is created during export. No package-wide immutable snapshot; 001K-C subsequently adopted generation-window consistency for the pack. No IGIC/IVA due or deductible amount, Modelo 420/130, taxable base, quarterly tax payable or fiscal profit is calculated. These convenience CSVs are not tax returns, filings, VERI*FACTU, B2B e-invoice or AEAT submissions, fiscal ledgers or source evidence. |
| Accounting export scalability | `DATA-RETENTION-AND-SCALE-001K-A` (`47602530b30bda1f67ff6f77ed1ff7146710fff1`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Sales CSV no longer loads `getAccountingWorkspace()`; an export-specific read-only RPC supplies bounded 250-row keyset pages on `event_date, event_type, event_id`, ordered `event_date DESC, event_type ASC, event_id ASC`. Sales date is `orders.created_at`; confirmed payments and separate refunded rows use `payments.paid_at`; pending/void payments, cancelled sales and undetailed Quick Drops are excluded; currencies remain separate. Sales schema stays `date, type, order_reference, customer, location, payment_method, amount, currency`. Expenses CSV likewise avoids `getAccountingWorkspace()`, streams 250-row keyset pages ordered `expense_date ASC, id ASC` and hydrates supplier/category/location names per page; draft, posted and void remain included. Expenses schema stays `expense_date, supplier, category, description, reference, location, gross, tax_amount, tax_rate, currency, status`. Both stream incrementally without arbitrary overall row caps or offset/range traversal. Explicit locations must be active, non-deleted and owned by the authenticated organization; invalid/stale/not-owned locations fail closed, never broadening to all locations. Omitted location means all authorized locations. Organization identity is server-derived. CSV attachment disposition, UTF-8 BOM and injection protection remain; `Cache-Control: private, no-store` is explicit. Migration `20261005000400_data_retention_scale_001k_a_export_readers.sql` adds exactly `orders_org_created_id_export_idx` (`organization_id, created_at DESC, id ASC`), `payments_org_paid_id_export_idx` (`organization_id, paid_at DESC, id ASC`), `expenses_org_date_id_export_idx` (`organization_id, expense_date ASC, id ASC`) and `expenses_org_location_date_id_export_idx` (`organization_id, location_id, expense_date ASC, id ASC`), plus the read-only Sales RPC and revoke/grant statements. Applied only to staging `exthnplfokcucaqydney`; history aligned through `20261005000400`; production untouched. No tables, columns, RLS, triggers, constraints, source data, async export schema or fiscal behavior changed. Product Owner staff Owner/Manager UAT passed Accounting, Sales and Expenses downloads/content and existing workflows; the initial Portal-client access-denied was a resolved authentication-context mismatch, not an app defect. Final 152/152 tests and `git diff --check` passed; the prior Webpack build passed. Long exports can observe legitimate changes between pages: immutable fiscal-grade point-in-time snapshots are not provided. 001K-C subsequently chose generation-window consistency for the pack; exports are operational, not fiscal source evidence. |
| Fiscal-volume architecture constraint | Permanent CTO constraint: future design must support append-only/auditable fiscal histories, substantially higher fiscal record counts per transaction, long-term fiscal evidence retention, strict organization/NIF isolation and traceable archival/cold storage. The 001K-A/B readers and separate 001K-C jobs/ZIP lifecycle create no known constraint on those requirements; no fiscal implementation occurred. Generated artifacts never determine source/fiscal evidence retention. |
| Separate export findings | `ACCOUNTANT-EXPORT-PRESENTATION-UX` is **OPEN / NON-BLOCKING / DEFERRED**. Catalog CSV completeness is **CLOSED**; `CATALOG-LARGE-IMPORT-001` is **FUTURE / NOT ACTIVE**, and the current 500-row import limit is intentional. Accounting UI 100-location selector remains later Productization work. `BILLING-ORDER-DETAIL-INVOICE-ACTION-UX` and Billing summary “Fatture” label ambiguity remain non-blocking UX findings. `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` remains **OPEN / MONITORED / DEV-TOOLING ONLY**; AUTH-DR-001C remains a hard pre-production/release gate, with Supabase Pro deferred until pre-production. |
| Export scalability stream | `DATA-RETENTION-AND-SCALE-001K` is **CLOSED**: 001K-A **COMPLETE**, 001K-B **COMPLETE / PRODUCT OWNER UAT PASS**, 001K-C **COMPLETE / PRODUCT OWNER UAT PASS**. This does not close all Phoenix data-retention or scalability work. |
| Customer Portal history scalability | `DATA-RETENTION-AND-SCALE-001J` (`208cb290a9f04653941b64425445ab57d9c29b93`) — **COMPLETE / Product Owner UAT PASS**. Portal history uses true bidirectional keyset pagination ordered `created_at DESC, id DESC`, with 25 visible rows plus a 26th sentinel and Older/Newer/Back to latest. The cursor contains only version, `createdAt`, `id` and direction, rejects malformed values safely and uses no offset/range pagination. Exact complete count is independent of page length; only selected page Orders receive financial hydration. Overview no longer consumes a bounded/full history collection: current active Order comes from complete canonical history, recent Orders are bounded to four, complete per-currency server aggregates and exact count replace bounded application totals, and mixed currencies are not combined. Order detail uses a targeted single-Order financial read. All five new RPCs reuse `customer_portal_current_access()` and bind canonical organization and customer; multiple stored access rows remain supported without aggregation, selector or uniqueness constraint. Confirmed-minus-refunded math, per-Order balance and established status precedence are unchanged. Migration `20261005000300_data_retention_scale_001j_portal_history_scalability.sql` adds only `list_customer_portal_orders_page`, `count_customer_portal_orders`, `get_customer_portal_current_order`, `get_customer_portal_account_summary`, `get_customer_portal_order_financial` and their permissions. It is applied only to staging `exthnplfokcucaqydney`, with history aligned through `20261005000300`; production untouched. Existing `orders_org_customer_created_id_idx` and `payments_org_order_paid_created_id_idx` are reused; no index was added. Product Owner UAT passed identity/branding, current/recent Orders, complete summary/count, history cards, detail and isolation. Pagination depth was not naturally exercisable because current real Portal-visible history tops out at 16 Orders; no synthetic data was created. The accepted automated keyset contract exercised 137 rows. Final validation: 97/97 PASS; `git diff --check` PASS. Order requests, online payments, photo/media authorization, branding/catalog/properties, RLS, tables, triggers, Order lifecycle, payment/refund mutation and fiscal behavior are unchanged. |
| Customer Portal context isolation | `PORTAL-CONTEXT-ISOLATION-001` (`78b4acc`) — **COMPLETE / Product Owner UAT PASS**. Multiple `customer_portal_access` rows for one Auth user remain supported, while the current Portal UX is explicitly single-context. `public.customer_portal_current_access()` is the canonical visible and operable context, and customer-facing reads/actions bind the same canonical `organization_id` and `customer_id`; linked contexts are never implicitly aggregated. No global one-user-one-customer uniqueness constraint, access-row deletion/deactivation or multi-context selector was added. Previously cross-access Order list/detail/items/history/logistics/photos/next-task functions, financial/payment reads, property listing, branding/category authorization and customer-photo Storage authorization were aligned. Staff Owner/Manager access administration, Order-request workflow, online-payment provider/settlement/refund semantics, payment/refund math, Order lifecycle, RLS, tables, triggers, indexes and fiscal behavior are unchanged. Migration `20261005000200_portal_context_isolation_001.sql` contains only twelve `CREATE OR REPLACE FUNCTION` definitions and matching permissions; it was applied only to staging `exthnplfokcucaqydney`, with read-only verification through `20261005000200`. Production was untouched. Product Owner UAT passed identity/branding, current/recent Orders, Order list/detail data, request-page access, online-payment presentation and absence of visible cross-context mixing. Final regressions: 81/81 PASS; `git diff --check` PASS. This is the preserved prerequisite for 001J. |
| Daily Close history scalability | `DATA-RETENTION-AND-SCALE-001I` (`52e3d35`) — **COMPLETE / Product Owner UAT PASS**. Persisted history removes the terminal 100-row cap and uses true keyset pagination with 25 visible rows plus one sentinel, ordered `business_date DESC, closed_at DESC, id DESC`. Older/Newer/Back to latest preserve date and scope; filters apply before limiting. Cursors bind normalized filters, contain no tenant identity and reset safely when malformed or mismatched; no offset pagination was added. Complete scope discovery replaces the former 500-row application-side deduplication: `public.list_daily_close_history_scopes()` detects organization-wide history and all persisted location scopes across the full tenant history, independent of the visible page. Owner/Manager access, Staff denial, server-derived tenant context and existing `daily_closes` RLS remain unchanged. The read RPC enforces tenant/role internally, fixes `search_path`, revokes public/anon access and grants authenticated execute only, without service-role widening. Historical detail still reads one persisted Daily Close and its immutable saved snapshot; no live recalculation, reconstruction or snapshot mutation. Migration `20261005000100_data_retention_scale_001i_daily_close_history_scalability.sql` contains only the read RPC, its revoke/grant statements, `daily_closes_org_history_keyset_idx` and `daily_closes_org_location_history_keyset_idx`; no data, table, RLS, trigger, close-RPC, snapshot, financial or lifecycle mutation. Operator evidence and read-only checks confirm application to staging `exthnplfokcucaqydney`, with history through `20261005000100`; production untouched. Product Owner UAT passed history rendering, date/scope filters, persisted detail/snapshot, return navigation, natural pagination and export/print. No artificial closes were created. Final focused Daily Close and POS regressions: 121/121 PASS; `git diff --check` PASS. `close_daily_close`, `calculate_daily_close_snapshot`, close idempotency, blocker/warning semantics, POS reconciliation, payments/refunds, Accounting, current-day preview, and CSV/PDF export semantics are unchanged. |
| Billing and sales document history scalability | `DATA-RETENTION-AND-SCALE-001H` (`98d94ba`) — **COMPLETE / Product Owner UAT PASS**. Billing removes its arbitrary 100-row terminal history boundary. Server-side `q` (invoice number, customer, linked Order number) and derived payment-status filters run before true keyset pagination: 25 visible rows plus one sentinel, ordered `created_at DESC, id DESC`. Cursors bind normalized `q`/status, contain no tenant identity and reset safely when malformed or mismatched. Separate full-history summary gives complete invoice/draft counts, issued total and outstanding total, independent of the visible filtered page; linked Order confirmed-minus-refunded payments still determine payment status. Customer Billing loads its latest five invoices directly, complete per-currency summaries and exact eligible Order count. `listEligibleBillingOrders()` is unchanged; its operational 100-row selector cap remains a separate future finding. Sales Documents combines canonical receipts and issued/cancelled invoices before a single server-side limit, without a duplicate table, ordered `issued_at DESC, document_number ASC, receipt before invoice on ties, id ASC`; it also shows 25 rows plus one sentinel with keyset navigation. Receipt cancellation and receipt/invoice print routes are unchanged. Tenant context is server-derived; Billing remains Owner/Manager plus billing entitlement, Sales Documents Owner/Manager plus printing entitlement. The four read RPCs use fixed `SECURITY DEFINER` search paths and authenticated-only execute grants, without anon or service-role widening. Migration `20261004000300_data_retention_scale_001h_billing_sales_document_history.sql` adds only `list_billing_invoices_page`, `get_billing_history_summary`, `get_customer_billing_history_summary`, `list_sales_documents_page`, their grants and indexes `invoices_org_created_id_idx`, `invoices_org_customer_created_id_idx`, `receipts_org_history_idx`, `invoices_org_issued_history_idx`; no data mutation, table/RLS/trigger/mutation-RPC/numbering/fiscal change or backfill. Operator evidence and read-only checks confirm application to staging `exthnplfokcucaqydney`, with history through `20261004000300`; production untouched. Product Owner UAT passed Billing cards, search/filter and stable summary, invoice detail/print, Customer Billing summary/recent/create availability, Sales Documents mixed registry, ordering, detail/print and unchanged cancellation visibility. No artificial documents were created to force pagination. Final focused and payment/refund regressions: 80/80 PASS; `git diff --check` PASS. Canonical payments/refunds/net math, Billing invoice and operational receipt numbering/lifecycles/immutable snapshots, Accounting, Customer Account and POS truth are unchanged. Operational receipts remain non-fiscal; no VeriFactu implementation. |
| Customer list/account history scalability | `DATA-RETENTION-AND-SCALE-001G` (`db7c2bf4dbadcd033f0e0e666f317c28e1dc7a4f`) — **COMPLETE / Product Owner UAT PASS**. Customer List replaces the terminal 100-row boundary with true keyset pagination: 25 visible rows plus one sentinel, ordered `display_name ASC, id ASC`. Existing search fields and active/inactive/all filters run server-side before limiting. Cursors bind query/status without tenant identity; malformed or mismatched cursors reset safely. Property counts remain exact through a count for each returned customer, without loading all tenant Property rows. Customer Account Recent remains an unpaginated snapshot of 8 orders and 12 payments. Year/All replace the terminal 50/100-row bounds with independent order/payment keyset histories, each showing 25 rows plus one sentinel with Older/Newer/Back to latest. Orders retain `created_at DESC, id DESC`; payments retain `paid_at DESC, created_at DESC, id DESC`. Cursors bind customer and period; invalid bindings reset safely, changing period clears both, and navigating one history preserves the other. `get_customer_account_summary` remains complete and unpaginated, never derived from the visible page. Confirmed-minus-refunded math and cancelled/inactive order eligibility are unchanged, as are Billing, Accounting, POS, Portal and customer lifecycle. Tenant context remains server-derived; Customer List membership and Owner/Manager-only Customer Account access remain enforced, with no RLS weakening or service-role path. Migration `20261004000200_data_retention_scale_001g_customer_history_scalability.sql` adds only three read RPCs, their permissions and three supporting indexes; both legacy Customer Account RPC signatures remain callable. No data mutation/backfill, destructive DDL, RLS, lifecycle, payment or order mutation. Accepted operator evidence confirms only this migration was applied to staging `exthnplfokcucaqydney`, bringing the applied migration checkpoint through `20261004000200`; production was untouched. Product Owner local UAT against staging passed customer fields/counts, known-customer search, status filters, real Customer Account access, stable complete summary across Recent/Year/All, order/payment history, Order links and Properties. No artificial Customer/Order/Payment volume was created to expose pagination; automated tests cover multi-page keyset mechanics. Final focused and relevant regression validation: 119/119 PASS and `git diff --check` PASS. |
| POS/payment history scalability | `DATA-RETENTION-AND-SCALE-001F` (`166987e86a1c3d11c790230c11b2c1d63d90bda4`) is **COMPLETE / Product Owner UAT PASS**. POS session history and current-session payments use independent bidirectional keyset pagination with 25 visible rows plus one sentinel, replacing the terminal 25- and 100-row bounds. Session history orders by `opened_at DESC, id DESC`; payments by `created_at DESC, id DESC`. Older/Newer/Back to latest preserve outstanding-order `q`, each cursor is independent, and Back to latest clears only its own cursor. Malformed cursors reset safely; payment cursors bind the current POS session, and no cursor contains tenant identity. Owner/Manager history visibility and Staff behavior are unchanged. Current-session summary remains complete and unpaginated; `get_pos_session_summary`, refund actions, payment/refund math, Accounting, Billing, Daily Close and POS lifecycle are unchanged. Migration `20261004000100_data_retention_scale_001f_pos_payment_history_pagination.sql` adds only POS-session `(organization_id, opened_at DESC, id DESC)` and non-null session-payment `(organization_id, pos_session_id, created_at DESC, id DESC)` indexes. It was applied to staging `exthnplfokcucaqydney`, with local/remote history aligned through `20261004000100`; no table, RLS, RPC/function or historical-data change, and production was untouched. Product Owner local UAT passed authenticated POS, coherent till summary, current payments/refund-action visibility, outstanding search and Owner session history without runtime errors. No fake financial activity was created to exceed 25 rows; focused automated tests cover multi-page controls. |
| Terminal customer discovery | `DATA-RETENTION-AND-SCALE-001E` (`13b1247312a81f68654502b5d97ac185510028ff`) is **COMPLETE / Product Owner UAT PASS**. The initial eight Recent customers are presentation-only; non-empty search filters the full active tenant customer population by `display_name`, phone and email before limiting results to eight. Server-derived organization and Terminal access remain authoritative; WALKIN/system customers are excluded. Search is debounced by 250 ms and stale responses cannot replace newer results. Searched customers use existing `selectCustomer`; catalog/segment pricing, A/B/A draft preservation, Quick Drop and customer creation remain unchanged. Product Owner local UAT against staging found “Patricia Sobron Panera” by searching “patricia”, then passed selection, catalog loading, Recent restoration, no-match feedback and Terminal usability. This is not a load or performance benchmark. No database/schema/migration/RPC change, no Supabase remote operation and no production action. |
| Quick Drop pending queue | `DATA-RETENTION-AND-SCALE-001D` (`a0cccbfe792feb53471bf9b7f266afc6ca111efd`) is **COMPLETE / Product Owner UAT PASS**. Pending-detail is an operational queue, not historical pagination. `public.list_pending_quick_drops()` has no organization argument; server-derived organization and `require_shop_terminal_access` protect it. The organization/order-scoped predicate requires an active received Order with `received_at`, Quick Drop history evidence and zero active `order_items`. Order is `received_at DESC, id DESC`; no recent-history cap or SQL `LIMIT` hides actionable work. Terminal count uses the complete queue, with a compact first-five view and Show all / Show fewer access to every returned entry. No new index, table/RLS/history rewrite or workflow mutation. Staging operator reports migration `20261003000200_data_retention_scale_001d_quick_drop_pending_completeness.sql` applied to `exthnplfokcucaqydney`; production untouched. Product Owner UAT passed creation of EW-000134, immediate queue/count/link visibility, removal after item detailing and normal Quick Drop flow. The >5 control passed automated tests; staging was not artificially populated. |
| Order detail warning hotfix | `ORDER-CANCELLED-PAID-WARNING-I18N-001` (`0da06331e1f94f8454cb032e582348f5477b2cb7`) is **COMPLETE / Product Owner UAT PASS**. Order detail reads `payments.cancelledPaidWarning` with `t.raw`; `PaymentsPanel` still replaces `{amount}` with formatted `netCollected`. Order detail renders correctly. No payment/refund semantic or database change. |
| Internal Quick Drop ticket | `QUICK-DROP-UNPRICED-TICKET-STATUS-001` (`7ab6a51d513406adf933d13bb5966fc7608cbd41`) is **COMPLETE / Product Owner UAT PASS**. The internal live Ticket receives canonical Quick Drop `financialState` from `getQuickDropOrderOrNull` through `getPrintOrderContext`; `unpriced` displays the existing localized `common.quickDrop.unpriced` label instead of generic “Paid”. Priced Quick Drops and ordinary zero-value Orders retain `getOrderPaymentSummary` status. Receipt and labels are unchanged. No payment/refund math, `public.get_order_payment_summary`, database/schema/migration/RPC, Accounting or fiscal change; existing translations were reused. |
| Orders History pagination | `DATA-RETENTION-AND-SCALE-001C` (`f4e0924809d544fadcb6d94102c0a245661e5157`) is **COMPLETE / Product Owner UAT PASS**. True bidirectional keyset pagination shows 25 Orders per page and fetches at most 26 with a sentinel; order is `created_at DESC, id DESC`. Older/Newer navigation preserves `q`, status, priority and active filters; a filter change resets pagination. No offset or total-count dependency. Cursors bind `createdAt`, `id`, direction and filters without organization identity; tenant context is derived server-side from membership. Enrichment covers only the 25 visible Orders, not the sentinel; no generic pagination framework was introduced. Product Owner tested the reviewed local working tree against staging Supabase and accepted navigation, newest-first ordering, no visible boundary duplicates/missing jumps, filter reset and pagination UX. Production untouched. |
| Staging migration correction | During the 2026-10-03 rehearsal, operator verification found `20261001000100_order_property_client_filter_001.sql` still pending remotely despite the earlier documentation claim. The staging operator then applied that migration and `20261003000100_data_retention_scale_001c_orders_history_index.sql` to `exthnplfokcucaqydney`; final Local = Remote history through `20261003000100`. The new `orders_org_created_id_idx` covers `(organization_id, created_at DESC, id DESC)` and existing `orders_list_idx` remains. No production change. |
| Previous functional closeout | `RECEIPT-EMPTY-ORDER-UX-001` (`acd04ce4a0b6d891b04996e0645e9c3a41b6b4a7`) is **COMPLETE / Product Owner UAT PASS**. On staging, “Print receipt” for an Order with no active items creates no receipt, returns to usable Order detail and shows the existing localized `orderItemsRequired` warning instead of a generic Next.js server-error page. `public.issue_operational_receipt(uuid)` remains authoritative: only PostgreSQL `22023` with message `operational_receipt_items_required` becomes the controlled warning; unexpected failures remain visible technical errors. Numbering, immutable snapshots, receipt reuse/idempotency, ticket and label printing, entitlement/capability checks, tenant isolation, Accounting, Billing, payments/refunds and fiscal behavior are unchanged. No migration, schema, RLS or RPC change, no Supabase commands, and production untouched. |
| Previous functional closeout | `ORDER-PHOTO-INLINE-VALIDATION-UX-001` (`a4d1c6b4b1f31ac7f1a7c9765dc8c740f43df781`) and `ORDER-PHOTO-UPLOAD-BOUNDARY-UX-001` (`b7fb9d686e8d7ec136cfe6369a341982ce3cf611`) are **COMPLETE / Product Owner UAT PASS**. Staging UAT confirmed that selecting a photo over 1 MB stays on Order detail and shows “L'immagine non può superare 1 MB.” inline, without the generic Next.js server-error page; a valid supported photo under 1 MB uploads, helper text remains visible and the workflow is usable. `MAX_ORDER_PHOTO_BYTES = 1024 * 1024` remains the server-authoritative application limit. Next.js Server Action `bodySizeLimit = "2mb"` is transport headroom only, not a higher allowed photo size. MIME and binary-signature checks, private `order-media` Storage, tenant/order path, `register_order_photo`, cleanup, categories, caption, visibility, deactivation and database/bucket 1 MB boundary remain unchanged. No migration, schema, RLS or Storage-policy change, no Supabase commands, and production untouched. |
| Previous functional closeout | `ORDER-PROPERTY-CLIENT-FILTER-001` (`8f00346e2e1108f3c56be287d5fce009b874047e`) and `PROPERTY-LIFECYCLE-REACTIVATE-UX-001` (`7857d217cce0556b16c84a882fd0c937f321faa7`) are **COMPLETE / Product Owner UAT PASS**. UAT-ready docs checkpoint: `6980de4dac53a8892a074d197e795f537e0d607e`. Product Owner staging preflight found zero historical order/property customer or tenant mismatches. The earlier documentation claim that migration `20261001000100` was applied at that checkpoint was incorrect; the staging operator applied it during the 2026-10-03 001C rehearsal. Production was untouched. |
| Order/property integrity and lifecycle | A Phoenix Property permanently belongs to the Customer under which it was created: `properties.customer_id` is immutable. A real-world transfer preserves the old record and historical Orders, deactivates the old Property when appropriate, and creates a new one for the new Customer. New Orders require an active Customer; Property is optional and, when selected, must be active and belong to the selected Customer and tenant. Customer change clears Property; `create_order` and `validate_order_relationships` remain authoritative. Order edit shows canonical `order.customerName` and `order.propertyName` read-only, including an inactive historical Property, without reassignment. Active Properties show Deactivate; inactive Properties remain reachable and show Reactivate. Deactivation and reactivation passed UAT; ordinary editing while inactive does not reactivate it, normal detail edits work, and Customer ownership remains immutable. Tenant isolation and RLS are preserved; no historical Order rewrite, backfill or new composite FK. Shop Terminal, Quick Drop, Portal, pricing/segments, logistics, payments, Accounting, Daily Close and fiscal behavior are unchanged. |
| Operational pilot closeout | **PASS:** Product Owner tested Terminal, normal/direct intake, Quick Drop, Portal intake, inbound pickup and physical receipt, production/assignment/item gates, Warehouse inbound/final placement and exit, customer handoff, outbound delivery, payments, Daily Close and post-close behavior. Fresh-order outbound transit and Order-detail custody UAT also passed. This is not public-production readiness. |
| Order items | `ORDER-ITEMS-LIFECYCLE-GATE-001` **COMPLETE / Product Owner UAT PASS**. Normal manual draft→received needs ≥1 active item. Only canonical Quick Drop and completed inbound pickup may receive with zero items; every zero-item order is blocked from real production and final handoff/delivery until an active item is added. Cancellation remains available; no placeholders/backfill. |
| Order/fulfillment | Inbound pickup customer→EcoWash; outbound delivery EcoWash→customer. Final Warehouse placement atomically completes production without a second manual step, but does not complete customer fulfillment. Without delivery, `ready_for_customer_pickup` awaits explicit handoff; scheduled delivery shows **Ready for delivery**, in-progress **In delivery**, completed **Completed**. Payment/receipt does not transfer custody. |
| Daily Close | **COMPLETE:** live preview, immutable persisted snapshot, organization/location scope, tenant-local business date, internal post-close operational/financial gate, Portal after-close intake protection, history/exports. Independent of POS sessions; not fiscal/statutory close. |
| POS payment session boundary | **COMPLETE / Product Owner UAT PASS:** every new `channel='pos'` payment requires a valid open same-organization POS session, for `cash`, `card`, `bank_transfer` and `other`. Payment method and channel remain separate. `record_pos_payment` requires a non-null target session that exists and is open; existing actor/location checks remain. This is an RPC boundary, not a global table constraint; historical payments were not backfilled or mutated. With the till closed the POS payment form is hidden and an open-till explanation appears; till opening and history remain available. With the till open, normal POS recording works. Terminal paid-now still requires a session; closed-till Pay Later works without creating payment. Online/provider payments remain `channel='online'` and independent of till state under existing provider/post-close rules. At that payment-boundary checkpoint, refunds were unchanged; the later POS refund closeout below is now authoritative. Daily Close blockers/warnings and `non_session_non_cash_activity` semantics remain unchanged. No supported new `channel='order'` manual external write path was added. |
| POS refund channel/session boundary | **COMPLETE / Product Owner UAT PASS:** `record_pos_refund` now accepts only a confirmed, same-organization `channel='pos'` source and a non-null, same-organization session with status `open` for cash, card, bank transfer and other. Existing actor/location checks, refundable-amount limit, locking and idempotency remain. It never mutates the source: the refund is a separate `status='refunded'`, `channel='pos'` row linked by `refunded_from_payment_id`. No historical rows were changed. Order detail offers POS refund only for refundable POS-source payments and blocks submission without an open till, showing an explanation; online and historical `order` sources show no POS refund action. Current-session eligible POS payments remain refundable in the POS workspace with the active session. Online/provider settlement stays `channel='online'` and unchanged; no provider refund API or manual external/order refund path was added. Cash POS refunds still reduce expected cash; new non-cash POS refunds are session-linked. Daily Close, confirmed-minus-refunded Accounting/Customer Account semantics, Billing separation, and disabled `refund_payment`/`void_payment` remain unchanged. Product Owner staging UAT passed open-till POS refund, closed-till block/message, and no POS refund action for online or historical `order` payments. |
| Manual external payment | **COMPLETE / Product Owner UAT PASS:** `channel='manual_external'` records manually verified payments outside POS and online/provider settlement; it has no POS session or provider metadata. `order` remains historical with no supported new write path; `pos` requires an open session; `online` remains provider-settled and till-independent. Owner/Manager can use “Registra pagamento esterno” on Order detail while an active same-organization order has balance remaining. V1 permits `bank_transfer` and `other`, never `cash` or `card`; the server requires positive amount within outstanding balance, reference, notes for `other`, idempotency, `paid_at=now()` and authenticated `recorded_by`/`confirmed_by`, with no retroactive effective date. `pos_session_id`, provider, provider reference and external status remain NULL. No Shop Terminal write path was added. It is an internal financial write subject to the existing business-day close gate without the online exemption; it remains sessionless, does not affect expected cash and may contribute to `non_session_non_cash_activity`. Daily Close was not redesigned. Existing confirmed-minus-refunded math naturally includes it in order balance, collectedNet, Accounting, Customer Account/history and derived payment status. `get_pos_receipt_data` requires `payment.channel='pos'`; operational printing stays non-fiscal. Provider attempts, webhooks and settlement are unchanged. `record_pos_refund` remains POS-only; no manual external refund existed at that payment checkpoint; the refund row below is now authoritative. No legacy `order` rows were backfilled or rewritten. Product Owner staging UAT passed Owner/Manager access, bank transfer with reference, `other` notes validation, no cash/card options, no till dependency, correct balance/Accounting and unchanged Terminal. |
| Manual external refund | **COMPLETE / Product Owner UAT PASS:** `record_manual_external_refund` creates a separate `status='refunded'`, `channel='manual_external'` row linked by `refunded_from_payment_id` to an immutable confirmed same-organization `manual_external` source with method `bank_transfer` or `other`. Owner/Manager only; source Order must share the organization but may be cancelled or inactive. Method derives from source; reason and reimbursement-event reference are mandatory, the refund reference must differ from the original payment reference, and notes are mandatory for `other`. Server time supplies `paid_at` and `refunded_at`; source locking, mandatory idempotency and remaining-refundable bounds allow partial/multiple refunds. No POS session or provider fields are used. Order detail exposes a separate action for eligible sources even on cancelled Orders, to record an externally completed and verified reimbursement; Phoenix does not move money. The existing internal non-online Daily Close gate applies, with no online exemption or expected-cash impact; sessionless non-cash activity may trigger the existing warning. Confirmed-minus-refunded math continues to update collectedNet, Order balance, Accounting, Customer Account and cancelled-paid warning. POS refunds and POS receipt lookup remain POS-only; online/provider refunds, historical `order` refunds and fiscal behavior remain unimplemented. Migration `20260930000500_manual_external_refund_001.sql` is applied to staging `exthnplfokcucaqydney`, history is aligned through `20260930000500`, dry-run reports “Remote database is up to date,” and production is untouched. Product Owner staging UAT passed: a €5 refund left €7 refundable, a second €7 refund fully reimbursed the €12 source, payment state became Refunded, net paid became €0, balance due returned to €12, and the action disappeared at zero refundable balance. Eligible cancelled-order access, POS/online separation and financial refresh also passed. `MANUAL-EXTERNAL-REFUND-UX-001` (`90a02c3c6cb03bb3eb5a0bb4af30f0c6c6569005`) maps `manual_external_refund_reference_not_distinct` to a dedicated localized explanation while generic errors remain generic. |
| Warehouse / outbound delivery | **COMPLETE / Product Owner UAT PASS:** configured positions/default inbound, receipt-driven storage, owner/manager placement/move/update, final ready placement, overview/search and cancelled-order return remain available. Current `order_storage` represents real physical placement only. Scheduled delivery may wait in storage; configured delivery staging is suggested where available. Starting requires an active order, completed production and current storage. Scheduled→in_progress atomically sets the exact delivery and `started_at`, removes storage and records an append-only `delivery_started` exit linked by `delivery_id`. The order leaves current Warehouse stock but remains in EcoWash transit custody. Failed delivery requires a reason and valid active return position, restores the exact departure package-count/storage-mode snapshot and records `delivery_returned`. Actual delivery completion ends custody, leaves no storage and creates no second Warehouse exit; history may correctly end with **Warehouse exit / Delivery started**. Customer handoff retains its separate exit. Draft Terminal/order creation is not physical receipt; `received` is. |
| Delivery UI follow-ups | `DELIVERY-STATUS-REFRESH-001` (`016888dc259b78af1f6a972187120b0c55590490`) revalidates the Orders list. `DELIVERY-ORDER-DETAIL-REFRESH-001` (`c131fef0552ee89ed6d587020cffb4d886026083`) revalidates and redirects successful Order-detail delivery transitions to `/${locale}/app/orders/${orderId}#logistics`, clearing stale query parameters; workspace behavior is unchanged. `WAREHOUSE-ORDER-DETAIL-CUSTODY-UX-001` (`9feba00f9a9944c508ecd97911a327a09d33b23b`) shows real current storage when present or an out-of-Warehouse/in-delivery or delivered custody callout when absent, with historical movements below. No DB, RPC, migration or lifecycle change was needed for these UI fixes. |
| Production assignment | Shop Terminal preselects the valid configured per-location default (Quality Test in UAT), otherwise Unassigned; a manual override applies to that order and the next new order returns to the location default. There is no first-staff fallback. Separately, an order still unassigned at received→washing may receive the valid default atomically; the resulting assignment now appears in Order detail immediately without a browser refresh (EW-000118/119). Unassigned warning is for active production, not draft/received/ready/completed/cancelled. |
| Inbound pickup receipt | With an inbound pickup scheduled or in progress, manual draft→received is blocked and Order detail explains that pickup must be completed first. Pickup completion canonically sets received/received_at and establishes inbound Warehouse custody; no open or a cancelled pickup permits normal manual receipt under existing gates. Quick Drop retains its separate receipt path. Product Owner staging UAT passed for EW-000118/119; migration `20260929000100_inbound_pickup_receipt_gate_001.sql` was reported applied to staging `exthnplfokcucaqydney`, with local/remote history aligned through `20260929000100` at that checkpoint. |
| Staging signup | AUTH-DR-001B4 verified hosted public signup OFF and email confirmation ON through Auth public settings and Product Owner read-only Dashboard evidence; no B4 setting changed. `AUTH-CONFIG-DRIFT-001` is closed. |
| Auth/DR | AUTH-DR-001B3 CLOSED / PASS and 001B4 COMPLETE / PASS; 001C physical Auth and authenticated application recovery remains **DEFERRED UNTIL PRE-PRODUCTION / HARD RELEASE GATE**. Current Free project has no physical restore point. |

Phoenix V1 physical flow is **catalog/services → commercial `order_items` snapshot → internal ticket/labels → order-level production → order-level Warehouse → fulfillment**. QR `PHX1:L:<order UUID>:<order-item UUID>:<unit index>` identifies a label only: two trousers can have labels `1/2` and `2/2`. It is not a garment entity or scan-event log. Operators verify complete orders. A commercial 18 kg laundry quantity can coexist with `package_count = 3` bags. Per-garment/package lifecycle, scan history and partial ready/fulfillment are **DEFERRED**; no second catalog/inventory is approved.

The 001K export scalability, Billing tax-inclusive and Catalog CSV completeness streams are closed. The SaaS configuration foundation and `SAAS-TENANT-BOOTSTRAP-001B` and `SAAS-TENANT-BOOTSTRAP-001C` are closed. Accounting UI 100-location selector, Printer 100-location picker and Demo Tenant proof remain separate later Productization work. `CATALOG-LARGE-IMPORT-001` is future/not active; the current 500-row import limit remains intentional. `ACCOUNTANT-EXPORT-PRESENTATION-UX` awaits separate CTO scope; `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` remains monitored. Future fiscal export findings, historical `order`-channel and online/provider refunds, `NETWORK-FAILURE-UX-001` and the PDF technical-key cosmetic issue (only if reproducible) remain separate. `PHX-FISCAL-001` architecture/compliance and `PHX-FISCAL-RECTIFICATION-001` remain future fiscal work; operational receipts are non-fiscal. EcoWash La Tejita is the first tenant/reference, not hardcoded product identity. Tenant/RLS/auth boundaries remain mandatory. Auth DR and authenticated application recovery remain a public-production blocker; Phoenix is not public-production ready.

**Complete / Product Owner UAT PASS — `DELIVERY-STAGING-AND-TRANSIT-001B`:** persisted fresh-order staging rows passed the atomic transit invariant: the exact delivery reached in_progress with `started_at`, current storage was removed, and its `delivery_started` exit carried the same `delivery_id`. Delivery completion reached `completed` with no current storage; the Warehouse overview omitted the departed order. Return-to-Warehouse remains an explicit path. Warehouse movement history is historical evidence, not a claim of current storage.

**Open findings:** `LOCAL-SUPABASE-VOLUME-CORRUPTION-001` and `PLATFORM-ACCESS-DENIED-COPY-UX` are non-blocking/deferred. `BILLING-ORDER-DETAIL-INVOICE-ACTION-UX` is separate/non-blocking: Order detail lacks a direct Create Invoice action, while Shop Terminal already has a bridge. The Billing summary “Fatture” card includes drafts (staging showed Fatture 1, Bozze 1, Importo emesso 0.00); wording clarification is non-blocking and deferred. `ACCOUNTANT-EXPORT-PRESENTATION-UX` remains non-blocking. `TEST-DEBT-WALKIN-CONTRACT-001` is a pre-existing stale `WALKIN-SHARED` contract assertion; no fix was made in Productization. Future fiscal exports, historical `order`-channel and online/provider refunds, the PDF technical-key cosmetic issue if reproducible, `NETWORK-FAILURE-UX-001`, Auth DR, `PHX-FISCAL-RECTIFICATION-001` and remaining valid small findings stay open. `BILLING-ELIGIBLE-ORDER-SELECTOR-001` and the photo/empty-order receipt UX tasks are closed after UAT.

**Product Owner staging UAT PASS — `ORDER-PROPERTY-CLIENT-FILTER-001` and `PROPERTY-LIFECYCLE-REACTIVATE-UX-001`:** only the selected Customer's active Properties appear on new Orders, changing Customer clears Property, and Orders remain creatable without one. Manipulated cross-customer selection remains server/database protected. Order edit displays read-only Customer and Property names, including an inactive historical Property. Property deactivation, continued access while inactive, explicit Reactivate, return to Active/Deactivate, normal detail editing and preservation of inactive state during ordinary edits passed. Property Customer reassignment remains rejected. Shop Terminal, Quick Drop and Portal behavior passed regression checks.

**Product Owner staging UAT PASS:** an eligible `manual_external` source showed the refund action with the POS till closed; reason and reference were required; a duplicate original-payment reference showed the specific localized message; `other` required notes; €5 and €7 partial refunds fully reimbursed a €12 source without exceeding its remainder; the action disappeared at zero refundable balance. Payment state became Refunded, net paid €0, and balance due €12. Eligible cancelled-order reimbursement, POS/online action separation, and Order/Accounting refresh passed.

The detailed table and dated closeouts below preserve earlier evidence. Rows with old “current mission,” migration-pending or next-action wording refer to their original checkpoint and are superseded by this status.

## Historical Status Table — Earlier Checkpoint

| Item | Status |
| --- | --- |
| Project | EcoWash Phoenix |
| Current phase | Commercial Readiness |
| Current milestone | Milestone 8 — M1 Commercial Pilot Baseline |
| Current mission | Documentation refresh; latest functional mission is `PRODUCTION-DEFAULT-ASSIGNEE-001` |
| Last completed implementation mission | `PRODUCTION-DEFAULT-ASSIGNEE-001` — Product Owner UAT PASS |
| Approved baseline before this documentation update | `53f04ca840b9e56ed3f0052621e1b000b4e840e3` |
| Remote status | local `main` synchronized with `origin/main` at `53f04ca840b9e56ed3f0052621e1b000b4e840e3` before this uncommitted documentation update |
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
| SHOP-TERMINAL-001 status | Completed and pushed; migration 20260829000200 aligned; terminal 28/28, POS 31/31, pricing 20/20 and exact EUR 18.00 paid / EUR 10.00 pay-later rollback E2E passed with zero fixtures |
| PRINT-001 status | Completed and pushed; migration 20260829000300 aligned; PRINT 25/25, Shop Terminal 28/28, POS 31/31 and exact receipt/payment/label rollback E2E passed with zero fixtures |
| COUNTER-UX-002 status | Completed and pushed in 6691e95; no migration required; COUNTER 30/30 plus Shop/POS/pricing/Customer Account/PRINT regressions, exact EUR 18.00 split payment and distinct EUR 10.00 walk-in PAY LATER rollback E2E passed with zero fixtures |
| ACCOUNTING-SALES-DOCUMENTS-001 status | COMPLETE / STABLE; persistent numbered operational receipts, issued/cancelled history, snapshot reprint, unified receipt/Billing invoice registry and view/print-request history; staging migrations aligned and Product Owner E2E passed; Accounting/payment/refund boundaries unchanged |
| ORDER-FULFILLMENT-LIFECYCLE-001 status | COMPLETE / STABLE; draft logistics remains configurable but non-operational, accepted-order states including production completed remain logistics-eligible, authoritative transition RPC enforcement is applied to staging, and Product Owner E2E passed |
| ACCOUNTING-DOCUMENTS-NAV-001 status | COMPLETE / STABLE; visible locale-aware Accounting access to sales documents, corrected receipt print/PDF actions and compact localized headers; browser and print/PDF Product Owner validation passed; no semantic or database change |
| LOGISTICS-TIMEZONE-001 status | COMPLETE / STABLE; tenant wall-clock input and manager/staff rendering use `organizations.timezone`, absolute instants remain `timestamptz`, Shop Terminal and dashboard are aligned, and staging Product Owner E2E passed without migration or historical rewrite |
| LOGISTICS-COMPLETED-HISTORY-001 status | COMPLETE / STABLE; canonical pickup/delivery rows and `completed_at` provide tenant-local completed-today history, staff scope is own assignments, owner/manager scope is the organization team, Mi día remains open work only, and staging Product Owner E2E passed without migration |
| DASHBOARD-LOGISTICS-LIFECYCLE-001 status | COMPLETE / STABLE; dashboard today, overdue and workload signals plus operational alerts reuse the canonical logistics parent lifecycle, exclude draft/cancelled/inactive parents, and preserve received+ and production-completed eligibility; staging Product Owner E2E passed without migration |
| TERMINAL-ORDER-STATE-AND-TIME-001 status | COMPLETE / STABLE IN REPOSITORY at `5346a0eee08ebf32bf0bf9801a58fded99a68cfe`; receipt rendering is tenant-timezone safe and operational display status separates production completion from fulfillment completion |
| CONTROL-CENTER-ALERTS-COVERAGE-001 status | COMPLETE / STABLE IN REPOSITORY at `43966be8ac6adea7521a803e895e50aff6ced5a7`; unpaid/partial completed-production orders now enter canonical Operational Alerts while Alerts page/navigation badge parity is preserved; no migration |
| ORDER-CANCEL-LOGISTICS-CONSISTENCY-001 status | COMPLETE / STABLE IN REPOSITORY at `0a90a401abddf9f947fa9722e165afc1503b7ea6`; cancelled/inactive parents reject actionable logistics, Daily Close excludes correctly scheduled future work, and the corrective migration safely reconciles legacy open logistics under cancelled parents |
| BACKUP-DR-001D / PHX-AUTH-DR-001 status | Earlier logical database/Storage restore verified; AUTH-DR-001B3 closed Auth row integrity and 001B4 completed fresh Storage/Auth/config/containment preparation; physical Auth recovery in 001C remains an unverified hard pre-production/release gate |
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
| Backend/SaaS implementation | Staging migrations include `20260928000200_production_default_assignee_001.sql`; latest functional Product Owner UAT passed. Public production remains deferred. |
| Commercial readiness | Database and Storage recovery are verified, but managed Auth and authenticated application recovery remain mandatory before production. Remaining pilot findings and SaaS/fiscal productization are separately scoped; no VERI*FACTU compliance claim. |

## PHOENIX-UAT-CLOSEOUT-001 Checkpoint

- `TERMINAL-ORDER-STATE-AND-TIME-001` is complete and stable in repository commit `5346a0eee08ebf32bf0bf9801a58fded99a68cfe`. Receipt/operator time rendering follows the tenant organization timezone, and the derived operational order status no longer equates production completion with final pickup/delivery fulfillment.
- `CONTROL-CENTER-ALERTS-COVERAGE-001` is complete and stable in repository commit `43966be8ac6adea7521a803e895e50aff6ced5a7`. Completed-production unpaid/partial orders generate Operational Alerts, and the Alerts page and navigation badge continue to use the same canonical derivation. No database migration was introduced.
- `ORDER-CANCEL-LOGISTICS-CONSISTENCY-001` is complete and stable in repository commit `0a90a401abddf9f947fa9722e165afc1503b7ea6`. Cancelled/inactive parents cannot receive new actionable pickup/delivery; cancellation cascade consistency is strengthened; Daily Close excludes correctly scheduled work beyond the tenant-local closing day; and migration `20260912000100_order_cancel_logistics_consistency_001.sql` narrowly reconciles open legacy logistics under cancelled parents using the latest authoritative `order_status_history.changed_by` cancellation actor, with an existing FK-valid logistics actor only as fallback.
- These entries describe the committed repository baseline. They do not claim that migration `20260912000100` has been applied to staging or that Product Owner staging UAT has passed.
- Financial canon, fiscal/VERI*FACTU scope and historical completed/cancelled logistics remain unchanged.

## BACKUP-DR-001D / PHX-AUTH-DR-001 Checkpoint

- `VERIFIED`: isolated recovery target creation, all 49 canonical migrations, exact schema baseline, all 45 COPY sections and 1,528 application rows, canonical counts, public-FK integrity, uniqueness, sequence safety, tenant consistency and relevant database role/grant state.
- The accepted managed-role exception is the reserved `supabase_admin` timeout override; it was not forced and application-facing role/grant validation passed.
- `VERIFIED`: BACKUP-DR-001B was exercised end to end; 223/223 objects and 22,451,620/22,451,620 bytes were restored and re-downloaded with 223/223 SHA-256 matches and no failures, missing objects or extras.
- `NOT YET VERIFIED`: physical managed Auth restore, authenticated application/RLS flows, final end-to-end recovery, final RTO and production recovery.
- `APPROVED PRIMARY STRATEGY`: use an eligible completed provider physical backup / Restore to a New Project near pre-production. Documented Admin `createUser` does not expose an original-user-ID parameter; original-UUID Admin API reconstruction is **UNSUPPORTED / NOT VERIFIED** and is not a complete fallback. Emergency re-onboarding is degraded continuity only.
- `B3/B4 COMPLETE`: targeted Auth row repair passed; 13 Auth users and 13 profiles match, with 12 normal identities and one documented historical test exception without identity or active access. B4 captured a fresh locally verified Storage set, protected Auth inventory, non-secret configuration manifest and actionable clone containment plan. Hosted signup is verified disabled.
- `B4 EVIDENCE`: protected set `AUTH-DR-001B4-20261006T162233Z` has 229 Storage objects / 25,060,061 bytes across `brand-media`, `order-media` and private ephemeral non-fiscal `accounting-exports`; source listings matched and 229/229 local SHA-256 checks passed. Auth configuration records staging Site URL, four redirects, email-only provider, confirmation on, signup off, Resend SMTP, TOTP, sessions/rate limits and no Auth Hooks; template body customization and unexposed password-policy details remain non-blocking unknowns. Live evidence found no pg_cron, pg_net or HTTP/database-webhook trigger; zero Edge Functions. The existing Accountant Pack Cron remains in Vercel, outside a Supabase DB clone.
- `COST/SEQUENCING`: current Supabase Free has no physical backup; Pro daily physical backup is sufficient for this rehearsal and PITR is optional. The Product Owner/CTO deferred Pro expenditure until the near-final pre-production tenant/application state. After explicit approval, wait for a completed eligible backup timestamped after that state before authorizing 001C; the new recovery project incurs separate costs. Continue pilot findings and SaaS/productization work meanwhile.
- `CUSTODY`: B4 local Storage recovery set is verified; `ENCRYPTED OFF-DEVICE COPY PENDING` remains a pre-production finding and does not invalidate the local snapshot.
- `HARD PRE-PRODUCTION / RELEASE GATE`: AUTH-DR-001C must prove physical Auth UUID/identity and login continuity, authenticated staff/Portal/RLS/tenant recovery and Storage access/privacy. Encrypted off-device custody and other mandatory release gates also remain. The authoritative gate is in `docs/05_DEVELOPMENT/Recovery_Runbook.md`.
- `DECOMMISSION COMPLETE`: recovery project `xsjmhjmhaftieokuwssf` was permanently deleted; protected staging `exthnplfokcucaqydney` remained intact; FitIQtracker was resumed; the local `postgres:17` rehearsal image and temporary rehearsal files were removed. Verified Phoenix backup artifacts were deliberately retained.
- Pro upgrade and AUTH-DR-001C are deliberately deferred until near-final pre-production state; neither is authorized now. Full Phoenix DR must not be described as complete.

## DASHBOARD-LOGISTICS-LIFECYCLE-001 Closeout

- Dashboard today, overdue and workload signals plus operational alerts reuse `isOperationalLogisticsParent`.
- Draft, cancelled and inactive parents are excluded. Accepted states from `received` onward remain eligible, including production `completed` while logistics remains open.
- Tenant filtering, organization timezone behavior, completed history and manager planning are preserved. No schema change or migration was required.
- Focused validation, staging deployment and Product Owner E2E passed.

## LOGISTICS-COMPLETED-HISTORY-001 Closeout

- Completed pickup/delivery history uses existing canonical rows with `status = completed`; `completed_at` is the authoritative completion timestamp.
- Staff see their own assigned completed-today tasks. Owner/manager roles see organization team completions and assigned staff where available.
- `organizations.timezone` governs the current-day boundary and completion-time rendering. Mi día and active queues remain open/current work only.
- No history table, schema change or migration was required. Focused validation, staging deployment and Product Owner E2E passed.

## LOGISTICS-TIMEZONE-001 Closeout

- Tenant wall-clock `datetime-local` values are interpreted with server-derived `organizations.timezone`, stored as absolute `timestamptz` instants, and rendered for managers and staff in the tenant timezone.
- Conversion is DST-aware. Language follows user locale and never determines timezone; Shop Terminal delivery scheduling and dashboard logistics rendering use the same canonical boundary.
- No migration or automatic rewrite of previously shifted rows was made. Focused validation, staging deployment and Product Owner E2E passed with manager, My Day and delivery workspace aligned.

## ACCOUNTING-DOCUMENTS-NAV-001 Closeout

- Accounting exposes visible locale-aware access to the sales-document registry.
- Receipt print/PDF action layout and compact localized headers are corrected; browser and print/PDF Product Owner validation passed, including long-description wrapping.
- No document or financial semantics changed, and no database migration was required.

## ORDER-FULFILLMENT-LIFECYCLE-001 Closeout

- Draft logistics remains configurable for owner/manager planning but is not operational staff work. Operational eligibility begins with accepted order states and excludes inactive, `draft` and `cancelled` parents.
- Production `completed` remains eligible for open `scheduled`/`in_progress` pickup or delivery; the logistics lifecycle and `completed_at` provide the existing real-handoff evidence.
- No fulfilled, handed-off, custody, inventory or stock field/table was introduced.
- Corrective migration `20260908000300_order_fulfillment_lifecycle_001` adds authoritative parent-state checks to pickup/delivery operational transitions without weakening tenant, capability or assignment enforcement.
- Focused validation, staging migration/deployment and Product Owner E2E passed.

## Open Findings

- Historical `order`-channel refund path — separate future question; no replacement flow or provider refund API was implemented by the POS refund or manual external payment tasks.
- `PHX-AUTH-DR-001` — AUTH-DR-001B3 CLOSED / PASS and 001B4 COMPLETE / PASS; 001C remains deferred until pre-production and mandatory before public release.
- `AUTH-CONFIG-DRIFT-001` — staging signup disabled and email confirmation enabled are verified by B4 public settings and Product Owner Dashboard evidence; this configuration finding is closed.
- `POS-DAILY-CLOSE-001` — remaining POS/Daily Close refinements stay open pending focused Product Owner/CTO scope; current financial calculations and canon remain unchanged.
- `NETWORK-FAILURE-UX-001` — define clear user feedback and safe recovery behavior for operational network failures.
- `RECEIPT-COMPACT-LINES-UX` — consider future vertical-space optimization for long item descriptions while preserving readability and print safety; not a blocker.
- Duplicate “Próxima actividad / Mis actividades” presentation remains non-blocking UX polish unless reprioritized.

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
| ACCOUNTING-SALES-DOCUMENTS-001 | Persistent operational receipts and unified sales-document registry | Complete / Stable; staging migration and Product Owner E2E passed |

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

## Historical Limitations — Earlier Staging Baseline

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

## Historical Next Session — Superseded Checkpoint

Restart phrase:

“Buongiorno, riprendiamo EcoWash Phoenix da LOGISTICS-COMPLETED-HISTORY-001 stabile e definiamo con Product Owner e CTO il prossimo task.”

Exact starting state:

- Branch `main`
- Working tree expected clean
- ORDER-FULFILLMENT-LIFECYCLE-001 is COMPLETE / STABLE: draft logistics remains manager-configurable but non-operational, accepted-order states activate logistics, production completion preserves open logistics, and pickup/delivery completion governs real handoff without a new custody/stock model
- Staging migration `20260908000300` is applied and aligned; preview deployment and Product Owner E2E passed
- ACCOUNTING-DOCUMENTS-NAV-001 is COMPLETE / STABLE: Accounting exposes the sales-document registry, receipt print actions and compact localized headers passed browser/print Product Owner validation, and no semantic or database change was made
- LOGISTICS-TIMEZONE-001 is COMPLETE / STABLE: `organizations.timezone` controls DST-aware logistics input and manager/staff rendering while locale controls language; no migration or historical rewrite was made, and staging Product Owner E2E passed
- LOGISTICS-COMPLETED-HISTORY-001 is COMPLETE / STABLE: canonical completed pickup/delivery rows are shown separately for the tenant-local current day, staff see their own assignments, supervisors see the team, and Mi día remains open/current work only
- No next product task is approved; RECEIPT-COMPACT-LINES-UX remains a recorded open finding
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
3. Start only `BARCODE-001`; keep real provider configuration, accounting, e-invoicing, onboarding and subscription scope separate.
4. Preserve the completed lifecycle rule: inactive customers retain history, lose Portal access and cannot create new orders.
5. Reuse the validated operational fixtures and avoid creating additional fixtures unless a verified regression gap requires one.
6. Keep the Product Owner's technical burden minimal and keep one task per logical commit.

</details>
