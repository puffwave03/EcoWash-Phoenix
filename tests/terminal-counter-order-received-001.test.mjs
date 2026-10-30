import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261029224950_terminal_counter_order_received_001.sql');
const originalSource = read('supabase/migrations/20260928000200_production_default_assignee_001.sql');
const original = originalSource.slice(originalSource.indexOf('create or replace function public.submit_shop_terminal_order('));
const receiptStart = migration.indexOf('\n  -- Only this invocation');
const receiptEnd = migration.indexOf('\n  for payment', receiptStart);
const signature = 'public.submit_shop_terminal_order(uuid,uuid,uuid,timestamptz,text,text,jsonb,numeric,uuid,jsonb,text,text,uuid,boolean,timestamptz,uuid,text,text,text,text,text,text,text,text)';
const lab = '/Volumes/DEV/Phoenix-FINANCIAL-GUARD-2A-LOCAL';
const container = 'supabase_db_phoenix-financial-guard-2a-local-001';
const optIn = process.env.PHOENIX_TERMINAL_RECEIVED_LAB;
const quote = value => `'${String(value).replaceAll("'", "''")}'`;

test('only the new-submission receipt block changes; replay, pricing, POS and RPC privileges are preserved', () => {
  assert.ok(receiptStart > 0 && receiptEnd > receiptStart);
  const body = migration.slice(migration.indexOf('create or replace function'));
  const block = migration.slice(receiptStart, receiptEnd);
  assert.equal(body.replace(block, ''), original);
  assert.equal((migration.match(/create or replace function /g) ?? []).length, 1);
  assert.doesNotMatch(migration.replace(/^\s*--.*$/gm, ''), /\b(?:drop|truncate|alter table|grant|revoke)\b/i);
  assert.ok(migration.indexOf('if existing_submission.idempotency_key is not null') < receiptStart);
  assert.ok(migration.indexOf('public.create_or_update_delivery(') < receiptStart);
  assert.ok(receiptEnd < migration.indexOf('public.record_pos_payment('));
  assert.match(block, /assert_order_has_active_items/);
  assert.match(block, /pickup\.organization_id = org_id[\s\S]*pickup\.order_id = created_order\.id[\s\S]*'scheduled', 'in_progress'/);
  assert.doesNotMatch(block, /insert into public\.(?:order_storage|payments|invoices|operational_receipts)/);
});

