import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const cascadeMigration = "supabase/migrations/20260907000300_order_cancel_operations_001.sql";
const correctiveMigration = "supabase/migrations/20260912000100_order_cancel_logistics_consistency_001.sql";

function functionBody(sql, name, nextName = null) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = nextName
    ? sql.indexOf(`create or replace function public.${nextName}(`, start)
    : sql.length;

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  return sql.slice(start, end);
}

test("1-2 order cancellation still cancels scheduled and in-progress pickup and delivery", async () => {
  const sql = await source(cascadeMigration);

  for (const table of ["pickups", "deliveries"]) {
    assert.match(sql, new RegExp(`update public\\.${table}[\\s\\S]*set status = 'cancelled'[\\s\\S]*status in \\('scheduled', 'in_progress'\\)`));
  }
});

test("3-4 pickup and delivery writes reject cancelled and inactive parents authoritatively", async () => {
  const sql = await source(correctiveMigration);
  const pickup = functionBody(sql, "create_or_update_pickup", "create_or_update_delivery");
  const delivery = functionBody(sql, "create_or_update_delivery");

  for (const body of [pickup, delivery]) {
    assert.match(body, /and orders\.organization_id = org_id/);
    assert.match(body, /and orders\.is_active\s+for update;/);
    assert.match(body, /if parent_status is null or parent_status = 'cancelled' then\s+raise exception 'invalid order';/);
  }
});

test("5-7 Daily Close includes due work and excludes correctly scheduled future work", async () => {
  const dailyClose = await source("src/features/daily-close/server/queries.ts");

  assert.match(dailyClose, /function isDueForClose\(row: LogisticsRow, end: Date\)/);
  assert.match(dailyClose, /return Boolean\(row\.scheduled_at && new Date\(row\.scheduled_at\) <= end\)/);
  assert.equal((dailyClose.match(/\.filter\(\(row\) => isDueForClose\(row, end\)\)/g) ?? []).length, 2);
});

test("8 Daily Close excludes logistics under cancelled or inactive parents", async () => {
  const dailyClose = await source("src/features/daily-close/server/queries.ts");

  assert.match(dailyClose, /import \{ isOperationalLogisticsParent \}/);
  assert.match(dailyClose, /isOperationalLogisticsParent\(\{\s+isActive: order\.is_active,\s+productionStatus: order\.production_status,/);
  assert.equal((dailyClose.match(/order:orders![^\n]+production_status, is_active/g) ?? []).length, 2);
});

test("9 in-progress logistics remains visible regardless of unusual schedule", async () => {
  const dailyClose = await source("src/features/daily-close/server/queries.ts");

  assert.match(dailyClose, /if \(row\.status === "in_progress"\) return true;/);
});

test("10 Daily Close uses the tenant-local closing-day boundary", async () => {
  const dailyClose = await source("src/features/daily-close/server/queries.ts");

  assert.match(dailyClose, /todayWindow\(membership\.organization\.timezone\)/);
  assert.equal((dailyClose.match(/isDueForClose\(row, end\)/g) ?? []).length, 2);
});

test("11 draft-order logistics configurability remains supported", async () => {
  const sql = await source(correctiveMigration);

  assert.doesNotMatch(sql, /parent_status\s*=\s*'draft'|parent_status\s+in\s*\([^)]*'draft'/);
  assert.equal((sql.match(/parent_status is null or parent_status = 'cancelled'/g) ?? []).length, 2);
});

test("12 reconciliation changes only open logistics and preserves historical rows", async () => {
  const sql = await source(correctiveMigration);
  const reconciliation = sql.slice(0, sql.indexOf("create or replace function"));

  assert.equal((reconciliation.match(/status in \('scheduled', 'in_progress'\)/g) ?? []).length, 2);
  assert.doesNotMatch(reconciliation, /status in \([^)]*'completed'|status in \([^)]*'cancelled'/);
  assert.doesNotMatch(reconciliation, /delete from public\.(?:pickups|deliveries)/i);
  assert.equal((reconciliation.match(/orders\.organization_id = (?:pickup|delivery)\.organization_id/g) ?? []).length, 2);
  assert.equal((reconciliation.match(/cancellation_reason = orders\.cancellation_reason/g) ?? []).length, 2);
});

test("cancelled-order logistics configuration is read-only in the UI", async () => {
  const [page, panel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/components/logistics/LogisticsPanel.tsx"),
  ]);

  assert.match(page, /configurationEnabled=\{order\.isActive && order\.productionStatus !== "cancelled"\}/);
  assert.match(panel, /disabled=\{!editable\}/);
  assert.match(panel, /\{editable \? <Button/);
  assert.equal((panel.match(/\{configurationEnabled \? <TransitionButtons/g) ?? []).length, 2);
});
