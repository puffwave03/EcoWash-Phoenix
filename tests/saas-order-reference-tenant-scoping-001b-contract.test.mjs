import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20261010000100_saas_order_reference_tenant_scoping_001b.sql";

test("approved existing tenants have explicit independent prefixes and history-derived next values", async () => {
  const sql = await source(migration);
  for (const [slug, prefix] of [
    ["ecowash-la-tejita", "EW"],
    ["phoenix-demo-laundry-staging", "PD"],
    ["phoenix-uat-tenant-001c", "PU"],
  ]) assert.match(sql, new RegExp(`when '${slug}' then '${prefix}'`));
  assert.match(sql, /max\(substring\(o\.order_number from length\(selected_prefix\) \+ 2\)::bigint\)/);
  assert.match(sql, /o\.organization_id = tenant\.id[\s\S]*o\.order_number ~ \('\^' \|\| selected_prefix/);
  assert.match(sql, /order_reference_prefix_unresolved: organization=%/);
  assert.match(sql, /total_orders = 0 or valid_orders <> total_orders or prefix_count <> 1/);
  assert.doesNotMatch(sql, /\b(update|delete from|truncate)\s+public\.orders\b/i);
});

test("one private, atomic organization allocator replaces both active order generators", async () => {
  const sql = await source(migration);
  assert.match(sql, /organization_id uuid primary key references public\.organizations/);
  assert.match(sql, /update public\.organization_order_numbering numbering[\s\S]*where numbering\.organization_id = target_organization_id[\s\S]*returning numbering\.order_prefix, numbering\.next_order_number - 1/);
  assert.match(sql, /public\.allocate_order_reference\(org_id\)/);
  assert.match(sql, /public\.allocate_order_reference\(portal_org_id\)/);
  assert.match(sql, /order_reference_staff_generator_drift/);
  assert.match(sql, /order_reference_portal_generator_drift/);
  assert.doesNotMatch(sql, /create sequence|drop sequence|MAX\(order_number\)\s*\+\s*1/i);
  const oldOrders = await source("supabase/migrations/20260728000200_app_006_orders_workflow.sql");
  assert.match(oldOrders, /unique \(organization_id, order_number\)|orders_number_unique_per_organization/);
});

test("bootstrap requires an explicit prefix, creates configuration once and rejects changed replay", async () => {
  const [sql, action, form, validation] = await Promise.all([
    source(migration),
    source("src/features/platform-admin/server/tenant-onboarding.ts"),
    source("src/components/platform/PlatformTenantOnboardingForm.tsx"),
    source("src/features/platform-admin/tenant-onboarding-validation.ts"),
  ]);
  assert.match(sql, /target_order_prefix text/);
  assert.match(sql, /if created\.replayed then[\s\S]*existing_prefix is distinct from target_order_prefix[\s\S]*else[\s\S]*insert into public\.organization_order_numbering/);
  assert.match(action, /target_order_prefix: input\.orderPrefix/);
  assert.match(form, /name="orderPrefix" onChange/);
  assert.match(form, /required value=\{orderPrefix\}/);
  assert.match(validation, /\^\[A-Z0-9\]\{2,6\}\$/);
  assert.doesNotMatch(form, /suggest.*Prefix|derive.*Prefix/);
});

test("numbering is private and new reference parsing preserves organization scoping", async () => {
  const [sql, shop, quickDrop, terminal] = await Promise.all([
    source(migration),
    source("src/features/shop-terminal/server/actions.ts"),
    source("supabase/migrations/20260829000600_quick_drop_001a_canonical_intake.sql"),
    source("supabase/migrations/20260907000100_terminal_order_defaults_001.sql"),
  ]);
  assert.match(sql, /alter table public\.organization_order_numbering enable row level security/);
  assert.match(sql, /revoke all on public\.organization_order_numbering from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.allocate_order_reference\(uuid\) from public, anon, authenticated/);
  assert.match(shop, /const ORDER_NUMBER = \/\^\[a-z0-9\]\{2,12\}-\\d\{1,12\}\$\/i/);
  assert.match(shop, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(quickDrop, /from public\.create_order\(/);
  assert.match(terminal, /from public\.create_order\(/);
});
