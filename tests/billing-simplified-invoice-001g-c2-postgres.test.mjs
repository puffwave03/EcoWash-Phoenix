import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const url = process.env.PHOENIX_BILLING_TEST_DATABASE_URL;
const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const fn = (s, name) => s.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$\\$;`))[0];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1), other = id(2), actor = id(3), registered = id(4), walkin = id(5);
const owner = `set test.org='${org}';set test.actor='${actor}';set test.role='owner';set test.entitled='true';`;
const anon = { recipient_snapshot_mode: "anonymous", customer_id: null, customer_name: null,
  customer_tax_id: null, customer_address_line1: null, customer_address_line2: null,
  customer_city: null, customer_postal_code: null, customer_country_code: null, customer_email: null };
const fixture = `
create schema auth; create schema extensions; grant usage on schema auth to authenticated;
create function extensions.gen_random_uuid() returns uuid language sql as 'select gen_random_uuid()';
create type public.app_role as enum ('owner','manager','staff');
create type public.payment_method as enum ('cash','card','bank_transfer','other');
create type public.service_unit_type as enum ('piece','weight','service','area','cycle','day');
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function public.app_current_organization_id() returns uuid language sql as $$select nullif(current_setting('test.org',true),'')::uuid$$;
create function public.has_organization_role(uuid,public.app_role[]) returns boolean language sql as $$select coalesce($1=public.app_current_organization_id() and auth.uid() is not null and current_setting('test.role',true)=any($2::text[]),false)$$;
create function public.organization_entitlement_is_enabled(uuid,text,timestamptz) returns boolean language sql as $$select coalesce(current_setting('test.entitled',true),'true')='true'$$;
create function public.has_organization_entitlement(uuid,text) returns boolean language sql as $$select public.organization_entitlement_is_enabled($1,$2,now())$$;
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create table public.organizations(id uuid primary key,name text,timezone text not null default 'Atlantic/Canary');
create table public.profiles(id uuid primary key);
create table public.customers(id uuid primary key,organization_id uuid not null references public.organizations,customer_code text,customer_type text,display_name text,company_name text,tax_id text,billing_address_line1 text,billing_address_line2 text,billing_city text,billing_postal_code text,billing_country_code char(2),email text,unique(organization_id,id));
create table public.orders(id uuid primary key,organization_id uuid references public.organizations,customer_id uuid not null,order_number text,currency text,production_status text,is_active boolean,discount_amount numeric(14,2),subtotal numeric(14,2),total numeric(14,2),created_at timestamptz default now(),unique(organization_id,id),foreign key(organization_id,customer_id) references public.customers(organization_id,id));
create table public.order_items(id uuid primary key,organization_id uuid not null,order_id uuid not null,description text,unit_type public.service_unit_type,quantity numeric(12,3),unit_price numeric(14,2),line_total numeric(14,2),is_active boolean,sort_order integer,created_at timestamptz default now(),foreign key(organization_id,order_id) references public.orders(organization_id,id));
create table public.organization_branding(organization_id uuid primary key,commercial_name text,business_address text,support_email text,support_phone text,logo_path text);
create table public.payments(id uuid primary key default gen_random_uuid(),organization_id uuid,order_id uuid,status text,amount numeric(14,2),paid_at timestamptz default now());
alter table public.orders add column location_id uuid;
create table public.organization_memberships(organization_id uuid,profile_id uuid,is_active boolean,role public.app_role,operational_capabilities text[]);
create table public.pos_sessions(id uuid primary key,organization_id uuid,location_id uuid,status text,opened_by uuid);
alter table public.payments add column method public.payment_method,add column reference text,add column notes text,
  add column recorded_by uuid,add column confirmed_by uuid,add column pos_session_id uuid,add column channel text,
  add column provider text,add column provider_reference text,add column external_status text,add column idempotency_key uuid,
  add column refunded_from_payment_id uuid,add column refund_reason text,add column refunded_at timestamptz,
  add unique(organization_id,idempotency_key);
grant select on public.payments to authenticated;
insert into public.organizations(id,name) values('${org}','Synthetic tenant'),('${other}','Other tenant');
insert into public.profiles values('${actor}');
insert into public.organization_memberships values('${org}','${actor}',true,'owner','{}');
insert into public.pos_sessions values('${id(7)}','${org}',null,'open','${actor}');
insert into public.customers(id,organization_id,customer_code,customer_type,display_name,tax_id,billing_address_line1,billing_city,billing_postal_code,billing_country_code) values
 ('${registered}','${org}','REG','individual','Registered test','TEST','Test','Test','00000','ES'),
 ('${walkin}','${org}','WALKIN-SHARED','individual','Technical only',null,null,null,null,null);
