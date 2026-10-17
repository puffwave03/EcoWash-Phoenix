import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

// OPT IN ONLY. An EMPTY disposable local database named phoenix_series_test_*
// and pre-existing anon/authenticated roles are required. Never use an app DB.
// Tests run the actual proposed migration on a minimal synthetic Billing schema;
// they do not exercise full production RPCs, fiscal issuance or runtime app RLS.
const databaseUrl = process.env.PHOENIX_SERIES_TEST_DATABASE_URL;
const migration = readFileSync(new URL("../supabase/migrations/20261017000100_billing_simplified_invoice_001d_series_configuration.sql", import.meta.url), "utf8");
const pricingSql = readFileSync(new URL("../supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql", import.meta.url), "utf8");
const counterAllocation = pricingSql.match(/insert into public\.billing_invoice_number_counters \([\s\S]*?returning next_value - 1 into allocated_sequence;/)?.[0];
assert.ok(counterAllocation, "the real canonical counter allocation must exist");
const org = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const fixture = `
create schema auth;
create type public.app_role as enum ('owner','manager','staff');
create type public.billing_fiscal_document_type as enum ('ordinary','simplified');
create type public.billing_invoice_document_status as enum ('draft','issued','cancelled');
create function auth.uid() returns uuid language sql as 'select null::uuid';
create function public.app_current_organization_id() returns uuid language sql as
  'select current_setting(''test.organization_id'', true)::uuid';
create function public.has_organization_role(uuid, public.app_role[]) returns boolean language sql as
  'select coalesce(current_setting(''test.billing_role'', true), '''') = any($2::text[])';
create function public.has_organization_entitlement(uuid, text) returns boolean language sql as
  'select coalesce(current_setting(''test.billing_entitled'', true), ''false'')::boolean';
create table public.organizations(id uuid primary key);
insert into public.organizations values ('${org}'),('${other}');
create table public.organization_billing_settings(
  organization_id uuid primary key references public.organizations,
  default_series text not null default 'A', simplified_series text,
  simplified_invoicing_enabled boolean not null default false,
  updated_by uuid, updated_at timestamptz not null default '2026-10-16 00:00:00+00',
  constraint organization_billing_settings_simplified_disabled check(not simplified_invoicing_enabled));
create table public.invoices(
  id uuid primary key, organization_id uuid not null references public.organizations,
  series text not null, fiscal_document_type public.billing_fiscal_document_type not null default 'ordinary',
  document_status public.billing_invoice_document_status not null default 'draft',
  invoice_number text, sequence_number bigint, total numeric not null default 36,
  constraint invoices_fiscal_document_type_ordinary_only check(fiscal_document_type='ordinary'));
create table public.billing_invoice_number_counters(
  organization_id uuid not null references public.organizations, series text not null,
  next_value bigint not null default 1, updated_at timestamptz not null default '2026-10-16 00:00:00+00',
  primary key(organization_id,series));
insert into public.organization_billing_settings(organization_id) values ('${org}');
insert into public.invoices(id,organization_id,series,document_status,invoice_number,sequence_number) values
  ('00000000-0000-0000-0000-000000000011','${org}','H-DRAFT','draft',null,null),
  ('00000000-0000-0000-0000-000000000012','${org}','H-CANCEL','cancelled','HIST-C',9),
  ('00000000-0000-0000-0000-000000000013','${org}','H-ISSUED','issued','HIST-I',10);
insert into public.billing_invoice_number_counters(organization_id,series,next_value) values
  ('${org}','H-COUNTER',42);
`;
const claim = (series, type = "ordinary", organization = org) =>
  `select public.claim_billing_series_ownership('${organization}','${series}','${type}');`;
const invoice = (series, organization = org) =>
  `insert into public.invoices(id,organization_id,series) values('${randomUUID()}','${organization}','${series}');`;
// Execute the unchanged production SQL fragment, substituting only PL/pgSQL
// variables and its INTO destination. This is not full invoice-RPC validation.
const allocate = (series, organization = org) => counterAllocation
  .replace(/\borg_id\b/g, `'${organization}'`).replace(/invoice_row\.series/g, `'${series}'`)
  .replace(" into allocated_sequence", "");
const asOwner = `set "test.organization_id"='${org}'; set "test.billing_role"='owner'; set "test.billing_entitled"='true';`;

function environment() {
  const u = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(u.protocol));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(u.hostname), "only loopback is permitted");
  const db = decodeURIComponent(u.pathname.slice(1));
  assert.match(db, /^phoenix_series_test_[a-z0-9_]+$/);
  assert.equal(u.search, "", "connection options are not permitted");
  const env = { ...process.env, PGHOST: u.hostname.replace(/^\[|\]$/g, ""), PGPORT: u.port || "5432",
    PGDATABASE: db, PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "3", PGOPTIONS: "", PGSERVICE: "", PGSERVICEFILE: "" };
  delete env.PGHOSTADDR;
  return { env, db };
}

