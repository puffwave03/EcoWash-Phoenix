import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const migration = read("20261023192656_security_d03_multicontext_suspension_001b.sql");
const platform = read("20260827000300_platform_admin_001_saas_control_center.sql");
const f04 = read("20261023122144_security_f04_inactive_org_helpers_001a.sql");
const portal = read("20261014000200_portal_entitlement_boundary_001.sql");
const entitlements = read("20260827000200_entitlements_001_tenant_feature_access.sql");
function fn(sql, name) {
  const start = sql.search(new RegExp(`create(?: or replace)? function public\\.${name}\\s*\\(`, "i"));
  assert.notEqual(start, -1, name);
  const end = sql.indexOf("$$;", start);
  assert.notEqual(end, -1, name);
  return sql.slice(start, end + 3);
}
function policy(sql, name) {
  const start = sql.indexOf(`create policy ${name}`);
  assert.notEqual(start, -1, name);
  return sql.slice(start, sql.indexOf(";", start) + 1);
}
const hook = fn(migration, "platform_assert_request_allowed");
const resolver = fn(migration, "app_current_organization_id");

test("migration replaces only the two coordinated guards without ACL, data or policy changes", () => {
  assert.deepEqual([...migration.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]),
    ["platform_assert_request_allowed", "app_current_organization_id"]);
  assert.doesNotMatch(migration, /^\s*(?:grant|revoke|alter|drop|insert|update|delete|create policy)\b/im);
  assert.equal((migration.match(/language plpgsql\nstable\nsecurity definer\nset search_path = public/g) ?? []).length, 2);
  for (const [name, prior] of [
    ["platform_assert_request_allowed", platform],
    ["app_current_organization_id", read("20260828000100_pos_001_1_fix_current_organization_uuid_aggregate.sql")],
  ]) {
    const header = (body) => body.slice(0, body.indexOf("as $$")).replace("create function", "create or replace function");
    assert.equal(header(fn(migration, name)), header(fn(prior, name)));
  }
});

test("Staff usable contexts require authenticated active membership and active nondeleted organization", () => {
  for (const body of [hook.slice(0, hook.indexOf("-- Reuse")), resolver.slice(0, resolver.indexOf("if membership_count = 0"))]) {
    assert.match(body, /membership\.is_active/);
    assert.match(body, /organization\.status = 'active'/);
    assert.match(body, /organization\.platform_service_status = 'active'/);
    assert.match(body, /organization\.deleted_at is null/);
    assert.match(body, /membership\.profile_id = (?:actor_id|auth\.uid\(\))/);
  }
  assert.ok(resolver.indexOf("select count(*)") < resolver.indexOf("platform_service_status = 'suspended'"));
  assert.match(resolver, /membership_count = 0 and exists/);
  assert.match(resolver, /if membership_count <> 1 then[\s\S]*single active organization membership required/);
});

test("Portal availability reuses canonical selection, customer/activity and entitlement without fallback", () => {
  assert.match(hook, /select 1 from public\.customer_portal_current_access\(\)/);
  const canonical = fn(portal, "customer_portal_current_access");
  assert.match(canonical, /access\.user_id = auth\.uid\(\) and access\.is_active and customer\.is_active/);
  assert.ok(canonical.indexOf("limit 1") < canonical.indexOf("organization.platform_service_status = 'active'"));
  assert.ok(canonical.indexOf("limit 1") < canonical.indexOf("organization_entitlement_is_enabled"));
  assert.match(hook, /if actor_id is null or public\.platform_admin_is_active\(actor_id\) then\s+return/);
  assert.match(hook, /raise exception 'organization_suspended' using errcode = '42501'/);
});

test("suspended tenant reads remain guarded by real F04, Portal, POS and entitlement boundaries", () => {
  for (const name of ["is_organization_member", "has_organization_role", "shares_organization_with_profile"]) {
    const body = fn(f04, name);
    assert.match(body, /organization\.platform_service_status = 'active'/);
    assert.match(body, /organization\.status = 'active'/);
    assert.match(body, /organization\.deleted_at is null/);
  }
  assert.match(policy(read("20260728000200_app_006_orders_workflow.sql"), '"orders_select_member"'), /is_organization_member\(organization_id\)/);
  assert.match(policy(read("20260728000100_app_005_customers_properties.sql"), '"customers_select_member"'), /is_organization_member\(organization_id\)/);
  assert.match(policy(read("20260827000400_pos_001_cash_register_foundation.sql"), "pos_sessions_select_authorized"), /has_organization_entitlement/);
  assert.match(fn(entitlements, "has_organization_entitlement"), /is_organization_member\(target_organization_id\)/);
  const isolation = read("20261005000200_portal_context_isolation_001.sql");
  for (const name of ["list_customer_portal_orders", "get_customer_portal_order", "can_access_customer_order_photo"]) {
    assert.match(fn(isolation, name), /customer_portal_current_access\(\) portal_context/);
  }
  const removed = read("20260803000200_portal_001_safe_customer_rpc.sql");
  assert.match(removed, /drop policy if exists "orders_select_portal_user"/);
  assert.match(removed, /drop policy if exists "customers_select_portal_user"/);
  assert.match(policy(portal, "customer_portal_access_select_self_or_manager"), /is_customer_portal_user_for_organization/);
});

