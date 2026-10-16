# Session Handover

Status: Active — canonical resume instructions

Last consolidated: 2026-10-16 (`PHOENIX-DOCUMENTATION-CONSOLIDATION-001`, local; CTO review pending)

## Resume here

Read this section and [Project Status](../06_ROADMAP/Project_Status.md) before any task. [AGENTS.md](../../AGENTS.md) owns stable operating rules. The explicit task prompt controls authorization. Older checkpoints below record evidence; their “current”, “next”, branch/SHA and deployment instructions are historical and do not authorize work today.

### Verified Git checkpoint and preserved work

- Verified for this consolidation: `main`, local HEAD = `origin/main` = `6d82aeb156e1b6384dde84cd075a9d8a81b2dd86`. Recheck Git on resume; this recorded SHA is not an instruction to reset or realign a worktree.
- The expected initial worktree contains exactly seven unstaged/untracked files for `BILLING-ORDINARY-INVOICE-NET-UNIT-PRICE-001`. Preserve them independently of documentation work:
  - `src/components/billing/BillingInvoiceView.tsx`
  - `src/i18n/it/common.json`
  - `src/i18n/es/common.json`
  - `src/i18n/en/common.json`
  - `src/i18n/fr/common.json`
  - `src/i18n/de/common.json`
  - `tests/billing-ordinary-invoice-net-unit-price-001.test.mjs`
- Billing phase: local implementation and validation reported **69/69 PASS**, TypeScript, scoped ESLint, translations and diff checks PASS. CTO review and visual browser/PDF UAT remain pending. No release, commit or fiscal-compliance approval is implied.
- This mission changes documentation only. Additional Markdown changes are expected after consolidation; the seven Billing file contents must remain identical. No staging, commit, push, deployment or business-data operation is authorized.

### Continuation gates

1. Review this documentation diff and the Billing diff as separate missions. Do not commit or publish either without explicit authorization.
2. Keep pending browser UAT separate: Terminal catalog-failure draft protection, Billing invoice-item read failure/recovery, and ordinary-invoice net-unit-price presentation. Controlled Terminal transactional recovery/idempotency/payment UAT also remains separate.
3. `TERMINAL-SUBMISSION-CONFIRMATION-UX-001` is **CLOSED / PO STAGING UAT PASS** (2026-10-16, `EW-000150`). Do not reopen it from an older checkpoint.
4. Existing Terminal workspaces, production/quality, order-level Warehouse, handoff, POS, Daily Close, Accounting, tenant catalog/pricing and SaaS onboarding must be reused. Consult the current inventory and remaining gates in Project Status before proposing implementation.
5. Approved target: EcoWash La Tejita operational by **2026-12-20**; controlled initial SaaS commercialization at the beginning of 2027. These targets do not waive UAT, security, recovery, fiscal or release gates.

### Environment and document roles

Staging application: `https://ecowash-phoenix-staging.vercel.app`; established Supabase staging ref: `exthnplfokcucaqydney`. Verify targets before any separately authorized remote action. No new deployment/Ready verification is claimed here. Commercial production remains outside this mission.

- [Project Status](../06_ROADMAP/Project_Status.md): implementation, acceptance and outstanding gates.
- [Workflow](../01_PRODUCT/Workflow.md): domain states and operational boundaries.
- [Features](../01_PRODUCT/Features.md): product scope and domain boundaries.
- [Roadmap](../01_PRODUCT/Roadmap.md): approved targets and sequencing constraints.
- [Milestones](../06_ROADMAP/Milestones.md): historical milestone evidence.
- [QA register](../07_QA/QA-PRODUCT-001.md) and [pilot findings](../07_QA/PILOT-FINDINGS-2026-09-06.md): dated evidence; resolve later closeouts before treating an old finding as open.
- [Codex baseline compatibility entry](../CODEX_CURRENT_BASELINE.md): pointer and historical reference, not a third status authority.

## Historical checkpoints

The complete previous handover body is retained below. Approvals, migrations, UAT and limitations remain evidence at their recorded checkpoint. Old next-task queues, WIP/clean-tree assumptions, “not implemented” claims and environment/commit positions must be reconciled with the current sections above and Project Status. Still-open findings are not closed merely by this documentation consolidation.

<details>
<summary>Historical handover checkpoints through 2026-10-16 — expand for original evidence</summary>

Status: Active

Date: 2026-10-16

Session checkpoint: `BILLING-INVOICE-ITEMS-READ-FAILURE-001` is IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS. Browser UAT of the error/recovery path remains OPEN. One reviewed commit and normal push from `ca1923260b1944bc43fa04de50fed9a6246cf61d` are authorized, with only automatic deployment to `ecowash-phoenix-staging`. This correction does not establish fiscal compliance.

Previous session checkpoint (2026-10-16): `TERMINAL-CATALOG-FAILURE-DRAFT-001` is IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS, with browser UAT on staging still OPEN. Release is authorized as one commit and normal push from baseline `8859a9ae638922d4f32adbe5faca885c42724f44`, with only the existing automatic deployment to `ecowash-phoenix-staging`. The finding is NOT CLOSED before Product Owner UAT.

Previous session checkpoint (2026-10-16): `TERMINAL-SUBMISSION-CONFIRMATION-UX-001` is CLOSED / PRODUCT OWNER STAGING UAT PASS on 2026-10-16. Released correction: `77c251f48e8a97eec232c6fa74d93840e4c245b7`, synchronized on local `main` and `origin/main` before this documentation update. The Product Owner verified the waiting-to-success presentation on staging with `EW-000150`. Controlled transactional recovery UAT remains separate; Phoenix is not ready for commercial production.

Pre-UAT session checkpoint (2026-10-16): `TERMINAL-SUBMISSION-CONFIRMATION-UX-001` UI correction implemented, local validation PASS and final CTO review PASS. One combined code/test/documentation commit and normal push to `origin/main` are authorized from baseline `9a5cbd35758efc11845b080fb12fdb636b0e7907`, targeting only automatic deployment in `ecowash-phoenix-staging`. Deployment verification is `DEPLOYMENT_NOT_VERIFIED`: the staging-project read returned HTTP 403. Product Owner visual staging UAT remains OPEN at that checkpoint; controlled transactional recovery UAT remains separate. Phoenix is not ready for commercial production.

Previous session checkpoint (2026-10-15): `TERMINAL-FIVE-WORKSPACES-RECOVERY` implementation, staging deployment and Product Owner non-transactional Terminal UAT PASS on 2026-10-15. Commit `8cca0c4374a92776202f592967930a73e354b151` is on synchronized local and remote `main` at that checkpoint. Subsequent Product Owner order-confirmation observations require technical verification; order-submission timeout recovery still requires separate controlled transactional UAT. Phoenix is not ready for commercial production.

Repository: `/Users/cristianomegale/EcoWash-Phoenix`

Branch: `main`

Git checkpoint before this documentation mission (2026-10-15): local `main` and `origin/main` were synchronized at `8cca0c4374a92776202f592967930a73e354b151`, with a clean worktree.

Pre-closeout Git checkpoint (2026-10-14): local `main` was at functional commit `f893a8e41d831c5443ef06e13d451b6abf67bc29`; `origin/main` was at `aacacdf8e85c6dc1b071cb03c902a185509d68e8`. At this checkpoint, the documentation commit and push had not occurred. Later Git history is authoritative for final synchronization.

Historical deployment-history reconciliation baseline (001A): `4d1018c80f8c129999f1d1c00178396121a89516` on local `main`, `origin/main` and remote main at that earlier checkpoint; working tree then clean. The 001A functional commit is `7ef4843b78a7eab80e9036f8904bfedcb9451aef`; its original documentation closeout commit is `4d1018c80f8c129999f1d1c00178396121a89516`. The tenant-scoped numbering functional commit is `79f1da89cc453fafb627edd636fa1b7a2f2bb7b7`.

## BILLING-INVOICE-ITEMS-READ-FAILURE-001 — 2026-10-16 Release Checkpoint

**IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS / STAGING BROWSER ERROR-PATH UAT OPEN.** The fiscal baseline audit identified that `getBillingInvoice` checked the invoice header result but ignored `itemsResult.error`; `data ?? []` could therefore turn a failed line read into a seemingly valid invoice with no items. Both the detail and print routes awaited that result and could render the incomplete document.

The minimal correction explicitly propagates `itemsResult.error`, rejects unavailable/non-array item data with `billing_invoice_items_invalid_response`, and maps items only after a valid array response. Both routes stop before returning the invoice view and use the existing server-error behavior. A subsequent successful manual read restores the original lines. Existing header-error/not-found behavior and a genuinely empty successful item result remain unchanged; no automatic retry or new error UI was introduced.

**Validation:** **50/50 pertinent tests PASS**: 16 new regression cases plus 34 existing Billing, tax-inclusive and counter-Billing contracts. Four regression cases reproduced the original defect before the correction. The tests execute the real query and detail/print route functions with in-memory read-only Supabase/auth doubles; they cover resolved read errors including partial data, unavailable response data, transport failure, manual re-read recovery, normal Owner/Manager reads, empty draft items, not-found/header errors, authorization/entitlement rejection, tenant filters and unchanged stored values. TypeScript (`--noEmit --incremental false`), scoped ESLint and `git diff --check` passed. Final CTO diff review PASS; release review reuses these results without repeating the entire application suite. Browser error-boundary presentation and real database/RLS behavior are not established by the test doubles.

No persistent invoice or other financial data, numbering/series, prices, taxable bases, taxes, snapshots, issue/cancel transitions, payments/refunds, access rules, RLS, RPC or migration changed. No live invoice, order, payment or customer was created or issued, and no Supabase write occurred. Release scope is exactly `src/features/billing/server/queries.ts`, `tests/billing-invoice-items-read-failure-001.test.mjs` and the two canonical documents, in one commit named `fix(billing): reject incomplete invoice item reads`; Git history and the release report identify the resulting SHA and synchronization state. Only normal push to `origin/main` and its automatic deployment to `ecowash-phoenix-staging` are authorized. The Product Owner will verify the deployment visually; no manual deployment or commercial production operation is authorized.

**Next gate:** browser UAT of the failure/recovery path on an existing invoice: failed item read must not display or offer printing of a fictitiously empty document; a subsequent successful read must restore its original lines. UAT remains OPEN. Other Billing findings remain unchanged and separately scoped, including the net-unit-price finding and its visual verification. No ordinary/simplified-invoice, IGIC or SIF/VERI*FACTU compliance is declared complete. The independent Terminal catalog-protection UAT remains OPEN; preserve all earlier checkpoints and findings below.

## TERMINAL-CATALOG-FAILURE-DRAFT-001 — 2026-10-16 Release Checkpoint

**IMPLEMENTED / LOCAL VALIDATION PASS / CTO_REVIEW_PASS / STAGING BROWSER UAT OPEN — NOT CLOSED.** A failed Terminal catalog query previously returned `services: []`, which was indistinguishable from a successful empty catalog. On customer A→B→A, draft reconciliation could remove saved items and persist that empty cart.

Catalog read failures and invalid catalog requests now reject instead of returning a successful empty selection. The Terminal shows a localized error and explicit retry in IT / ES / EN / FR / DE. During loading or failure, the catalog readiness reference remains unset: existing automatic and workspace-switch saves preserve the saved draft map, checkout controls are disabled and the synchronous submission guard blocks confirmation. Successful retry reconciles the original draft against fresh server services. Successful empty catalogs and genuinely unavailable services retain the existing reconciliation rules. Request identifiers reject late successes and failures after another selection; the existing keyed Venta instances retain their separate storage and state. Authentication/authorization failures are not represented as valid empty catalogs; existing access checks are unchanged.

Validation already passed **73/73 pertinent tests**: 62 Terminal/catalog/recovery/workspace cases, including 20 new targeted regressions, plus 11 customer-switching/persistence contracts. Coverage includes A→B→A failure, unchanged saved content, retry, refresh, genuinely empty catalogs, unavailable services, five independent workspaces, blocked checkout and late responses. TypeScript (`--noEmit --incremental false`), scoped ESLint, five-locale consistency and `git diff --check` passed. Final targeted CTO review passed; the 73 tests were not indiscriminately repeated during release. The existing submission-confirmation test bodies are unchanged; their in-memory TSX harness was extracted for reuse. Simulated hooks do not establish real React scheduling or browser layout.

No pricing, discount, payment, POS-session, order-submission RPC, idempotency, frozen-payload, tenant/location authorization, database, RLS or migration change was made. No customer, order, payment or other business data was created. Release scope is exactly 11 approved implementation/translation/test files and these two canonical documents, with commit message `fix(terminal): preserve drafts when catalog loading fails`. Git history and the release report identify the resulting SHA and final synchronization state. Only normal push to `origin/main` and the resulting staging-project automatic deployment are authorized; no manual deployment or commercial production operation. Vercel deployment/source/Ready verification is left to the Product Owner without new access authorization.

**Next gate:** Product Owner browser UAT on `ecowash-phoenix-staging`: preserve an existing draft through catalog failure during A→B→A, observe the error and blocked checkout, retry and verify all original fields, then check refresh, separate Venta workspaces and late responses. No order confirmation is needed for this draft-protection UAT. Keep this finding OPEN until that evidence passes. `TERMINAL-SUBMISSION-CONFIRMATION-UX-001` remains CLOSED; controlled transactional recovery UAT, `TEST-DEBT-WALKIN-CONTRACT-001` and other existing findings remain separate and unchanged.

## TERMINAL-SUBMISSION-CONFIRMATION-UX-001 — 2026-10-16 Product Owner UAT Closeout

**CLOSED / LOCAL VALIDATION PASS / FINAL CTO REVIEW PASS / PRODUCT OWNER STAGING UAT PASS.** The Product Owner completed staging UAT on 2026-10-16 using test order `EW-000150`, total **EUR 5.00**, payment **EUR 0.00**. During approximately four seconds of processing, the Terminal correctly displayed “Guardando pedido… Por favor, espera.”, followed by “Pedido guardado”. This Product Owner evidence passes the targeted visual confirmation flow and closes the premature unknown-outcome finding.

The correction was committed and pushed as `77c251f48e8a97eec232c6fa74d93840e4c245b7` (`fix(terminal): clarify order submission progress`). The earlier Vercel API **403 / DEPLOYMENT_NOT_VERIFIED** checkpoint below is retained: the Product Owner's successful staging UAT does not independently establish the deployment source SHA or API Ready state. Controlled transactional timeout/recovery/idempotency/payment UAT remains separately scoped; `TEST-DEBT-WALKIN-CONTRACT-001` and the other existing findings remain open and unrelated.

This closeout records the Product Owner's existing test evidence only. No additional order, payment, database change, migration, deployment, commit or push was performed during this documentation update. No next implementation mission is authorized by this closeout.

## TERMINAL-SUBMISSION-CONFIRMATION-UX-001 — 2026-10-16 Release Checkpoint

**IMPLEMENTED / LOCAL VALIDATION PASS / FINAL CTO REVIEW PASS / VISUAL STAGING UAT OPEN.** Diagnosis confirmed that persisting a pending submission immediately selected the unknown-outcome screen while the original request was still active. Its normal successful response could then display “Pedido guardado” and clean up the submitted draft without a status-button click. The reported 5–6-second interval was not attributed to network or server slowness.

