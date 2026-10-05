import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  decodePortalOrderCursor,
  encodePortalOrderCursor,
  paginatePortalOrderRows,
  PORTAL_ORDER_FETCH_SIZE,
  PORTAL_ORDER_PAGE_SIZE,
  portalOrderHistoryHref,
} from "../src/features/portal/pagination.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20261005000300_data_retention_scale_001j_portal_history_scalability.sql";
const legacyMigrationPath = "supabase/migrations/20261005000200_portal_context_isolation_001.sql";
const uuid = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const token = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function functionBody(sql, name) {
  const startPattern = new RegExp(`create function public\\.${name}\\s*\\(`, "i");
  const start = sql.search(startPattern);
  assert.notEqual(start, -1, `${name} definition missing`);
  const bodyStart = sql.indexOf("as $$", start);
  assert.notEqual(bodyStart, -1, `${name} body missing`);
  const end = sql.indexOf("$$;", bodyStart);
  assert.notEqual(end, -1, `${name} body terminator missing`);
  return sql.slice(start, end + 3);
}

test("1-11 Portal cursor is identity-free, strict, and malformed values reset to latest", () => {
  assert.equal(PORTAL_ORDER_PAGE_SIZE, 25);
  assert.equal(PORTAL_ORDER_FETCH_SIZE, 26);
  const position = { createdAt: "2026-10-05T12:00:00.123456+00:00", id: uuid(1) };
  const raw = encodePortalOrderCursor(position, "older");
  const value = JSON.parse(Buffer.from(raw, "base64url"));
  assert.deepEqual(value, { v: 1, ...position, direction: "older" });
  assert.deepEqual(decodePortalOrderCursor(raw), { ...position, direction: "older" });
  for (const forbidden of ["organizationId", "organization_id", "customerId", "customer_id", "accessId", "access_id", "userId", "user_id"]) {
    assert.equal(Object.hasOwn(value, forbidden), false);
  }
  for (const invalid of [
    "!", `${raw}=`, "a".repeat(2049), token(null), token([]),
    token({ ...value, v: 2 }), token({ ...value, direction: "sideways" }),
    token({ ...value, id: "bad" }), token({ ...value, createdAt: "2026-02-30T12:00:00Z" }),
    token({ ...value, organizationId: uuid(2) }),
  ]) assert.equal(decodePortalOrderCursor(invalid), null);
  assert.equal(portalOrderHistoryHref(), "/portal/orders");
  assert.match(portalOrderHistoryHref(raw), /^\/portal\/orders\?cursor=/);
});

