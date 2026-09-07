import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260907000300_order_cancel_operations_001.sql";

test("A-B open scheduled or in-progress deliveries cancel with the order", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /if target_status = 'cancelled' then[\s\S]*update public\.deliveries[\s\S]*set status = 'cancelled'/);
  assert.match(sql, /update public\.deliveries[\s\S]*and status in \('scheduled', 'in_progress'\)/);
});

test("C open scheduled or in-progress pickups cancel with the order", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /if target_status = 'cancelled' then[\s\S]*update public\.pickups[\s\S]*set status = 'cancelled'/);
  assert.match(sql, /update public\.pickups[\s\S]*and status in \('scheduled', 'in_progress'\)/);
});

test("D-E completed and already-cancelled logistics are preserved", async () => {
  const sql = await source(migrationPath);
  const cascade = sql.slice(sql.indexOf("if target_status = 'cancelled' then"), sql.indexOf("insert into public.order_status_history"));
  assert.match(cascade, /status in \('scheduled', 'in_progress'\)/);
  assert.doesNotMatch(cascade, /status in \([^)]*'completed'/);
  assert.doesNotMatch(cascade, /status in \([^)]*'cancelled'/);
});

test("F logistics reuse the required normalized order cancellation reason", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /reason_text := nullif\(btrim\(target_reason\), ''\)/);
  assert.match(sql, /target_status in \('on_hold', 'cancelled'\) and reason_text is null[\s\S]*raise exception 'reason required'/);
  assert.equal((sql.match(/cancellation_reason = reason_text/g) ?? []).length, 2);
});

test("cancellation remains tenant-scoped and atomic inside transition_order_status", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create or replace function public\.transition_order_status\(/);
  assert.equal((sql.match(/where organization_id = org_id[\s\S]*?order_id = target_order_id/g) ?? []).length, 2);
  assert.match(sql, /perform set_config\('app\.app_007_mutation', 'on', true\)/);
  assert.doesNotMatch(sql, /commit;|exception when/i);
  assert.doesNotMatch(sql, /delete from public\.(?:pickups|deliveries)/i);
});

test("G order cancellation does not mutate financial records", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /public\.(?:payments|invoices|refunds|accounting_entries)/i);
  assert.doesNotMatch(sql, /record_pos_payment|refund_payment|void_payment/i);
});

test("H daily close already counts only open logistics states", async () => {
  const dailyClose = await source("src/features/daily-close/server/queries.ts");
  const pickups = dailyClose.slice(dailyClose.indexOf('.from("pickups")'), dailyClose.indexOf('.from("deliveries")'));
  const deliveries = dailyClose.slice(dailyClose.indexOf('.from("deliveries")'), dailyClose.indexOf("if (ordersResult.error)"));
  assert.match(pickups, /\.in\("status", \["scheduled", "in_progress"\]\)/);
  assert.match(deliveries, /\.in\("status", \["scheduled", "in_progress"\]\)/);
});
