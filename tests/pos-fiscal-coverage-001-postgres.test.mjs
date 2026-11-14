import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
const database = process.env.PHOENIX_FISCAL_COVERAGE_DATABASE;
const container = 'supabase_db_phoenix-canonical-local-001';
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const args = () => ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
function query(sql) {
  const r = spawnSync('docker', args(), { input: sql, encoding: 'utf8', timeout: 20000 });
  if (r.error) throw r.error;
  if (r.status) throw Error(r.stderr);
  return r.stdout.trim().split('\n').filter(Boolean);
}
const identities = Object.fromEntries(['org', 'orgB', 'owner', 'manager', 'staff', 'other', 'location', 'service', 'customer', 'business', 'inbound', 'ready'].map(key => [key, randomUUID()]));
const auth = (sql, actor = identities.owner) => `begin; set local role authenticated; set local request.jwt.claim.sub=${quote(actor)}; set local request.jwt.claims=${quote(JSON.stringify({ sub: actor, role: 'authenticated' }))}; set local statement_timeout='12s'; ${sql}; commit;`;
let session;
function intake(amount = 9, customer = identities.customer, customerNotes = null, method = 'cash') {
  const sql = `select row_to_json(x) from public.submit_shop_terminal_order(
    target_idempotency_key=>${quote(randomUUID())},target_customer_id=>${quote(customer)},target_location_id=>${quote(identities.location)},
    target_due_at=>now()+interval '1 day',target_customer_notes=>${customerNotes === null ? 'null' : quote(customerNotes)},target_internal_notes=>'PRIVATE SYNTHETIC NOTES',
    target_items=>${quote(JSON.stringify([{ serviceId: identities.service, quantity: 2 }]))}::jsonb,target_discount_amount=>0,
    target_pos_session_id=>${quote(session)},target_payments=>${quote(JSON.stringify(amount ? [{ amount, method, idempotencyKey: randomUUID() }] : []))}::jsonb,
    target_walk_in_name=>null,target_walk_in_phone=>null,target_production_assignee_id=>null,target_delivery_requested=>false,
    target_delivery_scheduled_at=>null,target_delivery_assigned_to=>null,target_delivery_address_line1=>null,target_delivery_address_line2=>null,
    target_delivery_city=>null,target_delivery_postal_code=>null,target_delivery_country_code=>null,target_delivery_contact_name=>null,
    target_delivery_contact_phone=>null,target_delivery_notes=>null) x`;
  const order = JSON.parse(query(auth(sql)).at(-1));
  const payment = query(`select id from public.payments where order_id=${quote(order.order_id)}`).at(-1);
  return { ...order, payment };
}
const issue = (order, recipient = 'consumer') => `select row_to_json(x) from public.issue_billing_full_prepayment_ticket(${quote(order.order_id)},${quote(order.payment)},${quote(recipient)},true,true) x`;
const fingerprint = order => query(`select md5(coalesce(string_agg(row_to_json(p)::text,',' order by p.id),'')) from public.payments p where order_id=${quote(order.order_id)}`).at(-1);
function rejected(sql, pattern, actor) { assert.throws(() => query(auth(sql, actor)), pattern); }
async function concurrent(sql) {
  const proc = spawn('docker', args(), { stdio: ['pipe', 'pipe', 'pipe'] }); let out = ''; let err = '';
  proc.stdout.on('data', b => { out += b; }); proc.stderr.on('data', b => { err += b; }); proc.stdin.end(sql);
  const [code] = await once(proc, 'close'); if (code) throw Error(err); return out.trim();
}


