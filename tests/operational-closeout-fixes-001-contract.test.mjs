import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20260929000100_inbound_pickup_receipt_gate_001.sql";
const previous = "supabase/migrations/20260928000200_production_default_assignee_001.sql";

function workflow(sql) {
  return sql.slice(sql.indexOf("create or replace function public.transition_order_status("), sql.indexOf("$$;", sql.indexOf("create or replace function public.transition_order_status(")) + 3);
}

test("manual receipt blocks scheduled and in-progress inbound pickup using the existing error", async () => {
  const sql = workflow(await source(migration));
  assert.match(sql, /if target_status in \('received', 'washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed'\)[\s\S]*pickup\.status in \('scheduled', 'in_progress'\)[\s\S]*raise exception 'inbound_pickup_incomplete'/);
  assert.match(sql, /pickup\.organization_id = org_id\s+and pickup\.order_id = target_order_id/);
  assert.doesNotMatch(sql, /pickup\.status in \([^)]*'cancelled'/);
  assert.match(sql, /current_status = 'draft'[\s\S]*allowed := target_status in \('received', 'cancelled'\)/);
});

test("latest workflow is unchanged apart from the receipt target; no backfill exists", async () => {
  const next = await source(migration);
  const old = workflow(await source(previous));
  assert.equal(workflow(next).replace("('received', 'washing',", "('washing',"), old);
  assert.doesNotMatch(next.slice(0, next.indexOf("create or replace function")), /update|delete|insert|truncate/i);
  assert.equal((next.match(/create or replace function public\./g) ?? []).length, 1);
});

test("pickup completion and Quick Drop retain their own atomic receipt paths", async () => {
  const pickup = await source("supabase/migrations/20260927000300_inbound_custody_sync_001.sql");
  const quickDrop = await source("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql");
  assert.match(pickup, /if parent_production_status = 'draft' then[\s\S]*set production_status = 'received',[\s\S]*received_at = receipt_at/);
  assert.match(pickup, /insert into public\.order_status_history[\s\S]*'inbound_pickup_completion'/);
  assert.match(pickup, /ensure_warehouse_inbound_storage\(org_id, parent_order_id, receipt_at\)/);
  assert.match(quickDrop, /set production_status = 'received',[\s\S]*received_at = now\(\)/);
  assert.doesNotMatch(await source(migration), /create or replace function public\.(transition_pickup_status|create_quick_drop_order)/);
});

test("order detail removes only blocked Received choice and gives five localized explanations", async () => {
  const page = await source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
  const form = await source("src/components/orders/StatusTransitionForm.tsx");
  const action = await source("src/features/orders/server/actions.ts");
  assert.match(page, /order\.productionStatus === "draft"\s+&& \(logistics\.pickup\?\.status === "scheduled" \|\| logistics\.pickup\?\.status === "in_progress"\)/);
  assert.match(form, /filter\(\(status\) => !\(pickupReceiptBlocked && status === "received"\)\)/);
  assert.match(form, /role="status">\{text\.pickupReceiptBlocked\}/);
  assert.match(action, /targetStatus === "received" && surface === "order" && error\.message\.includes\("inbound_pickup_incomplete"\)/);
  for (const locale of ["de", "en", "es", "fr", "it"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.orders.workflow.pickupReceiptBlocked.length > 40);
  }
});

test("authoritative assignment remounts select after backend default, preserving edit and read-only flows", async () => {
  const page = await source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
  const form = await source("src/components/orders/OrderAssignmentForm.tsx");
  const actions = await source("src/features/orders/server/actions.ts");
  const sql = workflow(await source(previous));
  assert.match(sql, /current_status = 'received' and target_status = 'washing'[\s\S]*then default_assignee_id/);
  assert.match(page, /assignedTo=\{order\.assignedTo\}[\s\S]*key=\{order\.assignedTo \?\? "unassigned"\}/);
  assert.match(form, /defaultValue=\{assignedTo \?\? ""\}/);
  assert.match(form, /if \(!canAssign\)/);
  assert.match(form, /<option value="">\{text\.none\}<\/option>/);
  assert.match(actions, /revalidateOrders\(locale, orderId\)/);
});
