import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260920000100_daily_close_post_close_gate_001.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("1 shared gate derives the business date in the tenant timezone", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /select organization\.timezone[\s\S]*organization\.id = target_organization_id/);
  assert.match(sql, /coalesce\(target_occurred_at, now\(\)\) at time zone organization_timezone\)::date/);
});

test("2 organization close blocks every location while location close is exact", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /daily_close\.organization_id = target_organization_id/);
  assert.match(sql, /daily_close\.business_date = target_business_date/);
  assert.match(sql, /daily_close\.location_id is null or daily_close\.location_id = target_location_id/);
});

test("3 gate uses the same scope lock key as definitive close", async () => {
  const [gate, close] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260919000200_pos_daily_close_001_p2a.sql"),
  ]);
  assert.match(gate, /:daily-close-scope:/);
  assert.match(gate, /pg_advisory_xact_lock_shared/);
  assert.match(close, /pg_advisory_xact_lock\(hashtextextended\(org_id::text \|\| ':daily-close-scope:'/);
});

test("4 normal internal order creation reaches the canonical order guard", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /before insert or update on public\.orders/);
  assert.match(sql, /tg_op = 'INSERT'[\s\S]*assert_business_day_open/);
});

test("5 Shop Terminal compound creation reaches the same canonical order guard", async () => {
  const [sql, shop] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260907000200_terminal_operational_checkout_001.sql"),
  ]);
  assert.match(shop, /from public\.create_order\(/);
  assert.match(sql, /daily_close_internal_orders_gate/);
});

test("6 Quick Drop creation reaches the same canonical order guard", async () => {
  const [sql, quickDrop] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql"),
  ]);
  assert.match(quickDrop, /create function public\.create_quick_drop_order[\s\S]*from public\.create_order\(/);
  assert.match(sql, /daily_close_internal_orders_gate/);
});

test("7 POS opening is protected at the canonical session insert", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /before insert on public\.pos_sessions/);
  assert.match(sql, /new\.location_id, new\.opened_at/);
});

test("8 internal payments are protected using canonical paid_at", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /before insert on public\.payments/);
  assert.match(sql, /new\.organization_id,[\s\S]*order_location_id,[\s\S]*new\.paid_at/);
});

test("9 refunds use the same immutable payment-row guard", async () => {
  const [sql, pos] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql"),
  ]);
  assert.match(pos, /create function public\.record_pos_refund[\s\S]*insert into public\.payments/);
  assert.match(sql, /daily_close_internal_payments_gate/);
});

test("10 payment scope is derived from the canonical order location", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /select orders\.location_id[\s\S]*orders\.organization_id = new\.organization_id[\s\S]*orders\.id = new\.order_id/);
});

test("11 financial totals and payment canon are not redefined", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /create (or replace )?function public\.(record_pos_payment|record_pos_refund|calculate_daily_close_snapshot)/);
  assert.doesNotMatch(sql, /update public\.payments|delete from public\.payments/);
});

test("12 production status and order total changes are protected", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /new\.production_status is distinct from old\.production_status/);
  assert.match(sql, /new\.subtotal is distinct from old\.subtotal/);
  assert.match(sql, /new\.discount_amount is distinct from old\.discount_amount/);
  assert.match(sql, /new\.total is distinct from old\.total/);
});

test("13 pickup and delivery mutations use the shared location-scoped guard", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /before insert or update on public\.pickups/);
  assert.match(sql, /before insert or update on public\.deliveries/);
  assert.match(sql, /enforce_internal_logistics_business_day_open/);
});

test("14 final customer handoff is protected without a redundant handoff rule", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /before insert on public\.order_customer_handoffs/);
  assert.match(sql, /new\.location_id,[\s\S]*new\.completed_at/);
  assert.doesNotMatch(sql, /create (or replace )?function public\.complete_customer_handoff/);
});

test("15 Owner Manager and Staff retain their existing capability boundary", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /array\['owner', 'manager', 'staff'\]::public\.app_role\[\]/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to (anon|authenticated)/i);
});

