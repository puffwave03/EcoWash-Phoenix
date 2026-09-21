import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const actionsPath = "src/features/warehouse/server/actions.ts";
const componentPath = "src/components/warehouse/WarehousePositionManagement.tsx";
const pagePath = "src/app/[locale]/app/(dashboard)/settings/warehouse/page.tsx";
const queriesPath = "src/features/warehouse/server/queries.ts";

test("1 position list is tenant scoped and keeps inactive positions visible", async () => {
  const queries = await source(queriesPath);
  const list = queries.slice(queries.indexOf("export async function listWarehousePositions"), queries.indexOf("export async function getOrderStorageAssignment"));
  assert.match(list, /requireMembership\(locale\)/);
  assert.match(list, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.doesNotMatch(list, /\.eq\("is_active", true\)/);
});

test("2 create derives tenant server-side and accepts only an active tenant location", async () => {
  const actions = await source(actionsPath);
  const save = actions.slice(actions.indexOf("export async function saveWarehousePositionAction"), actions.indexOf("export async function setWarehousePositionActiveAction"));
  assert.match(save, /requireOwnerOrManager\(locale\)/);
  assert.match(save, /createSupabaseAdminClient\(\)/);
  assert.match(save, /from\("locations"\)[\s\S]*\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", locationId\)[\s\S]*\.eq\("is_active", true\)[\s\S]*\.is\("deleted_at", null\)/);
  assert.match(save, /from\("warehouse_positions"\)\.insert\([\s\S]*organization_id: membership\.organization\.id/);
});

test("3 duplicate position code is reported without weakening the database constraint", async () => {
  const [actions, foundation] = await Promise.all([
    source(actionsPath),
    source("supabase/migrations/20260920000300_warehouse_001a_data_foundation.sql"),
  ]);
  assert.match(actions, /code === "23505"[\s\S]*fail\("duplicate"\)/);
  assert.match(foundation, /create unique index warehouse_positions_location_code_unique[\s\S]*\(location_id, lower\(btrim\(code\)\)\)/);
});

test("4 edit changes only approved position fields within the current tenant", async () => {
  const actions = await source(actionsPath);
  const update = actions.slice(actions.indexOf("if (positionId)"), actions.indexOf("} else {", actions.indexOf("if (positionId)")));
  const updateValues = update.slice(update.indexOf(".update({"), update.indexOf("})", update.indexOf(".update({")));
  assert.match(update, /existing\.location_id !== locationId/);
  assert.match(update, /\.update\(\{[\s\S]*code,[\s\S]*description:[\s\S]*name:[\s\S]*position_type: positionType/);
  assert.match(update, /\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", positionId\)/);
  assert.doesNotMatch(updateValues, /location_id:/);
});

test("5 activate and deactivate are tenant scoped and never hard delete", async () => {
  const actions = await source(actionsPath);
  const status = actions.slice(actions.indexOf("export async function setWarehousePositionActiveAction"));
  assert.match(status, /\.update\(\{ is_active: isActiveValue === "true" \}\)/);
  assert.match(status, /\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", positionId\)/);
  assert.doesNotMatch(actions, /\.delete\(/);
});

test("6 UI filters only when multiple locations exist and exposes all position states", async () => {
  const component = await source(componentPath);
  assert.match(component, /locations\.length > 1/);
  assert.match(component, /position\.isActive \? text\.active : text\.inactive/);
  assert.match(component, /position\.isActive \? text\.deactivate : text\.activate/);
  assert.match(component, /positions\.filter\(\(position\) => position\.locationId === locationFilter\)/);
});

test("7 route is Owner or Manager guarded and linked from existing settings", async () => {
  const [page, settings] = await Promise.all([
    source(pagePath),
    source("src/app/[locale]/app/(dashboard)/settings/page.tsx"),
  ]);
  assert.match(page, /await requireOwnerOrManager\(locale\)/);
  assert.match(page, /listWarehouseLocations\(locale\)/);
  assert.match(page, /listWarehousePositions\(locale\)/);
  assert.match(settings, /href: "\/app\/settings\/warehouse"/);
});

test("8 management does not write order storage or alter order lifecycle", async () => {
  const files = await Promise.all([source(actionsPath), source(componentPath), source(pagePath), source(queriesPath)]);
  const combined = files.join("\n");
  assert.doesNotMatch(combined, /from\("order_storage"\)\.(insert|update|delete)/);
  assert.doesNotMatch(combined, /production_status|pickups|deliveries|order_customer_handoffs|payments/);
});

test("9 all five locales expose identical position-management keys", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  const messages = await Promise.all(locales.map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`))));
  const topology = (value) => JSON.stringify({
    labels: Object.keys(value.warehousePositions.labels).sort(),
    root: Object.keys(value.warehousePositions).sort(),
    settings: Object.keys(value.settings.items.warehouse).sort(),
    types: Object.keys(value.warehousePositions.labels.types).sort(),
  });
  for (const message of messages) assert.equal(topology(message), topology(messages[0]));
});

test("10 WAREHOUSE-001B-1A adds no migration and preserves the foundation", async () => {
  const migrations = await readdir(new URL("../supabase/migrations", import.meta.url));
  assert.equal(migrations.filter((name) => name.includes("warehouse_001b")).length, 0);
  assert.equal(migrations.filter((name) => name.includes("warehouse_001a")).length, 1);
});
