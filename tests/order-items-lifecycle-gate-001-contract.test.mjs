import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const migration = read("supabase/migrations/20260928000100_order_items_lifecycle_gate_001.sql");
const previousWorkflow = read("supabase/migrations/20260927000500_warehouse_001d_b2_ready_final_placement.sql");
const previousExit = read("supabase/migrations/20260926000100_final_fulfillment_storage_exit.sql");
const pickup = read("supabase/migrations/20260927000300_inbound_custody_sync_001.sql");
const quickDrop = read("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql");
const workflow = migration.split("create or replace function public.transition_order_status(")[1]
  .split("create or replace function public.complete_customer_handoff(")[0];
const handoff = migration.split("create or replace function public.complete_customer_handoff(")[1]
  .split("create or replace function public.transition_delivery_status(")[0];
const delivery = migration.split("create or replace function public.transition_delivery_status(")[1];

function deployedBody(source, name, nextName) {
  const part = source.split(`create or replace function public.${name}(`)[1];
  assert.ok(part, `${name} must exist`);
  return nextName ? part.split(`create ${nextName}`)[0].trim() : part.trim();
}

test("one forward-only migration adds only a tenant-scoped active-item assertion and three canonical RPC replacements", () => {
  assert.match(migration, /create function public\.assert_order_has_active_items\(/);
  assert.match(migration, /item\.organization_id = target_organization_id\s+and item\.order_id = target_order_id\s+and item\.is_active = true/);
  assert.match(migration, /raise exception 'order_items_required' using errcode = '22023'/);
  assert.match(migration, /revoke all on function public\.assert_order_has_active_items\(uuid, uuid\) from public, anon, authenticated/);
  assert.equal((migration.match(/create or replace function public\./g) ?? []).length, 3);
  assert.doesNotMatch(migration.split("create or replace function public.transition_order_status(")[0], /\b(insert into|update public\.|delete from)\b/i);
});

test("every manual receipt and processing target require an active item; hold and cancellation do not", () => {
  assert.match(workflow, /if target_status = 'received'/);
  assert.match(workflow, /target_status in \('washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed'\)/);
  assert.match(workflow, /perform public\.assert_order_has_active_items\(org_id, target_order_id\)/);
  assert.ok(workflow.indexOf("assert_order_has_active_items") < workflow.indexOf("update public.orders"));
  assert.match(workflow, /allowed := target_status in \('received', 'cancelled'\)/);
});

test("zero-item Quick Drop and completed inbound pickup remain explicit canonical receipt paths", () => {
  assert.match(quickDrop, /jsonb_build_object\('source', 'quick_drop'\)/);
  assert.match(pickup, /jsonb_build_object\('source', 'inbound_pickup_completion'\)/);
  assert.match(pickup, /perform public\.ensure_warehouse_inbound_storage\(org_id, parent_order_id, receipt_at\)/);
  assert.doesNotMatch(migration, /create or replace function public\.(transition_pickup_status|create_quick_drop_order)\(/);
});

test("READY wrapper inherits the item gate before final placement and movement", () => {
  const wrapper = previousWorkflow.split("create function public.transition_order_ready_with_storage(")[1];
  assert.match(wrapper, /perform public\.transition_order_status\(target_order_id, 'ready'::public\.production_status, null\)/);
  assert.match(workflow, /target_status = 'ready'[\s\S]*ready_warehouse_confirmation_required/);
  assert.match(workflow, /assert_order_has_active_items/);
  assert.match(wrapper, /update public\.order_storage/);
});

test("handoff blocks zero active items before handoff insertion and Warehouse exit", () => {
  const gate = handoff.indexOf("assert_order_has_active_items");
  assert.ok(gate > handoff.indexOf("if canonical_handoff.id is not null"));
  assert.ok(gate < handoff.indexOf("insert into public.order_customer_handoffs"));
  assert.ok(gate < handoff.indexOf("delete from public.order_storage"));
});

test("only completed outbound delivery checks items before status change and Warehouse exit", () => {
  assert.match(delivery, /if target_status = 'completed' then\s+perform public\.assert_order_has_active_items\(org_id, parent_order_id\);\s+end if/);
  assert.ok(delivery.indexOf("assert_order_has_active_items") < delivery.indexOf("update public.deliveries"));
  assert.ok(delivery.indexOf("assert_order_has_active_items") < delivery.indexOf("delete from public.order_storage"));
});

test("existing authorization, pickup gate, status graph, READY storage and fulfillment logic are preserved verbatim around new guards", () => {
  const workflowGuard = /  -- Quick Drop and inbound pickup receipt use their own canonical intake paths\.[\s\S]*?  end if;\n\n/;
  const handoffGuard = /  perform public\.assert_order_has_active_items\(org_id, target_order_id\);\n\n/;
  const deliveryGuard = /  if target_status = 'completed' then\n    perform public\.assert_order_has_active_items\(org_id, parent_order_id\);\n  end if;\n\n/;
  assert.equal(workflow.replace(workflowGuard, "").trim(), deployedBody(previousWorkflow, "transition_order_status", "function public.transition_order_ready_with_storage("));
  assert.equal(handoff.replace(handoffGuard, "").trim(), deployedBody(previousExit, "complete_customer_handoff", "or replace function public.transition_delivery_status("));
  assert.equal(delivery.replace(deliveryGuard, "").trim(), deployedBody(previousExit, "transition_delivery_status"));
});

test("all affected actions show the item error on their current surface in five locales", () => {
  for (const file of ["src/features/orders/server/actions.ts", "src/features/handoffs/server/actions.ts", "src/features/logistics/server/actions.ts"]) {
    assert.match(read(file), /error\.message\.includes\("order_items_required"\)/);
    assert.match(read(file), /itemsError=1/);
  }
  for (const file of [
    "src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx",
    "src/components/production/ProductionDetail.tsx",
    "src/app/[locale]/app/(dashboard)/work/deliveries/[deliveryId]/page.tsx",
  ]) assert.match(read(file), /role="alert"/);
  for (const locale of ["de", "en", "es", "fr", "it"]) {
    const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
    assert.ok(messages.orderItemsRequired?.length > 30);
  }
});