`;

test("001G-C2 isolated exact advance/final reconciliation", {
  skip: url ? false : "RUNTIME_NOT_VERIFIED: no disposable local PostgreSQL URL", timeout: 180000,
}, async () => {
  const parsed = new URL(url);
  assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/phoenix_series_test_[a-z0-9_]+$/);
  assert.equal(parsed.search, "");
  const db = parsed.pathname.slice(1);
  const env = { ...process.env, PGDATABASE: db, PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password), PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432", PGSSLMODE: "disable", PGOPTIONS: "",
    PGSERVICE: "", PGSERVICEFILE: "", PGCONNECT_TIMEOUT: "3" };
  delete env.PGHOSTADDR;
  const args = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
  const raw = input => spawnSync("psql", args, { env, input, encoding: "utf8", timeout: 25000 });
  const sql = input => { const result = raw(input); if (result.error) throw result.error;
    if (result.status !== 0) throw Error(result.stderr); return result.stdout.trim(); };
  const fails = (input, pattern) => { const result = raw(input); if (result.error) throw result.error; assert.notEqual(result.status, 0);
    assert.match(result.stderr, pattern); };
  assert.equal(sql("select current_database()"), db);
  assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'"), "0");
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated')"), "2");
  sql(fixture);
  const posFoundation = read("20260827000400_pos_001_cash_register_foundation.sql");
  sql(fn(posFoundation, "has_pos_capability") + fn(posFoundation, "require_pos_access")
    + fn(read("20260930000200_pos_session_payment_boundary_001.sql"), "record_pos_payment")
    + fn(read("20260930000300_pos_refund_channel_session_boundary_001.sql"), "record_pos_refund"));
  sql(read("20260826000300_billing_001_invoicing_foundation.sql"));
  const ent = read("20260827000200_entitlements_001_tenant_feature_access.sql");
  sql(fn(ent, "require_billing_entitlement")
    + ent.slice(ent.indexOf("create trigger organization_billing_settings_require_entitlement"), ent.indexOf("create function public.require_segment_pricing_management_entitlement")));
  sql(fn(read("20260902000200_terminal_customer_ux_001b_shared_walk_in.sql"), "prevent_shared_walk_in_invoice")
    + "create trigger invoices_prevent_shared_walk_in before insert or update of customer_id on public.invoices for each row execute function public.prevent_shared_walk_in_invoice();");
  sql(read("20261007000200_billing_tax_inclusive_pricing_001.sql"));
  for (const name of ["20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql",
    "20261016000200_billing_fiscal_profile_001_minimal_configuration.sql",
    "20261016000300_billing_simplified_invoice_001c_series_reservation.sql",
    "20261017000100_billing_simplified_invoice_001d_series_configuration.sql",
    "20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql"]) sql(read(name));
  sql(owner + `insert into organization_billing_settings(organization_id,issuer_legal_name,issuer_tax_id,issuer_address_line1,issuer_city,issuer_postal_code,issuer_country_code,default_tax_rate)
    values('${org}','Test issuer','TEST-ISSUER','Test','Test','00000','ES',7);select reserve_billing_simplified_series('S');`);
  sql(read("20261018000100_billing_simplified_invoice_001f_service_issuance.sql"));
  sql(read("20261018000200_billing_simplified_invoice_001g_b_advance_link_foundation.sql"));
  sql(read("20261018000300_billing_simplified_invoice_001g_c1_advance_event_foundation.sql"));
  sql(read("20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql"));
  assert.equal(sql("select simplified_invoicing_enabled from organization_billing_settings"), "f");
  sql(owner + "update organization_billing_settings set fiscal_territory_code='ES-CN',declared_tax_regime_code='IGIC-GENERAL',simplified_invoicing_enabled=true;");
  let counter = 100;
  const order = total => { const number = ++counter, oid = id(number);
    sql(`insert into orders(id,organization_id,customer_id,order_number,currency,production_status,is_active,discount_amount,subtotal,total)
      values('${oid}','${org}','${walkin}','TEST-${number}','EUR','received',true,0,${total},${total});
      insert into order_items values('${id(number + 10000)}','${org}','${oid}','Test laundry','service',1,${total},${total},true,0,now());`);
    return oid; };
  const draft = (oid, recipient = anon) => sql(owner + `set role authenticated;select create_billing_draft(array['${oid}']::uuid[],null::text,null::numeric,null::text,'simplified','${JSON.stringify(recipient)}'::jsonb);`);
  const payment = (oid, amount, paidAt = "now()") => { const pid = id(++counter + 20000);
    sql(`insert into payments(id,organization_id,order_id,status,amount,paid_at,channel,pos_session_id)
      values('${pid}','${org}','${oid}','confirmed',${amount},${paidAt},'pos','${id(7)}');`); return pid; };
  const user = input => sql(owner + "set role authenticated;" + input);
  const declare = (oid, pid) => user(`select declare_billing_advance_event('${oid}','${pid}',true);`);
  const advance = (draftId, pid) => user(`select invoice_number from issue_billing_advance_invoice('${draftId}','${pid}','local_laundry_dry_cleaning','consumer',true);`);
  const final = (draftId, pid) => user(`select invoice_number from issue_billing_final_after_advances('${draftId}','${pid}',(now() at time zone 'Atlantic/Canary')::date,'local_laundry_dry_cleaning','consumer',true);`);
  const oid = order(7), did = draft(oid), p2 = payment(oid,2);
  declare(oid,p2); const a = advance(did,p2); assert.match(a, /-S-/);
  assert.equal(advance(did,p2), a);
  const p5 = payment(oid,5), f = final(did,p5); assert.match(f, /-S-/);
  assert.equal(final(did,p5), f);
  assert.equal(sql(`select sum(total)||'/'||sum(taxable_base)||'/'||sum(tax_total)
    from invoices where organization_id='${org}' and document_status='issued'`), "7.00/6.54/0.46");
  assert.equal(sql(`select count(*) from billing_invoice_payment_links where order_id='${oid}'`), "2");
  const rounding = order(3), roundingDraft = draft(rounding);
  for (let n=0;n<2;n++) { const pid=payment(rounding,1); declare(rounding,pid); advance(roundingDraft,pid); }
  const last=payment(rounding,1), before=sql("select next_value from billing_invoice_number_counters where series='S'");
  const roundingNumber=final(roundingDraft,last);
  assert.equal(final(roundingDraft,last),roundingNumber);
  assert.equal(Number(sql("select next_value from billing_invoice_number_counters where series='S'")), Number(before)+1);
  assert.equal(sql(`select sum(total)||'/'||sum(taxable_base)||'/'||sum(tax_total)
    from invoices i join invoice_orders l on l.invoice_id=i.id where l.order_id='${rounding}'`), "3.00/2.79/0.21");
  assert.equal(sql(`select operation_total||'/'||operation_taxable_base||'/'||operation_tax_total||'/'||operation_rounding_base_delta
    from invoices where id='${roundingDraft}'`), "3.00/2.80/0.20/-0.01");
  const ordinaryOrder = order(9);
  sql(`update orders set customer_id='${registered}' where id='${ordinaryOrder}';`);
  const ordinaryDraft = user(`select create_billing_draft(array['${ordinaryOrder}']::uuid[]);`);
  assert.match(user(`select invoice_number from issue_billing_invoice('${ordinaryDraft}');`), /-A-/);
  // C2 display/security regressions. Fiscal happy-path assertions above are reused.
  const advanceId = sql(`select invoice_id from billing_invoice_payment_links where payment_id='${p2}'`);
  const fiscalSnapshot = () => sql(`select jsonb_agg(to_jsonb(i) order by i.id) from invoices i where i.document_status='issued'`);
  const itemsSnapshot = () => sql("select jsonb_agg(to_jsonb(it) order by it.id) from invoice_items it");
  const frozen = fiscalSnapshot(), frozenItems = itemsSnapshot();
  const refund = user(`select record_pos_refund('${p2}',0.50,'Local test','${id(7)}','${id(90001)}');`);
  assert.ok(refund);
  assert.equal(sql(`select status||'/'||amount from payments where id='${p2}'`), 'confirmed/2.00');
  assert.equal(sql(`select status||'/'||amount||'/'||refunded_from_payment_id from payments where id='${refund}'`), `refunded/0.50/${p2}`);
  assert.equal(sql(owner + `select billing_paid_total_for_invoice('${advanceId}','${org}');`), '1.50');
  assert.equal(sql(owner + `select billing_paid_total_for_invoice('${did}','${org}');`), '5.00');
  fails(owner + `set app.billing_mutation='on';update invoices set total=total+1 where id='${advanceId}';`, /billing_issued_snapshot_immutable/);
  fails(owner + `set app.billing_mutation='on';update invoice_items set description='Changed' where invoice_id='${did}';`, /billing_issued_snapshot_immutable/);
  assert.equal(fiscalSnapshot(), frozen);
  assert.equal(itemsSnapshot(), frozenItems);
  const foreign = owner + `set test.org='${other}';set role authenticated;`;
  assert.equal(sql(foreign + `select count(*) from invoices where id in ('${advanceId}','${did}');`), '0');
  assert.equal(sql(foreign + `select count(*) from billing_invoice_payment_links where order_id='${oid}';`), '0');
  fails(foreign + `select * from issue_billing_advance_invoice('${did}','${p2}','local_laundry_dry_cleaning','consumer',true);`, /billing_invalid_draft/);
  fails(foreign + `select * from issue_billing_final_after_advances('${did}','${p5}',current_date,'local_laundry_dry_cleaning','consumer',true);`, /billing_invalid_draft/);
  for (const denial of ["set test.role='staff';", "set test.entitled='false';"]) {
    fails(owner + denial + `set role authenticated;select * from issue_billing_advance_invoice('${did}','${p2}','local_laundry_dry_cleaning','consumer',true);`, /billing_not_authorized/);
  }
  assert.equal(fiscalSnapshot(), frozen);

  // FIX 1: each new column is immutable, including NULL assignments through
  // privileged SQL with the normal mutation flag. These are real UPDATEs.
  const summaryFields = ["operation_total", "operation_taxable_base", "operation_tax_total",
    "documented_advance_total", "documented_advance_taxable_base", "documented_advance_tax_total",
    "operation_rounding_base_delta", "operation_items_snapshot"];
  for (const field of summaryFields) {
    const changed = field === "operation_items_snapshot"
      ? `jsonb_set(${field},'{0,description}','"Tampered"'::jsonb)` : `${field}+1`;
    for (const value of [changed, "null"]) fails(owner +
      `set app.billing_mutation='on';update invoices set ${field}=${value} where id='${roundingDraft}';`,
      /billing_issued_snapshot_immutable/);
  }
  fails(owner + `set app.billing_mutation='on';update invoices set
    ${summaryFields.map(field => `${field}=null`).join(",")} where id='${roundingDraft}';`,
    /billing_issued_snapshot_immutable/);
  assert.equal(fiscalSnapshot(), frozen);
  assert.equal(itemsSnapshot(), frozenItems);

  // FIX 2: canonical deletes still work without issued advances. Draft editing
  // remains possible; neither direct SQL nor the RPC can orphan an advance.
  for (const ordinary of [false, true]) {
    const o = order(8);
    if (ordinary) sql(`update orders set customer_id='${registered}' where id='${o}';`);
    const d = ordinary ? user(`select create_billing_draft(array['${o}']::uuid[]);`) : draft(o);
    sql(owner + `set app.billing_mutation='on';update invoices set notes='Draft edit' where id='${d}';`);
    assert.equal(sql(`select notes from invoices where id='${d}'`), "Draft edit");
    user(`select delete_billing_draft('${d}');`);
    assert.equal(sql(`select count(*) from invoices where id='${d}'`), "0");
  }
  const protectedOrder = order(8), protectedDraft = draft(protectedOrder);
  const protectedPayment = payment(protectedOrder, 2);
  declare(protectedOrder, protectedPayment); advance(protectedDraft, protectedPayment);
  const protectedSnapshot = fiscalSnapshot();
  fails(owner + `set role authenticated;select delete_billing_draft('${protectedDraft}');`,
    /billing_final_draft_has_issued_advances/);
  fails(owner + `set app.billing_mutation='on';delete from invoices where id='${protectedDraft}';`,
    /billing_final_draft_has_issued_advances/);
  fails(owner + `begin isolation level repeatable read;set role authenticated;select delete_billing_draft('${protectedDraft}');`,
    /billing_final_read_committed_required/);
  assert.equal(sql(`select document_status from invoices where id='${protectedDraft}'`), "draft");
  assert.equal(fiscalSnapshot(), protectedSnapshot);

  // FIX 3: business recipients permit earlier service dates, so the new check
  // (not the consumer same-day gate) must reject a service before collection.
  const identified = { ...anon, recipient_snapshot_mode: "identified", customer_name: "Test business",
    customer_tax_id: "TEST-BUSINESS", customer_address_line1: "Test address",
    customer_city: "Test city", customer_postal_code: "00000", customer_country_code: "ES" };
  const localToday = `(now() at time zone 'Atlantic/Canary')::date`;
  const midnight = `(${localToday}::timestamp at time zone 'Atlantic/Canary')`;
  for (const instant of [midnight, `${midnight}+interval '1 millisecond'`]) {
    const o = order(7), d = draft(o, identified), p = payment(o, 2, instant);
    declare(o, p);
    user(`select * from issue_billing_advance_invoice('${d}','${p}','local_laundry_dry_cleaning','business',true);`);
    const balance = payment(o, 5);
    const beforeDates = fiscalSnapshot();
    const next = sql("select next_value from billing_invoice_number_counters where series='S'");
    // Session timezone deliberately differs; collection belongs to tenant day.
    fails(owner + `set time zone 'Pacific/Honolulu';set role authenticated;
      select * from issue_billing_final_after_advances('${d}','${balance}',${localToday}-1,
        'local_laundry_dry_cleaning','business',true);`, /billing_service_date_before_advance/);
    assert.equal(sql("select next_value from billing_invoice_number_counters where series='S'"), next);
    assert.equal(fiscalSnapshot(), beforeDates);
    assert.equal(sql(`select count(*) from billing_invoice_payment_links where payment_id='${balance}'`), "0");
    user(`set time zone 'Pacific/Honolulu';select * from issue_billing_final_after_advances(
      '${d}','${balance}',${localToday},'local_laundry_dry_cleaning','business',true);`);
    assert.equal(Number(sql("select next_value from billing_invoice_number_counters where series='S'")), Number(next)+1);
  }
  // Collection just before midnight belongs to the preceding tenant day and
  // is not silently relabelled as today's advance by the existing date gate.
  const boundaryOrder = order(7), boundaryDraft = draft(boundaryOrder, identified);
  const boundaryPayment = payment(boundaryOrder, 2, `${midnight}-interval '1 millisecond'`);
  declare(boundaryOrder, boundaryPayment);
  fails(owner + `set role authenticated;select * from issue_billing_advance_invoice(
    '${boundaryDraft}','${boundaryPayment}','local_laundry_dry_cleaning','business',true);`,
    /billing_advance_date_review_required/);

  // FIX 2 concurrency: hold a real transaction at each side of the order lock,
  // observe the other backend actually waiting, then commit the winner.
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const session = (name, input) => {
    const child = spawn("psql", args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const state = { child, stdout: "", stderr: "", exited: false };
    child.stdout.on("data", chunk => { state.stdout += chunk; });
    child.stderr.on("data", chunk => { state.stderr += chunk; });
    state.done = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", code => { state.exited = true; resolve(code); });
    });
    child.stdin.write(`set application_name='${name}';set statement_timeout='15s';${owner}begin;set role authenticated;${input}\n`);
    return state;
  };
  const waitFor = async (check, message) => {
    const deadline = Date.now()+10000;
    while (!check()) { assert.ok(Date.now()<deadline, message); await delay(30); }
  };
  for (const advanceWins of [true, false]) {
    const o = order(7), d = draft(o), p = payment(o, 2); declare(o, p);
    const issue = `select * from issue_billing_advance_invoice('${d}','${p}','local_laundry_dry_cleaning','consumer',true);`;
    const remove = `select delete_billing_draft('${d}');`;
    const next = sql("select next_value from billing_invoice_number_counters where series='S'");
    const winner = session("c2_delete_issue_winner", (advanceWins ? issue : remove)+"select 'winner_holds_lock';");
    let loser;
    try {
      await waitFor(() => winner.stdout.includes("winner_holds_lock") || winner.exited, "winner did not reach barrier");
      assert.equal(winner.exited, false, winner.stderr);
      loser = session("c2_delete_issue_waiter", advanceWins ? remove : issue);
      // Queue COMMIT before the expected SQL rejection closes psql's stdin.
      loser.child.stdin.end("commit;\n");
      await waitFor(() => sql("select count(*) from pg_stat_activity where application_name='c2_delete_issue_waiter' and wait_event_type='Lock'")==="1",
        "competing operation did not wait on the lock");
      winner.child.stdin.end("commit;\n");
      assert.equal(await winner.done, 0, winner.stderr);
      assert.notEqual(await loser.done, 0);
      assert.match(loser.stderr, advanceWins ? /billing_final_draft_has_issued_advances/ : /billing_invalid_draft/);
      assert.equal(sql(`select count(*) from invoices where id='${d}'`), advanceWins ? "1" : "0");
      assert.equal(sql(`select count(*) from billing_invoice_payment_links where payment_id='${p}'`), advanceWins ? "1" : "0");
      assert.equal(Number(sql("select next_value from billing_invoice_number_counters where series='S'")), Number(next)+(advanceWins ? 1 : 0));
    } finally {
      for (const s of [winner, loser].filter(Boolean)) {
        if (!s.exited && !s.child.stdin.writableEnded) s.child.stdin.end("rollback;\n");
        await s.done;
      }
    }
  }
});
