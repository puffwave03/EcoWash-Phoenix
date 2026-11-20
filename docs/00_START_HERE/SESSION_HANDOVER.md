# EcoWash Phoenix — Session Handover (active)

> **Checkpoint:** 2026-11-20. B1 commit `5f597421` published to GitHub `main`; the Vercel staging deployment `dpl_Dfm9DafQFd9F9RVPkvpJHLw1PbbV` is READY at this SHA. Browser PO release sign-off and physical thermal-printer validation are still open. This short index supersedes older dated *status* statements, not historical evidence.
>
> **Source priority:** current independently verified state > latest CTO/PO accepted evidence > this handover > historical checkpoint. Historical mission prose never authorizes actions.

## 1. Responsibility and workflow

- **PO:** Cristiano — business behavior, UAT, approval. **CTO:** ChatGPT — architecture, scope, review. **Implementer:** Codex — limited implementation and tests.
- Read `AGENTS.md` and `docs/CODEX_EXECUTION_CONTEXT.md` for unchanged security, financial, environmental and Git rules. Inspect task-relevant code only; do not load entire archives automatically.
- One mission at a time. No unapproved database changes, invoice issuance, commit, push, deploy or rollback. Never discard another mission's WIP.

## 2. Git and environments — refresh before action

| Area | Latest evidenced state | Action constraint |
| --- | --- | --- |
| Last Codex local report | `main` at B1 `5f597421`, clean before release | Verify local HEAD/remote before any future work; this docs-only commit makes remote newer |
| GitHub `main` | B1 `5f597421c08e683439a512b339d542ccd642e990` verified **before this documentation commit** | Refresh exact HEAD before modifying repository |
| Supabase staging | `exthnplfokcucaqydney`, **102 migrations**, including both B1 migrations | Staging-only; protect existing data |
| Vercel staging | `ecowash-phoenix-staging`, deployment `dpl_Dfm9DafQFd9F9RVPkvpJHLw1PbbV` READY for B1 `5f597421` | Technical deploy verified; PO browser smoke not yet reported |
| Stable Toshiba | `/Volumes/DEV/Phoenix-Local-Baseline-001`, baseline `78e877f`, **100 migrations** | Protected; do not overwrite |
| Isolated B1 UAT | `/Volumes/DEV/Phoenix-B1-UAT-001`, **102 migrations** | Synthetic only; independent from stable |

- B1 staging pre-release backup: `/Volumes/DEV/Phoenix-Backups/PHOENIX-STAGING-PRE-B1-exthnplfokcucaqydney-20261120T091615233041Z`. Codex reported 32 SHA-256-verified files. Restore not tested; managed DDL, secrets and circular-FK warnings need separate restore plan.
- Staging tenants: EcoWash La Tejita and Phoenix Test Lab (shown as **Laboratorio**). Staging fiscal issuance **remains disabled**. Read-only simplified Billing presentation is limited to the approved staging test tenant.

## 3. Current mission — `POS-SINGLE-FISCAL-TICKET-001 / B1`

- **B1 scope:** one **customer-facing 80 mm layout** for unpaid operational ticket and eligible fiscal simplified invoice, plus tenant-configured logo/fallback, fiscal series, permanent footer, optional seasonal/special message and differentiated service/collection/delivery dates.
- Internal production **TICKET** is separate and unchanged. The **REC** button/route is still legacy operational receipt behavior until B2 explicitly rewires it.
- B1 commit `5f597421` covers 23 files, two migrations: `20261119184201_pos_single_ticket_settings_001.sql` and `20261119201444_b1_final_print_design_001.sql`.
- B1 local tests reported PASS, PO saw unpaid client ticket in isolated UAT, historical ticket rendering unchanged. **Physical thermal-print width, length/cutter UAT is open**.
- Staging migrations applied; Codex reported data fingerprints unchanged. GitHub push and matching Vercel READY independently verified. **Final Codex smoke-test report and PO browser acceptance not yet reported** at this checkpoint.
- Next gate: obtain Codex's B1 post-release smoke report, confirm no unintended financial writes, then CTO/PO acceptance; physical printer/cutter UAT remains open. Do not start B2 automatically.

## 4. Product contract — TICKET vs REC

