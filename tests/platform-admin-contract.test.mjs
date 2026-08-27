import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260827000300_platform_admin_001_saas_control_center.sql";
async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("1 platform identity is separate from tenant organization roles", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /create table public\.platform_admins/);
  assert.match(migration, /user_id uuid primary key references public\.profiles/);
  assert.doesNotMatch(migration, /alter type public\.app_role.*platform_admin/is);
  assert.doesNotMatch(migration, /organization_memberships[\s\S]{0,120}platform_admin/);
});

test("2 no arbitrary Platform Admin is automatically bootstrapped", async () => {
  const migration = await source(migrationPath);
  assert.doesNotMatch(migration, /insert into public\.platform_admins\s*\(/i);
  assert.match(migration, /No tenant-facing route or RPC can perform this operation/);
});

test("3 every platform route and query uses the dedicated server guard", async () => {
  const [guard, layout, queries, actions] = await Promise.all([
    source("src/lib/auth/require-platform-admin.ts"),
    source("src/app/[locale]/platform/layout.tsx"),
    source("src/features/platform-admin/server/queries.ts"),
    source("src/features/platform-admin/server/actions.ts"),
  ]);
  assert.match(guard, /rpc\("is_platform_admin"\)/);
  assert.match(layout, /requirePlatformAdmin\(locale\)/);
  assert.ok((queries.match(/requirePlatformAdmin\(locale\)/g) ?? []).length >= 3);
  assert.ok((actions.match(/requirePlatformAdmin\(locale\)/g) ?? []).length >= 3);
});

test("4 Owner, Manager, Staff and Customer have no platform identity fallback", async () => {
  const [guard, migration] = await Promise.all([source("src/lib/auth/require-platform-admin.ts"), source(migrationPath)]);
  assert.doesNotMatch(guard, /requireOwner|requireOwnerOrManager|organization_membership/);
  assert.match(migration, /platform_admin_required/);
  assert.doesNotMatch(migration, /has_organization_role[\s\S]{0,160}platform_get_/);
});

test("5 Platform Admin organization listing is cross-tenant and bounded", async () => {
  const migration = await source(migrationPath);
  const start = migration.indexOf("create function public.platform_list_organizations(");
  const end = migration.indexOf("create function public.platform_get_organization_summary", start);
  const fn = migration.slice(start, end);
  assert.match(fn, /require_platform_admin_identity/);
  assert.match(fn, /target_limit > 100/);
  assert.match(fn, /organization\.name ilike/);
  assert.match(fn, /target_status is null/);
});

test("6 Platform organization list and detail expose only bounded summaries", async () => {
  const [list, detail] = await Promise.all([
    source("src/app/[locale]/platform/organizations/page.tsx"),
    source("src/app/[locale]/platform/organizations/[organizationId]/page.tsx"),
  ]);
  assert.match(list, /enabledFeatureCount/);
  assert.match(list, /memberCount/);
  assert.match(detail, /customerCount/);
  assert.match(detail, /brandingCommercialName/);
  assert.doesNotMatch(detail, /customer\.email|customer\.phone|tax_id/);
});

test("7 entitlement enable and disable use one guarded audited RPC", async () => {
  const migration = await source(migrationPath);
  const start = migration.indexOf("create function public.platform_set_organization_entitlement(");
  const end = migration.indexOf("create function public.platform_set_organization_service_status", start);
  const fn = migration.slice(start, end);
  assert.match(fn, /require_platform_admin_identity/);
  assert.match(fn, /on conflict \(organization_id, feature_key\)/);
  assert.match(fn, /entitlement_enabled/);
  assert.match(fn, /entitlement_disabled/);
  assert.match(fn, /insert into public\.platform_audit_log/);
});

test("8 entitlement changes never delete premium business data", async () => {
  const migration = await source(migrationPath);
  assert.doesNotMatch(migration, /delete from public\.(invoices|invoice_items|catalog_segment_prices|organization_branding)/i);
  assert.doesNotMatch(migration, /update public\.(invoices|invoice_items|catalog_segment_prices|organization_branding)/i);
});

test("9 tenant Owner cannot self-enable features or write platform tables", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /revoke all on public\.platform_admins from public, anon, authenticated/);
  assert.match(migration, /revoke all on public\.platform_audit_log from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete).*organization_entitlements.*authenticated/i);
});

test("10 suspension and reactivation are non-destructive audited service-state changes", async () => {
  const migration = await source(migrationPath);
  const start = migration.indexOf("create function public.platform_set_organization_service_status(");
  const end = migration.indexOf("create function public.platform_set_organization_commercial_label", start);
  const fn = migration.slice(start, end);
  assert.match(fn, /platform_service_status = target_status/);
  assert.match(fn, /organization_suspended/);
  assert.match(fn, /organization_reactivated/);
  assert.doesNotMatch(fn, /delete from/);
});

