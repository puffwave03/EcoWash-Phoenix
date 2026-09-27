import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isVisibleInboundPickupParent, isOperationalLogisticsParent } from "../src/features/logistics/lifecycle.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260927000300_inbound_custody_sync_001.sql";

test("Terminal finalization no longer creates draft storage; receipt does", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /drop trigger shop_terminal_submission_inbound_storage on public\.shop_terminal_submissions/);
  assert.match(sql, /drop function public\.stage_counter_submission_order\(\)/);
  assert.match(sql, /create trigger order_received_inbound_storage\s+after update of production_status on public\.orders/);
  assert.match(sql, /old\.production_status = 'draft' and new\.production_status = 'received'/);
  assert.match(sql, /new\.organization_id, new\.id, new\.received_at/);
  assert.match(sql, /if new\.received_at is null then/);
  assert.doesNotMatch(sql, /insert into public\.order_storage|update public\.shop_terminal_submissions/i);
});

test("Quick Drop remains a canonical atomic receipt; generic and Portal creation remain draft", async () => {
  const [sql, quickDrop, terminal] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql"),
    source("supabase/migrations/20260907000200_terminal_operational_checkout_001.sql"),
  ]);
  assert.match(quickDrop, /update public\.orders orders\s+set production_status = 'received',[\s\S]*received_at = now\(\)/);
  assert.match(quickDrop, /if existing_submission\.idempotency_key is not null then[\s\S]*return;/);
  assert.match(terminal, /update public\.shop_terminal_submissions submission\s+set order_id = created_order\.id/);
  assert.doesNotMatch(sql, /create (?:or replace )?function public\.(?:create_order|submit_shop_terminal_order|create_quick_drop_order|create_customer_portal_order_request)/);
});

test("Pickup visibility includes draft and anomalies; execution accepts only draft/received", async () => {
  for (const productionStatus of ["draft", "received"]) {
    assert.equal(isVisibleInboundPickupParent({ isActive: true, productionStatus }), true);
  }
  for (const productionStatus of ["washing", "ready", "completed"]) {
    assert.equal(isVisibleInboundPickupParent({ isActive: true, productionStatus }), true);
  }
  assert.equal(isVisibleInboundPickupParent({ isActive: true, productionStatus: "cancelled" }), false);
  assert.equal(isVisibleInboundPickupParent({ isActive: false, productionStatus: "draft" }), false);
  assert.equal(isOperationalLogisticsParent({ isActive: true, productionStatus: "draft" }), false);
  const sql = await source(migrationPath);
  assert.match(sql, /parent_production_status not in \('draft', 'received'\)/);
  assert.doesNotMatch(sql, /create or replace function public\.transition_delivery_status/);
});

test("Pickup completion records one receipt/history event and uses one timestamp", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /if target_status = 'completed' then\s+receipt_at := now\(\)/);
  assert.match(sql, /if parent_production_status = 'draft' then[\s\S]*set production_status = 'received',[\s\S]*received_at = receipt_at/);
  assert.equal((sql.match(/insert into public\.order_status_history/g) ?? []).length, 1);
  assert.match(sql, /jsonb_build_object\('source', 'inbound_pickup_completion'\)/);
  assert.match(sql, /perform public\.ensure_warehouse_inbound_storage\(org_id, parent_order_id, receipt_at\)/);
  assert.match(sql, /completed_at = case when target_status = 'completed' then receipt_at/);
  assert.match(sql, /on conflict \(organization_id, order_id\) do nothing|perform public\.ensure_warehouse_inbound_storage/);
  assert.doesNotMatch(sql, /exception when|dblink|pg_background/i);
});

test("Pickup visibility and Control Center use the pickup-specific rule", async () => {
  const [pickups, work, logistics, control] = await Promise.all([
    source("src/features/pickups/server/queries.ts"),
    source("src/features/work/server/queries.ts"),
    source("src/features/logistics/server/queries.ts"),
    source("src/features/control/server/queries.ts"),
  ]);
  assert.match(pickups, /isVisibleInboundPickupParent\(\{/);
  assert.match(work, /kind === "pickup" \? isVisibleInboundPickupParent : isOperationalLogisticsParent/);
  assert.match(logistics, /kind === "pickup" \? isVisibleInboundPickupParent : isOperationalLogisticsParent/);
  assert.match(control, /pickups: pickupData\.tasks\.length/);
});

test("Order detail enables pickup execution for draft without enabling delivery", async () => {
  const [page, panel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/components/logistics/LogisticsPanel.tsx"),
  ]);
  assert.match(page, /pickupTransitionsEnabled=\{order\.isActive && \(order\.productionStatus === "draft" \|\| order\.productionStatus === "received"\)\}/);
  assert.match(panel, /actions\.transitionPickup[\s\S]*operationalTransitionsEnabled=\{pickupTransitionsEnabled\}/);
  assert.match(panel, /actions\.transitionDelivery[\s\S]*operationalTransitionsEnabled=\{operationalTransitionsEnabled\}/);
});

test("Navigation separates pickups and deliveries with existing staff capabilities", async () => {
  const nav = await source("src/components/dashboard/AppNavigation.tsx");
  assert.match(nav, /href: "\/app\/work\/pickups", label: text\.pickup/);
  assert.match(nav, /href: "\/app\/work\/deliveries", label: text\.delivery/);
  assert.match(nav, /canUse\("pickup"\)/);
  assert.match(nav, /canUse\("delivery"\)/);
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.auth.dashboard.pickup);
    assert.ok(messages.auth.dashboard.delivery);
  }
});

test("Migration preserves boundaries and historical B1 migration", async () => {
  const [sql, b1] = await Promise.all([source(migrationPath), source("supabase/migrations/20260927000200_warehouse_001d_b1_automatic_inbound_storage.sql")]);
  assert.match(b1, /create trigger shop_terminal_submission_inbound_storage/);
  assert.match(sql, /has_operational_capability\(org_id, 'pickup'\)/);
  assert.match(sql, /pickup\.organization_id = org_id/);
  assert.match(sql, /for update of pickup, orders/);
  assert.match(sql, /raise exception 'reason required'/);
  assert.doesNotMatch(sql, /public\.(?:payments|refunds|invoices|deliveries|order_customer_handoffs)/i);
  assert.doesNotMatch(sql, /update public\.order_storage|delete from public\.order_storage/i);
});
