import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260826000200_customer_lifecycle_001_safe_customer_states.sql";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function body(migration, name, nextName) {
  const start = migration.indexOf(`create function public.${name}`);
  const replaceStart = migration.indexOf(`create or replace function public.${name}`);
  const resolvedStart = start >= 0 ? start : replaceStart;
  const candidates = nextName
    ? [migration.indexOf(`create function public.${nextName}`, resolvedStart), migration.indexOf(`create or replace function public.${nextName}`, resolvedStart)].filter((value) => value > resolvedStart)
    : [migration.length];
  const end = Math.min(...candidates);
  assert.ok(resolvedStart >= 0 && end > resolvedStart, `${name} must exist`);
  return migration.slice(resolvedStart, end);
}

test("lifecycle migration is additive and never mutates historical financial or operational rows", async () => {
  const migration = await source(migrationPath);

  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b/i);
  assert.doesNotMatch(migration, /update public\.(orders|order_items|order_status_history|payments|pickups|deliveries|order_photos)/i);
  assert.doesNotMatch(migration, /update public\.customers[\s\S]*display_name|update public\.customers[\s\S]*email/);
});

test("deactivation and reactivation are Owner/Manager-only, tenant-bound RPC operations", async () => {
  const migration = await source(migrationPath);
  const mutation = body(migration, "set_customer_lifecycle_active", "get_customer_lifecycle_eligibility");

  assert.match(mutation, /public\.app_current_organization_id\(\)/);
  assert.match(mutation, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(mutation, /customer\.organization_id = org_id/);
  assert.match(mutation, /customer\.id = target_customer_id/);
  assert.match(mutation, /customer_lifecycle_not_authorized/);
  assert.match(mutation, /customer_lifecycle_invalid_customer/);
});

test("deactivation atomically retains the customer and disables Portal access", async () => {
  const migration = await source(migrationPath);
  const mutation = body(migration, "set_customer_lifecycle_active", "get_customer_lifecycle_eligibility");
  const guard = body(migration, "protect_customer_lifecycle_state", "set_customer_lifecycle_active");

  assert.match(mutation, /update public\.customers[\s\S]*set is_active = target_is_active/);
  assert.match(guard, /if old\.is_active and not new\.is_active then[\s\S]*update public\.customer_portal_access[\s\S]*set is_active = false/);
  assert.match(guard, /disabled_by = actor_id/);
  assert.match(guard, /disabled_at = coalesce\(disabled_at, now\(\)\)/);
  assert.doesNotMatch(guard, /not old\.is_active and new\.is_active[\s\S]*customer_portal_access/);
});

test("database lifecycle invariants require Owner/Manager and Staff cannot create inactive records", async () => {
  const migration = await source(migrationPath);
  const guard = body(migration, "protect_customer_lifecycle_state", "set_customer_lifecycle_active");

  assert.match(guard, /new\.is_active is distinct from old\.is_active/);
  assert.match(guard, /old\.organization_id,[\s\S]*array\['owner', 'manager'\]/);
  assert.match(guard, /customer_lifecycle_not_authorized/);
  assert.match(guard, /not new\.is_active[\s\S]*array\['owner', 'manager'\]/);
  assert.match(migration, /before update of is_active on public\.customers/);
});

test("eligibility is server-side, structured and blocks protected dependencies", async () => {
  const migration = await source(migrationPath);
  const eligibility = body(migration, "get_customer_lifecycle_eligibility", "update_customer_portal_access");

  for (const table of ["properties", "customer_portal_access", "orders", "order_items", "order_status_history", "payments", "pickups", "deliveries", "order_photos"]) {
    assert.match(eligibility, new RegExp(`public\\.${table}`));
  }
  for (const reason of ["active_customer", "properties", "portal_access", "orders", "order_history", "payments", "operational_history", "media", "segment_assignment"]) {
    assert.match(eligibility, new RegExp(`'${reason}'`));
  }
  assert.match(eligibility, /cardinality\(reasons\) = 0/);
  assert.match(eligibility, /false,[\s\n]+cardinality\(reasons\) = 0/);
});

test("inactive customers cannot have Portal access re-enabled", async () => {
  const migration = await source(migrationPath);
  const portal = body(migration, "update_customer_portal_access", null);

  assert.match(portal, /join public\.customers customer/);
  assert.match(portal, /if target_is_active and not customer_active then/);
  assert.match(portal, /customer_lifecycle_inactive_customer/);
  assert.match(migration, /revoke all on function public\.update_customer_portal_access\(uuid, boolean\)/);
  assert.match(migration, /grant execute on function public\.update_customer_portal_access\(uuid, boolean\) to authenticated/);
});

test("existing internal and Portal order creation enforce active customer state server-side", async () => {
  const [internalOrder, portalOrder, orderQueries] = await Promise.all([
    source("supabase/migrations/20260730000100_infra_001_smoke_fix_order_helper_and_embeds.sql"),
    source("supabase/migrations/20260823000200_portal_002_1_fix_order_request_rpc.sql"),
    source("src/features/orders/server/queries.ts"),
  ]);

  assert.match(internalOrder, /customer\.is_active/);
  assert.match(portalOrder, /access\.is_active/);
  assert.match(portalOrder, /customer\.is_active/);
  assert.match(orderQueries, /\.eq\("is_active", true\)/);
});

test("Customer Account exposes calm lifecycle controls without destructive actions", async () => {
  const [account, control, actions, portal] = await Promise.all([
    source("src/components/customers/CustomerAccountView.tsx"),
    source("src/components/customers/CustomerLifecycleControl.tsx"),
    source("src/features/customers/server/actions.ts"),
    source("src/components/customers/CustomerPortalAccessPanel.tsx"),
  ]);

  assert.match(account, /customer\.isActive \? \(/);
  assert.match(account, /CustomerLifecycleControl/);
  assert.match(control, /confirmLabel=\{text\.confirmDeactivate\}/);
  assert.match(control, /eligibility\.blockingReasons/);
  assert.match(actions, /requireOwnerOrManager\(locale\)/);
  assert.match(actions, /set_customer_lifecycle_active/);
  assert.match(portal, /customerIsActive/);
  assert.doesNotMatch(control, /deleteCustomerAction|anonymizeCustomerAction/);
});

test("all five locales include lifecycle, Portal and dependency vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    const lifecycle = messages.customerAccount.lifecycle;
    assert.equal(typeof lifecycle.activeDescription, "string");
    assert.equal(typeof lifecycle.inactiveDescription, "string");
    assert.equal(typeof lifecycle.confirmDeactivate, "string");
    assert.equal(typeof lifecycle.portalInactive, "string");
    assert.equal(typeof lifecycle.anonymizationUnavailable, "string");
    assert.equal(typeof lifecycle.hardDeleteBlocked, "string");
    assert.equal(typeof lifecycle.blockers.payments, "string");
    assert.equal(typeof lifecycle.blockers.media, "string");
  }
});

test("SECURITY DEFINER lifecycle RPCs use fixed search paths and least privilege", async () => {
  const migration = await source(migrationPath);

  assert.equal((migration.match(/security definer/g) ?? []).length, 4);
  assert.equal((migration.match(/set search_path = public/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/);
  assert.match(migration, /revoke all on function public\.set_customer_lifecycle_active\(uuid, boolean\) from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.get_customer_lifecycle_eligibility\(uuid\) from public, anon, authenticated/);
});
