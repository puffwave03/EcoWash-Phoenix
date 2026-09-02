# Codex Current Baseline

Status: Active

Recorded: 2026-09-02
Purpose: Short mutable product baseline for the next Codex task

Read with `docs/CODEX_EXECUTION_CONTEXT.md`. Update this file after each completed product task.

## Current Git

- Product baseline before this docs update: `5a15099` (`SEGMENTS-UX-002`).
- Latest relevant application commit: `5a15099` (`SEGMENTS-UX-002`).
- Previous completed product documentation commit: `af0f32e` (`DOCS-TERMINAL-SEGMENT-CATALOG-001`); this document's new commit SHA belongs in the final report because a commit cannot self-record its final hash.
- Latest migration: `20260902000100_terminal_segment_catalog_001.sql`.
- Linked migration history is aligned through `20260902000100`.
- ACCOUNTING-001A status: `READY`.
- ACCOUNTING-001B status: `READY`.
- ACCOUNTING-001C status: `READY`; no new migration was required.
- CATALOG-STRUCTURE-001.1 status: `READY`; no new migration was required.
- CATALOG-MEDIA-FIX-001 status: `READY`; no new migration was required.
- TERMINAL-UX-004 status: `READY`; no new migration was required.
- TERMINAL-I18N-FIX-001 status: `READY`; no new migration was required.
- TERMINAL-UX-005 status: `READY`; no new migration was required.
- TERMINAL-UX-006 status: `READY`; no new migration was required.
- CATALOG-PRODUCTIZATION-001 status: `READY`; additive migration `20260901000100_catalog_productization_001_multilingual_catalog.sql` is applied and aligned.
- SEGMENTS-UX-001 status: `READY`; no migration was required and segment domain semantics are unchanged.
- TERMINAL-SEGMENT-CATALOG-001 status: `READY`; additive RPC migration `20260902000100_terminal_segment_catalog_001.sql` is applied and aligned.
- SEGMENTS-UX-002 status: `READY`; no migration was required and segment relationships, pricing and customer assignments are unchanged.

## Completed Major Modules

| Module | Current status |
| --- | --- |
| Public Site | Multilingual IT/EN/ES/FR/DE site is release-ready; deployment/domain decision remains deferred. |
| Authentication / Context Switching | Auth recovery and protected routing complete; Platform Admin and tenant contexts switch without merging their authorization models. |
| Customer Portal | Secure portal, account access, order history and customer order request/pickup foundation complete. |
| Catalog | Canonical tenant service/category administration is exposed at `/[locale]/app/settings/catalog`. Owner/Manager can manage stable-keyed families and services, optional IT/ES/EN/FR/DE presentation, locale-aware A-Z/Z-A or manual ordering, safe archive/reactivation and preview-confirmed UTF-8 CSV exchange without changing identity, pricing, segment/media relationships or historical snapshots. Terminal and Portal resolve the same localized presentation and canonical media paths. |
| Catalog Segments | Tenant customer segment catalog visibility/orderability is complete and directly discoverable from Settings. Management uses compact one-at-a-time segment editors, active/inactive quick navigation, on-demand creation and searchable locale-presented category/service selectors with safe batch selection. The expanded editor keeps its single save action sticky above mobile navigation. |
| Segment Pricing | Central effective resolver supports segment override with organization/location base fallback and historical snapshots. |
| Customer Account | Canonical order/payment-derived financial account complete. |
| Customer Lifecycle | Safe activation/deactivation lifecycle and dependent-access behavior complete. |
| Billing / COUNTER-BILLING-001 | Canonical full-invoice foundation and customer billing views complete; completed counter orders now open a preselected invoice flow, with tenant issuer autofill and missing-only customer fiscal completion. This is not an e-invoice or simplified-invoice compliance claim. |
| Entitlements | Central feature catalog and tenant entitlement enforcement complete. |
| Platform Admin | Separate SaaS administration context with audited controls complete. |
| POS | Till sessions, cash/manual-card payments, refunds and reconciliation complete on the canonical ledger. |
| Online Payments Foundation | Provider-neutral attempts, checkout/webhook boundary and reconciliation protection complete; real provider configuration is still required. |
| Shop Terminal / COUNTER-BILLING-001 | Professional tablet/desktop register complete over canonical customers, catalog, pricing, orders, POS and payments. Selecting a customer with an active catalog segment restricts the Terminal to its explicit service set and optional category intersection, while unsegmented/inactive-segment customers retain the general catalog. The compact register shows the active list name and keeps canonical pricing, cart, PRINT and invoice behavior. |
| Quick Drop | Canonical received-order intake supports regular and distinct walk-in customers without initial items or financial rows. Pending-detail orders expose the stable order QR and internal ticket immediately, remain blocked from production, and reuse the same order plus canonical pricing when detailed later. |
| Printing / Printer Configuration | Receipt, internal ticket and label-ready browser previews complete behind printing entitlement and POS capability; Owner/Manager printer profiles and per-location purpose defaults configure the existing PRINT renderer. Entitled tickets and labels now include stable scannable Phoenix QR references. |
| Barcode / QR | Shop Terminal resolves versioned order and label QR references to canonical tenant orders. Discrete labels identify order + line + 1-based unit; continuous lines use one label with unit index `0`. This is identifier-only V1, not garment lifecycle tracking. |
| Settings / UX-POLISH-001 | Authenticated low-frequency configuration is grouped under one role/entitlement-aware Settings hub: Company, Appearance & Portal, Operations, and People & Access. Daily navigation remains focused on operational work. |
| Accounting / ACCOUNTING-001A+B+C | Operational Accounting is available at `/[locale]/app/accounting`. Currency-separated canonical summaries cover net sales, collections, refunds, outstanding balances, expenses and operational result without invoice double-counting. Period/location filters, activity views, payment/expense breakdowns, tenant-scoped supplier/category/expense management and UTF-8 CSV exports complete the operational workspace. |

