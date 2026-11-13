import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
const database = process.env.PHOENIX_FISCAL_TICKET_TEST_DATABASE;
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
function intake(amount = 9, customer = identities.customer) {
  const sql = `select row_to_json(x) from public.submit_shop_terminal_order(
    target_idempotency_key=>${quote(randomUUID())},target_customer_id=>${quote(customer)},target_location_id=>${quote(identities.location)},
    target_due_at=>now()+interval '1 day',target_customer_notes=>null,target_internal_notes=>'PRIVATE SYNTHETIC NOTES',
    target_items=>${quote(JSON.stringify([{ serviceId: identities.service, quantity: 2 }]))}::jsonb,target_discount_amount=>0,
    target_pos_session_id=>${quote(session)},target_payments=>${quote(JSON.stringify(amount ? [{ amount, method: 'cash', idempotencyKey: randomUUID() }] : []))}::jsonb,
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

test('Phase A — real canonical schema, authenticated SQL sessions and synthetic POS intake', { skip: !database }, async t => {
  assert.match(database, /^phoenix_fiscal_ticket_\d{8}(?:_[a-z0-9]+)*$/);
  assert.notEqual(database, 'postgres');
  assert.equal(query(`select current_database(); select count(*) from information_schema.columns where table_schema='public' and table_name='invoices' and column_name='fiscal_ticket_order_snapshot'`).at(-1), '1');
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
    insert into public.service_prices(organization_id,service_id,amount,currency,valid_from) values(${quote(identities.org)},${quote(identities.service)},4.50,'EUR',current_date-1);
    insert into public.organization_billing_settings(organization_id,issuer_legal_name,issuer_tax_id,issuer_address_line1,issuer_city,issuer_postal_code,issuer_country_code,default_series,default_tax_rate,fiscal_territory_code,declared_tax_regime_code,simplified_invoicing_enabled,simplified_series)
      values(${quote(identities.org)},'SYNTHETIC LAUNDRY — NOT REAL','TEST-ISSUER','Test road','Test city','00000','ES','A',7,'ES-CN','IGIC-GENERAL',true,'S');
    commit;`);
  session = query(auth(`select public.open_pos_session(${quote(identities.location)},0,'SYNTHETIC ONLY')`)).at(-1);
  const first = intake(); const financial = fingerprint(first);
  await t.test('default-off gate and no direct authenticated flag activation', () => {
    rejected(issue(first), /billing_ticket_disabled/);
    rejected(`update public.organization_billing_settings set fiscal_ticket_phase_a_enabled=true where organization_id=${quote(identities.org)}`, /permission denied/);
    assert.equal(query(`select fiscal_ticket_phase_a_enabled from public.organization_billing_settings where organization_id=${quote(identities.org)}`).at(-1), 'f');
  });
  // Fixture-only activation; no existing or remote tenant is ever enabled.
  query(`update public.organization_billing_settings set fiscal_ticket_phase_a_enabled=true where organization_id=${quote(identities.org)}`);
  let document;
  await t.test('one canonical POS collection -> one inclusive 9 EUR advance invoice and payment attribution', () => {
    document = JSON.parse(query(auth(issue(first))).at(-1));
    const result = JSON.parse(query(`select row_to_json(x) from (select document_status,fiscal_document_type,billing_event_kind,total,taxable_base,tax_total,prices_include_tax,recipient_snapshot_mode,fiscal_ticket_order_snapshot from public.invoices where id=${quote(document.invoice_id)}) x`).at(-1));
    assert.equal(result.total, 9); assert.equal(result.taxable_base, 8.41); assert.equal(result.tax_total, .59);
    assert.equal(result.document_status, 'issued'); assert.equal(result.fiscal_document_type, 'simplified'); assert.equal(result.billing_event_kind, 'advance'); assert.equal(result.prices_include_tax, true);
    assert.equal(result.fiscal_ticket_order_snapshot.order_number, first.order_number);
    assert.equal(query(`select count(*) from public.billing_invoice_payment_links where payment_id=${quote(first.payment)}`).at(-1), '1');
    assert.equal(fingerprint(first), financial);
  });
  await t.test('repeat and read/reprint preserve payment, invoice identity and counter', () => {
    const before = query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1);
    assert.equal(JSON.parse(query(auth(issue(first))).at(-1)).invoice_id, document.invoice_id);
    query(auth(`select invoice_number,fiscal_ticket_order_snapshot from public.invoices where id=${quote(document.invoice_id)}`));
    assert.equal(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1), before);
    assert.equal(fingerprint(first), financial);
    rejected(issue(first, 'consumer_identified'), /billing_ticket_request_conflict/);
  });
  await t.test('Staff, foreign tenant and missing Billing entitlement denied without financial changes', () => {
    rejected(issue(first), /billing_not_authorized/, identities.staff);
    rejected(issue(first), /billing_not_authorized|billing_ticket_invalid_payment/, identities.other);
    query(`begin; update public.organization_entitlements set enabled=false where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'; commit;`);
    rejected(issue(first), /billing_not_authorized/);
    query(`update public.organization_entitlements set enabled=true where organization_id=${quote(identities.org)} and feature_key='billing.invoicing'`);
    assert.equal(fingerprint(first), financial);
  });
  await t.test('issued snapshot immutable and ordinary cancellation blocked by published fiscal gate', () => {
    rejected(`update public.invoices set fiscal_ticket_order_snapshot='{}' where id=${quote(document.invoice_id)}`, /permission denied|immutable|retired/);
    assert.throws(() => query(`begin; set local request.jwt.claim.sub=${quote(identities.owner)};
      set local app.billing_mutation='on'; set local app.fiscal_ticket_phase_a='on';
      update public.invoices set notes='SYNTHETIC MUTATION DENIED' where id=${quote(document.invoice_id)}; commit;`), /immutable|retired/);
    rejected(`select public.transition_order_status(${quote(first.order_id)},'cancelled','Synthetic cancel')`, /order_cancel_fiscal|fiscal.*cancel|cancel.*fiscal/);
  });
  await t.test('partial payment rejected and entire issuance transaction rolled back', () => {
    const partial = intake(3); const before = fingerprint(partial);
    rejected(issue(partial), /billing_ticket_invalid_payment/);
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(partial.order_id)}`).at(-1), '0');
    assert.equal(query(`select count(*) from public.billing_advance_event_declarations where order_id=${quote(partial.order_id)}`).at(-1), '0');
    assert.equal(fingerprint(partial), before);
  });
  await t.test('refunded payment rejected; payment and refund remain separate immutable facts', () => {
    const refunded = intake();
    query(auth(`select public.record_pos_refund(${quote(refunded.payment)},1,'Synthetic refund',${quote(session)},${quote(randomUUID())})`));
    const before = fingerprint(refunded); rejected(issue(refunded), /billing_ticket_invalid_payment/); assert.equal(fingerprint(refunded), before);
  });
  await t.test('production started before request rejects fiscal ticket', () => {
    const working = intake(); query(auth(`select public.transition_order_status(${quote(working.order_id)},'washing',null)`));
    rejected(issue(working), /billing_ticket_order_review_required/);
  });
  await t.test('identified consumer and Business use persisted canonical recipient snapshots', () => {
    for (const [customer, requirement, expected] of [[identities.customer,'consumer_identified','SYNTHETIC CUSTOMER'],[identities.business,'business','SYNTHETIC COMPANY']]) {
      const order = intake(9, customer); const issued = JSON.parse(query(auth(issue(order, requirement), identities.manager)).at(-1));
      assert.equal(query(`select customer_name from public.invoices where id=${quote(issued.invoice_id)}`).at(-1), expected);
    }
  });
  await t.test('real simultaneous requests serialize with one invoice, one number and no extra payment', async () => {
    const order = intake(); const before = fingerprint(order);
    const counter = Number(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1));
    const [a, b] = await Promise.all([concurrent(auth(issue(order))), concurrent(auth(issue(order)))]);
    assert.equal(JSON.parse(a).invoice_id, JSON.parse(b).invoice_id);
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(order.order_id)}`).at(-1), '1');
    assert.equal(fingerprint(order), before);
    assert.equal(Number(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1)), counter + 1);
  });
  await t.test('completion of prepaid service creates neither a second invoice nor a second collection', () => {
    const before = fingerprint(first);
    query(auth(`select public.transition_order_status(${quote(first.order_id)},'washing',null);
      select public.transition_order_status(${quote(first.order_id)},'quality_check',null);
      select public.transition_order_status(${quote(first.order_id)},'packing',null);
      select public.transition_order_ready_with_storage(${quote(first.order_id)},${quote(identities.ready)},1,'folded')`));
    assert.equal(query(`select production_status from public.orders where id=${quote(first.order_id)}`).at(-1), 'completed');
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(first.order_id)}`).at(-1), '1');
    assert.equal(fingerprint(first), before);
    assert.equal(JSON.parse(query(auth(issue(first))).at(-1)).invoice_id, document.invoice_id);
    assert.equal(query(`select total-(select sum(case when status='confirmed' then amount when status='refunded' then -amount else 0 end) from public.payments where order_id=o.id) from public.orders o where o.id=${quote(first.order_id)}`).at(-1), '0.00');
  });
  await t.test('ordinary Billing and operational REC still issue through their original independent RPCs', () => {
    const order = intake(); const before = fingerprint(order);
    const draft = query(auth(`select public.create_billing_draft(array[${quote(order.order_id)}::uuid],'A',7,null)`)).at(-1);
    const ordinary = JSON.parse(query(auth(`select row_to_json(x) from public.issue_billing_invoice(${quote(draft)}) x`)).at(-1));
    assert.ok(ordinary.invoice_number.includes('-A-'));
    query(auth(`select public.issue_operational_receipt(${quote(order.order_id)})`));
    rejected(issue(order), /billing_fiscal_history_review_required/);
    rejected(`select public.cancel_billing_invoice(${quote(ordinary.invoice_id)},'Synthetic paid cancellation denied')`, /billing_paid_cancellation_requires_credit_note/);
    assert.equal(fingerprint(order), before);
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(order.order_id)}`).at(-1), '1');
    const historical = intake(0);
    const historicalDraft = query(auth(`select public.create_billing_draft(array[${quote(historical.order_id)}::uuid],'A',7,null)`)).at(-1);
    const historicalInvoice = JSON.parse(query(auth(`select row_to_json(x) from public.issue_billing_invoice(${quote(historicalDraft)}) x`)).at(-1));
    query(auth(`select public.cancel_billing_invoice(${quote(historicalInvoice.invoice_id)},'Synthetic unpaid historical compatibility')`));
    assert.equal(query(`select is_active from public.invoice_orders where invoice_id=${quote(historicalInvoice.invoice_id)}`).at(-1), 'f');
    historical.payment = query(auth(`select public.record_pos_payment(${quote(historical.order_id)},9,'cash',${quote(session)},null,'Synthetic payment',${quote(randomUUID())})`)).at(-1);
    rejected(issue(historical), /billing_fiscal_history_review_required/);
  });
  await t.test('retired partial, final and postservice writers remain absent; helpers cannot be called directly', () => {
    assert.equal(query(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('issue_billing_advance_invoice','issue_billing_final_after_advances','record_pos_postservice_payment','declare_billing_advance_event')`).at(-1), '0');
    rejected(`select public.create_billing_draft_internal(array[${quote(first.order_id)}::uuid],'S',7,null,'simplified','{}')`, /permission denied/);
    assert.equal(query(auth(`select count(*) from public.invoices`, identities.staff)).at(-1), '0');
    assert.equal(query(auth(`select count(*) from public.invoices`, identities.other)).at(-1), '0');
    const signature = 'public.issue_billing_full_prepayment_ticket(uuid,uuid,text,boolean,boolean)';
    assert.equal(query(`select has_function_privilege('anon',${quote(signature)},'EXECUTE'),has_function_privilege('service_role',${quote(signature)},'EXECUTE'),has_function_privilege('authenticated',${quote(signature)},'EXECUTE')`).at(-1), 'f|f|t');
  });
  await t.test('real simultaneous issuance and refund complete without deadlock or rewriting financial facts', async () => {
    const order = intake();
    const results = await Promise.allSettled([
      concurrent(auth(issue(order))),
      concurrent(auth(`select public.record_pos_refund(${quote(order.payment)},1,'Synthetic concurrent refund',${quote(session)},${quote(randomUUID())})`)),
    ]);
    assert.equal(results[1].status, 'fulfilled');
    if (results[0].status === 'rejected') assert.match(results[0].reason.message, /billing_ticket_invalid_payment|billing_advance_event_invalid_payment/);
    assert.equal(query(`select count(*) from public.payments where order_id=${quote(order.order_id)} and status='confirmed'`).at(-1), '1');
    assert.equal(query(`select count(*) from public.payments where order_id=${quote(order.order_id)} and status='refunded'`).at(-1), '1');
    assert.ok(Number(query(`select count(*) from public.invoice_orders where order_id=${quote(order.order_id)}`).at(-1)) <= 1);
  });
  await t.test('pending payment and payment belonging to another order cannot be attributed', () => {
    const pending = intake(0); pending.payment = randomUUID();
    // Administrative fixture setup only: no normal operator writer is bypassed in the RPC under test.
    query(`begin; set local app.app_007_mutation='on'; set local request.jwt.claim.sub=${quote(identities.owner)};
      insert into public.payments(id,organization_id,order_id,amount,method,status,paid_at,recorded_by,pos_session_id,channel,idempotency_key)
      values(${quote(pending.payment)},${quote(identities.org)},${quote(pending.order_id)},9,'cash','pending',now(),${quote(identities.owner)},${quote(session)},'pos',${quote(randomUUID())}); commit;`);
    rejected(issue(pending), /billing_ticket_invalid_payment/);
    rejected(issue({ ...pending, payment: first.payment }), /billing_ticket_invalid_payment/);
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(pending.order_id)}`).at(-1), '0');
  });
  await t.test('rollback after number allocation leaves no invoice, declaration, attribution or counter gap', () => {
    const order = intake(); const before = fingerprint(order);
    const counter = query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1);
    rejected(`${issue(order)}; select 1/0`, /division by zero/);
    for (const table of ['invoice_orders','billing_advance_event_declarations','billing_invoice_payment_links']) assert.equal(query(`select count(*) from public.${table} where order_id=${quote(order.order_id)}`).at(-1), '0');
    assert.equal(query(`select next_value from public.billing_invoice_number_counters where organization_id=${quote(identities.org)} and series='S'`).at(-1), counter);
    assert.equal(fingerprint(order), before);
  });
  await t.test('ordinary draft and ticket compete on the same order without producing two documents', async () => {
    const order = intake(); const before = fingerprint(order);
    const results = await Promise.allSettled([
      concurrent(auth(issue(order))),
      concurrent(auth(`select public.create_billing_draft(array[${quote(order.order_id)}::uuid],'A',7,null)`)),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.match(results.find(r => r.status === 'rejected').reason.message, /billing_order_already_invoiced|billing_fiscal_history_review_required/);
    assert.equal(query(`select count(*) from public.invoice_orders where order_id=${quote(order.order_id)}`).at(-1), '1');
    assert.equal(fingerprint(order), before);
  });
});
