import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const readMigration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const migration = readMigration("20261026105505_billing_c2_rls_42501_fix_001.sql");
const security = readMigration("20260801000100_sec_001_1_security_remediation.sql");
const resolverAcl = readMigration("20260828000100_pos_001_1_fix_current_organization_uuid_aggregate.sql");
const entitlements = readMigration("20260827000200_entitlements_001_tenant_feature_access.sql");
const portal = readMigration("20261014000200_portal_entitlement_boundary_001.sql");
const f04 = readMigration("20261023122144_security_f04_inactive_org_helpers_001a.sql");
const d03 = readMigration("20261023192656_security_d03_multicontext_suspension_001b.sql");
const c1 = readMigration("20261018000300_billing_simplified_invoice_001g_c1_advance_event_foundation.sql");
const databaseUrl = process.env.PHOENIX_BILLING_C2_RLS_TEST_DATABASE_URL;

function functionDefinition(source, name) {
  const start = source.search(new RegExp(`create(?: or replace)? function public\\.${name}\\(`, "i"));
  assert.notEqual(start, -1, name);
  const end = source.indexOf("$$;", start);
  assert.notEqual(end, -1, name);
  return source.slice(start, end + 3);
}

function statement(source, prefix) {
  const start = source.indexOf(prefix);
  assert.notEqual(start, -1, prefix);
  return source.slice(start, source.indexOf(";", start) + 1);
}