The UI now uses existing `isSubmitting` and `retrying` state to show a localized waiting message during the original submission or an explicitly requested identical retry. Unknown-outcome feedback remains for genuinely uncertain attempts; confirmed success, definitive rejection, `pending`, `not_found`, `completed` and browser-storage recovery retain their existing behavior. IT / ES / EN / FR / DE add only `submissionSaving`. No timer, polling or automatic retry was introduced. Idempotency keys, frozen payloads, payment keys, POS session identity, concurrent-send protection, recovery and the five independent Venta workspaces are unchanged. No order/payment Server Action, RPC, migration, financial, tenant/RLS or authentication behavior changed. No new order, payment or other staging data was created during this correction.

Validation passed **32/32** Terminal/recovery/workspace tests, including **9** new targeted cases, and **10/10** customer-switching/persistence regressions; TypeScript, scoped ESLint, translation consistency and whitespace checks passed. New component tests simulate hooks and do not prove React scheduling or browser layout. The additional customer suite passed **8/9**: the exact stale Billing `WALKIN-SHARED` assertion also fails on baseline `9a5cbd3`. `TEST-DEBT-WALKIN-CONTRACT-001` remains **OPEN / PRE-EXISTING / UNRELATED**, without changes in this mission. Final read-only CTO diff review passed.

Release scope is one reviewed commit named `fix(terminal): clarify order submission progress`, containing the seven approved implementation/test files and these two canonical documents. Git history and the release report identify the resulting SHA and synchronization state. Only the existing Git-triggered staging deployment is authorized. The Vercel read for staging project `prj_u7MwRwQOLyRSRvbuhRLdURx653aZ` in team `team_nhXOvQKcrv9yeHjZ4aoMOak3` returned **403 forbidden**, so source commit and Ready state cannot be independently confirmed: **DEPLOYMENT_NOT_VERIFIED**. No manual deployment, Vercel configuration/Cron change, Supabase write or commercial production operation is authorized or performed by this release.

Next gate: Product Owner visual UAT on staging after deployment confirmation: waiting during an active request, existing “Pedido guardado” success and normal workspace release; preserve recovery and draft behavior. Controlled transactional timeout/idempotency/payment UAT and the other Terminal findings remain separately scoped and open.

## TERMINAL-FIVE-WORKSPACES-RECOVERY — 2026-10-15 Staging UAT

**IMPLEMENTED / PRODUCT OWNER NON-TRANSACTIONAL UAT PASS.** Commit `8cca0c4374a92776202f592967930a73e354b151` implements five independent Terminal sales workspaces, browser draft-storage failure protection and recoverable order-submission identity. Local `main` and `origin/main` are synchronized. The Product Owner verified the automatic deployment for that commit as **Ready** on the dedicated Vercel project `ecowash-phoenix-staging`. Migration `20261015000100_terminal_order_submission_recovery_001a.sql`, the read-only submission-status RPC, is applied on staging Supabase `exthnplfokcucaqydney`; it was not reapplied during the Git release.

Product Owner non-transactional UAT on 2026-10-15 passed separate carts for the five sales, registered-customer A/B/A switching, distinct occasional customers and draft recovery after browser refresh. **No order or payment was confirmed during that initial UAT.** Subsequently, the Product Owner independently tried order confirmations on the EcoWash test account in staging and reported observing orders `EW-000145`, `EW-000146`, `EW-000147` and `EW-000148`. The Product Owner repeatedly observed a temporary unknown-outcome message after submission; without pressing “Comprobar estado del pedido”, after about 5–6 seconds the UI automatically displayed “Pedido guardado” and freed the Venta workspace. These are Product Owner observations; the four order records, actual idempotency, payments and confirmation path have not been independently verified in this documentation phase. Orders appear created according to the available Product Owner evidence, but controlled transactional UAT and financial integrity verification remain open. This does not establish readiness for live shop operation or commercial production.

**Historical finding — `TERMINAL-SUBMISSION-CONFIRMATION-UX-001`:** at this 2026-10-15 checkpoint, the unknown-outcome-before-confirmation behavior was open and its cause was not established. The confirmed diagnosis, UI correction, CTO PASS and still-open visual staging UAT are recorded in the 2026-10-16 checkpoint above.

**OPEN / DEFERRED:** customer, catalog and cart loading takes about five seconds; the approved Terminal initial-screen improvement is not implemented; POS till-closing procedure improvement awaits future analysis; multi-till operation is deferred. Complete browser-storage loss still requires manual order verification because the local submission identity may be unavailable. Preserve the separate Portal legacy-deployment Auth risk, `AUTH-DR-001C`, Spanish Portal catalog translation finding and other production-readiness gates below.

## PORTAL-ENTITLEMENT-BOUNDARY-001 — Staging Validation

**CTO TECHNICAL PASS / STAGING PHASES 1 AND 2 PASS / PRODUCT OWNER READ-ONLY PORTAL UAT PASS.** Phase 1 deployed the application guards to the dedicated Vercel staging project as deployment `dpl_4PYbB5BcRBJhFqPa2CmQgaHaih1i`. Customer Portal access requires effective tenant `core.portal`; invitation and recovery actions check entitlement before Supabase Auth operations, and invitations require an active customer in the current tenant before Auth. Phase 2 applied `20261014000200_portal_entitlement_boundary_001.sql` exactly once to staging Supabase `exthnplfokcucaqydney`. The migration replaced 11 functions and two RLS policies while preserving function ownership, `SECURITY DEFINER`, fixed search paths and required ACLs. Local and remote migration histories are aligned. No production deployment or database change occurred.

The Product Owner's **read-only** Historical EcoWash Portal UAT passed login, customer order history, order `EW-000144` detail, customer catalog and prices, followed by logout. No test orders or payments were created. This UAT did not manually exercise every negative authorization scenario on staging; focused local contract tests and post-migration read-only security checks cover the reviewed entitlement and tenant boundaries. Historical EcoWash retains its authorized Portal access. EcoWash La Tejita Tenerife remains at 219 active services and 219 current EUR prices, with zero customers, Portal grants, orders and payments; its `core.portal` entitlement remains disabled.

**OPEN — `PORTAL-LEGACY-DEPLOYMENT-AUTH-001`:** old immutable Vercel deployment URLs may remain accessible to authorized team members and may execute older application code before the pre-Auth invitation guard. The deployed database entitlement boundary does not eliminate potential Auth email side effects from that older code. Assess release-readiness implications before commercial production in a separate approved task. Separately, the Spanish Portal catalog contains untranslated Italian descriptive text (**OPEN / NON-BLOCKING**); do not fold that translation finding into this security mission. Managed Supabase Auth recovery (`AUTH-DR-001C`) and other production-readiness requirements remain separate gates. After final Git synchronization and deployment verification, the next operational priority is separately scoping `ECOWASH-STORE-READINESS-AUDIT-001`.

## PHOENIX-UNIFIED-CATALOG-002J Staging Closeout

**STAGING IMPLEMENTATION PASS / PRODUCT OWNER UAT PASS / INDEPENDENT POST-IMPORT AUDIT PASS.** Unified catalog CSV export/import includes multilingual service details, existing image references and global base prices. Owners/Managers can preview and confirm either **Prices only** or **Catalog and prices**. The preview shows per-service catalog and price operations, amounts, effective date, exclusions and errors. Confirmation uses a tenant-scoped transactional RPC with a stale-preview check; errors roll back catalog and price changes together. The approved effective-date policy preserves historical price rows, closes a preceding open period when a value changes, avoids redundant versions and supports idempotent repeat imports. An active base-price overlap trigger covers authorized direct writers. Imports are limited to **2,000 rows and 1 MB**. CSV supports the tested Spanish Excel/Numbers semicolon and comma-decimal workflow without ambiguous monetary interpretation; XLSX with embedded thumbnails remains a separate future enhancement. CSV import does not upload media or alter existing images.

Staging Supabase `exthnplfokcucaqydney` has migrations `20261013000100_phoenix_unified_catalog_002j.sql` and `20261014000100_phoenix_unified_catalog_002j_pouat_002.sql` applied once. UAT-001 corrected Prices-only preview handling of archived source rows with blank codes. UAT-002 corrected the SQL confirmation RPC for the same approved archived-row exclusion without replaying the first migration. Product Owner confirmation succeeded through the normal staging UI. The dedicated staging project `ecowash-phoenix-staging` was verified **READY** at `https://ecowash-phoenix-staging.vercel.app`; the alias can move with later deployments. Real production was untouched.

EcoWash La Tejita Tenerife (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`) has **219 active services and 219 active, global, current EUR base prices** effective `2026-10-14`, each open-ended. Exactly two prices have `is_from=true`; the three archived historical source services were excluded. The independent read-only audit compared 53 public tables before and after confirmation: only the expected 219 pilot `service_prices` rows were added. Pilot services, categories and image references matched their pre-import rows; historical EcoWash retained 235 price rows and Demo retained one, with matching pre/post price fingerprints. Pilot segment prices and operational orders remain zero; no active price-period overlap was found. This comparison does not cover managed Auth or Storage object bytes.

All 219 pilot services have `portal_visible=true` and `customer_orderable=true`; 173 are featured. These are configuration flags, not proof of customer Portal availability. The pilot has no customer or Portal access records, and 002J did **not** validate or enable actual customer Portal access. Separate findings remain: backup-script robustness; the payments circular-FK warning on logical data dumps, which requires restore planning; the pre-existing historical EcoWash `dry_cleaning.portal_featured` drift; and future XLSX/embedded-thumbnail support. No production-readiness or fiscal approval is implied. Any next pilot workflow requires separate CTO scope.

Earlier mission sections below retain their original checkpoints; statements that pilot prices were zero describe the state before 002J.

## ECOWASH-PILOT-CATALOG-MEDIA-002H Closeout

**COMPLETE / CTO TECHNICAL PASS / PRODUCT OWNER VISUAL UAT PASS.** Functional commit `bc6cc368ac475e563d694a29127da0f5f94b77dd` preserves the reviewed runner, frozen manifest and focused tests with execution authorization disabled. The controlled transfer on staging Supabase `exthnplfokcucaqydney` populated the **EcoWash La Tejita Tenerife** pilot catalog (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`) with 188 tenant-owned `brand-media` Storage objects: 179 managed service images and 9 managed category images. All 219 pilot services remain active and have approved image associations: 179 pilot-owned managed paths and 40 application-static references. Nine category images are associated, for 228 total associations. `home_textiles` retains a NULL category image; `special_services` was excluded. Pilot service prices and operational orders remain at zero.

The runner's final read-back reported `EXECUTION_VERIFIED_COMPLETE` with 188 verified objects, 219 services and 9 categories. A separate read-only staging audit checked the 188 pilot objects, exact tenant-owned paths, all service/category associations, and 376 source/destination object reads against the approved SHA-256, byte size and MIME evidence. No unexpected pilot objects or cross-tenant pilot media references in Demo/UAT catalog rows were found. The historical EcoWash tenant's 219 approved active service mappings and 188 source object bytes still matched the frozen pre-transfer evidence; its catalog currently has 222 services and 13 categories. This evidence does not establish an unchanged before/after comparison for historical records outside the approved manifest or all Demo/UAT data. Cristiano's pilot Owner visual UAT passed. The temporary runner authorization was restored to `APPROVED_EXECUTION_ID = null`; 8/8 focused tests, TypeScript, scoped ESLint and whitespace checks passed. No migration or application deployment was part of this transfer, and real production was untouched.

Next planned phase: **separately scoped pilot pricing setup using reviewed historical EcoWash pricing**. Do not infer prices from the media transfer or create pilot orders. Phoenix remains short of production readiness and fiscal approval.

## SAAS-OWNER-LOCATION-SETTINGS-001A Closeout

**COMPLETE / CTO PASS / PRODUCT OWNER UAT PASS.** Functional commit `7ef4843b78a7eab80e9036f8904bfedcb9451aef` adds standard Owner-only **Settings > Locations** listing and editing for existing tenant locations at `/[locale]/app/settings/locations` and `/[locale]/app/settings/locations/[locationId]`. The eight editable fields are name, address lines 1 and 2, city, region, postal code, ISO country code and phone. IT / ES / EN / FR / DE are supported; the French location-save failure message was corrected before the manual staging deployment and subsequent Git deployments. Organization context comes from authenticated server-side membership. The guarded `public.update_owner_location_settings` RPC independently checks active Owner membership, active organization/location and exact tenant ownership; foreign IDs are denied without disclosing location data. Existing Manager database RLS policy and direct table grants were not expanded.

Migration `20261012000100_saas_owner_location_settings_001a.sql` is applied once to staging Supabase `exthnplfokcucaqydney`. The RPC remains owned by `postgres`, uses `SECURITY DEFINER` with an empty search path, and is executable by `authenticated` but not `anon`; `authenticated` has no direct `locations` UPDATE grant. Manual staging deployment `dpl_9FFiEGrwN1ZguJZUM577tJL584or` was **READY** in the dedicated staging Vercel project. Subsequent pushes to `main` automatically created READY Git deployments: `dpl_GT64cw1WjCeNBiScvDoCoEzeKrnP` from functional commit `7ef4843b78a7eab80e9036f8904bfedcb9451aef`, then `dpl_4php3vXvaA1EQKAaPCJw7ZUba1Dk` from the original documentation closeout commit `4d1018c80f8c129999f1d1c00178396121a89516`. At reconciliation, the latter served the alias from the correct staging project and included the functional commit and corrected French text. `https://ecowash-phoenix-staging.vercel.app` is the canonical staging URL; each later `main` push can create another deployment and move the alias, so no historical deployment ID is a permanent alias target. Unauthenticated location list/detail routes redirected to `/es/login`; the staging RPC remained available with the approved grants. Focused and adjacent tests passed **47/47**; TypeScript, scoped ESLint and `git diff --check` passed.

Cristiano's staging Owner UAT for **EcoWash La Tejita Tenerife** (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`) passed: location **EcoWash La Tejita** (`aefb7c3d-833c-40aa-a0f5-06020f2c6f97`) opened; synthetic address/phone saved and persisted after refresh; `SP` was rejected while `ES` remained; original empty fields were restored; a foreign Demo location returned 404 without exposing data; Almacén opened and offered only the pilot location. Read-only staging verification reconfirmed the restored fields and country `ES`. No real production deployment occurred.

Open findings remain separate: `SAAS-LOCATION-MANAGER-POLICY-001` (review existing Manager database location permissions before commercialization), `SAAS-LOCATION-GRANT-DRIFT-001` (investigate why effective staging UPDATE grants differ from the original repository migration) and `ONBOARDING-COUNTRY-VALIDATION-001` (onboarding accepted `SP`). The new UI/RPC are Owner-only; database location mutation is not claimed to be globally Owner-exclusive.

Next planned phase: **ECOWASH PILOT STANDARD SAAS CONFIGURATION** through supported Owner interfaces: business/location configuration, commercial branding and logo, service categories/catalog, pricing/segments, staff/operations and synthetic customer import UAT. Branding entitlement and product-tier decisions remain separately scoped. Use no real customer personal data in staging and no live fiscal issuance or payments. Production launch remains gated by security, backup/restore, DR, GDPR, fiscal compliance and the Production Readiness Review.

