import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deriveOrderDisplayStatus } from "../src/features/orders/display-status.ts";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260929000200_ready_fulfillment_handoff_001.sql");
const prior = read("supabase/migrations/20260927000500_warehouse_001d_b2_ready_final_placement.sql");
const workflow = read("supabase/migrations/20260929000100_inbound_pickup_receipt_gate_001.sql");

test("final placement validates and saves storage before completing production in one RPC", () => {
  assert.match(migration, /^create or replace function public\.transition_order_ready_with_storage\(/m);
  assert.match(migration, /security definer\s+set search_path = public/);
  const steps = [
    "perform public.transition_order_status(target_order_id, 'ready'",
    "raise exception 'ready_warehouse_values_invalid'",
    "raise exception 'ready_warehouse_location_invalid'",
    "raise exception 'ready_warehouse_storage_missing'",
    "raise exception 'ready_warehouse_position_invalid'",
    "update public.order_storage",
    "update public.orders",
    "insert into public.order_status_history",
  ];
  for (let i = 1; i < steps.length; i++) {
    assert.ok(migration.indexOf(steps[i]) > migration.indexOf(steps[i - 1]), `${steps[i]} must follow ${steps[i - 1]}`);
  }
  assert.match(migration, /production_status = 'completed',\s+completed_at = production_completed_at/);
  assert.match(migration, /production_status = 'ready'\s+and is_active;\s+if not found then\s+raise exception 'ready_production_completion_failed'/);
  assert.match(migration, /org_id, target_order_id, 'ready', 'completed', null, auth\.uid\(\)/);
  assert.doesNotMatch(migration, /\b(exception when|commit|rollback)\b/i);
});

test("READY authorization, lifecycle gates, storage movement, and manual historical path remain canonical", () => {
  assert.match(migration, /perform public\.transition_order_status\(target_order_id, 'ready'::public\.production_status, null\)/);
  assert.equal((migration.match(/perform public\.transition_order_status\(/g) ?? []).length, 1);
  assert.match(workflow, /current_status in \('quality_check', 'packing'\) then 'quality'/);
  assert.match(workflow, /if current_status = 'ready' then\s+allowed := target_status in \('completed', 'on_hold'\)/);
  assert.match(workflow, /raise exception 'inbound_pickup_incomplete'/);
  assert.match(workflow, /perform public\.assert_order_has_active_items\(org_id, target_order_id\)/);
  assert.match(migration, /set_config\('app\.warehouse_movement_source', 'production_ready', true\)/);
  assert.match(prior, /event_source := case when movement_source = 'production_ready' then 'production_ready'/);
  assert.match(migration, /current_storage\.warehouse_position_id is distinct from target_position_id[\s\S]*update public\.order_storage/);
  assert.doesNotMatch(migration, /\bdelete from public\.order_storage\b/i);
  assert.doesNotMatch(migration, /\b(insert into|update) public\.(deliveries|order_customer_handoffs|payments|payment_refunds|operational_receipts)\b/i);
  assert.doesNotMatch(migration, /\bdo \$\$|\btruncate\b/i);
});

test("production completion remains separate from customer handoff and delivery completion", () => {
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed" }), "ready_for_customer_pickup");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", deliveryStatus: "scheduled" }), "delivery_scheduled");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", deliveryStatus: "in_progress" }), "delivery_in_progress");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", deliveryStatus: "completed" }), "completed");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", customerHandoffCompleted: true }), "completed");
  const exit = read("supabase/migrations/20260928000100_order_items_lifecycle_gate_001.sql");
  assert.match(exit, /delete from public\.order_storage/g);
  assert.match(prior, /delivery\.status = 'completed'[\s\S]*event_source := 'delivery_completed'/);
});

test("only order display labels change across five locales", () => {
  const labels = {
    it: "Pronto per la consegna",
    en: "Ready for delivery",
    es: "Listo para la entrega",
    fr: "Prêt pour la livraison",
    de: "Bereit zur Lieferung",
  };
  const keys = Object.keys(JSON.parse(read("src/i18n/it/common.json")).orders.displayStatuses).sort();
  for (const [locale, label] of Object.entries(labels)) {
    const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
    assert.deepEqual(Object.keys(messages.orders.displayStatuses).sort(), keys);
    assert.equal(messages.orders.displayStatuses.delivery_scheduled, label);
    assert.ok(messages.orders.displayStatuses.ready_for_customer_pickup);
  }
});
