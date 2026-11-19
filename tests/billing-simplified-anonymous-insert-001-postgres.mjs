// PREPARED, NOT EXECUTED in BILLING-SIMPLIFIED-UI-001.
// Export only: no connection, automatic runner, environment or cleanup.
// Requires the existing Billing PostgreSQL suites' controlled source/auth
// fixtures and separate CTO authorization. Never invoke against Toshiba/Auth.
// No issue RPC is called: all generated documents are unnumbered drafts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export async function runBillingAnonymousInsertPostgresTests({ query, concurrentQuery }) {
  assert.match(query("select pg_get_functiondef('public.app_current_organization_id()'::regprocedure);"), /test\.org/,
    "Controlled synthetic Auth fixture required; not a Supabase runtime");
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const org = uuid(9001), foreignOrg = uuid(9002), shared = uuid(9101), named = uuid(9102), session = uuid(9201), actor = uuid(2);
  const auth = `set test.org = '${org}'; set test.role = 'owner'; set test.billing = 'true'; set test.entitled = 'true'; set test.pos = 'true';`;
  const rpc = (n) => `public.create_simplified_billing_draft('${uuid(n)}', 'ANON-S')`;
  const snapshot = (table) => query(`select coalesce(json_agg(t order by t.id)::text, '[]') from public.${table} t;`);
  const headersBefore = snapshot("invoices");
  const issueBefore = query("select pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure);");
  const oidBefore = query("select 'public.create_billing_draft(uuid[],text,numeric,text)'::regprocedure::oid;");
  const counters = () => query("select coalesce(json_agg(c order by c.organization_id, c.series)::text, '[]') from public.billing_invoice_number_counters c;");
  const countersBefore = counters();
  query(readFileSync(new URL("../supabase/migrations/20261119115411_billing_simplified_anonymous_insert_001.sql", import.meta.url), "utf8"));
  assert.equal(snapshot("invoices"), headersBefore);
  assert.equal(query("select pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure);"), issueBefore);
  assert.equal(query("select 'public.create_billing_draft(uuid[],text,numeric,text)'::regprocedure::oid;"), oidBefore);
  assert.equal(query("select has_function_privilege('authenticated', 'public.create_billing_draft_for_type(uuid[],text,numeric,text,text)', 'execute');"), "f");
  assert.equal(query("select has_function_privilege('anon', 'public.create_billing_draft_for_type(uuid[],text,numeric,text,text)', 'execute');"), "f");
  assert.equal(query("select tgenabled from pg_trigger where tgrelid = 'public.invoices'::regclass and tgname = 'invoices_prevent_shared_walk_in';"), "O");

  query(`${auth}
    insert into public.organizations(id, name) values ('${org}', 'Anonymous insert fixture'), ('${foreignOrg}', 'Foreign fixture');
    insert into public.customers(id, organization_id, customer_code, display_name, tax_id,
      billing_address_line1, billing_city, billing_postal_code, billing_country_code, email) values
      ('${shared}', '${org}', 'WALKIN-SHARED', 'Technical management name', null, null, null, null, null, null),
      ('${named}', '${org}', 'C-ANON-TEST', 'Stored named customer', 'NAMED-NIF', 'Stored street', 'Stored city', '00000', 'ES', 'named@example.invalid'),
      ('${uuid(9103)}', '${foreignOrg}', 'WALKIN-SHARED', 'Foreign management name', null, null, null, null, null, null);
    insert into public.organization_billing_settings(organization_id, issuer_legal_name, issuer_tax_id,
      issuer_address_line1, issuer_city, issuer_postal_code, issuer_country_code, default_tax_rate)
      values ('${org}', 'Synthetic issuer', 'SYNTHETIC', 'Street', 'City', '00000', 'ES', 7);
    insert into public.pos_sessions(id, organization_id) values ('${session}', '${org}');
  `);
  for (const n of [9301, 9302, 9303, 9304, 9305, 9306, 9307]) {
    query(`insert into public.orders(id, organization_id, customer_id, subtotal, discount_amount, total)
      values ('${uuid(n)}', '${n === 9304 ? foreignOrg : org}', '${n === 9304 ? uuid(9103) : n === 9302 || n === 9307 ? named : shared}', 14, 1, 13);
      insert into public.order_items(id, organization_id, order_id, quantity, unit_price, line_total)
      values ('${uuid(n + 1000)}', '${n === 9304 ? foreignOrg : org}', '${uuid(n)}', 2, 7, 14);
      ${n !== 9304 ? `insert into public.payments(id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
      values ('${uuid(n + 2000)}', '${org}', '${uuid(n)}', ${n === 9301 || n === 9305 ? 5 : 13}, 'cash', '${session}', '${actor}', '${actor}');` : ""}`);
  }
  query(`insert into public.payments(id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
    values ('${uuid(12301)}', '${org}', '${uuid(9301)}', 8, 'card', '${session}', '${actor}', '${actor}');`);
  const ledgerBefore = snapshot("payments");
  function fails(statement, message, context = auth) {
    query(`${context} do $test$ begin
      begin perform ${statement}; exception when others then
        if sqlerrm = '${message}' then return; end if; raise;
      end; raise exception 'Expected ${message}'; end $test$;`);
  }
  const ordinary = (n) => `public.create_billing_draft(array['${uuid(n)}']::uuid[])`;
  fails(ordinary(9303), "billing_registered_customer_required");
  assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(9303)}';`), "0");
  fails(rpc(9305), "billing_order_not_fully_paid");
  fails(rpc(9301), "billing_not_authorized", `${auth} set test.role = 'staff';`);
  fails(rpc(9301), "billing_entitlement_required", `${auth} set test.billing = 'false';`);
  fails(rpc(9301), "pos_not_authorized", `${auth} set test.pos = 'false';`);
  fails(rpc(9301), "billing_invalid_orders", `${auth} set test.org = '${foreignOrg}';`);
  fails(rpc(9304), "billing_invalid_orders");

  const create = (n) => query(`${auth} set role authenticated; select ${rpc(n)};`).split("\n").at(-1);
  const draft = create(9301);
  const row = JSON.parse(query(`select row_to_json(i) from public.invoices i where id = '${draft}';`));
  assert.equal(row.fiscal_document_type, "simplificada"); assert.equal(row.document_status, "draft");
  for (const field of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_address_line2", "customer_city", "customer_postal_code", "customer_country_code", "customer_email", "invoice_number", "sequence_number", "issued_at"]) assert.equal(row[field], null);
  assert.deepEqual([row.total, row.taxable_base, row.tax_total], [13, 12.15, .85]);
  assert.equal(create(9301), draft);
  assert.deepEqual(JSON.parse(query(`select row_to_json(i) from public.invoices i where id = '${draft}';`)), row);
  fails(ordinary(9301), "billing_order_already_invoiced");
  query(`${auth} select set_config('app.billing_mutation', 'on', false);
    do $$ begin
      begin update public.invoices set customer_name = 'Invented identity' where id = '${draft}';
      exception when others then if sqlerrm = 'billing_simplified_recipient_mismatch' then return; end if; raise; end;
      raise exception 'Anonymous snapshot edit must be blocked'; end $$;`);
  const namedDraft = create(9302);
  const ordinaryNamed = query(`${auth} select ${ordinary(9307)};`).split("\n").at(-1);
  for (const [id, type] of [[namedDraft, "simplificada"], [ordinaryNamed, "ordinaria"]]) {
    const invoice = JSON.parse(query(`select row_to_json(i) from public.invoices i where id = '${id}';`));
    assert.equal(invoice.fiscal_document_type, type);
    assert.deepEqual([invoice.customer_name, invoice.customer_tax_id, invoice.customer_address_line1, invoice.total, invoice.tax_total],
      ["Stored named customer", "NAMED-NIF", "Stored street", 13, .85]);
  }
  const [first, retry] = await Promise.all([
    concurrentQuery(`${auth} begin; select ${rpc(9306)}; select pg_sleep(0.2); commit;`),
    concurrentQuery(`${auth} select ${rpc(9306)};`),
  ]);
  const identity = (result) => result.split("\n").find((line) => /^[0-9a-f-]{36}$/.test(line));
  assert.ok(identity(first)); assert.equal(identity(first), identity(retry));
  assert.equal(query(`select count(*) from public.invoice_orders where order_id = '${uuid(9306)}' and is_active;`), "1");
  assert.equal(snapshot("payments"), ledgerBefore); assert.equal(counters(), countersBefore);
  assert.equal(query(`select count(*) from public.invoices where organization_id = '${org}' and (document_status <> 'draft' or invoice_number is not null or sequence_number is not null or issued_at is not null);`), "0");
  console.log("PASS anonymous typed draft insertion: trigger, null snapshot, ordinary block, identified regression, retry/concurrency, roles/tenant/POS and unchanged payment/counter facts (synthetic Auth fixtures)");
}
