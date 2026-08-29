# Codex Current Baseline

Status: Active

Recorded: 2026-08-29
Purpose: Short mutable product baseline for the next Codex task

Read with `docs/CODEX_EXECUTION_CONTEXT.md`. Update this file after each completed product task.

## Current Git

- Product baseline on `main` before the docs-only CODEX-PROTOCOL-001 commit: `ae01658` (`DOCS-COUNTER-UX-002`).
- Latest relevant application commit: `6691e95` (`COUNTER-UX-002`).
- Latest completed product documentation commit: `ae01658` (`DOCS-COUNTER-UX-002`).
- Latest migration: `20260829000300_print_001_output_entitlement.sql`.
- At protocol start: `main == origin/main` and working tree clean.
- CODEX-PROTOCOL-001 must finish with `main == origin/main` and working tree clean; its own commit SHA belongs in the final report because a commit cannot self-record its final hash.

## Completed Major Modules

| Module | Current status |
| --- | --- |
| Public Site | Multilingual IT/EN/ES/FR/DE site is release-ready; deployment/domain decision remains deferred. |
| Authentication / Context Switching | Auth recovery and protected routing complete; Platform Admin and tenant contexts switch without merging their authorization models. |
| Customer Portal | Secure portal, account access, order history and customer order request/pickup foundation complete. |
| Catalog | Canonical tenant service/catalog administration complete. |
| Catalog Segments | Tenant customer segment catalog visibility/orderability complete. |
| Segment Pricing | Central effective resolver supports segment override with organization/location base fallback and historical snapshots. |
| Customer Account | Canonical order/payment-derived financial account complete. |
| Customer Lifecycle | Safe activation/deactivation lifecycle and dependent-access behavior complete. |
| Billing | Invoice foundation and customer billing views complete; this is not a fiscal/e-invoice compliance claim. |
| Entitlements | Central feature catalog and tenant entitlement enforcement complete. |
| Platform Admin | Separate SaaS administration context with audited controls complete. |
| POS | Till sessions, cash/manual-card payments, refunds and reconciliation complete on the canonical ledger. |
| Online Payments Foundation | Provider-neutral attempts, checkout/webhook boundary and reconciliation protection complete; real provider configuration is still required. |
| Shop Terminal / COUNTER-UX-002 | Touch-first counter register complete over canonical customers, catalog, pricing, orders, POS and payments. |
| Printing | Receipt, internal ticket and label-ready browser previews complete behind printing entitlement and POS capability. |

## Current Important Configuration

- `payments.online` foundation exists, but no real online payment provider or merchant credentials are configured.
- EcoWash `payments.online` is currently OFF; status remains `PROVIDER CONFIGURATION REQUIRED`.
- EcoWash Shop Terminal is enabled by the applied `20260829000200_shop_terminal_001_counter_experience.sql` reference bootstrap.
- EcoWash Printing is enabled by the applied `20260829000300_print_001_output_entitlement.sql` bootstrap.
- Walk-ins use distinct canonical tenant-scoped customer records with `WALKIN-<UUID>` codes; no shared anonymous history exists.
- Shop Terminal reuses a valid active till and canonical cash/manual-card payments; PAY LATER writes no fake payment.
- Printed customer receipts are operational and explicitly non-fiscal. Printing does not create orders or payments.
- System UI locales are IT, EN, ES, FR and DE; tenant-entered catalog/service text is not auto-translated.

## Current Known Product Boundaries

- No real online-provider settlement is configured or claimed.
- No Barcode workflow yet.
- No Quick Drop workflow yet.
- No full Accounting module yet.
- No e-invoice or fiscal-compliance claim yet.
- No raw card-data handling or printer-hardware integration.

## Next Approved Task

`COUNTER-BILLING-001`

This immediate execution priority supersedes older broad-document “Next Action” references until the next relevant documentation sync. Do not implement it during CODEX-PROTOCOL-001.

## Near Future — Not Started by This Task

- `UX-POLISH-001`
- `BARCODE-001`
- `QUICK-DROP-001`
- `ACCOUNTING-001`
- `E-INVOICE-001`

## QA Structure

- Module contract tests: `tests/*.test.mjs`.
- Database migrations and authoritative SQL behavior: `supabase/migrations/`.
- Linked database E2E uses deterministic task-local SQL with rollback/cleanup and zero persistent fixtures.
- Future recommendation: `QA-HARNESS-001` — share tenant-auth, rollback cleanup and canonical ledger assertion helpers to reduce repeated setup; do not implement without a separate approved task.