function tools(env) {
  const args = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
  const sql = (input) => {
    const r = spawnSync("psql", args, { env, input, encoding: "utf8", timeout: 20000 });
    if (r.error) throw r.error;
    if (r.status !== 0) throw Error(r.stderr || "psql failed");
    return r.stdout.trim();
  };
  const clients = new Set();
  const connect = () => {
    const name = `series_test_${randomUUID()}`;
    const child = spawn("psql", args, { env: { ...env, PGAPPNAME: name }, stdio: ["pipe", "pipe", "pipe"] });
    clients.add(child);
    let output = "", errors = "", pending, stopped = false;
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (s) => {
      output += s;
      if (pending && output.includes(pending.marker)) {
        const p = pending; pending = null; p.resolve(output); output = "";
      }
    });
    child.stderr.on("data", (s) => { errors += s; });
    child.on("error", (e) => { stopped = true; pending?.reject(e); pending = null; });
    child.on("close", () => {
      stopped = true; clients.delete(child);
      pending?.reject(Error(errors || "psql exited before the barrier")); pending = null;
    });
    return { name, send(input) {
      assert.ok(!pending && !stopped, "one operation per connection");
      const marker = `barrier_${randomUUID()}`;
      return new Promise((resolve, reject) => {
        pending = { marker, resolve, reject };
        child.stdin.write(`${input}\n\\echo ${marker}\n`);
      });
    }, end() { child.stdin.end(); } };
  };
  const waitForLock = async (name) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (sql(`select count(*) from pg_stat_activity where datname=current_database() and application_name='${name}' and wait_event_type='Lock';`) === "1") return;
      await delay(25);
    }
    throw Error("concurrent session never reached the expected lock");
  };
  return { sql, connect, waitForLock, async stop() {
    const remaining = [...clients];
    await Promise.all(remaining.map((child) => new Promise((resolve) => {
      child.once("close", resolve); child.kill("SIGTERM");
    })));
  } };
}

