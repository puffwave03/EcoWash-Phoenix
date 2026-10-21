import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const url = process.env.PHOENIX_PORTAL_IDENTITY_TEST_DATABASE_URL;
const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const latest = read('20261021000100_security_portal_identity_binding_001e.sql');
const prior = read('20261014000200_portal_entitlement_boundary_001.sql');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = id(1), foreign = id(2), owner = id(3), manager = id(4), staff = id(5), user = id(6), user2 = id(7);
const customer = id(10), second = id(11), foreignCustomer = id(12);
const asActor = (actor = owner) => `set test.actor='${actor}';set role authenticated;`;
const upsert = (cid = customer, uid = user, email = "'synthetic@example.test'") =>
  `select public.upsert_customer_portal_access('${cid}','${uid}',${email});`;

test('001E isolated PostgreSQL management RPC and identity regression', {
  skip: url ? false : 'RUNTIME_NOT_VERIFIED: no disposable local PostgreSQL URL', timeout: 90000,
}, async t => {
  const parsed = new URL(url);
  assert.ok(['postgres:', 'postgresql:'].includes(parsed.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/phoenix_portal_identity_test_[a-z0-9_]+$/);
  assert.equal(parsed.search, '');
  const db = parsed.pathname.slice(1);
  const env = { ...process.env, PGDATABASE: db, PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password), PGHOST: parsed.hostname, PGPORT: parsed.port || '5432',
    PGSSLMODE: 'disable', PGOPTIONS: '', PGSERVICE: '', PGSERVICEFILE: '', PGCONNECT_TIMEOUT: '3' };
  delete env.PGHOSTADDR;
  const raw = input => spawnSync('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env, input, encoding: 'utf8', timeout: 15000 });
  const sql = input => { const result = raw(input); if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  const fails = (input, pattern) => { const result = raw(input); if (result.error) throw result.error;
    assert.notEqual(result.status, 0); assert.match(result.stderr, pattern); };
  assert.equal(sql('select current_database();'), db);
  assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';"), '0');
  assert.equal(sql("select count(*) from pg_namespace where nspname in ('auth','extensions');"), '0');
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated');"), '2');

  // Synthetic Auth JWT context and entitlement fixtures only. The access table,
  // role helper, management RPCs and canonical context are repository SQL.
  sql(`create schema auth;create schema extensions;
    grant usage on schema auth to authenticated;
    create function extensions.gen_random_uuid() returns uuid language sql as 'select gen_random_uuid()';
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create table auth.users(id uuid primary key,email text);
    create type public.app_role as enum ('owner','manager','staff');
    create table public.profiles(id uuid primary key references auth.users);
    create table public.organizations(id uuid primary key,status text default 'active',deleted_at timestamptz,
      platform_service_status text default 'active',entitled boolean default true);
    create table public.customers(id uuid primary key,organization_id uuid references public.organizations,
      is_active boolean default true,display_name text default 'Synthetic',email text,unique(organization_id,id));
    create table public.organization_memberships(organization_id uuid,profile_id uuid,role public.app_role,is_active boolean);
    create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
    create function public.organization_entitlement_is_enabled(uuid,text,timestamptz) returns boolean
      language sql security definer set search_path='' as $$select entitled from public.organizations where id=$1$$;
    insert into auth.users values('${owner}','owner@example.test'),('${manager}','manager@example.test'),
      ('${staff}','staff@example.test'),('${user}','synthetic@example.test'),('${user2}','other@example.test');
    insert into public.profiles select id from auth.users;
    insert into public.organizations(id) values('${org}'),('${foreign}');
    insert into public.customers(id,organization_id) values('${customer}','${org}'),('${second}','${org}'),('${foreignCustomer}','${foreign}');
    insert into public.organization_memberships values('${org}','${owner}','owner',true),('${org}','${manager}','manager',true),('${org}','${staff}','staff',true);
  `);
  const platform = read('20260827000300_platform_admin_001_saas_control_center.sql');
  const roleStart = platform.indexOf('create or replace function public.has_organization_role(');
  sql(platform.slice(roleStart, platform.indexOf('$$;', roleStart) + 3));
  const foundation = read('20260803000100_portal_001_customer_portal.sql');
  sql(foundation.slice(0, foundation.indexOf('alter table public.order_photos')));
  // Install the previous exact RPCs first, proving replacement preserves owner.
  sql(prior.slice(prior.indexOf('CREATE OR REPLACE FUNCTION "public"."upsert_customer_portal_access"'), prior.indexOf('-- Keep management inspection/disable')));
  const owners = () => sql("select proname||':'||pg_get_userbyid(proowner) from pg_proc where proname in ('upsert_customer_portal_access','update_customer_portal_access') order by proname;");
  const beforeOwners = owners();
  sql(latest); sql(latest);
  const contextEnd = prior.indexOf('create or replace function public.get_customer_portal_ordering_context');
  sql(prior.slice(0, contextEnd));
  sql('grant execute on function public.customer_portal_current_access() to authenticated;');

  await t.test('idempotent migration, owners, search path and execute-only privileges', () => {
    assert.equal(owners(), beforeOwners);
    assert.equal(sql("select count(*) from pg_proc where proname in ('upsert_customer_portal_access','update_customer_portal_access') and prosecdef and proconfig=array['search_path=\"\"'];"), '2');
    assert.equal(sql("select has_function_privilege('authenticated','public.upsert_customer_portal_access(uuid,uuid,text)','EXECUTE');"), 't');
    assert.equal(sql("select has_function_privilege('anon','public.upsert_customer_portal_access(uuid,uuid,text)','EXECUTE');"), 'f');
    fails(asActor() + 'select * from auth.users;', /permission denied/);
  });
  let access;
  await t.test('Owner inserts, Manager replaces, normalized exact identity succeeds', () => {
    access = sql(asActor() + upsert(customer, user, "' SYNTHETIC@EXAMPLE.TEST '"));
    assert.match(access, /^[a-f0-9-]{36}$/);
    assert.equal(sql(asActor(manager) + upsert()), access);
    assert.equal(sql(`select email||':'||is_active from public.customer_portal_access where id='${access}';`), 'synthetic@example.test:true');
  });
  await t.test('mismatch, nonexistent/null UUID, malformed/null/blank emails are uniformly rejected', () => {
    for (const [uid, email] of [[user2, "'synthetic@example.test'"], [id(999), "'synthetic@example.test'"],
      [user, 'null'], [user, "''"], [user, "'  '"], [user, "'invalid'"], [user, "'a@@example.test'"], [user, "'a b@example.test'"]]) {
      fails(asActor() + upsert(customer, uid, email), /portal_identity_invalid/);
    }
    fails(asActor() + `select public.upsert_customer_portal_access('${customer}',null,'synthetic@example.test');`, /portal_identity_invalid/);
    sql(`update auth.users set email='invalid' where id='${user2}';`);
    fails(asActor() + upsert(customer, user2, "'invalid'"), /portal_identity_invalid/);
    sql(`update auth.users set email='other@example.test' where id='${user2}';`);
    assert.equal(sql(`select user_id||':'||email from public.customer_portal_access where id='${access}';`), `${user}:synthetic@example.test`);
  });
  await t.test('Staff/customer/null actors and cross-tenant changes fail for both RPCs', () => {
    for (const actor of [staff, user]) {
      fails(asActor(actor) + upsert(), /not authorized/);
      fails(asActor(actor) + `select public.update_customer_portal_access('${access}',false);`, /not authorized/);
    }
    fails("set test.actor='';set role authenticated;" + upsert(), /not authorized/);
    fails("set test.actor='';set role authenticated;" + `select public.update_customer_portal_access('${access}',true);`, /not authorized/);
    fails('set role anon;' + upsert(), /permission denied/);
    fails(asActor() + upsert(foreignCustomer), /not authorized/);
    const otherAccess = sql(`insert into public.customer_portal_access(organization_id,customer_id,user_id,email,invited_by) values('${foreign}','${foreignCustomer}','${user2}','other@example.test','${owner}') returning id;`);
    fails(asActor() + `select public.update_customer_portal_access('${otherAccess}',true);`, /not authorized/);
  });
  await t.test('inactive customers and unavailable entitlement still block insert/enable; disable remains possible', () => {
    sql(`update public.customers set is_active=false where id='${second}';`);
    fails(asActor() + upsert(second), /invalid customer/);
    sql(`update public.customers set is_active=true where id='${second}';update public.organizations set entitled=false where id='${org}';`);
    fails(asActor() + upsert(), /portal_entitlement_required/);
    fails(asActor() + `select public.update_customer_portal_access('${access}',true);`, /portal_entitlement_required/);
    sql(asActor() + `select public.update_customer_portal_access('${access}',false);`);
    sql(`update public.organizations set entitled=true where id='${org}';update public.customers set is_active=false where id='${customer}';`);
    fails(asActor() + `select public.update_customer_portal_access('${access}',true);`, /customer_lifecycle_inactive_customer/);
    sql(`update public.customers set is_active=true where id='${customer}';`);
  });
  await t.test('email change invalidates reactivation without mutation; disable still works on stale rows', () => {
    sql(`update auth.users set email='changed@example.test' where id='${user}';`);
    fails(asActor() + `select public.update_customer_portal_access('${access}',true);`, /portal_identity_invalid/);
    assert.equal(sql(`select is_active from public.customer_portal_access where id='${access}';`), 'f');
    sql(asActor() + `select public.update_customer_portal_access('${access}',false);`);
    sql(`update auth.users set email='synthetic@example.test' where id='${user}';`);
    sql(asActor(manager) + `select public.update_customer_portal_access('${access}',true);`);
    assert.equal(sql(`select is_active from public.customer_portal_access where id='${access}';`), 't');
  });
  await t.test('multiple legitimate contexts remain, canonical context still uses the authenticated UUID', () => {
    sql(asActor() + upsert(second));
    assert.equal(sql(`select count(*) from public.customer_portal_access where user_id='${user}';`), '2');
    assert.equal(sql(asActor(user) + 'select customer_id from public.customer_portal_current_access();'), customer);
    assert.equal(sql(asActor(user2) + 'select customer_id from public.customer_portal_current_access();'), foreignCustomer);
    // A legitimate operational identity remains eligible as a Portal customer.
    sql(asActor() + upsert(second, staff, "'staff@example.test'"));
    assert.equal(sql(asActor(staff) + 'select customer_id from public.customer_portal_current_access();'), second);
  });
});
