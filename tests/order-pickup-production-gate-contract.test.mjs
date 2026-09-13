import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deriveOrderDisplayStatus,
  hasInboundPickupProductionAnomaly,
} from "../src/features/orders/display-status.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260913000100_order_pickup_production_gate_001.sql";

function functionBody(sql, name, nextName = null) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = nextName
    ? sql.indexOf(`create or replace function public.${nextName}(`, start)
    : sql.length;
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return sql.slice(start, end);
}

test("1-7 production RPC gates only actual production on active inbound pickup", async () => {
  const sql = await source(migrationPath);
  const transition = functionBody(sql, "transition_order_status", "create_or_update_pickup");

  assert.match(transition, /where id = target_order_id\s+and organization_id = org_id\s+and is_active\s+for update/);
  assert.match(transition, /target_status in \('washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed'\)/);
  assert.match(transition, /pickup\.organization_id = org_id\s+and pickup\.order_id = target_order_id\s+and pickup\.status in \('scheduled', 'in_progress'\)/);
  assert.match(transition, /raise exception 'inbound_pickup_incomplete'/);
  assert.match(transition, /current_status = 'received'[\s\S]*target_status in \('washing', 'ironing', 'quality_check', 'on_hold', 'cancelled'\)/);
  assert.doesNotMatch(transition, /from public\.deliveries[\s\S]*inbound_pickup_incomplete/);
  assert.match(transition, /if current_status in \('completed', 'cancelled'\) then\s+raise exception 'final status cannot transition'/);
});

test("8 inverse guard rejects a new or pending pickup after production started", async () => {
  const sql = await source(migrationPath);
  const pickup = functionBody(sql, "create_or_update_pickup");

  assert.match(pickup, /production_started := parent_status in \([\s\S]*'completed'[\s\S]*\) or exists/);
  assert.match(pickup, /history\.organization_id = org_id\s+and history\.order_id = target_order_id/);
  assert.match(pickup, /target_pickup_id is null or existing_status in \('scheduled', 'in_progress'\)/);
  assert.match(pickup, /raise exception 'production_already_started'/);
  assert.doesNotMatch(pickup, /update public\.orders|update public\.order_status_history/);
});

test("9 impossible pending-pickup plus advanced-production state is deterministic", () => {
  assert.equal(hasInboundPickupProductionAnomaly({ pickupStatus: "scheduled", productionStatus: "completed" }), true);
  assert.equal(hasInboundPickupProductionAnomaly({ pickupStatus: "in_progress", productionStatus: "washing" }), true);
  assert.equal(hasInboundPickupProductionAnomaly({ pickupStatus: "completed", productionStatus: "completed" }), false);
  assert.equal(hasInboundPickupProductionAnomaly({ isActive: false, pickupStatus: "scheduled", productionStatus: "completed" }), false);
});

test("10-15 display precedence distinguishes inbound pickup, delivery, and final collection", () => {
  assert.equal(deriveOrderDisplayStatus({ pickupStatus: "scheduled", productionStatus: "received" }), "pickup_scheduled");
  assert.equal(deriveOrderDisplayStatus({ pickupStatus: "in_progress", productionStatus: "received" }), "pickup_in_progress");
  assert.equal(deriveOrderDisplayStatus({ pickupStatus: "scheduled", productionStatus: "completed" }), "pickup_scheduled");
  assert.equal(deriveOrderDisplayStatus({ pickupStatus: "completed", productionStatus: "completed" }), "ready_for_customer_pickup");
  assert.equal(deriveOrderDisplayStatus({ deliveryStatus: "completed", pickupStatus: "completed", productionStatus: "completed" }), "completed");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed" }), "ready_for_customer_pickup");
});

test("16 tenant scope and existing authorization remain explicit in both RPCs", async () => {
  const sql = await source(migrationPath);
  for (const body of [
    functionBody(sql, "transition_order_status", "create_or_update_pickup"),
    functionBody(sql, "create_or_update_pickup"),
  ]) {
    assert.match(body, /org_id := public\.app_current_organization_id\(\)/);
    assert.match(body, /organization_id = org_id/);
  }
  assert.match(sql, /has_operational_capability/);
  assert.match(sql, /has_organization_role/);
});

test("17 draft pickup configuration and normal counter flow remain available", async () => {
  const sql = await source(migrationPath);
  const pickup = functionBody(sql, "create_or_update_pickup");
  const transition = functionBody(sql, "transition_order_status", "create_or_update_pickup");

  assert.doesNotMatch(pickup, /parent_status\s*=\s*'draft'|parent_status in \([^)]*'draft'/);
  assert.match(transition, /current_status = 'draft'[\s\S]*target_status in \('received', 'cancelled'\)/);
});

test("18 Daily Close counts outbound delivery, never inbound pickup, as final fulfillment", async () => {
  const dailyClose = await source("src/features/daily-close/server/queries.ts");
  const finalCount = dailyClose.slice(
    dailyClose.indexOf("orderSummary.finalFulfillmentCompleted ="),
    dailyClose.indexOf("if (accountingResult.status", dailyClose.indexOf("orderSummary.finalFulfillmentCompleted =")),
  );

  assert.match(finalCount, /value\.completedDeliveries/);
  assert.doesNotMatch(finalCount, /completedPickups|pickupStatuses|pickup.*completed_at/i);
  assert.match(finalCount, /order\.production_status === "completed"/);
});

test("workspaces block production actions and alerts reuse shared anomaly detection", async () => {
  const [production, myDay, alerts, detail] = await Promise.all([
    source("src/features/production/server/queries.ts"),
    source("src/features/work/server/queries.ts"),
    source("src/features/alerts/server/queries.ts"),
    source("src/components/production/ProductionDetail.tsx"),
  ]);

  assert.match(production, /productionBlockedByPickup/);
  assert.match(production, /ACTUAL_PRODUCTION_STATUSES\.includes\(status\)/);
  assert.match(myDay, /hasPendingInboundPickup\(pickupStatus\)/);
  assert.match(alerts, /hasInboundPickupProductionAnomaly/);
  assert.match(alerts, /"lifecycle_integrity", "critical"/);
  assert.match(detail, /task\.productionBlockedByPickup/);
  assert.match(detail, /text\.pickupBlocked/);
});

test("migration performs no legacy data rewrite", async () => {
  const sql = await source(migrationPath);
  const preamble = sql.slice(0, sql.indexOf("create or replace function"));
  assert.doesNotMatch(preamble, /update public\.|delete from|truncate/i);
});

test("all five locales expose the new lifecycle states, blocker, and anomaly", async () => {
  for (const locale of ["de", "en", "es", "fr", "it"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.orders.displayStatuses.pickup_scheduled);
    assert.ok(messages.orders.displayStatuses.pickup_in_progress);
    assert.ok(messages.orders.displayStatuses.ready_for_customer_pickup);
    assert.ok(messages.orders.lifecycleAnomaly);
    assert.ok(messages.production.pickupBlocked);
    assert.ok(messages.qualityWorkspace.pickupBlocked);
    assert.ok(messages.alerts.types.lifecycle_integrity);
  }
});