// Reuse the 001E disposable-PostgreSQL harness pattern. No remote host, Docker,
// production Auth, or real data. SQL identity is simulated; this is not HTTP
// PostgREST proof. Existing protected databases are never accepted as targets.
const url = process.env.PHOENIX_D03_TEST_DATABASE_URL;
test("isolated SQL matrix: mixed contexts, suspension, RLS and unchanged Platform Admin", {
  skip: url ? false : "RUNTIME_NOT_VERIFIED: no disposable local PostgreSQL URL", timeout: 90000,
}, async (t) => {
  const parsed = new URL(url);
  assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/phoenix_d03_test_[a-z0-9_]+$/);
  assert.equal(parsed.search, "");
  const db = parsed.pathname.slice(1);
  const env = { ...process.env, PGDATABASE: db, PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password), PGHOST: parsed.hostname, PGPORT: parsed.port || "5432",
    PGSSLMODE: "disable", PGOPTIONS: "", PGSERVICE: "", PGSERVICEFILE: "", PGCONNECT_TIMEOUT: "3" };
  delete env.PGHOSTADDR;
  function raw(input) { return spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { env, input, encoding: "utf8", timeout: 15000 }); }
  function sql(input) { const r = raw(input); if (r.error) throw r.error; assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); }
  function denied(input, message) { const r = raw(input); if (r.error) throw r.error; assert.notEqual(r.status, 0); assert.match(r.stderr, message); }
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const a = id(1), b = id(2), c = id(3), staff = id(10), portalUser = id(11), admin = id(12), foreign = id(13);
  const as = (actor, query) => `set request.jwt.claim.sub='${actor}';set role authenticated;${query}`;
  const gate = "select public.platform_assert_request_allowed();";
  assert.equal(sql("select current_database();"), db);
  assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';"), "0");
  assert.equal(sql("select count(*) from pg_namespace where nspname in ('auth','extensions');"), "0");
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated');"), "2");
  sql(`create schema auth;grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create type public.app_role as enum ('owner','manager','staff');
    create table public.organizations(id uuid primary key,status text,platform_service_status text,deleted_at timestamptz);
    create table public.organization_memberships(organization_id uuid,profile_id uuid,is_active boolean,role public.app_role);
    create table public.platform_admins(user_id uuid,role text,is_active boolean);
    create table public.platform_feature_catalog(feature_key text);
    create table public.organization_entitlements(organization_id uuid,feature_key text,enabled boolean,valid_from timestamptz,valid_until timestamptz);
    create table public.customers(id uuid primary key,organization_id uuid,display_name text,email text,is_active boolean);
    create table public.customer_portal_access(id uuid,user_id uuid,organization_id uuid,customer_id uuid,email text,is_active boolean,created_at timestamptz);
    create table public.orders(id uuid,organization_id uuid);
    ${fn(platform, "platform_admin_is_active")}
    ${fn(platform, "require_platform_admin_identity")}
    ${fn(entitlements, "organization_entitlement_is_enabled")}
    ${f04}
    ${fn(portal, "customer_portal_current_access")}
    ${fn(read("20261005000200_portal_context_isolation_001.sql"), "is_customer_portal_user_for_organization")}
    ${migration}
    alter table public.orders enable row level security;
    ${policy(read("20260728000200_app_006_orders_workflow.sql"), '"orders_select_member"')}
    alter table public.customers enable row level security;
    ${policy(read("20260728000100_app_005_customers_properties.sql"), '"customers_select_member"')}
    alter table public.customer_portal_access enable row level security;
    ${policy(portal, "customer_portal_access_select_self_or_manager")}
    grant select on public.orders,public.customers,public.customer_portal_access to authenticated;
    insert into public.organizations values ('${a}','active','active',null),('${b}','active','suspended',null),('${c}','active','active',null);
    insert into public.organization_memberships values ('${a}','${staff}',true,'staff'),('${b}','${staff}',true,'staff');
    insert into public.platform_admins values ('${admin}','platform_admin',true);
    insert into public.platform_feature_catalog values ('core.portal');
    insert into public.organization_entitlements values ('${a}','core.portal',true,null,null),('${b}','core.portal',true,null,null);
    insert into public.customers values ('${id(20)}','${a}','Synthetic A','a@example.invalid',true),('${id(21)}','${b}','Synthetic B','b@example.invalid',true);
    insert into public.customer_portal_access values ('${id(30)}','${portalUser}','${a}','${id(20)}','a@example.invalid',true,'2026-01-01'),('${id(31)}','${portalUser}','${b}','${id(21)}','b@example.invalid',true,'2026-01-02');
    insert into public.orders values ('${id(40)}','${a}'),('${id(41)}','${b}');`);

  await t.test("Staff A remains usable and B rows/roles remain denied", () => {
    assert.equal(sql(as(staff, gate + "select public.app_current_organization_id();")), a);
    assert.equal(sql(as(staff, "select organization_id from public.orders;")), a);
    assert.equal(sql(as(staff, `select public.is_organization_member('${b}'),public.has_organization_role('${b}',array['staff']::public.app_role[]);`)), "f|f");
    assert.equal(sql(as(staff, `select count(*) from public.customers where organization_id='${b}';`)), "0");
  });
  await t.test("Portal A remains canonical and B association/data stay inaccessible", () => {
    assert.equal(sql(as(portalUser, gate + "select organization_id from public.customer_portal_current_access();")), a);
    assert.equal(sql(as(portalUser, "select organization_id from public.customer_portal_access;")), a);
    assert.equal(sql(as(portalUser, `select count(*) from public.orders where organization_id='${b}';`)), "0");
    assert.equal(sql(as(portalUser, `select public.is_customer_portal_user_for_organization('${b}');`)), "f");
  });
  await t.test("canonical suspended first context never falls back to A", () => {
    sql(`update public.customer_portal_access set created_at='2025-01-01' where organization_id='${b}';`);
    assert.equal(sql(as(portalUser, "select count(*) from public.customer_portal_current_access();")), "0");
    denied(as(portalUser, gate), /organization_suspended/);
    sql(`update public.customer_portal_access set created_at='2026-01-02' where organization_id='${b}';`);
  });
  await t.test("inactive B associations do not veto A", () => {
    sql(`update public.organization_memberships set is_active=false where organization_id='${b}';update public.customer_portal_access set is_active=false where organization_id='${b}';`);
    assert.equal(sql(as(staff, gate + "select public.app_current_organization_id();")), a);
    assert.equal(sql(as(portalUser, gate + "select organization_id from public.customer_portal_current_access();")), a);
    sql(`update public.organization_memberships set is_active=true where organization_id='${b}';update public.customer_portal_access set is_active=true where organization_id='${b}';`);
  });
  await t.test("disabled B customer cannot interfere with canonical A", () => {
    sql(`update public.customers set is_active=false where organization_id='${b}';update public.customer_portal_access set created_at='2025-01-01' where organization_id='${b}';`);
    assert.equal(sql(as(portalUser, gate + "select organization_id from public.customer_portal_current_access();")), a);
    sql(`update public.customers set is_active=true where organization_id='${b}';update public.customer_portal_access set created_at='2026-01-02' where organization_id='${b}';`);
  });
  await t.test("missing entitlement never switches canonical A to another context", () => {
    sql(`update public.organization_entitlements set enabled=false where organization_id='${a}';update public.organizations set platform_service_status='active' where id='${b}';`);
    assert.equal(sql(as(portalUser, "select count(*) from public.customer_portal_current_access();")), "0");
    sql(`update public.organizations set platform_service_status='suspended' where id='${b}';`);
    denied(as(portalUser, gate), /organization_suspended/);
    sql(`update public.organization_entitlements set enabled=true where organization_id='${a}';`);
  });
  await t.test("Staff A survives a suspended Portal association without gaining B", () => {
    sql(`insert into public.customer_portal_access values ('${id(32)}','${staff}','${b}','${id(21)}','b@example.invalid',true,'2026-01-01');`);
    assert.equal(sql(as(staff, gate + "select public.app_current_organization_id();")), a);
    assert.equal(sql(as(staff, "select count(*) from public.customer_portal_current_access();")), "0");
    sql(`delete from public.customer_portal_access where id='${id(32)}';`);
  });
  await t.test("Portal A survives a suspended Staff membership without a Staff fallback", () => {
    sql(`insert into public.organization_memberships values ('${b}','${portalUser}',true,'staff');`);
    assert.equal(sql(as(portalUser, gate + "select organization_id from public.customer_portal_current_access();")), a);
    denied(as(portalUser, "select public.app_current_organization_id();"), /organization_suspended/);
    sql(`delete from public.organization_memberships where profile_id='${portalUser}';`);
  });
  await t.test("two active Staff contexts remain ambiguous", () => {
    sql(`insert into public.organization_memberships values ('${c}','${staff}',true,'staff');`);
    denied(as(staff, gate + "select public.app_current_organization_id();"), /single active organization membership required/);
    sql(`delete from public.organization_memberships where organization_id='${c}';`);
  });
  await t.test("suspended-only Staff remains denied", () => {
    sql(`update public.organization_memberships set is_active=false where organization_id='${a}';`);
    denied(as(staff, gate), /organization_suspended/);
    denied(as(staff, "select public.app_current_organization_id();"), /organization_suspended/);
    sql(`update public.organization_memberships set is_active=true where organization_id='${a}';`);
  });
  await t.test("Platform Admin exception is retained without tenant-read escalation", () => {
    sql(`insert into public.organization_memberships values ('${b}','${admin}',true,'staff');`);
    assert.equal(sql(as(admin, gate + "select public.require_platform_admin_identity();")), admin);
    assert.equal(sql(as(admin, "select count(*) from public.orders;")), "0");
    denied(as(foreign, "select public.require_platform_admin_identity();"), /platform_admin_required/);
    assert.equal(sql(as(foreign, "select count(*) from public.orders;")), "0");
  });
});
