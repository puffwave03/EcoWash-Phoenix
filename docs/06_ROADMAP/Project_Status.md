# EcoWash Phoenix — Project Status (active)

> **Status checkpoint:** 2026-11-20. B1 `5f597421` is published on GitHub `main` and verified READY on Vercel staging. Final Codex smoke-test report / PO browser release acceptance and physical thermal printing remain open. Historical milestones live in immutable archives; older recovery data are not live state.
>
> This is a **concise status index**, not a replacement for `AGENTS.md`, migrations, test evidence or signed-off release reports.

## 1. Mission status at a glance

| Workstream | Status | Acceptance / next gate |
| --- | --- | --- |
| Core SaaS foundations (auth, tenants, catalog, orders, POS, payments) | Implemented in baseline, with known limits | Continue scoped regression, tenant security and productization checks |
| Simplified Billing on isolated Toshiba | **Local synthetic PO UAT PASS** | No commercial/AEAT acceptance implied |
| Simplified Billing on staging | **Read-only presentation for Laboratorio** | Issuance not enabled; do not remove gate implicitly |
| `POS-SINGLE-FISCAL-TICKET-001 / B1` | **Published** — GitHub/Vercel `5f597421`, staging 102 migrations | Codex smoke report, PO browser acceptance and physical printer test open |
| `POS-SINGLE-FISCAL-TICKET-001 / B2` | **Not started** | REC as single customer path, safe POS/Billing coordination and recovery |
| Partially paid orders / advances | **Fiscal design open** | Separate contract; avoid duplicate IGIC and incorrect finalization |
| Historic operational REC | **Implemented, non-fiscal** | Preserve historical records; design safe transition in B2 |
| Albaran service + register | **Historically built, absent from recovered baseline** | Selective rebuild from Git archive, CTO UAT |
| B2B monthly billing from albaranes | **Not implemented** | After albaranes and fiscal contract |
| VERI*FACTU/fiscal provider integration | **Research/planning** | Independent compliance/provider/launch gates |
| SaaS commercial readiness | **Not approved** | Isolation, backups/restores, security, costs, GDPR, operations, fiscal readiness |

## 2. Verified baselines and constraints

| System | Latest evidence | Notes |
| --- | --- | --- |
| Last Codex local evidence | `main`, `5f597421c08e683439a512b339d542ccd642e990` | Worktree clean before docs commit; re-fetch remote before next mission |
| GitHub | `5f597421c08e683439a512b339d542ccd642e990` | B1 deployed; a later docs-only commit will advance `main` |
| Supabase staging | Project `exthnplfokcucaqydney`; **102 migrations** | B1 migrations verified; data counts unchanged |
| Vercel staging | `ecowash-phoenix-staging`, `dpl_Dfm9DafQFd9F9RVPkvpJHLw1PbbV` READY at `5f597421` | Vercel target "production" refers to **staging project**, not customer production |
| Toshiba stable | `78e877f`, 100 migrations, local synthetic 2 simplified invoices | Do not overwrite without separate backup and scope |
| B1 isolated UAT | 102 migrations and real-auth UAT PASS | Printing physically not verified |

- B1 migration IDs: `20261119184201_pos_single_ticket_settings_001`, `20261119201444_b1_final_print_design_001`.
- B1 staging report: 2 organizations, 5 orders, 6 payments, 0 invoices, unchanged fingerprints; no accidental issuance reported.
- Demo/test organizations are not authorization for real issuance. Distinguish data staging vs local synthetic lab.

## 3. Canonical operational and fiscal contract

- **Internal TICKET:** production document, no fiscal effect.
- **Customer REC:** *one* 80 mm layout; either non-fiscal when unpaid, or persisted canonical simplified invoice when fully paid and eligible. Payment at collection settles the existing order, never creates a duplicate.
- **B1 delivers layout/settings only.** B2 must implement decision logic, permission separation, idempotent recovery and canonical issued REC. Current legacy `/print/receipt` issues a persistent operational **non-fiscal** REC and must not be silently treated as a fiscal invoice.
- Receipt display: tenant logo/fallback, commercial/legal issuer details as applicable, pedido number, truly scheduled collection/delivery, items, discounts, amounts, custom permanent footer, optional special message. Preserve fiscal snapshot/media for historical reprint.
- Payment/Accounting canonical source: confirmed POS payment and refund facts. Billing remains fiscal source of truth. No extra tax, money movement or document on printing.
- IGIC already included in public prices. `WALKIN-SHARED` may appear as **Cliente sin identificar** on eligible simplified view without fabricated tax identity.
- **Partial payments:** not covered by the fully-paid simple path. Treat advances/offsets under an approved fiscal contract; do not discard existing advances.
- **Refund vs fiscal issue concurrency:** dedicated transactional safety review required; no blanket "atomic end-to-end" guarantee where order/payment and invoice use distinct transactions.