## Current Important Configuration

- `payments.online` foundation exists, but no real online payment provider or merchant credentials are configured.
- EcoWash `payments.online` is currently OFF; status remains `PROVIDER CONFIGURATION REQUIRED`.
- EcoWash Shop Terminal is enabled by the applied `20260829000200_shop_terminal_001_counter_experience.sql` reference bootstrap.
- EcoWash Printing is enabled by the applied `20260829000300_print_001_output_entitlement.sql` bootstrap.
- EcoWash Barcode is enabled by the additive `20260829000500_barcode_001_reference_entitlement.sql` reference bootstrap; it adds no barcode tables or historical data mutations.
- Walk-ins use distinct canonical tenant-scoped customer records with `WALKIN-<UUID>` codes; no shared anonymous history exists.
- Quick Drop creates a canonical `received` order with `order_status_history.metadata.source = "quick_drop"`. Zero active items means explicit `pending_detail` / unpriced state; no fake line, price, payment or invoice is created.
- Quick Drop returns the stable `PHX1:O:<order UUID>` reference immediately and permits the internal order ticket only. Item labels remain unavailable until canonical items exist.
- Quick Drop remains available only for a selected canonical customer with a location from the active Terminal session. A missing location keeps the action safely disabled and now exposes a concise localized accessible explanation; intake semantics are unchanged.
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
- Each tenant service/category keeps one canonical identity with optional IT/ES/EN/FR/DE presentation. Display fallback is requested locale, then EN, then canonical service/category text; no machine translation or duplicate localized service records are created.
- Existing tenants retain manual catalog ordering. Future organizations default to locale-aware A-Z; tenants can choose A-Z, Z-A or manual order without changing stable service/category identity.
- Catalog CSV export/import is UTF-8 and Owner/Manager-only. Import requires a non-mutating preview followed by explicit confirmation and atomic server reconciliation by tenant-scoped service UUID/code. Missing rows, blank translations and blank media references are non-destructive; price fields are intentionally excluded.
- Customer Segments remains at `/[locale]/app/settings/catalog/segments` and is linked directly from Settings when the existing entitlement permits it. Category and service labels/search follow the active locale through the shared catalog presentation fallback, while stable keys and IDs remain unchanged. Compact cards summarize category/service counts and active/Portal status; only the expanded editor exposes one sticky, pending-aware save action above the mobile navigation. Filtering and batch selection preserve the established eligibility, assignment, pricing and tenant-isolation semantics.
- Shop Terminal resolves catalog eligibility from the selected tenant customer server-side. Active segments can only restrict explicit segment-service links and optional selected categories; they cannot revive inactive/location-ineligible services. Submission reuses the same predicate, so manipulated out-of-segment items are rejected, while segment/base/location price precedence remains unchanged.
- Service display names remain canonical in `services.name`. Renames propagate to live Catalog, Terminal, Portal and new-order selection; new order lines snapshot the renamed value while existing order and invoice descriptions remain unchanged.
- Category keys remain stable identities while editable titles drive current Catalog, Terminal and Portal presentation. Category order uses the existing `portal_sort_order`; archiving is blocked while active services remain assigned.
- Service retirement is archive-only V1: `is_active`, Portal visibility and customer orderability are disabled together, while UUID, code, prices, segment/media links and historical order/invoice snapshots remain intact.
- Catalog family management uses explicit create/rename, accessible up/down ordering, safe archive blocking and an archived-family toggle. It reuses `20260830000100_catalog_structure_001_category_lifecycle.sql`; CATALOG-STRUCTURE-001.1 adds no migration.
- Service images accept signature-validated JPEG, PNG and WebP files up to 2 MB in tenant-scoped `brand-media` paths. Editing without a file preserves the current path; replacement cleans the previous managed object after a successful save, while explicit removal alone clears it. Catalog admin, Shop Terminal and Customer Portal resolve and render the same canonical path with safe visual fallbacks.
- Shop Terminal keeps customer/walk-in switching and scanner/search access in a compact responsive band. Service families use touch-friendly scrollable chips; service cards use a dense 2/3/4-column responsive grid with unchanged `h-28 / sm:h-32` canonical media previews or the shared neutral fallback. Terminal previews conservatively contain and center both icon-style assets and photos without cropping. Compact text spacing keeps names two-line bounded and prices/actions aligned while fitting more services vertically. Desktop retains the established approximately two-thirds catalog and one-third sticky cart split.
- Shop Terminal family labels at `/[locale]/app/shop` follow the active route locale for known system keys. Stable category keys remain the filtering identity; custom tenant-entered titles remain canonical and are never auto-translated, with a human-readable fallback when neither localized nor canonical display text is available.
- Accounting sales and collection summaries read canonical orders, payments and POS sessions only; invoices remain documents and provider attempts remain non-canonical until confirmed payment settlement.
- Expenses are a separate tenant/location-scoped domain. Gross amount is authoritative; tax is optional metadata, supplier payment state is metadata rather than a customer-ledger entry, posted expenses are immutable and voiding preserves history.
- Accounting period presets cover today, this week, this month, previous month and custom dates in the organization timezone, with an optional tenant location filter. Sales/collections and expenses exports reuse the same scoped workspace semantics and mitigate CSV formula injection.
- Accounting is operational reporting only. It is not certified statutory accounting, a general ledger, double-entry bookkeeping, tax filing or fiscal compliance.

