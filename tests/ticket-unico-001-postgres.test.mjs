import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
const database = process.env.PHOENIX_TICKET_UNICO_TEST_DATABASE;
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
identities.org='e09f1e0b-1c4d-4450-9a30-79999bee545a';
const auth = (sql, actor = identities.owner) => `begin; set local role authenticated; set local request.jwt.claim.sub=${quote(actor)}; set local request.jwt.claims=${quote(JSON.stringify({ sub: actor, role: 'authenticated' }))}; set local statement_timeout='12s'; ${sql}; commit;`;
let session;
function intake(amount = 9, customer = identities.customer, customerNotes = null, method = 'cash', ordinary = false, walkInName = null) {
  const sql = `select row_to_json(x) from public.submit_shop_terminal_order_with_fiscal_route(
    target_idempotency_key=>${quote(randomUUID())},target_customer_id=>${quote(customer)},target_location_id=>${quote(identities.location)},
    target_due_at=>${quote(new Date(Date.now()+86400000).toISOString())}::timestamptz,target_customer_notes=>${customerNotes === null ? 'null' : quote(customerNotes)},target_internal_notes=>'PRIVATE SYNTHETIC NOTES',
    target_items=>${quote(JSON.stringify([{ serviceId: identities.service, quantity: 2 }]))}::jsonb,target_discount_amount=>0,
    target_pos_session_id=>${quote(session)},target_payments=>${quote(JSON.stringify(amount ? [{ amount, method, idempotencyKey: randomUUID() }] : []))}::jsonb,
    target_walk_in_name=>${walkInName===null?'null':quote(walkInName)},target_walk_in_phone=>null,target_production_assignee_id=>null,target_delivery_requested=>false,
    target_delivery_scheduled_at=>null,target_delivery_assigned_to=>null,target_delivery_address_line1=>null,target_delivery_address_line2=>null,
    target_delivery_city=>null,target_delivery_postal_code=>null,target_delivery_country_code=>null,target_delivery_contact_name=>null,
    target_delivery_contact_phone=>null,target_delivery_notes=>null,target_ordinary_invoice_requested=>${ordinary}) x`;
  const order = JSON.parse(query(auth(sql)).at(-1));
  const payment = query(`select id from public.payments where order_id=${quote(order.order_id)}`).at(-1);
  return { ...order, payment, submissionSql: sql };
}
const issue = (order, recipient = 'consumer') => `select row_to_json(x) from public.issue_billing_full_prepayment_ticket(${quote(order.order_id)},${quote(order.payment)},${quote(recipient)},true,true) x`;
const fingerprint = order => query(`select md5(coalesce(string_agg(row_to_json(p)::text,',' order by p.id),'')) from public.payments p where order_id=${quote(order.order_id)}`).at(-1);
function rejected(sql, pattern, actor) { assert.throws(() => query(auth(sql, actor)), pattern); }
async function concurrent(sql) {
  const proc = spawn('docker', args(), { stdio: ['pipe', 'pipe', 'pipe'] }); let out = ''; let err = '';
  proc.stdout.on('data', b => { out += b; }); proc.stderr.on('data', b => { err += b; }); proc.stdin.end(sql);
  const [code] = await once(proc, 'close'); if (code) throw Error(err); return out.trim();
}


