import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CUSTOMER_PAGE_SIZE, customerFilterKey, encodeCustomerCursor, decodeCustomerCursor, customerPage, customerListHref } from "../src/features/customers/pagination.ts";
import { CUSTOMER_ACCOUNT_PAGE_SIZE, decodeAccountOrderCursor, decodeAccountPaymentCursor, paginateAccountRows, accountHistoryHref } from "../src/features/customer-account/pagination.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const customerId = "11111111-1111-4111-8111-111111111111";
const otherCustomerId = "22222222-2222-4222-8222-222222222222";
const id = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const token = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const filters = { query: "alpha", status: "active" };

test("001G customer cursors bind q and status, carry no tenant, and reject malformed inputs", () => {
  const raw = encodeCustomerCursor({ displayName: "Alpha, S.L.", id: id(1) }, "next", filters);
  assert.deepEqual(JSON.parse(Buffer.from(raw, "base64url").toString()), {
    v: 1, displayName: "Alpha, S.L.", id: id(1), direction: "next", filterKey: customerFilterKey(filters),
  });
  assert.deepEqual(decodeCustomerCursor(raw, filters), { displayName: "Alpha, S.L.", id: id(1), direction: "next" });
  for (const changed of [{ ...filters, query: "beta" }, { ...filters, status: "all" }]) assert.equal(decodeCustomerCursor(raw, changed), null);
  for (const invalid of ["!", "a".repeat(2049), token({ v: 2, displayName: "Alpha", id: id(1), direction: "next", filterKey: customerFilterKey(filters) }),
    token({ v: 1, displayName: "Alpha", id: id(1), direction: "next", filterKey: customerFilterKey(filters), organizationId: customerId })]) {
    assert.equal(decodeCustomerCursor(invalid, filters), null);
  }
});

test("001G customer sentinel and reverse traversal retain alphabetic display", () => {
  assert.equal(CUSTOMER_PAGE_SIZE, 25);
  const rows = Array.from({ length: 26 }, (_, i) => ({ id: id(i + 1), displayName: `Customer ${String(i + 1).padStart(2, "0")}` }));
  const first = customerPage(rows, null, filters);
  assert.equal(first.items.length, 25);
  assert.equal(first.items[0].displayName, "Customer 01");
  assert.equal(first.previousCursor, null);
  assert.ok(first.nextCursor);
  const previous = customerPage([...rows].reverse(), { displayName: "Customer 27", id: id(27), direction: "previous" }, filters);
  assert.equal(previous.items[0].displayName, "Customer 02");
  assert.ok(previous.previousCursor);
  assert.ok(previous.nextCursor);
  const href = new URL(customerListHref(filters, first.nextCursor), "https://example.test");
  assert.equal(href.searchParams.get("q"), "alpha");
  assert.equal(href.searchParams.get("status"), "active");
  assert.equal(new URL(customerListHref(filters), href).searchParams.get("cursor"), null);
});