## Current Known Product Boundaries

- No real online-provider settlement is configured or claimed.
- No garment-instance lifecycle, barcode scan-event history or inventory tracking is claimed; BARCODE-001 identifies canonical orders and order-line units only.
- No general ledger, double-entry bookkeeping, bank reconciliation, statutory accounting or tax filing is claimed.
- No e-invoice or fiscal-compliance claim yet.
- No Spanish simplified-invoice document type or legal regime is implemented; operational receipts must not be represented as fiscal or simplified invoices.
- No raw card-data handling, printer driver, silent printing or hardware-status integration.
- No permanent service/category deletion UI is exposed; lifecycle archival is the safe policy while canonical dependencies exist.

## Next Approved Task

`PILOT / USER ACCEPTANCE TEST`.

## Near Future — Not Started by This Task

- `E-INVOICE-001`
- Real online payment provider integration
- `QA-HARNESS-001` if still useful

## QA Structure

- Module contract tests: `tests/*.test.mjs`.
- Database migrations and authoritative SQL behavior: `supabase/migrations/`.
- Linked database E2E uses deterministic task-local SQL with rollback/cleanup and zero persistent fixtures.
- CATALOG-STRUCTURE-001 rollback proof covered `Tintoria` → `Tintoreria`, category order change, service move in/out, safe category/service archive, Terminal/Portal absence, Owner/Staff and cross-tenant enforcement, unchanged UUID/code/price/segment/image relations and immutable order/invoice descriptions; fixture counts returned to zero.
- ACCOUNTING-001B rollback proof reconciled EUR 2,100 of posted expenses exactly: Rent 1,200, Energy 500, Laundry products 300 and Maintenance 100; Supplier A totaled 300, Manager access passed, Staff/cross-tenant access was denied and all fixtures rolled back to zero.
- CATALOG-MEDIA-FIX-001 linked proof uploaded and reloaded a controlled service image, preserved it through an edit without a file, replaced it, retained service UUID/code and pricing, restored the original path and removed both temporary storage objects.
- ACCOUNTING-001C linked rollback proof reconciled EUR 1,000 net sales, EUR 800 gross collected (EUR 300 cash + EUR 500 card), EUR 50 refunds, EUR 750 net collected, EUR 200 outstanding, EUR 600 posted expenses and EUR 400 operational result. It used canonical POS payment/refund RPCs and left zero fixtures.
- CATALOG-PRODUCTIZATION-001 linked rollback proof updated a controlled existing service presentation, created and archived a controlled service, exercised non-destructive missing-row behavior, and confirmed unchanged UUID/code/unit/media, pricing, segment relations and order/invoice snapshots. The additive migration aligned locally/remotely and `persisted_fixture_count` returned `0`.
- TERMINAL-SEGMENT-CATALOG-001 linked rollback proof confirmed explicit service/category restriction, unchanged effective pricing, general-catalog fallback for no/inactive segment and rejection of manipulated out-of-segment submission; `persisted_fixture_count` returned `0`.
- Future recommendation: `QA-HARNESS-001` — share tenant-auth, rollback cleanup and canonical ledger assertion helpers to reduce repeated setup; do not implement without a separate approved task.
