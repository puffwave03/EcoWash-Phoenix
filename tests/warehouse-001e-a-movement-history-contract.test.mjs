import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260927000400_warehouse_001e_a_movement_history.sql";

test("history is tenant-scoped, append-only and begins without a backfill", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.warehouse_movements/);
  assert.match(sql, /warehouse_movements_order_same_org foreign key \(organization_id, order_id\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /warehouse_movements_select_management[\s\S]*has_organization_role\([\s\S]*'owner', 'manager'/);
  assert.match(sql, /warehouse_movements_append_only/);
  assert.match(sql, /revoke all on public\.warehouse_movements from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.warehouse_movements to authenticated/);
  const beforeFunctions = sql.slice(0, sql.indexOf("create function public.protect_warehouse_movements"));
  assert.doesNotMatch(beforeFunctions, /insert into public\.warehouse_movements|update public\.order_storage|delete from public\.order_storage/i);
});

test("one storage row mutation produces one atomic movement event", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create trigger order_storage_record_movement\s+after insert or update or delete on public\.order_storage/);
  assert.match(sql, /insert into public\.warehouse_movements \([\s\S]*movement_type, source/);
  assert.match(sql, /if new\.warehouse_position_id is not distinct from old\.warehouse_position_id[\s\S]*new\.package_count is not distinct from old\.package_count[\s\S]*new\.storage_mode is not distinct from old\.storage_mode then\s+return new/);
  assert.match(sql, /event_type := case when new\.warehouse_position_id is distinct from old\.warehouse_position_id\s+then 'moved' else 'updated' end/);
  assert.match(sql, /event_source := case when event_type = 'moved' then 'manual_move' else 'manual_update' end/);
  assert.doesNotMatch(sql, /exception when|dblink|pg_background/i);
});

test("canonical receipt remains the only automatic inbound and is idempotent", async () => {
  const [sql, custody] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260927000300_inbound_custody_sync_001.sql"),
  ]);
  assert.match(custody, /old\.production_status = 'draft' and new\.production_status = 'received'/);
  assert.match(sql, /create or replace function public\.ensure_warehouse_inbound_storage/);
  assert.match(sql, /if exists \([\s\S]*from public\.order_storage storage[\s\S]*return;/);
  assert.match(sql, /perform set_config\('app\.warehouse_movement_source', 'canonical_receipt', true\)/);
  assert.match(sql, /on conflict \(organization_id, order_id\) do nothing/);
  assert.match(sql, /event_source := case when movement_source = 'canonical_receipt'\s+then 'canonical_receipt'/);
  assert.doesNotMatch(sql, /shop_terminal_submissions|create_order|customer_portal_order_request/);
});

test("manual assignment, move and update use one authenticated tenant-scoped RPC", async () => {
  const [sql, action] = await Promise.all([source(migrationPath), source("src/features/warehouse/server/storage-actions.ts")]);
  assert.match(sql, /create function public\.save_order_storage_assignment/);
  assert.match(sql, /auth\.uid\(\) is null or not public\.has_organization_role\([\s\S]*'owner', 'manager'/);
  assert.match(sql, /orders\.organization_id = org_id[\s\S]*orders\.id = target_order_id/);
  assert.match(sql, /position\.organization_id = org_id[\s\S]*position\.location_id = order_location_id[\s\S]*position\.is_active/);
  assert.match(sql, /perform set_config\('app\.warehouse_movement_source', 'manual_storage', true\)/);
  assert.match(sql, /if storage_row\.id is null then[\s\S]*insert into public\.order_storage[\s\S]*else[\s\S]*update public\.order_storage/);
  assert.match(action, /await requireOwnerOrManager\(locale\)/);
  assert.match(action, /supabase\.rpc\("save_order_storage_assignment"/);
  assert.doesNotMatch(action, /admin\.from\("order_storage"\)\.(?:insert|update|delete)/);
});

test("normal final fulfillment exits retain their canonical RPCs and get distinct events", async () => {
  const [sql, fulfillment] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260926000100_final_fulfillment_storage_exit.sql"),
  ]);
  assert.match(fulfillment, /complete_customer_handoff[\s\S]*set_config\('app\.customer_handoff_mutation', 'on', true\)[\s\S]*delete from public\.order_storage/);
  assert.match(fulfillment, /transition_delivery_status[\s\S]*set_config\('app\.app_007_mutation', 'on', true\)[\s\S]*if target_status = 'completed' then\s+delete from public\.order_storage/);
  assert.match(sql, /app\.customer_handoff_mutation[\s\S]*event_source := 'customer_handoff'/);
  assert.match(sql, /app\.app_007_mutation[\s\S]*delivery\.status = 'completed'[\s\S]*event_source := 'delivery_completed'/);
  assert.doesNotMatch(sql, /create or replace function public\.(?:complete_customer_handoff|transition_delivery_status)/);
});

test("cancelled return requires owner/manager, cancelled status and current storage", async () => {
  const [sql, action, page] = await Promise.all([
    source(migrationPath),
    source("src/features/warehouse/server/storage-actions.ts"),
    source("src/app/[locale]/app/(dashboard)/warehouse/page.tsx"),
  ]);
  assert.match(sql, /create function public\.return_cancelled_order_from_warehouse/);
  assert.match(sql, /warehouse_return_not_authorized/);
  assert.match(sql, /order_status is distinct from 'cancelled'[\s\S]*warehouse_return_requires_cancelled_order/);
  assert.match(sql, /if storage_id is null then\s+raise exception 'warehouse_return_storage_missing'/);
  assert.match(sql, /set_config\('app\.warehouse_movement_source', 'cancelled_return', true\)[\s\S]*delete from public\.order_storage/);
  assert.doesNotMatch(sql, /update public\.orders|insert into public\.order_customer_handoffs|update public\.payments/i);
  assert.match(action, /formData\.get\("confirmed"\) !== "yes"/);
  assert.match(action, /rpc\("return_cancelled_order_from_warehouse"/);
  assert.match(page, /isCancelled \? <details[\s\S]*returnConfirm[\s\S]*name="confirmed" required/);
});

test("history remains visible without current storage and all five locales match", async () => {
  const [page, query, component] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/warehouse/server/queries.ts"),
    source("src/components/warehouse/WarehouseMovementHistory.tsx"),
  ]);
  assert.match(page, /listWarehouseMovements\(locale, order\.id\)/);
  assert.match(page, /<WarehouseMovementHistory/);
  assert.match(query, /await requireOwnerOrManager\(locale\)/);
  assert.match(query, /\.from\("warehouse_movements"\)[\s\S]*\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("order_id", orderId\)/);
  assert.match(component, /history\.length === 0/);
  assert.match(component, /movement\.fromPositionLabel[\s\S]*movement\.toPositionLabel/);
  const messages = await Promise.all(["it", "en", "es", "fr", "de"].map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`))));
  const shape = JSON.stringify(Object.keys(messages[0].warehouseMovements.labels).sort());
  for (const locale of messages) {
    assert.equal(JSON.stringify(Object.keys(locale.warehouseMovements.labels).sort()), shape);
    assert.ok(locale.warehouseOverview.returnConfirm);
    assert.ok(locale.warehouseOverview.confirmReturn);
  }
});