test('Fiscal coverage and atomic service evidence — isolated canonical fixture', { skip: !database }, async t => {
  assert.equal(database,'phoenix_fiscal_coverage_20261114');
  const historic=query(`select md5(jsonb_agg(to_jsonb(i) order by id)::text) from public.invoices i`).at(-1);
  const ordinary=query(`select md5(pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure))`).at(-1);
  query(`begin;
    insert into public.organizations(id,name,slug,default_currency,timezone) values
      (${quote(identities.org)},'SYNTHETIC FISCAL TICKET',${quote(`synthetic-${identities.org}`)},'EUR','Atlantic/Canary'),
      (${quote(identities.orgB)},'SYNTHETIC OTHER TENANT',${quote(`synthetic-${identities.orgB}`)},'EUR','Atlantic/Canary');
    insert into auth.users(id,email,raw_user_meta_data) values ${['owner','manager','staff','other'].map(key => `(${quote(identities[key])},${quote(`synthetic-${identities[key]}@example.invalid`)},'{"display_name":"SYNTHETIC ONLY"}')`).join(',')};
    insert into public.organization_memberships(organization_id,profile_id,role) values
      (${quote(identities.org)},${quote(identities.owner)},'owner'),(${quote(identities.org)},${quote(identities.manager)},'manager'),
      (${quote(identities.org)},${quote(identities.staff)},'staff'),(${quote(identities.orgB)},${quote(identities.other)},'owner');
    insert into public.platform_feature_catalog(feature_key,category,description) values
      ('billing.invoicing','billing','Synthetic Billing'),('pos','commerce','Synthetic POS'),('shop_terminal','commerce','Synthetic intake'),('printing','operations','Synthetic printing') on conflict do nothing;
    insert into public.organization_entitlements(organization_id,feature_key,enabled,source)
      select ${quote(identities.org)}::uuid,feature_key,true,'synthetic_test' from public.platform_feature_catalog;
    insert into public.organization_entitlements(organization_id,feature_key,enabled,source)
      values(${quote(identities.orgB)},'billing.invoicing',true,'synthetic_test');
    insert into public.locations(id,organization_id,name) values(${quote(identities.location)},${quote(identities.org)},'SYNTHETIC SITE');
    insert into public.organization_order_numbering(organization_id,order_prefix,next_order_number)
      values(${quote(identities.org)},'EW',1);
    insert into public.warehouse_positions(id,organization_id,location_id,code,position_type,is_default_inbound) values
      (${quote(identities.inbound)},${quote(identities.org)},${quote(identities.location)},'INBOUND','shelf',true),
      (${quote(identities.ready)},${quote(identities.org)},${quote(identities.location)},'READY','shelf',false);
    insert into public.customers(id,organization_id,customer_type,display_name,company_name,tax_id,billing_address_line1,billing_city,billing_postal_code,billing_country_code) values
      (${quote(identities.customer)},${quote(identities.org)},'individual','SYNTHETIC CUSTOMER',null,'TEST-CUSTOMER','Test street','Test city','00000','ES'),
      (${quote(identities.business)},${quote(identities.org)},'business','SYNTHETIC BUSINESS','SYNTHETIC COMPANY','TEST-BUSINESS','Test street','Test city','00000','ES');
    insert into public.services(id,organization_id,name,unit_type) values(${quote(identities.service)},${quote(identities.org)},'Synthetic shirt','piece');
    insert into public.service_prices(organization_id,service_id,amount,currency,valid_from) values(${quote(identities.org)},${quote(identities.service)},10.50,'EUR',current_date-1);
    insert into public.organization_billing_settings(organization_id,issuer_legal_name,issuer_tax_id,issuer_address_line1,issuer_city,issuer_postal_code,issuer_country_code,default_series,default_tax_rate,fiscal_territory_code,declared_tax_regime_code,simplified_invoicing_enabled,simplified_series)
      values(${quote(identities.org)},'SYNTHETIC LAUNDRY — NOT REAL','TEST-ISSUER','Test road','Test city','00000','ES','A',7,'ES-CN','IGIC-GENERAL',true,'S');
    commit;`);
  session = query(auth(`select public.open_pos_session(${quote(identities.location)},0,'SYNTHETIC ONLY')`)).at(-1);


  const today=query(`select (now() at time zone 'Atlantic/Canary')::date`).at(-1);
  const yesterday=query(`select (now() at time zone 'Atlantic/Canary')::date-1`).at(-1);
  const read=(ids,actor)=>JSON.parse(query(auth(`select public.get_pos_fiscal_coverage(array[${ids.map(quote).join(',')}]::uuid[])`,actor)).at(-1));
  const pay=(o,amount,key=randomUUID())=>query(auth(`select public.record_pos_payment(${quote(o.order_id)},${amount},'cash',${quote(session)},null,null,${quote(key)})`)).at(-1);
  const capture=(o,amount,key=randomUUID(),day=today)=>`select public.record_pos_payment_with_service_evidence(${quote(o.order_id)},${amount},'cash',${quote(session)},null,null,${quote(key)},${quote(day)}::date,true)`;
  const issueDoc=(o,p=o.payment,event='advance',day=null)=>JSON.parse(query(auth(`select row_to_json(x) from public.issue_pos_billing_payment_document(${quote(o.order_id)},${quote(p)},${quote(event)},'consumer',true,true,${day===null?'null':quote(day)}::date) x`)).at(-1));
  const complete=o=>query(auth(`select public.transition_order_status(${quote(o.order_id)},'washing',null);select public.transition_order_status(${quote(o.order_id)},'quality_check',null);select public.transition_order_status(${quote(o.order_id)},'packing',null);select public.transition_order_ready_with_storage(${quote(o.order_id)},${quote(identities.ready)},1,'folded')`));
  const first=intake(5);
  await t.test('coverage read defaults disabled, classifies unlinked payment as pending without financial writes',()=>{
    const before=fingerprint(first),a=read([first.payment]);assert.equal(a.enabled,false);assert.equal(a.payments[0].status,'issuance_pending');assert.equal(a.payments[0].document,null);assert.equal(fingerprint(first),before);
    assert.deepEqual(read([]).payments,[]);
    const o=intake(0);rejected(`select public.record_pos_payment(${quote(o.order_id)},21,'card',null,null,null,${quote(randomUUID())},'manual',null,'recorded_manual')`,/pos_session_not_open/);assert.equal(query(`select count(*) from public.payments where order_id=${quote(o.order_id)}`).at(-1),'0');assert.equal(a.payments[0].currency,'EUR');
  });
  await t.test('new evidence cannot be captured with the default-off flag',()=>{
    const o=intake(0);complete(o);rejected(capture(o,21),/pos_coverage_disabled/);
    assert.equal(query(`select count(*) from public.payments where order_id=${quote(o.order_id)}`).at(-1),'0');
    query(`update public.organization_billing_settings set pos_billing_payment_link_enabled=true where organization_id=${quote(identities.org)}`);
  });
  await t.test('5 + 16: two attributed documents, same order, immutable advance and rounding unchanged',()=>{
    const advance=issueDoc(first);const frozen=query(`select row_to_json(i)::text from public.invoices i where id=${quote(advance.invoice_id)}`).at(-1);
    const balance=pay(first,16);issueDoc(first,balance,'final',today);
    const rows=read([first.payment,balance]).payments;assert.equal(rows.length,2);assert.ok(rows.every(p=>p.status==='document_issued'));assert.deepEqual(rows.map(p=>p.amount),[5,16]);assert.ok(rows.every(p=>p.orderId===first.order_id));
    assert.equal(query(`select row_to_json(i)::text from public.invoices i where id=${quote(advance.invoice_id)}`).at(-1),frozen);
    assert.equal(query(`select sum(tax_total) from public.invoices where organization_id=${quote(identities.org)} and id in(select invoice_id from public.billing_invoice_payment_links where order_id=${quote(first.order_id)})`).at(-1),'1.38');
  });
  await t.test('immediate full payment and repeated coverage reads create no new payment, invoice or number',()=>{
    const o=intake(21);issueDoc(o);const before=fingerprint(o);const counters=query(`select jsonb_agg(to_jsonb(c) order by series) from public.billing_invoice_number_counters c where organization_id=${quote(identities.org)}`).at(-1);
    for(let n=0;n<3;n++)assert.equal(read([o.payment]).payments[0].status,'document_issued');
    assert.equal(fingerprint(o),before);assert.equal(query(`select jsonb_agg(to_jsonb(c) order by series) from public.billing_invoice_number_counters c where organization_id=${quote(identities.org)}`).at(-1),counters);
  });
  await t.test('existing ordinary invoice without payment attribution requires review and never triggers another invoice',()=>{
    const o=intake(21);const d=query(auth(`select public.create_billing_draft(array[${quote(o.order_id)}::uuid],'A',7,null)`)).at(-1);
    query(auth(`select public.issue_billing_invoice(${quote(d)})`));
    const p=read([o.payment]).payments[0];assert.equal(p.status,'review_required');assert.equal(p.reason,'existing_document_requires_attribution');assert.equal(p.document,null);
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(o.order_id)}`).at(-1),'1');
    // Fixture establishes an explicit canonical attribution; the reader must not infer it.
    query(`begin;set local request.jwt.claim.sub=${quote(identities.owner)};select set_config('app.billing_advance_link_mutation','on',true);insert into public.billing_invoice_payment_links(organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount) values(${quote(identities.org)},${quote(o.order_id)},${quote(d)},'final',${quote(o.payment)},21);commit;`);
    assert.equal(read([o.payment]).payments[0].status,'existing_document_linked');
  });
  let captured, capturedKey, capturedPayment;
  await t.test('payment at pickup: explicit statement and date recorded atomically, no invoice issued',()=>{
    captured=intake(0);complete(captured);capturedKey=randomUUID();const sql=capture(captured,21,capturedKey);
    capturedPayment=query(auth(sql)).at(-1);const p=read([capturedPayment]).payments[0];assert.equal(p.status,'review_required');assert.equal(p.reason,'postservice_fiscal_rule_not_enabled');assert.equal(p.evidence.servicePerformedOn,today);assert.equal(p.evidence.statementVersion,'pos-service-v1');
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(captured.order_id)}`).at(-1),'0');
    assert.equal(query(auth(sql)).at(-1),capturedPayment);assert.equal(query(`select count(*) from public.payments where order_id=${quote(captured.order_id)}`).at(-1),'1');
    rejected(capture(captured,20,capturedKey),/idempotency_conflict/);
  });
  await t.test('yesterday service, today collection: declared date preserved; automatic late issuance remains unavailable',()=>{
    const o=intake(0);
    // Only synthetic fixture setup, before payment; no trigger is disabled.
    query(`update public.orders set created_at=created_at-interval '2 days' where id=${quote(o.order_id)}`);
    complete(o);const p=query(auth(capture(o,21,randomUUID(),yesterday))).at(-1);
    const row=read([p]).payments[0];assert.equal(row.status,'review_required');assert.equal(row.evidence.servicePerformedOn,yesterday);
    assert.notEqual(row.evidence.operationalCompletedAt.slice(0,10),yesterday);
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(o.order_id)}`).at(-1),'0');
  });
  await t.test('historical payment cannot acquire new evidence; missing confirmation/future date roll back',()=>{
    const o=intake(0);complete(o);const key=randomUUID();pay(o,21,key);
    rejected(capture(o,21,key),/historical_payment_review_required/);
    assert.equal(query(`select count(*) from public.pos_service_payment_evidence where order_id=${quote(o.order_id)}`).at(-1),'0');
    const n=intake(0);complete(n);rejected(capture(n,21).replace(',true)',',false)'),/declaration_required/);
    rejected(capture(n,21,randomUUID(),'2999-01-01'),/declaration_required/);
    assert.equal(query(`select count(*) from public.payments where order_id=${quote(n.order_id)}`).at(-1),'0');
    assert.equal(read([query(`select id from public.payments where order_id=${quote(o.order_id)}`).at(-1)]).payments[0].status,'review_required');
  });
  await t.test('payment failure leaves no evidence; successful evidence is immutable and unavailable to direct DML',()=>{
    const o=intake(0);complete(o);rejected(capture(o,22),/exceeds_outstanding/);
    assert.equal(query(`select count(*) from public.pos_service_payment_evidence where order_id=${quote(o.order_id)}`).at(-1),'0');
    assert.throws(()=>query(`update public.pos_service_payment_evidence set service_performed_on=current_date where payment_id=${quote(capturedPayment)}`),/immutable/);
    rejected(`select * from public.pos_service_payment_evidence`,/permission denied/);
    rejected(`delete from public.pos_service_payment_evidence where payment_id=${quote(capturedPayment)}`,/permission denied/);
    assert.equal(query(`select relrowsecurity from pg_class where oid='public.pos_service_payment_evidence'::regclass`).at(-1),'t');
  });
  await t.test('real concurrent retries of one payment/evidence return the same ID without deadlock or duplicate',async()=>{
    const o=intake(0);complete(o);const sql=capture(o,21,randomUUID());const [a,b]=await Promise.all([concurrent(auth(sql)),concurrent(auth(sql))]);assert.equal(a,b);
    assert.equal(query(`select count(*) from public.payments where order_id=${quote(o.order_id)}`).at(-1),'1');assert.equal(query(`select count(*) from public.pos_service_payment_evidence where order_id=${quote(o.order_id)}`).at(-1),'1');
  });
  await t.test('tenant isolation, Staff capability and entitlement revocation enforced on SQL readers and writer',()=>{
    rejected(`select public.get_pos_fiscal_coverage(array[${quote(first.payment)}::uuid])`,/not_authorized|entitlement/,identities.other);
    rejected(`select public.get_pos_fiscal_coverage(array[${quote(first.payment)}::uuid])`,/not_authorized/,identities.staff);
    query(`update public.organization_memberships set operational_capabilities=array['pos']::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}`);
    assert.equal(read([first.payment],identities.staff).payments.length,1);
    // Staff must use their assigned canonical session: a grant cannot bypass it.
    const o=intake(0);complete(o);rejected(capture(o,21),/session_not_assigned/,identities.staff);
    query(auth(`select public.close_pos_session(${quote(session)},0,'SYNTHETIC TEST')`));
    session=query(auth(`select public.open_pos_session(${quote(identities.location)},0,'SYNTHETIC ONLY')`,identities.staff)).at(-1);
    const p=query(auth(capture(o,21),identities.staff)).at(-1);assert.equal(read([p],identities.staff).payments[0].status,'review_required');
    query(`update public.organization_memberships set operational_capabilities=array[]::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}`);
    rejected(`select public.get_pos_fiscal_coverage(array[${quote(p)}::uuid])`,/not_authorized/,identities.staff);
    query(`update public.organization_entitlements set enabled=false where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'`);
    rejected(`select public.get_pos_fiscal_coverage(array[]::uuid[])`,/not_authorized/);
    query(`update public.organization_entitlements set enabled=true where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'`);
  });
  await t.test('PAGA DOPO has no coverage rows or fake collection; flags can be disabled without hiding historical coverage',()=>{
    const o=intake(0);assert.equal(query(`select count(*) from public.payments where order_id=${quote(o.order_id)}`).at(-1),'0');
    query(`update public.organization_billing_settings set pos_billing_payment_link_enabled=false where organization_id=${quote(identities.org)}`);
    const r=read([first.payment,capturedPayment]);assert.equal(r.enabled,false);assert.deepEqual(r.payments.map(p=>p.status).sort(),['document_issued','review_required']);
  });
  await t.test('oversized, missing or mixed-tenant identifiers cannot return a partial misleading coverage list',()=>{
    rejected(`select public.get_pos_fiscal_coverage(array_fill(${quote(first.payment)}::uuid,array[101]))`,/payment_not_found/);
    rejected(`select public.get_pos_fiscal_coverage(array[${quote(first.payment)}::uuid,${quote(randomUUID())}::uuid])`,/payment_not_found/);
  });
  await t.test('ordinary issuer, original invoices, S06 retirement and direct table ACLs preserved',()=>{
    assert.equal(query(`select md5(pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure))`).at(-1),ordinary);
    assert.equal(query(`select md5(jsonb_agg(to_jsonb(i) order by id)::text) from public.invoices i where organization_id<>${quote(identities.org)}`).at(-1),historic);
    assert.equal(query(`select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('record_pos_postservice_payment','issue_billing_advance_invoice','issue_billing_final_after_advances')`).at(-1),'0');
    for(const role of ['anon','authenticated','service_role'])assert.equal(query(`select has_table_privilege(${quote(role)},'public.pos_service_payment_evidence','insert,update,delete')`).at(-1),'f');
  });
});
