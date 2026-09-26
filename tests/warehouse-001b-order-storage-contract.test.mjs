import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const actionsPath = "src/features/warehouse/server/storage-actions.ts";
const componentPath = "src/components/warehouse/OrderStoragePanel.tsx";
const pagePath = "src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx";
const queriesPath = "src/features/warehouse/server/queries.ts";

test("1 storage assignment is exposed to Owner and Manager while Staff is denied", async () => {
  const [actions, page, roles] = await Promise.all([
    source(actionsPath),
    source(pagePath),
    source("src/lib/auth/require-role.ts"),
  ]);
  const save = actions.slice(actions.indexOf("export async function saveOrderStorageAssignmentAction"));
  assert.match(save, /const \{ membership \} = await requireOwnerOrManager\(locale\)/);
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
  const actions = await source(actionsPath);
  const save = actions.slice(actions.indexOf("export async function saveOrderStorageAssignmentAction"));
  assert.match(save, /from\("orders"\)[\s\S]*\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", orderId\)/);
  assert.match(save, /from\("locations"\)[\s\S]*\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", order\.location_id\)[\s\S]*\.eq\("is_active", true\)[\s\S]*\.is\("deleted_at", null\)/);
  assert.match(save, /if \(!order\.location_id\)[\s\S]*formError: "orderLocation"/);
});

test("4 only an active same-location tenant position can be assigned", async () => {
  const actions = await source(actionsPath);
  const save = actions.slice(actions.indexOf("export async function saveOrderStorageAssignmentAction"));
  const position = save.slice(save.indexOf('admin.from("warehouse_positions")'), save.indexOf("]);", save.indexOf('admin.from("warehouse_positions")')));
  assert.match(position, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(position, /\.eq\("location_id", order\.location_id\)/);
  assert.match(position, /\.eq\("id", positionId\)/);
  assert.match(position, /\.eq\("is_active", true\)/);
  assert.match(save, /if \(!position\)[\s\S]*formError: "position"/);
});

test("5 new assignment derives organization order and location server-side", async () => {
  const actions = await source(actionsPath);
  const save = actions.slice(actions.indexOf("export async function saveOrderStorageAssignmentAction"));
  assert.match(save, /from\("order_storage"\)\.insert\(\{[\s\S]*location_id: order\.location_id,[\s\S]*order_id: orderId,[\s\S]*organization_id: membership\.organization\.id,[\s\S]*package_count: packageCount,[\s\S]*storage_mode: storageMode,[\s\S]*warehouse_position_id: positionId/);
});

test("6 existing assignment can move or update without replacing its identity", async () => {
  const actions = await source(actionsPath);
  const save = actions.slice(actions.indexOf("export async function saveOrderStorageAssignmentAction"));
  const update = save.slice(save.indexOf("if (existing)"), save.indexOf("} else {", save.indexOf("if (existing)")));
  assert.match(update, /package_count: packageCount/);
  assert.match(update, /storage_mode: storageMode/);
  assert.match(update, /warehouse_position_id: positionId/);
  assert.match(update, /existing\.warehouse_position_id !== positionId[\s\S]*entered_at = new Date\(\)\.toISOString\(\)/);
  assert.match(update, /\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", existing\.id\)/);
  assert.doesNotMatch(update, /organization_id:|order_id:|location_id:/);
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
