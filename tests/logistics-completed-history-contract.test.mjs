import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function workspaceQueryBody(moduleSource, exportName) {
  const start = moduleSource.indexOf(`export async function ${exportName}`);
  const end = moduleSource.indexOf("export async function", start + 1);

  assert.ok(start >= 0, `${exportName} must exist`);
  return moduleSource.slice(start, end >= 0 ? end : moduleSource.length);
}

test("1 pickup staff completed-today query is restricted to their own assignment", async () => {
  const pickups = workspaceQueryBody(
    await source("src/features/pickups/server/queries.ts"),
    "getPickupWorkspaceData",
  );

  assert.match(pickups, /if \(!isSupervision\) \{[\s\S]*completedQuery = completedQuery\.eq\("assigned_to", profile\.id\)/);
});

test("2 pickup supervisors retain organization-wide completed-today scope", async () => {
  const pickups = workspaceQueryBody(
    await source("src/features/pickups/server/queries.ts"),
    "getPickupWorkspaceData",
  );

  assert.match(pickups, /const isSupervision = membership\.role === "owner" \|\| membership\.role === "manager"/);
  assert.doesNotMatch(pickups, /completedQuery[\s\S]*\.not\("assigned_to", "is", null\)/);
});

test("3 delivery staff completed-today query is restricted to their own assignment", async () => {
  const deliveries = workspaceQueryBody(
    await source("src/features/deliveries/server/queries.ts"),
    "getDeliveryWorkspaceData",
  );

  assert.match(deliveries, /if \(!isSupervision\) \{[\s\S]*completedQuery = completedQuery\.eq\("assigned_to", profile\.id\)/);
});

test("4 delivery supervisors retain organization-wide completed-today scope", async () => {
  const deliveries = workspaceQueryBody(
    await source("src/features/deliveries/server/queries.ts"),
    "getDeliveryWorkspaceData",
  );

  assert.match(deliveries, /const isSupervision = membership\.role === "owner" \|\| membership\.role === "manager"/);
  assert.doesNotMatch(deliveries, /completedQuery[\s\S]*\.not\("assigned_to", "is", null\)/);
});

test("5 completed history uses completed_at within the current tenant-local day", async () => {
  const modules = await Promise.all([
    source("src/features/pickups/server/queries.ts"),
    source("src/features/deliveries/server/queries.ts"),
  ]);

  for (const moduleSource of modules) {
    assert.match(moduleSource, /\.eq\("status", "completed"\)[\s\S]*\.gte\("completed_at", start\.toISOString\(\)\)[\s\S]*\.lte\("completed_at", end\.toISOString\(\)\)/);
  }
});

test("6 completed history is ordered by completion time descending", async () => {
  const modules = await Promise.all([
    source("src/features/pickups/server/queries.ts"),
    source("src/features/deliveries/server/queries.ts"),
  ]);

  for (const moduleSource of modules) {
    assert.match(moduleSource, /completedQuery[\s\S]*\.order\("completed_at", \{ ascending: false \}\)/);
  }
});

test("7 completions outside today's start and end are excluded at the database boundary", async () => {
  const modules = await Promise.all([
    source("src/features/pickups/server/queries.ts"),
    source("src/features/deliveries/server/queries.ts"),
  ]);

  for (const moduleSource of modules) {
    assert.equal((moduleSource.match(/\.gte\("completed_at", start\.toISOString\(\)\)/g) ?? []).length, 1);
    assert.equal((moduleSource.match(/\.lte\("completed_at", end\.toISOString\(\)\)/g) ?? []).length, 1);
  }
});

test("8 My Day continues to query only open pickup and delivery work", async () => {
  const work = await source("src/features/work/server/queries.ts");

  assert.match(work, /pickupsQuery[\s\S]*\.in\("status", \["scheduled", "in_progress"\]\)/);
  assert.match(work, /deliveriesQuery[\s\S]*\.in\("status", \["scheduled", "in_progress"\]\)/);
  assert.doesNotMatch(work, /\.eq\("status", "completed"\)/);
});

test("9 completed rows remain outside active queues, counts, and action links", async () => {
  const [pickups, deliveries, pickupUi, deliveryUi] = await Promise.all([
    source("src/features/pickups/server/queries.ts"),
    source("src/features/deliveries/server/queries.ts"),
    source("src/components/pickups/PickupWorkspace.tsx"),
    source("src/components/deliveries/DeliveryWorkspace.tsx"),
  ]);

  for (const moduleSource of [pickups, deliveries]) {
    assert.match(moduleSource, /activeQuery[\s\S]*\.in\("status", \["scheduled", "in_progress"\]\)/);
    assert.match(moduleSource, /const tasks = \(activeResult\.data \?\? \[\]\)/);
    assert.match(moduleSource, /summary: \{[\s\S]*total: tasks\.length/);
  }
  for (const uiSource of [pickupUi, deliveryUi]) {
    const start = uiSource.indexOf("function Completed");
    const end = uiSource.indexOf("function PriorityBadge", start);
    const completedCard = uiSource.slice(start, end);

    assert.doesNotMatch(completedCard, /<Link|openPickup|openDelivery/);
  }
});

test("10 active and completed reads preserve server-derived tenant isolation", async () => {
  const modules = await Promise.all([
    source("src/features/pickups/server/queries.ts"),
    source("src/features/deliveries/server/queries.ts"),
  ]);

  for (const moduleSource of modules) {
    const workspace = workspaceQueryBody(moduleSource, moduleSource.includes("getPickupWorkspaceData")
      ? "getPickupWorkspaceData"
      : "getDeliveryWorkspaceData");

    assert.match(workspace, /requireOperationalCapability/);
    assert.equal((workspace.match(/\.eq\("organization_id", membership\.organization\.id\)/g) ?? []).length, 2);
  }
});

test("11 history day boundaries and UI rendering use organizations.timezone", async () => {
  const [pickups, deliveries, pickupUi, deliveryUi] = await Promise.all([
    source("src/features/pickups/server/queries.ts"),
    source("src/features/deliveries/server/queries.ts"),
    source("src/components/pickups/PickupWorkspace.tsx"),
    source("src/components/deliveries/DeliveryWorkspace.tsx"),
  ]);

  for (const moduleSource of [pickups, deliveries]) {
    assert.match(moduleSource, /todayWindow\([\s\S]*membership\.organization\.timezone/);
  }
  for (const uiSource of [pickupUi, deliveryUi]) {
    assert.match(uiSource, /formatTime\([\s\S]*\.completedAt,[\s\S]*data\.timeZone/);
    assert.doesNotMatch(uiSource, /resolvedOptions\(\)\.timeZone/);
  }
});
