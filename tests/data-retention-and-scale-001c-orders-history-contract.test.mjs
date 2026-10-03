import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  decodeOrderCursor,
  encodeOrderCursor,
  orderCursorBoundary,
  orderFilterKey,
  orderHistoryHref,
  ORDERS_PAGE_SIZE,
  paginateOrderRows,
} from "../src/features/orders/pagination.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const queries = read("src/features/orders/server/queries.ts");
const page = read("src/app/[locale]/app/(dashboard)/orders/page.tsx");
const migration = read("supabase/migrations/20261003000100_data_retention_scale_001c_orders_history_index.sql");
const originalMigration = read("supabase/migrations/20260728000200_app_006_orders_workflow.sql");
const filters = { active: "active", priority: "all", query: "", status: "all" };
const ordered = Array.from({ length: 65 }, (_, number) => ({
  created_at: number < 40 ? "2026-10-03T12:00:00+00:00" : "2026-10-02T12:00:00+00:00",
  id: `00000000-0000-4000-8000-${String(65 - number).padStart(12, "0")}`,
}));

function fetchPage(token, source = ordered) {
  const cursor = decodeOrderCursor(token, filters);
  const ascending = cursor?.direction === "newer";
  const selected = source.filter((row) => {
    if (!cursor) return true;
    const key = row.created_at.localeCompare(cursor.createdAt) || row.id.localeCompare(cursor.id);
    return ascending ? key > 0 : key < 0;
  }).sort((a, b) => {
    const key = a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    return ascending ? key : -key;
  }).slice(0, ORDERS_PAGE_SIZE + 1);
  return paginateOrderRows(selected, cursor, filters);
}

test("the approved migration adds exactly one canonical index and preserves the existing one", () => {
  assert.match(migration.trim(), /^create index orders_org_created_id_idx\s+on public\.orders\s*\(\s*organization_id,\s*created_at desc,\s*id desc\s*\);$/i);
  assert.equal((migration.match(/create index/gi) ?? []).length, 1);
  assert.doesNotMatch(migration, /\b(?:alter|drop|function|policy|grant|revoke)\b/i);
  assert.match(originalMigration, /create index orders_list_idx\s+on public\.orders \(organization_id, production_status, is_active, created_at desc\)/);
});