test("16 tenant isolation stays row-derived and never accepts client organization context", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /new\.organization_id/);
  assert.doesNotMatch(sql, /app_current_organization_id\(\)[\s\S]*:= target_organization_id/);
});

test("17 next tenant-local date is evaluated independently", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /target_business_date :=/);
  assert.doesNotMatch(sql, /business_date\s*<=\s*target_business_date|order by business_date desc limit 1/i);
});

test("18 historical facts and persisted close snapshots remain untouched", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /\b(update|delete from|truncate)\s+public\.(orders|payments|pos_sessions|daily_closes|pickups|deliveries|order_customer_handoffs)\b/i);
  assert.doesNotMatch(sql, /alter table public\.daily_closes/i);
});

test("19 Portal intake remains unchanged and is explicitly excluded", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /PORTAL-AFTER-CLOSE-INTAKE-001/);
  assert.match(sql, /Portal users are not organization members/);
  assert.doesNotMatch(sql, /create_customer_portal_order_request|customer_portal_order_request_catalog_001/);
});

test("20 hosted online settlement remains outside the internal gate", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /new\.channel <> 'online'/);
  assert.doesNotMatch(sql, /create (or replace )?function public\.settle_online_payment_attempt/);
});

test("21 authoritative functions and trigger helpers retain least privilege", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /security definer[\s\S]*set search_path = public/);
  assert.match(sql, /revoke all on function public\.assert_business_day_open[\s\S]*from public, anon, authenticated/);
  assert.equal((sql.match(/revoke all on function public\.enforce_/g) ?? []).length, 5);
});

test("22 server actions map the closed-day error to specific UI states", async () => {
  const [orders, shop, quickDrop, pos] = await Promise.all([
    source("src/features/orders/server/actions.ts"),
    source("src/features/shop-terminal/server/actions.ts"),
    source("src/features/quick-drop/server/actions.ts"),
    source("src/features/pos/server/actions.ts"),
  ]);
  assert.match(orders, /isBusinessDayClosedError\(error\)[\s\S]*fail\("closedDay"\)/);
  assert.match(shop, /isBusinessDayClosedError\(error\)[\s\S]*"closedDay"/);
  assert.match(quickDrop, /isBusinessDayClosedError\(error\) \? "closedDay"/);
  assert.match(pos, /isBusinessDayClosedError\(error\) \? "closedDayOpen"/);
  assert.equal((pos.match(/isBusinessDayClosedError\(error\)/g) ?? []).length, 3);
});

test("23 mobile and desktop surfaces render the specific blocked message", async () => {
  const [orderForm, shop, quickDrop, pos] = await Promise.all([
    source("src/components/orders/OrderForm.tsx"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
    source("src/components/pos/PosWorkspace.tsx"),
  ]);
  assert.match(orderForm, /state\.formError === "closedDay" \? text\.closedDay/);
  assert.match(shop, /submitState\.error === "closedDay" \? text\.errorClosedDay/);
  assert.match(quickDrop, /result\.error === "closedDay" \? text\.errorClosedDay/);
  assert.match(pos, /text\.errors\[state\.formError/);
  assert.match(shop, /data-terminal-mobile-mini-cart/);
});

test("24 all five locales provide equivalent gate messages", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.postCloseGate.general.trim(), `${locale}.postCloseGate.general`);
    assert.ok(messages.postCloseGate.terminal.trim(), `${locale}.postCloseGate.terminal`);
    assert.ok(messages.pos.errors.closedDay.trim(), `${locale}.pos.errors.closedDay`);
    assert.ok(messages.pos.errors.closedDayOpen.trim(), `${locale}.pos.errors.closedDayOpen`);
  }
});

test("25 migration is forward-only and adds no schema data rewrite", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /drop (table|column)|truncate|alter table|delete from/i);
  assert.doesNotMatch(sql, /insert into public\.daily_closes/);
  assert.doesNotMatch(sql, /EW-000095|e09f1e0b-1c4d-4450-9a30-79999bee545a/);
});