function uuid(number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

test("42501 migration keeps the D03 resolver private and replaces only the C1 read policy", () => {
  assert.deepEqual([...migration.matchAll(/create function public\.(\w+)\(/g)].map((match) => match[1]),
    ["billing_can_read_advance_event_declaration"]);
  assert.match(migration, /returns boolean\s+language plpgsql\s+stable\s+security definer\s+set search_path = ''/i);
  assert.match(migration, /current_organization_id := public\.app_current_organization_id\(\);[\s\S]*?return coalesce\(/);
  assert.match(migration, /current_organization_id = target_organization_id/);
  assert.match(migration, /public\.has_organization_role\([\s\S]*?array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(migration, /public\.has_organization_entitlement\(target_organization_id, 'billing\.invoicing'\)/);
  assert.match(migration, /revoke all on function public\.billing_can_read_advance_event_declaration\(uuid\)\s+from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.billing_can_read_advance_event_declaration\(uuid\)\s+to authenticated;/);
  assert.match(migration, /drop policy billing_advance_event_declarations_select_management\s+on public\.billing_advance_event_declarations;/);
  assert.match(migration, /create policy billing_advance_event_declarations_select_management\s+on public\.billing_advance_event_declarations for select to authenticated\s+using \(public\.billing_can_read_advance_event_declaration\(organization_id\)\);/);
  assert.equal((migration.match(/\bcreate policy\b/gi) ?? []).length, 1);
  assert.doesNotMatch(migration, /grant\s+execute\s+on\s+function\s+public\.app_current_organization_id/i);
  assert.doesNotMatch(migration, /\b(?:insert|update|delete|create table|alter table|create trigger)\b/i);
});

test("42501 PostgreSQL regression uses canonical ACLs and real F04/D03 helpers", {
  skip: databaseUrl ? false : "RUNTIME_NOT_VERIFIED: no authorized disposable PostgreSQL URL",
  timeout: 120000,
}, async (context) => {
  const parsed = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/phoenix_c2_rls_test_[a-z0-9_]+$/);
  assert.notEqual(parsed.port, "55322");
  assert.equal(parsed.search, "");

  const databaseName = parsed.pathname.slice(1);
  const environment = {
    ...process.env,
    PGDATABASE: databaseName,
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGSSLMODE: "disable",
    PGOPTIONS: "",
    PGSERVICE: "",
    PGSERVICEFILE: "",
    PGCONNECT_TIMEOUT: "3",
  };
  delete environment.PGHOSTADDR;

  const raw = (query) => spawnSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], {
    env: environment, input: query, encoding: "utf8", timeout: 15000,
  });
  const sql = (query) => {
    const result = raw(query);
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const denied = (query, pattern) => {
    const result = raw(query);
    if (result.error) throw result.error;
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, pattern);
  };

  const tenantA = uuid(1);
  const tenantB = uuid(2);
  const ownerA = uuid(10);
  const managerA = uuid(11);
  const staffA = uuid(12);
  const ownerB = uuid(13);
  const portalOnly = uuid(14);
  const unknownTenant = uuid(99);
  const declarationA = uuid(101);
  const declarationB = uuid(102);
  const customerA = uuid(301);
  const portalAccessA = uuid(302);
  const asAuthenticated = (actor, query) =>
    `set request.jwt.claim.sub='${actor}';set role authenticated;${query}`;
  const readDeclarations = "select payment_id from public.billing_advance_event_declarations order by payment_id;";
  const callHelper = (tenant) => `select public.billing_can_read_advance_event_declaration('${tenant}');`;

  assert.equal(sql("select current_database();"), databaseName);
  assert.equal(sql("select current_user;"), "postgres");
  assert.equal(sql("select count(*) from pg_class where relnamespace='public'::regnamespace;"), "0");
  assert.equal(sql("select count(*) from pg_proc where pronamespace='public'::regnamespace;"), "0");
  assert.equal(sql("select count(*) from pg_namespace where nspname='auth';"), "0");
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated');"), "2");

  sql(`create schema auth;
    grant usage on schema auth to authenticated;
    grant usage on schema public to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant execute on function auth.uid() to authenticated;
    create type public.app_role as enum ('owner', 'manager', 'staff');
    create table public.organizations(id uuid primary key, status text, platform_service_status text, deleted_at timestamptz);
    create table public.organization_memberships(organization_id uuid, profile_id uuid, is_active boolean, role public.app_role);
    create table public.platform_feature_catalog(feature_key text primary key);
    create table public.organization_entitlements(organization_id uuid, feature_key text, enabled boolean,
      valid_from timestamptz, valid_until timestamptz);
    create table public.customers(id uuid primary key, organization_id uuid, display_name text, email text, is_active boolean);
    create table public.customer_portal_access(id uuid, user_id uuid, organization_id uuid, customer_id uuid,
      email text, is_active boolean, created_at timestamptz);
    create table public.billing_advance_event_declarations(organization_id uuid, order_id uuid, payment_id uuid);
    ${functionDefinition(entitlements, "organization_entitlement_is_enabled")}
    ${f04}
    ${functionDefinition(entitlements, "has_organization_entitlement")}
    ${functionDefinition(portal, "customer_portal_current_access")}
    ${functionDefinition(d03, "app_current_organization_id")}
    ${statement(security, "revoke execute on all functions in schema public from public;")}
    ${statement(security, "revoke execute on all functions in schema public from anon, authenticated;")}
    ${statement(security, "grant execute on function public.is_organization_member(uuid) to authenticated;")}
    ${statement(security, "grant execute on function public.has_organization_role(uuid, public.app_role[]) to authenticated;")}
    ${statement(entitlements, "revoke all on function public.organization_entitlement_is_enabled(uuid, text, timestamptz) from public, anon, authenticated;")}
    ${statement(entitlements, "revoke all on function public.has_organization_entitlement(uuid, text) from public, anon, authenticated;")}
    ${statement(entitlements, "grant execute on function public.has_organization_entitlement(uuid, text) to authenticated;")}
    ${statement(readMigration("20260803000200_portal_001_safe_customer_rpc.sql"), "grant execute on function public.customer_portal_current_access() to authenticated;")}
    ${statement(resolverAcl, "revoke all on function public.app_current_organization_id() from public, anon, authenticated;")}
    ${c1.slice(c1.indexOf("alter table public.billing_advance_event_declarations enable row level security;"), c1.lastIndexOf("commit;"))}
    insert into public.organizations values ('${tenantA}','active','active',null),('${tenantB}','active','active',null);
    insert into public.organization_memberships values
      ('${tenantA}','${ownerA}',true,'owner'),('${tenantA}','${managerA}',true,'manager'),
      ('${tenantA}','${staffA}',true,'staff'),('${tenantB}','${ownerB}',true,'owner');
    insert into public.platform_feature_catalog values ('billing.invoicing'),('core.portal');
    insert into public.organization_entitlements values
      ('${tenantA}','billing.invoicing',true,null,null),('${tenantB}','billing.invoicing',true,null,null),
      ('${tenantA}','core.portal',true,null,null);
    insert into public.customers values ('${customerA}','${tenantA}','Synthetic Portal Customer','portal@example.invalid',true);
    insert into public.customer_portal_access values
      ('${portalAccessA}','${portalOnly}','${tenantA}','${customerA}','portal@example.invalid',true,'2026-01-01');
    insert into public.billing_advance_event_declarations values
      ('${tenantA}','${uuid(201)}','${declarationA}'),('${tenantB}','${uuid(202)}','${declarationB}');`);

  await context.test("before migration: authorized Owner hits PostgreSQL 42501", () => {
    denied(asAuthenticated(ownerA, readDeclarations), /42501: permission denied for function app_current_organization_id/);
  });

  sql(migration);

  await context.test("resolver ACL remains denied and the new helper is authenticated only", () => {
    for (const role of ["authenticated", "anon"]) {
      assert.equal(sql(`select has_function_privilege('${role}', 'public.app_current_organization_id()', 'EXECUTE');`), "f");
    }
    assert.equal(sql("select has_function_privilege('authenticated', 'public.billing_can_read_advance_event_declaration(uuid)', 'EXECUTE');"), "t");
    assert.equal(sql("select has_function_privilege('anon', 'public.billing_can_read_advance_event_declaration(uuid)', 'EXECUTE');"), "f");
    assert.equal(sql(`select count(*) from pg_proc p, aclexplode(p.proacl) grant_row
      where p.oid='public.app_current_organization_id()'::regprocedure and grant_row.grantee=0
        and grant_row.privilege_type='EXECUTE';`), "0");
    assert.equal(sql(`select count(*) from pg_proc p, aclexplode(p.proacl) grant_row
      where p.oid='public.billing_can_read_advance_event_declaration(uuid)'::regprocedure and grant_row.grantee=0
        and grant_row.privilege_type='EXECUTE';`), "0");
    denied(asAuthenticated(ownerA, "select public.app_current_organization_id();"), /42501: permission denied for function app_current_organization_id/);
    denied("set role anon;" + callHelper(tenantA), /42501: permission denied for function billing_can_read_advance_event_declaration/);
  });

  await context.test("Owner and Manager see only their tenant; Staff and Portal see none", () => {
    assert.equal(sql(asAuthenticated(ownerA, readDeclarations)), declarationA);
    assert.equal(sql(asAuthenticated(managerA, readDeclarations)), declarationA);
    assert.equal(sql(asAuthenticated(ownerB, readDeclarations)), declarationB);
    assert.equal(sql(asAuthenticated(staffA, readDeclarations)), "");
    assert.equal(sql(asAuthenticated(portalOnly, "select organization_id from public.customer_portal_current_access();")), tenantA);
    denied(asAuthenticated(portalOnly, readDeclarations), /single active organization membership required/);
    assert.equal(sql(asAuthenticated(ownerA, `select ${[
      `public.billing_can_read_advance_event_declaration('${tenantA}')`,
      `public.billing_can_read_advance_event_declaration('${tenantB}')`,
      `public.billing_can_read_advance_event_declaration('${unknownTenant}')`,
    ].join(",")};`)), "t|f|f");
    denied(asAuthenticated(portalOnly, callHelper(tenantA)), /single active organization membership required/);
  });

  await context.test("Billing entitlement and SQL mutation privileges remain denied", () => {
    sql(`update public.organization_entitlements set enabled=false where organization_id='${tenantA}';`);
    assert.equal(sql(asAuthenticated(ownerA, readDeclarations)), "");
    sql(`update public.organization_entitlements set enabled=true where organization_id='${tenantA}';`);
    for (const action of ["INSERT", "UPDATE", "DELETE"]) {
      assert.equal(sql(`select has_table_privilege('authenticated', 'public.billing_advance_event_declarations', '${action}');`), "f");
    }
    assert.equal(sql("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'issue_billing_%';"), "0");
  });

  await context.test("D03 ambiguity, suspension and F04 inactive organization rules persist", () => {
    sql(`insert into public.organization_memberships values ('${tenantB}','${ownerA}',true,'owner');`);
    denied(asAuthenticated(ownerA, readDeclarations), /single active organization membership required/);
    sql(`update public.organizations set platform_service_status='suspended' where id='${tenantB}';`);
    assert.equal(sql(asAuthenticated(ownerA, readDeclarations)), declarationA);
    denied(asAuthenticated(ownerB, readDeclarations), /42501: organization_suspended/);
    sql(`delete from public.organization_memberships where organization_id='${tenantB}' and profile_id='${ownerA}';
      update public.organizations set platform_service_status='active' where id='${tenantB}';`);
    sql(`update public.organizations set status='inactive' where id='${tenantA}';`);
    denied(asAuthenticated(ownerA, readDeclarations), /single active organization membership required/);
    sql(`update public.organizations set status='active',deleted_at=now() where id='${tenantA}';`);
    denied(asAuthenticated(ownerA, readDeclarations), /single active organization membership required/);
  });
});