test("Orders query uses one scoped keyset OR, 26 rows, deterministic order and visible-only enrichment", () => {
  const history = queries.slice(queries.indexOf("export async function listOrders("), queries.indexOf("export async function listProductionQueueOrders("));
  assert.doesNotMatch(history, /\.limit\(100\)/);
  assert.match(history, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(history, /\.order\("created_at", \{ ascending \}\)\s*\.order\("id", \{ ascending \}\)/);
  assert.match(history, /if \(filters\.status !== "all"\)[\s\S]*if \(filters\.priority !== "all"\)[\s\S]*if \(filters\.active === "active"\)[\s\S]*if \(filters\.active === "cancelled"\)[\s\S]*if \(filters\.query\)/);
  assert.match(history, /query = query\.ilike\("order_number", `%\$\{search\}%`\)/);
  assert.match(history, /if \(cursor\) query = query\.or\(orderCursorBoundary\(cursor\)\)/);
  assert.equal((history.match(/query\.or\(/g) ?? []).length, 1);
  assert.match(history, /query = query\.limit\(ORDERS_PAGE_SIZE \+ 1\)/);
  assert.ok(history.indexOf("const { visible, pagination } = paginateOrderRows(data, cursor, filters)") < history.indexOf("const orderIds = visible.map((row) => row.id)"));
  assert.match(history, /orders: visible\.map\(\(row\) =>/);
  assert.match(history, /deriveOrderDisplayStatus\(/);
  assert.match(history, /hasInboundPickupProductionAnomaly\(/);
});

test("cursor validates both key fields, direction, version and normalized filters without tenant state", () => {
  assert.equal(ORDERS_PAGE_SIZE, 25);
  const position = ordered[24];
  const token = encodeOrderCursor({ createdAt: position.created_at, id: position.id }, "older", filters);
  const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(payload).sort(), ["createdAt", "direction", "filterKey", "id", "v"]);
  assert.equal(payload.filterKey, orderFilterKey(filters));
  assert.deepEqual(decodeOrderCursor(token, filters), { createdAt: position.created_at, id: position.id, direction: "older" });
  assert.equal(decodeOrderCursor(token, { ...filters, active: "all" }), null);
  assert.equal(decodeOrderCursor("not-a-cursor", filters), null);
  for (const altered of [
    { ...payload, v: 2 },
    { ...payload, id: "invalid" },
    { ...payload, createdAt: "2026-02-31T12:00:00Z" },
    { ...payload, direction: "sideways" },
  ]) {
    assert.equal(decodeOrderCursor(Buffer.from(JSON.stringify(altered)).toString("base64url"), filters), null);
  }
  assert.equal(decodeOrderCursor(token, { ...filters, query: "different" }), null);
});

test("older and newer boundaries use inverse two-column comparisons", () => {
  const position = ordered[24];
  assert.equal(orderCursorBoundary({ createdAt: position.created_at, id: position.id, direction: "older" }),
    `created_at.lt.${position.created_at},and(created_at.eq.${position.created_at},id.lt.${position.id})`);
  assert.equal(orderCursorBoundary({ createdAt: position.created_at, id: position.id, direction: "newer" }),
    `created_at.gt.${position.created_at},and(created_at.eq.${position.created_at},id.gt.${position.id})`);
});

test("tie-heavy history traverses page 1 → 2 → 3 → 2 → 1 without missing, duplicate or sentinel rows", () => {
  const first = fetchPage();
  const second = fetchPage(first.pagination.olderCursor);
  const third = fetchPage(second.pagination.olderCursor);
  assert.deepEqual([first.visible.length, second.visible.length, third.visible.length], [25, 25, 15]);
  assert.deepEqual([...first.visible, ...second.visible, ...third.visible].map((row) => row.id), ordered.map((row) => row.id));
  assert.deepEqual(fetchPage(third.pagination.newerCursor).visible, second.visible);
  assert.deepEqual(fetchPage(second.pagination.newerCursor).visible, first.visible);
  assert.equal(first.pagination.hasNewer, false);
  assert.equal(first.pagination.hasOlder, true);
  assert.equal(second.pagination.hasNewer, true);
  assert.equal(second.pagination.hasOlder, true);
  assert.equal(third.pagination.hasNewer, true);
  assert.equal(third.pagination.hasOlder, false);
});

test("cursor position remains usable when its boundary row changes or a newer order arrives", () => {
  const first = fetchPage();
  const boundaryId = first.visible.at(-1).id;
  const withoutBoundary = ordered.filter((row) => row.id !== boundaryId);
  const second = fetchPage(first.pagination.olderCursor, withoutBoundary);
  assert.equal(second.visible[0].id, ordered[25].id);
  const newest = { created_at: "2026-10-04T12:00:00+00:00", id: "00000000-0000-4000-8000-000000000999" };
  const withNewOrder = [newest, ...ordered];
  assert.deepEqual(fetchPage(first.pagination.olderCursor, withNewOrder).visible, fetchPage(first.pagination.olderCursor).visible);
});

test("links retain all filters while filter submission resets cursor", () => {
  const selected = { active: "all", priority: "express", query: "A 100", status: "completed" };
  const token = encodeOrderCursor(ordered[24], "older", selected);
  const href = orderHistoryHref(selected, token);
  const url = new URL(href, "https://example.invalid");
  assert.equal(url.pathname, "/app/orders");
  for (const [key, value] of Object.entries({ q: "A 100", status: "completed", priority: "express", active: "all", cursor: token })) {
    assert.equal(url.searchParams.get(key), value);
  }
  assert.equal(new URL(orderHistoryHref(selected), "https://example.invalid").searchParams.has("cursor"), false);
  assert.match(page, /<form action=\{`\/\$\{locale\}\/app\/orders`\}[^>]*method="get"/);
  assert.doesNotMatch(page.slice(page.indexOf("<form"), page.indexOf("<\/form>")), /name="cursor"/);
  assert.match(page, /listOrders\(locale, filters, rawFilters\.cursor\)/);
  for (const key of ["newerCursor", "olderCursor", "latestOrders"]) assert.match(page, new RegExp(key));
});

test("all five Orders locales provide accessible history navigation labels and valid JSON", () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
    for (const key of ["historyNavigation", "newerOrders", "olderOrders", "latestOrders"]) {
      assert.ok(messages.orders[key], `${locale}: ${key}`);
    }
    assert.equal(messages.customers.historyNavigation, undefined);
  }
  assert.match(page, /<nav aria-label=\{t\("historyNavigation"\)\}/);
});