// This harness reuses the canonical Supabase laboratory. Every runtime case
// applies the exact migration inside BEGIN ... ROLLBACK, including all synthetic
// fixture changes. No reset, new database, persisted migration or fixture cleanup.
test('canonical local Terminal receipt runtime', {
  skip: optIn ? false : 'EVIDENCE GAP: explicit isolated laboratory opt-in required',
  timeout: 180000,
}, async t => {
  assert.equal(optIn, lab);
  const inspected = spawnSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', container], { encoding: 'utf8' });
  assert.equal(inspected.status, 0, inspected.stderr);
  const bindings = JSON.parse(inspected.stdout)['5432/tcp'];
  assert.ok(bindings?.length);
  assert.ok(bindings.every(p => ['127.0.0.1', '::1'].includes(p.HostIp) && p.HostPort === '56322'));
  const args = ['exec', '-i', '--user', 'postgres', container, 'env',
    '-u', 'PGHOST', '-u', 'PGHOSTADDR', '-u', 'PGPORT', '-u', 'PGPASSWORD',
    '-u', 'PGSERVICE', '-u', 'PGSERVICEFILE', '-u', 'PGOPTIONS', '-u', 'PGPASSFILE',
    'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
  const sql = input => {
    const r = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 25000 });
    assert.ifError(r.error);
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const f = JSON.parse(readFileSync(`${lab}/runtime-evidence/fixture-manifest.json`, 'utf8'));
  for (const value of Object.values(f)) assert.match(value, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const { org, location, customer, service, till, owner, manager, staff, portal, admin } = f;
  assert.equal(sql("select current_database()||'/'||current_setting('server_version')||'/'||(select count(*) from supabase_migrations.schema_migrations)"), 'postgres/17.6/112');
  assert.equal(sql(`select slug from organizations where id='${org}'`), 'fg2a-canonical-runtime');
  const sourceBody = original.slice(original.indexOf('as $$') + 5, original.lastIndexOf('$$;'));
  assert.equal(sql(`select prosrc from pg_proc where oid=${quote(signature)}::regprocedure`).trim(), sourceBody.trim(), 'laboratory RPC differs from reviewed baseline');
  const foreignLocation = sql(`select id from locations where organization_id <> '${org}' and is_active order by id limit 1`);
  assert.match(foreignLocation, /^[0-9a-f-]{36}$/);
  const tables = sql("select schemaname||'.'||tablename from pg_tables where schemaname='public' or (schemaname='auth' and tablename in ('users','identities')) or schemaname='supabase_migrations' order by 1").split('\n');
  for (const table of tables) assert.match(table, /^[a-z_]+\.[a-z_0-9]+$/);
  const fingerprintSql = tables.map(table => `select '${table}:'||count(*)||':'||md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by to_jsonb(r)::text),'')) as fingerprint from ${table} r`).join(' union all ') + ' order by 1';
  const definitionsSql = "select md5(string_agg(oid::text||':'||prosrc||':'||coalesce(proacl::text,'')||':'||coalesce(proconfig::text,''),E'\\n' order by oid)) from pg_proc where pronamespace='public'::regnamespace";
  const preserved = sql(fingerprintSql), definitions = sql(definitionsSql);
  const asActor = actor => `reset role;set request.jwt.claim.sub='${actor}';set role authenticated;`;
  const check = (expression, label) => `do $check$ begin if (${expression}) is distinct from true then raise exception '%',${quote(label)};end if;end $check$;`;
  const denied = (query, state, message) => `do $denied$ begin begin ${query};raise exception 'expected rejection missing';exception when others then if sqlstate <> '${state}' or position(${quote(message)} in sqlerrm)=0 then raise;end if;end;end $denied$;`;
  const key = randomUUID();
  const foreignCustomer = randomUUID();
  const submit = (options = {}) => {
    const { amount = null, discount = 0, qty = 1, id = key, customerId = customer, locationId = location, delivery = false } = options;
    const payments = amount === null ? '[]' : JSON.stringify([{ amount, method: 'card', idempotencyKey: id }]);
    return `select * from public.submit_shop_terminal_order(
      target_idempotency_key=>'${id}',target_customer_id=>'${customerId}',target_location_id=>'${locationId}',
      target_due_at=>now()+interval '1 day',target_customer_notes=>'Synthetic counter receipt test',target_internal_notes=>null,
      target_items=>'[{"serviceId":"${service}","quantity":${qty}}]'::jsonb,target_discount_amount=>${discount},
      target_pos_session_id=>${amount === null ? 'null' : `'${till}'`},target_payments=>${quote(payments)}::jsonb,
      target_walk_in_name=>null,target_walk_in_phone=>null,target_production_assignee_id=>null,
      target_delivery_requested=>${delivery},target_delivery_scheduled_at=>${delivery ? "now()+interval '2 days'" : 'null'},
      target_delivery_assigned_to=>null,target_delivery_address_line1=>${delivery ? "'Synthetic address'" : 'null'},
      target_delivery_address_line2=>null,target_delivery_city=>null,target_delivery_postal_code=>null,
      target_delivery_country_code=>null,target_delivery_contact_name=>null,target_delivery_contact_phone=>null,target_delivery_notes=>null)`;
  };
  const setup = `
    set request.jwt.claim.sub='${admin}';set role authenticated;
    select platform_set_organization_entitlement('${org}','shop_terminal',true,null,null,null,'local_synthetic_test');
    select platform_set_organization_entitlement('${org}','printing',true,null,null,null,'local_synthetic_test');
    reset role;set request.jwt.claim.sub='${owner}';
    update organization_memberships set operational_capabilities=array['pos']::operational_capability[] where organization_id='${org}' and profile_id='${staff}';
    create temp table prior_data as ${fingerprintSql};
    ${asActor(owner)}
  `;
  const unchanged = `reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from prior_data p) = (select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'failed command left partial data')}`;
  const orderId = '(select order_id from result)';
  const received = `reset role;
    ${check(`(select production_status='received' and received_at=transaction_timestamp() and completed_at is null and cancelled_at is null from orders where id=${orderId})`, 'received state and timestamp')}
    ${check(`(select count(*)=2 and count(*) filter(where from_status is null and to_status='draft')=1 and count(*) filter(where from_status='draft' and to_status='received' and metadata->>'source'='shop_terminal')=1 from order_status_history where order_id=${orderId})`, 'exact draft and received history')}
    ${check(`(select count(*)=1 and bool_and(entered_at=transaction_timestamp()) from order_storage where order_id=${orderId})`, 'one trigger-created inbound placement')}
    ${check(`not exists(select 1 from invoice_orders where order_id=${orderId}) and not exists(select 1 from operational_receipts where order_id=${orderId})`, 'no automatic documents')}
  `;
  let failed = false;
  const run = async (name, body, beforeMigration = '') => {
    if (failed) { await t.test(name, { skip: 'stopped after earlier runtime failure' }, () => {}); return; }
    await t.test(name, () => {
      try {
        sql(`begin;set local lock_timeout='3s';set local statement_timeout='15s';${setup}${beforeMigration}
          reset role;${migration}${body}reset role;rollback;`);
      } catch (error) { failed = true; throw error; }
    });
  };
  try {
    await run('Owner paid checkout: quantities, discount, delivery, custody and payment; economic edits remain denied', `
      ${asActor(owner)}create temp table result as ${submit({ qty: 2, discount: 5, amount: 65, delivery: true })};${received}
      ${check(`(select subtotal=70 and discount_amount=5 and total=65 and paid=65 and outstanding=0 from result)`, 'exact totals')}
      ${check(`(select count(*)=1 and sum(quantity)=2 and sum(line_total)=70 from order_items where order_id=${orderId})`, 'canonical lines')}
      ${check(`(select count(*)=1 and sum(amount)=65 and bool_and(status='confirmed') from payments where order_id=${orderId})`, 'one confirmed payment')}
      ${check(`(select count(*)=1 and bool_and(status='scheduled') from deliveries where order_id=${orderId})`, 'scheduled delivery')}
      ${asActor(owner)}${denied(`perform save_order_item(null,${orderId},'${service}',null,'piece',1,35,null)`, '55000', 'order_financial_payment_locked')}
    `);
    await run('POS-only Staff pay-later intake works without production privilege; unpaid edits retain canonical permissions', `
      ${asActor(staff)}create temp table result as ${submit()};${received}
      ${check(`(select paid=0 and outstanding=35 from result) and not exists(select 1 from payments where order_id=${orderId})`, 'no fictitious payment')}
      ${asActor(staff)}${check(`not has_operational_capability('${org}','production')`, 'fixture must lack production')}
      ${denied(`perform transition_order_status(${orderId},'washing',null)`, 'P0001', 'not authorized')}
      select save_order_item((select id from order_items where order_id=${orderId}),${orderId},'${service}',null,'piece',2,35,null);
      ${check(`(select total=70 from orders where id=${orderId})`, 'unpaid order remains editable')}
    `);
    await run('missing POS capability and Portal identity are denied', `
      reset role;set request.jwt.claim.sub='${owner}';update organization_memberships set operational_capabilities='{}' where organization_id='${org}' and profile_id='${staff}';
      ${asActor(staff)}${denied(`perform * from (${submit()}) q`, '42501', 'pos_not_authorized')}
      ${asActor(portal)}${denied(`perform * from (${submit()}) q`, 'P0001', 'single active organization membership required')}
    `);
    await run('foreign customer and foreign location are denied without partial writes', `
      reset role;
      insert into customers(id,organization_id,customer_type,display_name,created_by,updated_by)
        select '${foreignCustomer}',organization_id,'individual','Synthetic foreign customer','${owner}','${owner}' from locations where id='${foreignLocation}';
      create temp table foreign_before as ${fingerprintSql};
      ${asActor(owner)}${denied(`perform * from (${submit({ locationId: foreignLocation })}) q`, '22023', 'order_location_invalid')}
      ${denied(`perform * from (${submit({ customerId: foreignCustomer })}) q`, '22023', 'shop_terminal_customer_invalid')}
      reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from foreign_before p)=(select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'foreign input rollback')}
    `);
    await run('missing default inbound rejects and rolls back order, lines, history, submission and counter', `
      reset role;set request.jwt.claim.sub='${owner}';update warehouse_positions set is_default_inbound=false where organization_id='${org}' and location_id='${location}';
      create temp table before_rejected as ${fingerprintSql};
      ${asActor(owner)}${denied(`perform * from (${submit({ amount: 35 })}) q`, '22023', 'warehouse_default_inbound_unavailable')}
      reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from before_rejected p)=(select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'inbound failure rollback')}
    `);
    await run('payment rejection after receipt rolls back custody and all prior writes', `
      ${asActor(staff)}${denied(`perform * from (${submit({ amount: 35 })}) q`, '42501', 'pos_session_not_assigned')}${unchanged}
    `);
    for (const status of ['scheduled', 'in_progress']) await run(`open inbound pickup (${status}) is blocked inside the actual Terminal RPC`, `
      reset role;
      -- Transaction-only fault injection: attach a synthetic pickup to the new
      -- order before receipt. The uncommitted order is otherwise unattachable
      -- from another session. No canonical function is replaced by this fixture.
      create function pg_temp.inject_counter_pickup() returns trigger language plpgsql as $inject$
      begin
        perform set_config('app.app_007_mutation','on',true);
        insert into pickups(organization_id,order_id,status,scheduled_at,address_line1,created_by,updated_by)
          values(new.organization_id,new.id,'${status}',now()+interval '1 day','Synthetic pickup',auth.uid(),auth.uid());
        return new;
      end $inject$;
      create trigger counter_test_pickup after insert on orders for each row execute function pg_temp.inject_counter_pickup();
      ${asActor(owner)}${denied(`perform * from (${submit()}) q`, 'P0001', 'inbound_pickup_incomplete')}${unchanged}
    `);
    await run('replay and status recovery retain one order/payment/history; later state is not rewritten', `
      ${asActor(owner)}create temp table result as ${submit({ amount: 35 })};${received}
      create temp table replay_before as ${fingerprintSql};
      ${asActor(owner)}create temp table replay as ${submit({ amount: 35 })};
      ${check('(select to_jsonb(r) from result r)=(select to_jsonb(r) from replay r)', 'same response')}
      ${check(`(select submission_status='completed' and order_id=${orderId} from get_shop_terminal_submission_status('${key}'))`, 'uncertain response recovery')}
      reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from replay_before p)=(select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'replay must not write')}
      ${asActor(owner)}select transition_order_status(${orderId},'on_hold','Synthetic hold');${submit({ amount: 35 })};
      ${check(`(select production_status='on_hold' from orders where id=${orderId})`, 'replay preserves later status')}
    `);
    await run('pre-migration historical draft replay retains exact response and all data', `
      ${asActor(owner)}create temp table replay as ${submit()};
      ${check('(select to_jsonb(r) from result r)=(select to_jsonb(r) from replay r)', 'legacy response')}
      ${check(`(select production_status='draft' and received_at is null from orders where id=${orderId})`, 'historical draft stays draft')}
      reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from legacy_before p)=(select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'historical replay unchanged')}
    `, `create temp table result as ${submit()};reset role;create temp table legacy_before as ${fingerprintSql};`);
    await run('generic Staff creation remains draft without custody', `
      ${asActor(staff)}create temp table generic as select * from create_order('${customer}',null,'${location}','normal',null,null,null);
      reset role;${check("(select production_status='draft' from orders where id=(select id from generic))", 'generic draft')}
      ${check('not exists(select 1 from order_storage where order_id=(select id from generic))', 'generic creation does not establish custody')}
    `);
    await run('Portal request remains draft with its scheduled pickup and no custody', `
      reset role;set request.jwt.claim.sub='${owner}';
      update services set portal_visible=true,customer_orderable=true,portal_category_key='counter_test' where id='${service}';
      insert into organization_portal_categories(organization_id,category_key,portal_visible) values('${org}','counter_test',true);
      create temp table property as with p as (
        insert into properties(organization_id,customer_id,name,address_line1,city,country_code,created_by,updated_by)
        values('${org}','${customer}','Synthetic property','Synthetic address','Synthetic city','ES','${owner}','${owner}') returning id) select id from p;
      grant select on property to authenticated;
      ${asActor(portal)}create temp table portal_order as select * from create_customer_portal_order_request('${randomUUID()}',(select id from property),
        '[{"service_id":"${service}","quantity":1}]'::jsonb,(now() at time zone 'Atlantic/Canary')+interval '1 day',null);
      reset role;${check("(select production_status='draft' and received_at is null from orders where id=(select id from portal_order))", 'Portal draft')}
      ${check("(select count(*)=1 and bool_and(status='scheduled') from pickups where order_id=(select id from portal_order)) and not exists(select 1 from order_storage where order_id=(select id from portal_order))", 'Portal keeps the inbound pickup workflow')}
    `);
    await run('Quick Drop retains its dedicated received intake and custody', `
      ${asActor(owner)}create temp table quick as select * from create_quick_drop_order('${randomUUID()}','${customer}','${location}',now()+interval '1 day','Synthetic Quick Drop',null,null);
      reset role;${check("(select production_status='received' from orders where id=(select order_id from quick)) and (select count(*)=1 from order_storage where order_id=(select order_id from quick))", 'Quick Drop custody')}
    `);
    await run('explicit Billing draft and REC preserve financial guards; no document is auto-issued', `
      ${asActor(manager)}create temp table result as ${submit()};${received}
      ${asActor(manager)}select create_billing_draft(array[${orderId}]::uuid[]);
      ${denied(`perform update_order_discount(${orderId},1)`, '55000', 'order_financial_document_locked')}
      ${check(`(select bool_and(i.document_status='draft') from invoices i join invoice_orders l on l.invoice_id=i.id where l.order_id=${orderId})`, 'Billing remains draft')}
      create temp table receipt_order as ${submit({ id: randomUUID() })};
      select * from issue_operational_receipt((select order_id from receipt_order));
      ${denied("perform update_order_discount((select order_id from receipt_order),1)", '55000', 'order_financial_document_locked')}
    `);
    await run('EXECUTE ACL, security definer and search_path are preserved', `
      reset role;${check(`(select prosecdef and proconfig=array['search_path=public'] and proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' from pg_proc where oid=${quote(signature)}::regprocedure)`, 'RPC security properties')}
      ${check(`not has_function_privilege('anon',${quote(signature)},'EXECUTE') and has_function_privilege('authenticated',${quote(signature)},'EXECUTE')`, 'EXECUTE privileges')}
    `);
  } finally {
    await t.test('all preserved laboratory rows, counters, function definitions and migration history are unchanged', () => {
      assert.equal(sql(fingerprintSql), preserved);
      assert.equal(sql(definitionsSql), definitions);
    });
  }
});
