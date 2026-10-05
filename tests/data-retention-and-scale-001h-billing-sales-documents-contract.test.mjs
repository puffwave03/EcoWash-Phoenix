import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { BILLING_PAGE_SIZE, normalizeBillingFilters, billingFilterKey, encodeBillingCursor, decodeBillingCursor, billingPage, billingHistoryHref } from "../src/features/billing/pagination.ts";
import { SALES_DOCUMENT_PAGE_SIZE, encodeSalesDocumentCursor, decodeSalesDocumentCursor, salesDocumentPage, salesDocumentHistoryHref } from "../src/features/sales-documents/pagination.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sql = await source("supabase/migrations/20261004000300_data_retention_scale_001h_billing_sales_document_history.sql");
const billing = await source("src/features/billing/server/queries.ts");
const sales = await source("src/features/sales-documents/server/queries.ts");
const billingUi = await source("src/app/[locale]/app/(dashboard)/billing/page.tsx");
const salesUi = await source("src/app/[locale]/app/(dashboard)/accounting/documents/page.tsx");
const body = (name) => sql.split(`create function public.${name}(`)[1].split("$$;")[0];
const list = body("list_billing_invoices_page");
const summary = body("get_billing_history_summary");
const customer = body("get_customer_billing_history_summary");
const registry = body("list_sales_documents_page");
const id = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const token = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const filters = normalizeBillingFilters("  ACME  ", "paid");
const position = { createdAt: "2026-10-04T12:00:00.123456+00:00", id: id(1) };
const document = { issuedAt: position.createdAt, documentNumber: "REC-001", kind: "receipt", id: id(1) };

test("Billing cursor binds normalized q/status and contains only the approved fields", () => {
  assert.deepEqual(filters, { q: "acme", status: "paid" });
  assert.equal(normalizeBillingFilters("", "invalid").status, "all");
  const raw = encodeBillingCursor(position, "older", filters);
  assert.deepEqual(JSON.parse(Buffer.from(raw, "base64url")), { v: 1, ...position, direction: "older", filterKey: billingFilterKey(filters) });
  assert.deepEqual(decodeBillingCursor(raw, filters), { ...position, direction: "older" });
  assert.equal(decodeBillingCursor(raw, { ...filters, q: "other" }), null);
  assert.equal(decodeBillingCursor(raw, { ...filters, status: "all" }), null);
});

test("both cursors reject malformed, impossible dates, unknown fields, tenant identity and invalid directions", () => {
  const cases = [
    [encodeBillingCursor(position, "older", filters), (raw) => decodeBillingCursor(raw, filters), "createdAt"],
    [encodeSalesDocumentCursor(document, "older"), decodeSalesDocumentCursor, "issuedAt"],
  ];
  for (const [raw, decode, time] of cases) {
    const value = JSON.parse(Buffer.from(raw, "base64url"));
    for (const bad of ["!", raw + "=", "a".repeat(8193), token(null), token([]),
      token({ ...value, organizationId: id(2) }), token({ ...value, v: 2 }), token({ ...value, direction: "sideways" }),
      token({ ...value, id: "bad" }), token({ ...value, [time]: "2026-02-30T12:00:00Z" })]) assert.equal(decode(bad), null);
  }
  const value = JSON.parse(Buffer.from(encodeSalesDocumentCursor(document, "older"), "base64url"));
  assert.equal(decodeSalesDocumentCursor(token({ ...value, kind: "draft" })), null);
  assert.equal(decodeSalesDocumentCursor(token({ ...value, documentNumber: "" })), null);
});

test("Billing traverses more than 100 equal-timestamp invoices and reverses without duplication", () => {
  assert.equal(BILLING_PAGE_SIZE, 25);
  const rows = Array.from({ length: 137 }, (_, i) => ({ ...position, id: id(137 - i) }));
  let cursor = null;
  const found = [];
  let second;
  do {
    const selected = rows.filter((row) => !cursor || row.id < cursor.id).slice(0, 26);
    const page = billingPage(selected, cursor, filters);
    assert.ok(page.items.length <= 25);
    found.push(...page.items);
    if (cursor && !second) second = page;
    cursor = decodeBillingCursor(page.olderCursor ?? undefined, filters);
  } while (cursor);
  assert.deepEqual(found, rows);
  const backCursor = decodeBillingCursor(second.newerCursor, filters);
  const backRows = rows.filter((row) => row.id > backCursor.id).reverse().slice(0, 26);
  const back = billingPage(backRows, backCursor, filters);
  assert.deepEqual(back.items, rows.slice(0, 25));
  assert.equal(back.newerCursor, null);
  assert.ok(back.olderCursor);
});