## ECOWASH-PILOT-SIMPLE-ONBOARDING-001C Closeout

**COMPLETE / CTO FINAL REVIEW PASS / PRODUCT OWNER UAT PASS.** Standard Platform Admin SaaS onboarding created the staging pilot organization **EcoWash La Tejita Tenerife** (`5f9df6bc-ec65-4a03-96f6-a4e23e851a8c`, slug `ecowash-la-tejita-tenerife`) with one active Owner, first location **EcoWash La Tejita** (`aefb7c3d-833c-40aa-a0f5-06020f2c6f97`), EUR / Atlantic/Canary / es / ES defaults, and organization-wide order prefix `ELT` with next number `1` (`ELT-000001` for the first future order). The approved staging-only correction changed the organization and location country values from `SP` to `ES`; independent read-only checks verified both persisted as `ES`. No product code, schema or migration changed.

Owner `ecowash.tenerife+phoenixpilot@gmail.com` (`375e3f75-e081-4012-9891-6d0bfc0a22d4`) has an active Owner membership. The invitation arrived in Spam, and normal incognito Owner login passed: `/es/app` loaded, the correct organization and Owner role appeared, Settings worked, and **Pedidos** and **Clientes** were empty with no foreign tenant records observed. Password authentication UAT also passed: the Owner used Forgot Password, opened the recovery flow, set a new password and signed in successfully with it. No credential or recovery link is recorded. Staging verification found no operational records or Portal grants; old EcoWash, Phoenix Demo and Phoenix UAT remained unchanged. No production launch or fiscal approval is implied. `ONBOARDING-COUNTRY-VALIDATION-001` remains **OPEN / NON-BLOCKING** because the form accepted `SP`; address it separately during onboarding UX review. The Product Owner will configure the pilot through normal supported SaaS interfaces; future catalog, pricing and customer configuration has not started. No real transactions, fiscal issuance or live payments are approved by this closeout.

## SAAS-DEMO-TENANT-PROOF-001E / SAAS-DEMO-TENANT-ISOLATION-001F Closeout

`001E` is **COMPLETE / TECHNICAL PASS / PRODUCT OWNER UAT PASS**. `001F` is **COMPLETE / TECHNICAL PASS**. Phoenix Demo Laundry — Staging (`64584e90-6dc8-465a-8f03-fa2426f54921`) remains staging Demo proof data. Its active Owner is `oceanparadisetejita+phoenixdemo@gmail.com` (Auth UUID `9017e8ca-5ad6-4c10-8472-47d667b149ed`). Tenant configuration is GBP / Europe/London / en / GB; the first location is Demo Counter.

The Product Owner completed the supported staging UI workflow: tenant configuration → service/catalog → customer → order → inbound Warehouse custody → production → finished custody → POS cash payment → final customer handoff → Warehouse exit. Primary order `EW-000140` (`a3f6d007-73d2-4ad0-84dd-d04f7efc3699`) totaled GBP 10.00, with GBP 10.00 confirmed payment, GBP 0.00 final balance, completed handoff and no remaining Warehouse custody. Daily operational evidence showed completed production and handoff, no open orders, unfinished pickup/delivery or open POS sessions. The first POS session's expected £10 / counted £0 / difference −£10 is a **TEST RECONCILIATION VARIANCE**, not a product defect; a second empty session closed at £0 / £0 / £0. No Daily Close was executed.

`DEMO-READY-STORAGE-MODE-001` remains **OPEN / NON-BLOCKING**. The original `EW-000140` Ready movement persisted `other → other` despite the reported Piegato selection. Controlled probe `EW-000141` had CTO-visible pre-submit evidence of Pronto, Demo Finished, one package and Piegato; its post-submit browser/database movement was `other → folded`, with current storage mode `folded`. Classification: **NOT REPRODUCED**; no product fix is justified without recurrence. Retain `EW-000141` as STAGING DEMO STORAGE-MODE PROBE DATA.

The Demo proof exposed and resolved `SAAS-ORDER-REFERENCE-TENANT-SCOPING-001`, a **PRODUCTIZATION GAP — FIX BEFORE REAL MULTI-TENANT PILOT**. The old hardcoded EW/global sequence interleaved EcoWash `EW-000139`, Demo `EW-000140`/`EW-000141` and EcoWash `EW-000142`. `001B` now uses independent tenant counters with EW (EcoWash), PD (Demo) and PU (UAT). Product Owner staging UAT proved Demo `PD-000001`/`PD-000002` and EcoWash `EW-000143`/`EW-000144`; the latter used the EcoWash Customer Portal. Historical references are unchanged.

`001F` used supported staging Admin-generated one-time Auth links and ordinary authenticated Supabase user sessions, with no credential/token persistence or exposure. The Demo Owner session read its own organization, customer, Demo Shirt Wash service, `EW-000140` and confirmed GBP 10.00 payment. Direct EcoWash customer/service/order/payment IDs returned zero rows each; complete Demo lists contained 1 customer, 1 service, 4 orders and 1 payment, all Demo-owned. EcoWash staff `holidayshosttenerife@gmail.com` (Auth UUID `738f2993-5501-4fbd-8efc-0d4d9c447da2`) read legitimate EcoWash data; direct Demo customer/service/`EW-000140`/payment IDs returned zero rows each. Its lists contained 22 customers, 222 services, 106 orders and 99 payments, all EcoWash-owned. The Demo payment and order remained GBP; EcoWash could not read that payment, and Demo could not read EcoWash payments. No cross-tenant financial aggregation or currency conversion was observed in these checks.

Two live Demo-session foreign-ID mutation requests rejected the EcoWash customer as `invalid customer` and EcoWash service as `invalid service`. Before/after staging snapshots matched for orders, order items, status history, payments, pickups, deliveries, storage, Warehouse movements and numbering. Demo remained PD next 3 and EcoWash EW next 145: no allocation or operational side effect. No tenant isolation or security defect was found in the tested boundaries. Platform Admin access remains limited to intended bounded organization summary/detail/configuration surfaces; raw tenant customer/order/payment visibility was not established. Its focused contract suite passed 20/20.

Preserved Auth findings: `AUTH-INVITE-DELIVERY-001` **INVALIDATED / OWNER EMAIL TYPO**; `AUTH-INVITE-RECOVERY-001` **OPEN / NON-BLOCKING PRODUCTIZATION**. The next major product phase is **ECOWASH REAL PILOT DATA / OPERATIONAL READINESS**, requiring explicit REAL / TEST / CORRECT classification before broader real-world pilot use. Later gates are reliability/failure-mode hardening, backup/restore/DR evidence, deferred `AUTH-DR-001C`, Production Readiness Review, then fiscal/VeriFactu work under the existing fiscal-readiness workflow. No next implementation mission has started; Phoenix is not public-production ready.

**Current Auth DR handover:** AUTH-DR-001B3 repaired one malformed staging Auth row in place and closed the Auth record integrity gate with a documented legacy test exception: 13 readable Auth users match 13 profiles, 12 normal email identities and one historical test user without identity or active access. AUTH-DR-001B4 captured a fresh `COMPLETE` Storage set (229 objects / 25,060,061 bytes, stable listings, 229/229 disk SHA-256 passes), a protected Auth inventory, a non-secret Auth configuration manifest and a clone-containment plan. Staging signup is verified disabled; no DB cron/pg_net/HTTP webhook trigger, Auth Hook or Edge Function was found. The existing Accountant Pack Cron belongs to Vercel and does not retarget on a Supabase DB clone. Evidence set: `AUTH-DR-001B4-20261006T162233Z`; manifest hashes and recovery details are in `docs/05_DEVELOPMENT/Recovery_Runbook.md`.

**Cost and release decision:** current Supabase Free has no available physical backup. Pro daily physical backups suffice for the future isolated Auth rehearsal; PITR is optional. The Product Owner/CTO deliberately **deferred the Pro upgrade until pre-production**, when the tenant/application state is near final. AUTH-DR-001C is **DEFERRED UNTIL PRE-PRODUCTION** and remains a **HARD PRE-PRODUCTION / RELEASE GATE**: it requires an eligible completed backup and must prove Auth UUID/identity and login continuity, authenticated RLS/tenant isolation and Storage privacy. `ENCRYPTED OFF-DEVICE COPY PENDING` is a separate pre-production custody finding. No next implementation mission has started.

## SAAS-ORDER-REFERENCE-TENANT-SCOPING-001B Closeout

**COMPLETE / CTO PASS / STAGING PASS / PRODUCT OWNER UAT PASS.** Functional commit `79f1da89cc453fafb627edd636fa1b7a2f2bb7b7` closes the productization gap in which hardcoded `EW` references shared one global sequence across tenants: EcoWash `EW-000139` → Demo `EW-000140`/`EW-000141` → EcoWash `EW-000142`. This was visible cross-tenant sequence sharing, not a direct tenant-isolation defect. Migration `20261010000100_saas_order_reference_tenant_scoping_001b.sql` is applied and aligned on staging Supabase `exthnplfokcucaqydney`; dedicated staging deployment `dpl_FtaWJdLSRMHCkJQpimrAAA9jmkeV` is READY at `https://ecowash-phoenix-staging.vercel.app`. Real production was untouched.

Future references use one atomic organization-wide counter and a stable trusted prefix: EcoWash `EW`, Phoenix Demo Laundry — Staging `PD`, Phoenix UAT Tenant 001C `PU`. New Platform Admin tenant onboarding requires an explicit 2–6-character uppercase ASCII letter/digit prefix; spaces, embedded hyphens and silent arbitrary derivation are rejected. References render as `PREFIX-NNNNNN`. There is no location or annual reset, ordinary tenant-user edit, application-side counter, runtime `MAX()+1`, or per-tenant PostgreSQL sequence. Staff and Portal order creation share the allocator; Terminal and Quick Drop inherit it through `create_order`. Human-reference lookups remain organization-scoped, and Shop parsing accepts the approved format. Historical references and UUIDs are unchanged, including Demo `EW-000140`/`EW-000141`; `(organization_id, order_number)` uniqueness remains. Legacy `public.order_number_sequence` remains present but is no longer authoritative for new creation.

Product Owner authenticated staging UAT created Demo `PD-000001`, EcoWash `EW-000143`, Demo `PD-000002`, EcoWash `EW-000144`. The two counters advanced independently; `EW-000144` came through the EcoWash Customer Portal, proving the live Portal path alongside staff creation. No payment, POS, logistics, fiscal processing or production progression was needed for this numbering UAT. Post-UAT numbering was EW/145, PD/3 and PU/1, with historical reference fingerprints unchanged. Related findings: `DEMO-READY-STORAGE-MODE-001` remains **OPEN / NON-BLOCKING** after controlled `EW-000141` Piegato → folded persistence did not reproduce the reported issue, so no product fix is justified now; `AUTH-INVITE-DELIVERY-001` is **INVALIDATED / OWNER EMAIL TYPO**; `AUTH-INVITE-RECOVERY-001` remains **OPEN / NON-BLOCKING PRODUCTIZATION**. The subsequent `001F` live authenticated isolation proof passed and closed the remaining `001E` technical gate, as recorded above.

## CATALOG-CSV-COMPLETENESS-001 Closeout

**COMPLETE / CTO REVIEW PASS / PRODUCT OWNER UAT PASS / DEDICATED STAGING VALIDATION PASS.** Functional commit `75f81fc134c3c4bfde5c69bf37db799fa0106dab` makes the authorized tenant's catalog CSV export complete beyond 500 services through deterministic tenant-scoped paging and chunked translation reads. A failed page or chunk aborts export without a partial CSV. Existing CSV schema and primary ordering remain, with service ID breaking ties; tests covered 499, 500, 501 and 1,203 services. Normal catalog admin and shared service-list 500-row UI limits remain unchanged. Import still supports at most **500 service rows per operation**: preview and confirmation explicitly reject 501+ before the import RPC or mutation, and the DB RPC's 500-row guard remains. This intentional import limit is not an open defect. Pricing, segments and tenant authorization are unchanged; no DB, schema or migration change occurred.

Dedicated deployment `dpl_BTN9FT4LEvk2hBVy71UNZReEM5tq` is **READY** at `https://ecowash-phoenix-staging.vercel.app`, using the Production target of the dedicated **staging** project `puffwaves-projects/ecowash-phoenix-staging`; public route health and unauthenticated Catalog protection passed, with no recent deployment error logs. Product Owner staging UAT passed a non-empty UTF-8 export with expected headers and catalog data, and a synthetic 501-row CSV produced the localized maximum-500/no-changes error without confirmation or catalog mutation. Final validation passed 121/121 focused and regression tests, scoped ESLint, TypeScript, `git diff --check` and Webpack build. Real Phoenix production was untouched. `CATALOG-LARGE-IMPORT-001` is **FUTURE / NOT ACTIVE**: any import above 500 needs separately approved batching, atomicity, rollback, error-recovery and performance semantics. No next implementation mission has started.

## SAAS-TENANT-BOOTSTRAP-001C Closeout

**COMPLETE / CTO REVIEW PASS / PRODUCT OWNER UAT PASS / DEDICATED STAGING VALIDATION PASS.** Functional commit `0d4d3ed251dea0449b70c71ab4919ff2884296d2` adds the guarded Platform Admin onboarding route `/[locale]/platform/organizations/new`. The primary path invites a new Owner; recovery can use an existing Auth identity. Server-side Platform Admin authorization precedes Auth Admin identity preparation and verification. The authenticated user session calls the 001B bootstrap RPC, which independently re-verifies Platform Admin authorization. Invitation is requested and the Owner Auth/Profile identity verified before tenant acceptance; invitation acceptance is not required first. UUID/email mismatch, active Owner membership, owner Portal conflict and slug collision follow the existing safe rejection semantics, without silent mutation. The recovery UI preserves selected existing-Owner mode, UUID/email and tenant defaults after Server Action errors; rendering recovery does not send a second invite. No invitation resend guarantee is claimed.

Dedicated staging deployment `dpl_NfXmdECw8woikuUFmjvJUXcA9QqK` is READY at `https://ecowash-phoenix-staging.vercel.app`; route health and protected redirects passed. It used the **Production target of the dedicated staging Vercel project** `puffwaves-projects/ecowash-phoenix-staging` because that project's Preview environment lacks `SUPABASE_SERVICE_ROLE_KEY`. This is not real Phoenix production. Product Owner staging UAT passed happy-path onboarding, first Owner Auth/login and automatic tenant resolution; non-Platform-Admin denial, UUID/email mismatch, active membership conflict and slug collision; and final recovery-mode state persistence after the membership conflict. TEST/STAGING tenant `Phoenix UAT Tenant 001C` (`89d79a7d-79c2-4d39-8a9f-92b38f2032f9`, slug `phoenix-uat-tenant-001c`) used Owner `info@ecowashlatejita.com` (`bbe65ced-320d-4bab-b2a4-ffa5f1ad1e36`). No database migration was added in 001C; 001B is unchanged and real production was untouched. `PLATFORM-ACCESS-DENIED-COPY-UX` remains **NON-BLOCKING / DEFERRED**. The later Demo Tenant proof is now complete as recorded above; no next implementation mission has started.

