import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isOperationalLogisticsParent } from "../src/features/logistics/lifecycle.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("1 draft pickup is excluded from dashboard operational signals", async () => {
  const dashboard = await source("src/features/dashboard/server/queries.ts");

  assert.equal(isOperationalLogisticsParent({ isActive: true, productionStatus: "draft" }), false);
  assert.match(dashboard, /todayPickups: operationalLogisticsRows\(pickupsTodayResult\.data \?\? \[\]\)/);
});

test("2 draft delivery is excluded from dashboard operational signals", async () => {
  const dashboard = await source("src/features/dashboard/server/queries.ts");

  assert.equal(isOperationalLogisticsParent({ isActive: true, productionStatus: "draft" }), false);
  assert.match(dashboard, /todayDeliveries: operationalLogisticsRows\(deliveriesTodayResult\.data \?\? \[\]\)/);
});

test("3 received parent with open logistics remains eligible", () => {
  assert.equal(isOperationalLogisticsParent({ isActive: true, productionStatus: "received" }), true);
});

test("4 ready parent with open logistics remains eligible", () => {
  assert.equal(isOperationalLogisticsParent({ isActive: true, productionStatus: "ready" }), true);
});

test("5 completed-production parent with open logistics remains eligible", () => {
  assert.equal(isOperationalLogisticsParent({ isActive: true, productionStatus: "completed" }), true);
});

test("6 cancelled and inactive parents are excluded", () => {
  assert.equal(isOperationalLogisticsParent({ isActive: true, productionStatus: "cancelled" }), false);
  assert.equal(isOperationalLogisticsParent({ isActive: false, productionStatus: "received" }), false);
});

test("7 tenant timezone today and overdue query boundaries are preserved", async () => {
  const dashboard = await source("src/features/dashboard/server/queries.ts");

  assert.match(dashboard, /nowWindow\(membership\.organization\.timezone\)/);
  assert.equal((dashboard.match(/\.gte\("scheduled_at", start\.toISOString\(\)\)/g) ?? []).length, 2);
  assert.equal((dashboard.match(/\.lte\("scheduled_at", end\.toISOString\(\)\)/g) ?? []).length, 2);
  assert.equal((dashboard.match(/\.lt\("scheduled_at", now\.toISOString\(\)\)/g) ?? []).length, 2);
  assert.match(dashboard, /logisticsAttention: \[[\s\S]*operationalLogisticsRows\(latePickupsResult\.data/);
  assert.match(dashboard, /operationalLogisticsRows\(lateDeliveriesResult\.data/);
});

test("8 completed logistics history stays separate from active operational signals", async () => {
  const dashboard = await source("src/features/dashboard/server/queries.ts");

  assert.equal((dashboard.match(/\.in\("status", \["scheduled", "in_progress"\]\)/g) ?? []).length, 4);
  assert.equal((dashboard.match(/\.eq\("status", "completed"\)/g) ?? []).length, 2);
  assert.match(dashboard, /\.\.\.\(completedPickupsResult\.data \?\? \[\]\)\.map/);
  assert.match(dashboard, /\.\.\.\(completedDeliveriesResult\.data \?\? \[\]\)\.map/);
  assert.doesNotMatch(dashboard, /operationalLogisticsRows\(completed(?:Pickups|Deliveries)Result\.data/);
});

test("9 dashboard and alerts preserve tenant filters and enforce the shared parent rule", async () => {
  const [dashboard, alerts] = await Promise.all([
    source("src/features/dashboard/server/queries.ts"),
    source("src/features/alerts/server/queries.ts"),
  ]);

  assert.equal((dashboard.match(/production_status, is_active[^\n]+\n\s+\.eq\("organization_id", membership\.organization\.id\)/g) ?? []).length, 4);
  assert.equal((alerts.match(/production_status, is_active[^\n]+\n\s+\.eq\("organization_id", membership\.organization\.id\)/g) ?? []).length, 2);
  for (const readModel of [dashboard, alerts]) {
    assert.match(readModel, /import \{ isOperationalLogisticsParent \}/);
    assert.match(readModel, /production_status, is_active/);
    assert.match(readModel, /isOperationalLogisticsParent\(\{/);
  }
  assert.match(alerts, /const pickups = \(pickupsResult\.data \?\? \[\]\)\.filter\(isOperationalLogisticsRow\)/);
  assert.match(alerts, /const deliveries = \(deliveriesResult\.data \?\? \[\]\)\.filter\(isOperationalLogisticsRow\)/);
});