test("Sales Document mixed ordering traverses one unified history and returns to latest", () => {
  assert.equal(SALES_DOCUMENT_PAGE_SIZE, 25);
  const rows = Array.from({ length: 139 }, (_, i) => ({
    ...document, id: id(i + 1), kind: i % 2 ? "invoice" : "receipt",
    issuedAt: `2026-10-0${1 + (i % 4)}T12:00:00Z`, documentNumber: `DOC-${i % 3}`,
  }));
  const compare = (a, b) => b.issuedAt.localeCompare(a.issuedAt) || a.documentNumber.localeCompare(b.documentNumber)
    || (a.kind === "receipt" ? 0 : 1) - (b.kind === "receipt" ? 0 : 1) || a.id.localeCompare(b.id);
  rows.sort(compare);
  let cursor = null;
  const found = [];
  let second;
  do {
    const page = salesDocumentPage(rows.filter((row) => !cursor || compare(row, cursor) > 0).slice(0, 26), cursor);
    found.push(...page.items);
    if (cursor && !second) second = page;
    cursor = decodeSalesDocumentCursor(page.olderCursor ?? undefined);
  } while (cursor);
  assert.deepEqual(found, rows);
  const backCursor = decodeSalesDocumentCursor(second.newerCursor);
  const back = salesDocumentPage(rows.filter((row) => compare(row, backCursor) < 0).reverse().slice(0, 26), backCursor);
  assert.deepEqual(back.items, rows.slice(0, 25));
  assert.equal(back.newerCursor, null);
  assert.deepEqual(JSON.parse(Buffer.from(encodeSalesDocumentCursor(document, "older"), "base64url")), { v: 1, ...document, direction: "older" });
});

test("navigation preserves Billing filters and filter submit omits cursor; latest clears cursor", () => {
  const url = new URL(billingHistoryHref(filters, "abc"), "https://example.test");
  assert.equal(url.searchParams.get("q"), "acme");
  assert.equal(url.searchParams.get("status"), "paid");
  assert.equal(url.searchParams.get("cursor"), "abc");
  assert.equal(new URL(billingHistoryHref(filters), url).searchParams.has("cursor"), false);
  assert.equal(salesDocumentHistoryHref(), "/app/accounting/documents");
  assert.equal(salesDocumentHistoryHref("abc"), "/app/accounting/documents?cursor=abc");
  assert.doesNotMatch(billingUi, /name="cursor"/);
  for (const ui of [billingUi, salesUi]) for (const direction of ["older", "newer", "latest"]) assert.ok(ui.includes(`pagination.${direction}`));
});

