import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20261029173145_order_financial_integrity_guard_001.sql", import.meta.url), "utf8");
const ordersSql = readFileSync(new URL("../supabase/migrations/20260728000200_app_006_orders_workflow.sql", import.meta.url), "utf8");
const billingDraftSql = readFileSync(new URL("../supabase/migrations/20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql", import.meta.url), "utf8");
const posSql = readFileSync(new URL("../supabase/migrations/20260930000200_pos_session_payment_boundary_001.sql", import.meta.url), "utf8");
const receiptSql = readFileSync(new URL("../supabase/migrations/20260908000100_accounting_sales_documents_001.sql", import.meta.url), "utf8");
const orderActions = readFileSync(new URL("../src/features/orders/server/actions.ts", import.meta.url), "utf8");
const dbUrl = process.env.PHOENIX_ORDER_FINANCIAL_GUARD_TEST_DATABASE_URL;

test("guard blocks persisted payments and fiscal/operational document links", () => {
  assert.match(migration, /p\.status <> 'void'/);
  assert.match(migration, /from public\.invoice_orders l[\s\S]*?l\.order_id = target_order_id/);
  assert.doesNotMatch(migration.match(/from public\.invoice_orders l[\s\S]*?\) then/)[0], /is_active|document_status/);
  assert.match(migration, /r\.document_status = 'issued'/);
  assert.match(migration, /transaction_isolation[\s\S]*?read committed/);
  assert.match(migration, /before insert or update or delete on public\.order_items/);
  assert.match(migration, /before update of subtotal, discount_amount, total on public\.orders/);
  assert.match(migration, /revoke all on function public\.assert_order_financially_mutable\(uuid\)[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.recalculate_order_totals\(uuid\)[\s\S]*?from public, anon, authenticated/);
});

test("existing lock order serializes draft snapshots, POS, receipt and Billing issue paths", () => {
  const internal = billingDraftSql.slice(billingDraftSql.indexOf("create function public.create_billing_draft_internal"), billingDraftSql.indexOf("revoke all on function public.create_billing_draft_internal"));
  assert.match(internal, /order by customer_order\.id for update/);
  assert.ok(internal.indexOf("order by customer_order.id for update") < internal.indexOf("insert into public.invoice_orders"));
  assert.ok(posSql.indexOf("from public.pos_sessions session") < posSql.indexOf("from public.orders orders") && posSql.slice(posSql.indexOf("from public.orders orders"), posSql.indexOf("from public.orders orders") + 240).includes("for update"));
  assert.match(receiptSql, /from public\.orders target_order[\s\S]*?for update/);
  for (const name of ["save_order_item", "remove_order_item", "update_order_discount"]) {
    const start = ordersSql.indexOf(`create function public.${name}`);
    assert.notEqual(start, -1, `${name} definition missing`);
    const body = ordersSql.slice(start, ordersSql.indexOf("\n$$;", start));
    assert.match(body, /for update/);
  }
  assert.match(ordersSql, /revoke all on function public\.recalculate_order_totals\(uuid\) from public/);
  // Issuers keep their established locks. A linked draft is visible to the
  // guard through a plain MVCC read, so it never waits on an invoice row.
  assert.match(migration, /from public\.invoice_orders l[\s\S]*?where l\.organization_id = org_id[\s\S]*?l\.order_id = target_order_id/);
  assert.doesNotMatch(migration, /for (?:no key )?update of .*invoice|for share of .*invoice/i);
});

test("financial guard errors are mapped to distinct messages in all supported locales", () => {
  assert.match(orderActions, /order_financial_payment_locked[\s\S]*?financialPayment/);
  assert.match(orderActions, /order_financial_document_locked[\s\S]*?financialDocument/);
  assert.match(orderActions, /order_financial_conflict[\s\S]*?financialConflict/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(readFileSync(new URL(`../src/i18n/${locale}/common.json`, import.meta.url), "utf8")).orders.items;
    for (const key of ["financialPayment", "financialDocument", "financialConflict"]) {
      assert.equal(typeof messages[key], "string", `${locale}.${key} missing`);
      assert.ok(messages[key].length > 20, `${locale}.${key} must be actionable`);
    }
  }
});

