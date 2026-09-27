import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260927000200_warehouse_001d_b1_automatic_inbound_storage.sql";

// The migration is intentionally unapplied: these contracts check its canonical boundaries.
test("1 counter submission finalization stages Quick Drop and Terminal inside their RPC transactions", async () => {
  const [sql, quickDrop, terminal] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql"),
    source("supabase/migrations/20260907000200_terminal_operational_checkout_001.sql"),
  ]);
  assert.match(quickDrop, /create function public\.create_quick_drop_order[\s\S]*update public\.shop_terminal_submissions submission\s+set order_id = received_order\.id/);
  assert.match(terminal, /create function public\.submit_shop_terminal_order[\s\S]*update public\.shop_terminal_submissions submission\s+set order_id = created_order\.id/);
  assert.match(sql, /create trigger shop_terminal_submission_inbound_storage\s+after update of order_id on public\.shop_terminal_submissions/);
  assert.match(sql, /old\.order_id is null and new\.order_id is not null/);
  assert.match(sql, /perform public\.ensure_warehouse_inbound_storage\(\s*new\.organization_id, new\.order_id/);
});

test("2 counter idempotent retries cannot duplicate storage", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /on conflict \(organization_id, order_id\) do nothing/);
  assert.match(sql, /old\.order_id is null and new\.order_id is not null/);
  const [quickDrop, terminal] = await Promise.all([
    source("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql"),
    source("supabase/migrations/20260907000200_terminal_operational_checkout_001.sql"),
  ]);
  assert.match(quickDrop, /if existing_submission\.idempotency_key is not null then[\s\S]*return;/);
  assert.match(terminal, /if existing_submission\.idempotency_key is not null then[\s\S]*return;/);
});

test("3 pickup stages only on actual completed transition within the canonical update", async () => {
  const [sql, rpc] = await Promise.all([source(migrationPath), source("supabase/migrations/20260908000300_order_fulfillment_lifecycle_001.sql")]);
  assert.match(sql, /create trigger pickup_completion_inbound_storage\s+after update of status on public\.pickups/);
  assert.match(sql, /old\.status is distinct from 'completed' and new\.status = 'completed'/);
  assert.match(sql, /new\.organization_id, new\.order_id, new\.completed_at/);
  assert.match(rpc, /create or replace function public\.transition_pickup_status[\s\S]*update public\.pickups\s+set status = target_status/);
});

test("4 current placement is preserved and location validated before staging", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /join public\.locations location[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null[\s\S]*for update of orders/);
  assert.match(sql, /if exists \([\s\S]*from public\.order_storage storage[\s\S]*storage\.order_id = target_order_id[\s\S]*return;/);
  assert.doesNotMatch(sql, /update public\.order_storage|delete from public\.order_storage/i);
});

test("5 inbound position uses only explicit active same-tenant/location default", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /position\.organization_id = target_organization_id[\s\S]*position\.location_id = order_location_id[\s\S]*position\.is_default_inbound[\s\S]*position\.is_active[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.doesNotMatch(sql, /position\.code|position\.name|position\.position_type|position\.description/);
  assert.match(sql, /target_organization_id is distinct from public\.app_current_organization_id\(\)/);
});

test("6 missing inbound position raises and rolls back the enclosing canonical operation", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /if inbound_position_id is null then\s+raise exception 'warehouse_default_inbound_unavailable:/);
  assert.match(sql, /execute function public\.stage_counter_submission_order\(\)/);
  assert.match(sql, /execute function public\.stage_completed_inbound_pickup\(\)/);
  assert.doesNotMatch(sql, /exception when|dblink|pg_background/);
});

test("7 initial storage values use physical intake timestamps and neutral minimum", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /1, 'other'::public\.order_storage_mode, coalesce\(target_entered_at, now\(\)\)/);
  assert.match(sql, /coalesce\(physical_intake_at, now\(\)\)/);
  assert.match(sql, /new\.completed_at/);
});

test("8 generic Order, Portal, production and final fulfillment stay outside intake hook", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /trigger.*\bon public\.(orders|order_status_history|deliveries|order_customer_handoffs)/i);
  assert.doesNotMatch(sql, /create or replace function public\.(create_order|create_customer_portal_order_request|transition_order_status|transition_delivery_status|complete_customer_handoff)/);
  assert.doesNotMatch(sql, /payments|daily_close|production_status/);
});

test("9 counter and pickup surfaces expose localized configuration failure", async () => {
  const [quickDrop, terminal, pickup, orderPage, workspacePage] = await Promise.all([
    source("src/features/quick-drop/server/actions.ts"),
    source("src/features/shop-terminal/server/actions.ts"),
    source("src/features/logistics/server/actions.ts"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/work/pickups/[pickupId]/page.tsx"),
  ]);
  for (const file of [quickDrop, terminal, pickup]) assert.match(file, /warehouse_default_inbound_unavailable/);
  assert.match(orderPage, /warehouseInboundUnavailable/);
  assert.match(workspacePage, /warehouseInboundUnavailable/);
});

test("10 five locales have the same actionable inbound message", async () => {
  const messages = await Promise.all(["en", "it", "es", "fr", "de"].map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`))));
  for (const message of messages) assert.ok(message.warehouseInboundUnavailable.length > 40);
});