Previous functional task: `SAAS-TENANT-BOOTSTRAP-001B` (`921424a5f9dc8d83063bdc4214849ce7dd2d1d5d`) — **COMPLETE / CTO REVIEW PASS / LOCAL DB RUNTIME VALIDATED / STAGING DB VALIDATED**. Migration `20261007000400_saas_tenant_bootstrap_001b.sql` provides a trusted Platform Admin RPC that atomically creates an organization, first active Owner membership, exactly four baseline entitlements, first active location, provisioning receipt and platform audit. Authorization is enforced inside the RPC. The Owner must have an existing valid Auth/Profile identity; email confirmation, invitation acceptance and prior tenant login are not required. The bootstrap rejects an active Owner membership, active Portal identity and slug collision; an idempotency key plus request fingerprint protects replay. Same-Owner and same-slug concurrency and rollback were validated. No global single-active-membership unique DB constraint was added. The full local chain applied 89/89 migrations; staging `exthnplfokcucaqydney` applied 00400 and history aligned. Remote direct schema introspection was unavailable because the temporary login required `SUPABASE_DB_PASSWORD`; no new credential was introduced. The bootstrap RPC was not invoked remotely; EcoWash was untouched and no Demo Tenant was created. No Vercel deployment or production change occurred.

`LOCAL-SUPABASE-VOLUME-CORRUPTION-001` — **NON-BLOCKING / DEFERRED**. The preserved original local Docker volume `supabase_db_ecowash-phoenix` cannot start PostgreSQL: `postgresql.auto.conf` contained zero bytes and, after that file was repaired, `PG_VERSION` was invalid, indicating broader local filesystem corruption. No EcoWash business data was read or modified. The original volume remains preserved; 001B was runtime-validated using a separate disposable local volume. Do not delete or further repair the original volume as part of 001B.

Fiscal planning only: keep operational orders/payments, Spain SIF / VERI*FACTU fiscal records, and B2B electronic-invoice exchange with status/payment reporting as separate domains. `PHX-FISCAL-001` architecture must remain provider-neutral, tenant/jurisdiction aware, and able to distinguish IGIC / IVA and legal fiscal profiles, document series/corrections, idempotency/audit, outbox/reconciliation/retention/DR and organization/fiscal-identity isolation. Roadmap order remains SaaS productization/onboarding, remaining approved operational scalability, stable baseline/UAT, `PHX-FISCAL-001` architecture and compliance boundary, separate Spain SIF and B2B design, sandbox PoC, then separately authorized implementation. No fiscal implementation is part of 001B.