test("Billing RPC filters literal q and derived status before limit and uses tuple keysets", () => {
  for (const field of ["invoice_number", "customer_name", "order_numbers"]) assert.ok(list.includes(`e.${field}`));
  assert.match(list, /strpos\(lower\([\s\S]*lower\(target_query\)\) > 0/);
  assert.ok(list.indexOf("e.payment_status = target_status") < list.indexOf("limit target_limit"));
  assert.ok(list.indexOf("lower(target_query)") < list.indexOf("limit target_limit"));
  assert.match(list, /\(e\.created_at, e\.id\) < \(target_cursor_created_at, target_cursor_id\)/);
  assert.match(list, /\(e\.created_at, e\.id\) > \(target_cursor_created_at, target_cursor_id\)/);
  assert.match(list, /then e\.created_at end desc,[\s\S]*then e\.id end desc/);
  assert.match(list, /then e\.created_at end asc,[\s\S]*then e\.id end asc/);
  assert.match(list, /target_limit not between 1 and 26/);
  const query = billing.slice(billing.indexOf("export async function listBillingInvoices"), billing.indexOf("export async function getBillingHistorySummary"));
  assert.match(query, /rpc\("list_billing_invoices_page"/);
  assert.match(query, /target_limit: BILLING_PAGE_SIZE \+ 1/);
  assert.doesNotMatch(query, /limit\(100\)|\.filter\(|hydrateInvoices/);
});

test("all Billing reads retain canonical linked-order net and exact derived status precedence", () => {
  for (const rpc of [list, summary, customer]) {
    assert.match(rpc, /p\.status = 'confirmed' then p\.amount/);
    assert.match(rpc, /p\.status = 'refunded' then -p\.amount/);
    assert.match(rpc, /io\.invoice_id = i\.id and io\.order_id = p\.order_id/);
    assert.doesNotMatch(rpc, /invoice_payments/);
  }
  assert.match(list, /document_status = 'draft' then 'draft'[\s\S]*document_status = 'cancelled' then 'cancelled'[\s\S]*paid_total <= 0 then 'unpaid'[\s\S]*paid_total < a\.total then 'partially_paid' else 'paid'/);
  assert.match(list, /round\(greatest\(a\.total - a\.paid_total, 0\), 2\)/);
});

test("Billing summary covers the full population with tenant currency fallback and no filters", () => {
  assert.match(summary, /count\(a\.id\), count\(a\.id\) filter \(where a\.document_status = 'draft'\)/);
  assert.match(summary, /order by i\.created_at desc, i\.id desc limit 1/);
  assert.match(summary, /o\.default_currency::text/);
  assert.match(summary, /sum\(a\.total\) filter \(where a\.document_status = 'issued' and a\.currency = c\.currency\)/);
  assert.doesNotMatch(summary, /target_query|target_status|target_cursor|limit 25|limit 26/);
  assert.match(billingUi, /getBillingHistorySummary\(locale\)/);
  for (const field of ["invoiceCount", "draftCount", "issuedTotal", "outstanding"]) assert.ok(billingUi.includes(`summary.${field}`));
  assert.doesNotMatch(billingUi, /invoices\.filter|invoices\.length|\.reduce\(/);
});

test("Customer Billing loads only the customer's latest five and complete separate aggregates", () => {
  const query = billing.slice(billing.indexOf("export async function getCustomerBillingOverview"));
  assert.doesNotMatch(query, /listBillingInvoices|listEligibleBillingOrders/);
  assert.match(query, /eq\("customer_id", customerId\)/);
  assert.match(query, /order\("created_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
  assert.match(query, /limit\(5\)/);
  assert.match(query, /hydrateInvoices\(supabase, recent\.data/);
  assert.match(query, /rpc\("get_customer_billing_history_summary"/);
  assert.match(customer, /i\.customer_id = target_customer_id and i\.document_status <> 'cancelled'/);
  assert.match(customer, /group by a\.currency/);
  assert.match(customer, /count\(\*\) as "invoiceCount"/);
  assert.match(customer, /sum\(a\.paid_total\) filter \(where a\.document_status = 'issued'\)/);
  assert.doesNotMatch(customer, /\blimit\b/i);
});

test("eligible count excludes inactive/cancelled, shared walkin and active links before exact COUNT", () => {
  assert.match(customer, /'eligibleOrderCount', \(select count\(\*\) from public\.orders/);
  assert.match(customer, /o\.organization_id = org_id and o\.customer_id = target_customer_id/);
  assert.match(customer, /o\.is_active and o\.production_status <> 'cancelled'/);
  assert.match(customer, /c\.customer_code is distinct from 'WALKIN-SHARED'/);
  assert.match(customer, /not exists \(select 1 from public\.invoice_orders[\s\S]*io\.order_id = o\.id and io\.is_active/);
});

test("registry unions canonical sources before global limit and keeps receipt customer display", () => {
  assert.match(registry, /from public\.operational_receipts[\s\S]*union all[\s\S]*from public\.invoices/);
  assert.match(registry, /i\.document_status in \('issued', 'cancelled'\)/);
  assert.match(registry, /coalesce\(c\.display_name, ''\)/);
  assert.match(registry, /r\.snapshot #>> '\{order,orderNumber\}'/);
  assert.match(registry, /i\.customer_name/);
  assert.equal((registry.match(/limit target_limit/g) ?? []).length, 1);
  assert.match(registry, /from documents d[\s\S]*limit target_limit/);
  assert.match(sales, /rpc\("list_sales_documents_page"/);
  assert.match(sales, /target_limit: SALES_DOCUMENT_PAGE_SIZE \+ 1/);
  assert.doesNotMatch(sales, /limit\(100\)|invoiceOrders|\.sort\(/);
});

test("registry mixed keyset correctly reverses every ordering column", () => {
  assert.match(registry, /0 as kind_rank/);
  assert.match(registry, /'invoice'::text, 1/);
  assert.match(registry, /d\.issued_at < target_cursor_issued_at/);
  assert.match(registry, /d\.issued_at > target_cursor_issued_at/);
  for (const operator of [">", "<"]) assert.ok(registry.includes(`(d.document_number, d.kind_rank, d.id) ${operator}`));
  for (const [field, older, newer] of [["issued_at", "desc", "asc"], ["document_number", "asc", "desc"], ["kind_rank", "asc", "desc"], ["id", "asc", "desc"]]) {
    assert.ok(registry.includes(`target_direction = 'older' then d.${field} end ${older}`));
    assert.ok(registry.includes(`target_direction = 'newer' then d.${field} end ${newer}`));
  }
  assert.doesNotMatch(sql, /\boffset\b|\.range\(/i);
});

test("every new RPC derives tenant, enforces role and entitlement, fixes search_path and revokes anon", () => {
  for (const [name, feature] of [["list_billing_invoices_page", "billing.invoicing"], ["get_billing_history_summary", "billing.invoicing"], ["get_customer_billing_history_summary", "billing.invoicing"], ["list_sales_documents_page", "printing"]]) {
    const rpc = body(name);
    assert.match(rpc, /app_current_organization_id\(\)/);
    assert.match(rpc, /has_organization_role\(org_id, array\['owner', 'manager'\]::public\.app_role\[\]\)/);
    assert.ok(rpc.includes(`organization_entitlement_is_enabled(org_id, '${feature}', now())`));
    assert.match(rpc, /security definer set search_path = public/);
    assert.doesNotMatch(rpc.split("returns")[0], /organization_id/);
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^;]*from public, anon, authenticated;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^;]*to authenticated;`));
  }
  assert.doesNotMatch(sql, /grant[^;]*to anon|service_role/i);
});

test("migration is only four new read RPCs, grants and four supporting indexes", () => {
  assert.equal((sql.match(/create function public\./g) ?? []).length, 4);
  assert.equal((sql.match(/create index /g) ?? []).length, 4);
  assert.doesNotMatch(sql, /\b(insert into|update public|delete from|alter table|create table|create trigger|create policy|drop |truncate |create or replace)\b/i);
  assert.doesNotMatch(sql, /veri.?factu|fiscal_event|invoice_payments|number_counters/i);
  assert.match(sql, /organization_id, created_at desc, id desc/);
  assert.match(sql, /organization_id, customer_id, created_at desc, id desc/);
  assert.match(sql, /organization_id, issued_at desc, receipt_number asc, id asc/);
});

test("query boundaries still enforce Owner/Manager and entitlements and safely reset empty pages", () => {
  for (const [queries, entitlement] of [[billing, "billingInvoicing"], [sales, "printing"]]) {
    assert.match(queries, /requireOwnerOrManager\(locale\)/);
    assert.ok(queries.includes(`requireEntitlement(locale, FEATURES.${entitlement})`));
    assert.match(queries, /if \(!data\.length && cursor\) \{\s*cursor = null;\s*data = await load\(\)/);
  }
});

test("five locales contain usable history navigation labels", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const namespace of ["billing", "salesDocuments"]) for (const key of ["label", "older", "newer", "latest"]) assert.ok(messages[namespace].pagination[key]?.trim());
  }
});

// Immutable scope anchors: preserve the existing detail/creation/mutation paths byte-for-byte.

test("Billing detail and operational creation selector remain unchanged", () => {
  assert.equal(createHash("sha256").update(billing.slice(billing.indexOf("export async function listEligibleBillingOrders"), billing.indexOf("export async function getCustomerBillingOverview"))).digest("hex"), "5961fddfc016384f45d3b3b8dcebf09bb5b22ec2f79ed4677eeb6f77806356b2");
  assert.equal(createHash("sha256").update(billing.slice(billing.indexOf("export async function getBillingInvoice"), billing.indexOf("export async function listEligibleBillingOrders"))).digest("hex"), "92b2b8f3be4a216824797160cc25f7f4786fd49ce01544f879e48b8304f6a67e");
});

test("mutation paths, receipt cancellation form and print links remain unchanged", async () => {
  assert.equal(createHash("sha256").update(await source("src/features/billing/server/actions.ts")).digest("hex"), "0e456e025ee1f77d8249439b1b0e68216f773a815fe739e19e9c6e24037933ba");
  assert.equal(createHash("sha256").update(await source("src/features/sales-documents/server/actions.ts")).digest("hex"), "2b7849a465fc6a6e8e446c6c934b8bffeacf7595d8d5998a436a5dc7e1f90698");
  assert.equal(createHash("sha256").update(await source("src/components/sales-documents/SalesDocumentsRegistry.tsx")).digest("hex"), "64f76b0c768894f8eff3c075244663afcec88d8c16e3f6b249a5da60d766b48f");
});
