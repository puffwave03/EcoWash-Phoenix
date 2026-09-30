import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20260930000100_delivery_staging_and_transit_001b.sql");
const transition = sql.slice(sql.indexOf("create or replace function public.transition_delivery_status"), sql.indexOf("create function public.return_delivery_to_warehouse"));
const returned = sql.slice(sql.indexOf("create function public.return_delivery_to_warehouse"));
const movement = sql.slice(sql.indexOf("create or replace function public.record_order_storage_movement"), sql.indexOf("create function public.prevent_transit_order_storage"));
const action = read("src/features/logistics/server/actions.ts");
const detail = read("src/components/deliveries/DeliveryDetail.tsx");
const panel = read("src/components/logistics/LogisticsPanel.tsx");
const form = read("src/components/deliveries/DeliveryReturnForm.tsx");

test("start requires active completed order and current storage, then exits in one RPC", () => {
  assert.match(transition, /current_status = 'scheduled' and target_status = 'in_progress'[\s\S]*not parent_is_active or parent_production_status <> 'completed'[\s\S]*delivery_start_production_incomplete/);
  assert.match(transition, /select \* into current_storage from public\.order_storage storage[\s\S]*for update;[\s\S]*delivery_start_storage_missing/);
  assert.match(transition, /update public\.deliveries[\s\S]*started_at = case[\s\S]*if current_status = 'scheduled' and target_status = 'in_progress' then[\s\S]*'delivery_start'[\s\S]*delete from public\.order_storage/);
  assert.match(movement, /movement_source = 'delivery_start'[\s\S]*delivery\.status = 'in_progress'[\s\S]*event_source := 'delivery_started'/);
  assert.match(transition, /set_config\('app\.warehouse_delivery_id', target_delivery_id::text, true\)[\s\S]*delete from public\.order_storage/);
  assert.match(movement, /movement_source = 'delivery_start'[\s\S]*event_delivery_id := nullif\(current_setting\('app\.warehouse_delivery_id', true\), ''\)::uuid[\s\S]*delivery\.id = event_delivery_id/);
  assert.match(movement, /case when tg_op = 'DELETE' then old\.package_count else new\.package_count end|case when tg_op = 'DELETE' then null else new\.package_count end/);
  assert.match(movement, /case when tg_op = 'INSERT' then null else old\.package_count end/);
  assert.match(movement, /case when tg_op = 'INSERT' then null else old\.storage_mode end/);
});

test("transit cannot be manually reintroduced into current storage", () => {
  assert.match(sql, /create trigger order_storage_prevent_transit\s+before insert or update on public\.order_storage/);
  assert.match(sql, /delivery\.status in \('in_progress', 'completed'\)[\s\S]*delivery_fulfillment_storage_forbidden/);
});

test("completion leaves new transit empty and retains legacy storage exit", () => {
  assert.match(transition, /elsif target_status = 'completed' then[\s\S]*delete from public\.order_storage/);
  assert.match(movement, /delivery\.status = 'completed'[\s\S]*event_source := 'delivery_completed'/);
});

