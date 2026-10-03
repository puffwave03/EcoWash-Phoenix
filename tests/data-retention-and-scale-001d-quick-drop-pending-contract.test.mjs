import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20261003000200_data_retention_scale_001d_quick_drop_pending_completeness.sql";

test("pending discovery authorizes Terminal and uses one complete canonical RPC result", async () => {
  const query = (await source("src/features/quick-drop/server/queries.ts")).split("export async function listPendingQuickDrops")[1];
  assert.match(query, /requireShopTerminalAccess\(locale\)/);
  assert.match(query, /rpc\("list_pending_quick_drops"\)/);
  assert.match(query, /Array\.isArray\(data\)/);
  assert.match(query, /return data\.map\(/);
  assert.match(query, /customer_code === "WALKIN-SHARED" \? t\("occasionalCustomer"\)/);
  assert.doesNotMatch(query, /\.limit\(50\)|from\("order_status_history"\)|orderIds|detailedIds|changed_at/);
});

test("RPC has no tenant argument and enforces the established authenticated capability boundary", async () => {
  const sql = await source(migration);
  assert.match(sql, /create function public\.list_pending_quick_drops\(\)/);
  assert.match(sql, /returns jsonb[\s\S]*language plpgsql[\s\S]*stable[\s\S]*security definer[\s\S]*set search_path = public/);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /perform public\.require_shop_terminal_access\(org_id\)/);
  assert.match(sql, /revoke all on function public\.list_pending_quick_drops\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.list_pending_quick_drops\(\) to authenticated/);
  assert.doesNotMatch(sql, /target_organization_id|organization_id uuid\s*\)/);
});

test("RPC applies every current pending predicate before returning the queue", async () => {
  const sql = await source(migration);
  assert.match(sql, /orders\.organization_id = org_id/);
  assert.match(sql, /orders\.is_active/);
  assert.match(sql, /orders\.production_status = 'received'/);
  assert.match(sql, /orders\.received_at is not null/);
  assert.match(sql, /and exists \([\s\S]*from public\.order_status_history history[\s\S]*history\.organization_id = orders\.organization_id[\s\S]*history\.order_id = orders\.id[\s\S]*history\.metadata @> '\{"source":"quick_drop"\}'::jsonb/);
  assert.match(sql, /and not exists \([\s\S]*from public\.order_items item[\s\S]*item\.organization_id = orders\.organization_id[\s\S]*item\.order_id = orders\.id[\s\S]*item\.is_active/);
  assert.match(sql, /customer\.organization_id = orders\.organization_id/);
});

test("complete result is one JSON value ordered deterministically without SQL or API row cap", async () => {
  const sql = await source(migration);
  for (const field of ["id", "order_number", "received_at", "walk_in_name", "customer_code", "display_name"]) {
    assert.match(sql, new RegExp(`'${field}'`));
  }
  assert.match(sql, /jsonb_agg\([\s\S]*order by orders\.received_at desc, orders\.id desc/);
  assert.match(sql, /coalesce\([\s\S]*'\[\]'::jsonb/);
  assert.doesNotMatch(sql, /\blimit\b|\boffset\b/i);
});

test("an older pending order survives more than 50 newer Quick Drop source events", () => {
  const organizationId = "tenant-a";
  const older = { id: "older-pending", organizationId, active: true, status: "received", receivedAt: "2026-09-01" };
  const newer = Array.from({ length: 60 }, (_, index) => ({
    id: `newer-${index}`, organizationId, active: true, status: "completed", receivedAt: "2026-10-01",
  }));
  const orders = [...newer, older];
  const sources = orders.map((order) => ({ organizationId, orderId: order.id, source: "quick_drop" }));
  const activeItems = [];
  const oldHistoryWindow = new Set(sources.slice(0, 50).map((event) => event.orderId));
  assert.equal(oldHistoryWindow.has(older.id), false);
  const canonicalPending = orders.filter((order) => order.organizationId === organizationId
    && order.active && order.status === "received" && order.receivedAt !== null
    && sources.some((event) => event.organizationId === order.organizationId && event.orderId === order.id && event.source === "quick_drop")
    && !activeItems.some((item) => item.organizationId === order.organizationId && item.orderId === order.id && item.active));
  assert.deepEqual(canonicalPending.map((order) => order.id), [older.id]);
});

test("Terminal count uses the complete collection while only presentation starts at five", async () => {
  const [panel, page] = await Promise.all([
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
  ]);
  assert.match(panel, /text\.pendingList\} · \{pending\.length\}/);
  assert.match(panel, /visiblePending = showAllPending \? pending : pending\.slice\(0, 5\)/);
  assert.match(panel, /pending\.length > 5 \? <button/);
  assert.match(panel, /setShowAllPending\(\(value\) => !value\)/);
  assert.match(panel, /showAllPending \? text\.showFewerPending : text\.showAllPending/);
  assert.match(panel, /visiblePending\.map\(/);
  assert.match(panel, /max-h-72 overflow-y-auto/);
  assert.match(page, /showAllPending: quickDropT\("showAllPending", \{ count: pendingQuickDrops\.length \}\)/);
  assert.match(page, /showFewerPending: quickDropT\("showFewerPending"\)/);
});

test("all five locales provide compact queue controls", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.match(messages.quickDrop.showAllPending, /\{count\}/);
    assert.ok(messages.quickDrop.showFewerPending.length > 0);
  }
});

test("migration is read-only and leaves intake and production guard unchanged", async () => {
  const [sql, intake] = await Promise.all([
    source(migration),
    source("supabase/migrations/20260829000600_quick_drop_001a_canonical_intake.sql"),
  ]);
  assert.doesNotMatch(sql, /\b(update|delete|insert|alter table|create table|create index|drop function|create trigger)\b/i);
  assert.doesNotMatch(sql, /create_quick_drop_order|prevent_pending_quick_drop_production/);
  assert.match(intake, /create function public\.create_quick_drop_order/);
  assert.match(intake, /create function public\.prevent_pending_quick_drop_production/);
});
