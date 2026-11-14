import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
const database = process.env.PHOENIX_IGIC_RECONCILIATION_DATABASE;
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


test('IGIC final reconciliation — bounded pilot policy — isolated canonical fixture', { skip: !database }, async t => {
  assert.equal(database,'phoenix_igic_reconciliation_20261114');
  const historic=query(`select md5(jsonb_agg(to_jsonb(i)-'igic_final_reconciliation_snapshot' order by id)::text) from public.invoices i`).at(-1);
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


  const originalFlags=query(`select md5(jsonb_agg(jsonb_build_object('id',organization_id,'flag',igic_final_reconciliation_enabled) order by organization_id)::text) from public.organization_billing_settings where organization_id<>${quote(identities.org)}`).at(-1);
  const today=query(`select (now() at time zone 'Atlantic/Canary')::date`).at(-1);
  const flag=value=>query(`update public.organization_billing_settings set igic_final_reconciliation_enabled=${value} where organization_id=${quote(identities.org)}`);
  query(`update public.organization_billing_settings set pos_billing_payment_link_enabled=true where organization_id=${quote(identities.org)}`);
  const make=(gross,paid)=>{query(`update public.service_prices set amount=${gross}/2.0 where organization_id=${quote(identities.org)} and service_id=${quote(identities.service)}`);return intake(paid);};
  const pay=(o,amount,key=randomUUID())=>query(auth(`select public.record_pos_payment(${quote(o.order_id)},${amount},'cash',${quote(session)},null,null,${quote(key)})`)).at(-1);
  const call=(o,p=o.payment,event='advance')=>`select row_to_json(x) from public.issue_pos_billing_payment_document(${quote(o.order_id)},${quote(p)},${quote(event)},'consumer',true,true,${event==='final'?quote(today):'null'}::date) x`;
  const doc=(o,p,event,actor)=>JSON.parse(query(auth(call(o,p,event),actor)).at(-1));
  const row=id=>JSON.parse(query(`select row_to_json(i) from public.invoices i where id=${quote(id)}`).at(-1));
  const counter=()=>query(`select coalesce(next_value,0) from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1);
  const prepare=(total,advance)=>{const o=make(total,advance);const a=doc(o);const payment=pay(o,total-advance);return{o,a,payment};};
  await t.test('default FALSE preserves previous independent rounding and leaves existing documents unaudited by the new policy',()=>{
    const c=prepare(21,5);assert.equal(query(`select igic_final_reconciliation_enabled from public.organization_billing_settings where organization_id=${quote(identities.org)}`).at(-1),'f');
    const inv=row(doc(c.o,c.payment,'final').invoice_id);assert.equal(Number(inv.taxable_base),14.95);assert.equal(Number(inv.tax_total),1.05);assert.equal(inv.igic_final_reconciliation_snapshot,null);
    flag(true);
  });
  let reference;
  await t.test('5 + 16: final residual 14.96 + 1.04, full operation 19.63 + 1.37, immutable issued advance and collections',()=>{
    reference=prepare(21,5);const c=reference;const before=fingerprint(c.o),frozen=JSON.stringify(row(c.a.invoice_id));
    c.final=doc(c.o,c.payment,'final');const inv=row(c.final.invoice_id);assert.equal(Number(inv.taxable_base),14.96);assert.equal(Number(inv.tax_total),1.04);assert.equal(Number(inv.total),16);assert.equal(Number(inv.operation_rounding_base_delta),0);
    assert.equal(query(`select documented_advance_taxable_base+taxable_base from public.invoices where id=${quote(inv.id)}`).at(-1),'19.63');assert.equal(query(`select documented_advance_tax_total+tax_total from public.invoices where id=${quote(inv.id)}`).at(-1),'1.37');
    const e=inv.igic_final_reconciliation_snapshot;assert.equal(e.policy,'ES-CN-IGIC7-FINAL-DIFF-v1');assert.equal(e.base_adjustment,.01);assert.equal(e.tax_adjustment,-.01);assert.equal(e.unadjusted_final_base,14.95);assert.equal(e.advance_documents[0].invoice_id,c.a.invoice_id);assert.equal(e.advance_documents[0].payment_id,c.o.payment);assert.equal(e.declared_by,identities.owner);
    assert.equal(query(`select taxable_base||'/'||tax_amount||'/'||igic_final_base_adjustment from public.invoice_items where invoice_id=${quote(inv.id)}`).at(-1),'14.96/1.04/0.01');
    const documents=JSON.parse(query(auth(`select public.get_pos_billing_payment_documents(${quote(c.o.order_id)})`)).at(-1)).documents;assert.equal(documents.length,2);assert.equal(documents[1].base,14.96);assert.equal(documents[1].tax,1.04);
    assert.equal(JSON.stringify(row(c.a.invoice_id)),frozen);assert.equal(fingerprint(c.o),before);
  });
  await t.test('same covered payment replays the identical final even after policy disabled; no new number or collection',()=>{
    const c=reference;const n=counter(),before=fingerprint(c.o),frozen=JSON.stringify(row(c.final.invoice_id));flag(false);
    assert.equal(doc(c.o,c.payment,'final').invoice_id,c.final.invoice_id);assert.equal(counter(),n);assert.equal(fingerprint(c.o),before);assert.equal(JSON.stringify(row(c.final.invoice_id)),frozen);flag(true);
  });
  await t.test('10 + 11: no rounding difference, same canonical totals and a zero adjustment audit',()=>{
    const c=prepare(21,10);const inv=row(doc(c.o,c.payment,'final').invoice_id);assert.equal(Number(inv.taxable_base),10.28);assert.equal(Number(inv.tax_total),.72);assert.equal(inv.igic_final_reconciliation_snapshot.base_adjustment,0);assert.equal(Number(inv.operation_tax_total),1.37);
  });
  await t.test('opposite one-cent difference: 0.01 advance + 0.07 balance preserves nonnegative residual quotas',()=>{
    const c=prepare(.08,.01);const inv=row(doc(c.o,c.payment,'final').invoice_id);assert.equal(Number(inv.taxable_base),.06);assert.equal(Number(inv.tax_total),.01);assert.equal(inv.igic_final_reconciliation_snapshot.base_adjustment,-.01);assert.equal(query(`select documented_advance_taxable_base+taxable_base from public.invoices where id=${quote(inv.id)}`).at(-1),'0.07');
  });
  await t.test('four documented advances: accumulated two-cent difference reconciles exactly, without altering any advance',()=>{
    const o=make(21,5);const advances=[doc(o)];
    for(let n=0;n<3;n++)advances.push(doc(o,pay(o,5),'advance'));
    const payment=pay(o,1),before=fingerprint(o),frozen=advances.map(a=>JSON.stringify(row(a.invoice_id)));
    const inv=row(doc(o,payment,'final').invoice_id);assert.equal(Number(inv.total),1);assert.equal(Number(inv.taxable_base),.95);assert.equal(Number(inv.tax_total),.05);assert.equal(inv.igic_final_reconciliation_snapshot.base_adjustment,.02);assert.equal(inv.igic_final_reconciliation_snapshot.advance_documents.length,4);
    assert.equal(query(`select documented_advance_taxable_base+taxable_base from public.invoices where id=${quote(inv.id)}`).at(-1),'19.63');assert.equal(query(`select documented_advance_tax_total+tax_total from public.invoices where id=${quote(inv.id)}`).at(-1),'1.37');assert.equal(fingerprint(o),before);assert.deepEqual(advances.map(a=>JSON.stringify(row(a.invoice_id))),frozen);
  });
  await t.test('tax-only residual is conservatively blocked for review and rolls back audit, items and number; POS money stays confirmed',()=>{
    const c=prepare(.08,.07);const before=fingerprint(c.o),n=counter();const draft=query(`select invoice_id from public.invoice_orders where order_id=${quote(c.o.order_id)} and billing_link_role='final'`).at(-1);const frozen=JSON.stringify(row(draft));
    rejected(call(c.o,c.payment,'final'),/igic_reconciliation_review_required/);assert.equal(JSON.stringify(row(draft)),frozen);assert.equal(counter(),n);assert.equal(fingerprint(c.o),before);
    assert.equal(query(`select count(*) from public.billing_invoice_payment_links where payment_id=${quote(c.payment)}`).at(-1),'0');
  });
  await t.test('territory, tax regime and zero rate cannot inherit the pilot policy',()=>{
    const c=prepare(21,5);const before=fingerprint(c.o),n=counter();
    for(const [column,value] of [['fiscal_territory_code','ES-MD'],['declared_tax_regime_code','EXEMPT']]){
      query(`update public.organization_billing_settings set simplified_invoicing_enabled=false,${column}=${quote(value)} where organization_id=${quote(identities.org)}`);rejected(call(c.o,c.payment,'final'),/issuance_disabled/);
      query(`update public.organization_billing_settings set simplified_invoicing_enabled=true,${column}=${quote(column==='fiscal_territory_code'?'ES-CN':'IGIC-GENERAL')} where organization_id=${quote(identities.org)}`);
    }
    query(`update public.organization_billing_settings set simplified_invoicing_enabled=false,default_tax_rate=0 where organization_id=${quote(identities.org)}`);rejected(call(c.o,c.payment,'final'),/issuance_disabled/);query(`update public.organization_billing_settings set simplified_invoicing_enabled=true,default_tax_rate=7 where organization_id=${quote(identities.org)}`);
    assert.equal(fingerprint(c.o),before);assert.equal(counter(),n);
  });
  await t.test('mixed-rate draft is not silently reconciled; commercial total and payment remain unchanged',()=>{
    const c=prepare(21,5);const draft=query(`select invoice_id from public.invoice_orders where order_id=${quote(c.o.order_id)} and billing_link_role='final'`).at(-1);
    query(`begin;set local request.jwt.claim.sub=${quote(identities.owner)};select set_config('app.pos_billing_org',${quote(identities.org)},true);select set_config('app.pos_billing_order',${quote(c.o.order_id)},true);select set_config('app.pos_billing_invoice_ids',${quote(draft)},true);select set_config('app.billing_mutation','on',true);
      delete from public.invoice_items where invoice_id=${quote(draft)};
      insert into public.invoice_items(organization_id,invoice_id,description,unit_type,quantity,unit_price,line_subtotal,discount_amount,taxable_base,tax_rate,tax_amount,line_total,prices_include_tax,source_order_id,source_order_item_id)
        select ${quote(identities.org)},${quote(draft)},'Synthetic mixed rate','piece',1,10.5,10.5,0,round(10.5/(1+r.rate/100),2),r.rate,10.5-round(10.5/(1+r.rate/100),2),10.5,true,${quote(c.o.order_id)},(select id from public.order_items where order_id=${quote(c.o.order_id)} limit 1) from(values(7::numeric),(3::numeric)) r(rate);
      update public.invoices set taxable_base=(select sum(taxable_base) from public.invoice_items where invoice_id=${quote(draft)}),tax_total=(select sum(tax_amount) from public.invoice_items where invoice_id=${quote(draft)}) where id=${quote(draft)};commit;`);
    const before=fingerprint(c.o),n=counter();rejected(call(c.o,c.payment,'final'),/exact_reconciliation_required/);assert.equal(fingerprint(c.o),before);assert.equal(counter(),n);assert.equal(row(draft).igic_final_reconciliation_snapshot,null);
  });
  await t.test('concurrent final requests preserve one document, one attribution and one fiscal number',async()=>{
    const c=prepare(21,5);const n=Number(counter()),before=fingerprint(c.o);const [a,b]=await Promise.all([concurrent(auth(call(c.o,c.payment,'final'))),concurrent(auth(call(c.o,c.payment,'final')))]);assert.equal(JSON.parse(a).invoice_id,JSON.parse(b).invoice_id);assert.equal(Number(counter()),n+1);assert.equal(fingerprint(c.o),before);
    assert.equal(query(`select count(*) from public.billing_invoice_payment_links where payment_id=${quote(c.payment)}`).at(-1),'1');
  });
  await t.test('tenant and Staff capability gates remain enforced without Billing administrative grants',()=>{
    const c=prepare(21,5);rejected(call(c.o,c.payment,'final'),/not_authorized/,identities.staff);rejected(call(c.o,c.payment,'final'),/not_authorized|entitlement|invalid_payment/,identities.other);
    query(`update public.organization_memberships set operational_capabilities=array['pos']::public.operational_capability[] where organization_id=${quote(identities.org)} and profile_id=${quote(identities.staff)}`);
    assert.equal(Number(row(doc(c.o,c.payment,'final',identities.staff).invoice_id).tax_total),1.04);
    rejected(`update public.organization_billing_settings set igic_final_reconciliation_enabled=true where organization_id=${quote(identities.org)}`,/permission denied/,identities.staff);
    assert.equal(query(`select has_function_privilege('authenticated','public.pos_billing_issue_final_internal(uuid,uuid,date,text,text,boolean)','execute')`).at(-1),'f');
  });
  await t.test('new audit and adjusted line cannot rewrite any issued document or be injected into another draft',()=>{
    const inv=reference.final.invoice_id;
    assert.throws(()=>query(`begin;select set_config('app.billing_mutation','on',true);update public.invoices set igic_final_reconciliation_snapshot=null where id=${quote(inv)};commit;`),/immutable/);
    assert.throws(()=>query(`begin;select set_config('app.billing_mutation','on',true);update public.invoice_items set igic_final_base_adjustment=0 where invoice_id=${quote(inv)};commit;`),/immutable/);
    const c=prepare(21,5);const draft=query(`select invoice_id from public.invoice_orders where order_id=${quote(c.o.order_id)} and billing_link_role='final'`).at(-1);
    assert.throws(()=>query(`begin;set local request.jwt.claim.sub=${quote(identities.owner)};select set_config('app.billing_mutation','on',true);update public.invoices set igic_final_reconciliation_snapshot='{}'::jsonb where id=${quote(draft)};commit;`),/not_authorized|retired/);
  });
  await t.test('ordinary multiorder invoicing and original issuer remain canonical; historical records and all default-false tenants preserved',()=>{
    const a=make(12,0),b=make(8,0),beforeA=fingerprint(a),beforeB=fingerprint(b);
    const draft=query(auth(`select public.create_billing_draft(array[${quote(a.order_id)}::uuid,${quote(b.order_id)}::uuid],'A',7,null)`)).at(-1);
    const inv=row(JSON.parse(query(auth(`select row_to_json(x) from public.issue_billing_invoice(${quote(draft)}) x`)).at(-1)).invoice_id);assert.equal(Number(inv.total),20);assert.equal(inv.fiscal_document_type,'ordinary');assert.equal(inv.igic_final_reconciliation_snapshot,null);assert.equal(fingerprint(a),beforeA);assert.equal(fingerprint(b),beforeB);
    assert.equal(query(`select md5(pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure))`).at(-1),ordinary);
    // New nullable metadata/default-zero line fields do not change the old values.
    assert.equal(query(`select md5(jsonb_agg(to_jsonb(i)-'igic_final_reconciliation_snapshot' order by id)::text) from public.invoices i where organization_id<>${quote(identities.org)}`).at(-1),historic);
    assert.equal(query(`select md5(jsonb_agg(jsonb_build_object('id',organization_id,'flag',igic_final_reconciliation_enabled) order by organization_id)::text) from public.organization_billing_settings where organization_id<>${quote(identities.org)}`).at(-1),originalFlags);
  });
});
