// Deferred integration check. Requires an ALREADY RUNNING, disposable local
// PostgreSQL instance and an empty database. Never starts Docker or a server.
// Run only in a separately authorized SQL-validation phase:
// PHOENIX_DRAFT_TEST_SOCKET=<os.tmpdir()>/<isolated-socket> \
// PHOENIX_DRAFT_TEST_DATABASE=phoenix_simplified_draft_test_<suffix> \
// node tests/billing-simplified-draft-001-postgres.mjs --isolated-postgres
// Uses real Billing SQL, but synthetic auth/source tables: not Supabase RLS UAT.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { tmpdir } from "node:os";

assert.ok(process.argv.includes("--isolated-postgres"), "Explicit isolated PostgreSQL opt-in required");
const socket = process.env.PHOENIX_DRAFT_TEST_SOCKET ?? "";
const database = process.env.PHOENIX_DRAFT_TEST_DATABASE ?? "";
assert.ok(isAbsolute(socket) && resolve(socket).startsWith(`${resolve(tmpdir())}/`), "Use an isolated Unix socket under the temporary directory");
assert.match(database, /^phoenix_simplified_draft_test_[a-z0-9_]+$/);
const args = ["-X", "-h", socket, "-p", "5432", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"];
// Do not inherit connection services/options that could redirect this test.
const env = { PATH: process.env.PATH, LC_ALL: "C" };
function query(sql) {
  const result = spawnSync("psql", args, { input: sql, encoding: "utf8", env });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
function concurrentQuery(sql) {
  return new Promise((accept, reject) => {
    const child = spawn("psql", args, { env }); let output = "", error = "";
    child.stdout.on("data", (data) => { output += data; }); child.stderr.on("data", (data) => { error += data; });
    child.on("error", reject); child.on("close", (code) => code === 0 ? accept(output.trim()) : reject(new Error(error)));
    child.stdin.end(sql);
  });
}
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = uuid(1), actor = uuid(2), shared = uuid(3), named = uuid(4), session = uuid(5);
const auth = `set test.org = '${org}'; set test.role = 'owner'; set test.billing = 'true'; set test.pos = 'true';`;
const rpc = (order, series = "S") => `public.create_simplified_billing_draft('${uuid(order)}', '${series}')`;
function fails(statement, message, context = auth) {
  query(`${context} do $test$ begin
    begin perform ${statement}; exception when others then
      if sqlerrm = '${message}' then return; end if; raise;
    end; raise exception 'Expected ${message}'; end $test$;`);
}
function newOrder(n, { customer = shared, paid = 13, mixed = false, tenant = org } = {}) {
  query(`insert into public.orders (id, organization_id, customer_id) values ('${uuid(n)}', '${tenant}', '${customer}');
    insert into public.order_items (id, organization_id, order_id) values ('${uuid(n + 1000)}', '${tenant}', '${uuid(n)}');
    insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
    values ('${uuid(n + 2000)}', '${tenant}', '${uuid(n)}', ${mixed ? 5 : paid}, 'cash', '${session}', '${actor}', '${actor}');
    ${mixed ? `insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
      values ('${uuid(n + 3000)}', '${tenant}', '${uuid(n)}', 8, 'card', '${session}', '${actor}', '${actor}');` : ""}`);
}
const json = (sql) => JSON.parse(query(sql));

assert.equal(query("select count(*) from pg_tables where schemaname not in ('pg_catalog', 'information_schema');"), "0", "Database must be empty");
query(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
  create schema extensions; create extension pgcrypto with schema extensions; create schema auth;
  create type public.app_role as enum ('owner', 'manager', 'staff');
  create type public.service_unit_type as enum ('piece', 'weight');
  create function auth.uid() returns uuid language sql as $$ select '${actor}'::uuid $$;
  create function public.app_current_organization_id() returns uuid language sql as $$ select current_setting('test.org')::uuid $$;
  create function public.has_organization_role(org uuid, roles public.app_role[]) returns boolean language sql as $$
    select org = public.app_current_organization_id() and current_setting('test.role')::public.app_role = any(roles) $$;
  create function public.organization_entitlement_is_enabled(uuid, text, timestamptz) returns boolean language sql as $$
    select current_setting('test.billing')::boolean $$;
  create function public.require_pos_access(uuid) returns void language plpgsql as $$ begin
    if current_setting('test.pos') <> 'true' then raise exception 'pos_not_authorized'; end if; end $$;
  create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
  create table public.organizations (id uuid primary key, name text);
  create table public.profiles (id uuid primary key);
  create table public.customers (
    id uuid primary key, organization_id uuid, customer_code text, customer_type text default 'individual',
    display_name text, company_name text, tax_id text, billing_address_line1 text, billing_address_line2 text,
    billing_city text, billing_postal_code text, billing_country_code char(2), email text, unique(organization_id, id)
  );
  create table public.orders (
    id uuid primary key, organization_id uuid, customer_id uuid, currency text default 'EUR', location_id uuid,
    is_active boolean default true, production_status text default 'received', created_at timestamptz default now(),
    subtotal numeric default 14, discount_amount numeric default 1, total numeric default 13, unique(organization_id, id)
  );
  create table public.order_items (
    id uuid primary key, organization_id uuid, order_id uuid, is_active boolean default true,
    description text default 'Laundry', unit_type public.service_unit_type default 'piece', quantity numeric default 2,
    unit_price numeric default 7, line_total numeric default 14, sort_order int default 1, created_at timestamptz default now()
  );
  create table public.organization_branding (
    organization_id uuid, commercial_name text, business_address text, support_email text, support_phone text, logo_path text
  );
  create table public.pos_sessions (id uuid primary key, organization_id uuid, location_id uuid, status text default 'closed');
  create table public.payments (
    id uuid primary key, organization_id uuid, order_id uuid, amount numeric, method text, status text default 'confirmed',
    channel text default 'pos', pos_session_id uuid, recorded_by uuid, confirmed_by uuid, paid_at timestamptz default now(),
    refunded_from_payment_id uuid
  );
  -- Sentinel: draft preparation must not mutate operational history.
  create table public.operational_receipt_sentinel (value text); insert into public.operational_receipt_sentinel values ('unchanged');
`);
for (const file of ["20260826000300_billing_001_invoicing_foundation.sql", "20261007000200_billing_tax_inclusive_pricing_001.sql",
  "20261118125229_billing_issue_idempotency_001.sql", "20261118175639_billing_simplified_core_001.sql"]) query(read(`supabase/migrations/${file}`));
const paymentsSql = read("supabase/migrations/20260728000300_app_007_logistics_photos_payments.sql");
const start = paymentsSql.indexOf("create function public.get_order_payment_summary(");
query(paymentsSql.slice(start, paymentsSql.indexOf("$$;", start) + 3));
const ordinaryDefinition = query("select pg_get_functiondef('public.create_billing_draft(uuid[],text,numeric,text)'::regprocedure);");
query(read("supabase/migrations/20261118195512_billing_simplified_draft_001.sql"));
assert.equal(query("select pg_get_functiondef('public.create_billing_draft(uuid[],text,numeric,text)'::regprocedure);"), ordinaryDefinition);
query(`${auth}
  insert into public.profiles values ('${actor}'); insert into public.organizations values ('${org}', 'Fixture');
  insert into public.customers (id, organization_id, customer_code, display_name) values
    ('${shared}', '${org}', 'WALKIN-SHARED', 'Technical operational name'), ('${named}', '${org}', 'C-1', 'Named fixture');
  insert into public.pos_sessions (id, organization_id) values ('${session}', '${org}');
  insert into public.organization_billing_settings (organization_id, default_tax_rate) values ('${org}', 7);
`);
newOrder(10, { mixed: true }); newOrder(11, { customer: named }); newOrder(12, { paid: 5 });
newOrder(13); newOrder(14); newOrder(15); newOrder(16); newOrder(17, { mixed: true }); newOrder(18);
newOrder(19, { customer: named }); newOrder(20);
query(`update public.orders set subtotal = 0.30, discount_amount = 0, total = 0.30 where id = '${uuid(20)}';
  update public.order_items set quantity = 3, unit_price = 0.10, line_total = 0.30 where order_id = '${uuid(20)}';
  update public.payments set amount = 0.10 where order_id = '${uuid(20)}';
  insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
    values ('${uuid(3020)}', '${org}', '${uuid(20)}', 0.20, 'card', '${session}', '${actor}', '${actor}');`);
// Synthetic issued ordinary fixture; no issue RPC or counter is invoked.
const issued = query(`${auth} select public.create_billing_draft(array['${uuid(19)}']::uuid[]);`).split("\n").at(-1);
query(`${auth} select set_config('app.billing_mutation', 'on', false);
  update public.invoices set document_status = 'issued', invoice_number = 'FIXTURE-ISSUED',
    sequence_number = 1, issued_at = now() where id = '${issued}';`);
const issuedBefore = json(`select row_to_json(i) from public.invoices i where id = '${issued}';`);
const financialBefore = query("select json_agg(p order by p.id) from public.payments p;");
const draft = query(`${auth} set role authenticated; select ${rpc(10)};`).split("\n").at(-1);
const snapshot = json(`select row_to_json(i) from public.invoices i where id = '${draft}';`);
assert.equal(snapshot.fiscal_document_type, "simplificada"); assert.equal(snapshot.total, 13);
assert.equal(snapshot.taxable_base, 12.15); assert.equal(snapshot.tax_total, .85);
for (const field of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_address_line2", "customer_city", "customer_postal_code", "customer_country_code", "customer_email", "invoice_number", "sequence_number", "issued_at"]) assert.equal(snapshot[field], null);
assert.equal(query(`${auth} select ${rpc(10)};`).split("\n").at(-1), draft);
assert.deepEqual(json(`select row_to_json(i) from public.invoices i where id = '${draft}';`), snapshot);
const namedDraft = query(`${auth} select ${rpc(11)};`).split("\n").at(-1);
assert.equal(query(`select customer_name from public.invoices where id = '${namedDraft}';`), "Named fixture");
fails(rpc(12), "billing_order_not_fully_paid");
assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(12)}';`), "0");
fails(rpc(10, "T"), "billing_simplified_draft_conflict");
fails(rpc(10), "billing_not_authorized", `${auth} set test.role = 'staff';`);
fails(rpc(10), "billing_entitlement_required", `${auth} set test.billing = 'false';`);
fails(rpc(10), "pos_not_authorized", `${auth} set test.pos = 'false';`);
fails(rpc(10), "billing_invalid_orders", `${auth} set test.org = '${uuid(99)}';`);
query(`${auth} select public.create_billing_draft(array['${uuid(13)}']::uuid[]);`);
fails(rpc(13), "billing_simplified_draft_conflict");
fails(rpc(19), "billing_simplified_draft_conflict");
assert.deepEqual(json(`select row_to_json(i) from public.invoices i where id = '${issued}';`), issuedBefore);
query(`${auth} select ${rpc(20)};`);
assert.deepEqual(json(`select json_build_array(total, taxable_base, tax_total) from public.invoices
  where id = (select invoice_id from public.invoice_orders where order_id = '${uuid(20)}');`), [0.30, 0.28, 0.02]);
// Mixed/inconsistent drafts are never normalized or replaced during reuse.
query(`${auth} select ${rpc(14)};
  select set_config('app.billing_mutation', 'on', false);
  insert into public.invoice_items (organization_id, invoice_id, source_order_id, source_order_item_id,
    description, unit_type, quantity, unit_price, line_subtotal, discount_amount, taxable_base, tax_rate, tax_amount, line_total, prices_include_tax, display_order)
  select organization_id, invoice_id, source_order_id, source_order_item_id, description, unit_type, quantity, unit_price,
    line_subtotal, discount_amount, 12.62, 3, 0.38, line_total, true, 2
  from public.invoice_items where source_order_id = '${uuid(14)}';`);
fails(rpc(14), "billing_simplified_tax_model_unsupported");
query(`${auth} select ${rpc(15)}; update public.order_items set description = 'Changed' where order_id = '${uuid(15)}';`);
fails(rpc(15), "billing_simplified_draft_incompatible");
// Failed second step must roll back the intermediate ordinary draft as well.
fails(rpc(16, "A"), "billing_series_document_type_conflict");
assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(16)}';`), "0");
query(`update public.payments set pos_session_id = null where order_id = '${uuid(17)}' and method = 'card';`);
fails(rpc(17), "billing_pos_registration_unverified");
query(`update public.payments set pos_session_id = '${session}' where order_id = '${uuid(17)}';`);
const [first, second] = await Promise.all([
  concurrentQuery(`${auth} begin; select ${rpc(18)}; select pg_sleep(0.5); commit;`),
  concurrentQuery(`${auth} begin; select ${rpc(18)}; commit;`),
]);
const idFrom = (output) => output.split("\n").find((line) => /^[0-9a-f-]{36}$/.test(line));
assert.ok(idFrom(first)); assert.equal(idFrom(first), idFrom(second));
assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(18)}' and is_active;`), "1");
assert.equal(query("select json_agg(p order by p.id) from public.payments p;"), financialBefore);
assert.equal(query("select value from public.operational_receipt_sentinel;"), "unchanged");
assert.equal(query("select count(*) from public.billing_invoice_number_counters;"), "0");
assert.equal(query("select count(*) from public.invoices where fiscal_document_type = 'simplificada' and (invoice_number is not null or sequence_number is not null or issued_at is not null);"), "0");
console.log("PASS: real Billing RPC creation, atomic rollback, idempotency/concurrency, tenant/auth, full/mixed/partial POS, snapshots and no financial/numbering mutations");