test("2-8 tuple keyset pagination traverses beyond 100 rows and never renders the sentinel", () => {
  const rows = Array.from({ length: 137 }, (_, index) => ({
    created_at: `2026-10-${String(5 - Math.floor(index / 50)).padStart(2, "0")}T12:00:00Z`,
    id: uuid(137 - index),
  })).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const compareDesc = (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
  let cursor = null;
  let secondPage;
  const found = [];
  do {
    const selected = rows
      .filter((row) => !cursor || compareDesc(row, { created_at: cursor.createdAt, id: cursor.id }) > 0)
      .slice(0, PORTAL_ORDER_FETCH_SIZE);
    const page = paginatePortalOrderRows(selected, cursor);
    assert.ok(page.visible.length <= PORTAL_ORDER_PAGE_SIZE);
    found.push(...page.visible);
    if (cursor && !secondPage) secondPage = page;
    cursor = decodePortalOrderCursor(page.pagination.olderCursor ?? undefined);
  } while (cursor);
  assert.deepEqual(found, rows);

  const newer = decodePortalOrderCursor(secondPage.pagination.newerCursor);
  const backRows = rows
    .filter((row) => compareDesc(row, { created_at: newer.createdAt, id: newer.id }) < 0)
    .reverse()
    .slice(0, PORTAL_ORDER_FETCH_SIZE);
  const back = paginatePortalOrderRows(backRows, newer);
  assert.deepEqual(back.visible, rows.slice(0, PORTAL_ORDER_PAGE_SIZE));
  assert.equal(back.pagination.newerCursor, null);
});

test("9-19 history RPC applies tuple bounds before page-only financial hydration", async () => {
  const sql = await source(migrationPath);
  const body = functionBody(sql, "list_customer_portal_orders_page");
  assert.match(body, /target_limit is null or target_limit not between 1 and 26/);
  assert.match(body, /\(target_cursor_created_at is null\) <> \(target_cursor_id is null\)/);
  assert.match(body, /\(orders\.created_at, orders\.id\) < \(target_cursor_created_at, target_cursor_id\)/);
  assert.match(body, /\(orders\.created_at, orders\.id\) > \(target_cursor_created_at, target_cursor_id\)/);
  assert.match(body, /selected as materialized[\s\S]*orders\.created_at end desc,[\s\S]*orders\.id end desc/);
  assert.ok(body.indexOf("limit target_limit") < body.indexOf("payment_totals as"));
  assert.match(body, /from selected[\s\S]*left join public\.payments/);
  assert.match(body, /payments\.status = 'confirmed'/);
  assert.match(body, /payments\.status = 'refunded'/);
  assert.match(body, /confirmed_total - payment_totals\.refunded_total/);
  for (const status of ["paid", "refunded", "void", "unpaid", "partially_paid"]) assert.match(body, new RegExp(`'${status}'`));
  assert.doesNotMatch(body, /\boffset\b|\.range\(/i);
});

test("12-15 canonical history and exact count are independent from visible page length", async () => {
  const [sql, query, page, component] = await Promise.all([
    source(migrationPath),
    source("src/features/portal/server/queries.ts"),
    source("src/app/[locale]/portal/orders/page.tsx"),
    source("src/components/portal/CustomerPortalViews.tsx"),
  ]);
  const history = functionBody(sql, "list_customer_portal_orders_page");
  const count = functionBody(sql, "count_customer_portal_orders");
  for (const body of [history, count]) {
    assert.match(body, /public\.customer_portal_current_access\(\) portal_context/);
    assert.match(body, /portal_context\.organization_id = orders\.organization_id/);
    assert.match(body, /portal_context\.customer_id = orders\.customer_id/);
    assert.match(body, /orders\.is_active/);
    assert.match(body, /orders\.production_status <> 'cancelled'/);
  }
  assert.match(count, /select count\(\*\)/);
  assert.match(query, /\.rpc\("count_customer_portal_orders"\)/);
  assert.match(page, /completeOrderCount=\{completeOrderCount\}/);
  assert.match(component, /\{completeOrderCount\} \{text\.orders\.toLocaleLowerCase\(\)\}/);
  assert.doesNotMatch(component, /\{orders\.length\} \{text\.orders\.toLocaleLowerCase\(\)\}/);
});

test("20-30 Overview uses current, bounded recent, complete per-currency summary and exact count", async () => {
  const [sql, page, component] = await Promise.all([
    source(migrationPath),
    source("src/app/[locale]/portal/page.tsx"),
    source("src/components/portal/CustomerPortalViews.tsx"),
  ]);
  const current = functionBody(sql, "get_customer_portal_current_order");
  const summary = functionBody(sql, "get_customer_portal_account_summary");
  assert.match(current, /orders\.production_status not in \('completed', 'cancelled'\)/);
  assert.match(current, /order by orders\.created_at desc, orders\.id desc[\s\S]*limit 1/);
  assert.match(page, /getCustomerPortalCurrentOrder\(locale\)/);
  assert.match(page, /listCustomerPortalOrdersPage\(locale, undefined, 5\)/);
  assert.match(page, /\.filter\(\(order\) => order\.id !== currentOrder\?\.id\)[\s\S]*\.slice\(0, 4\)/);
  assert.match(page, /getCustomerPortalAccountSummary\(locale\)/);
  assert.match(page, /accountSummaries\.length === 1 \? accountSummaries\[0\] : null/);
  assert.match(page, /countCustomerPortalOrders\(locale\)/);
  assert.doesNotMatch(page, /listCustomerPortalOrders\(|const activeOrders|activeOrders=\{|orders=\{orders\}/);
  const overviewContract = component.slice(component.indexOf("type PortalOverviewProps"), component.indexOf("type PortalOrderListProps"));
  const overviewFunction = component.slice(component.indexOf("export function CustomerPortalOverview"), component.indexOf("export function CustomerPortalOrderList"));
  assert.doesNotMatch(overviewContract + overviewFunction, /financials\.reduce|summaryCurrencies|orders: CustomerPortalOrder\[\]/);
  assert.match(summary, /group by per_order\.currency/);
  assert.match(summary, /sum\(greatest\(per_order\.total - per_order\.paid, 0\)\)/);
  assert.match(summary, /payments\.status = 'confirmed'/);
  assert.match(summary, /payments\.status = 'refunded'/);
});

test("31-33 detail uses one canonical authorized financial row", async () => {
  const [sql, query] = await Promise.all([source(migrationPath), source("src/features/portal/server/queries.ts")]);
  const body = functionBody(sql, "get_customer_portal_order_financial");
  assert.match(query, /\.rpc\("get_customer_portal_order_financial", \{ target_order_id: orderId \}\)[\s\S]*\.maybeSingle<PortalFinancialRow>/);
  assert.doesNotMatch(query, /\.rpc\("list_customer_portal_order_financials"\)/);
  assert.match(body, /orders\.id = target_order_id/);
  assert.match(body, /portal_context\.organization_id = orders\.organization_id/);
  assert.match(body, /portal_context\.customer_id = orders\.customer_id/);
  assert.match(body, /orders\.is_active/);
  assert.match(body, /orders\.production_status <> 'cancelled'/);
  assert.match(body, /limit 1/);
});

test("34-45 all five reads preserve canonical context security and legacy compatibility", async () => {
  const [sql, legacy] = await Promise.all([source(migrationPath), source(legacyMigrationPath)]);
  const names = [
    "list_customer_portal_orders_page",
    "count_customer_portal_orders",
    "get_customer_portal_current_order",
    "get_customer_portal_account_summary",
    "get_customer_portal_order_financial",
  ];
  for (const name of names) {
    const body = functionBody(sql, name);
    assert.match(body, /security definer[\s\S]*set search_path = public/);
    assert.match(body, /public\.customer_portal_current_access\(\) portal_context/);
    assert.match(body, /portal_context\.organization_id = orders\.organization_id/);
    assert.match(body, /portal_context\.customer_id = orders\.customer_id/);
  }
  assert.equal((sql.match(/from public, anon, authenticated/g) ?? []).length, 5);
  assert.equal((sql.match(/to authenticated/g) ?? []).length, 5);
  assert.doesNotMatch(sql, /target_(?:organization|customer|access|user)_id/);
  assert.match(legacy, /function public\.list_customer_portal_orders\(\)/);
  assert.match(legacy, /function public\.list_customer_portal_order_financials\(\)/);
});

test("36-44 multi-context storage remains allowed and no selector or browser tenant truth is added", async () => {
  const [schema, sql, page, pagination] = await Promise.all([
    source("supabase/migrations/20260803000100_portal_001_customer_portal.sql"),
    source(migrationPath),
    source("src/app/[locale]/portal/orders/page.tsx"),
    source("src/features/portal/pagination.ts"),
  ]);
  assert.match(schema, /unique index customer_portal_access_user_customer_unique[\s\S]*\(user_id, customer_id\)/);
  assert.doesNotMatch(sql, /public\.customer_portal_access|unique|context selector/i);
  assert.match(page, /searchParams: Promise<\{ cursor\?: string \}>/);
  assert.doesNotMatch(page, /searchParams\.(?:organization|customer|access|user)|query\.(?:organization|customer|access|user)/i);
  assert.doesNotMatch(pagination, /organizationId|organization_id|customerId|customer_id|accessId|access_id|userId|user_id/);
});

test("46-53 migration scope contains only five read functions and grants", async () => {
  const sql = await source(migrationPath);
  assert.equal((sql.match(/^create function /gm) ?? []).length, 5);
  assert.equal((sql.match(/^revoke all on function /gm) ?? []).length, 5);
  assert.equal((sql.match(/^grant execute on function /gm) ?? []).length, 5);
  assert.doesNotMatch(sql, /\b(?:alter|create|drop)\s+table\b/i);
  assert.doesNotMatch(sql, /\b(?:create|drop)\s+(?:policy|trigger|index)\b/i);
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate)\b/i);
  assert.doesNotMatch(sql, /create_customer_portal_order_request|create_customer_online_payment_attempt|record_pos_refund/);
});

test("49 and 54-58 existing indexes and unrelated Portal behavior remain unchanged", async () => {
  const [indexes, diffScope, locales] = await Promise.all([
    source("supabase/migrations/20261004000200_data_retention_scale_001g_customer_history_scalability.sql"),
    Promise.all([
      source("src/features/portal/server/actions.ts"),
      source("src/features/online-payments/server/queries.ts"),
      source("src/features/order-photos/server/queries.ts"),
    ]),
    Promise.all(["it", "es", "en", "fr", "de"].map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`)).portal.pagination)),
  ]);
  assert.match(indexes, /orders_org_customer_created_id_idx[\s\S]*organization_id, customer_id, created_at desc, id desc/);
  assert.match(indexes, /payments_org_order_paid_created_id_idx/);
  for (const content of diffScope) assert.ok(content.length > 0);
  for (const messages of locales) for (const key of ["navigation", "older", "newer", "latest"]) assert.ok(messages[key]);
});

test("59-63 Portal scalability remains independent from future append-only fiscal evidence", async () => {
  const [sql, pagination, query] = await Promise.all([
    source(migrationPath),
    source("src/features/portal/pagination.ts"),
    source("src/features/portal/server/queries.ts"),
  ]);
  assert.doesNotMatch(sql + pagination + query, /veri\*?factu|aeat|fiscal_(?:record|attempt|evidence)|nif/i);
  assert.doesNotMatch(sql, /\b(?:delete|update|truncate)\b/i);
  assert.doesNotMatch(sql, /limit\s+100\b|deduplicat|archive/i);
  assert.match(sql, /portal_context\.organization_id = orders\.organization_id/);
  assert.match(pagination, /createdAt[\s\S]*id[\s\S]*direction/);
});
