import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261030135502_pos_advance_ux_001.sql');
const originalSource = read('supabase/migrations/20260928000200_production_default_assignee_001.sql');
const original = originalSource.slice(originalSource.indexOf('create or replace function public.submit_shop_terminal_order('));
const signature = 'public.submit_shop_terminal_order(uuid,uuid,uuid,timestamptz,text,text,jsonb,numeric,uuid,jsonb,text,text,uuid,boolean,timestamptz,uuid,text,text,text,text,text,text,text,text)';
const lab = '/Volumes/DEV/Phoenix-FINANCIAL-GUARD-2A-LOCAL';
const container = 'supabase_db_phoenix-financial-guard-2a-local-001';
const optIn = process.env.PHOENIX_POS_ADVANCE_LAB;
const quote = value => `'${String(value).replaceAll("'", "''")}'`;

import { terminal, nodes, content, button, labels, labelsFor, customer, service } from './helpers/shop-terminal-harness.mjs';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

const uiSource = read('src/components/shop-terminal/ShopTerminalWorkspace.tsx');
const uiAst = ts.createSourceFile('ui.tsx', uiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helperSource = uiAst.statements.filter(n => ts.isFunctionDeclaration(n) && ['paymentCents', 'isStoredPaymentAmount', 'parseStoredDraft'].includes(n.name?.text)).map(n => n.getText(uiAst)).join('\n');
const helpers = { exports: {} };
runInNewContext(ts.transpileModule(helperSource + '\nexports.paymentCents=paymentCents;exports.parseStoredDraft=parseStoredDraft;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: helpers.exports, parseDeliveryDraft: value => value });
const draft = (cash, card) => ({ cardReference: '', customerNotes: '', discount: 0, dueAt: '', internalNotes: '', items: [], delivery: {}, showSplitPayment: true, splitCash: cash, splitCard: card });
const ui = () => {
  const app = terminal();
  app.state.set('services', [{ ...service, amount: 35 }]);
  app.state.set('cart', [{ quantity: 1, service: { ...service, amount: 35 } }]);
  app.state.set('showSplitPayment', true);
  return app;
};
const enter = (app, method, value) => {
  const label = nodes(app.render()).find(n => n.type === 'label' && content(n).trim() === labels[method === 'cash' ? 'splitCash' : 'splitCard']);
  const input = nodes(label).find(n => n.type === 'input');
  assert.equal(input.props.type, 'text');
  const enterKey={key:'Enter',preventDefault(){this.prevented=true;}};
  input.props.onKeyDown(enterKey);assert.equal(enterKey.prevented,true);
  input.props.onChange({ target: { value } });
};
const prepare = (app, intent = 'split') => {
  const form = nodes(app.render()).find(n => n.type === 'form' && n.props.onSubmit?.name === 'prepareSubmission');
  const event = { nativeEvent: { submitter: { value: intent } }, preventDefault() { this.prevented = true; } };
  form.props.onSubmit(event);
  return { event, form, payload: app.state.get('attempt') ? JSON.parse(app.state.get('attempt').payload) : null };
};

test('editable amounts keep blank and intermediate decimal text; normalize only valid cents', () => {
  const app = ui();
  for (const value of ['1', '10', '', '0,', '0,1', '0,10', '12.']) {
    enter(app, 'cash', value);
    assert.equal(app.state.get('splitCash'), value);
  }
  for (const [value, expected] of [['', 0], ['10', 1000], ['15,20', 1520], ['.50', 50], ['12.', 1200], ['0.29', 29]]) assert.equal(helpers.exports.paymentCents(value), expected);
  for (const value of ['-1', 'NaN', 'Infinity', '1e2', '1.001', '1,2.3', '.', '10000000000']) assert.equal(helpers.exports.paymentCents(value), null);
});

for (const [cash, card, expected] of [['10', '', [10]], ['', '15', [15]], ['10', '15', [10, 15]], ['35', '', [35]], ['', '35', [35]], ['10', '25', [10, 25]], ['0,10', '0.20', [.1, .2]]]) {
  test(`custom checkout ${cash || 0} cash + ${card || 0} card: exact payload and remaining balance`, () => {
    const app = ui(); enter(app, 'cash', cash); enter(app, 'card', card);
    const tree = app.render();
    assert.equal(button(tree, labels.confirmSplit).props.disabled, false);
    const planned = nodes(tree).find(n => n.type === 'div' && nodes(n).filter(c => c.type === 'dt').length === 1 && nodes(n).some(c => c.type === 'dt' && content(c) === labels.expectedPaid));
    assert.equal(content(nodes(planned).find(n => n.type === 'dd')), String(Math.round(expected.reduce((a,b)=>a+b,0)*100)/100));
    const balance = nodes(tree).find(n => n.type === 'div' && nodes(n).filter(c => c.type === 'dt').length === 1 && nodes(n).some(c => c.type === 'dt' && content(c) === labels.expectedOutstanding));
    assert.equal(Number(content(nodes(balance).find(n => n.type === 'dd'))), Math.round((35-expected.reduce((a,b)=>a+b,0))*100)/100);
    const result = prepare(app);
    assert.ok(!result.event.prevented);
    assert.deepEqual(result.payload.payments.map(p => p.amount), expected);
    assert.deepEqual(result.payload.payments.map(p => p.method), [cash && Number(cash.replace(',','.')) > 0 ? 'cash' : null, card && Number(card.replace(',','.')) > 0 ? 'card' : null].filter(Boolean));
    assert.equal(new Set(result.payload.payments.map(p => p.idempotencyKey)).size, expected.length);
  });
}

test('invalid, zero-only and excessive amounts cannot submit; pay later creates no payment', () => {
  for (const [cash, card] of [['', ''], ['-1',''], ['1.001',''], ['NaN',''], ['20','16']]) {
    const app = ui();enter(app,'cash',cash);enter(app,'card',card);
    assert.equal(button(app.render(),labels.confirmSplit).props.disabled,true);
    assert.equal(prepare(app).event.prevented,true);
    assert.equal(app.state.get('attempt'),null);
  }
  const app=ui(); enter(app,'cash','bad');
  const result=prepare(app,'later');
  assert.ok(!result.event.prevented);assert.deepEqual(result.payload.payments,[]);assert.equal(result.payload.sessionId,null);
  const noTill=ui();noTill.props.session=null;enter(noTill,'cash','10');assert.equal(prepare(noTill).event.prevented,true);
});

test('legacy numeric drafts and raw text drafts persist independently in all five workspaces', async () => {
  assert.equal(helpers.exports.parseStoredDraft(draft(10,15)).splitCash,10);
  assert.equal(helpers.exports.parseStoredDraft(draft('10,','')).splitCash,'10,');
  assert.equal(helpers.exports.parseStoredDraft(draft(-1,0)),null);
  const storageValues=new Map();
  for(let workspace=1;workspace<=5;workspace++){
    const app=terminal({workspace,storageValues});app.state.set('splitCash',`${workspace},`);app.state.set('splitCard','');
    app.render();app.runEffect('customerDraftsRef.current.set');
  }
  for(let workspace=1;workspace<=5;workspace++){
    const stored=JSON.parse(storageValues.get(`diagnostic:${workspace}:drafts`))[0][1];
    assert.equal(helpers.exports.parseStoredDraft(stored).splitCash,`${workspace},`);
    assert.equal(stored.splitCard,'');
    // Reload through the real hydration/customer-selection path. Include an
    // older numeric draft alongside new drafts with an unfinished separator.
    if(workspace===1){stored.splitCash=10;stored.splitCard=15;storageValues.set(`diagnostic:${workspace}:drafts`,JSON.stringify([[customer.id,stored]]));}
    storageValues.set(`diagnostic:${workspace}:customer`,JSON.stringify(customer));
    const restored=terminal({workspace,storageValues,refreshing:true});
    restored.props.actions.loadServices=async()=>({services:[service],segmentName:null});
    restored.render();restored.runEffect('hydrateCustomerDrafts()');restored.flushTimers();
    await new Promise(setImmediate);
    assert.equal(restored.state.get('draftHydration'),'ready');
    assert.equal(restored.state.get('splitCash'),workspace===1?'10':`${workspace},`);
    assert.equal(restored.state.get('splitCard'),workspace===1?'15':'');
  }
});

test('uncertain response retries the identical mixed payload, with unchanged order/payment keys',async()=>{
  const app=ui();enter(app,'cash','10');enter(app,'card','15');
  const first=prepare(app);const frozen=app.state.get('attempt').payload;
  const pending=first.form.props.action(new Map());
  const duplicate={nativeEvent:{submitter:{value:'split'}},preventDefault(){this.prevented=true;}};
  first.form.props.onSubmit(duplicate);assert.equal(duplicate.prevented,true);
  app.response.resolve({error:'unknown',result:null});await pending;
  app.state.set('recoveryStatus','not_found');
  const retry=button(app.render(),labels.submissionRetry);assert.ok(retry);
  await retry.props.onClick();
  assert.deepEqual(app.calls.submit,[frozen,frozen]);
});

test('five locales explain custom collection, balance and full-payment shortcuts',()=>{
  for(const locale of ['it','es','en','fr','de'])for(const key of ['expectedPaid','expectedOutstanding','paymentInputError','confirmSplit','splitPayment','paymentCash','paymentCard'])assert.ok(labelsFor(locale)[key]?.length>3,`${locale}/${key}`);
});

test('migration changes only Terminal payment acceptance; custody, replay, pricing and ACL are retained',()=>{
  const canonical=read('supabase/migrations/20261029224950_terminal_counter_order_received_001.sql');
  const body=s=>s.slice(s.indexOf('create or replace function'));
  const withoutPayments=s=>s.slice(0,s.indexOf('\n  for payment'))+s.slice(s.indexOf('\n    for payment in select value from jsonb_array_elements(target_payments)'));
  assert.equal(withoutPayments(body(migration)),withoutPayments(body(canonical)));
  assert.equal((migration.match(/create or replace function/g)||[]).length,1);
  assert.doesNotMatch(migration.replace(/^\s*--.*$/gm,''),/\b(?:drop|truncate|alter table|grant|revoke)\b/i);
});

// This harness reuses the canonical Supabase laboratory. Every runtime case
// applies the exact migration inside BEGIN ... ROLLBACK, including all synthetic
// fixture changes. No reset, new database, persisted migration or fixture cleanup.
test('canonical local partial and mixed Terminal payments', {
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
    const { payments: entries = [], sessionId = till, discount = 0, qty = 1, id = key, customerId = customer, locationId = location, delivery = false } = options;
    const payments = JSON.stringify(entries);
    return `select * from public.submit_shop_terminal_order(
      target_idempotency_key=>'${id}',target_customer_id=>'${customerId}',target_location_id=>'${locationId}',
      target_due_at=>now()+interval '1 day',target_customer_notes=>'Synthetic counter receipt test',target_internal_notes=>null,
      target_items=>'[{"serviceId":"${service}","quantity":${qty}}]'::jsonb,target_discount_amount=>${discount},
      target_pos_session_id=>${entries.length && sessionId ? `'${sessionId}'` : 'null'},target_payments=>${quote(payments)}::jsonb,
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
  const pay = (amount, method='cash', idempotencyKey=randomUUID()) => ({amount,method,idempotencyKey});
  try {
    for (const [name, entries, paid] of [
      ['pay later',[],0], ['partial cash',[pay(10)],10], ['partial card',[pay(15,'card')],15],
      ['mixed partial',[pay(10),pay(15,'card')],25], ['full cash',[pay(35)],35],
      ['full card',[pay(35,'card')],35], ['full mixed',[pay(10),pay(25,'card')],35],
      ['canonical per-payment rounding',[pay(.105),pay(.205,'card')],.32],
    ]) await run(`${name}: exact real payments, received, custody and outstanding`, `
      ${asActor(owner)}create temp table result as ${submit({payments:entries})};${received}
      ${check(`(select total=35 and paid=${paid} and outstanding=35-${paid} from result)`, 'exact collection and outstanding')}
      ${check(`(select count(*)=${entries.length} and coalesce(sum(amount),0)=${paid} from payments where order_id=${orderId})`, 'exact ledger count and sum')}
      ${check(`not exists(select 1 from payments where order_id=${orderId} and (status<>'confirmed' or channel<>'pos' or pos_session_id<>'${till}' or organization_id<>'${org}'))`, 'canonical payment metadata')}
      ${entries.length ? `${asActor(owner)}${denied(`perform update_order_discount(${orderId},1)`, '55000', 'order_financial_payment_locked')}` : ''}
    `);
    await run('Manager and POS Staff retain authorized partial collection; Staff uses own till', `
      ${asActor(manager)}create temp table result as ${submit({payments:[pay(10)]})};${received}
      reset role;select set_config('app.pos_001_mutation','on',true);update pos_sessions set opened_by='${staff}' where id='${till}';
      ${asActor(staff)}create temp table staff_result as ${submit({id:randomUUID(),payments:[pay(15,'card')]})};
      ${check('(select paid=15 and outstanding=20 from staff_result)', 'staff partial payment')}
    `);
    await run('invalid amounts, methods, duplicate keys and excess are rejected atomically', `
      ${asActor(owner)}
      ${[0,-1,'NaN','Infinity',.001].map(amount=>denied(`perform * from (${submit({payments:[pay(amount)]})}) q`,'22023','shop_terminal_payment_invalid')).join('\n')}
      ${denied(`perform * from (${submit({payments:[pay(1,null)]})}) q`,'22023','shop_terminal_payment_invalid')}
      ${denied(`perform * from (${submit({payments:[pay(20),pay(16,'card')]})}) q`,'22023','shop_terminal_payment_total_mismatch')}
      ${denied(`perform * from (${submit({payments:[pay(1,'cash',key),pay(1,'card',key)]})}) q`,'22023','shop_terminal_payment_invalid')}
      ${denied(`perform * from (${submit({payments:[pay(1),pay(1),pay(1)]})}) q`,'22023','shop_terminal_submission_invalid')}
      ${unchanged}
    `);
    await run('closed, missing and unknown till, missing capability and Portal are denied', `
      ${asActor(owner)}${denied(`perform * from (${submit({payments:[pay(10)],sessionId:null})}) q`,'22023','shop_terminal_payment_total_mismatch')}
      ${denied(`perform * from (${submit({payments:[pay(10)],sessionId:randomUUID()})}) q`,'55000','pos_session_not_open')}
      ${asActor(staff)}${denied(`perform * from (${submit({payments:[pay(10)]})}) q`,'42501','pos_session_not_assigned')}
      ${asActor(owner)}select close_pos_session('${till}',0,'Synthetic test close');
      ${denied(`perform * from (${submit({payments:[pay(10)]})}) q`,'55000','pos_session_not_open')}
      reset role;set request.jwt.claim.sub='${owner}';update organization_memberships set operational_capabilities='{}' where organization_id='${org}' and profile_id='${staff}';
      ${asActor(staff)}${denied(`perform * from (${submit({payments:[pay(10)]})}) q`,'42501','pos_not_authorized')}
      ${asActor(portal)}${denied(`perform * from (${submit({payments:[pay(10)]})}) q`,'P0001','single active organization membership required')}
    `);
    await run('foreign customer/location and disabled Terminal entitlement are denied', `
      reset role;
      insert into customers(id,organization_id,customer_type,display_name,created_by,updated_by)
        select '${foreignCustomer}',organization_id,'individual','Synthetic foreign customer','${owner}','${owner}' from locations where id='${foreignLocation}';
      ${asActor(owner)}${denied(`perform * from (${submit({payments:[pay(10)],locationId:foreignLocation})}) q`,'22023','order_location_invalid')}
      ${denied(`perform * from (${submit({payments:[pay(10)],customerId:foreignCustomer})}) q`,'22023','shop_terminal_customer_invalid')}
      ${asActor(admin)}select platform_set_organization_entitlement('${org}','shop_terminal',false,null,null,null,'local_synthetic_test');
      ${asActor(owner)}${denied(`perform * from (${submit({payments:[pay(10)]})}) q`,'42501','shop_terminal_entitlement_required')}
    `);
    const entries=[pay(10),pay(15,'card')];
    await run('mixed replay, uncertain-response lookup and changed-payload conflict keep one order and two payments', `
      ${asActor(owner)}create temp table result as ${submit({payments:entries})};${received}
      create temp table replay_before as ${fingerprintSql};
      ${asActor(owner)}create temp table replay as ${submit({payments:entries})};
      ${check('(select to_jsonb(r) from result r)=(select to_jsonb(r) from replay r)', 'identical response')}
      ${check(`(select submission_status='completed' and order_id=${orderId} from get_shop_terminal_submission_status('${key}'))`, 'uncertain-response lookup')}
      ${denied(`perform * from (${submit({payments:[{...entries[0],amount:11},entries[1]]})}) q`,'23505','shop_terminal_idempotency_conflict')}
      reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from replay_before p)=(select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'replay and conflict never write')}
    `);
    await run('second payment idempotency conflict rolls back first payment, order, custody and counter', `
      ${asActor(owner)}create temp table existing_order as ${submit({id:randomUUID(),payments:entries})};
      reset role;create temp table before_failure as ${fingerprintSql};
      ${asActor(owner)}${denied(`perform * from (${submit({payments:[pay(10),pay(15,'card',entries[1].idempotencyKey)]})}) q`,'23505','pos_idempotency_conflict')}
      reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from before_failure p)=(select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'second payment failure left no partial writes')}
    `);
    await run('remaining balance uses canonical POS; operational receipt remains the issued snapshot', `
      ${asActor(owner)}create temp table result as ${submit({payments:entries})};${received}
      ${asActor(owner)}select * from issue_operational_receipt(${orderId});
      reset role;create temp table receipt_before as select to_jsonb(r) as snapshot from operational_receipts r where order_id=${orderId};
      ${asActor(owner)}select record_pos_payment(${orderId},10,'card','${till}',null,null,'${randomUUID()}');
      create temp table replay as ${submit({payments:entries})};
      ${check('(select paid=35 and outstanding=0 from replay)', 'canonical final balance')}
      ${check(`(select count(*)=3 and sum(amount)=35 from payments where order_id=${orderId})`, 'three real installments')}
      reset role;${check(`(select snapshot from receipt_before)=(select to_jsonb(r) from operational_receipts r where order_id=${orderId})`, 'receipt snapshot unchanged')}
      ${check(`not exists(select 1 from invoice_orders where order_id=${orderId})`, 'no automatic Billing')}
    `);
    await run('missing inbound rolls back partial checkout', `
      reset role;set request.jwt.claim.sub='${owner}';update warehouse_positions set is_default_inbound=false where organization_id='${org}' and location_id='${location}';
      create temp table before_inbound as ${fingerprintSql};
      ${asActor(owner)}${denied(`perform * from (${submit({payments:entries})}) q`,'22023','warehouse_default_inbound_unavailable')}
      reset role;${check(`(select array_agg(p.fingerprint order by p.fingerprint) from before_inbound p)=(select array_agg(p.fingerprint order by p.fingerprint) from (${fingerprintSql}) p)`, 'inbound rejection rollback')}
    `);
    await run('RPC privileges, owner and search path remain canonical', `
      reset role;${check(`(select prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=public'] and proacl::text='{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' from pg_proc where oid=${quote(signature)}::regprocedure)`, 'RPC properties')}
      ${check(`not has_function_privilege('anon',${quote(signature)},'EXECUTE') and has_function_privilege('authenticated',${quote(signature)},'EXECUTE')`, 'EXECUTE privileges')}
    `);
  } finally {
    await t.test('preserved rows, counters, function definitions and migration history unchanged after rollback', () => {
      assert.equal(sql(fingerprintSql),preserved);
      assert.equal(sql(definitionsSql),definitions);
    });
  }
});
