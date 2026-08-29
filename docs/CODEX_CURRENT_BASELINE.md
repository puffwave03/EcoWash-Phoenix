# Codex Current Baseline

Status: Active

Recorded: 2026-08-29
Purpose: Short mutable product baseline for the next Codex task

Read with `docs/CODEX_EXECUTION_CONTEXT.md`. Update this file after each completed product task.

## Current Git

- Product baseline on `main` before this docs update: `85c72fa` (`UX-POLISH-001`).
- Latest relevant application commit: `85c72fa` (`UX-POLISH-001`).
- Previous completed product documentation commit: `54698cf` (`DOCS-COUNTER-BILLING-001`); this document's new commit SHA belongs in the final report because a commit cannot self-record its final hash.
- Latest migration: `20260829000400_counter_ui_003_printer_profiles.sql`.
- At UX-POLISH-001 application completion: `main == origin/main` and working tree clean.

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
| Billing / COUNTER-BILLING-001 | Canonical full-invoice foundation and customer billing views complete; completed counter orders now open a preselected invoice flow, with tenant issuer autofill and missing-only customer fiscal completion. This is not an e-invoice or simplified-invoice compliance claim. |
| Entitlements | Central feature catalog and tenant entitlement enforcement complete. |
| Platform Admin | Separate SaaS administration context with audited controls complete. |
| POS | Till sessions, cash/manual-card payments, refunds and reconciliation complete on the canonical ledger. |
| Online Payments Foundation | Provider-neutral attempts, checkout/webhook boundary and reconciliation protection complete; real provider configuration is still required. |
| Shop Terminal / COUNTER-BILLING-001 | Professional tablet/desktop register complete over canonical customers, catalog, pricing, orders, POS and payments; its success state exposes PRINT actions and an entitled Owner/Manager full-invoice action using the completed order/customer context. |
| Printing / Printer Configuration | Receipt, internal ticket and label-ready browser previews complete behind printing entitlement and POS capability; Owner/Manager printer profiles and per-location purpose defaults now configure the existing PRINT renderer. |
| Settings / UX-POLISH-001 | Authenticated low-frequency configuration is grouped under one role/entitlement-aware Settings hub: Company, Appearance & Portal, Operations, and People & Access. Daily navigation remains focused on operational work. |

## Current Important Configuration

- `payments.online` foundation exists, but no real online payment provider or merchant credentials are configured.
- EcoWash `payments.online` is currently OFF; status remains `PROVIDER CONFIGURATION REQUIRED`.
- EcoWash Shop Terminal is enabled by the applied `20260829000200_shop_terminal_001_counter_experience.sql` reference bootstrap.
- EcoWash Printing is enabled by the applied `20260829000300_print_001_output_entitlement.sql` bootstrap.
- Walk-ins use distinct canonical tenant-scoped customer records with `WALKIN-<UUID>` codes; no shared anonymous history exists.
- Shop Terminal reuses a valid active till and canonical cash/manual-card payments; PAY LATER writes no fake payment.
- Printed customer receipts are operational and explicitly non-fiscal. Printing does not create orders or payments.
- Printer profiles are tenant/location scoped and support receipt, label and optional ticket purposes; each location has at most one default per purpose.
- Browser print is the only functional transport. Network, local-bridge and future-adapter profile modes remain honest configuration boundaries and fall back to the browser print dialog.
- Receipt profiles support 58 mm, 80 mm and browser/PDF layouts; label profiles support custom width, height, orientation, copies, margins and gap.
- Billing issuer setup derives from the authenticated tenant only. Existing tenant name and branding commercial/address/support values are editable suggestions; an Owner must confirm and persist legal identity once before issue.
- Configured issuer identity is compact/collapsible. Incomplete configuration identifies the exact persisted legal fields still requiring Owner confirmation.
- Brand/Portal, Customer catalog, printer profiles and Staff & Access keep their existing guarded routes but are discovered through Settings instead of separate daily-navigation entries.
- Customer Account order/payment/property histories and order status/payment histories reuse one accessible disclosure control. Lists longer than three entries collapse by default; current balances, statuses, actions and short histories remain visible.
- Full invoices reuse canonical counter orders, line snapshots, discounts and payment truth. Regular and walk-in customers are prompted only for fields missing from the current Billing issue model.
- Walk-in operational receipts require no fiscal identity. Requesting a full invoice updates the same canonical customer and reuses the same order; PAY LATER outstanding value remains unchanged.
- System UI locales are IT, EN, ES, FR and DE; tenant-entered catalog/service text is not auto-translated.

## Current Known Product Boundaries

- No real online-provider settlement is configured or claimed.
- No Barcode workflow yet.
- No Quick Drop workflow yet.
- No full Accounting module yet.
- No e-invoice or fiscal-compliance claim yet.
- No Spanish simplified-invoice document type or legal regime is implemented; operational receipts must not be represented as fiscal or simplified invoices.
- No raw card-data handling, printer driver, silent printing or hardware-status integration.

## Next Approved Task

`BARCODE-001`

## Near Future — Not Started by This Task

- `QUICK-DROP-001`
- `ACCOUNTING-001`
- `E-INVOICE-001`

## QA Structure

- Module contract tests: `tests/*.test.mjs`.
- Database migrations and authoritative SQL behavior: `supabase/migrations/`.
- Linked database E2E uses deterministic task-local SQL with rollback/cleanup and zero persistent fixtures.
- Future recommendation: `QA-HARNESS-001` — share tenant-auth, rollback cleanup and canonical ledger assertion helpers to reduce repeated setup; do not implement without a separate approved task.
