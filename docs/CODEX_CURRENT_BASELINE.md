# Codex Current Baseline

Status: Active

Recorded: 2026-08-30
Purpose: Short mutable product baseline for the next Codex task

Read with `docs/CODEX_EXECUTION_CONTEXT.md`. Update this file after each completed product task.

## Current Git

- Product baseline before this docs update: `9897d6b` (`CATALOG-NAMING-001`).
- Latest relevant application commit: `9897d6b` (`CATALOG-NAMING-001`).
- Previous completed product documentation commit: `236adee` (`DOCS-QUICK-DROP-001`); this document's new commit SHA belongs in the final report because a commit cannot self-record its final hash.
- Latest migration: `20260829000600_quick_drop_001a_canonical_intake.sql`.
- QUICK-DROP-001 linked migration history is aligned through `20260829000600`.

## Completed Major Modules

| Module | Current status |
| --- | --- |
| Public Site | Multilingual IT/EN/ES/FR/DE site is release-ready; deployment/domain decision remains deferred. |
| Authentication / Context Switching | Auth recovery and protected routing complete; Platform Admin and tenant contexts switch without merging their authorization models. |
| Customer Portal | Secure portal, account access, order history and customer order request/pickup foundation complete. |
| Catalog | Canonical tenant service/catalog administration complete. Owner/Manager can safely rename the current service display name without changing service identity, pricing, segment/media relationships or historical snapshots. |
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
| Quick Drop | Canonical received-order intake supports regular and distinct walk-in customers without initial items or financial rows. Pending-detail orders expose the stable order QR and internal ticket immediately, remain blocked from production, and reuse the same order plus canonical pricing when detailed later. |
| Printing / Printer Configuration | Receipt, internal ticket and label-ready browser previews complete behind printing entitlement and POS capability; Owner/Manager printer profiles and per-location purpose defaults configure the existing PRINT renderer. Entitled tickets and labels now include stable scannable Phoenix QR references. |
| Barcode / QR | Shop Terminal resolves versioned order and label QR references to canonical tenant orders. Discrete labels identify order + line + 1-based unit; continuous lines use one label with unit index `0`. This is identifier-only V1, not garment lifecycle tracking. |
| Settings / UX-POLISH-001 | Authenticated low-frequency configuration is grouped under one role/entitlement-aware Settings hub: Company, Appearance & Portal, Operations, and People & Access. Daily navigation remains focused on operational work. |

## Current Important Configuration

- `payments.online` foundation exists, but no real online payment provider or merchant credentials are configured.
- EcoWash `payments.online` is currently OFF; status remains `PROVIDER CONFIGURATION REQUIRED`.
- EcoWash Shop Terminal is enabled by the applied `20260829000200_shop_terminal_001_counter_experience.sql` reference bootstrap.
- EcoWash Printing is enabled by the applied `20260829000300_print_001_output_entitlement.sql` bootstrap.
- EcoWash Barcode is enabled by the additive `20260829000500_barcode_001_reference_entitlement.sql` reference bootstrap; it adds no barcode tables or historical data mutations.
- Walk-ins use distinct canonical tenant-scoped customer records with `WALKIN-<UUID>` codes; no shared anonymous history exists.
- Quick Drop creates a canonical `received` order with `order_status_history.metadata.source = "quick_drop"`. Zero active items means explicit `pending_detail` / unpriced state; no fake line, price, payment or invoice is created.
- Quick Drop returns the stable `PHX1:O:<order UUID>` reference immediately and permits the internal order ticket only. Item labels remain unavailable until canonical items exist.
- Pending Quick Drops are discoverable in the Shop Terminal. Adding items details the same order, activates canonical pricing and then permits normal production transitions; idempotency prevents duplicate physical intake records.
- Shop Terminal reuses a valid active till and canonical cash/manual-card payments; PAY LATER writes no fake payment.
- Printed customer receipts are operational and explicitly non-fiscal. Printing does not create orders or payments.
- Printer profiles are tenant/location scoped and support receipt, label and optional ticket purposes; each location has at most one default per purpose.
- Browser print is the only functional transport. Network, local-bridge and future-adapter profile modes remain honest configuration boundaries and fall back to the browser print dialog.
- Receipt profiles support 58 mm, 80 mm and browser/PDF layouts; label profiles support custom width, height, orientation, copies, margins and gap.
- BARCODE-001 uses QR with medium error correction and a four-module quiet zone. Payloads are locale-independent opaque references: `PHX1:O:<order UUID>` and `PHX1:L:<order UUID>:<order-item UUID>:<unit index>`.
- Scanned codes are identifiers, never authorization tokens. Resolution rechecks authenticated Shop Terminal/POS access, barcode entitlement, tenant-owned order existence and canonical active item/unit semantics; cross-tenant references return the same safe not-found result.
- Common USB/Bluetooth keyboard-wedge scanners work through the compact Terminal form and Enter submission; manual type/paste is the V1 fallback. No camera or proprietary scanner SDK is required.
- Billing issuer setup derives from the authenticated tenant only. Existing tenant name and branding commercial/address/support values are editable suggestions; an Owner must confirm and persist legal identity once before issue.
- Configured issuer identity is compact/collapsible. Incomplete configuration identifies the exact persisted legal fields still requiring Owner confirmation.
- Brand/Portal, Customer catalog, printer profiles and Staff & Access keep their existing guarded routes but are discovered through Settings instead of separate daily-navigation entries.
- Customer Account order/payment/property histories and order status/payment histories reuse one accessible disclosure control. Lists longer than three entries collapse by default; current balances, statuses, actions and short histories remain visible.
- Full invoices reuse canonical counter orders, line snapshots, discounts and payment truth. Regular and walk-in customers are prompted only for fields missing from the current Billing issue model.
- Walk-in operational receipts require no fiscal identity. Requesting a full invoice updates the same canonical customer and reuses the same order; PAY LATER outstanding value remains unchanged.
- System UI locales are IT, EN, ES, FR and DE; tenant-entered catalog/service text is not auto-translated.
- Service display names remain canonical in `services.name`. Renames propagate to live Catalog, Terminal, Portal and new-order selection; new order lines snapshot the renamed value while existing order and invoice descriptions remain unchanged.

## Current Known Product Boundaries

- No real online-provider settlement is configured or claimed.
- No garment-instance lifecycle, barcode scan-event history or inventory tracking is claimed; BARCODE-001 identifies canonical orders and order-line units only.
- No full Accounting module yet.
- No e-invoice or fiscal-compliance claim yet.
- No Spanish simplified-invoice document type or legal regime is implemented; operational receipts must not be represented as fiscal or simplified invoices.
- No raw card-data handling, printer driver, silent printing or hardware-status integration.

## Next Approved Task

`ACCOUNTING-001`

## Near Future — Not Started by This Task

- `E-INVOICE-001`
- Real online payment provider integration
- `QA-HARNESS-001` if still useful

## QA Structure

- Module contract tests: `tests/*.test.mjs`.
- Database migrations and authoritative SQL behavior: `supabase/migrations/`.
- Linked database E2E uses deterministic task-local SQL with rollback/cleanup and zero persistent fixtures.
- Future recommendation: `QA-HARNESS-001` — share tenant-auth, rollback cleanup and canonical ledger assertion helpers to reduce repeated setup; do not implement without a separate approved task.
