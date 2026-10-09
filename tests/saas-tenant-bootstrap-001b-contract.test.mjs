import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = "supabase/migrations/20261007000400_saas_tenant_bootstrap_001b.sql";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read(migrationPath);
const rpc = migration.split("create function public.platform_bootstrap_tenant(")[1]
  ?.split("\nrevoke all on function public.platform_bootstrap_tenant(")[0];

test("migration is isolated and historical migrations remain byte unchanged", () => {
  assert.ok(rpc);
  assert.equal((migration.match(/create function public\.platform_bootstrap_tenant\(/g) ?? []).length, 1);
  for (const path of [
    "supabase/migrations/20260727000100_app_003_tenant_foundation.sql",
    "supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql",
    "supabase/migrations/20260827000300_platform_admin_001_saas_control_center.sql",
    "supabase/migrations/20261007000300_saas_productization_configuration_foundation_001.sql",
  ]) {
    const committed = execFileSync("git", ["show", `HEAD:${path}`]);
    assert.equal(createHash("sha256").update(read(path)).digest("hex"),
      createHash("sha256").update(committed).digest("hex"), path);
  }
});

test("platform boundary and sealed receipt exclude tenant and anonymous writes", () => {
  assert.match(migration, /create table public\.platform_tenant_bootstrap_receipts/);
  assert.match(migration, /idempotency_key uuid primary key/);
  assert.match(migration, /request_fingerprint text not null/);
  assert.match(migration, /organization_id uuid not null unique/);
  assert.match(migration, /alter table public\.platform_tenant_bootstrap_receipts enable row level security/);
  assert.match(migration, /revoke all on public\.platform_tenant_bootstrap_receipts from public, anon, authenticated/);
  assert.doesNotMatch(migration, /create policy .*platform_tenant_bootstrap_receipts/i);
  assert.match(rpc, /security definer\s+set search_path = ''/);
  assert.match(rpc, /public\.require_platform_admin_identity\(\)/);
  assert.match(migration, /revoke all on function public\.platform_bootstrap_tenant\([\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.platform_bootstrap_tenant\([\s\S]*?to authenticated/);
  assert.doesNotMatch(migration, /grant .* to anon/);
});

test("RPC accepts explicit tenant settings and a preexisting first Owner, never an organization id", () => {
  const signature = rpc.split(")\nreturns table")[0];
  for (const name of ["target_idempotency_key", "target_name", "target_slug",
    "target_default_currency", "target_timezone", "target_default_locale",
    "target_default_country_code", "target_owner_profile_id", "target_first_location_name"]) {
    assert.match(signature, new RegExp(`\\b${name}\\b`));
  }
  assert.doesNotMatch(signature, /target_organization_id|organization_id/);
  assert.match(rpc, /join auth\.users auth_user on auth_user\.id = profile\.id/);
  assert.match(rpc, /auth_user\.is_anonymous = false/);
  assert.match(rpc, /auth_user\.deleted_at is null/);
  assert.match(rpc, /auth_user\.banned_until is null or auth_user\.banned_until <= now\(\)/);
  assert.match(rpc, /from auth\.identities identity/);
  assert.match(rpc, /profile\.id = target_owner_profile_id/);
  assert.match(rpc, /portal\.user_id = target_owner_profile_id and portal\.is_active/);
  assert.match(rpc, /membership\.profile_id = target_owner_profile_id and membership\.is_active/);
  assert.match(rpc, /platform_tenant_bootstrap_owner_membership_conflict/);
  assert.doesNotMatch(rpc, /platform_admin_is_active\(target_owner_profile_id\)/);
});

test("same-owner and same-key calls serialize without a global membership restriction", () => {
  assert.match(rpc, /pg_advisory_xact_lock\(1707004, pg_catalog\.hashtext\(target_idempotency_key::text\)\)/);
  assert.match(rpc, /pg_advisory_xact_lock\(1707005, pg_catalog\.hashtext\(target_owner_profile_id::text\)\)/);
  assert.ok(rpc.indexOf("pg_advisory_xact_lock(1707004") < rpc.indexOf("pg_advisory_xact_lock(1707005"));
  assert.ok(rpc.indexOf("pg_advisory_xact_lock(1707005") < rpc.indexOf("membership.profile_id = target_owner_profile_id"));
  assert.doesNotMatch(migration, /create\s+unique\s+index[\s\S]*?profile_id[\s\S]*?where\s+is_active/i);
  assert.doesNotMatch(migration, /alter\s+table\s+public\.organization_memberships/i);
});

test("organization and slug validation require explicit non-pilot values", () => {
  assert.match(rpc, /target_slug <> normalized_slug/);
  assert.match(rpc, /target_slug !~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'/);
  assert.match(rpc, /target_default_currency !~ '\^\[A-Z\]\{3\}\$'/);
  assert.match(rpc, /pg_catalog\.pg_timezone_names/);
  assert.match(rpc, /target_default_locale not in \('en', 'it', 'es', 'fr', 'de'\)/);
  assert.match(rpc, /target_default_country_code !~ '\^\[A-Z\]\{2\}\$'/);
  assert.match(rpc, /insert into public\.organizations \([\s\S]*?name, slug, status, default_currency, timezone, default_locale,[\s\S]*?default_country_code, platform_service_status, created_by/);
  assert.match(rpc, /platform_tenant_bootstrap_slug_conflict/);
  assert.doesNotMatch(migration, /ecowash-la-tejita|Atlantic\/Canary|\bEUR\b|\bDemo Tenant\b/);
});

test("exact four catalog-backed technical entitlements and one active country-bound location", () => {
  const sourceCatalog = read("supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql");
  const expected = ["core.orders", "core.customers", "core.operations", "catalog.management"];
  for (const key of expected) assert.match(sourceCatalog, new RegExp(`'${key.replace(".", "\\.")}'`));
  const entitlementInsert = rpc.split("insert into public.organization_entitlements (")[1]
    ?.split("get diagnostics inserted_entitlement_count")[0];
  assert.ok(entitlementInsert);
  assert.deepEqual([...entitlementInsert.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1]), expected);
  assert.match(entitlementInsert, /true, 'tenant_bootstrap'/);
  assert.match(rpc, /inserted_entitlement_count <> 4/);
  assert.match(rpc, /insert into public\.organization_memberships \([\s\S]*?new_organization_id, target_owner_profile_id, 'owner', true, actor_id/);
  assert.match(rpc, /insert into public\.locations \([\s\S]*?organization_id, name, country_code, is_active[\s\S]*?new_organization_id, normalized_location_name, target_default_country_code, true/);
  assert.doesNotMatch(migration, /insert into public\.(warehouse_positions|printer_profiles|organization_billing_settings)/);
});

test("idempotency receipt distinguishes replay, changed payload, and a new-key slug collision", () => {
  assert.match(rpc, /jsonb_build_array\([\s\S]*?normalized_name, normalized_slug, target_default_currency, target_timezone,[\s\S]*?target_owner_profile_id, normalized_location_name/);
  assert.match(rpc, /extensions\.digest\([\s\S]*?'sha256'/);
  assert.match(rpc, /prior_receipt\.request_fingerprint <> fingerprint[\s\S]*?platform_tenant_bootstrap_idempotency_conflict/);
  assert.match(rpc, /prior_receipt\.first_location_id, prior_receipt\.idempotency_key, true/);
  assert.match(rpc, /organization\.slug = normalized_slug[\s\S]*?platform_tenant_bootstrap_slug_conflict/);
  assert.match(rpc, /exception when unique_violation then[\s\S]*?platform_tenant_bootstrap_slug_conflict/);
  assert.match(rpc, /insert into public\.platform_tenant_bootstrap_receipts/);
  assert.match(rpc, /target_idempotency_key, false/);
});

test("all database writes are in one RPC invocation and audit is committed with receipt", () => {
  for (const table of ["organizations", "organization_memberships", "organization_entitlements",
    "locations", "platform_tenant_bootstrap_receipts", "platform_audit_log"]) {
    assert.match(rpc, new RegExp(`insert into public\\.${table} \\(`));
  }
  assert.match(rpc, /insert into public\.platform_audit_log[\s\S]*?'tenant_bootstrap'/);
  for (const key of ["organization_id", "owner_profile_id", "owner_membership_id",
    "first_location_id", "entitlements", "idempotency_key"]) {
    assert.match(rpc, new RegExp(`'${key}'`));
  }
  assert.doesNotMatch(migration, /auth\.admin|inviteUserByEmail|signInWithOtp|service_role|http\(|net\.http/i);
  assert.doesNotMatch(migration, /insert into (auth\.users|public\.platform_admins)/i);
  assert.doesNotMatch(migration, /\b(update|delete from)\s+public\.(organizations|organization_memberships|organization_entitlements|locations)/i);
});