- **TICKET:** internal work order for production; conspicuous pedido number, garments, services and operating notes. Never fiscal.
- **REC:** the **single customer-facing print entrypoint** to be established in B2, with the same 80 mm format in both cases:
  - **No payment:** operational, explicitly non-fiscal ticket, order ID, scheduled collection/delivery if actually available, services, totals, amount outstanding; no fiscal number, new invoice or fictional payment.
  - **Fully paid at drop-off:** create/identify order, register payment once in POS/Accounting, issue exactly one canonical **factura simplificada** when eligible, then print the fiscal REC.
  - **Paid in full at collection:** settle the **same order** through POS, then issue/print the fiscal REC; do not auto-complete delivery.
- Fiscal document numbering and immutable legal snapshot originate in **Billing**. Printing must not collect money or issue again. Network retry must resume without double charge/invoice.
- **Partial advances/refunds:** separate fiscal contract; no shortcut treating partly-paid orders as fully unpaid or fully paid.
- **Tenant design:** issuer identity, logo, custom footer and seasonal message configurable; no EcoWash hardcoding. Historical fiscal reprints must preserve original fields and media even after settings change.

## 5. Financial, authorization and legal boundaries

- Prices shown to the public **include IGIC** (Canary Islands, applicable rates including 7% examples); invoices split taxable base and IGIC rather than adding tax to public totals.
- Order ≠ confirmed payment ≠ fiscal document ≠ operational receipt. Do not duplicate payment, invoice, tax or issue numbers. Accounting reads confirmed payments/refunds, not ticket printing.
- `WALKIN-SHARED` is an internal guest anchor: display **Cliente sin identificar** only, never fabricate a recipient name, NIF or address. Ordinary invoice path remains restricted.
- Current simple Billing local synthetic UAT passed for identified/anonymous customer; this is **not authorization to issue fiscally on staging or commercial production**.
- Staff with POS capability do not automatically receive Billing Owner/Manager rights. B2 requires explicit minimum privilege boundary.
- Refund concurrency and recovery following partial success need dedicated tests before B2 acceptance.

## 6. Planned sequence (no new authorization implied)

1. **B1:** published at `5f597421`, Vercel READY; finish release smoke/PO acceptance and physical thermal-printer test.
2. **B2:** integrate Terminal/POS/Accounting/Billing with **single REC** behavior and idempotent recovery. Keep legacy issued operational receipts accessible historically; do not silently promote them to fiscal invoices.
3. **ALBARANES-B2B-001:** selectively restore/reimplement service albaran and register from preserved Git archive, then monthly ordinary invoicing. Historical work does **not** prove month-end invoicing was already delivered.
4. SaaS productization, tenant isolation/security, backups/restore tests, fiscal integration and commercial launch gates remain open.
5. `PHOENIX-DOCUMENTATION-COMPACTION-001` preserves the full old documents in `docs/99_ARCHIVE/`; archived history is not daily-read context.

## 7. Stable evidence / historical reference

- **Current source code:** repository and SQL migration history. **Current runtime state:** verify remote services, not old dated claims.
- Archive of pre-compaction `SESSION_HANDOVER.md`: `docs/99_ARCHIVE/SESSION_HANDOVER_PRE_COMPACTION_2026-11-20.md` (**archived exact original**).
- Archive of pre-compaction `Project_Status.md`: `docs/99_ARCHIVE/PROJECT_STATUS_PRE_COMPACTION_2026-11-20.md` (**archived exact original**).
- Recovery cutover: `docs/00_START_HERE/PHOENIX_RECOVERY_CUTOVER_2026-11-17.md` (historical; not live staging truth).
- The authoritative task report, original screenshots and approved Git patch must be consulted for an audit rather than inferring detailed test evidence from this summary.

## BILLING-SIMPLIFIED-UI-001 — Local UAT closeout (2026-11-19)

- Historic accepted synthetic UAT: identified order `E2EA-000001` and shared walk-in order `E2EA-000002`, each paid EUR 10.70; documents `2026-SLAB-000001` and `2026-SLAB-000002`; 80 mm reprints PASS in Toshiba local lab.
- `90283ec` implemented simplified UI/ticket; `9540721` was its documentation closeout. Local synthetic issue does not imply lawful commercial deployment.
- The full 2026-11-19 checkpoint is preserved in the immutable archive `docs/99_ARCHIVE/SESSION_HANDOVER_PRE_COMPACTION_2026-11-20.md`.