test("001G customer list RPC filters before keyset limit and counts only visible customers", async () => {
  const [queries, sql, page] = await Promise.all([
    source("src/features/customers/server/queries.ts"),
    source("supabase/migrations/20261004000200_data_retention_scale_001g_customer_history_scalability.sql"),
    source("src/app/[locale]/app/(dashboard)/customers/page.tsx"),
  ]);
  const body = queries.slice(queries.indexOf("export async function listCustomers"), queries.indexOf("export async function getCustomerById"));
  assert.match(body, /requireMembership\(locale\)/);
  assert.match(body, /decodeCustomerCursor\(rawCursor, filters\)/);
  assert.match(body, /rpc\("list_customers_page"/);
  assert.match(body, /target_limit: CUSTOMER_PAGE_SIZE \+ 1/);
  assert.doesNotMatch(body, /\.limit\(100\)|\.from\("properties"\)|\.range\(/);
  const rpc = sql.slice(sql.indexOf("create function public.list_customers_page"), sql.indexOf("-- Legacy list_customer_account_orders"));
  assert.match(rpc, /app_current_organization_id\(\)/);
  assert.match(rpc, /is_organization_member\(org_id\)/);
  for (const column of ["display_name", "company_name", "email", "phone", "customer_code"]) assert.match(rpc, new RegExp(`c\\.${column} ilike`));
  assert.match(rpc, /target_status = 'all' or c\.is_active = \(target_status = 'active'\)/);
  assert.match(rpc, /\(c\.display_name, c\.id\) > \(target_cursor_name, target_cursor_id\)/);
  assert.match(rpc, /\(c\.display_name, c\.id\) < \(target_cursor_name, target_cursor_id\)/);
  assert.match(rpc, /limit target_limit/);
  assert.match(rpc, /select count\(\*\) from public\.properties p[\s\S]*p\.customer_id = s\.id/);
  assert.match(page, /customers\.items/);
  assert.match(page, /customerListHref\(filters/);
});

test("001G account cursors bind customer and period; payment tuple includes both timestamps", () => {
  const order = token({ v: 1, createdAt: "2026-10-04T10:00:00Z", id: id(1), direction: "older", customerId, period: "year" });
  const payment = token({ v: 1, createdAt: "2026-10-04T10:00:00Z", paidAt: "2026-10-04T11:00:00Z", id: id(2), direction: "newer", customerId, period: "all" });
  assert.equal(decodeAccountOrderCursor(order, customerId, "year")?.id, id(1));
  assert.equal(decodeAccountPaymentCursor(payment, customerId, "all")?.paidAt, "2026-10-04T11:00:00Z");
  assert.equal(decodeAccountOrderCursor(order, otherCustomerId, "year"), null);
  assert.equal(decodeAccountOrderCursor(order, customerId, "all"), null);
  assert.equal(decodeAccountPaymentCursor(payment, customerId, "year"), null);
  assert.equal(decodeAccountPaymentCursor(payment, customerId, "recent"), null);
  assert.equal(decodeAccountOrderCursor("bad", customerId, "year"), null);
  assert.equal(decodeAccountPaymentCursor(token({ v: 1, createdAt: "2026-10-04T10:00:00Z", paidAt: "bad", id: id(2), direction: "newer", customerId, period: "all" }), customerId, "all"), null);
});

test("001G account pages use 25 plus sentinel and independent URL cursors", () => {
  assert.equal(CUSTOMER_ACCOUNT_PAGE_SIZE, 25);
  const rows = Array.from({ length: 26 }, (_, i) => ({ id: id(i + 1), created_at: `2026-10-04T10:${String(59 - i).padStart(2, "0")}:00Z` }));
  const page = paginateAccountRows(rows, null, (row, direction) => ({ createdAt: row.created_at, id: row.id, direction }), customerId, "all");
  assert.equal(page.items.length, 25);
  assert.equal(page.navigation.newerCursor, null);
  assert.ok(page.navigation.olderCursor);
  const reverse = paginateAccountRows([...rows].reverse(), { createdAt: rows[0].created_at, id: id(27), direction: "newer" },
    (row, direction) => ({ createdAt: row.created_at, id: row.id, direction }), customerId, "all");
  assert.equal(reverse.items[0].id, rows[1].id);
  assert.ok(reverse.navigation.newerCursor);
  const href = new URL(accountHistoryHref(customerId, "all", page.navigation.olderCursor, "payment-token"), "https://example.test");
  assert.equal(href.searchParams.get("orderCursor"), page.navigation.olderCursor);
  assert.equal(href.searchParams.get("paymentCursor"), "payment-token");
  assert.equal(new URL(accountHistoryHref(customerId, "year", null, null), href).searchParams.has("orderCursor"), false);
});

test("001G recent remains compact; year and all call paginated RPCs while summary stays complete", async () => {
  const [queries, page, ui] = await Promise.all([
    source("src/features/customer-account/server/queries.ts"),
    source("src/app/[locale]/app/(dashboard)/customers/[customerId]/page.tsx"),
    source("src/components/customers/CustomerAccountView.tsx"),
  ]);
  assert.match(queries, /RECENT_LIMITS = \{ orders: 8, payments: 12 \}/);
  assert.match(queries, /period === "recent" \? supabase\.rpc\("list_customer_account_orders"/);
  assert.match(queries, /period === "recent" \? supabase\.rpc\("list_customer_account_payments"/);
  assert.match(queries, /list_customer_account_orders_page/);
  assert.match(queries, /list_customer_account_payments_page/);
  assert.match(queries, /target_limit: CUSTOMER_ACCOUNT_PAGE_SIZE \+ 1/g);
  assert.match(queries, /rpc\("get_customer_account_summary"/);
  assert.doesNotMatch(queries, /all: \{ orders: 100|year: \{ orders: 50/);
  assert.match(page, /getCustomerAccountFinancials\(locale, customerId, period, rawSearchParams\.orderCursor, rawSearchParams\.paymentCursor\)/);
  assert.match(ui, /href=\{`\/app\/customers\/\$\{customer\.id\}\?period=\$\{value\}`\}/);
  assert.match(ui, /period === "recent"\) return null/);
  assert.match(ui, /defaultOpen=\{period !== "recent" \|\| financials\.orders\.length <= 3\}/);
  assert.match(ui, /defaultOpen=\{period !== "recent" \|\| financials\.payments\.length <= 3\}/);
  assert.match(ui, /kind === "orders" \? cursor : orderCursor/);
  assert.match(ui, /kind === "payments" \? cursor : paymentCursor/);
  assert.match(ui, /#customer-\$\{kind\}/);
});

test("001G order page preserves eligibility, timezone, financial calculations, and reverse keyset", async () => {
  const sql = await source("supabase/migrations/20261004000200_data_retention_scale_001g_customer_history_scalability.sql");
  const body = sql.slice(sql.indexOf("create function public.list_customer_account_orders_page"), sql.indexOf("-- Legacy list_customer_account_payments"));
  assert.match(body, /has_organization_role\(org_id, array\['owner', 'manager'\]/);
  assert.match(body, /o\.customer_id = target_customer_id/);
  assert.match(body, /o\.is_active and o\.production_status <> 'cancelled'/);
  assert.match(body, /date_trunc\('year', now\(\) at time zone org_timezone\)/);
  assert.match(body, /\(o\.created_at, o\.id\) < \(target_cursor_created_at, target_cursor_id\)/);
  assert.match(body, /\(o\.created_at, o\.id\) > \(target_cursor_created_at, target_cursor_id\)/);
  assert.match(body, /selected as materialized[\s\S]*limit target_limit[\s\S]*payment_totals as/);
  assert.match(body, /sum\(p\.amount\) filter \(where p\.status = 'confirmed'\)/);
  assert.match(body, /sum\(p\.amount\) filter \(where p\.status = 'refunded'\)/);
  assert.match(body, /pt\.confirmed_total - pt\.refunded_total/);
  assert.match(body, /p\.name as property_name/);
});

test("001G payment page keeps paid/created/id ordering and safe exposed fields", async () => {
  const sql = await source("supabase/migrations/20261004000200_data_retention_scale_001g_customer_history_scalability.sql");
  const body = sql.slice(sql.indexOf("create function public.list_customer_account_payments_page"), sql.indexOf("revoke all on function public.list_customers_page"));
  assert.match(body, /has_organization_role\(org_id, array\['owner', 'manager'\]/);
  assert.match(body, /o\.customer_id = target_customer_id/);
  assert.match(body, /o\.is_active and o\.production_status <> 'cancelled'/);
  assert.match(body, /\(p\.paid_at, p\.created_at, p\.id\) <[\s\S]*target_cursor_paid_at, target_cursor_created_at, target_cursor_id/);
  assert.match(body, /\(p\.paid_at, p\.created_at, p\.id\) >[\s\S]*target_cursor_paid_at, target_cursor_created_at, target_cursor_id/);
  assert.match(body, /p\.paid_at end desc[\s\S]*p\.created_at end desc[\s\S]*p\.id end desc/);
  assert.match(body, /p\.refunded_from_payment_id, o\.currency/);
  assert.doesNotMatch(body, /provider|reference|service_role/);
});

test("001G legacy signatures and complete summary remain untouched; migration adds only reads and indexes", async () => {
  const oldSql = await source("supabase/migrations/20260826000100_customer_account_001_financial_summary.sql");
  const sql = await source("supabase/migrations/20261004000200_data_retention_scale_001g_customer_history_scalability.sql");
  for (const name of ["list_customer_account_orders", "list_customer_account_payments"]) {
    assert.match(oldSql, new RegExp(`create function public\\.${name}\\(`));
    assert.doesNotMatch(sql, new RegExp(`(?:drop|replace) function public\\.${name}\\(`));
  }
  assert.doesNotMatch(sql, /get_customer_account_summary/);
  assert.equal((sql.match(/create function public\./g) ?? []).length, 3);
  assert.equal((sql.match(/create index /g) ?? []).length, 3);
  assert.doesNotMatch(sql, /alter table|create policy|alter policy|drop |update public\.|delete from|insert into|service_role|pg_trgm/i);
  for (const name of ["list_customers_page", "list_customer_account_orders_page", "list_customer_account_payments_page"]) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(`));
  }
});

test("001G all five locales have customer and account pagination controls", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const key of ["navigation", "previous", "next", "first"]) assert.ok(messages.customers.pagination[key]);
    for (const key of ["navigation", "older", "newer", "latest"]) assert.ok(messages.customerAccount.history.pagination[key]);
  }
});
