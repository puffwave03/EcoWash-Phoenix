import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
const database = process.env.PHOENIX_POS_BILLING_TEST_DATABASE;
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


test('POS Billing controlled payment attribution — isolated canonical fixture', { skip: !database }, async t => {
  assert.equal(database,'phoenix_fiscal_ticket_20261114_paymentlink');
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

  const call=(o,p=o.payment,event='advance',recipient='consumer',day=null)=>`select row_to_json(x) from public.issue_pos_billing_payment_document(${quote(o.order_id)},${quote(p)},${quote(event)},${quote(recipient)},true,true,${day===null?'null':quote(day)}::date) x`;
  const doc=(o,p,event,recipient,day,actor)=>JSON.parse(query(auth(call(o,p,event,recipient,day),actor)).at(-1));
  const read=o=>JSON.parse(query(auth(`select public.get_pos_billing_payment_documents(${quote(o.order_id)})`)).at(-1));
  const pay=(o,amount,key=randomUUID())=>query(auth(`select public.record_pos_payment(${quote(o.order_id)},${amount},'cash',${quote(session)},null,null,${quote(key)})`)).at(-1);
  const today=query(`select (now() at time zone 'Atlantic/Canary')::date`).at(-1);
  const first=intake(5,identities.customer,'Frozen customer note');let advance,final,balance;
  await t.test('default-off gate: no fiscal attribution and no money mutation',()=>{
    const before=fingerprint(first);rejected(call(first),/pos_billing_disabled/);assert.equal(fingerprint(first),before);
    assert.equal(read(first).enabled,false);
    query(`update public.organization_billing_settings set pos_billing_payment_link_enabled=true where organization_id=${quote(identities.org)}`);
  });
  await t.test('21 EUR order / 5 EUR first advance uses one immutable payment attribution',()=>{
    advance=doc(first);const d=read(first).documents;assert.equal(d.length,1);assert.equal(d[0].total,5);assert.equal(d[0].base,4.67);assert.equal(d[0].tax,.33);assert.equal(d[0].paymentId,first.payment);assert.equal(d[0].snapshot.customer_notes,'Frozen customer note');
    assert.equal(query(`select count(*) from public.billing_invoice_payment_links where organization_id=${quote(identities.org)} and payment_id=${quote(first.payment)}`).at(-1),'1');
  });
  await t.test('retry/uncertain-response recovery returns the identical advance, no new number or payment',()=>{
    const before=fingerprint(first);const counter=query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1);
    assert.equal(doc(first).invoice_id,advance.invoice_id);assert.equal(read(first).documents[0].id,advance.invoice_id);assert.equal(fingerprint(first),before);
    assert.equal(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1),counter);
  });
  await t.test('16 EUR settlement: same order, distinct invoice, exact collections, historical advance unchanged',()=>{
    const frozen=query(`select row_to_json(i)::text from public.invoices i where id=${quote(advance.invoice_id)}`).at(-1);
    const key=randomUUID();balance=pay(first,16,key);assert.equal(pay(first,16,key),balance);
    final=doc(first,balance,'final','consumer',today);assert.notEqual(final.invoice_id,advance.invoice_id);
    assert.equal(doc(first,balance,'final','consumer',today).invoice_id,final.invoice_id);
    const ds=read(first).documents;assert.equal(ds.length,2);assert.equal(ds.reduce((n,d)=>n+d.total,0),21);assert.equal(ds[1].total,16);assert.equal(ds[1].base,14.95);assert.equal(ds[1].tax,1.05);assert.equal(ds[1].roundingDelta,-.01);
    assert.equal(query(`select row_to_json(i)::text from public.invoices i where id=${quote(advance.invoice_id)}`).at(-1),frozen);
    assert.equal(query(`select sum(amount)||'/'||count(*) from public.payments where order_id=${quote(first.order_id)} and status='confirmed'`).at(-1),'21.00/2');
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(first.order_id)} and billing_link_role='advance' and final_invoice_id=${quote(final.invoice_id)}`).at(-1),'1');
  });
  await t.test('Staff without POS denied; explicit POS permits only scoped issue/read, no administrative grants',()=>{
    const o=intake(5);rejected(call(o),/pos_not_authorized/,identities.staff);
    query(`update public.organization_memberships set operational_capabilities=array['pos']::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}`);
    const a=doc(o,undefined,undefined,undefined,undefined,identities.staff);assert.ok(a.invoice_number);
    assert.ok(JSON.parse(query(auth(`select public.get_pos_billing_payment_documents(${quote(o.order_id)})`,identities.staff)).at(-1)).documents.length);
    for(const rpc of ['pos_billing_issue_advance_internal(uuid,uuid,text,text,boolean)','pos_billing_issue_final_internal(uuid,uuid,date,text,text,boolean)','pos_billing_declare_advance_internal(uuid,uuid,boolean)','pos_billing_context_allowed(uuid)','create_billing_draft_internal(uuid[],text,numeric,text,billing_fiscal_document_type,jsonb)']) assert.equal(query(`select has_function_privilege('authenticated',${quote('public.'+rpc)},'execute')`).at(-1),'f');
    rejected(`update public.organization_billing_settings set pos_billing_payment_link_enabled=true where organization_id=${quote(identities.org)}`,/permission denied/,identities.staff);
  });
  await t.test('Staff POS settlement and revocation preserve separation from Billing administration',()=>{
    const o=intake(5);doc(o,undefined,undefined,undefined,undefined,identities.staff);const p=pay(o,16);
    const a=doc(o,p,'final','consumer',today,identities.staff);assert.ok(a.invoice_number);
    assert.equal(query(auth(`select count(*) from public.invoices where organization_id=${quote(identities.org)}`,identities.staff)).at(-1),'0');
    query(`update public.organization_memberships set operational_capabilities=array[]::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}`);
    rejected(call(o,p,'final','consumer',today),/pos_not_authorized/,identities.staff);
    query(`update public.organization_memberships set operational_capabilities=array['pos']::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}`);
  });
  await t.test('single full prepayment remains one document with no second charge, including Staff POS',()=>{
    const o=intake(21);const before=fingerprint(o);const a=doc(o,undefined,undefined,undefined,undefined,identities.staff);
    assert.equal(doc(o,undefined,undefined,undefined,undefined,identities.staff).invoice_id,a.invoice_id);assert.equal(read(o).documents.length,1);assert.equal(read(o).documents[0].total,21);assert.equal(fingerprint(o),before);
  });
  await t.test('PAGA DOPO: no payment means no fiscal document, no number and no fake collection',()=>{
    const o=intake(0);rejected(call(o,randomUUID()),/pos_billing_invalid_payment/);assert.deepEqual(read(o).documents,[]);assert.equal(query(`select count(*) from public.payments where order_id=${quote(o.order_id)}`).at(-1),'0');
  });
  await t.test('tenant isolation, entitlement revocation, explicit declarations and conflict protection',()=>{
    const o=intake(5);rejected(call(o),/invalid_payment|not_authorized|entitlement/,identities.other);
    rejected(`select public.get_pos_billing_payment_documents(${quote(o.order_id)})`,/order_not_found|entitlement|not_authorized/,identities.other);
    rejected(call(o).replace(',true,true,',',false,true,'),/confirmation_required/);
    rejected(call(first,first.payment,'final','consumer',today),/request_conflict/);
    query(`update public.organization_entitlements set enabled=false where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'`);
    rejected(call(o),/not_authorized/);query(`update public.organization_entitlements set enabled=true where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'`);
  });
  await t.test('issued snapshots immutable; reprint remains readable after disabling issue',()=>{
    assert.throws(()=>query(`begin; set local request.jwt.claim.sub=${quote(identities.owner)}; set local app.billing_mutation='on'; update public.invoices set pos_billing_order_snapshot='{}' where id=${quote(advance.invoice_id)};commit;`),/retired|immutable|snapshot/);
    query(`update public.organization_billing_settings set pos_billing_payment_link_enabled=false where organization_id=${quote(identities.org)}`);
    assert.equal(read(first).documents.length,2);assert.equal(doc(first).invoice_id,advance.invoice_id);
    rejected(call(intake(5)),/disabled/);query(`update public.organization_billing_settings set pos_billing_payment_link_enabled=true where organization_id=${quote(identities.org)}`);
  });
  await t.test('real concurrent replay produces one document and one counter increment, no deadlock',async()=>{
    const o=intake(5);const before=Number(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1));
    const result=await Promise.all([concurrent(auth(call(o))),concurrent(auth(call(o)))]);
    assert.equal(JSON.parse(result[0].split('\n').at(-1)).invoice_id,JSON.parse(result[1].split('\n').at(-1)).invoice_id);
    assert.equal(read(o).documents.length,1);assert.equal(Number(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1)),before+1);
  });
  await t.test('incompatible final rolls back completely; historical invoices and ordinary issuer preserved',()=>{
    const o=intake(5),before=fingerprint(o);rejected(call(o,o.payment,'final','consumer',today),/advance_required/);assert.equal(fingerprint(o),before);assert.deepEqual(read(o).documents,[]);
    assert.equal(query(`select md5(jsonb_agg(to_jsonb(i) order by id)::text) from public.invoices i where organization_id<>${quote(identities.org)}`).at(-1),historic);
    assert.equal(query(`select md5(pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure))`).at(-1),ordinary);
  });
});
