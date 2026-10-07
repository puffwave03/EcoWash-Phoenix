# Project Status

Status: Active

Version: 0.1

Last Updated: 2026-10-07

Current Mission: No active implementation mission

Next Action: Implement `BILLING-TAX-INCLUSIVE-PRICING-001` — **OPEN / BLOCKING BEFORE SAAS PRODUCTIZATION**. Current Catalog/Order/POS prices and Order totals are final customer-facing amounts with tax included. Legacy Billing adds tax on top: `6.00 EUR @ 7%` currently becomes `6.42 EUR`; required decomposition is taxable base `5.61`, included tax `0.39`, invoice total `6.00`, paid `6.00`, outstanding `0.00`. SaaS Productization Baseline follows that task and includes Catalog CSV completeness/500-service boundary and the Accounting 100-location selector. `ACCOUNTANT-EXPORT-PRESENTATION-UX` remains deferred/non-blocking; `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` remains monitored only. Supabase Pro and AUTH-DR-001C remain deferred hard pre-production gates; Phoenix is not public-production ready.

**Auth DR decision (2026-10-06):** AUTH-DR-001B3 **CLOSED / PASS**; AUTH-DR-001B4 **COMPLETE / PASS**. The Product Owner/CTO deferred the Supabase Pro upgrade because current staging is a pilot/test tenant rather than the near-final real production state. AUTH-DR-001C is **DEFERRED UNTIL PRE-PRODUCTION** and remains a **HARD PRE-PRODUCTION / RELEASE GATE**, requiring a completed eligible physical backup and an isolated authenticated recovery rehearsal. Encrypted off-device custody remains a separate pre-production finding.

---

## Purpose

Track the current development state of EcoWash Phoenix and provide the handover context required to resume work safely.

---

## Contents

## Authoritative Current Status — 2026-10-07

