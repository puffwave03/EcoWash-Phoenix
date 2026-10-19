import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

// OPT-IN: only an empty disposable local database named phoenix_series_test_*.
// The fixture applies the real 001G-B foundation before the new declaration SQL.
const url = process.env.PHOENIX_BILLING_TEST_DATABASE_URL;
const foundation = readFileSync(new URL("../supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql", import.meta.url), "utf8");
const links = readFileSync(new URL("../supabase/migrations/20261018000200_billing_simplified_invoice_001g_b_advance_link_foundation.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261018000300_billing_simplified_invoice_001g_c1_advance_event_foundation.sql", import.meta.url), "utf8");
const posRefund = readFileSync(new URL("../supabase/migrations/20260930000300_pos_refund_channel_session_boundary_001.sql", import.meta.url), "utf8");
const childGuard = foundation.match(/create function public\.protect_billing_child_mutation\(\)[\s\S]*?\$\$;/)?.[0];
assert.ok(childGuard);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1), other = id(2), order = id(3), otherOrder = id(4), actor = id(5);
const payment = id(10), second = id(11), pending = id(12), online = id(13), refunded = id(14);
const ordinary = id(20), advance = id(21);

test("001G-C1 keeps issuance, POS and tax calculations unchanged", () => {
  assert.match(migration, /create table public\.billing_advance_event_declarations/);
  assert.match(migration, /primary key \(organization_id, payment_id\)/);
  assert.match(migration, /references public\.payments \(organization_id, order_id, id\)/);
  assert.match(migration, /new\.payment_amount := source_payment\.amount/);
  assert.match(migration, /new\.payment_paid_at := source_payment\.paid_at/);
  assert.match(migration, /billing_advance_event_read_committed_required/);
  assert.ok(migration.indexOf("select * into source_payment") < migration.indexOf("perform 1 from public.orders o"));
  assert.match(posRefund, /select \* into source_payment from public\.payments payment[\s\S]*?for update;/);
  assert.match(posRefund, /insert into public\.payments \(/);
  assert.match(migration, /grant select on table public\.billing_advance_event_declarations to authenticated/);
  assert.doesNotMatch(migration, /create (?:or replace )?function public\.(?:issue_billing_invoice|record_pos_payment|record_pos_refund)|alter table public\.(?:invoices|invoice_items|payments|organization_billing_settings)|billing_invoice_number_counters|taxable_base|tax_rate|tax_amount|simplified_invoicing_enabled/i);
  assert.match(links, /billing_advance_issuance_not_enabled/);
});

test("001G-C1 isolated PostgreSQL declaration, tenant and 001G-B links", {
  skip: url ? false : "RUNTIME_NOT_VERIFIED: no disposable local PostgreSQL URL", timeout: 120000,
}, async () => {
  const u = new URL(url);
  assert.ok(["postgres:", "postgresql:"].includes(u.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(u.hostname));
  assert.match(u.pathname, /^\/phoenix_series_test_[a-z0-9_]+$/);
  assert.equal(u.search, "");
  const db = u.pathname.slice(1);
  const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432",
    PGDATABASE: db, PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password), PGSSLMODE: "disable",
    PGOPTIONS: "", PGSERVICE: "", PGSERVICEFILE: "", PGCONNECT_TIMEOUT: "3" };
  delete env.PGHOSTADDR;
  const args = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
  const raw = input => spawnSync("psql", args, { env, input, encoding: "utf8", timeout: 20000 });
  const sql = input => { const r = raw(input); if (r.error) throw r.error; if (r.status !== 0) throw Error(r.stderr); return r.stdout.trim(); };
  const fails = (input, pattern) => { const r = raw(input); if (r.error) throw r.error; assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, pattern); };
  assert.equal(sql("select current_database()"), db);
  assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'"), "0");
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated')"), "2");
  sql(`begin;
    create schema if not exists auth;
    create type public.app_role as enum ('owner','manager','staff');
    create type public.billing_invoice_document_status as enum ('draft','issued','cancelled');
    create or replace function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function public.app_current_organization_id() returns uuid language sql stable as
      $$select nullif(current_setting('test.org',true),'')::uuid$$;
    create function public.has_organization_role(uuid,public.app_role[]) returns boolean language sql stable as
      $$select $1=public.app_current_organization_id() and current_setting('test.role',true)=any($2::text[])$$;
    create function public.organization_entitlement_is_enabled(uuid,text,timestamptz) returns boolean language sql stable as
      $$select $1=public.app_current_organization_id() and current_setting('test.entitled',true)='true'$$;
    create function public.has_organization_entitlement(uuid,text) returns boolean language sql stable as
      $$select $1=public.app_current_organization_id() and current_setting('test.entitled',true)='true'$$;
    create table public.organizations(id uuid primary key);
    create table public.profiles(id uuid primary key);
    create table public.orders(id uuid primary key,organization_id uuid not null references public.organizations,
      is_active boolean not null default true,production_status text not null default 'received',
      unique(organization_id,id));
    create table public.payments(id uuid primary key,organization_id uuid not null,order_id uuid not null,
      status text not null,amount numeric(12,2) not null,paid_at timestamptz not null default now(),
      channel text not null default 'pos',pos_session_id uuid,refunded_from_payment_id uuid,
      foreign key(organization_id,order_id) references public.orders(organization_id,id));
    create table public.invoices(id uuid primary key,organization_id uuid not null references public.organizations,
      document_status public.billing_invoice_document_status not null default 'draft',total numeric(14,2) not null,
      unique(organization_id,id));
    create table public.billing_invoice_number_counters(
      organization_id uuid not null,series text not null,next_value bigint not null,
      primary key(organization_id,series));
    create table public.invoice_orders(organization_id uuid not null,invoice_id uuid not null,order_id uuid not null,
      is_active boolean not null default true,created_at timestamptz not null default now(),
      primary key(invoice_id,order_id),
      foreign key(organization_id,invoice_id) references public.invoices(organization_id,id),
      foreign key(organization_id,order_id) references public.orders(organization_id,id));
    create unique index invoice_orders_one_active_invoice_per_order
      on public.invoice_orders(order_id) where is_active;
    ${childGuard}
    create trigger invoice_orders_controlled_mutation before insert or update or delete on public.invoice_orders
      for each row execute function public.protect_billing_child_mutation();
    insert into organizations values('${org}'),('${other}');
    insert into profiles values('${actor}');
    insert into orders(id,organization_id) values('${order}','${org}'),('${otherOrder}','${other}');
    insert into invoices values('${ordinary}','${org}','draft',7),('${advance}','${org}','draft',2);
    insert into billing_invoice_number_counters values('${org}','A',42);
    insert into payments(id,organization_id,order_id,status,amount,paid_at,pos_session_id)
      values ('${payment}','${org}','${order}','confirmed',2,'2026-10-18 09:15:00+00','${id(7)}'),
        ('${second}','${org}','${order}','confirmed',5,'2026-10-18 11:00:00+00','${id(7)}'),
        ('${pending}','${org}','${order}','pending',1,'2026-10-18 11:00:00+00','${id(7)}');
    insert into payments(id,organization_id,order_id,status,amount,paid_at,channel,pos_session_id)
      values('${online}','${org}','${order}','confirmed',1,'2026-10-18 11:00:00+00','online',null);
  commit;`);
  sql(links);
  const before = sql(`select count(*)||'/'||sum(total) from invoices where organization_id='${org}'`);
  sql(migration);
  assert.equal(sql(`select count(*)||'/'||sum(total) from invoices where organization_id='${org}'`), before);
  assert.equal(sql(`select next_value from billing_invoice_number_counters where organization_id='${org}' and series='A'`), "42");
  assert.equal(sql("select count(*) from billing_advance_event_declarations"), "0");
  assert.equal(sql("select relrowsecurity from pg_class where oid='public.billing_advance_event_declarations'::regclass"), "t");
  assert.equal(sql("select has_table_privilege('authenticated','public.billing_advance_event_declarations','INSERT')"), "f");
  const auth = `set test.org='${org}';set test.actor='${actor}';set test.role='owner';set test.entitled='true';set app.billing_advance_event_mutation='on';`;
  const add = (pay = payment, targetOrg = org, targetOrder = order, confirmed = true) =>
    `insert into billing_advance_event_declarations(organization_id,order_id,payment_id,service_not_performed_confirmed)
      values('${targetOrg}','${targetOrder}','${pay}',${confirmed});`;
  fails(add(), /billing_advance_event_not_authorized/);
  fails(auth + add(payment,org,order,false), /billing_advance_event_confirmation_required/);
  fails(auth + add(pending), /billing_advance_event_invalid_payment/);
  fails(auth + add(online), /billing_advance_event_invalid_payment/);
  fails(auth + add(payment,other,otherOrder), /billing_advance_event_not_authorized/);
  fails(auth + add(payment,org,otherOrder), /billing_advance_event_invalid_order/);
  fails(auth.replace("'owner'","'staff'") + add(), /billing_advance_event_not_authorized/);
  fails(auth.replace("'true';set app", "'false';set app") + add(), /billing_advance_event_not_authorized/);
  fails(`begin isolation level repeatable read;${auth}${add()}commit;`, /billing_advance_event_read_committed_required/);
  fails(`begin isolation level serializable;${auth}${add()}commit;`, /billing_advance_event_read_committed_required/);
  sql(auth + add());
  assert.equal(sql(`select payment_amount||'/'||payment_paid_at||'/'||declared_by||'/'||service_not_performed_confirmed
    from billing_advance_event_declarations where payment_id='${payment}'`), `2.00/2026-10-18 09:15:00+00/${actor}/true`);
  fails(auth + add(), /duplicate key/);
  fails(auth + `update billing_advance_event_declarations set payment_amount=1 where payment_id='${payment}'`, /billing_advance_event_immutable/);
  fails(auth + `delete from billing_advance_event_declarations where payment_id='${payment}'`, /billing_advance_event_immutable/);
  sql(`insert into payments(id,organization_id,order_id,status,amount,refunded_from_payment_id,pos_session_id)
    values('${refunded}','${org}','${order}','refunded',1,'${second}','${id(7)}');`);
  fails(auth + add(second), /billing_advance_event_invalid_payment/);
  const historicalOrder = id(40), historicalPayment = id(41), historicalInvoice = id(42);
  sql(`insert into orders(id,organization_id) values('${historicalOrder}','${org}');
    insert into invoices values('${historicalInvoice}','${org}','draft',1);
    insert into payments(id,organization_id,order_id,status,amount,pos_session_id)
      values('${historicalPayment}','${org}','${historicalOrder}','confirmed',1,'${id(7)}');
    set app.billing_mutation='on';
    insert into invoice_orders(organization_id,invoice_id,order_id)
      values('${org}','${historicalInvoice}','${historicalOrder}');
    update invoices set document_status='issued' where id='${historicalInvoice}';`);
  fails(auth + add(historicalPayment,org,historicalOrder), /billing_advance_event_fiscal_history_review_required/);
  const clientRead = (targetOrg, role, entitled) => sql(`set role authenticated;set test.org='${targetOrg}';
    set test.role='${role}';set test.entitled='${entitled}';select current_user||'/'||count(*) from billing_advance_event_declarations;`);
  assert.equal(clientRead(org,"owner","true"), "authenticated/1");
  assert.equal(clientRead(org,"manager","true"), "authenticated/1");
  assert.equal(clientRead(org,"owner","false"), "authenticated/0");
  assert.equal(clientRead(other,"owner","true"), "authenticated/0");
  assert.equal(clientRead(org,"staff","true"), "authenticated/0");
  fails(`set role authenticated;${auth}${add(second)}`, /permission denied/);
  sql(`set app.billing_mutation='on';insert into invoice_orders(organization_id,invoice_id,order_id,billing_link_role)
    values('${org}','${advance}','${order}','advance');`);
  sql(`set app.billing_advance_link_mutation='on';${auth}
    insert into billing_invoice_payment_links(organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount)
    values('${org}','${order}','${advance}','advance','${payment}',2);`);
  assert.equal(sql(`select l.invoice_id from billing_advance_event_declarations d
    join billing_invoice_payment_links l on l.organization_id=d.organization_id and l.payment_id=d.payment_id
    where d.payment_id='${payment}'`), advance);
  fails(`update invoices set document_status='issued' where id='${advance}'`, /billing_advance_issuance_not_enabled/);

  // The canonical POS refund writer locks the source payment before inserting
  // its separate refund row. A declaration waiting for that lock must see the
  // committed refund on READ COMMITTED and must not create an event.
  const racingPayment = id(30), racingRefund = id(31);
  sql(`insert into payments(id,organization_id,order_id,status,amount,pos_session_id)
    values('${racingPayment}','${org}','${order}','confirmed',1,'${id(7)}');`);
  const first = spawn("psql", args, { env, stdio: ["pipe", "pipe", "pipe"] });
  let firstOutput = "", firstError = "";
  const locked = new Promise((resolve, reject) => {
    first.stdout.on("data", chunk => { firstOutput += chunk; if (firstOutput.includes("source_payment_locked")) resolve(); });
    first.on("error", reject);
    first.on("close", code => { if (code !== 0) reject(Error(firstError)); });
  });
  first.stderr.on("data", chunk => { firstError += chunk; });
  const firstDone = new Promise(resolve => first.on("close", resolve));
  first.stdin.end(`begin;select id from payments where id='${racingPayment}' for update;
\\echo source_payment_locked
select pg_sleep(2);
insert into payments(id,organization_id,order_id,status,amount,refunded_from_payment_id,pos_session_id)
  values('${racingRefund}','${org}','${order}','refunded',1,'${racingPayment}','${id(7)}');
commit;\n`);
  await locked;
  const racingDeclaration = raw(auth + add(racingPayment));
  assert.equal(await firstDone, 0, firstError);
  assert.notEqual(racingDeclaration.status, 0, racingDeclaration.stdout);
  assert.match(racingDeclaration.stderr, /billing_advance_event_invalid_payment/);
  assert.equal(sql(`select count(*) from billing_advance_event_declarations where payment_id='${racingPayment}'`), "0");
  const managerPayment = id(50);
  sql(`insert into payments(id,organization_id,order_id,status,amount,pos_session_id)
    values('${managerPayment}','${org}','${order}','confirmed',1,'${id(7)}');`);
  const managerDeclaration = auth.replace("'owner'", "'manager'") + add(managerPayment);
  sql(`begin;${managerDeclaration}rollback;`);
  assert.equal(sql(`select count(*) from billing_advance_event_declarations where payment_id='${managerPayment}'`), "0");
  sql(managerDeclaration);
  assert.equal(sql(`select count(*) from billing_advance_event_declarations`), "2");
  assert.match(sql("select current_database()"), /^phoenix_series_test_/);
});
