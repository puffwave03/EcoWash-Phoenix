import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const migration = read("supabase/migrations/20260927000500_warehouse_001d_b2_ready_final_placement.sql");
const originalWorkflow = read("supabase/migrations/20260913000100_order_pickup_production_gate_001.sql")
  .split("create or replace function public.create_or_update_pickup(")[0];
const originalMovement = "create or replace function public.record_order_storage_movement()"
  + read("supabase/migrations/20260927000400_warehouse_001e_a_movement_history.sql")
    .split("create function public.record_order_storage_movement()")[1]
    .split("create trigger order_storage_record_movement")[0];
const workflow = migration.split("create or replace function public.transition_order_status(")[1]
  .split("create function public.transition_order_ready_with_storage(")[0];
const wrapper = migration.split("create function public.transition_order_ready_with_storage(")[1];

test("one forward-only migration adds READY placement without a backfill", () => {
  assert.match(migration, /alter table public\.warehouse_movements[\s\S]*production_ready/);
  const migrationPreamble = migration.split("create or replace function")[0];
  assert.doesNotMatch(migrationPreamble, /\b(insert into|update public\.|delete from)\b/i);
  assert.match(migration, /create function public\.transition_order_ready_with_storage\(/);
});

test("existing workflow keeps its graph, capability, assignment and pickup gate", () => {
  const guard = /  if target_status = 'ready'\n    and current_setting\('app\.ready_storage_transition', true\) is distinct from 'on' then\n    raise exception 'ready_warehouse_confirmation_required' using errcode = '22023';\n  end if;\n\n/;
  assert.match(workflow, guard);
  assert.equal(migration.split("create or replace function public.transition_order_status(")[0].includes("app.ready_storage_transition"), false);
  const restored = migration.split("create or replace function public.transition_order_status(")[0]
    + "create or replace function public.transition_order_status("
    + workflow.replace(guard, "");
  assert.ok(restored.includes(originalWorkflow.trim()));
  assert.match(workflow, /has_operational_capability\(org_id, required_capability\)/);
  assert.match(workflow, /actor_role = 'staff' and current_assigned_to is distinct from auth\.uid\(\)/);
  assert.match(workflow, /raise exception 'inbound_pickup_incomplete'/);
});

test("READY and storage update run inside one authenticated canonical RPC transaction", () => {
  assert.match(wrapper, /security definer[\s\S]*perform public\.transition_order_status\(target_order_id, 'ready'/);
  assert.match(wrapper, /perform public\.transition_order_status[\s\S]*select \* into current_storage[\s\S]*update public\.order_storage/);
  assert.match(wrapper, /grant execute on function public\.transition_order_ready_with_storage[\s\S]*to authenticated/);
  assert.doesNotMatch(wrapper, /has_organization_role\([\s\S]*'owner'/);
});

test("missing storage and invalid tenant, location, position, or values reject READY", () => {
  assert.match(wrapper, /target_package_count < 1 or target_storage_mode is null/);
  assert.match(wrapper, /orders\.organization_id = org_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(wrapper, /storage\.organization_id = org_id[\s\S]*storage\.order_id = target_order_id[\s\S]*storage\.location_id = order_location_id/);
  assert.match(wrapper, /raise exception 'ready_warehouse_storage_missing'/);
  assert.match(wrapper, /position\.organization_id = org_id[\s\S]*position\.location_id = order_location_id[\s\S]*position\.id = target_position_id[\s\S]*position\.is_active[\s\S]*not position\.is_default_inbound/);
  assert.match(wrapper, /raise exception 'ready_warehouse_position_invalid'/);
});

test("one physical change creates production_ready movement with package and mode deltas", () => {
  assert.match(migration, /movement_source not in \('manual_storage', 'production_ready'\)/);
  assert.match(migration, /event_source := case when movement_source = 'production_ready' then 'production_ready'/);
  assert.match(migration, /from_package_count, to_package_count,[\s\S]*from_storage_mode, to_storage_mode/);
  assert.match(wrapper, /current_storage\.warehouse_position_id is not distinct from target_position_id[\s\S]*current_storage\.package_count is not distinct from target_package_count[\s\S]*current_storage\.storage_mode is not distinct from target_storage_mode then\s+return/);
  assert.match(wrapper, /set_config\('app\.warehouse_movement_source', 'production_ready', true\)/);
});

test("movement recorder preserves all prior receipt, manual, and exit behavior", () => {
  const restored = migration.split("create or replace function public.record_order_storage_movement()")[0]
    + "create or replace function public.record_order_storage_movement()"
    + migration.split("create or replace function public.record_order_storage_movement()")[1]
      .split("create or replace function public.transition_order_status(")[0]
      .replace("if movement_source not in ('manual_storage', 'production_ready') or movement_source is null then", "if movement_source is distinct from 'manual_storage' then")
      .replace("event_source := case when movement_source = 'production_ready' then 'production_ready'\n      when event_type = 'moved' then 'manual_move' else 'manual_update' end;", "event_source := case when event_type = 'moved' then 'manual_move' else 'manual_update' end;");
  assert.ok(restored.includes(originalMovement.trim()));
  assert.match(migration, /customer_handoff/);
  assert.match(migration, /delivery_completed/);
  assert.match(migration, /cancelled_return/);
});

test("all three transition surfaces require the same final placement fields", () => {
  for (const page of [
    "src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx",
    "src/app/[locale]/app/(dashboard)/work/production/[orderId]/page.tsx",
    "src/app/[locale]/app/(dashboard)/work/quality/[orderId]/page.tsx",
  ]) {
    assert.match(read(page), /getReadyWarehousePlacement/);
    assert.match(read(page), /readyPlacement=/);
    assert.match(read(page), /readyText=/);
  }
  const fields = read("src/components/warehouse/ReadyWarehouseFields.tsx");
  assert.match(fields, /placement\.assignment\.packageCount/);
  assert.match(fields, /placement\.assignment\.storageMode/);
  assert.match(fields, /position\.id === placement\.assignment\?\.positionId/);
  assert.match(fields, /name="finalPositionId" required/);
  assert.match(fields, /name="finalPackageCount" required/);
  assert.match(fields, /name="finalStorageMode" required/);
});

test("server action routes READY only through the atomic RPC and retains other transitions", () => {
  const action = read("src/features/orders/server/actions.ts");
  assert.match(action, /if \(targetStatus === "ready"\)[\s\S]*rpc\("transition_order_ready_with_storage"/);
  assert.match(action, /rpc\("transition_order_status"/);
  assert.doesNotMatch(action, /requireOwnerOrManager/);
  const reader = read("src/features/warehouse/server/queries.ts");
  assert.match(reader, /getReadyWarehousePlacement[\s\S]*requireMembership\(locale\)/);
  assert.match(reader, /position\.isActive && !position\.isDefaultInbound/);
});

test("five locales expose equivalent READY fields and the movement source", () => {
  const locales = ["it", "en", "es", "fr", "de"];
  const data = locales.map((locale) => JSON.parse(read(`src/i18n/${locale}/common.json`)));
  const shape = (value) => Object.keys(value).sort().join(",");
  const expected = shape(data[0].readyWarehouse.labels);
  for (const item of data) {
    assert.equal(shape(item.readyWarehouse.labels), expected);
    assert.equal(shape(item.readyWarehouse.labels.modes), "folded,hanging,mixed,other");
    assert.ok(item.warehouseMovements.labels.sources.production_ready);
  }
});
