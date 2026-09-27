import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const actionsPath = "src/features/warehouse/server/storage-actions.ts";
const componentPath = "src/components/warehouse/OrderStoragePanel.tsx";
const pagePath = "src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx";
const queriesPath = "src/features/warehouse/server/queries.ts";
const movementMigrationPath = "supabase/migrations/20260927000400_warehouse_001e_a_movement_history.sql";

test("1 storage assignment is exposed to Owner and Manager while Staff is denied", async () => {
  const [actions, page, roles] = await Promise.all([
    source(actionsPath),
    source(pagePath),
    source("src/lib/auth/require-role.ts"),
  ]);
  const save = actions.slice(actions.indexOf("export async function saveOrderStorageAssignmentAction"));
  assert.match(save, /await requireOwnerOrManager\(locale\)/);
  assert.match(save, /rpc\("save_order_storage_assignment"/);
  assert.match(roles, /requireRole\(locale, \["owner", "manager"\]\)/);
  assert.match(page, /canManageAssignments[\s\S]*role === "owner"[\s\S]*role === "manager"/);
  assert.match(page, /\{canManageAssignments \? \([\s\S]*<OrderStoragePanel/);
});

test("2 current assignment read and display remain server-derived and tenant scoped", async () => {
  const [queries, component] = await Promise.all([source(queriesPath), source(componentPath)]);
  const get = queries.slice(queries.indexOf("export async function getOrderStorageAssignment"));
  assert.match(get, /requireMembership\(locale\)/);
  assert.match(get, /createSupabaseAdminClient\(\)/);
  assert.match(get, /\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("order_id", orderId\)/);
  assert.match(component, /assignment\.positionCode/);
  assert.match(component, /assignment\.positionName/);
  assert.match(component, /assignment\.packageCount/);
  assert.match(component, /assignment\.storageMode/);
  assert.match(component, /enteredAt/);
});

test("3 order and active location are resolved inside the authenticated tenant", async () => {
  const sql = await source(movementMigrationPath);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /join public\.locations location[\s\S]*orders\.organization_id = org_id[\s\S]*orders\.id = target_order_id[\s\S]*location\.is_active and location\.deleted_at is null/);
  assert.match(sql, /warehouse_storage_order_location_invalid/);
});

test("4 only an active same-location tenant position can be assigned", async () => {
  const sql = await source(movementMigrationPath);
  assert.match(sql, /position\.organization_id = org_id[\s\S]*position\.location_id = order_location_id[\s\S]*position\.id = target_position_id[\s\S]*position\.is_active/);
  assert.match(sql, /warehouse_storage_position_invalid/);
});

test("5 new assignment derives organization order and location server-side", async () => {
  const sql = await source(movementMigrationPath);
  assert.match(sql, /insert into public\.order_storage \([\s\S]*organization_id, order_id, location_id, warehouse_position_id, package_count, storage_mode[\s\S]*org_id, target_order_id, order_location_id, target_position_id, target_package_count, target_storage_mode/);
});

test("6 existing assignment can move or update without replacing its identity", async () => {
  const sql = await source(movementMigrationPath);
  const update = sql.slice(sql.indexOf("create function public.save_order_storage_assignment"), sql.indexOf("create function public.return_cancelled_order_from_warehouse"));
  assert.match(update, /select \* into storage_row from public\.order_storage storage[\s\S]*for update/);
  assert.match(update, /set warehouse_position_id = target_position_id,[\s\S]*package_count = target_package_count,[\s\S]*storage_mode = target_storage_mode/);
  assert.match(update, /entered_at = case when warehouse_position_id is distinct from target_position_id then now\(\) else entered_at end/);
  assert.match(update, /where organization_id = org_id and id = storage_row\.id/);
  assert.doesNotMatch(update, /set organization_id|set order_id|set location_id/);
});

test("7 package count and storage mode are validated before persistence", async () => {
  const actions = await source(actionsPath);
  const save = actions.slice(actions.indexOf("export async function saveOrderStorageAssignmentAction"));
  assert.match(save, /\^\\d\+\$\/\.test\(packageCountValue\)/);
  assert.match(save, /packageCount < 1/);
  assert.match(save, /STORAGE_MODES\.includes\(storageMode\)/);
  assert.match(actions, /\["folded", "hanging", "mixed", "other"\]/);
});

test("8 order detail shows controlled unavailable states and only active choices", async () => {
  const [page, component] = await Promise.all([source(pagePath), source(componentPath)]);
  assert.match(page, /warehousePositions\.filter\(\(position\) => position\.isActive\)/);
  assert.match(page, /hasOrderLocation=\{Boolean\(order\.locationId\)\}/);
  assert.match(component, /hasOrderLocation \? text\.noPositions : text\.noLocation/);
  assert.match(component, /assignment \? \(/);
});

test("9 storage assignment does not mutate canonical lifecycle or financial facts", async () => {
  const files = await Promise.all([source(actionsPath), source(componentPath), source(pagePath), source(queriesPath)]);
  const storageAction = files[0].slice(files[0].indexOf("export async function saveOrderStorageAssignmentAction"));
  assert.doesNotMatch(storageAction, /\.from\("(order_status_history|pickups|deliveries|order_customer_handoffs|payments|payment_refunds)"\)/);
  assert.doesNotMatch(storageAction, /production_status/);
  assert.doesNotMatch(files[1], /remove|delete/i);
});

test("10 all five locales expose identical order-storage keys", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  const messages = await Promise.all(locales.map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`))));
  const topology = (value) => JSON.stringify({
    labels: Object.keys(value.orderStorage.labels).sort(),
    modes: Object.keys(value.orderStorage.labels.modes).sort(),
    root: Object.keys(value.orderStorage).sort(),
  });
  for (const message of messages) assert.equal(topology(message), topology(messages[0]));
});

test("11 WAREHOUSE-001B-1B adds no migration", async () => {
  const migrations = await readdir(new URL("../supabase/migrations", import.meta.url));
  assert.equal(migrations.filter((name) => name.includes("warehouse_001b")).length, 0);
});
