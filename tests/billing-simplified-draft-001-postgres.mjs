// Invoked after the core suite by billing-postgres-test-runner-001.mjs.
// Real Billing SQL, shared synthetic auth/source tables; not Supabase RLS UAT.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export async function runBillingDraftPostgresTests({ query, concurrentQuery }) {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const org = uuid(1), actor = uuid(2), shared = uuid(3), named = uuid(4), session = uuid(5);
  const auth = `set test.org = '${org}'; set test.role = 'owner'; set test.billing = 'true'; set test.pos = 'true';`;
  const rpc = (order, series = "S") => `public.create_simplified_billing_draft('${uuid(order)}', '${series}')`;
  function fails(statement, message, context = auth) {
    query(`${context} do $test$ begin
      begin perform ${statement}; exception when others then
        if sqlerrm = '${message}' then return; end if; raise;
      end; raise exception 'Expected ${message}'; end $test$;`);
  }
  function newOrder(n, { customer = shared, paid = 13, mixed = false, tenant = org } = {}) {
    query(`insert into public.orders (id, organization_id, customer_id) values ('${uuid(n)}', '${tenant}', '${customer}');
      insert into public.order_items (id, organization_id, order_id) values ('${uuid(n + 1000)}', '${tenant}', '${uuid(n)}');
      insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
      values ('${uuid(n + 2000)}', '${tenant}', '${uuid(n)}', ${mixed ? 5 : paid}, 'cash', '${session}', '${actor}', '${actor}');
      ${mixed ? `insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
        values ('${uuid(n + 3000)}', '${tenant}', '${uuid(n)}', 8, 'card', '${session}', '${actor}', '${actor}');` : ""}`);
  }
  const json = (sql) => JSON.parse(query(sql));

  // Reuse the preceding core suite's source tables, auth resolvers and real
  // Billing objects. Change only synthetic defaults for the existing draft cases.
  query(`alter table public.orders alter column subtotal set default 14,
      alter column discount_amount set default 1, alter column total set default 13;
    alter table public.order_items alter column unit_price set default 7, alter column line_total set default 14;
    create table public.operational_receipt_sentinel (value text);
    insert into public.operational_receipt_sentinel values ('unchanged');`);
  const paymentsSql = read("supabase/migrations/20260728000300_app_007_logistics_photos_payments.sql");
  const start = paymentsSql.indexOf("create function public.get_order_payment_summary(");
  query(paymentsSql.slice(start, paymentsSql.indexOf("$$;", start) + 3));
  const countersBefore = query("select json_agg(c order by c.organization_id, c.series) from public.billing_invoice_number_counters c;");
  const ordinaryDefinition = query("select pg_get_functiondef('public.create_billing_draft(uuid[],text,numeric,text)'::regprocedure);");
  query(read("supabase/migrations/20261118195512_billing_simplified_draft_001.sql"));
  assert.equal(query("select pg_get_functiondef('public.create_billing_draft(uuid[],text,numeric,text)'::regprocedure);"), ordinaryDefinition);
  query(`${auth}
    insert into public.customers (id, organization_id, customer_code, display_name) values
      ('${shared}', '${org}', 'WALKIN-SHARED', 'Technical operational name'), ('${named}', '${org}', 'C-1', 'Named fixture');
    insert into public.pos_sessions (id, organization_id) values ('${session}', '${org}');
  `);
  newOrder(10, { mixed: true }); newOrder(11, { customer: named }); newOrder(12, { paid: 5 });
  newOrder(13); newOrder(14); newOrder(15); newOrder(16); newOrder(17, { mixed: true }); newOrder(18);
  newOrder(19, { customer: named }); newOrder(20);
  query(`update public.orders set subtotal = 0.30, discount_amount = 0, total = 0.30 where id = '${uuid(20)}';
    update public.order_items set quantity = 3, unit_price = 0.10, line_total = 0.30 where order_id = '${uuid(20)}';
    update public.payments set amount = 0.10 where order_id = '${uuid(20)}';
    insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
      values ('${uuid(3020)}', '${org}', '${uuid(20)}', 0.20, 'card', '${session}', '${actor}', '${actor}');`);
  // Synthetic issued ordinary fixture; no issue RPC or counter is invoked.
  const issued = query(`${auth} select public.create_billing_draft(array['${uuid(19)}']::uuid[]);`).split("\n").at(-1);
  query(`${auth} select set_config('app.billing_mutation', 'on', false);
    update public.invoices set series = 'FIXTURE', document_status = 'issued', invoice_number = 'FIXTURE-ISSUED',
      sequence_number = 1, issued_at = now() where id = '${issued}';`);
  const issuedBefore = json(`select row_to_json(i) from public.invoices i where id = '${issued}';`);
  const financialBefore = query("select json_agg(p order by p.id) from public.payments p;");
  const draft = query(`${auth} set role authenticated; select ${rpc(10)};`).split("\n").at(-1);
  const snapshot = json(`select row_to_json(i) from public.invoices i where id = '${draft}';`);
  assert.equal(snapshot.fiscal_document_type, "simplificada"); assert.equal(snapshot.total, 13);
  assert.equal(snapshot.taxable_base, 12.15); assert.equal(snapshot.tax_total, .85);
  for (const field of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_address_line2", "customer_city", "customer_postal_code", "customer_country_code", "customer_email", "invoice_number", "sequence_number", "issued_at"]) assert.equal(snapshot[field], null);
  assert.equal(query(`${auth} select ${rpc(10)};`).split("\n").at(-1), draft);
  assert.deepEqual(json(`select row_to_json(i) from public.invoices i where id = '${draft}';`), snapshot);
  const namedDraft = query(`${auth} select ${rpc(11)};`).split("\n").at(-1);
  assert.equal(query(`select customer_name from public.invoices where id = '${namedDraft}';`), "Named fixture");
  fails(rpc(12), "billing_order_not_fully_paid");
  assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(12)}';`), "0");
  fails(rpc(10, "T"), "billing_simplified_draft_conflict");
  fails(rpc(10), "billing_not_authorized", `${auth} set test.role = 'staff';`);
  fails(rpc(10), "billing_entitlement_required", `${auth} set test.billing = 'false';`);
  fails(rpc(10), "pos_not_authorized", `${auth} set test.pos = 'false';`);
  fails(rpc(10), "billing_invalid_orders", `${auth} set test.org = '${uuid(99)}';`);
  query(`${auth} select public.create_billing_draft(array['${uuid(13)}']::uuid[]);`);
  fails(rpc(13), "billing_simplified_draft_conflict");
  fails(rpc(19), "billing_simplified_draft_conflict");
  assert.deepEqual(json(`select row_to_json(i) from public.invoices i where id = '${issued}';`), issuedBefore);
  query(`${auth} select ${rpc(20)};`);
  assert.deepEqual(json(`select json_build_array(total, taxable_base, tax_total) from public.invoices
    where id = (select invoice_id from public.invoice_orders where order_id = '${uuid(20)}');`), [0.30, 0.28, 0.02]);
  // Mixed/inconsistent drafts are never normalized or replaced during reuse.
  query(`${auth} select ${rpc(14)};
    select set_config('app.billing_mutation', 'on', false);
    insert into public.invoice_items (organization_id, invoice_id, source_order_id, source_order_item_id,
      description, unit_type, quantity, unit_price, line_subtotal, discount_amount, taxable_base, tax_rate, tax_amount, line_total, prices_include_tax, display_order)
    select organization_id, invoice_id, source_order_id, source_order_item_id, description, unit_type, quantity, unit_price,
      line_subtotal, discount_amount, 12.62, 3, 0.38, line_total, true, 2
    from public.invoice_items where source_order_id = '${uuid(14)}';`);
  fails(rpc(14), "billing_simplified_tax_model_unsupported");
  query(`${auth} select ${rpc(15)}; update public.order_items set description = 'Changed' where order_id = '${uuid(15)}';`);
  fails(rpc(15), "billing_simplified_draft_incompatible");
  // Failed second step must roll back the intermediate ordinary draft as well.
  fails(rpc(16, "A"), "billing_series_document_type_conflict");
  assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(16)}';`), "0");
  query(`update public.payments set pos_session_id = null where order_id = '${uuid(17)}' and method = 'card';`);
  fails(rpc(17), "billing_pos_registration_unverified");
  query(`update public.payments set pos_session_id = '${session}' where order_id = '${uuid(17)}';`);
  const [first, second] = await Promise.all([
    concurrentQuery(`${auth} begin; select ${rpc(18)}; select pg_sleep(0.5); commit;`),
    concurrentQuery(`${auth} begin; select ${rpc(18)}; commit;`),
  ]);
  const idFrom = (output) => output.split("\n").find((line) => /^[0-9a-f-]{36}$/.test(line));
  assert.ok(idFrom(first)); assert.equal(idFrom(first), idFrom(second));
  assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(18)}' and is_active;`), "1");
  assert.equal(query("select json_agg(p order by p.id) from public.payments p;"), financialBefore);
  assert.equal(query("select value from public.operational_receipt_sentinel;"), "unchanged");
  assert.equal(query("select json_agg(c order by c.organization_id, c.series) from public.billing_invoice_number_counters c;"), countersBefore);
  assert.equal(query("select count(*) from public.invoices where fiscal_document_type = 'simplificada' and (invoice_number is not null or sequence_number is not null or issued_at is not null);"), "0");
  console.log("PASS: real Billing RPC creation, atomic rollback, idempotency/concurrency, tenant/auth, full/mixed/partial POS, snapshots and no financial/numbering mutations");
}