test("PostgreSQL isolated ownership, historical preservation and concurrency", {
  skip: databaseUrl ? false : "NOT TESTED: no explicitly configured isolated local PostgreSQL database",
  timeout: 120000,
}, async (t) => {
  const { env, db } = environment();
  const pg = tools(env);
  assert.equal(pg.sql("select current_database();"), db);
  assert.equal(pg.sql("select count(*) from pg_namespace where nspname not in ('pg_catalog','information_schema','public') and nspname !~ '^pg_';"), "0", "no application schemas may exist");
  assert.equal(pg.sql(`select
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') +
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') +
    (select count(*) from pg_type y join pg_namespace n on n.oid=y.typnamespace where n.nspname='public') +
    (select count(*) from pg_extension e join pg_namespace n on n.oid=e.extnamespace where n.nspname='public');`), "0");
  assert.equal(pg.sql("select count(*) from pg_namespace where nspname='auth';"), "0");
  assert.equal(pg.sql("select count(*) from pg_roles where rolname in ('anon','authenticated');"), "2", "roles must pre-exist; this test never changes cluster roles");
  let initialized = false;
  t.after(async () => {
    await pg.stop();
    if (initialized) pg.sql("drop schema public cascade; create schema public; drop schema auth cascade;");
  });
  initialized = true;
  pg.sql(fixture);
  const snapshot = () => pg.sql(`select jsonb_build_object(
    'settings',(select jsonb_agg(to_jsonb(s) order by organization_id) from public.organization_billing_settings s),
    'invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.invoices i),
    'counters',(select jsonb_agg(to_jsonb(c)-'fiscal_document_type' order by organization_id,series) from public.billing_invoice_number_counters c));`);

  await t.test("incompatible history aborts the entire migration without renumbering", () => {
    for (const series of ["A", "H-DRAFT", "H-CANCEL", "H-COUNTER"]) {
      pg.sql(`update public.organization_billing_settings set simplified_series='${series}';`);
      const before = snapshot();
      assert.throws(() => pg.sql(migration), /billing_simplified_series_used/);
      assert.equal(snapshot(), before);
      assert.equal(pg.sql("select to_regclass('public.billing_series_ownership') is null;"), "t");
    }
    pg.sql("update public.organization_billing_settings set simplified_series=null;");
  });
  const before = snapshot();
  pg.sql(migration);
  await t.test("all original rows, numbers, progressives and timestamps survive", () => assert.equal(snapshot(), before));
  for (const series of ["H-DRAFT", "H-CANCEL", "H-ISSUED", "H-COUNTER", "A"]) {
    await t.test(`ordinary history excludes simplified reservation: ${series}`, () => {
      assert.throws(() => pg.sql(`${asOwner} select public.reserve_billing_simplified_series('${series}');`), /billing_simplified_series_used/);
    });
  }
  await t.test("ordinary without settings and canonical counter upsert remain supported", () => {
    pg.sql(invoice("NO-CONFIG", other));
    assert.equal(pg.sql(`select count(*) from public.organization_billing_settings where organization_id='${other}';`), "0");
    assert.equal(pg.sql(allocate("NO-CONFIG", other)), "1");
    assert.equal(pg.sql(allocate("NO-CONFIG", other)), "2");
    assert.equal(pg.sql(`select fiscal_document_type from public.billing_invoice_number_counters where organization_id='${other}' and series='NO-CONFIG';`), "ordinary");
  });
  await t.test("different tenants may own the same spelling with different types", () => {
    pg.sql(claim("TENANT", "ordinary") + claim("TENANT", "simplified", other));
    assert.equal(pg.sql("select count(*) from public.billing_series_ownership where series='TENANT';"), "2");
  });
  await t.test("ordinary allocation cannot increment a simplified-owned counter", () => {
    pg.sql(`${claim("FUTURE", "simplified")} insert into public.billing_invoice_number_counters
      (organization_id,series,next_value,fiscal_document_type) values('${org}','FUTURE',7,'simplified');`);
    assert.throws(() => pg.sql(allocate("FUTURE")), /billing_series_reserved_for_simplified/);
    assert.equal(pg.sql("select next_value from public.billing_invoice_number_counters where series='FUTURE';"), "7");
  });
  await t.test("concurrent Owner reservations reuse the same typed property", async () => {
    const a = pg.connect(), b = pg.connect();
    await a.send(`begin; ${asOwner} select public.reserve_billing_simplified_series('RPC-S');`);
    await b.send(`begin; ${asOwner}`);
    const result = b.send("select public.reserve_billing_simplified_series('RPC-S');");
    const observed = result.then(() => ({ ok: true }), (error) => ({ error }));
    await pg.waitForLock(b.name); await a.send("commit;");
    assert.equal((await observed).ok, true); await b.send("commit;"); a.end(); b.end();
    assert.equal(pg.sql("select count(*) from public.billing_series_ownership where series='RPC-S';"), "1");
  });
  for (const isolation of ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]) {
    await t.test(`old snapshot without settings cannot miss a reservation: ${isolation}`, async () => {
      const organization = randomUUID(), series = isolation === "SERIALIZABLE" ? "S-SERIAL" : `S-${isolation.split(" ")[0]}`;
      pg.sql(`insert into public.organizations values('${organization}');`);
      const a = pg.connect();
      await a.send(`begin isolation level ${isolation}; select count(*) from public.organization_billing_settings;`);
      pg.sql(`insert into public.organization_billing_settings(organization_id,default_series,simplified_series) values('${organization}','ORD','${series}');`);
      await assert.rejects(a.send(invoice(series, organization)), isolation === "READ COMMITTED" ? /billing_series_reserved_for_simplified/ : /40001/);
      a.end();
      assert.equal(pg.sql(`select count(*) from public.invoices where organization_id='${organization}';`), "0");
    });
    for (const type of ["ordinary", "simplified"]) {
      await t.test(`concurrent same key, second type ${type}: ${isolation}`, async () => {
        const series = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
        const a = pg.connect(), b = pg.connect();
        await a.send(`begin; ${claim(series)}`);
        await b.send(`begin isolation level ${isolation}; select count(*) from public.billing_series_ownership;`);
        const second = b.send(claim(series, type));
        const observed = second.then(() => ({ ok: true }), (error) => ({ error }));
        await pg.waitForLock(b.name); await a.send("commit;"); a.end();
        const result = await observed;
        if (isolation === "READ COMMITTED" && type === "ordinary") {
          assert.equal(result.ok, true); await b.send("commit;");
        } else assert.match(result.error?.message ?? "", isolation === "READ COMMITTED" ? /billing_simplified_series_used/ : /40001/);
        b.end();
        assert.equal(pg.sql(`select fiscal_document_type from public.billing_series_ownership where organization_id='${org}' and series='${series}';`), "ordinary");
      });
    }
    await t.test(`existing ordinary series requires no owner version update: ${isolation}`, () => {
      const version = pg.sql(`select xmin::text from public.billing_series_ownership where organization_id='${org}' and series='H-DRAFT';`);
      pg.sql(`begin isolation level ${isolation}; ${claim("H-DRAFT")} ${invoice("H-DRAFT")} commit;`);
      assert.equal(pg.sql(`select xmin::text from public.billing_series_ownership where organization_id='${org}' and series='H-DRAFT';`), version);
    });
    await t.test(`canonical concurrent counter allocation retains its isolation behavior: ${isolation}`, async () => {
      const series = `CNT-${["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"].indexOf(isolation)}`;
      pg.sql(`insert into public.billing_invoice_number_counters(organization_id,series,next_value) values('${org}','${series}',10);`);
      const a = pg.connect(), b = pg.connect();
      const first = await a.send(`begin; ${allocate(series)}`);
      assert.match(first, /^10\n/);
      await b.send(`begin isolation level ${isolation}; select count(*) from public.billing_invoice_number_counters;`);
      const second = b.send(allocate(series)).then((output) => ({ output }), (error) => ({ error }));
      await pg.waitForLock(b.name); await a.send("commit;"); a.end();
      const result = await second;
      if (isolation === "READ COMMITTED") {
        assert.match(result.output, /^11\n/); await b.send("commit;");
      } else assert.match(result.error?.message ?? "", /40001/);
      b.end();
      assert.equal(pg.sql(`select next_value from public.billing_invoice_number_counters where series='${series}';`), isolation === "READ COMMITTED" ? "12" : "11");
    });
  }
  await t.test("a real deadlock aborts one whole transaction; no partial owner survives", async () => {
    const a = pg.connect(), b = pg.connect();
    await a.send(`begin; ${claim("DEAD-A")} ${invoice("DEAD-A")}`);
    await b.send(`begin; ${claim("DEAD-B")} ${invoice("DEAD-B")}`);
    const first = a.send(claim("DEAD-B")).then(() => ({ ok: true }), (error) => ({ error }));
    await pg.waitForLock(a.name);
    const second = b.send(claim("DEAD-A")).then(() => ({ ok: true }), (error) => ({ error }));
    const outcomes = await Promise.all([first, second]);
    assert.equal(outcomes.filter((r) => r.ok).length, 1);
    assert.match(outcomes.find((r) => r.error).error.message, /40P01/);
    await (outcomes[0].ok ? a : b).send("commit;"); a.end(); b.end();
    assert.equal(pg.sql("select count(*) from public.invoices where series in ('DEAD-A','DEAD-B');"), "1");
  });
  await t.test("abort rolls back both ownership and counter increment", () => {
    assert.throws(() => pg.sql(`begin; ${claim("ROLLBACK")}
      update public.billing_invoice_number_counters set next_value=next_value+1 where series='H-COUNTER'; select 1/0; commit;`), /22012/);
    assert.equal(pg.sql("select count(*) from public.billing_series_ownership where series='ROLLBACK';"), "0");
    assert.equal(pg.sql("select next_value from public.billing_invoice_number_counters where series='H-COUNTER';"), "42");
  });
  await t.test("ownership/counter identity are immutable and client access remains denied", () => {
    assert.throws(() => pg.sql("update public.billing_series_ownership set fiscal_document_type='simplified' where series='H-DRAFT';"), /billing_series_ownership_immutable/);
    assert.throws(() => pg.sql("delete from public.billing_series_ownership where series='H-DRAFT';"), /billing_series_ownership_immutable/);
    assert.throws(() => pg.sql("update public.billing_invoice_number_counters set fiscal_document_type='simplified' where series='H-COUNTER';"), /billing_counter_identity_immutable/);
    assert.throws(() => pg.sql(`set role authenticated; ${claim("DENIED")}`), /42501/);
    assert.throws(() => pg.sql(`set role authenticated; insert into public.billing_series_ownership values('${org}','DENIED','ordinary');`), /42501/);
    assert.throws(() => pg.sql(`set "test.organization_id"='${org}'; set "test.billing_role"='staff'; set "test.billing_entitled"='true'; select public.reserve_billing_simplified_series('DENIED');`), /billing_settings_not_authorized/);
    assert.throws(() => pg.sql(`set "test.organization_id"='${org}'; set "test.billing_role"='owner'; set "test.billing_entitled"='false'; select public.reserve_billing_simplified_series('DENIED');`), /billing_settings_not_authorized/);
  });
  await t.test("both simplified activation guards still reject writes", () => {
    assert.throws(() => pg.sql("update public.organization_billing_settings set simplified_invoicing_enabled=true;"), /23514/);
    assert.throws(() => pg.sql(`insert into public.invoices(id,organization_id,series,fiscal_document_type) values('${randomUUID()}','${org}','SIMPL','simplified');`), /23514/);
  });
});