Previous functional task: `SAAS-PRODUCTIZATION-CONFIGURATION-FOUNDATION-001` (`804bbe917ef31bbfed5b3c9ed18ebdb042efda2e`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. `public.organizations` now owns internal name, default currency, timezone, default locale and default country; commercial branding and legal Billing identity remain separate. Migration `20261007000300_saas_productization_configuration_foundation_001.sql` is applied only to Supabase staging `exthnplfokcucaqydney`, with local/remote history aligned through `20261007000300`; latest Vercel staging deployment `dpl_9AxE4xixvkB864mHSGEQ7aeP1CpS` is READY at `https://ecowash-phoenix-staging.vercel.app`. EcoWash pilot values are EUR / Atlantic/Canary / es / ES. Owner-only RPC mutation derives the organization server-side, fixes `search_path`, grants execution explicitly, removes generic authenticated direct organization UPDATE, and preserves RLS, tenant isolation and separate Platform Admin paths. Name, locale and country remain editable; the current currency may be resubmitted but changing it is blocked after service prices, segment prices, Orders, invoices or expenses exist. The current timezone may be resubmitted but changing it is blocked after Orders, POS sessions, persisted Daily Closes, invoices or expenses exist. Customer, Property, Service, Pricing, POS and Shop defaults now derive from tenant configuration; the UI route locale remains independent. Product Owner UAT passed locale es→it→es and country ES→IT→ES persistence, rejected EUR→USD and Atlantic/Canary→Europe/Madrid changes with original values preserved, and Customer/Property/Service/Shop/Terminal defaults. The locale read-back UI fix remounts the selector on the authoritative value and verifies database read-back before reporting success; no corrective migration was needed. No historical Customer, Property, price, Order, Payment, invoice, expense, Accounting or timestamp row was rewritten. Tax-inclusive pricing and the separate fiscal boundary are unchanged; public production was untouched. Final pre-commit contracts passed 9/9 Productization and 4/4 Settings; earlier validation passed 145/145 initial, 243/243 mutability and 13/13 locale-fix tests, plus scoped ESLint, TypeScript, locale JSON parse, `git diff --check` and Webpack builds.

Previous functional task: `BILLING-TAX-INCLUSIVE-PRICING-001` (`f679b482194e4246ca10e691473057fe23095fa6`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. The canonical customer-facing Order total is tax-inclusive: Billing extracts tax from discounted gross rather than adding it, and `invoice.total = sum(selected orders.total)`. Migration `20261007000200_billing_tax_inclusive_pricing_001.sql` adds `prices_include_tax` snapshots to invoices/items, converts only safely reconcilable mutable drafts, and preserves issued/cancelled legacy financial snapshots and numbering. It was applied only to Supabase staging `exthnplfokcucaqydney`; local/remote migration history aligns through `20261007000200`. The migration uses one explicit BEGIN → LOCK TABLE → preflight/conversion/schema/RPC/constraints → COMMIT transaction. Vercel staging deployment `dpl_AKRVsyrxAjkAqZqXxSFkJ2inbwtN` is READY at `https://ecowash-phoenix-staging.vercel.app`. Product Owner UAT PASS on a pre-existing converted draft: at 7%, `12.50 - 10.00 = 2.50` gross, taxable base `2.34`, included tax `0.16`, invoice total/paid `2.50`, outstanding `0.00`; the UI says “Imposta inclusa”. Editing the rate to 21% changed base/tax to `2.07`/`0.43` while total/paid remained `2.50` and outstanding `0.00`. No naturally available issued/cancelled historical invoice existed for visual comparison; automated immutability contracts passed. Orders, Order Items, Payments and Refunds were not rewritten; payment truth, tenant/security boundaries and VeriFactu/fiscal behavior are unchanged. Public production was untouched. No Billing-only inclusive/exclusive tenant toggle was added.

Previous functional task: `BILLING-ELIGIBLE-ORDER-SELECTOR-001` (`f92e0f5b67c9cc87752fafd0c713dd55286a9143`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. Eligible Billing Orders are determined in a read-only database RPC before the result bound: tenant, active/non-cancelled Order, non-`WALKIN-SHARED` customer and no active invoice link. Search covers Order number, customer name and customer code across the full eligible population; results order by `created_at DESC, id DESC`, show at most 100 and use the 101st only to signal more matches. Exact `customerId`/`orderId` lookup remains available for old Orders, and inactive customers retain the existing warning. Migration `20261007000100_billing_eligible_order_selector_001.sql` was applied only to Supabase staging `exthnplfokcucaqydney`; local/remote history aligned through `20261007000100`. Vercel staging deployment `dpl_CdbLFUsoo9rZPhHhyNn58ot3d75y` is READY at `https://ecowash-phoenix-staging.vercel.app`. Owner UAT passed search/no-match/clear, older and exact Order discovery, draft selection and customer/currency grouping. No Billing draft-creation semantics, payment truth, invoice lifecycle or fiscal behavior changed in this selector task; public production was untouched.

Previous functional task: `PORTAL-ORDER-VALIDATION-SUMMARY-001` (`c726182074c82cf85c8326548b51f34f1eb2ca50`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. The Customer Portal new-order request now shows an order-level validation summary with accessible focus and navigation to invalid sections; field errors resolve interactively. Existing server validation and Order semantics are unchanged. Product Owner UAT passed, and canonical staging deployment `dpl_BTiUJFZDuwcRMQqGPFcDpqrdZoVC` is READY.

Previous functional task: `DEPENDENCY-SECURITY-001` (`976b747f7f291550a605ecd1d789d0a0e70db720`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. Only direct `next` and `eslint-config-next` changed from `16.2.11` to `16.3.8`; React/React DOM remain `19.2.8`, and Supabase, archiver and tus-js-client are unchanged with no advisory in the resolved audit. The production npm audit is **0 critical / 0 high**. The full audit is **0 critical / 5 high packages** on one dev/tooling-only `braces@3.0.3` chain, `GHSA-vfj7-8cjw-p6xm`; no patched compatible release is available. Keep `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` **OPEN / MONITORED / DEV-TOOLING ONLY**; no public-runtime exposure was identified. The specific Next runtime security blocker is removed after staging verification; Auth DR remains a separate hard blocker for public production. Do not describe the repository as vulnerability-free.

Focused Accountant Pack tests passed 6/6 and the domain regression suite passed 411/411; five locale JSON files, ESLint (0 errors, two pre-existing warnings), TypeScript, `git diff --check` and the Next 16.3.8 Webpack production build passed. The general suite passed 1063/1069; its six static contract failures were reproduced identically on the pre-change baseline and are not this task's regressions. `npm ci` succeeded and targeted dependency graphs passed, while full local `npm ls --all` still flags optional cross-platform sharp WASM packaging entries. Product Owner local SECURITY UAT passed home/images, dashboard, Orders, Accounting, existing Accountant Pack download and ordinary navigation.

Dedicated staging Vercel deployment `dpl_6do2bMybjgY5DeYFLVQ9cc3rEQkb` is READY on the functional commit, with canonical `https://ecowash-phoenix-staging.vercel.app` pointing to it. Home/login, unauthenticated protected-route redirects, static and optimized local images, the deployed Cron registration and worker authorization passed; missing/wrong authorization returned 401 and one registered Cron invocation returned 200. Build/runtime logs show no sharp, libvips, optional WASM, ZIP/TUS, Storage or Supabase error and no 500 in the smoke window. Existing Accountant Pack jobs remain completed; no new pack or Accounting source mutation occurred. Authenticated staging history/download was not exercised in this technical session; Product Owner had passed the existing download locally. Public production, Supabase migrations and Docker were untouched.

Previous functional task: `DATA-RETENTION-AND-SCALE-001K-C` (`2d3cce6821beeadf1f9ac1c65f8f9a52b2ef9bc3`) — **COMPLETE / PRODUCT OWNER UAT PASS**. This closes only the `DATA-RETENTION-AND-SCALE-001K` export scalability stream: 001K-A **COMPLETE**, 001K-B **COMPLETE / PRODUCT OWNER UAT PASS**, 001K-C **COMPLETE / PRODUCT OWNER UAT PASS**. Owner/Manager can request, review and privately download durable database-backed Accountant Pack jobs; active requests deduplicate. Leased worker claims, finite retries/recovery, `after()` acceleration and the secured daily Vercel Cron (`/api/internal/accountant-pack/worker`, `17 3 * * *`) provide durable completion and bounded cleanup. The staging deployment of the functional commit is READY on the dedicated `ecowash-phoenix-staging` project with server-only sensitive `CRON_SECRET`; missing/wrong authorization returned 401, correct authorization returned 200 JSON, and one registered Cron invocation completed with 200 and clean runtime logs. Two real UAT jobs remain completed; no third pack was created. Migration `20261005000500_data_retention_scale_001k_c_accountant_pack.sql` was already applied to staging `exthnplfokcucaqydney` and was not reapplied; public production was untouched.

The private `accounting-exports` bucket holds immutable completed ZIP artifacts with `summary.csv`, `sales.csv`, `expenses.csv` (posted only), `daily-closes.csv` (persisted snapshots only) and `manifest.json`, including SHA-256 metrics. Node streams bounded keyset source pages into CSV and ZIP without materializing full CSVs in RAM or offset-based bulk traversal; the final ZIP uses a bounded temporary file and TUS upload. The 450 MiB application ceiling fails transparently without truncation and is not a proven Supabase Storage maximum. TUS was proven on staging with a synthetic object over 6 MiB; real UAT packs were much smaller. Signed private download and server-derived organization/location isolation are enforced. Completed artifacts expire after 14 days; job metadata is retained for 90 days with bounded cleanup. Artifact expiry never controls accounting source or future fiscal evidence retention.

001K-C deliberately uses **generation-window consistency**: live Sales, Expenses and Summary sources can change during or after generation; saved Daily Close rows are immutable, while new closes can enter the window. Completed ZIP bytes are immutable; a new job may legitimately differ. The pack is accounting support material, not an immutable accounting snapshot, tax return, fiscal evidence, Modelo 420/130, IGIC/IVA calculation, VERI*FACTU, Spain B2B e-invoice, AEAT submission or fiscal book. The two implementation defects were resolved inside the functional commit: one canonical Accountant Pack UUID validator replaced duplicate regexes that rejected valid PostgreSQL v4 IDs, and atomic redirect headers fixed the download HTTP 500. Product Owner UAT passed the normal automatic second-pack path, persistence, Ready/download, five-file ZIP, manifest and non-fiscal boundary.

Open follow-ups: `ACCOUNTANT-EXPORT-PRESENTATION-UX` — **OPEN / NON-BLOCKING** (readable local timestamps, headings, event labels and spreadsheet presentation without changing data semantics); `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` — **OPEN / MONITORED / DEV-TOOLING ONLY** (`GHSA-vfj7-8cjw-p6xm`, `braces@3.0.3`, no patched compatible release). Future append-only/auditable fiscal histories, higher fiscal records per transaction, long-term evidence retention, organization/NIF isolation and traceable cold archival remain unconstrained by the separate 001K jobs/ZIP lifecycle.

Previous functional task: `DATA-RETENTION-AND-SCALE-001K-B` (`ac0d3e88416a9204774a693aaf0a9ed437c07281`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Accounting now supports Today, Week, Month, Previous Month, Quarter and Custom. Quarter accepts a historical four-digit year and Q1–Q4, rejects invalid year/quarter input through the existing invalid-period behavior, and uses organization-local dates and timezone: Q1 Jan 1–Apr 1 exclusive, Q2 Apr 1–Jul 1, Q3 Jul 1–Oct 1, Q4 Oct 1–next Jan 1. All five locales expose the controls. For the selected quarter or custom period, the Accountant Support section offers Sales CSV, Accountant Expenses CSV, Period Summary CSV and Daily Close Register CSV. These are non-fiscal accounting-support files, not tax returns, IGIC/IVA filings, VERI*FACTU or Spain B2B e-invoice output, AEAT submissions, fiscal ledgers or immutable fiscal evidence. Sales reuses the 001K-A 250-row bounded keyset and streamed reader with no overall cap: event order remains `event_date DESC, event_type ASC, event_id ASC`, sales use `orders.created_at`, confirmed payments and separate refunded rows use `payments.paid_at`, pending/void are excluded, active non-cancelled Orders are sales, undetailed Quick Drops are excluded, currencies are not converted, and its CSV schema is unchanged. The new Accountant Expenses CSV includes only posted expenses; standalone Expenses CSV still includes draft, posted and void. It preserves captured `expense_date, document_date, supplier, category, description, reference, location, gross, tax_amount, tax_rate, currency, payment_status, paid_date, payment_method, status` without inferred tax base, deductible tax or fiscal treatment. Expenses traverse `expense_date ASC, id ASC` in bounded 250-row keyset pages with page-local supplier/category/location hydration and incremental streaming, no full-period materialization, offset or overall cap.

Period Summary iterates canonical live Sales/payment/refund and posted-expense readers in bounded pages, retaining only per-currency aggregates; it never sums Daily Close snapshots or combines currencies. `collected_net = collected_gross - refunds`; `operational_result = sales_net - posted_expenses` is operational support, not taxable or statutory profit. Online Card is not counted again as ordinary Card. Columns identify `orders.created_at`, `payments.paid_at`, `expenses.expense_date` and `daily_closes.business_date` as distinct date bases. Daily Close Register reads only persisted `daily_closes` and saved snapshots by `business_date`, one row per close, in 250-row keyset pages ordered `business_date ASC, closed_at ASC, id ASC`; it preserves organization/location scope, location identity, timezone, `snapshot_hash`, `snapshot_schema_version`, `calculation_version` and deterministic per-currency snapshot JSON. Missing/incompatible snapshot fields remain blank, never fabricated. All-locations may include both organization-wide and location closes, so register rows must not be blindly summed for quarterly totals. Existing individual PDFs are unchanged; no bulk PDFs were added. Every export remains Owner/Manager-only with server-derived organization; explicit locations must be active, non-deleted and owned by that organization and fail closed if invalid, stale or not owned. Downloads preserve attachment disposition, UTF-8 BOM, CSV injection protection and `Cache-Control: private, no-store`. The new multi-row exports stream incrementally without `getAccountingWorkspace()`, arbitrary total cap or offset/range traversal, reusing existing 001K-A export and 001I Daily Close indexes. No migration, new index, RPC, table, RLS, trigger, source-data mutation, async export infrastructure or fiscal implementation was added. Product Owner UAT passed. Final validation: 261/261 selected tests, five locale JSON checks, scoped ESLint, `tsc --noEmit`, `git diff --check` and the previously completed final Webpack build all passed.

Accepted consistency limit: Sales, Accountant Expenses and Summary read live operational data, so a long export can observe legitimate changes between pages. Each persisted Daily Close snapshot is immutable, but the set of closes in a long register export can change when a new close is created. 001K-B provides no immutable package-wide point-in-time snapshot; 001K-C subsequently adopted generation-window consistency for the pack. No IGIC/IVA due or deductible amount, Modelo 420/130, taxable base, quarterly tax payable or fiscal profit is calculated. The convenience CSVs remain separate from fiscal source evidence and create no known constraint on append-only/auditable fiscal histories, higher record counts per transaction, long-term fiscal evidence retention, organization/NIF isolation or traceable cold archival.

Previous functional task: `DATA-RETENTION-AND-SCALE-001K-A` (`47602530b30bda1f67ff6f77ed1ff7146710fff1`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Sales CSV no longer calls `getAccountingWorkspace()`: its export-specific, read-only RPC streams bounded 250-row keyset pages using `(event_date, event_type, event_id)` ordered `event_date DESC, event_type ASC, event_id ASC`, without offset/range traversal or an overall row cap. Sales columns remain `date, type, order_reference, customer, location, payment_method, amount, currency`. Sales use `orders.created_at`; confirmed payments and separate refunded rows use `payments.paid_at`; pending/void payments, inactive/cancelled Orders and undetailed Quick Drops are excluded from sales, while confirmed payments on cancelled Orders remain financial facts. Currencies are not converted. Expenses CSV also avoids `getAccountingWorkspace()`: it streams bounded 250-row keyset pages ordered `expense_date ASC, id ASC`, hydrating supplier/category/location names per page, without offset/range traversal or an overall cap. Its columns remain `expense_date, supplier, category, description, reference, location, gross, tax_amount, tax_rate, currency, status`, including draft, posted and void records. Explicit location filters require an active, non-deleted location in the authenticated organization and fail closed if invalid, stale or not owned; an omitted location means all authorized locations. Organization context is server-derived, never trusted from a client `organization_id`. Both CSV downloads preserve attachment disposition, UTF-8 BOM and CSV injection protection, and set `Cache-Control: private, no-store`. Migration `20261005000400_data_retention_scale_001k_a_export_readers.sql` contains exactly four indexes — `orders_org_created_id_export_idx` (`organization_id, created_at DESC, id ASC`), `payments_org_paid_id_export_idx` (`organization_id, paid_at DESC, id ASC`), `expenses_org_date_id_export_idx` (`organization_id, expense_date ASC, id ASC`) and `expenses_org_location_date_id_export_idx` (`organization_id, location_id, expense_date ASC, id ASC`) — plus the read-only Sales RPC and revoke/grant statements. It was applied only to staging `exthnplfokcucaqydney`; local/remote history aligns through `20261005000400` and production was untouched. There were no table, column, RLS, trigger, constraint, source-data, async export or fiscal changes. Owner/Manager Product Owner UAT passed Accounting, both CSV downloads and plausible contents, and existing workflows; the initial Portal-client access-denied context was resolved with the correct staff account and was not an application defect. Final focused and related regressions: 152/152 PASS; `git diff --check` PASS; the earlier Webpack production build passed. These are scalable operational exports, not immutable fiscal-grade point-in-time evidence: a long export can observe legitimate source changes between pages. 001K-C subsequently adopted generation-window consistency for the pack. The operational read indexes and paths create no known constraint on future append-only/auditable fiscal histories, higher fiscal record counts per transaction, long-term evidence retention, strict organization/NIF isolation or traceable cold archival; generated exports remain distinct from fiscal source evidence. No fiscal implementation was added.

Previous functional task: `DATA-RETENTION-AND-SCALE-001J` (`208cb290a9f04653941b64425445ab57d9c29b93`) — **COMPLETE / Product Owner UAT PASS**. Portal Order history now uses true bidirectional keyset pagination ordered `created_at DESC, id DESC`, with 25 visible rows and a 26th sentinel plus Older, Newer and Back to latest. The identity-free cursor contains only version, `createdAt`, `id` and direction; malformed cursors safely reset, and no offset/range pagination is used. `count_customer_portal_orders()` supplies the complete history count independently of page length, while page financial hydration is restricted to selected Orders. Portal Overview no longer uses a bounded/full history collection: the newest active non-completed/non-cancelled Order is resolved across complete canonical history, recent Orders are bounded to four, and complete per-currency server aggregates and the exact Order count replace application-side bounded totals; mixed currencies are never combined. Order detail uses one targeted financial lookup rather than loading all customer financial history. All five new read RPCs reuse `customer_portal_current_access()` and bind both canonical `organization_id` and `customer_id`; multiple stored access rows remain supported without cross-context aggregation, a selector or a one-user-one-customer uniqueness constraint. Confirmed-minus-refunded totals, per-Order balance and paid/refunded/void/unpaid/partially-paid precedence are unchanged. Migration `20261005000300_data_retention_scale_001j_portal_history_scalability.sql` adds only `list_customer_portal_orders_page`, `count_customer_portal_orders`, `get_customer_portal_current_order`, `get_customer_portal_account_summary`, `get_customer_portal_order_financial` and their permissions. It was applied only to staging `exthnplfokcucaqydney`, with migration history aligned through `20261005000300`; production was untouched. Existing `orders_org_customer_created_id_idx` and `payments_org_order_paid_created_id_idx` are reused and no index was added. Product Owner UAT passed identity/branding, current/recent Orders, complete summary/count, history cards, Order detail and context isolation. Pagination depth was not naturally exercisable because the largest real Portal-visible history contained 16 Orders; no synthetic data was created, and the accepted automated keyset contract passed a 137-row multi-page boundary. Final closeout validation: 97/97 PASS; `git diff --check` PASS. Order requests, online payments, customer photo/media authorization, branding/catalog/properties, RLS, tables, triggers, Order lifecycle, payment/refund mutation and fiscal behavior are unchanged.

Prerequisite task: `PORTAL-CONTEXT-ISOLATION-001` (`78b4acc`) — **COMPLETE / Product Owner UAT PASS**. Phoenix may retain multiple `customer_portal_access` rows for one Auth user, while the current Portal UX remains single-context: `public.customer_portal_current_access()` is the canonical visible and operable context. Customer-facing reads and actions bind the same canonical `organization_id` and `customer_id`; linked customer contexts are not implicitly aggregated. No one-user-one-customer uniqueness constraint, access-row deletion/deactivation or multi-context selector was introduced. Previously cross-access Order list/detail/items/history/logistics/photos/next-task reads, financial/payment reads, property listing, branding/category authorization and customer-photo Storage authorization now use the canonical context. Staff Owner/Manager Portal-access administration, Order-request workflow, online-payment provider/settlement/refund semantics, confirmed-minus-refunded math, Order lifecycle, RLS, tables, triggers, indexes and fiscal behavior are unchanged. Migration `20261005000200_portal_context_isolation_001.sql` contains only twelve read/authorization function replacements and their revoke/grant statements. It was applied only to staging `exthnplfokcucaqydney`; read-only verification confirmed history through `20261005000200`, expected signatures, canonical-context use, fixed `SECURITY DEFINER` search paths and authenticated-only execution. Production was untouched. Product Owner UAT passed identity/branding, current and recent Orders, Order list/detail with items/history/logistics/photos/payments/financial data, request-page access, online-payment presentation and absence of visible cross-context mixing. Final closeout regressions: 81/81 PASS; `git diff --check` PASS.

Permanent CTO fiscal-volume constraint: future record-limit, retention and scale decisions must remain compatible with append-only/auditable fiscal histories, substantially higher fiscal record counts per transaction, long-term fiscal evidence retention, strict organization/NIF isolation and archival/cold storage without loss of traceability. 001K-A/B readers and the separate 001K-C jobs/ZIP lifecycle introduce no fiscal schema or behavior and no known constraint on those future requirements.

Previous functional task: `DATA-RETENTION-AND-SCALE-001I` (`52e3d35`) — **COMPLETE / Product Owner UAT PASS**. Persisted Daily Close history removes its terminal 100-row cap and uses true bidirectional keyset pagination with 25 visible rows plus one sentinel, ordered `business_date DESC, closed_at DESC, id DESC`. Older, Newer and Back to latest preserve normalized date/scope filters; cursors bind those filters, contain no tenant identity and reset safely when malformed or mismatched. Filters apply before limiting, with no offset pagination. Complete scope discovery no longer reads and deduplicates only 500 recent closes: `public.list_daily_close_history_scopes()` detects organization-wide history and distinct persisted location scopes across the full tenant history, independent of the visible page. Owner/Manager access, Staff denial, server-derived tenant identity and existing `daily_closes` RLS remain unchanged; the new read RPC enforces the same role boundary internally, fixes `search_path`, and grants execute only to authenticated. Historical detail still reads one persisted Daily Close and its immutable saved snapshot; no live `getDailyCloseData()` recalculation or historical reconstruction was introduced. Migration `20261005000100_data_retention_scale_001i_daily_close_history_scalability.sql` contains only that read RPC, its revoke/grant statements and indexes `daily_closes_org_history_keyset_idx` and `daily_closes_org_location_history_keyset_idx`. Operator evidence and read-only checks confirm it is applied to staging `exthnplfokcucaqydney`, with migration history through `20261005000100`; production was untouched. Product Owner UAT passed history rendering, date/scope filters, persisted detail/snapshot, return navigation, natural pagination, and historical export/print. No artificial closes were created. Final focused Daily Close and POS regressions: 121/121 PASS; `git diff --check` PASS. `close_daily_close`, `calculate_daily_close_snapshot`, close idempotency, blockers/warnings, POS reconciliation, payment/refund and Accounting truth, current-day preview, and CSV/PDF export semantics are unchanged. No data mutation, table/RLS/trigger/close-RPC/snapshot/financial/lifecycle change.

Previous functional task: `DATA-RETENTION-AND-SCALE-001H` (`98d94ba`) — **COMPLETE / Product Owner UAT PASS**. Billing history removes its arbitrary 100-row terminal boundary: one server-side read RPC filters invoice number, customer and linked Order number plus derived payment status before keyset pagination, returning 25 visible rows and one sentinel ordered `created_at DESC, id DESC`. Cursors bind normalized `q`/status, contain no tenant identity and reset safely when malformed or mismatched. The separate full-history summary supplies invoice and draft counts, issued total and outstanding total, unaffected by visible-list filters. Linked Order payments remain the source of derived status and confirmed-minus-refunded amounts. Customer Billing loads its own latest five invoices, complete per-currency summaries and exact eligible Order count; `listEligibleBillingOrders()` is unchanged, and its operational 100-row selector cap is a separate future finding. Sales Documents now unions operational receipts with issued/cancelled Billing invoices before one global keyset limit, without a duplicate persistence table: 25 visible rows plus one sentinel ordered `issued_at DESC, document_number ASC, receipt before invoice on ties, id ASC`. Receipt cancellation and receipt/invoice print routes are unchanged. Server-derived tenant context, Owner/Manager and Billing/printing entitlements, fixed `SECURITY DEFINER` search paths and authenticated-only grants remain enforced. Migration `20261004000300_data_retention_scale_001h_billing_sales_document_history.sql` adds only four read RPCs (`list_billing_invoices_page`, `get_billing_history_summary`, `get_customer_billing_history_summary`, `list_sales_documents_page`), their permissions and four indexes (`invoices_org_created_id_idx`, `invoices_org_customer_created_id_idx`, `receipts_org_history_idx`, `invoices_org_issued_history_idx`). Operator evidence and read-only history/signature checks confirm this migration applied to staging `exthnplfokcucaqydney`, with the applied checkpoint through `20261004000300`; production was untouched. Product Owner local UAT against staging passed Billing cards, search/filter independence, invoice detail/print, Customer Billing overview and create availability, and the mixed Sales Documents registry, ordering, detail/print and cancellation visibility. No artificial documents were created to force pagination. Final focused and payment/refund regression validation: 80/80 PASS; `git diff --check` PASS. Payment ledger, refunds, net math, invoice and receipt numbering/lifecycles/snapshots, Accounting, Customer Account and POS truth are unchanged. Operational receipts remain non-fiscal; no VeriFactu or fiscal implementation was added. No data mutation, table/RLS/trigger/mutation-RPC change or backfill.

Previous functional task: `DATA-RETENTION-AND-SCALE-001D` (`a0cccbfe792feb53471bf9b7f266afc6ca111efd`) — **COMPLETE / Product Owner UAT PASS**. Quick Drop pending-detail is an operational queue, not historical pagination. `public.list_pending_quick_drops()` has no organization argument: it derives tenant context server-side, enforces `require_shop_terminal_access`, and uses organization/order-scoped history and item predicates. It includes active received Orders with `received_at`, Quick Drop source evidence and zero active `order_items`, ordered `received_at DESC, id DESC`; no recent-history cap or SQL `LIMIT` determines discoverability. The complete queue supplies the count; Terminal initially shows at most five entries and offers Show all / Show fewer for the rest. No index, table, RLS, historical-data or Quick Drop workflow change. Staging operator reports migration `20261003000200_data_retention_scale_001d_quick_drop_pending_completeness.sql` applied to `exthnplfokcucaqydney`; production untouched. Product Owner created EW-000134, saw it immediately in the queue with the complete count and canonical Order link, then saw it leave the queue after adding items. Normal Quick Drop flow passed. The >5 control was covered by focused tests; staging was not artificially populated for manual UAT.

UAT hotfix: `ORDER-CANCELLED-PAID-WARNING-I18N-001` (`0da06331e1f94f8454cb032e582348f5477b2cb7`) — **COMPLETE / Product Owner UAT PASS**. Order detail retrieves `payments.cancelledPaidWarning` with `t.raw`, leaving `{amount}` for `PaymentsPanel` to replace with formatted `netCollected`. The Product Owner confirmed Order detail renders. Payment/refund semantics and database state are unchanged.

Previous functional task: `QUICK-DROP-UNPRICED-TICKET-STATUS-001` (`7ab6a51d513406adf933d13bb5966fc7608cbd41`) — **COMPLETE / Product Owner UAT PASS**. The internal live Ticket reads canonical Quick Drop `financialState` through `getQuickDropOrderOrNull` in `getPrintOrderContext`. An `unpriced` Quick Drop displays the existing localized `common.quickDrop.unpriced` label instead of generic “Paid”; priced Quick Drops and ordinary zero-value Orders keep the payment status from `getOrderPaymentSummary`. Receipt and labels are unchanged. No payment/refund math, `public.get_order_payment_summary`, database, schema, migration, RPC, Accounting or fiscal change; existing translations were reused.

Previous functional closeout: `DATA-RETENTION-AND-SCALE-001C` (`f4e0924809d544fadcb6d94102c0a245661e5157`) — **COMPLETE / Product Owner UAT PASS**. Orders History uses bidirectional keyset pagination: 25 visible Orders per page, at most 26 fetched with a sentinel, ordered by `created_at DESC, id DESC`. Older/Newer navigation preserves `q`, status, priority and active filters; filter changes reset pagination. There is no offset or total-count dependency. The cursor binds `createdAt`, `id`, direction and filters without organization identity; the tenant comes server-side from membership. Enrichment covers only the 25 visible Orders, never the sentinel; no generic pagination framework was added. Product Owner UAT passed on the reviewed local working tree against staging Supabase: traversal, newest-first ordering, no visible boundary duplicates or missing jumps, filter reset and pagination UX. Production was untouched.

Staging migration closeout (2026-10-03): release-rehearsal operator verification found `20261001000100_order_property_client_filter_001.sql` still pending remotely, contrary to the earlier documentation checkpoint. The staging operator then applied that migration and `20261003000100_data_retention_scale_001c_orders_history_index.sql` to `exthnplfokcucaqydney`; final Local = Remote history through `20261003000100`. The new `orders_org_created_id_idx` covers `(organization_id, created_at DESC, id DESC)`; existing `orders_list_idx` was preserved. Production was untouched.

Previous functional closeout: `RECEIPT-EMPTY-ORDER-UX-001` (`acd04ce4a0b6d891b04996e0645e9c3a41b6b4a7`) — **COMPLETE / Product Owner UAT PASS**. On staging, printing a receipt for an Order with no active items creates no operational receipt, returns to the usable Order detail and displays the existing localized `orderItemsRequired` warning instead of the generic Next.js server-error page. `public.issue_operational_receipt(uuid)` remains authoritative: only PostgreSQL `22023` with message `operational_receipt_items_required` becomes the controlled warning; unexpected receipt failures still fail visibly. Receipt numbering, immutable snapshots, idempotency/reuse, ticket and label printing, entitlement/capability checks, tenant isolation, Accounting, Billing, payments/refunds and fiscal behavior are unchanged. No migration, schema, RLS or RPC change; no Supabase commands and no production change.

Previous functional closeout: `ORDER-PHOTO-INLINE-VALIDATION-UX-001` (`a4d1c6b4b1f31ac7f1a7c9765dc8c740f43df781`) and `ORDER-PHOTO-UPLOAD-BOUNDARY-UX-001` (`b7fb9d686e8d7ec136cfe6369a341982ce3cf611`) — **COMPLETE / Product Owner UAT PASS**. On staging, a photo over 1 MB stays on Order detail and shows the localized inline message “L'immagine non può superare 1 MB.”; the generic Next.js server-error page no longer appears. A valid supported photo under 1 MB uploads normally, the existing helper remains visible and the Order photo workflow remains usable. `MAX_ORDER_PHOTO_BYTES = 1024 * 1024` remains the authoritative application limit; Next.js Server Action `bodySizeLimit = "2mb"` is transport headroom only, not a larger permitted photo size. Server MIME, size and binary-signature validation remain authoritative. The private `order-media` Storage boundary, tenant/order path, `register_order_photo` RPC, registration-failure cleanup, categories, caption, visibility, deactivation and database/bucket 1 MB boundary are unchanged. No migration, schema, RLS or Storage-policy change; no Supabase commands were run and production was untouched.

Previous functional closeout: `ORDER-PROPERTY-CLIENT-FILTER-001` (`8f00346e2e1108f3c56be287d5fce009b874047e`) and `PROPERTY-LIFECYCLE-REACTIVATE-UX-001` (`7857d217cce0556b16c84a882fd0c937f321faa7`) — **COMPLETE / Product Owner UAT PASS**. UAT-ready documentation checkpoint: `6980de4dac53a8892a074d197e795f537e0d607e`. The Product Owner verified zero historical order/property customer or tenant mismatches. The earlier checkpoint incorrectly described migration `20261001000100` as already applied; operator verification on 2026-10-03 found it pending and applied it to staging during the 001C release rehearsal. Production was untouched.

Previous functional closeout: `MANUAL-EXTERNAL-REFUND-001` — **COMPLETE / Product Owner UAT PASS**. Core implementation `c7676d21bde29bc28002f727427317b1d0439b5a`; UAT-ready checkpoint `fd279d18ebd422fe8e526008aaada835427e6f48`; UX follow-up `90a02c3c6cb03bb3eb5a0bb4af30f0c6c6569005` is complete. Migration `20260930000500_manual_external_refund_001.sql` is applied to staging `exthnplfokcucaqydney`; local/remote migration history is aligned through `20260930000500`, and the post-apply dry-run reported “Remote database is up to date.” Production was untouched. Earlier manual external payment, POS payment/refund, Warehouse custody and outbound delivery UAT passes remain complete.

Previous functional task: `DATA-RETENTION-AND-SCALE-001E` (`13b1247312a81f68654502b5d97ac185510028ff`) — **COMPLETE / Product Owner UAT PASS**. Terminal loads eight Recent customers for presentation only; non-empty search queries the full active tenant customer population by `display_name`, phone and email before returning at most eight matches. Server-derived organization and Terminal access remain authoritative; WALKIN/system customers are excluded. Search uses a 250 ms debounce and rejects stale async responses. Searched customers use the existing `selectCustomer` flow; customer catalog/segment pricing, A/B/A draft preservation, Quick Drop and customer creation remain unchanged. In local UAT against staging, “patricia” returned “Patricia Sobron Panera”; selection, catalog loading, clearing search, no-match feedback and Terminal usability passed. This is not a performance benchmark. No database, schema, migration or RPC change; no Supabase remote operation, and production was untouched.

Previous functional task: `DATA-RETENTION-AND-SCALE-001F` (`166987e86a1c3d11c790230c11b2c1d63d90bda4`) — **COMPLETE / Product Owner UAT PASS**. POS session history and current-session payments use independent bidirectional keyset pagination with 25 visible rows plus one sentinel, replacing the terminal 25- and 100-row history bounds. Session history orders by `opened_at DESC, id DESC`; payments order by `created_at DESC, id DESC`. Older, Newer and Back to latest preserve outstanding-order `q`; each cursor navigates its own history without clearing the other, and Back to latest clears only that cursor. Malformed cursors reset safely, payment cursors are bound to the current POS session, and cursors contain no tenant identity. Owner/Manager session-history visibility and Staff behavior are unchanged. The current-session summary remains complete and unpaginated; `get_pos_session_summary`, refund actions, payment/refund math, Accounting, Billing, Daily Close and POS lifecycle are unchanged. Migration `20261004000100_data_retention_scale_001f_pos_payment_history_pagination.sql` adds only the POS-session `(organization_id, opened_at DESC, id DESC)` and session-payment `(organization_id, pos_session_id, created_at DESC, id DESC)` indexes, the latter restricted to non-null `pos_session_id`. It is applied to staging `exthnplfokcucaqydney`; local/remote migration history aligns through `20261004000100`. No table, RLS, RPC/function or historical-data change; production was untouched. Product Owner UAT passed authenticated POS, till summary, current payments/refund-action visibility, outstanding-order search and Owner session history without runtime errors. No artificial payments or sessions were created to force more than 25 rows; automated tests cover multi-page navigation.

Previous functional task: `DATA-RETENTION-AND-SCALE-001G` (`db7c2bf4dbadcd033f0e0e666f317c28e1dc7a4f`) — **COMPLETE / Product Owner UAT PASS**. Customer List replaces the terminal 100-row boundary with true keyset pagination: 25 visible rows plus one sentinel, ordered `display_name ASC, id ASC`. Existing search fields and active/inactive/all filters run server-side before limiting. Cursors bind query/status without tenant identity; malformed or mismatched cursors reset safely. Property counts remain exact through a count for each returned customer, without loading all tenant Property rows. Customer Account Recent remains an unpaginated snapshot of 8 orders and 12 payments. Year/All replace the terminal 50/100-row bounds with independent order/payment keyset histories, each showing 25 rows plus one sentinel with Older/Newer/Back to latest. Orders retain `created_at DESC, id DESC`; payments retain `paid_at DESC, created_at DESC, id DESC`. Cursors bind customer and period; invalid bindings reset safely, changing period clears both, and navigating one history preserves the other. `get_customer_account_summary` remains complete and unpaginated, never derived from the visible page. Confirmed-minus-refunded math and cancelled/inactive order eligibility are unchanged, as are Billing, Accounting, POS, Portal and customer lifecycle. Tenant context remains server-derived; Customer List membership and Owner/Manager-only Customer Account access remain enforced, with no RLS weakening or service-role path. Migration `20261004000200_data_retention_scale_001g_customer_history_scalability.sql` adds only three read RPCs, their permissions and three supporting indexes; both legacy Customer Account RPC signatures remain callable. No data mutation/backfill, destructive DDL, RLS, lifecycle, payment or order mutation. Accepted operator evidence confirms only this migration was applied to staging `exthnplfokcucaqydney`, bringing the applied migration checkpoint through `20261004000200`; production was untouched. Product Owner local UAT against staging passed customer fields/counts, known-customer search, status filters, real Customer Account access, stable complete summary across Recent/Year/All, order/payment history, Order links and Properties. No artificial Customer/Order/Payment volume was created to expose pagination; automated tests cover multi-page keyset mechanics. Final focused and relevant regression validation: 119/119 PASS and `git diff --check` PASS.

Current Mission: No active implementation mission.

Next Action: CTO scope for standard **EcoWash La Tejita Tenerife pilot organization configuration**, catalog/pricing setup and onboarding UX review; the Product Owner will use supported SaaS interfaces. Accounting 100-location selector and Printer 100-location picker remain separate later work. `CATALOG-LARGE-IMPORT-001` is future/not active; the 500-row import limit is intentional. Reliability/failure-mode hardening, backup/restore/DR evidence, Supabase Pro and AUTH-DR-001C remain later pre-production work; Production Readiness Review and fiscal architecture follow under their established gates. Phoenix is not public-production ready.

---

## Historical Handover — 2026-10-05

- **COMPLETE / Product Owner UAT PASS:** `ORDER-PHOTO-INLINE-VALIDATION-UX-001` (`a4d1c6b4b1f31ac7f1a7c9765dc8c740f43df781`) and `ORDER-PHOTO-UPLOAD-BOUNDARY-UX-001` (`b7fb9d686e8d7ec136cfe6369a341982ce3cf611`). A selected file over the canonical 1 MB limit shows the localized inline size error immediately and is not submitted; the Product Owner confirmed that the Order page remains usable instead of showing the generic Next.js server-error page. Valid supported photos under 1 MB upload and the file helper remains visible. `MAX_ORDER_PHOTO_BYTES = 1024 * 1024` remains server-authoritative; Server Action `bodySizeLimit = "2mb"` provides multipart transport headroom only. MIME/signature validation, `order-media` Storage, tenant/order paths, photo registration/cleanup, categories/caption/visibility/deactivation and the database/bucket 1 MB boundary remain unchanged. No DB, migration, RLS or Storage-policy change; no Supabase commands and no production change.
- **COMPLETE / Product Owner UAT PASS:** `RECEIPT-EMPTY-ORDER-UX-001` (`acd04ce4a0b6d891b04996e0645e9c3a41b6b4a7`). For an Order with no active items, “Print receipt” no longer opens the generic Next.js server-error page: no receipt is created, the user returns to the normal Order detail, sees the existing localized `orderItemsRequired` alert and can continue using the Order. The authoritative `public.issue_operational_receipt(uuid)` RPC rejects the empty active-item snapshot before numbering or insertion. Only `22023` plus `operational_receipt_items_required` maps to this warning; all other errors retain visible technical failure. Receipt numbering, immutable snapshots, reuse/idempotency, ticket/labels, access checks, tenant isolation and financial/fiscal boundaries remain unchanged. No DB, migration, schema, RLS or RPC change; no Supabase commands and no production change.
- **COMPLETE / Product Owner UAT PASS:** `ORDER-PROPERTY-CLIENT-FILTER-001` and `PROPERTY-LIFECYCLE-REACTIVATE-UX-001`. A Phoenix Property permanently belongs to the Customer under which it was created; `properties.customer_id` is immutable. If a real-world property moves to another Customer, preserve the old record and historical Order references, deactivate it when appropriate, and create a new Property for the new Customer. New Orders require an active Customer; Property remains optional and, when selected, must be active and belong to the selected Customer and tenant. Changing Customer clears Property; `create_order` and `validate_order_relationships` remain authoritative. Order edit shows canonical `order.customerName` and `order.propertyName` read-only, including an inactive historical Property, with no reassignment workflow. Active Properties can be deactivated; inactive Properties remain reachable and can be explicitly reactivated. Ordinary editing of an inactive Property does not reactivate it. Tenant isolation and RLS are preserved; no historical Order rewrite, backfill or new composite FK was introduced. Shop Terminal, Quick Drop, Portal, pricing/segments, logistics, payments, Accounting, Daily Close and fiscal behavior are unchanged.
- **COMPLETE / UAT PASS:** `ORDER-ITEMS-LIFECYCLE-GATE-001` and `PRODUCTION-DEFAULT-ASSIGNEE-001`. The latter uses staging migration `20260928000200_production_default_assignee_001.sql`. Normal manual draft→received requires an active order item; only Quick Drop and completed inbound pickup may receive without one. All zero-item orders are blocked from actual production and final fulfillment until an active item is added; cancellation is allowed. No placeholders or backfill.
- **COMPLETE / UAT PASS:** inbound pickup is customer→EcoWash; outbound delivery is EcoWash→customer. Confirming final Warehouse position, package count and storage mode atomically completes production without a second manual status step. Production completion is not final fulfillment. Without delivery, `ready_for_customer_pickup` awaits explicit customer handoff. Scheduled delivery shows **Ready for delivery**, in-progress delivery **In delivery**, and completed delivery **Completed**. Payment/receipt is not physical handoff.
- **COMPLETE:** Daily Close has live preview, immutable saved snapshot, tenant-local business date, organization/location scope, history/exports, internal post-close operational/financial gate and Portal after-close intake protection. POS sessions remain independent. It is operational, not statutory/fiscal close.
- **COMPLETE / UAT PASS:** Warehouse current stock represents physical storage only. Configured positions/default inbound, receipt-driven current `order_storage`, owner/manager placement/move/update and final ready placement preserve real storage; overview/search and mobile navigation remain available. A scheduled outbound delivery may wait at a real position, with configured delivery staging suggested where available. Starting delivery requires an active order, completed production and current storage; scheduled→in_progress atomically sets the exact delivery to in_progress and `started_at`, removes storage and records an append-only `delivery_started` exit linked to that `delivery_id`. The order disappears from current Warehouse stock while EcoWash retains transit custody. Failed delivery requires a reason and valid active return position, restores package count/storage mode from that delivery's departure snapshot, and records `delivery_returned`. Actual delivery completion ends EcoWash custody without a second Warehouse exit; historical movement history may correctly end with **Warehouse exit / Delivery started**. Customer handoff and cancelled-order return retain their separate paths. Draft Terminal/order creation is not receipt; Quick Drop and completed inbound pickup can establish `received` plus storage atomically. No fake transit shelf or per-garment Warehouse lifecycle.
- **COMPLETE / UAT PASS:** Shop Terminal preselects the valid configured per-location default (Quality Test in UAT), otherwise Unassigned; a manual override applies to that order and the next new order returns to the location default. There is no first-staff fallback. Separately, an order still unassigned at received→washing may receive the valid default atomically; the resulting assignment now appears in Order detail immediately without a browser refresh (EW-000118/119). Unassigned warning applies only during active production, not draft/received/ready/completed/cancelled.
- **COMPLETE / UAT PASS:** With an inbound pickup scheduled or in progress, manual draft→received is blocked and Order detail explains that pickup must be completed first. Pickup completion canonically sets received/received_at and establishes inbound Warehouse custody; no open or a cancelled pickup permits normal manual receipt under existing gates. Quick Drop retains its separate receipt path. Product Owner staging UAT passed for EW-000118/119; migration `20260929000100_inbound_pickup_receipt_gate_001.sql` was reported applied to staging `exthnplfokcucaqydney`, with local/remote history aligned through `20260929000100` at that checkpoint.
- **Staging Auth signup:** AUTH-DR-001B4 verified hosted public signup OFF and email confirmation ON through public Auth settings and Product Owner read-only Dashboard evidence. No hosted setting changed during B4. Auth recovery remains a separate pre-production release gate.
- **PHOENIX OPERATIONAL PILOT CLOSEOUT — PASS:** Product Owner tested Terminal, normal/direct intake, Quick Drop, Portal intake, inbound pickup and physical receipt, production/assignment/item gates, Warehouse inbound/final placement and exit, customer handoff, outbound delivery, payments, Daily Close and post-close behavior. Fresh-order outbound delivery staging UAT also passed: scheduled→in_progress→completed, exact linked departure movement, no storage after departure, no current Warehouse row, final Completed display and Order detail custody callouts. This is staging acceptance, not public-production readiness.
- **COMPLETE:** `DELIVERY-STATUS-REFRESH-001` (`016888dc259b78af1f6a972187120b0c55590490`) revalidates the Orders list after successful delivery transitions. `DELIVERY-ORDER-DETAIL-REFRESH-001` (`c131fef0552ee89ed6d587020cffb4d886026083`) revalidates and redirects successful Order-detail delivery transitions to `/${locale}/app/orders/${orderId}#logistics`, clearing stale query parameters without changing workspace behavior. `WAREHOUSE-ORDER-DETAIL-CUSTODY-UX-001` (`9feba00f9a9944c508ecd97911a327a09d33b23b`) keeps real current storage visible when present; without storage it shows out-of-Warehouse/in-delivery or delivered custody, with movement history below. These follow-ups required no DB or migration change.
- **V1 decision:** catalog/services → commercial `order_items` snapshot → ticket/labels → order-level production → order-level Warehouse → fulfillment. Discrete labels may identify each unit (`PHX1:L:<order UUID>:<order-item UUID>:<unit index>`); two trousers can print `1/2` and `2/2`. This QR identifies an order/item/unit, not a persistent garment or scan event. Operators verify complete orders. Commercial 18 kg laundry and three physical bags remain 18 kg order quantity and `package_count = 3`. Garment/package tracking and partial ready/fulfillment are deferred, not approved.
- **COMPLETE / Product Owner UAT PASS:** `POS-SESSION-PAYMENT-BOUNDARY-001` (`ff4258d768501396d01a5c26e689187976d36b02`). Every new payment recorded with `channel='pos'` requires a valid open POS session, regardless of method (`cash`, `card`, `bank_transfer`, `other`). Payment method and channel remain separate. `record_pos_payment` requires a non-null target session belonging to the same organization with status `open`; existing actor/location checks remain. This is an RPC boundary, not a global table constraint; historical payments were not backfilled or changed. With the till closed, the POS payment form is hidden and explains that the till must be opened; opening the till and payment history remain available. With it open, recording works normally. Shop Terminal paid-now still requires an active session; Pay Later remains available without recording payment. Online/provider payments remain `channel='online'` and independent of till state under existing provider/post-close rules. Refund behavior at that checkpoint was unchanged; the later `POS-REFUND-CHANNEL-SESSION-BOUNDARY-001` closeout below is now authoritative. No supported new `channel='order'` manual external write path was added. Daily Close remains separate from POS sessions, with existing blockers/warnings and `non_session_non_cash_activity` semantics unchanged. Staging migration `20260930000200_pos_session_payment_boundary_001.sql` was applied to `exthnplfokcucaqydney`; local/remote history aligns through `20260930000200`, the post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner UAT passed closed-till form/message, open-till recording, Terminal Pay Later without payment, and online payment independence.
- **COMPLETE / Product Owner UAT PASS:** `POS-REFUND-CHANNEL-SESSION-BOUNDARY-001` (`205ceb62bd809665477689cc21f15dc8ec848fe1`). `record_pos_refund` is POS-only: it requires a confirmed `channel='pos'` source payment in the current organization and a non-null, same-organization POS session with status `open` for every refund method. Existing actor/location authorization, refundable-amount limit, locking and idempotency remain authoritative. The confirmed source is never changed; each refund is a separate `status='refunded'`, `channel='pos'` payment row linked by `refunded_from_payment_id`. Historical rows were not backfilled or changed. Order detail offers the POS refund only for refundable POS-source payments; without an open till it disables submission and explains the requirement. Online and historical `order`-channel payments have no POS refund action. The POS workspace retains refunds for eligible current-session POS payments and supplies that active session. Online/provider settlement remains `channel='online'` and unchanged; this task added no real provider refund API or manual external/order refund path. Cash POS refunds still reduce expected till cash; new non-cash POS refunds are session-linked. Daily Close, confirmed-minus-refunded Accounting and Customer Account semantics, Billing separation and the disabled `refund_payment`/`void_payment` paths remain unchanged. Staging migration `20260930000300_pos_refund_channel_session_boundary_001.sql` was applied to `exthnplfokcucaqydney`; local/remote history aligns through `20260930000300`, post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner UAT passed open-till POS refund, closed-till block/message, and absence of the POS refund action for online and historical `order` payments.
- **COMPLETE / Product Owner UAT PASS:** `MANUAL-EXTERNAL-PAYMENT-001` (`7dae0ba632756d147af8e7589c2212a657878ace`) adds `channel='manual_external'` for verified payments received outside physical POS and online/provider settlement. `order` is legacy/historical with no supported new write path; `pos` requires an open till; `online` remains provider-settled and till-independent. Owner/Manager may record `bank_transfer` or `other` on an active same-organization order with outstanding balance; `cash` and `card` are excluded. The server requires a positive amount within the balance, reference, notes for `other`, idempotency, server-generated `paid_at=now()` and authenticated `recorded_by`/`confirmed_by`; it stores no POS session or provider metadata and does not permit a retroactive effective date. Order detail shows “Registra pagamento esterno” only to Owner/Manager while balance remains; Shop Terminal has no new write path. This internal financial write obeys the existing business-day close gate with no online exemption, remains sessionless, does not affect expected cash and may contribute to `non_session_non_cash_activity`; Daily Close was not redesigned. Existing confirmed-minus-refunded semantics include it in order balance, collectedNet, Accounting, Customer Account/history and derived payment status without new math. `get_pos_receipt_data` now requires `channel='pos'`, so manual external payment cannot be represented as a POS receipt; operational printing remains non-fiscal. Online attempts, webhooks and settlement are unchanged, with no fake provider metadata. `record_pos_refund` remains POS-only; no manual external refund was implemented at that payment checkpoint. Historical `order` rows were neither backfilled nor rewritten. Migration `20260930000400_manual_external_payment_001.sql` is applied to staging `exthnplfokcucaqydney`, local/remote history aligns through `20260930000400`, the post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner staging UAT passed Owner/Manager entry, bank transfer with reference, `other` requiring notes and succeeding with notes, exclusion of cash/card, closed-till independence, correct balance/Accounting updates and unchanged Terminal behavior.
- **COMPLETE / Product Owner UAT PASS:** `MANUAL-EXTERNAL-REFUND-001` (`c7676d21bde29bc28002f727427317b1d0439b5a`) adds dedicated `record_manual_external_refund`. Owner/Manager may record a separately linked `status='refunded'`, `channel='manual_external'` fact only for a confirmed same-organization `manual_external` source with method `bank_transfer` or `other`; the source remains immutable, and the source Order is checked for the same organization without requiring it to remain active. The refund method comes from the source. Reason and reimbursement-event reference are mandatory, the refund reference must differ from the original payment reference, and notes are mandatory for `other`. The server supplies `paid_at`/`refunded_at` and actor IDs, requires idempotency, locks the source and allows multiple partial refunds only up to the remaining refundable amount. No POS session or provider fields are recorded. Order detail offers a distinct Owner/Manager external-refund form for eligible sources even after Order cancellation; it records an already completed external reimbursement and does not move money. The existing non-online Daily Close gate applies; this sessionless non-cash fact does not alter expected cash and may contribute to `non_session_non_cash_activity`. Existing confirmed-minus-refunded math drives collectedNet, Order balance, Accounting, Customer Account and the cancelled-paid warning without formula changes. `record_pos_refund` remains POS-only, and `get_pos_receipt_data` remains POS-only; online/provider refunds, historical `order`-channel refunds and fiscal behavior were not implemented. Migration `20260930000500_manual_external_refund_001.sql` is applied to staging `exthnplfokcucaqydney`; local/remote history aligns through `20260930000500`, post-apply dry-run reported “Remote database is up to date,” and production was untouched. Product Owner staging UAT passed: the eligible action worked with the POS till closed, mandatory evidence was enforced, a €5 partial refund left €7 refundable, a second €7 refund fully reimbursed the €12 source, payment state became Refunded, net paid became €0, balance due returned to €12, and the action disappeared when no refundable amount remained. Cancelled-order eligibility, POS/online action separation and financial refresh also passed. `MANUAL-EXTERNAL-REFUND-UX-001` (`90a02c3c6cb03bb3eb5a0bb4af30f0c6c6569005`) maps `manual_external_refund_reference_not_distinct` to a dedicated localized message; generic failures retain their generic message.
- **Separate open decisions:** Historical `order`-channel refunds and online/provider refunds remain separate future questions. Other findings require their own scope. Later SaaS Productization Baseline, clean Demo Tenant onboarding and `PHX-FISCAL-001` architecture/compliance remain separate decisions; operational receipts remain non-fiscal.
- **BLOCKED for public production:** database and Storage recovery are proven; managed Auth and authenticated application recovery are not. Keep tenant/RLS/auth boundaries and EcoWash La Tejita as first tenant/reference, never product identity. Open work includes `ACCOUNTANT-EXPORT-PRESENTATION-UX` and monitored `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001`, Accounting UI 100-location selector within Productization, `NETWORK-FAILURE-UX-001`, the PDF technical-key cosmetic issue only if reproducible, SaaS Productization Baseline, Demo Tenant, historical `order`-channel refunds, online/provider refunds and Auth DR. Catalog CSV completeness is closed; `CATALOG-LARGE-IMPORT-001` is future/not active. Future fiscal exports and `PHX-FISCAL-001` remain separate; `PHX-FISCAL-RECTIFICATION-001` remains a future requirement for invoice corrections, credit notes and adjustments. Operational receipts remain non-fiscal. Phoenix is not public-production ready.

The dated closeouts below record earlier checkpoints. Their “next proposed task,” staging-pending and implementation-boundary statements are historical, not the current resume instruction.

### ORDER-PROPERTY-CLIENT-FILTER-001 / PROPERTY-LIFECYCLE-REACTIVATE-UX-001 — Product Owner staging UAT PASS

1. New Order Property is optional; Customer A shows only Customer A's active Properties, changing to Customer B clears the selection, and a Customer without Properties can still create an Order. Cross-customer manipulation remains server/database protected.
2. Existing Order edit shows Customer and Property read-only using the canonical Order names; the correct historical Property remains visible after deactivation, with no reassignment workflow.
3. Property deactivation succeeds; the inactive Property stays reachable, shows Reactivate, and returns to Active and the Deactivate action after explicit reactivation. Ordinary editing while inactive does not reactivate it; normal detail edits still work and Customer ownership cannot change.
4. Shop Terminal, Quick Drop and Portal regressions passed; pricing/segments, logistics, payments, Accounting, Daily Close and fiscal behavior remain unchanged.

### MANUAL-EXTERNAL-REFUND-001 — Product Owner staging UAT PASS

1. An eligible `manual_external` payment displayed the refund action, and a refund worked with the POS till closed.
2. Reason and refund reference were required; reusing the original payment reference displayed the dedicated localized explanation.
3. The `other` method required notes.
4. A €5 partial refund left €7 refundable; a second €7 refund completed reimbursement and removed the action.
5. Payment state became Refunded, net paid became €0, and balance due returned to €12; Order and Accounting refreshed correctly.
6. Eligible cancelled-order sources remained refundable; POS and online sources did not display the manual external refund action.

---

## PHOENIX-UAT-CLOSEOUT-001 Checkpoint

- `TERMINAL-ORDER-STATE-AND-TIME-001` is complete and stable in repository commit `5346a0eee08ebf32bf0bf9801a58fded99a68cfe`: receipt/operator timestamps use the tenant organization timezone, and derived operational status separates production completion from final fulfillment.
- `CONTROL-CENTER-ALERTS-COVERAGE-001` is complete and stable in repository commit `43966be8ac6adea7521a803e895e50aff6ced5a7`: unpaid/partial orders remain alertable after production completion, with canonical Alerts page/navigation badge parity and no database migration.
- `ORDER-CANCEL-LOGISTICS-CONSISTENCY-001` is complete and stable in repository commit `0a90a401abddf9f947fa9722e165afc1503b7ea6`: cancelled/inactive parents reject actionable logistics, Daily Close excludes correctly scheduled future work, and migration `20260912000100_order_cancel_logistics_consistency_001.sql` narrowly reconciles open legacy logistics under cancelled parents. The reconciliation derives the cancellation actor from the latest applicable `order_status_history.changed_by`, falling back only to an existing FK-valid logistics actor.
- The three changes are committed and pushed on `main`. Staging application of migration `20260912000100` and Product Owner staging UAT are not recorded as complete and remain the next validation gate.
- No financial canon, fiscal/VERI*FACTU behavior or completed/cancelled logistics history was changed.

---

## BACKUP-DR-001D / PHX-AUTH-DR-001 Checkpoint

- `VERIFIED`: a new isolated PostgreSQL 17 Supabase recovery project was created in `eu-west-1`; the protected staging ref remained unchanged and staging/production were untouched.
- `VERIFIED`: 49/49 canonical migrations, the complete 1,528-row `data.sql` payload and the relevant safe `roles.sql` state were restored and validated. Schema, row-count, public-FK, uniqueness, sequence and tenant consistency checks passed.
- `VERIFIED WITH MANAGED-ROLE EXCEPTION`: the reserved `supabase_admin` timeout override was rejected and not forced; required application-facing role/grant state passed.
- `VERIFIED`: BACKUP-DR-001B was exercised end to end through the supported Storage API. All 223 objects and 22,451,620 bytes were restored and re-downloaded; 223/223 SHA-256 checks matched with no failures, missing objects or extras.
- `NOT YET VERIFIED`: physical managed Auth restore, authenticated application/RLS flows, final end-to-end recovery and final RTO.
- `APPROVED STRATEGY`: the primary route is a completed provider physical backup / Restore to a New Project after a separately approved Pro upgrade. Documented Admin `createUser` does not expose an original-user-ID parameter; original-UUID Admin API reconstruction is **UNSUPPORTED / NOT VERIFIED**, not a complete DR fallback. Emergency re-onboarding is degraded continuity only.
- `CURRENT B3/B4 STATE`: Auth row integrity is closed with one documented legacy test exception; 13/13 Auth/profile UUIDs reconcile. Protected inventory, non-secret configuration and clone containment are ready. B4 Storage snapshot is locally `COMPLETE` at 229 objects / 25,060,061 bytes; this new set has not been restored.
- `SIGNUP VERIFIED`: hosted public signup is disabled; email confirmation is enabled. The earlier drift wording is superseded.
- Phoenix must not be considered fully production-ready or DR-complete until the deferred AUTH-DR-001C physical/authenticated rehearsal passes, encrypted off-device custody is resolved and the remaining mandatory release gates pass. See `docs/05_DEVELOPMENT/Recovery_Runbook.md`.
- `DECOMMISSION COMPLETE`: recovery project `xsjmhjmhaftieokuwssf` was permanently deleted, protected staging `exthnplfokcucaqydney` remained intact, FitIQtracker was resumed, the local `postgres:17` rehearsal image was removed and no rehearsal temporary files remained in `/tmp` or Downloads. Verified backup artifacts in `~/EcoWash-Backups` were deliberately retained.
- Pro upgrade and AUTH-DR-001C are intentionally deferred until pre-production and are not authorized now. Continue zero/additional-cost product/SaaS work. Detailed evidence and the canonical release gate are in `docs/05_DEVELOPMENT/Recovery_Runbook.md`.

---

## DASHBOARD-LOGISTICS-LIFECYCLE-001 Closeout

- `DASHBOARD-LOGISTICS-LIFECYCLE-001` is COMPLETE / STABLE. Dashboard today, overdue and workload signals plus operational alerts now reuse the canonical logistics parent lifecycle.
- Draft, cancelled and inactive parents are excluded. Accepted states from `received` onward remain eligible, including production `completed` while pickup/delivery is still open.
- Tenant filtering, organization timezone behavior, completed history and manager planning remain unchanged. No schema change or migration was required.
- Focused validation, staging deployment and Product Owner E2E passed.
- Next proposed task: `BACKUP-DR-001`.

---

## LOGISTICS-COMPLETED-HISTORY-001 Closeout

- `LOGISTICS-COMPLETED-HISTORY-001` is COMPLETE / STABLE. Pickup and delivery completed-today history reads existing canonical rows with `status = completed` and uses `completed_at` as the authoritative completion timestamp.
- Staff see only their own assigned completed-today tasks; owner/manager roles see organization team completions and assigned staff identity where available. Existing tenant, capability and RLS boundaries remain unchanged.
- The current-day boundary and displayed completion time use `organizations.timezone`. Mi día and active pickup/delivery queues remain open/current work only.
- No history table, schema change or migration was required. Focused validation, staging deployment and Product Owner E2E passed.
- No next product task is approved; `RECEIPT-COMPACT-LINES-UX` remains recorded as non-blocking UX polish.

---

## LOGISTICS-TIMEZONE-001 Closeout

- `LOGISTICS-TIMEZONE-001` is COMPLETE / STABLE. Tenant wall-clock `datetime-local` values are interpreted with server-derived `organizations.timezone`, stored as absolute `timestamptz` instants, and rendered for managers and staff in that same tenant timezone.
- The shared conversion is DST-aware; language continues to follow user locale and never determines timezone. Shop Terminal delivery scheduling and dashboard logistics rendering use the same canonical boundary.
- No migration or automatic rewrite of previously shifted rows was made; affected historical rows may be corrected manually through normal rescheduling.
- Focused validation, staging deployment and Product Owner E2E passed with manager, My Day and delivery workspace all showing `21:00`.
- Next proposed task: `LOGISTICS-COMPLETED-HISTORY-001`.

---

## ACCOUNTING-DOCUMENTS-NAV-001 Closeout

- `ACCOUNTING-DOCUMENTS-NAV-001` is COMPLETE / STABLE. Accounting now exposes visible locale-aware access to the sales-document registry.
- Operational receipt print/PDF actions and compact localized headers were corrected; browser and print/PDF Product Owner validation passed, including safe wrapping for long descriptions.
- No document or financial semantics changed, and no database migration was required.
- Next proposed task: `LOGISTICS-TIMEZONE-001`.

## Open Findings

- Historical `order`-channel refund path — separate future question; no replacement flow or provider refund API was implemented by the POS refund or manual external payment tasks.
- `PHX-AUTH-DR-001` — AUTH-DR-001B3 CLOSED / PASS and 001B4 COMPLETE / PASS; 001C physical and authenticated recovery is deferred until pre-production as a hard release gate.
- `AUTH-CONFIG-DRIFT-001` — staging signup disabled and confirmation enabled are verified through B4 public settings and Product Owner read-only Dashboard evidence; this configuration finding is closed.
- `POS-DAILY-CLOSE-001` — remaining POS/Daily Close refinements remain open pending focused Product Owner/CTO scope; financial canon must remain unchanged.
- `NETWORK-FAILURE-UX-001` — define clear user feedback and safe recovery behavior for operational network failures.
- `RECEIPT-COMPACT-LINES-UX` — consider future vertical-space optimization for long item descriptions while preserving readability and print safety; this is non-blocking UX polish.
- The duplicate “Próxima actividad / Mis actividades” presentation is non-blocking UX polish unless the Product Owner prioritizes it later.

---

## ORDER-FULFILLMENT-LIFECYCLE-001 Closeout

- `ORDER-FULFILLMENT-LIFECYCLE-001` is COMPLETE / STABLE. Draft pickup/delivery remains configurable for manager planning but is excluded from operational staff work until the parent order reaches an accepted state; `received`, active production, `ready`, `completed` and accepted-order `on_hold` remain logistics-eligible.
- Production `completed` no longer suppresses open pickup/delivery. The logistics record's own `scheduled`, `in_progress`, `completed` or `cancelled` lifecycle governs operational visibility and provides the existing customer-handoff evidence through `status` and `completed_at`.
- No fulfilled, handed-off, custody, inventory or stock field/table was added. The shared typed application predicate and authoritative pickup/delivery transition RPC checks preserve tenant, capability and assignment boundaries while rejecting draft operational advancement.
- Staging migration `20260908000300_order_fulfillment_lifecycle_001` is applied and aligned. Focused validation, preview deployment and Product Owner E2E passed: draft assignment stayed hidden from staff, `received` activated the work, production completion preserved the open delivery, and delivery completion removed it from open work.
- Next proposed task: `ACCOUNTING-DOCUMENTS-NAV-001`.

## ACCOUNTING-SALES-DOCUMENTS-001 Closeout

- `ACCOUNTING-SALES-DOCUMENTS-001` is COMPLETE / STABLE. Phoenix now has persistent operational receipts with annual progressive numbering, at most one issued receipt per order, preserved cancelled history and cancel-then-reissue support without reusing numbers.
- Reprints use the immutable persisted receipt snapshot. The Accounting sales-document registry unifies operational receipts with canonical Billing invoices and records authenticated `viewed` and explicit `print_requested` document events.
- Accounting calculations and the existing payment/refund ledger boundaries remain unchanged.
- Staging migrations `20260908000100_accounting_sales_documents_001` and `20260908000200_accounting_sales_documents_001_receipt_select_policy` are applied and aligned. Focused validation, preview deployment and Product Owner E2E passed; receipt reopen/reprint, historical cancellation/reissue, registry state, ticket/label regressions and unchanged financial values were confirmed.
- Next approved finding only: `ORDER-FULFILLMENT-LIFECYCLE-001`. Draft logistics remain configurable but not operational for staff; logistics becomes operational from `received`; production completion means ready rather than fulfilled/closed; open pickup/delivery remains visible after production completion; and the order remains in operational custody/stock until real pickup or delivery completion.

---

## COUNTER-UX-002 Closeout

- Redesigned `/[locale]/app/shop` as a compact touch-first laundry counter: customer strip, real category navigation, service search and large service tiles on the left/centre, with a persistent readable cart and large monetary summary/payment controls on tablet and desktop plus responsive mobile stacking.
- Fast regular-customer creation remains canonical. Every `Cliente occasionale` creates its own tenant-scoped canonical customer with a distinct `WALKIN-<UUID>` code, optional phone/email and traceable order history; `orders.customer_id` remains required and no shared anonymous customer or parallel schema was added.
- Reuses authoritative tenant services, effective segment/base pricing, integer versus continuous quantities, monetary discounts, existing active till and canonical cash/manual-card payment ledger. PAY LATER creates no payment row and no fake online-payment action exists.
- The compact success state keeps PRINT-001 receipt, ticket and label actions. Owner/Manager inherit POS access; Staff still needs explicit POS capability; existing entitlement, capability and tenant gates remain authoritative.
- No COUNTER migration was needed. Local and staging history remain aligned through PRINT-owned `20260829000300_print_001_output_entitlement.sql`.
- Rollback-only staging proof passed `2 × EUR 7.50 + 1 × EUR 5.00 = EUR 20.00`, discount `EUR 2.00`, cash/card `EUR 8.00 / EUR 10.00`, paid/outstanding `EUR 18.00 / EUR 0.00`, expected cash `+EUR 8.00`; distinct walk-in `Cliente Banco Test` passed PAY LATER `EUR 10.00 / EUR 0.00 / EUR 10.00`, tenant isolation and zero fixtures.
- Final gates: COUNTER 30/30, Shop Terminal 28/28, POS 31/31, pricing 20/20, Customer Account 14/14, PRINT 25/25, lint, production build and `git diff --check` PASS. In-app browser control was unavailable, so responsive rendering remains structurally covered and subject to Product Owner visual acceptance.
- Next: `BARCODE-001`, not started. `COUNTER-BILLING-001`, Accounting, fiscal invoicing and real online-provider work were not started.

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
- COUNTER-UX-002 — Professional Dry Cleaning / Laundry Counter Register redesign
- ACCOUNTING-SALES-DOCUMENTS-001 — Persistent operational receipts and unified sales-document registry
- ORDER-FULFILLMENT-LIFECYCLE-001 — Separate production completion from customer fulfillment
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

Current accepted operator checkpoint: migration `20261004000200_data_retention_scale_001g_customer_history_scalability.sql` is applied to staging `exthnplfokcucaqydney`; no unrelated migration was applied and production was untouched. The applied checkpoint is through `20261004000200`. No additional Supabase command was run during this closeout.

Earlier verified checkpoint: Per verified staging state, local/remote migration history is aligned through `20261004000100`, including the two-index-only `20261004000100_data_retention_scale_001f_pos_payment_history_pagination.sql` on `exthnplfokcucaqydney`; production was untouched. Earlier migrations, including `20260930000100_delivery_staging_and_transit_001b.sql`, `20260930000200_pos_session_payment_boundary_001.sql`, `20260930000300_pos_refund_channel_session_boundary_001.sql`, `20260930000400_manual_external_payment_001.sql`, `20260930000500_manual_external_refund_001.sql`, the property integrity migration, Orders History index and Quick Drop queue migration remain applied. The 2026-10-01 manual-external-refund post-apply dry-run reported “Remote database is up to date” at that checkpoint; its Product Owner staging UAT passed. Earlier ACCOUNTING-SALES-DOCUMENTS-001 registry and corrective receipt SELECT migrations remain applied.

During INFRA-001-SMOKE, the corrective SQL for `app_current_organization_id()` and `create_order()` was applied manually in EcoWash Staging through SQL Editor so the smoke test could continue. INFRA-001.1 reconciled the remote migration history so local and remote now both include `20260730000100`.

Do not rerun the corrective migration. Do not use `supabase db reset --linked`, `supabase migration up`, or `supabase db push` unless a future task explicitly approves it.

SEC-001.1 added database privilege hardening, explicit authenticated RPC allowlisting, `recalculate_order_totals(uuid)` client execution revocation, table privilege reduction and active-metadata enforcement for `order-media` SELECT. SEC-001.2 verified rollback-only authenticated mutation regression with no persistent data changes.

OPS-001.2A added the minimum migration needed to allow owner/manager corrections to completed pickup and delivery logistics without reopening logistics architecture. OPS-001.3 added assignment support for production and logistics using existing role boundaries. OPS-001.4 added staff-management and invite flows using server-only Supabase Auth Admin access.

## Historical Functional State — Earlier Checkpoint

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

## Historical Resume Point — Superseded 2026-09-12 Checkpoint

There is no current SMTP delivery block. AUTH-INFRA-001 enabled Resend Custom SMTP and a real Supabase Auth email was sent and received successfully. The configured limit is 30 Auth emails/hour; endpoint-specific throttling can still apply, so access/reset actions should remain deliberate and application errors must stay user-friendly.

LOGISTICS-COMPLETED-HISTORY-001 is COMPLETE / STABLE. Completed pickup/delivery history stays separate from open queues and Mi día; do not reopen accepted history, tenant-timezone, fulfillment, receipt, Accounting or payment/refund foundations unless a reproducible defect is found.

1. Draft logistics may be configured but are not yet operational work for staff.
2. Logistics becomes operational from `received` onward.
3. Production `completed` means ready, not fulfilled or closed.
4. Open pickup/delivery remains visible after production completion.
5. The order remains in operational custody/stock until real customer pickup or delivery completion.

Open finding only, not yet implemented:

1. `RECEIPT-COMPACT-LINES-UX` — non-blocking future vertical-space optimization for long descriptions, preserving readability and print safety.

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

</details>