| Area | Current state |
| --- | --- |
| Repository | `main` and `origin/main` aligned at selector functional commit `f92e0f5b67c9cc87752fafd0c713dd55286a9143` before this documentation closeout; working tree clean. |
| Billing eligible Order selector | `BILLING-ELIGIBLE-ORDER-SELECTOR-001` (`f92e0f5b67c9cc87752fafd0c713dd55286a9143`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. Read-only RPC applies canonical tenant/Order/customer/invoice-link eligibility and search before the final bound; `created_at DESC, id DESC` yields 100 visible Orders plus a 101st `hasMore` sentinel. Exact old `orderId` resolution and inactive-customer warning remain. Migration `20261007000100_billing_eligible_order_selector_001.sql` is applied only to Supabase staging `exthnplfokcucaqydney`, with local/remote history aligned through `20261007000100`; Vercel staging `dpl_CdbLFUsoo9rZPhHhyNn58ot3d75y` is READY. Owner UAT passed. No Billing mutation/payment/fiscal semantics changed and public production was untouched. |
| Billing tax-inclusive pricing | `BILLING-TAX-INCLUSIVE-PRICING-001` — **OPEN / BLOCKING BEFORE SAAS PRODUCTIZATION**. Product Owner UAT found legacy additive Billing arithmetic: a paid `6.00 EUR` Order at `7%` yielded invoice `6.42` and outstanding `0.42`. Current Phoenix commercial prices are final tax-inclusive amounts; the required result is base `5.61`, included tax `0.39`, invoice total `6.00`, paid `6.00`, outstanding `0.00`. This is a separate next mission; no tax/fiscal implementation occurred in selector closeout. |
| Customer Portal validation | `PORTAL-ORDER-VALIDATION-SUMMARY-001` (`c726182074c82cf85c8326548b51f34f1eb2ca50`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. New-order requests show an order-level validation summary with accessible focus and navigation to invalid sections; field errors resolve interactively. Existing server validation and Order semantics are unchanged. Product Owner UAT passed; canonical staging deployment `dpl_BTiUJFZDuwcRMQqGPFcDpqrdZoVC` is READY. |
| Dependency security | `DEPENDENCY-SECURITY-001` (`976b747f7f291550a605ecd1d789d0a0e70db720`) — **COMPLETE / PRODUCT OWNER UAT PASS / STAGING VERIFIED**. Direct `next` and `eslint-config-next` moved in lockstep from `16.2.11` to `16.3.8`; React/React DOM remain `19.2.8`, while Supabase, archiver and tus-js-client are unchanged and have no resolved advisory. Production `npm audit --omit=dev` is **0 critical / 0 high**. Full audit is **0 critical / 5 high packages** on only the dev/tooling `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3` chain. `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` (`GHSA-vfj7-8cjw-p6xm`) is **OPEN / MONITORED / DEV-TOOLING ONLY**, with no patched compatible release and no public-runtime exposure identified; do not claim the repository is vulnerability-free. Accountant Pack focused tests passed 6/6; domain regressions 411/411, five locale JSON files, ESLint (0 errors, two pre-existing warnings), TypeScript, `git diff --check` and Next 16.3.8 Webpack production build passed. General suite passed 1063/1069; the six static contract failures were reproduced identically on the pre-change baseline. `npm ci` succeeded and targeted graphs passed; full local `npm ls --all` retains optional cross-platform sharp WASM anomalies. Product Owner local security UAT passed homepage/images, dashboard, Orders, Accounting, existing pack download and navigation. Dedicated staging deployment `dpl_6do2bMybjgY5DeYFLVQ9cc3rEQkb` is READY on the functional commit and canonical alias; home/login, protected redirects, static/optimized local images, Cron registration and worker auth passed. Missing/wrong authorization returned 401; one registered Cron invocation returned 200. Build/runtime logs had no sharp/libvips/WASM, ZIP/TUS, Storage or Supabase errors or 500 in the smoke window. Both existing jobs remain completed; no new pack was created. Authenticated staging history/download was unavailable to the technical session and was covered by Product Owner local UAT. Public production, Supabase migrations and Docker were untouched. The prior Next runtime security blocker is removed after this staging verification; Auth DR remains a separate hard blocker for public production. |
| Async Accountant Pack | `DATA-RETENTION-AND-SCALE-001K-C` (`2d3cce6821beeadf1f9ac1c65f8f9a52b2ef9bc3`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Durable database-backed Owner/Manager jobs support request/history/private download with active deduplication, leased claims, finite retry/recovery, `after()` normal-path acceleration and secured daily Vercel Cron (`/api/internal/accountant-pack/worker`, `17 3 * * *`) for recovery/cleanup. The private `accounting-exports` bucket holds immutable ZIPs with `summary.csv`, `sales.csv`, posted-only `expenses.csv`, persisted `daily-closes.csv` and `manifest.json` with SHA-256 metrics. Organization/location isolation is server-derived. Source exports use bounded keyset traversal without arbitrary overall row caps or offset bulk traversal; CSVs stream into ZIP without full CSV RAM materialization, the final ZIP uses a bounded temporary file, and TUS upload was proven on staging with a synthetic object >6 MiB. The 450 MiB application safety ceiling fails without truncation; it is not a proven Supabase Storage maximum, and real UAT packs were far below runtime/storage thresholds. Signed private download, 14-day artifact expiry, 90-day job metadata retention and bounded cleanup keep artifact expiry separate from source/fiscal evidence retention. Generation-window semantics permit live Sales/Expenses/Summary changes during or after generation and new persisted Daily Close rows while saved snapshots remain immutable; completed ZIP bytes are immutable and regeneration may differ. The pack is accounting support material, not an immutable accounting snapshot, tax return, fiscal evidence, Modelo 420/130, IGIC/IVA calculation, VERI*FACTU, Spain B2B e-invoice, AEAT submission or fiscal book. Migration `20261005000500_data_retention_scale_001k_c_accountant_pack.sql` was already applied only to staging `exthnplfokcucaqydney` and was not reapplied. Product Owner UAT passed two real jobs, including automatic second-job completion, Ready/download and the five-file ZIP/manifest; no third pack was created. Valid PostgreSQL v4 UUID rejection and download redirect HTTP 500 were fixed in the functional commit through one shared validator and atomic redirect headers. Dedicated staging Vercel production-target deployment `dpl_ALDjEqZuhDRCwdmVy4u5VJEEEARW` is READY on the same functional commit with sensitive server-only `CRON_SECRET`; registered Cron is enabled, missing/wrong Authorization yielded 401, correct secret yielded 200 JSON, one manual Cron run succeeded, runtime logs show no 500/unhandled/Storage/Supabase error or secret leakage, and both existing jobs remain completed. Public production was untouched. |
| Quarterly accountant-support exports | `DATA-RETENTION-AND-SCALE-001K-B` (`ac0d3e88416a9204774a693aaf0a9ed437c07281`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Accounting supports Today, Week, Month, Previous Month, Quarter and Custom. Historical year plus Q1–Q4 use organization-local dates and timezone: Jan 1–Apr 1, Apr 1–Jul 1, Jul 1–Oct 1 and Oct 1–next Jan 1, with exclusive ends; invalid year/quarter inputs follow invalid-period behavior. The selected quarter or custom period offers Sales, Accountant Expenses, Period Summary and Daily Close Register CSVs, all accounting support/non-fiscal. Sales reuses 001K-A streamed 250-row keyset pages, unchanged schema, `event_date DESC, event_type ASC, event_id ASC`, `orders.created_at` for active/non-cancelled Orders, `payments.paid_at` for confirmed payments and separate refunds, excluding pending/void and undetailed Quick Drops, without currency conversion. New Accountant Expenses is posted-only, with captured document/payment fields, 250-row `expense_date ASC, id ASC` keyset pages, page-local name hydration and streaming; standalone Expenses still contains draft, posted and void. No inferred tax base, deductible tax or fiscal treatment. Period Summary iterates live canonical events in bounded pages into small per-currency state, never sums Daily Close snapshots, and preserves `collected_net = collected_gross - refunds` and `operational_result = sales_net - posted_expenses`; Online Card is not counted again as ordinary Card. Its four explicit date bases are `orders.created_at`, `payments.paid_at`, `expenses.expense_date` and `daily_closes.business_date`. Operational result is not taxable or statutory profit. Daily Close Register reads persisted snapshots only by `business_date`, one row per close, in 250-row keyset pages ordered `business_date ASC, closed_at ASC, id ASC`; it preserves organization/location scope, location, timezone, snapshot hash and schema/calculation versions, with deterministic per-currency JSON and blanks for unavailable fields. Organization-wide and location closes may coexist and must not be blindly summed. Individual close PDFs are unchanged; no bulk PDFs. All exports enforce Owner/Manager, server-derived organization and 001K-A fail-closed validation of explicit active, non-deleted, same-organization locations. Attachment, UTF-8 BOM, CSV injection protection and `Cache-Control: private, no-store` remain. Multi-row exports stream without full-period `getAccountingWorkspace()`, offset/range traversal or arbitrary total cap, reusing 001K-A/001I indexes. No migration, index, RPC, DB/schema/RLS/table/trigger/source mutation, async jobs or fiscal implementation. Product Owner UAT passed. Final 261/261 selected tests, five locale JSON checks, scoped ESLint, TypeScript, `git diff --check` and prior final Webpack build passed. Live Sales/Expenses/Summary sources may change between pages; individual Daily Close snapshots remain immutable but the register's set may change if a close is created during export. No package-wide immutable snapshot; 001K-C subsequently adopted generation-window consistency for the pack. No IGIC/IVA due or deductible amount, Modelo 420/130, taxable base, quarterly tax payable or fiscal profit is calculated. These convenience CSVs are not tax returns, filings, VERI*FACTU, B2B e-invoice or AEAT submissions, fiscal ledgers or source evidence. |
| Accounting export scalability | `DATA-RETENTION-AND-SCALE-001K-A` (`47602530b30bda1f67ff6f77ed1ff7146710fff1`) — **COMPLETE / PRODUCT OWNER UAT PASS**. Sales CSV no longer loads `getAccountingWorkspace()`; an export-specific read-only RPC supplies bounded 250-row keyset pages on `event_date, event_type, event_id`, ordered `event_date DESC, event_type ASC, event_id ASC`. Sales date is `orders.created_at`; confirmed payments and separate refunded rows use `payments.paid_at`; pending/void payments, cancelled sales and undetailed Quick Drops are excluded; currencies remain separate. Sales schema stays `date, type, order_reference, customer, location, payment_method, amount, currency`. Expenses CSV likewise avoids `getAccountingWorkspace()`, streams 250-row keyset pages ordered `expense_date ASC, id ASC` and hydrates supplier/category/location names per page; draft, posted and void remain included. Expenses schema stays `expense_date, supplier, category, description, reference, location, gross, tax_amount, tax_rate, currency, status`. Both stream incrementally without arbitrary overall row caps or offset/range traversal. Explicit locations must be active, non-deleted and owned by the authenticated organization; invalid/stale/not-owned locations fail closed, never broadening to all locations. Omitted location means all authorized locations. Organization identity is server-derived. CSV attachment disposition, UTF-8 BOM and injection protection remain; `Cache-Control: private, no-store` is explicit. Migration `20261005000400_data_retention_scale_001k_a_export_readers.sql` adds exactly `orders_org_created_id_export_idx` (`organization_id, created_at DESC, id ASC`), `payments_org_paid_id_export_idx` (`organization_id, paid_at DESC, id ASC`), `expenses_org_date_id_export_idx` (`organization_id, expense_date ASC, id ASC`) and `expenses_org_location_date_id_export_idx` (`organization_id, location_id, expense_date ASC, id ASC`), plus the read-only Sales RPC and revoke/grant statements. Applied only to staging `exthnplfokcucaqydney`; history aligned through `20261005000400`; production untouched. No tables, columns, RLS, triggers, constraints, source data, async export schema or fiscal behavior changed. Product Owner staff Owner/Manager UAT passed Accounting, Sales and Expenses downloads/content and existing workflows; the initial Portal-client access-denied was a resolved authentication-context mismatch, not an app defect. Final 152/152 tests and `git diff --check` passed; the prior Webpack build passed. Long exports can observe legitimate changes between pages: immutable fiscal-grade point-in-time snapshots are not provided. 001K-C subsequently chose generation-window consistency for the pack; exports are operational, not fiscal source evidence. |
| Fiscal-volume architecture constraint | Permanent CTO constraint: future design must support append-only/auditable fiscal histories, substantially higher fiscal record counts per transaction, long-term fiscal evidence retention, strict organization/NIF isolation and traceable archival/cold storage. The 001K-A/B readers and separate 001K-C jobs/ZIP lifecycle create no known constraint on those requirements; no fiscal implementation occurred. Generated artifacts never determine source/fiscal evidence retention. |
| Separate export findings | `ACCOUNTANT-EXPORT-PRESENTATION-UX` is **OPEN / NON-BLOCKING / DEFERRED**. Catalog CSV completeness/500-row guardrail and Accounting UI 100-location selector are absorbed into SaaS Productization. `BILLING-TAX-INCLUSIVE-PRICING-001` is the next blocking mission; SaaS Productization follows its closeout. `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` remains **OPEN / MONITORED / DEV-TOOLING ONLY**; AUTH-DR-001C remains a deferred hard pre-production gate. |
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

The 001K export scalability stream is closed. `ACCOUNTANT-EXPORT-PRESENTATION-UX` awaits separate CTO scope; `DEPENDENCY-SECURITY-RESIDUAL-BRACES-001` remains monitored. Catalog CSV completeness/500-row guardrail and the Accounting UI 100-location selector belong in SaaS Productization; `BILLING-TAX-INCLUSIVE-PRICING-001` is the next blocking mission, followed by SaaS Productization Baseline. Future fiscal export findings remain separate. Historical `order`-channel and online/provider refunds remain separate future questions. `NETWORK-FAILURE-UX-001` and the PDF technical-key cosmetic issue (only if reproducible) remain open. SaaS Productization Baseline, clean Demo Tenant onboarding and `PHX-FISCAL-001` architecture/compliance remain separately scoped later work; `PHX-FISCAL-RECTIFICATION-001` is a future requirement for invoice corrections, credit notes and adjustments. Operational receipts are non-fiscal. EcoWash La Tejita is the first tenant/reference, not hardcoded product identity. Tenant/RLS/auth boundaries remain mandatory. Auth DR and authenticated application recovery remain a public-production blocker; Phoenix is not public-production ready.

**Complete / Product Owner UAT PASS — `DELIVERY-STAGING-AND-TRANSIT-001B`:** persisted fresh-order staging rows passed the atomic transit invariant: the exact delivery reached in_progress with `started_at`, current storage was removed, and its `delivery_started` exit carried the same `delivery_id`. Delivery completion reached `completed` with no current storage; the Warehouse overview omitted the departed order. Return-to-Warehouse remains an explicit path. Warehouse movement history is historical evidence, not a claim of current storage.

**Open findings:** `BILLING-TAX-INCLUSIVE-PRICING-001` is the next blocking mission before SaaS Productization. `BILLING-ORDER-DETAIL-INVOICE-ACTION-UX` is separate/non-blocking: Order detail lacks a direct Create Invoice action, while Shop Terminal already has a bridge. Future fiscal exports, historical `order`-channel and online/provider refunds, the PDF technical-key cosmetic issue if reproducible, `NETWORK-FAILURE-UX-001`, Auth DR, `PHX-FISCAL-RECTIFICATION-001` and remaining valid small findings stay open. `BILLING-ELIGIBLE-ORDER-SELECTOR-001` and the photo/empty-order receipt UX tasks are closed after UAT.

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
