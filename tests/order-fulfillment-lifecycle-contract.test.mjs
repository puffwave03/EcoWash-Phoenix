import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260908000300_order_fulfillment_lifecycle_001.sql";

function rpcBody(sql, name, nextName) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const end = nextName
    ? sql.indexOf(`create or replace function public.${nextName}`, start)
    : sql.length;

  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return sql.slice(start, end);
}

test("1 shared parent rule excludes draft, cancelled and inactive orders only", async () => {
  const lifecycle = await source("src/features/logistics/lifecycle.ts");

  assert.match(lifecycle, /isActive\s*&&[\s\S]*productionStatus !== "draft"\s*&&[\s\S]*productionStatus !== "cancelled"/);
  assert.doesNotMatch(lifecycle, /productionStatus !== "(?:ready|completed|on_hold)"/);
});

test("2 assigned draft deliveries are absent from the staff delivery workspace", async () => {
  const deliveries = await source("src/features/deliveries/server/queries.ts");

  assert.match(deliveries, /\.in\("status", \["scheduled", "in_progress"\]\)/);
  assert.match(deliveries, /\.not\("assigned_to", "is", null\)/);
  assert.match(deliveries, /query = query\.eq\("assigned_to", profile\.id\)/);
  assert.match(deliveries, /isOperationalLogisticsParent\(\{[\s\S]*productionStatus: order\.production_status/);
  assert.doesNotMatch(deliveries, /function isOperationalOrder/);
});

test("3 assigned draft pickups are absent while completedToday stays intact", async () => {
  const pickups = await source("src/features/pickups/server/queries.ts");

  assert.match(pickups, /\.in\("status", \["scheduled", "in_progress", "completed"\]\)/);
  assert.match(pickups, /query = query\.eq\("assigned_to", profile\.id\)/);
  assert.match(pickups, /isOperationalLogisticsParent\(\{[\s\S]*productionStatus: order\.production_status/);
  assert.match(pickups, /const completedToday = rows\.filter[\s\S]*row\.status !== "completed"[\s\S]*completedAt >= start && completedAt <= end/);
  assert.match(pickups, /row\.status === "completed"[\s\S]*return false/);
});

test("4 draft logistics are absent from My Day without changing production cards", async () => {
  const work = await source("src/features/work/server/queries.ts");

  assert.match(work, /const PRODUCTION_STATUSES:[\s\S]*"received"[\s\S]*"packing"/);
  assert.match(work, /function logisticsActivity[\s\S]*isOperationalLogisticsParent\(\{/);
  assert.match(work, /pickupsQuery[\s\S]*\.in\("status", \["scheduled", "in_progress"\]\)/);
  assert.match(work, /deliveriesQuery[\s\S]*\.in\("status", \["scheduled", "in_progress"\]\)/);
});

test("5 completed-production open logistics remain eligible across operational read models", async () => {
  const [lifecycle, deliveries, pickups, work] = await Promise.all([
    source("src/features/logistics/lifecycle.ts"),
    source("src/features/deliveries/server/queries.ts"),
    source("src/features/pickups/server/queries.ts"),
    source("src/features/work/server/queries.ts"),
  ]);

  assert.doesNotMatch(lifecycle, /productionStatus !== "completed"/);
  for (const readModel of [deliveries, pickups, work]) {
    assert.match(readModel, /isOperationalLogisticsParent/);
    assert.doesNotMatch(readModel, /\["completed", "cancelled"\]\.includes\(order\.production_status\)/);
  }
});

test("6 ready and on-hold parents remain operational", async () => {
  const lifecycle = await source("src/features/logistics/lifecycle.ts");

  assert.doesNotMatch(lifecycle, /productionStatus !== "ready"|productionStatus !== "on_hold"/);
  assert.doesNotMatch(lifecycle, /FINAL_PRODUCTION_STATUSES/);
});

test("7 the combined queue applies the shared parent lifecycle rule", async () => {
  const logistics = await source("src/features/logistics/server/queries.ts");
  const queue = logistics.slice(
    logistics.indexOf("type DeliveryTaskOrderRelation"),
    logistics.indexOf("export async function listAssignableStaff"),
  );

  assert.match(queue, /production_status: ProductionStatus/);
  assert.match(queue, /is_active: boolean/);
  assert.match(queue, /order_number, production_status, is_active/);
  assert.match(queue, /isOperationalLogisticsParent\(\{/);
});

test("8 order-detail draft planning stays readable and configurable", async () => {
  const [queries, page] = await Promise.all([
    source("src/features/logistics/server/queries.ts"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
  ]);
  const planning = queries.slice(
    queries.indexOf("export async function getOrderLogistics"),
    queries.indexOf("export async function listDeliveryQueueTasks"),
  );

  assert.match(planning, /\.neq\("status", "cancelled"\)/);
  assert.doesNotMatch(planning, /isOperationalLogisticsParent|production_status/);
  assert.match(page, /saveDelivery: saveDeliveryAction/);
  assert.match(page, /savePickup: savePickupAction/);
});

test("9 draft order detail hides start and complete while preserving cancellation", async () => {
  const [panel, page] = await Promise.all([
    source("src/components/logistics/LogisticsPanel.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
  ]);

  assert.match(panel, /operationalTransitionsEnabled \|\|[\s\S]*!\["in_progress", "completed"\]\.includes\(status\)/);
  assert.match(panel, /status === "cancelled"/);
  assert.match(page, /operationalTransitionsEnabled=\{isOperationalLogisticsParent\(\{/);
});

test("10 transition RPCs reject operational advancement for draft or cancelled parents", async () => {
  const sql = await source(migrationPath);
  const pickup = rpcBody(sql, "transition_pickup_status", "transition_delivery_status");
  const delivery = rpcBody(sql, "transition_delivery_status");

  for (const rpc of [pickup, delivery]) {
    assert.match(rpc, /target_status in \('in_progress', 'completed'\)/);
    assert.match(rpc, /not parent_is_active or parent_production_status in \('draft', 'cancelled'\)/);
    assert.match(rpc, /raise exception 'logistics parent not operational'/);
    assert.doesNotMatch(rpc, /parent_production_status in \([^)]*'completed'/);
  }
});

test("11 transition RPCs preserve tenant, capability and assignment enforcement", async () => {
  const sql = await source(migrationPath);
  const pickup = rpcBody(sql, "transition_pickup_status", "transition_delivery_status");
  const delivery = rpcBody(sql, "transition_delivery_status");

  assert.match(pickup, /pickup\.organization_id = org_id/);
  assert.match(delivery, /delivery\.organization_id = org_id/);
  assert.match(pickup, /has_operational_capability\(org_id, 'pickup'\)/);
  assert.match(delivery, /has_operational_capability\(org_id, 'delivery'\)/);
  for (const rpc of [pickup, delivery]) {
    assert.match(rpc, /actor_role = 'staff' and current_assigned_to is distinct from auth\.uid\(\)/);
    assert.match(rpc, /orders\.organization_id = [a-z]+\.organization_id/);
    assert.match(rpc, /for update of [a-z]+, orders/);
    assert.match(rpc, /security definer[\s\S]*set search_path = public/);
  }
});

test("12 fulfillment transition, cancellation, and timestamp semantics remain intact", async () => {
  const sql = await source(migrationPath);

  assert.equal((sql.match(/allowed := target_status in \('in_progress', 'cancelled'\)/g) ?? []).length, 2);
  assert.equal((sql.match(/allowed := target_status in \('completed', 'cancelled'\)/g) ?? []).length, 2);
  assert.equal((sql.match(/target_status = 'cancelled' and nullif\(btrim\(target_reason\), ''\) is null/g) ?? []).length, 2);
  assert.equal((sql.match(/started_at = case when target_status = 'in_progress'/g) ?? []).length, 2);
  assert.equal((sql.match(/completed_at = case when target_status = 'completed'/g) ?? []).length, 2);
});

test("13 migration changes only the two transition RPC boundaries", async () => {
  const sql = await source(migrationPath);

  assert.equal((sql.match(/create or replace function public\.transition_(?:pickup|delivery)_status/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /\b(create|alter|drop) table\b|\binsert into\b|\bdelete from\b/i);
  assert.doesNotMatch(sql, /public\.(?:payments|refunds|invoices|accounting_entries)/i);
});
