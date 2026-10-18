import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

// OPT-IN: only an EMPTY disposable local DB named phoenix_series_test_*.
// The fixture models the existing Billing/POS keys and installs the real
// invoice_orders mutation guard. No staging credentials or business data.
const url = process.env.PHOENIX_BILLING_TEST_DATABASE_URL;
const migration = readFileSync(new URL("../supabase/migrations/20261018000200_billing_simplified_invoice_001g_b_advance_link_foundation.sql", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql", import.meta.url), "utf8");
const unchangedIssue = readFileSync(new URL("../supabase/migrations/20261018000100_billing_simplified_invoice_001f_service_issuance.sql", import.meta.url), "utf8");
const childGuard = foundation.match(/create function public\.protect_billing_child_mutation\(\)[\s\S]*?\$\$;/)?.[0];
assert.ok(childGuard);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1), other = id(2), order = id(3), otherOrder = id(4);
const ordinary = id(10), advance1 = id(11), advance2 = id(12), final = id(13);
const payment2 = id(20), payment5 = id(21), paymentOther = id(22), refund = id(23);

test("001G-B static release guards", () => {
  assert.match(migration, /create table public\.billing_invoice_payment_links/);
  assert.match(migration, /create unique index invoice_orders_one_active_final_invoice_per_order/);
  assert.match(migration, /billing_advance_issuance_not_enabled/);
  assert.match(migration, /new\.attributed_amount is distinct from source_payment\.amount/);
  assert.match(migration, /primary key \(organization_id, payment_id\)/);
  assert.match(migration, /revoke all on table public\.billing_invoice_payment_links/);
  assert.match(migration, /and public\.has_organization_entitlement\(organization_id, 'billing\.invoicing'\)/);
  assert.doesNotMatch(migration, /create (?:or replace )?function public\.issue_billing_invoice|update public\.organization_billing_settings|insert into public\.billing_invoice_number_counters/i);
  assert.match(unchangedIssue, /billing_advance_workflow_required/);
  assert.match(unchangedIssue, /billing_simplified_fiscal_history_review_required/);
});

test("001G-B isolated PostgreSQL constraints and history", { skip: url ? false : "RUNTIME_NOT_VERIFIED: no disposable local PostgreSQL URL", timeout: 120000 }, async () => {
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
  const fails = (input, pattern) => { const r = raw(input); assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, pattern); };
  assert.equal(sql("select current_database()"), db);
  assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'"), "0");
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated')"), "2");

  sql(`begin;
    create type public.app_role as enum ('owner','manager','staff');
    create type public.billing_invoice_document_status as enum ('draft','issued','cancelled');
    create function public.app_current_organization_id() returns uuid language sql as
      $$select nullif(current_setting('test.org',true),'')::uuid$$;
    create function public.has_organization_role(uuid,public.app_role[]) returns boolean language sql as
      $$select $1=public.app_current_organization_id() and current_setting('test.role',true)=any($2::text[])$$;
    create function public.organization_entitlement_is_enabled(uuid,text,timestamptz) returns boolean language sql as
      $$select $1=public.app_current_organization_id() and current_setting('test.entitled',true)='true'$$;
    create function public.has_organization_entitlement(uuid,text) returns boolean language sql stable security definer as
      $$select $1=public.app_current_organization_id() and current_setting('test.entitled',true)='true'$$;
    create table public.organizations(id uuid primary key);
    create table public.orders(id uuid primary key,organization_id uuid not null references public.organizations,
      unique(organization_id,id));
    create table public.payments(id uuid primary key,organization_id uuid not null,order_id uuid not null,
      status text not null,amount numeric(12,2) not null,refunded_from_payment_id uuid references public.payments(id),
      channel text not null default 'pos',pos_session_id uuid default '${id(7)}',
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
    insert into public.organizations values('${org}'),('${other}');
    insert into public.billing_invoice_number_counters values('${org}','A',42);
    insert into public.orders values('${order}','${org}'),('${otherOrder}','${other}');
    insert into public.invoices values('${ordinary}','${org}','draft',7),
      ('${advance1}','${org}','draft',2),('${advance2}','${org}','draft',2),
      ('${final}','${org}','draft',5);
    set app.billing_mutation='on';
    insert into public.invoice_orders(organization_id,invoice_id,order_id) values('${org}','${ordinary}','${order}');
    update public.invoices set document_status='issued' where id='${ordinary}';
    reset app.billing_mutation;
    insert into public.payments(id,organization_id,order_id,status,amount,refunded_from_payment_id) values('${payment2}','${org}','${order}','confirmed',2,null),
      ('${payment5}','${org}','${order}','confirmed',5,null),
      ('${paymentOther}','${other}','${otherOrder}','confirmed',2,null),
      ('${refund}','${org}','${order}','refunded',1,'${payment2}');
  commit;`);
  const before = sql(`select count(*)||'/'||sum(total) from invoices where organization_id='${org}'`);
  sql(migration);
  assert.equal(sql(`select count(*)||'/'||sum(total) from invoices where organization_id='${org}'`), before);
  assert.equal(sql(`select next_value from billing_invoice_number_counters where organization_id='${org}' and series='A'`), "42");
  assert.equal(sql(`select billing_link_role||'/'||is_active from invoice_orders where invoice_id='${ordinary}'`), "final/true");
  assert.equal(sql("select count(*) from billing_invoice_payment_links"), "0");
  assert.equal(sql("select relrowsecurity from pg_class where oid='public.billing_invoice_payment_links'::regclass"), "t");
  assert.equal(sql("select has_table_privilege('authenticated','public.billing_invoice_payment_links','INSERT')"), "f");
  const auth = `set test.org='${org}';set test.role='owner';set test.entitled='true';set app.billing_advance_link_mutation='on';`;
  const add = (invoice, payment, amount, role = "advance", organization = org, targetOrder = order) =>
    `insert into billing_invoice_payment_links(organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount) values('${organization}','${targetOrder}','${invoice}','${role}','${payment}',${amount});`;
  const roleLink = (invoice, role) => `set app.billing_mutation='on';insert into invoice_orders(organization_id,invoice_id,order_id,billing_link_role) values('${org}','${invoice}','${order}','${role}');`;
  fails(roleLink(final, "final"), /duplicate key/);
  sql(`set app.billing_mutation='on';update invoice_orders set is_active=false where invoice_id='${ordinary}';`);
  sql(roleLink(advance1, "advance") + roleLink(advance2, "advance") + roleLink(final, "final"));
  fails(`set app.billing_mutation='on';insert into invoice_orders(organization_id,invoice_id,order_id,billing_link_role,final_invoice_id) values('${org}','${id(60)}','${order}','advance','${final}')`, /billing_final_link_immutable/);
  assert.equal(sql(`select count(*) from invoice_orders where order_id='${order}' and billing_link_role='advance'`), "2");
  fails(`update invoices set document_status='issued' where id='${advance1}'`, /billing_advance_issuance_not_enabled/);
  sql(`update invoices set document_status='issued' where id='${final}'`);
  fails(add(advance1,payment2,2), /billing_payment_link_not_authorized/);
  sql(auth + add(advance1,payment2,2));
  sql(auth + add(final,payment5,5,"final"));
  assert.equal(sql("select sum(attributed_amount) from billing_invoice_payment_links"), "7.00");
  const clientRead = (targetOrg, role, entitled) => sql(`set role authenticated;
    set test.org='${targetOrg}';set test.role='${role}';set test.entitled='${entitled}';
    select current_user||'/'||count(*) from public.billing_invoice_payment_links;`);
  assert.equal(clientRead(org,"owner","true"), "authenticated/2");
  assert.equal(clientRead(org,"manager","true"), "authenticated/2");
  assert.equal(clientRead(org,"owner","false"), "authenticated/0");
  assert.equal(clientRead(org,"manager","false"), "authenticated/0");
  assert.equal(clientRead(other,"owner","true"), "authenticated/0");
  assert.equal(clientRead(org,"staff","true"), "authenticated/0");
  fails(`set role authenticated;${auth}${add(advance2,id(24),2)}`, /permission denied/);
  fails(auth + add(advance2,payment2,2), /duplicate key/);
  fails(auth + add(advance2,paymentOther,2), /billing_payment_link_invalid_payment|foreign key/);
  fails(auth + add(advance2,payment5,1), /billing_payment_link_invalid_payment/);
  fails(auth + add(advance2,payment5,5), /billing_payment_link_exceeds_invoice/);
  fails(auth + add(advance2,refund,1), /billing_payment_link_invalid_payment/);
  sql(`insert into payments(id,organization_id,order_id,status,amount,refunded_from_payment_id,channel)
    values('${id(43)}','${org}','${order}','confirmed',1,null,'order');`);
  fails(auth + add(advance2,id(43),1), /billing_payment_link_invalid_payment/);
  assert.equal(sql(`select refunded_from_payment_id='${payment2}' from payments where id='${refund}'`), "t");
  fails(`set test.org='${org}';set test.role='staff';set test.entitled='true';set app.billing_advance_link_mutation='on';${add(advance2,payment2,2)}`, /billing_payment_link_not_authorized/);
  fails(auth + `update billing_invoice_payment_links set attributed_amount=1 where payment_id='${payment2}'`, /billing_payment_link_immutable/);
  fails(auth + `delete from billing_invoice_payment_links where payment_id='${payment2}'`, /billing_payment_link_immutable/);
  fails(`set app.billing_mutation='on';update invoice_orders set billing_link_role='advance' where invoice_id='${ordinary}'`, /billing_invoice_order_role_immutable/);
  fails(`set app.billing_mutation='on';update invoice_orders set final_invoice_id='${final}' where invoice_id='${advance1}'`, /billing_issued_snapshot_immutable|billing_final_link_invalid/);
  assert.equal(sql(`select count(*) from billing_invoice_payment_links`), "2");
  sql(`begin;${auth}insert into payments(id,organization_id,order_id,status,amount,refunded_from_payment_id) values('${id(24)}','${org}','${order}','confirmed',2,null);${add(advance2,id(24),2)}rollback;`);
  assert.equal(sql(`select count(*) from billing_invoice_payment_links`), "2");
  assert.equal(sql(`select count(*) from payments where id='${id(24)}'`), "0");
  // Multiple independent advances are structurally possible without a second
  // final document. The synthetic payments do not bypass the real POS writer.
  sql(`insert into orders values('${id(33)}','${org}');
    insert into invoices values('${id(34)}','${org}','draft',1),('${id(35)}','${org}','draft',1);
    set app.billing_mutation='on';
    insert into invoice_orders(organization_id,invoice_id,order_id,billing_link_role)
      values('${org}','${id(34)}','${id(33)}','advance'),('${org}','${id(35)}','${id(33)}','advance');
    insert into payments(id,organization_id,order_id,status,amount,refunded_from_payment_id) values('${id(40)}','${org}','${id(33)}','confirmed',1,null),
      ('${id(41)}','${org}','${id(33)}','confirmed',1,null);`);
  sql(auth + add(id(34),id(40),1,"advance",org,id(33)) + add(id(35),id(41),1,"advance",org,id(33)));
  assert.equal(sql(`select count(*) from billing_invoice_payment_links where order_id='${id(33)}'`), "2");

  // The partial unique final index must serialize two transactions, not only
  // reject sequential attempts. Both use the unchanged Billing mutation gate.
  sql(`insert into orders values('${id(50)}','${org}');
    insert into invoices values('${id(51)}','${org}','draft',7),('${id(52)}','${org}','draft',7);`);
  const finalInsert = invoice => `insert into invoice_orders(organization_id,invoice_id,order_id)
    values('${org}','${invoice}','${id(50)}');`;
  const first = spawn("psql", args, { env, stdio: ["pipe", "pipe", "pipe"] });
  let firstOutput = "", firstError = "";
  const marker = new Promise((resolve, reject) => {
    first.stdout.on("data", chunk => { firstOutput += chunk; if (firstOutput.includes("first_final_inserted")) resolve(); });
    first.on("error", reject);
    first.on("close", code => { if (code !== 0) reject(Error(firstError)); });
  });
  first.stderr.on("data", chunk => { firstError += chunk; });
  const firstDone = new Promise(resolve => first.on("close", code => resolve(code)));
  first.stdin.end(`begin;set app.billing_mutation='on';${finalInsert(id(51))}
\\echo first_final_inserted
select pg_sleep(2);commit;\n`);
  await marker;
  fails(`set app.billing_mutation='on';${finalInsert(id(52))}`, /duplicate key/);
  assert.equal(await firstDone, 0, firstError);
  assert.equal(sql(`select count(*) from invoice_orders where order_id='${id(50)}' and is_active and billing_link_role='final'`), "1");

  // A cancelled document cannot acquire new payments; its historic links stay.
  sql(`update invoices set document_status='cancelled' where id='${final}'`);
  fails(auth + add(final,payment2,2,"final"), /billing_payment_link_invalid_invoice/);
  assert.equal(sql(`select count(*) from billing_invoice_payment_links where invoice_id='${final}'`), "1");
  assert.match(sql("select current_database()"), /^phoenix_series_test_/);
});