test("11 suspended tenant database API access is blocked centrally", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /create function public\.platform_assert_request_allowed\(\)/);
  assert.match(migration, /organization\.platform_service_status = 'suspended'/);
  assert.match(migration, /alter role authenticator set pgrst\.db_pre_request/);
  assert.match(migration, /raise exception 'organization_suspended'/);
});

test("12 suspended tenant app access has a dedicated localized experience", async () => {
  const [profile, membership, page] = await Promise.all([
    source("src/lib/auth/get-current-profile.ts"),
    source("src/lib/auth/require-membership.ts"),
    source("src/app/[locale]/app/suspended/page.tsx"),
  ]);
  assert.match(profile, /throw new Error\("organization_suspended"\)/);
  assert.match(membership, /issue === "suspended_organization"/);
  assert.match(membership, /\/app\/suspended/);
  assert.match(page, /common\.organizationSuspended/);
});

test("13 suspended Customer Portal access is denied clearly", async () => {
  const [queries, accessPage] = await Promise.all([
    source("src/features/portal/server/queries.ts"),
    source("src/app/[locale]/portal/access/page.tsx"),
  ]);
  assert.match(queries, /organization_suspended/);
  assert.match(queries, /portal\/access\?suspended=1/);
  assert.match(accessPage, /suspendedDescription/);
});

test("14 Platform Admin can still manage suspended organizations", async () => {
  const migration = await source(migrationPath);
  const start = migration.indexOf("create function public.platform_assert_request_allowed()");
  const end = migration.indexOf("create or replace function public.is_organization_member", start);
  const fn = migration.slice(start, end);
  assert.match(fn, /public\.platform_admin_is_active\(actor_id\)/);
  assert.match(fn, /return;/);
});

test("15 commercial plan label is informational and independent from entitlements", async () => {
  const [migration, detail] = await Promise.all([source(migrationPath), source("src/app/[locale]/platform/organizations/[organizationId]/page.tsx")]);
  const start = migration.indexOf("create function public.platform_set_organization_commercial_label(");
  const end = migration.indexOf("\n$$;", start) + 4;
  const fn = migration.slice(start, end);
  assert.match(fn, /commercial_plan_label = normalized_label/);
  assert.doesNotMatch(fn, /organization_entitlements/);
  assert.match(detail, /commercialHelp/);
});

test("16 audit trail is append-only and unavailable directly to tenant users", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /create table public\.platform_audit_log/);
  assert.match(migration, /alter table public\.platform_audit_log enable row level security/);
  assert.doesNotMatch(migration, /create policy .*platform_audit_log/is);
  assert.doesNotMatch(migration, /grant select on public\.platform_audit_log to authenticated/);
});

test("17 Tenant A and Tenant B isolation helpers remain tenant-scoped", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /membership\.organization_id = target_organization_id/);
  assert.match(migration, /membership\.profile_id = auth\.uid\(\)/);
  assert.match(migration, /organization\.platform_service_status = 'active'/);
});

test("18 EcoWash remains active and existing entitlements are not rewritten", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /platform_service_status public\.platform_service_status not null default 'active'/);
  assert.doesNotMatch(migration, /update public\.organization_entitlements/i);
  assert.doesNotMatch(migration, /update public\.organizations[\s\S]{0,180}EcoWash/i);
});

test("19 no organization deletion or impersonation surface exists", async () => {
  const [migration, actions] = await Promise.all([source(migrationPath), source("src/features/platform-admin/server/actions.ts")]);
  assert.doesNotMatch(migration, /delete from public\.organizations/i);
  assert.doesNotMatch(actions, /impersonat|deleteOrganization|service.role/i);
});

test("20 Platform shell and complete five-locale vocabulary are present", async () => {
  const [shell, ...messages] = await Promise.all([
    source("src/components/platform/PlatformShell.tsx"),
    ...["en", "it", "es", "fr", "de"].map((locale) => source(`src/i18n/${locale}/common.json`).then(JSON.parse)),
  ]);
  assert.match(shell, /Phoenix Platform/);
  assert.match(shell, /\/platform\/organizations/);
  for (const message of messages) {
    assert.ok(message.platform?.features?.labels?.billingInvoicing);
    assert.ok(message.platform?.audit?.actions?.organization_suspended);
    assert.ok(message.organizationSuspended?.description);
    assert.ok(message.portal?.suspendedDescription);
  }
});