test("scheduled cancellation leaves storage; transit cancellation needs physical storage", () => {
  assert.match(transition, /current_status = 'scheduled'[\s\S]*allowed := target_status in \('in_progress', 'cancelled'\)/);
  assert.match(transition, /target_status = 'cancelled' and nullif\(btrim\(target_reason\), ''\) is null/);
  assert.match(transition, /current_status = 'in_progress' and target_status = 'cancelled'[\s\S]*from public\.order_storage storage[\s\S]*delivery_return_required/);
  assert.doesNotMatch(transition, /current_status = 'scheduled' and target_status = 'cancelled'[\s\S]*delete from public\.order_storage/);
  assert.match(detail, /task\.status === "scheduled"[\s\S]*targetStatus" type="hidden" value="cancelled"[\s\S]*name="reason"/);
});

test("return restores the departure snapshot in selected physical position and records entry", () => {
  assert.match(returned, /movement\.delivery_id = target_delivery_id[\s\S]*movement\.movement_type = 'exited'[\s\S]*movement\.source = 'delivery_started'[\s\S]*snapshot_count is null or snapshot_mode is null/);
  assert.doesNotMatch(returned, /delivery_started_at|movement\.occurred_at >=/);
  assert.match(returned, /update public\.deliveries[\s\S]*status = 'cancelled'[\s\S]*set_config\('app\.warehouse_movement_source', 'delivery_return', true\)[\s\S]*insert into public\.order_storage[\s\S]*snapshot_count, snapshot_mode/);
  assert.match(movement, /movement_source = 'delivery_return'[\s\S]*event_source := 'delivery_returned'/);
  assert.match(movement, /event_type := 'entered'/);
  assert.match(sql, /'delivery_started', 'delivery_returned'/);
  assert.match(sql, /add column delivery_id uuid,[\s\S]*foreign key \(organization_id, delivery_id\)[\s\S]*references public\.deliveries \(organization_id, id\) on delete restrict/);
  assert.match(movement, /organization_id, order_id, delivery_id, storage_id[\s\S]*scope_row\.organization_id, scope_row\.order_id, event_delivery_id/);
  assert.match(returned, /set_config\('app\.warehouse_delivery_id', target_delivery_id::text, true\)[\s\S]*insert into public\.order_storage/);
  assert.match(movement, /movement_source = 'delivery_return'[\s\S]*event_delivery_id := nullif\(current_setting\('app\.warehouse_delivery_id', true\), ''\)::uuid[\s\S]*delivery\.id = event_delivery_id/);
});

test("two attempts on one order restore only the current departure snapshot", () => {
  const lookup = returned.slice(returned.indexOf("select movement.from_package_count"), returned.indexOf("if snapshot_count is null"));
  for (const predicate of [
    "movement.organization_id = org_id",
    "movement.order_id = parent_order_id",
    "movement.delivery_id = target_delivery_id",
    "movement.movement_type = 'exited'",
    "movement.source = 'delivery_started'",
  ]) assert.ok(lookup.includes(predicate), predicate);
  assert.doesNotMatch(lookup, /delivery_started_at|movement\.occurred_at >=/);

  // Equal timestamps make the old order/time predicate ambiguous; delivery_id separates attempts.
  const departures = [
    { organization_id: "tenant", order_id: "order", delivery_id: "attempt-a", movement_type: "exited", source: "delivery_started", occurred_at: "2026-09-30T10:00:00Z", from_package_count: 2, from_storage_mode: "folded" },
    { organization_id: "tenant", order_id: "order", delivery_id: "attempt-a", movement_type: "entered", source: "delivery_returned", occurred_at: "2026-09-30T10:00:00Z", to_package_count: 2, to_storage_mode: "folded" },
    { organization_id: "tenant", order_id: "order", delivery_id: "attempt-b", movement_type: "exited", source: "delivery_started", occurred_at: "2026-09-30T10:00:00Z", from_package_count: 5, from_storage_mode: "hanging" },
  ];
  const selected = departures.filter((movement) =>
    movement.organization_id === "tenant" && movement.order_id === "order"
    && movement.delivery_id === "attempt-b" && movement.movement_type === "exited"
    && movement.source === "delivery_started");
  assert.equal(selected.length, 1);
  assert.deepEqual([selected[0].from_package_count, selected[0].from_storage_mode], [5, "hanging"]);
});

test("return uses server-derived tenant, capability, assignment and valid location position", () => {
  assert.match(returned, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(returned, /delivery\.organization_id = org_id[\s\S]*for update of delivery, orders/);
  assert.match(returned, /has_operational_capability\(org_id, 'delivery'\)/);
  assert.match(returned, /actor_role = 'staff' and current_assigned_to is distinct from auth\.uid\(\)/);
  assert.match(returned, /position\.organization_id = org_id[\s\S]*position\.location_id = parent_location_id[\s\S]*position\.id = target_position_id[\s\S]*position\.is_active[\s\S]*not position\.is_default_inbound[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null[\s\S]*for share of position, location/);
  assert.match(returned, /revoke all on function public\.return_delivery_to_warehouse[\s\S]*grant execute on function public\.return_delivery_to_warehouse/);
  assert.match(action, /requireOperationalCapability\(locale, "delivery"\)[\s\S]*rpc\("return_delivery_to_warehouse"/);
});

test("return UI suggests staging and permits another valid position", () => {
  assert.match(form, /eligible\.find\(\(position\) => position\.isDefaultDeliveryStaging\)/);
  assert.match(form, /defaultValue=\{suggested\?\.id \?\? ""\}/);
  assert.match(form, /eligible\.map/);
  assert.match(form, /name="reason" required/);
  assert.match(form, /name="positionId" required/);
  assert.match(detail, /task\.status === "in_progress"[\s\S]*DeliveryReturnForm/);
  assert.match(panel, /hideInProgressCancel=\{logistics\.delivery\?\.status === "in_progress" && !legacyDeliveryStorage\}/);
  assert.match(detail, /targetStatus !== "in_progress" \|\| task\.canStart/);
  assert.match(read("src/features/deliveries/server/queries.ts"), /canStart: order\.production_status === "completed"/);
  assert.match(read("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"), /deliveryStartEnabled=\{order\.isActive && order\.productionStatus === "completed"\}/);
});

test("legacy in-progress storage can complete or cancel without return action", () => {
  assert.match(transition, /current_status = 'in_progress' and target_status = 'cancelled'[\s\S]*if not exists \([\s\S]*delivery_return_required/);
  assert.match(detail, /legacyStorage \? \([\s\S]*targetStatus" type="hidden" value="cancelled"/);
  assert.match(panel, /legacyDeliveryStorage=|!legacyDeliveryStorage/);
  assert.match(read("src/features/deliveries/server/queries.ts"), /legacyStorage: Boolean\(storage\)/);
});

test("warehouse and task paths revalidate after transit or return", () => {
  assert.match(action, /transitionDeliveryAction[\s\S]*revalidatePath\(`\/\$\{locale\}\/app\/warehouse`\)/);
  assert.match(action, /returnDeliveryToWarehouseAction[\s\S]*revalidatePath\(`\/\$\{locale\}\/app\/warehouse`\)/);
});

test("all locales have movement and return labels", () => {
  for (const lang of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(read(`src/i18n/${lang}/common.json`));
    for (const key of ["delivery_started", "delivery_returned"]) assert.ok(messages.warehouseMovements.labels.sources[key]);
    for (const key of ["returnDelivery", "returnReason", "returnPosition", "noReturnPositions", "returnError"]) assert.ok(messages.deliveryWorkspace[key]);
  }
});