## 4. Key workstreams and acceptance

### `POS-SINGLE-FISCAL-TICKET-001 / B1` — Release checkpoint

- One shared 80 mm customer layout for unpaid operational/fiscal simplified outputs. Production ticket unchanged.
- Tenant-configurable simplified series, permanent footer, special message and logo. Delivery/collection dates kept distinct from production readiness.
- Codex B1 evidence: 273/273 integrated checks and later 139/139 commit checks PASS; UAT checks passed with synthetic login/tenant RLS; old invoices rendered identically.
- **Open:** physical thermal printing/cutter, final Codex release smoke report, authorized PO browser staging check and formal PO/CTO B1 release closeout. Vercel READY at `5f597421` verified.
- Git commit `5f597421c08e683439a512b339d542ccd642e990`; no implicit authorization for later B2 work.

### `POS-SINGLE-FISCAL-TICKET-001 / B2` — Next functional mission

- Operator completes a single Terminal/REC action; choose approved fiscal behavior from real payment state.
- Cash/card/mixed full immediate payment: one confirmed payment set, one canonical simplified invoice, one customer REC; invoice no. and IGIC taken from Billing.
- Deferred payment: operational REC only, with outstanding balance; after pickup payment the same order transitions to eligible simplified issue and reprint.
- Never repeat charge on retry; if payment success + fiscal issue failure, display recoverable "paid / fiscal pending" state, not a second payment prompt.
- Keep staff POS capability distinct from Owner/Manager Billing permissions; define a narrow authorized fiscal-emission capability before implementation.
- Legacy operational REC history remains readable. Do not mutate immutable issued snapshots or promote an operational receipt into a fiscal document.
- Out of scope until separately approved: advances, multi-rate/unsupported tax cases, refund after fiscal issue, fiscal production enablement.

### `ALBARANES-B2B-001` — After B2

- Historical Git archive: `archive/pre-recovery-2026-11-16`. Historical commits included service albaran `3b717a3`, register `77721ad`, customer history `f718896`.
- Recovery removed these features from active main; selective reimplementation only, no wholesale cherry-pick.
- Non-fiscal albaranes identify service, items/quantities, customer and receipt/dispatch; multiple albaranes later linked to a monthly **ordinary** invoice, separated from payments to prevent double collection and double IGIC.

## 5. P0 safeguards and release gates

- One tenant cannot access another tenant's orders, customers, financial records, invoices, assets, numbering or settings. Server and SQL authorization mandatory; RLS alone is not a UI permission substitute.
- Never turn feature flags or rights on to bypass test errors. Staging issuance intentionally disabled.
- No unapproved data reset/rollback or destructive Git command; no forced push.
- Persisted fiscal documents and their legally meaningful snapshots/numbering must be immutable and reproducible.
- Backup integrity is not proof of successful restore; restore drill is separate readiness requirement.
- Physical printing, Spanish fiscal/Canary rules and possible VERI*FACTU integration need appropriate verification before any customer rollout.
- Update source docs and live status only when approved; archived history remains untouched.

## BILLING-SIMPLIFIED-UI-001 — Completed local acceptance (2026-11-19)

- Local Toshiba synthetic path **paid order → Billing draft → issued simplified invoice → 80 mm print** passed for identified and guest flows.
- Identified: `E2EA-000001`, `2026-SLAB-000001`, EUR 10.70 (EUR 0.70 IGIC included). Anonymous: `E2EA-000002`, `2026-SLAB-000002`; fiscal guest identity remains null; label is presentation-only.
- Original 2026-11-19 evidence is preserved in `docs/99_ARCHIVE/PROJECT_STATUS_PRE_COMPACTION_2026-11-20.md`.

## 6. References and history preservation

- Operational restart: `docs/00_START_HERE/SESSION_HANDOVER.md`; policy: `AGENTS.md` + `docs/CODEX_EXECUTION_CONTEXT.md`.
- Immutable full originals have been archived byte-for-byte:
  - `docs/99_ARCHIVE/SESSION_HANDOVER_PRE_COMPACTION_2026-11-20.md`
  - `docs/99_ARCHIVE/PROJECT_STATUS_PRE_COMPACTION_2026-11-20.md`
- Previous 2026-11-17 recovery facts and old dates are **historical**, not the live 2026-11-20 state. See `docs/00_START_HERE/PHOENIX_RECOVERY_CUTOVER_2026-11-17.md`.
- Cross-file Markdown anchors into removed historical headings must be mapped to archived originals during integration. Preserve external evidence and internal navigation before approving documentation commit.