// The opt-in socket adapter targets only the verified C2 container and named
// disposable DB. It uses local socket authentication; no password is retrieved.
test("canonical PostgreSQL Orders/Portal RPCs and Phase 2A guards", {
  skip: dbUrl ? false : "RUNTIME_NOT_VERIFIED: isolated local PostgreSQL URL not supplied",
  timeout: 120000,
}, async (t) => {
  const url = new URL(dbUrl);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55322");
  assert.equal(url.pathname, "/phoenix_series_test_financial_guard_2a_20261029");
  assert.equal(url.search, "");
  const database = url.pathname.slice(1);
  const resume = process.env.PHOENIX_ORDER_FINANCIAL_GUARD_RESUME;
  assert.ok(!resume || ["portal_fix", "non_economic_boundary"].includes(resume), "unsupported resume mode");
  const container = process.env.PHOENIX_ORDER_FINANCIAL_GUARD_PSQL_CONTAINER;
  if (container) {
    assert.equal(container, "supabase_db_phoenix-c2-uat-local-001");
    assert.equal(url.password, "");
  }
  const env = { ...process.env, PGDATABASE: database, PGUSER: "postgres",
    PGHOST: url.hostname, PGPORT: url.port, PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "3" };
  for (const key of ["PGHOSTADDR", "PGOPTIONS", "PGSERVICE", "PGSERVICEFILE", "PGPASSFILE", "PGPASSWORD"]) delete env[key];
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  const clientArgs = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
  const command = container ? "docker" : "/usr/local/opt/libpq/bin/psql";
  const args = container ? ["exec", "-i", "--user", "postgres", container,
    "env", "-u", "PGHOST", "-u", "PGHOSTADDR", "-u", "PGPORT", "-u", "PGPASSWORD",
    "-u", "PGOPTIONS", "-u", "PGSERVICE", "-u", "PGSERVICEFILE", "-u", "PGPASSFILE",
    "psql", "-U", "postgres", "-d", database, ...clientArgs] : clientArgs;
  const raw = input => spawnSync(command, args, { env, input, encoding: "utf8", timeout: 20000 });
  const sql = input => {
    const result = raw(input);
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const denied = (input, pattern) => {
    const result = raw(input);
    if (result.error) throw result.error;
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, pattern);
    return result;
  };
  // Read-only identity, emptiness and role gates precede every fixture write.
  assert.equal(sql("select current_database()||'|'||current_user||'|'||current_setting('server_version');"), `${database}|postgres|17.6`);
  if (!resume) {
    assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public';"), "0");
    assert.equal(sql("select count(*) from pg_namespace where nspname in ('auth','extensions');"), "0");
  }
  assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated');"), "2");

  const read = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  function fn(source, name) {
    const pattern = new RegExp(`create(?: or replace)? function (?:public\\.${name}|"public"\\."${name}")\\s*\\(`, "i");
    const start = source.search(pattern);
    assert.notEqual(start, -1, `Missing canonical SQL: ${name}`);
    const tail = source.slice(start);
    const body = /\bas\s+(\$[a-z0-9_]*\$)/i.exec(tail);
    assert.ok(body, name);
    const end = tail.indexOf(body[1], body.index + body[0].length);
    assert.notEqual(end, -1, name);
    return tail.slice(0, end + body[1].length + 1);
  }
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const org = id(1), otherOrg = id(2), owner = id(10), manager = id(11), staff = id(12), portalActor = id(13), foreign = id(14);
  const customer = id(20), location = id(21), property = id(22), service = id(23);
  const as = (actor, input) => `set request.jwt.claim.sub='${actor}';set role authenticated;${input}`;
  const portalSql = read("20261014000200_portal_entitlement_boundary_001.sql");
  const entitlementSql = read("20260827000200_entitlements_001_tenant_feature_access.sql");
  const numberingSql = read("20261010000100_saas_order_reference_tenant_scoping_001b.sql");
  const catalogUnitsSql = read("20260824000200_catalog_001_service_units.sql");
  const portalCall = request => `select * from public.create_customer_portal_order_request('${id(request)}','${property}',
    '[{"service_id":"${service}","quantity":1}]'::jsonb,((now() at time zone 'Atlantic/Canary')+interval '1 day')::timestamp,'Synthetic request');`;
  if (resume) {
    // Reuse only this mission's retained fixture. All data probes run in
    // transactions that roll back; no reset, cleanup or schema rebuild.
    assert.equal(sql(`select count(*) from organizations where id in ('${org}','${otherOrg}')`), "2");
    assert.equal(sql(`select count(*) from customer_portal_access where user_id='${portalActor}' and organization_id='${org}' and is_active`), "1");
    assert.equal(sql("select count(*) from pg_trigger where tgname in ('order_items_financial_integrity_guard','order_items_zz_financial_integrity_guard','orders_financial_integrity_guard') and not tgisinternal"), "2");
    assert.equal(sql("select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='service_unit_type' and e.enumlabel in ('cycle','service','day')"), "3");
    const snapshot = () => sql("select (select count(*) from orders)||'/'||(select count(*) from order_items)||'/'||(select count(*) from pickups)||'/'||(select count(*) from order_status_history)||'/'||(select next_order_number from organization_order_numbering)");
    const retained = snapshot();
    sql(`begin;${migration}commit;`);
    const save = (oid, sid = null) => `select public.save_order_item(null,'${oid}',${sid ? `'${sid}'` : 'null'},'Synthetic line','piece',1,10,null);`;
    const fresh = (oid, actor = owner, tenant = org, cid = customer, lid = location) => `
      set request.jwt.claim.sub='${actor}';set app.order_create='on';set app.order_item_mutation='on';
      insert into orders(id,organization_id,customer_id,location_id,order_number,created_by,updated_by)
        values('${oid}','${tenant}','${cid}','${lid}','FIX-${oid.slice(-4)}','${actor}','${actor}');`;
    const expectDenied = (input, pattern) => {
      denied(`begin;${input}`,pattern);
      assert.equal(snapshot(),retained,'denied transaction must preserve all rows and numbering');
    };
    const run = (name, body) => {
      if (resume === 'non_economic_boundary' && ![
        'Portal-only canonical creation, totals, pickup, history and replay succeed',
        'revoked Portal is denied and rolls back without partial orders',
        'foreign-tenant property and fresh foreign/customer order are denied',
        'Owner/Manager/Staff canonical item operations and role restrictions are preserved',
      ].includes(name)) return;
      return t.test(name, body);
    };
    await run("Portal-only canonical creation, totals, pickup, history and replay succeed", () => {
      const result=sql(`begin;${as(portalActor,portalCall(901))}
        reset role;
        select count(*)||'/'||min(total)||'/'||min(production_status::text) from orders where created_by='${portalActor}';
        select count(*) from order_items where order_id in (select id from orders where created_by='${portalActor}');
        select count(*) from pickups where order_id in (select id from orders where created_by='${portalActor}');
        select count(*) from order_status_history where metadata->>'request_id'='${id(901)}';
        ${as(portalActor,portalCall(901))}reset role;
        select count(*)||'/'||(select next_order_number from organization_order_numbering) from orders where created_by='${portalActor}';
        rollback;`);
      const rows=result.split('\n');
      assert.match(rows[0],/TS-000001/);
      assert.deepEqual(rows.slice(1,5),['1/10.00/draft','1','1','1']);
      assert.equal(rows[5],rows[0],'replay must return original identity and number');
      assert.equal(rows[6],'1/2','one order and a single number allocation');
      assert.equal(snapshot(),retained);
    });
    await run("revoked Portal is denied and rolls back without partial orders", () => {
      expectDenied(`update customer_portal_access set is_active=false where user_id='${portalActor}';${as(portalActor,portalCall(902))}`,/portal_request_unauthorized/);
      expectDenied(`update customer_portal_access set is_active=false where user_id='${portalActor}';${fresh(id(927),portalActor)}select assert_order_financially_mutable('${id(927)}');`,/single active organization membership required/);
    });
    await run("missing entitlement and suspended tenant are denied", () => {
      expectDenied(`update organization_entitlements set enabled=false where organization_id='${org}';${as(portalActor,portalCall(903))}`,/portal_request_unauthorized/);
      expectDenied(`update organization_entitlements set enabled=false where organization_id='${org}';${fresh(id(928),portalActor)}select assert_order_financially_mutable('${id(928)}');`,/single active organization membership required/);
      expectDenied(`update organizations set platform_service_status='suspended' where id='${org}';${as(portalActor,portalCall(903))}`,/portal_request_unauthorized/);
    });
    await run("foreign-tenant property and fresh foreign/customer order are denied", () => {
      const foreignCustomer=id(920), foreignProperty=id(921), wrongCustomer=id(922), foreignLocation=id(925);
      const fixture=`insert into locations(id,organization_id,is_active) values('${foreignLocation}','${otherOrg}',true);insert into customers(id,organization_id,display_name,is_active) values('${foreignCustomer}','${otherOrg}','Synthetic foreign',true),('${wrongCustomer}','${org}','Synthetic other customer',true);
        insert into properties(id,organization_id,customer_id,is_active,address_line1,city,country_code) values('${foreignProperty}','${otherOrg}','${foreignCustomer}',true,'Synthetic','Synthetic','ES');`;
      expectDenied(`${fixture}${as(portalActor,portalCall(904).replace(property,foreignProperty))}`,/portal_request_invalid_property/);
      // Privileged fixture probes exercise the internal guard as well as RPC
      // authorization. Production clients cannot EXECUTE this helper directly.
      expectDenied(`${fixture}${fresh(id(923),portalActor,otherOrg,foreignCustomer,foreignLocation)}select assert_order_financially_mutable('${id(923)}');`,/single active organization membership required/);
      expectDenied(`${fixture}${fresh(id(924),portalActor,org,wrongCustomer)}select assert_order_financially_mutable('${id(924)}');`,/single active organization membership required/);
    });
    await run("Portal cannot mutate a completed creation even in its original transaction", () => {
      expectDenied(`${as(portalActor,portalCall(905))}reset role;
        select assert_order_financially_mutable(id) from orders where created_by='${portalActor}';`,/single active organization membership required/);
    });
    await run("Portal flags do not authorize old orders, direct writes or staff RPCs", () => {
      const oldOrder=id(101);
      expectDenied(`set request.jwt.claim.sub='${portalActor}';set app.order_create='on';set app.order_item_mutation='on';select assert_order_financially_mutable('${oldOrder}');`,/single active organization membership required/);
      expectDenied(as(portalActor,`set app.order_create='on';set app.order_item_mutation='on';update order_items set quantity=2;`),/permission denied/);
      expectDenied(as(portalActor,`select assert_order_financially_mutable('${oldOrder}');`),/permission denied/);
      expectDenied(as(portalActor,save(oldOrder)),/single active organization membership required/);
      expectDenied(as(portalActor,`select update_order_discount('${oldOrder}',1);`),/single active organization membership required/);
      expectDenied(as(portalActor,`select recalculate_order_totals('${oldOrder}');`),/permission denied/);
    });
    await run("Owner/Manager/Staff canonical item operations and role restrictions are preserved", () => {
      const oid=id(930);
      const result=sql(`begin;${fresh(oid)}${as(owner,save(oid))}reset role;
        ${as(manager,`select update_order_discount('${oid}',1);`)}reset role;
        ${as(staff,save(oid,service))}reset role;
        select total from orders where id='${oid}';
        ${as(owner,`select update_order_discount('${oid}',0);select remove_order_item(id,'${oid}') from order_items where order_id='${oid}';`)}reset role;
        select total from orders where id='${oid}';rollback;`);
      assert.ok(result.split('\n').includes('19.00'));
      assert.equal(result.split('\n').at(-1),'0.00');
      expectDenied(`${fresh(oid)}${as(staff,save(oid))}`,/staff items require a catalog service/);
      expectDenied(`${fresh(oid)}${as(staff,`select update_order_discount('${oid}',1);`)}`,/not authorized/);
      expectDenied(`${fresh(oid)}${as(foreign,save(oid))}`,/invalid order/);
    });
    await run("payment, active/historical Billing and issued REC still block Staff and Portal construction", () => {
      for(const actor of [owner,portalActor]) {
        const oid=id(940);
        const check=actor===owner ? as(owner,save(oid)) : `select assert_order_financially_mutable('${oid}');`;
        const probes=[
          [`insert into payments(organization_id,order_id,status,amount) values('${org}','${oid}','confirmed',5);`,/order_financial_payment_locked/],
          ...[true,false].map(active=>[`insert into invoice_orders(organization_id,order_id,invoice_id,billing_link_role,is_active) values('${org}','${oid}','${id(941)}','final',${active});`,/order_financial_document_locked/]),
          [`insert into operational_receipts(organization_id,order_id,document_status,snapshot) values('${org}','${oid}','issued','{}');`,/order_financial_document_locked/],
        ];
        for(const [fixture,error] of probes) expectDenied(`${fresh(oid,actor)}${fixture}${check}`,error);
      }
    });
    await run("pickup failure inside Portal RPC rolls back order, lines, history and number", () => {
      expectDenied(`alter table pickups add constraint synthetic_pickup_failure check (false) not valid;${as(portalActor,portalCall(906))}`,/23514[\s\S]*synthetic_pickup_failure/);
    });
    await run("two real Orders sessions serialize and lock timeout rolls back both probes", async () => {
      const oid=id(101);
      const child=spawn(command,args,{env,stdio:['pipe','pipe','pipe']});
      let stdout='',stderr='';
      child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
      const done=new Promise(resolve=>child.on('close',resolve));
      const ready=new Promise((resolve,reject)=>{
        child.on('error',reject);
        child.on('close',code=>{if(!stdout.includes('guard_lock_held'))reject(Error(stderr||`session closed ${code}`));});
        child.stdout.on('data',()=>{if(stdout.includes('guard_lock_held'))resolve();});
      });
      child.stdin.write(`begin;${as(owner,save(oid))}\n\\echo guard_lock_held\n`);
      try {
        await ready;
        denied(`begin;${as(manager,`set lock_timeout='200ms';${save(oid)}`)}`,/55P03.*canceling statement due to lock timeout/s);
        child.stdin.end('rollback;\n');
        assert.equal(await done,0,stderr);
      } finally {
        if(!child.stdin.writableEnded) child.stdin.end('rollback;\n');
        await done;
      }
      assert.equal(snapshot(),retained,'neither operator probe may persist rows or numbering');
    });
    if (resume === 'non_economic_boundary') {
      const oid=id(960);
      const setup=`${fresh(oid)}${as(owner,save(oid))}reset role;`;
      const paid=`insert into payments(organization_id,order_id,status,amount) values('${org}','${oid}','confirmed',5);`;
      await t.test("paid order: audit-only update passes trusted path; authenticated writes remain denied", () => {
        const result=sql(`begin;${setup}${paid}
          update order_items set updated_by='${manager}',updated_at=clock_timestamp() where order_id='${oid}';
          select updated_by||'/'||quantity||'/'||unit_price||'/'||line_total from order_items where order_id='${oid}';
          rollback;`);
        assert.equal(result.split('\n').at(-1),`${manager}/1.000/10.00/10.00`);
        expectDenied(`${setup}${paid}${as(owner,`update order_items set updated_at=clock_timestamp() where order_id='${oid}';`)}`,/permission denied/);
        expectDenied(`${setup}${paid}set app.order_item_mutation='off';update order_items set updated_by='${manager}' where order_id='${oid}';`,/order_items mutations require order item RPC/);
      });
      await t.test("paid order: economic/document fields, INSERT, DELETE, transfer and discount stay locked", () => {
        const changes=[
          'quantity=2,line_total=20',
          'unit_price=11,line_total=11',
          `service_id='${service}'`,
          "description='Changed economic description'",
          "unit_type='weight'",
          'is_active=false',
          'sort_order=2',
          "notes='Changed REC snapshot notes'",
          `order_id='${id(961)}'`,
        ];
        for (const change of changes) expectDenied(`${setup}${fresh(id(961))}${paid}update order_items set ${change} where order_id='${oid}';`,/order_financial_payment_locked/);
        expectDenied(`${setup}${paid}${as(owner,save(oid))}`,/order_financial_payment_locked/);
        expectDenied(`${setup}${paid}delete from order_items where order_id='${oid}';`,/order_financial_payment_locked/);
        expectDenied(`${setup}${paid}${as(manager,`select update_order_discount('${oid}',1);`)}`,/order_financial_payment_locked/);
      });
      await t.test("Billing/REC: service, description and REC notes stay immutable; audit metadata alone is allowed", () => {
        const docs=[
          `insert into invoice_orders(organization_id,order_id,invoice_id,billing_link_role,is_active) values('${org}','${oid}','${id(962)}','final',true);`,
          `insert into operational_receipts(organization_id,order_id,document_status,snapshot) values('${org}','${oid}','issued','{"immutable":true}');`,
        ];
        for(const fixture of docs) {
          for(const change of [`service_id='${service}'`,"description='Changed document description'","notes='Changed document notes'"])
            expectDenied(`${setup}${fixture}update order_items set ${change} where order_id='${oid}';`,/order_financial_document_locked/);
          const result=sql(`begin;${setup}${fixture}
            update order_items set updated_by='${manager}' where order_id='${oid}';
            select updated_by from order_items where order_id='${oid}';rollback;`);
          assert.equal(result.split('\n').at(-1),manager);
        }
      });
      await t.test("canonical pricing trigger reprices unchanged quantity before the financial guard", () => {
        const pricing=read('20260827000100_pricing_segments_001_segment_price_overrides.sql');
        const trigger=pricing.match(/create trigger order_items_resolve_effective_price[\s\S]*?execute function public\.enforce_effective_order_item_price\(\);/)[0];
        // Real pricing functions and trigger; only the segment tables/columns
        // absent from the retained partial schema are synthetic prerequisites.
        const prerequisites=`alter table customers add column catalog_segment_id uuid;
          alter table service_prices add column is_from boolean default false;
          create table catalog_segments(id uuid,organization_id uuid,name text,is_active boolean);
          create table catalog_segment_prices(id uuid,organization_id uuid,segment_id uuid,service_id uuid,location_id uuid,
            amount numeric,currency text,valid_from date,valid_to date,is_active boolean,created_at timestamptz);
          ${fn(pricing,'resolve_effective_service_price')}
          ${fn(pricing,'enforce_effective_order_item_price')}
          revoke all on function resolve_effective_service_price(uuid,uuid,uuid,uuid,date),enforce_effective_order_item_price() from public,anon,authenticated;
          ${trigger}`;
        const setupPrice=`${prerequisites}${fresh(oid)}${as(owner,save(oid,service))}reset role;${paid}
          update service_prices set amount=11 where service_id='${service}';`;
        expectDenied(`${setupPrice}update order_items set quantity=quantity where order_id='${oid}';`,/order_financial_payment_locked/);
        const after=sql(`begin;${setupPrice}
          update order_items set updated_by='${manager}' where order_id='${oid}';
          select unit_price||'/'||line_total from order_items where order_id='${oid}';rollback;`);
        assert.equal(after.split('\n').at(-1),'10.00/10.00','audit-only UPDATE must not trigger repricing');
      });
    }
    assert.equal(snapshot(),retained);
    return;
  }
  // Synthetic prerequisites only; Orders tables, constraints, RLS, triggers and
  // four mutator RPC bodies are loaded verbatim from the canonical migration.
  sql(`create schema auth;create schema extensions;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
    create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
    create type public.app_role as enum ('owner','manager','staff');
    create table public.organizations(id uuid primary key,status text,platform_service_status text,deleted_at timestamptz,
      timezone text default 'Atlantic/Canary',default_currency text default 'EUR');
    create table public.profiles(id uuid primary key);
    create table public.organization_memberships(organization_id uuid,profile_id uuid,is_active boolean,role public.app_role);
    create table public.customers(id uuid primary key,organization_id uuid,display_name text,email text,phone text,is_active boolean,
      unique(organization_id,id));
    create table public.locations(id uuid primary key,organization_id uuid,is_active boolean,deleted_at timestamptz,created_at timestamptz default now());
    create table public.properties(id uuid primary key,organization_id uuid,customer_id uuid,is_active boolean,address_line1 text,address_line2 text,
      city text,postal_code text,country_code text,contact_name text,contact_phone text,access_instructions text);
    create table public.customer_portal_access(id uuid primary key,user_id uuid,organization_id uuid,customer_id uuid,email text,is_active boolean,created_at timestamptz default now());
    create table public.platform_feature_catalog(feature_key text primary key);
    create table public.organization_entitlements(organization_id uuid,feature_key text,enabled boolean,valid_from timestamptz,valid_until timestamptz);
    ${read("20261023122144_security_f04_inactive_org_helpers_001a.sql")}
    ${fn(entitlementSql, "organization_entitlement_is_enabled")}
  `);
  sql(ordersSql);
  sql(catalogUnitsSql);
  sql(fn(read("20261023192656_security_d03_multicontext_suspension_001b.sql"), "app_current_organization_id"));
  sql(`alter table services add column portal_visible boolean default true,add column customer_orderable boolean default true,add column portal_category_key text default 'test';
    create table public.organization_portal_categories(organization_id uuid,category_key text,portal_visible boolean);
    create table public.organization_order_numbering(organization_id uuid primary key,order_prefix text,next_order_number bigint,updated_at timestamptz default now());
    ${fn(numberingSql, "allocate_order_reference")}
    create table public.pickups(id uuid primary key default gen_random_uuid(),organization_id uuid,order_id uuid,status text,scheduled_at timestamptz,
      assigned_to uuid,address_line1 text,address_line2 text,city text,postal_code text,country_code text,contact_name text,contact_phone text,
      notes text,fee numeric,created_by uuid,updated_by uuid);
    create table public.payments(id uuid primary key default gen_random_uuid(),organization_id uuid,order_id uuid,status text,amount numeric,
      refunded_from_payment_id uuid);
    create table public.invoice_orders(id uuid primary key default gen_random_uuid(),organization_id uuid,order_id uuid,invoice_id uuid,
      billing_link_role text,is_active boolean default true);
    create table public.operational_receipts(id uuid primary key default gen_random_uuid(),organization_id uuid,order_id uuid,document_status text,snapshot jsonb);
    ${fn(portalSql, "customer_portal_current_access")}
    ${fn(portalSql, "create_customer_portal_order_request_catalog_001")}
    ${fn(portalSql, "create_customer_portal_order_request")}
    revoke execute on all functions in schema public from public,anon,authenticated;
    grant execute on function public.is_organization_member(uuid),public.has_organization_role(uuid,public.app_role[]) to authenticated;
    grant execute on function public.save_order_item(uuid,uuid,uuid,text,public.service_unit_type,numeric,numeric,text),
      public.remove_order_item(uuid,uuid),public.update_order_discount(uuid,numeric),
      public.create_customer_portal_order_request(uuid,uuid,jsonb,timestamp,text) to authenticated;
    insert into organizations(id,status,platform_service_status) values('${org}','active','active'),('${otherOrg}','active','active');
    insert into profiles values('${owner}'),('${manager}'),('${staff}'),('${portalActor}'),('${foreign}');
    insert into organization_memberships values('${org}','${owner}',true,'owner'),('${org}','${manager}',true,'manager'),
      ('${org}','${staff}',true,'staff'),('${otherOrg}','${foreign}',true,'owner');
    insert into customers values('${customer}','${org}','Synthetic customer','synthetic@example.invalid','000',true);
    insert into locations(id,organization_id,is_active) values('${location}','${org}',true);
    insert into properties(id,organization_id,customer_id,is_active,address_line1,city,country_code)
      values('${property}','${org}','${customer}',true,'Synthetic address','Synthetic city','ES');
    insert into customer_portal_access(id,user_id,organization_id,customer_id,email,is_active)
      values('${id(24)}','${portalActor}','${org}','${customer}','synthetic@example.invalid',true);
    insert into platform_feature_catalog values('core.portal');
    insert into organization_entitlements values('${org}','core.portal',true,null,null);
    insert into organization_portal_categories values('${org}','test',true);
    insert into organization_order_numbering values('${org}','TS',1,now());
    insert into services(id,organization_id,name,unit_type,created_by,updated_by)
      values('${service}','${org}','Synthetic laundry','piece','${owner}','${owner}');
    insert into service_prices(organization_id,service_id,amount,valid_from,created_by,updated_by)
      values('${org}','${service}',10,current_date,'${owner}','${owner}');
  `);
  await t.test("baseline canonical Portal RPC creates an order for a Portal-only identity", () => {
    assert.equal(sql(`select count(*) from organization_memberships where profile_id='${portalActor}'`), "0");
    assert.match(sql(as(portalActor, portalCall(30))), /TS-000001/);
    assert.equal(sql("select count(*) from orders"), "1");
  });
  sql(migration);
  let counter = 100;
  const order = () => {
    const oid = id(++counter);
    sql(`set request.jwt.claim.sub='${owner}';set app.order_create='on';
      insert into orders(id,organization_id,customer_id,location_id,order_number,created_by,updated_by)
      values('${oid}','${org}','${customer}','${location}','TEST-${counter}','${owner}','${owner}');`);
    return oid;
  };
  const save = (oid, itemId = null, quantity = 1, sid = null) => `select public.save_order_item(${itemId ? `'${itemId}'` : 'null'},'${oid}',
    ${sid ? `'${sid}'` : 'null'},'Synthetic line','piece',${quantity},10,null);`;
  await t.test("Owner/Manager execute save, remove, discount and nested canonical recalc", () => {
    const oid = order();
    const first = sql(as(owner, save(oid)));
    sql(as(manager, save(oid,first,2)));
    sql(as(manager, `select public.update_order_discount('${oid}',1);`));
    assert.equal(sql(`select subtotal||'/'||discount_amount||'/'||total from orders where id='${oid}'`), "20.00/1.00/19.00");
    sql(as(owner,`select public.update_order_discount('${oid}',0);select public.remove_order_item('${first}','${oid}');`));
    assert.equal(sql(`select total from orders where id='${oid}'`), "0.00");
  });
  await t.test("Staff restrictions, foreign tenant and direct helper/RPC bypass remain denied", () => {
    const oid = order();
    denied(as(staff,save(oid)),/staff items require a catalog service/);
    const itemId = sql(as(staff,save(oid,null,1,service)));
    denied(as(staff,`select public.update_order_discount('${oid}',1);`),/not authorized/);
    denied(as(foreign,save(oid)),/invalid order/);
    denied(as(foreign,`select public.remove_order_item('${itemId}','${oid}');`),/invalid order/);
    denied(as(foreign,`select public.update_order_discount('${oid}',1);`),/invalid order/);
    denied(as(owner,`select public.recalculate_order_totals('${oid}');`),/permission denied/);
    denied(as(owner,`select public.assert_order_financially_mutable('${oid}');`),/permission denied/);
    denied(as(owner,`set app.order_item_mutation='on';update order_items set quantity=2,line_total=20 where id='${itemId}';`),/permission denied/);
  });
  await t.test("partial/full/refunded payment history blocks all three real mutation RPCs atomically", () => {
    for (const amount of [2,10]) {
      const oid=order(), itemId=sql(as(owner,save(oid)));
      const pid=id(++counter);
      sql(`insert into payments(id,organization_id,order_id,status,amount) values('${pid}','${org}','${oid}','confirmed',${amount});`);
      if(amount===10) sql(`insert into payments(organization_id,order_id,status,amount,refunded_from_payment_id) values('${org}','${oid}','refunded',10,'${pid}');`);
      const before=sql(`select to_jsonb(o) from orders o where id='${oid}'`);
      denied(as(owner,save(oid,itemId,2)),/order_financial_payment_locked/);
      denied(as(owner,`select public.remove_order_item('${itemId}','${oid}');`),/order_financial_payment_locked/);
      denied(as(owner,`select public.update_order_discount('${oid}',1);`),/order_financial_payment_locked/);
      assert.equal(sql(`select to_jsonb(o) from orders o where id='${oid}'`),before);
    }
  });
  await t.test("active/historical Billing links and active REC block; cancelled REC snapshot stays intact", () => {
    for(const active of [true,false]) {
      const oid=order(), itemId=sql(as(owner,save(oid)));
      sql(`insert into invoice_orders(organization_id,order_id,invoice_id,billing_link_role,is_active)
        values('${org}','${oid}','${id(++counter)}','final',${active});`);
      denied(as(owner,save(oid,itemId,2)),/order_financial_document_locked/);
    }
    for(const state of ['issued','cancelled']) {
      const oid=order(), itemId=sql(as(owner,save(oid)));
      sql(`insert into operational_receipts(organization_id,order_id,document_status,snapshot) values('${org}','${oid}','${state}','{"synthetic":true}');`);
      if(state==='issued') denied(as(owner,save(oid,itemId,2)),/order_financial_document_locked/);
      else sql(as(owner,save(oid,itemId,2)));
      assert.equal(sql(`select snapshot from operational_receipts where order_id='${oid}'`),'{"synthetic": true}');
    }
  });
  await t.test("two real mutation sessions serialize; lock timeout rolls back the second operator", async () => {
    const oid=order();
    const child=spawn(command,args,{env,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
    const done=new Promise(resolve=>child.on('close',resolve));
    const ready=new Promise((resolve,reject)=>{
      child.on('error',reject);child.on('close',code=>{if(!stdout.includes('guard_lock_held'))reject(Error(stderr||`session closed ${code}`));});
      child.stdout.on('data',()=>{if(stdout.includes('guard_lock_held'))resolve();});
    });
    child.stdin.write(`begin;${as(owner,save(oid))}\n\\echo guard_lock_held\n`);
    try {
      await ready;
      denied(as(manager,`set lock_timeout='200ms';${save(oid)}`),/55P03.*canceling statement due to lock timeout/s);
      child.stdin.end('commit;\n');
      assert.equal(await done,0,stderr);
      assert.equal(sql(`select count(*) from order_items where order_id='${oid}'`),'1');
      assert.equal(sql(`select total from orders where id='${oid}'`),'10.00');
    } finally {
      if(!child.stdin.writableEnded) child.stdin.end('rollback;\n');
      await done;
    }
  });
  // This is intentionally a positive regression assertion. If it fails, stop:
  // the patch must preserve Portal creation and cannot be changed in this phase.
  await t.test("Phase 2A preserves the same canonical Portal-only order creation", () => {
    const before=sql("select (select count(*) from orders)||'/'||(select count(*) from order_items)||'/'||(select count(*) from pickups)||'/'||(select next_order_number from organization_order_numbering)");
    const result=raw(as(portalActor,portalCall(31)));
    if(result.status!==0) {
      const after=sql("select (select count(*) from orders)||'/'||(select count(*) from order_items)||'/'||(select count(*) from pickups)||'/'||(select next_order_number from organization_order_numbering)");
      assert.equal(after,before,'failed Portal request must roll back all rows and numbering');
    }
    assert.equal(result.status,0,result.stderr);
  });
});