test('TICKET-UNICO — completion / one fiscal document / later POS collections', { skip: !database }, async t => {
  assert.equal(database,'phoenix_ticket_unico_20261115');
  const historyIds=query('select id from public.invoices order by id');
  const historicReceipts=query("select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]')) from public.operational_receipts r").at(-1);
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


 const day=query("select (now() at time zone 'Atlantic/Canary')::date").at(-1);
 const completeSql=(o,current=true)=>`select public.complete_order_with_billing(${quote(o.order_id)},'ready',${quote(identities.ready)},1,'folded',null,${current})`;
 const prepare=o=>query(auth(`select public.transition_order_status(${quote(o.order_id)},'washing',null);select public.transition_order_status(${quote(o.order_id)},'quality_check',null);select public.transition_order_status(${quote(o.order_id)},'packing',null)`));
 const complete=(o,current=true,actor)=>JSON.parse(query(auth(completeSql(o,current),actor)).at(-1));
 const documents=o=>JSON.parse(query(auth(`select public.get_pos_billing_payment_documents(${quote(o.order_id)})`)).at(-1));
 const pay=(o,amount,key=randomUUID(),actor)=>query(auth(`select public.record_pos_payment(${quote(o.order_id)},${amount},'cash',${quote(session)},null,null,${quote(key)})`,actor)).at(-1);
 const financial=o=>query(`select count(*)||'/'||coalesce(sum(amount),0) from public.payments where order_id=${quote(o.order_id)} and status='confirmed'`).at(-1);
 // CTO v3 review: run only the new flag/isolation checks when requested.
 // Reuse the same approved synthetic fixture and canonical PostgreSQL image.
 if (process.env.PHOENIX_TICKET_UNICO_REVIEW_ONLY === '1') {
  const gate=(actor)=>query(auth('select public.get_ticket_unico_enabled()',actor)).at(-1);
  const settings=sql=>query(`update public.organization_billing_settings set ${sql} where organization_id=${quote(identities.org)}`);
  let disabled,enabled,invoice;
  await t.test('v3 default-off preserves original intake/completion and ignores wrapper ordinary intent',()=>{
   assert.equal(gate(),'f');disabled=intake(0,identities.customer,null,'cash',true);
   assert.equal(query(`select fiscal_route from public.orders where id=${quote(disabled.order_id)}`).at(-1),'review_required');
   assert.equal(documents(disabled).automatic,false);
   const original=disabled.submissionSql.replace('submit_shop_terminal_order_with_fiscal_route','submit_shop_terminal_order').replace(/,target_ordinary_invoice_requested=>true/,'');
   assert.equal(JSON.parse(query(auth(original)).at(-1)).order_id,disabled.order_id);
   prepare(disabled);assert.equal(complete(disabled).status,'disabled');
   assert.equal(query(`select production_status||'/'||(service_completion_evidence is null) from public.orders where id=${quote(disabled.order_id)}`).at(-1),'completed/true');
   assert.deepEqual(documents(disabled).documents,[]);
   query(auth(`select public.request_order_ordinary_invoice(${quote(disabled.order_id)})`));
   assert.equal(query(`select fiscal_route from public.orders where id=${quote(disabled.order_id)}`).at(-1),'review_required');
  });
  await t.test('v3 legacy flags do not activate Ticket Unico; explicit flag requires Billing entitlement and simplified enabled',()=>{
   settings('fiscal_ticket_phase_a_enabled=true,pos_billing_payment_link_enabled=true');assert.equal(gate(),'f');
   settings('ticket_unico_enabled=true');assert.equal(gate(),'t');
   settings('pos_billing_payment_link_enabled=false,fiscal_ticket_phase_a_enabled=false');assert.equal(gate(),'t');
   settings('simplified_invoicing_enabled=false');assert.equal(gate(),'f');settings('simplified_invoicing_enabled=true');
   query(`update public.organization_entitlements set enabled=false where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'`);assert.equal(gate(),'f');
   const noBilling=intake(0,identities.customer,null,'cash',true);
   assert.equal(query(`select fiscal_route from public.orders where id=${quote(noBilling.order_id)}`).at(-1),'review_required');
   query(`update public.organization_entitlements set enabled=true where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'`);assert.equal(gate(),'t');
  });
  await t.test('v3 enabled pilot issues once; switching off keeps issued snapshot readable without claiming automatic mode',()=>{
   enabled=intake(0);prepare(enabled);invoice=complete(enabled);assert.equal(invoice.status,'issued',JSON.stringify(invoice));
   const doc=documents(enabled);assert.equal(doc.automatic,true);assert.equal(doc.enabled,false);assert.equal(doc.documents.length,1);
   const before=query(`select md5(to_jsonb(i)::text) from public.invoices i where id=${quote(invoice.invoiceId)}`).at(-1);
   settings('ticket_unico_enabled=false');const off=documents(enabled);assert.equal(off.automatic,false);assert.equal(off.documents[0].id,invoice.invoiceId);
   assert.equal(query(`select md5(to_jsonb(i)::text) from public.invoices i where id=${quote(invoice.invoiceId)}`).at(-1),before);
  });
  await t.test('v3 disabled ordinary-draft wrapper delegates without changing order route',()=>{
   const result=query(auth(`select public.create_billing_draft_with_order_route(array[${quote(disabled.order_id)}::uuid],'A',7,null)`)).at(-1);
   assert.ok(result);assert.equal(query(`select fiscal_route from public.orders where id=${quote(disabled.order_id)}`).at(-1),'review_required');
  });
  await t.test('v3 another tenant cannot activate the feature and no historical invoice/REC is changed',()=>{
   query(`insert into public.organization_billing_settings(organization_id,ticket_unico_enabled,issuer_country_code,default_tax_rate,fiscal_territory_code,declared_tax_regime_code,simplified_invoicing_enabled,simplified_series)
    values(${quote(identities.orgB)},true,'ES',7,'ES-CN','IGIC-GENERAL',true,'S')`);
   assert.equal(gate(identities.other),'f');
   assert.equal(query(`select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]')) from public.operational_receipts r`).at(-1),historicReceipts);
   assert.equal(query(`select md5(jsonb_agg(to_jsonb(i) order by id)::text) from public.invoices i where id=any(${quote('{'+historyIds.join(',')+'}')}::uuid[])`).at(-1),historic);
   assert.equal(query(`select md5(pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure))`).at(-1),ordinary);
  });
  return;
 }
 let first,issued;
 await t.test('new private route derived server-side; historical orders remain review_required',()=>{
  first=intake(0);assert.equal(query(`select fiscal_route from public.orders where id=${quote(first.order_id)}`).at(-1),'review_required');
  assert.equal(query(`select count(*) from public.orders where organization_id<>${quote(identities.org)} and fiscal_route<>'review_required'`).at(-1),'0');
  assert.deepEqual(documents(first).documents,[]);assert.equal(financial(first),'0/0');
  assert.throws(()=>query(auth(`update public.orders set fiscal_route='manual_billing' where id=${quote(first.order_id)}`)),/route_locked|permission denied/);
 });
 await t.test('default-off completion does not issue or allocate a number',()=>{
  prepare(first);assert.equal(complete(first).status,'disabled');assert.deepEqual(documents(first).documents,[]);
  query(`update public.organization_billing_settings set ticket_unico_enabled=true where organization_id=${quote(identities.org)}`);
 });
 await t.test('real completion with zero paid emits one canonical service invoice and open credit',()=>{
  first=intake(0);prepare(first);issued=complete(first);assert.equal(issued.status,'issued',JSON.stringify(issued));
  let ds=documents(first).documents;assert.equal(ds.length,1);assert.equal(ds[0].paymentId,null);assert.equal(ds[0].total,21);
  assert.equal(ds[0].base,19.63);assert.equal(ds[0].tax,1.37);assert.deepEqual(ds[0].taxRates,[7]);assert.equal(financial(first),'0/0');
 });
 await t.test('5 then 16 POS collections attach to the SAME invoice without a second fiscal sale',()=>{
  const invoiceBefore=query(`select row_to_json(i)::text from public.invoices i where id=${quote(issued.invoiceId)}`).at(-1);
  const p1=pay(first,5);assert.equal(financial(first),'1/5.00');assert.deepEqual(documents(first).documents[0].paymentIds,[p1]);
  const key=randomUUID();const p2=pay(first,16,key);assert.equal(pay(first,16,key),p2);assert.equal(financial(first),'2/21.00');
  const ds=documents(first).documents;assert.equal(ds.length,1);assert.equal(ds[0].id,issued.invoiceId);assert.equal(ds[0].paymentIds.length,2);
  const coverage=JSON.parse(query(auth(`select public.get_pos_fiscal_coverage(array[${quote(p1)},${quote(p2)}]::uuid[])`)).at(-1));
  assert.equal(coverage.payments.length,2);assert.ok(coverage.payments.every(p=>p.status==='document_issued'&&p.document.id===issued.invoiceId));
  assert.equal(query(`select row_to_json(i)::text from public.invoices i where id=${quote(issued.invoiceId)}`).at(-1),invoiceBefore);
 });
 await t.test('reprint/read and uncertain completion replay do not mutate fiscal or monetary facts',()=>{
  const before=financial(first);const number=issued.number;
  for(let j=0;j<3;j++){assert.equal(documents(first).documents[0].number,number);assert.equal(complete(first).number,number);}
  assert.equal(financial(first),before);assert.equal(documents(first).documents.length,1);
 });
 await t.test('late completion retains production but never invents a fiscal date',()=>{
  const o=intake(0);prepare(o);assert.equal(complete(o,false).status,'review_required');assert.deepEqual(documents(o).documents,[]);
  assert.equal(query(`select service_completion_evidence->>'serviceDate' from public.orders where id=${quote(o.order_id)}`).at(-1),undefined);
  assert.equal(complete(o,true).status,'review_required');
 });
 await t.test('ordinary request and B2B route are preserved without simplified issuance',()=>{
  const o=intake(0);query(auth(`select public.request_order_ordinary_invoice(${quote(o.order_id)})`));prepare(o);assert.equal(complete(o).status,'manual_billing');
  const b=intake(0,identities.business);assert.equal(query(`select fiscal_route from public.orders where id=${quote(b.order_id)}`).at(-1),'manual_billing');prepare(b);assert.equal(complete(b).status,'manual_billing');
  rejected(`select public.request_order_ordinary_invoice(${quote(first.order_id)})`,/order_fiscal_route_locked/);
 });
 await t.test('pre-service payments are not silently reclassified as service settlements',()=>{
  const o=intake(5);prepare(o);assert.equal(complete(o).reason,'prior_history');assert.equal(financial(o),'1/5.00');assert.deepEqual(documents(o).documents,[]);
 });
 await t.test('real concurrent completion produces one invoice/counter increment without deadlock',async()=>{
  const o=intake(0);prepare(o);const before=Number(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1));
  const rs=await Promise.all([concurrent(auth(completeSql(o))),concurrent(auth(completeSql(o)))]);
  const docs=rs.map(v=>JSON.parse(v.split('\n').at(-1)));assert.equal(docs[0].invoiceId,docs[1].invoiceId);assert.equal(documents(o).documents.length,1);
  assert.equal(Number(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1)),before+1);
 });
 await t.test('tenant denial, private helpers and evidence immutability',()=>{
  const o=intake(0);prepare(o);rejected(completeSql(o),/order_not_found|not_authorized/,identities.other);
  for(const name of ['issue_completed_order_service_internal(uuid)','ticket_unico_context_allowed(uuid)','ticket_unico_pilot(uuid)']) assert.equal(query(`select has_function_privilege('authenticated',${quote('public.'+name)},'execute')`).at(-1),'f');
  assert.throws(()=>query(auth(`update public.orders set service_completion_evidence='{}' where id=${quote(first.order_id)}`)),/immutable|permission denied/);
 });
 await t.test('ordinary request is atomic at intake and cannot be changed by an uncertain submission replay',()=>{
  const o=intake(0,identities.customer,null,'cash',true);
  assert.equal(query(`select fiscal_route from public.orders where id=${quote(o.order_id)}`).at(-1),'manual_billing');
  const original=query(`select request_fingerprint from public.shop_terminal_submissions where order_id=${quote(o.order_id)}`).at(-1);
  assert.ok(original);
  assert.equal(JSON.parse(query(auth(o.submissionSql)).at(-1)).order_id,o.order_id);
  rejected(o.submissionSql.replace('target_ordinary_invoice_requested=>true','target_ordinary_invoice_requested=>false'),/idempotency_conflict/);
  assert.equal(financial(o),'0/0');prepare(o);assert.equal(complete(o).status,'manual_billing');
 });
 await t.test('Staff quality can complete only assigned work; POS permission remains separate',()=>{
  const o=intake(0);prepare(o);
  query(`update public.organization_memberships set operational_capabilities=array['quality']::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}; update public.orders set assigned_to=${quote(identities.staff)} where id=${quote(o.order_id)}`);
  assert.equal(complete(o,true,identities.staff).status,'issued');assert.equal(complete(o,true,identities.staff).status,'issued');
  rejected(`select public.record_pos_payment(${quote(o.order_id)},5,'cash',${quote(session)},null,null,${quote(randomUUID())})`,/pos_not_authorized/,identities.staff);
  query(`update public.organization_memberships set operational_capabilities=array['pos']::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}`);
  rejected(`select public.record_pos_payment(${quote(o.order_id)},5,'cash',${quote(session)},null,null,${quote(randomUUID())})`,/pos_session_not_assigned/,identities.staff);
  query(auth(`select public.close_pos_session(${quote(session)},(select expected_cash from public.get_pos_session_summary(${quote(session)})),null)`));
  session=query(auth(`select public.open_pos_session(${quote(identities.location)},0,'SYNTHETIC STAFF SESSION')`,identities.staff)).at(-1);
  const p=pay(o,5,randomUUID(),identities.staff);assert.ok(p);assert.equal(documents(o).documents[0].paymentIds.length,1);
  const other=intake(0);prepare(other);rejected(completeSql(other),/not_authorized/,identities.staff);
 });
 await t.test('fiscal failure after counter allocation rolls back the invoice only, with safe same-day retry',()=>{
  const o=intake(0);prepare(o);
  const before=query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1);
  query(`create function public.ticket_unico_synthetic_failure() returns trigger language plpgsql as $$ begin if new.document_status='issued' and new.pos_billing_order_snapshot->>'order_id'=${quote(o.order_id)} then raise exception 'SYNTHETIC_FAILURE' using errcode='P0001'; end if; return new;end $$; create trigger zz_ticket_unico_synthetic_failure before update on public.invoices for each row execute function public.ticket_unico_synthetic_failure()`);
  try{
   const result=complete(o);assert.equal(result.status,'review_required');assert.equal(result.sqlstate,'P0001');
   assert.equal(query(`select production_status from public.orders where id=${quote(o.order_id)}`).at(-1),'completed');
   assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(o.order_id)}`).at(-1),'0');
   assert.equal(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1),before);
  }finally{query('drop trigger zz_ticket_unico_synthetic_failure on public.invoices; drop function public.ticket_unico_synthetic_failure()');}
  assert.equal(complete(o).status,'issued');
  assert.equal(query(`select count(*) from public.order_status_history where order_id=${quote(o.order_id)} and to_status='completed'`).at(-1),'1');
 });
 await t.test('history, REC and ordinary writer definitions remain intact',()=>{
  if(historyIds.length)assert.equal(query(`select md5(jsonb_agg(to_jsonb(i) order by id)::text) from public.invoices i where id in (${historyIds.map(quote).join(',')})`).at(-1),historic);
  assert.equal(query("select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]')) from public.operational_receipts r").at(-1),historicReceipts);
  assert.equal(query("select md5(pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure))").at(-1),ordinary);
  assert.equal(query("select to_regprocedure('public.issue_billing_invoice(uuid,date,text,text,boolean)') is null").at(-1),'t');
  assert.equal(query("select count(*) from pg_policies where schemaname='public' and tablename in ('orders','invoices','payments')").at(-1)!=='0',true);
 });

 await t.test('other tenants cannot activate this issuer, even with an enabled setting',()=>{
  query(`insert into public.organization_billing_settings(organization_id,ticket_unico_enabled) values(${quote(identities.orgB)},true)`);
  assert.equal(query(`select public.ticket_unico_pilot(${quote(identities.orgB)})`).at(-1),'f');
  assert.equal(query(`select public.ticket_unico_pilot(${quote(identities.org)})`).at(-1),'t');
 });
 await t.test('issued-order cancellation gate and fiscal route stay protected after settlement',()=>{
  const before=financial(first);
  rejected(`select public.transition_order_status(${quote(first.order_id)},'cancelled','SYNTHETIC REQUEST')`,/fiscal_cancellation_blocked|transition/);
  rejected(`select public.request_order_ordinary_invoice(${quote(first.order_id)})`,/order_fiscal_route_locked/);
  assert.equal(financial(first),before);assert.equal(documents(first).documents[0].id,issued.invoiceId);
 });

 await t.test('ordinary draft creation records manual intent atomically and ordinary issuance remains available',()=>{
  const o=intake(0);
  const invoice=query(auth(`select public.create_billing_draft_with_order_route(array[${quote(o.order_id)}]::uuid[],'A',7,null)`)).at(-1);
  assert.equal(query(`select fiscal_route from public.orders where id=${quote(o.order_id)}`).at(-1),'manual_billing');
  prepare(o);assert.equal(complete(o).status,'manual_billing');
  query(auth(`select * from public.issue_billing_invoice(${quote(invoice)})`));
  assert.equal(query(`select fiscal_document_type||'/'||document_status from public.invoices where id=${quote(invoice)}`).at(-1),'ordinary/issued');
  assert.equal(documents(o).documents.length,0);
 });
 await t.test('existing advance writer remains scoped; completion never fabricates a second sale after an advance',()=>{
  const o=intake(5);
  query(`update public.organization_billing_settings set pos_billing_payment_link_enabled=true where organization_id=${quote(identities.org)}`);
  query(auth(`select * from public.issue_pos_billing_payment_document(${quote(o.order_id)},${quote(o.payment)},'advance','consumer',true,true,null)`));
  const original=documents(o).documents[0];assert.equal(original.event,'advance');
  prepare(o);assert.equal(complete(o).reason,'prior_history');assert.equal(documents(o).documents.length,1);assert.equal(documents(o).documents[0].number,original.number);
 });

 await t.test('the original customer-copy snapshot preserves an available walk-in customer name',()=>{
  const walkIn=query(auth('select public.resolve_shared_walk_in_customer()')).at(-1);
  const o=intake(0,walkIn,null,'cash',false,'SYNTHETIC WALK-IN');prepare(o);assert.equal(complete(o).status,'issued');
  assert.equal(documents(o).documents[0].snapshot.customer_name,'SYNTHETIC WALK-IN');
 });

});
