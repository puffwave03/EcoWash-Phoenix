import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const migration = read("supabase/migrations/20260928000200_production_default_assignee_001.sql");
const priorWorkflow = read("supabase/migrations/20260928000100_order_items_lifecycle_gate_001.sql")
  .split("create or replace function public.transition_order_status(")[1]
  .split("create or replace function public.complete_customer_handoff(")[0];
const workflow = migration.split("create or replace function public.transition_order_status(")[1]
  .split("create or replace function public.submit_shop_terminal_order(")[0];
const terminal = migration.split("create or replace function public.submit_shop_terminal_order(")[1];
const priorTerminal = read("supabase/migrations/20260907000200_terminal_operational_checkout_001.sql")
  .split("create function public.submit_shop_terminal_order(")[1]
  .split("revoke all on function public.submit_shop_terminal_order(")[0];

const oldFallback = `  if target_production_assignee_id is not null then
    production_assignee := target_production_assignee_id;
  elsif active_location_count = 1 then
    select membership.profile_id into production_assignee
    from public.organization_memberships membership
    where membership.organization_id = org_id
      and membership.is_active
      and membership.role = 'staff'
      and 'production' = any(membership.operational_capabilities::text[])
    order by membership.profile_id asc
    limit 1;
  end if;`;

test("one forward-only nullable location setting and no historical assignment", () => {
  assert.match(migration, /alter table public\.locations\s+add column default_production_assignee_id uuid references public\.profiles\(id\) on delete set null/);
  assert.doesNotMatch(migration.split("create or replace function public.transition_order_status(")[0], /update public\.orders|update public\.locations[\s\S]*where organization_id is null/i);
  assert.equal((migration.match(/create or replace function public\./g) ?? []).length, 2);
});

test("owner and manager alone may set or clear an active same-tenant location default", () => {
  assert.match(migration, /create function public\.set_location_default_production_assignee\(/);
  assert.match(migration, /has_organization_role\(org_id, array\['owner', 'manager'\]::public\.app_role\[\]\)/);
  assert.match(migration, /location\.organization_id = org_id[\s\S]*location\.id = target_location_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null[\s\S]*for update/);
  assert.match(migration, /set default_production_assignee_id = target_profile_id/);
  assert.match(migration, /grant execute on function public\.set_location_default_production_assignee\(uuid, uuid\)[\s\S]*to authenticated/);
});

test("database rejects cross-tenant, inactive, non-staff and production-ineligible assignees", () => {
  for (const marker of [
    "membership.organization_id = org_id",
    "membership.profile_id = target_profile_id",
    "membership.is_active",
    "membership.role = 'staff'",
    "'production'::public.operational_capability = any(membership.operational_capabilities)",
  ]) assert.ok(migration.includes(marker), marker);
  assert.match(migration, /create trigger locations_validate_default_production_assignee[\s\S]*before insert or update of default_production_assignee_id, organization_id/);
  assert.match(migration, /membership\.organization_id = new\.organization_id[\s\S]*membership\.profile_id = new\.default_production_assignee_id/);
});

test("received-to-washing resolves eligible default and writes status plus assignee atomically", () => {
  assert.match(workflow, /current_status = 'received' and target_status = 'washing'[\s\S]*current_assigned_to is null/);
  assert.match(workflow, /location\.organization_id = org_id[\s\S]*location\.id = order_location_id[\s\S]*location\.is_active[\s\S]*assignee\.is_active[\s\S]*assignee\.role = 'staff'[\s\S]*'production'::public\.operational_capability = any\(assignee\.operational_capabilities\)[\s\S]*for share of location, assignee/);
  assert.match(workflow, /set production_status = target_status,\s+assigned_to = case[\s\S]*assigned_to is null[\s\S]*then default_assignee_id[\s\S]*else assigned_to/);
  assert.ok(workflow.indexOf("assert_order_has_active_items") < workflow.indexOf("update public.orders"));
});

test("staff may start only when resolved default is self; manual assignment and no-default denial remain", () => {
  assert.match(workflow, /has_operational_capability\(org_id, required_capability\)/);
  assert.match(workflow, /actor_role = 'staff'[\s\S]*coalesce\(current_assigned_to, default_assignee_id\) is distinct from auth\.uid\(\)/);
  assert.match(workflow, /current_assigned_to is null[\s\S]*select location\.default_production_assignee_id/);
  assert.match(workflow, /else assigned_to\s+end/);
});

test("Terminal preserves explicit choice and validation without first-staff fallback", () => {
  assert.match(terminal, /production_assignee := target_production_assignee_id/);
  assert.match(terminal, /target_production_assignee_id is not null and \([\s\S]*membership\.role = 'staff'[\s\S]*shop_terminal_production_assignee_invalid/);
  assert.match(terminal, /assigned_to = production_assignee/);
  assert.doesNotMatch(terminal, /order by membership\.profile_id asc/);
  assert.equal(terminal.replace("  production_assignee := target_production_assignee_id;", oldFallback).trim(), priorTerminal.trim());
});

test("only genuinely unassigned processing work raises warnings in Alerts and Control Center", () => {
  for (const file of ["src/features/alerts/server/queries.ts", "src/features/control/server/queries.ts"]) {
    const source = read(file);
    assert.match(source, /\["washing", "drying", "ironing", "quality_check", "packing"\]\.includes\(/);
    assert.match(source, /unassigned/);
  }
  assert.match(read("src/features/control/server/queries.ts"), /if \(task\.productionStatus === "on_hold"\)/);
});

test("settings route is owner/manager only, offers eligible staff and clear option, with localized result", () => {
  const page = read("src/app/[locale]/app/(dashboard)/settings/production/page.tsx");
  const action = read("src/features/production-default/server/actions.ts");
  const query = read("src/features/production-default/server/queries.ts");
  assert.match(page, /requireOwnerOrManager\(locale\)/);
  assert.match(action, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /membership\.organization\.id/);
  assert.match(query, /row\.operational_capabilities\.includes\("production"\)/);
  assert.match(page, /<option value="">\{t\("none"\)\}<\/option>/);
  assert.match(page, /role="status"/);
  assert.match(read("src/app/[locale]/app/(dashboard)/settings/page.tsx"), /href: "\/app\/settings\/production"/);
});

test("latest lifecycle retains item, pickup, cancellation and READY guards", () => {
  for (const marker of [
    "assert_order_has_active_items(org_id, target_order_id)",
    "inbound_pickup_incomplete",
    "ready_warehouse_confirmation_required",
    "if target_status = 'cancelled' then",
    "insert into public.order_status_history",
  ]) {
    assert.ok(priorWorkflow.includes(marker), marker);
    assert.ok(workflow.includes(marker), marker);
  }
  assert.doesNotMatch(migration, /create or replace function public\.(transition_pickup_status|transition_order_ready_with_storage|complete_customer_handoff|transition_delivery_status|create_quick_drop_order)\(/);
});

test("five locales contain the same setting and feedback keys", () => {
  const locales = ["it", "en", "es", "fr", "de"];
  const data = locales.map((locale) => JSON.parse(read(`src/i18n/${locale}/common.json`)));
  const shape = (value) => Object.keys(value).sort().join(",");
  const expected = shape(data[0].productionDefaultAssignee);
  const stateKeys = shape(data[0].productionDefaultAssignee.states);
  for (const item of data) {
    assert.equal(shape(item.productionDefaultAssignee), expected);
    assert.equal(shape(item.productionDefaultAssignee.states), stateKeys);
    assert.ok(item.settings.items.productionDefaultAssignee.title);
  }
});
