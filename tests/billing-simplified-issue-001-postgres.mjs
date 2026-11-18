// PREPARED ONLY. No top-level queries, connection, Docker or runner changes.
// Future authorized validation must invoke this suite THROUGH the existing
// runner, after core/draft fixtures, ONLY after its empty-database preflight.
// Do not invoke it against the laboratory that already contains retained data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export async function runBillingSimplifiedIssuePostgresTests({ query, concurrentQuery }) {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const org = uuid(1), actor = uuid(2), customer = uuid(3), session = uuid(5);
  const auth = `set test.org = '${org}'; set test.role = 'owner'; set test.billing = 'true'; set test.pos = 'true';`;
  const canonical = (id) => `public.issue_billing_invoice('${id}')`;
  const row = (id) => JSON.parse(query(`select row_to_json(i) from public.invoices i where id = '${id}';`));
  const counters = () => query("select json_agg(c order by c.organization_id, c.series) from public.billing_invoice_number_counters c;");
  const ledger = () => query("select json_agg(p order by p.id) from public.payments p;");
  const issue = (id) => query(`${auth} set role authenticated; select * from ${canonical(id)};`).split("\n").at(-1);
  function fails(id, message, context = auth) {
    const before = row(id), count = counters(), money = ledger();
    query(`${context} do $test$ begin
      begin perform ${canonical(id)}; exception when others then
        if sqlerrm = '${message}' then return; end if; raise;
      end; raise exception 'Expected ${message}'; end $test$;`);
    assert.deepEqual(row(id), before); assert.equal(counters(), count); assert.equal(ledger(), money);
  }
  function prepare(n, { mixed = false, named = false } = {}) {
    query(`${auth}
      insert into public.orders (id, organization_id, customer_id) values ('${uuid(n)}', '${org}', '${named ? uuid(4) : customer}');
      insert into public.order_items (id, organization_id, order_id) values ('${uuid(n + 1000)}', '${org}', '${uuid(n)}');
      insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
      values ('${uuid(n + 2000)}', '${org}', '${uuid(n)}', ${mixed ? 5 : 13}, 'cash', '${session}', '${actor}', '${actor}');
      ${mixed ? `insert into public.payments (id, organization_id, order_id, amount, method, pos_session_id, recorded_by, confirmed_by)
        values ('${uuid(n + 3000)}', '${org}', '${uuid(n)}', 8, 'card', '${session}', '${actor}', '${actor}');` : ""}`);
    return query(`${auth} select public.create_simplified_billing_draft('${uuid(n)}', 'S');`).split("\n").at(-1);
  }
  const economy = (snapshot) => Object.fromEntries(Object.entries(snapshot).filter(([key]) => ![
    "document_status", "invoice_number", "sequence_number", "issue_date", "issued_at", "updated_at", "updated_by",
  ].includes(key)));

  // The minimal original source fixture omitted this real organization column.
  query("alter table public.organizations add column timezone text not null default 'Atlantic/Canary';");
  const ordinaryBefore = query("select pg_get_functiondef('public.issue_billing_invoice(uuid)'::regprocedure);");
  const existingOrdinary = query("select json_agg(i order by i.id) from public.invoices i where fiscal_document_type = 'ordinaria';");
  query(read("supabase/migrations/20261118211638_billing_simplified_issue_001.sql"));
  assert.equal(query("select pg_get_functiondef('public.issue_ordinary_billing_invoice(uuid)'::regprocedure);")
    .replace("FUNCTION public.issue_ordinary_billing_invoice(", "FUNCTION public.issue_billing_invoice("), ordinaryBefore);
  assert.equal(query("select json_agg(i order by i.id) from public.invoices i where fiscal_document_type = 'ordinaria';"), existingOrdinary);
  query(`${auth} set role authenticated; do $$ begin
    begin perform public.issue_ordinary_billing_invoice('${uuid(999)}');
    exception when insufficient_privilege then return; end;
    raise exception 'Ordinary bypass must be denied'; end $$;`);

  const single = prepare(201, { mixed: true }), before = row(single);
  const itemBefore = query(`select json_agg(i order by i.id) from public.invoice_items i where invoice_id = '${single}';`);
  const moneyBefore = ledger(); const issued = issue(single), snapshot = row(single);
  assert.match(issued, new RegExp(`^${single}\\|[0-9]{4}-S-[0-9]{6}$`));
  assert.equal(snapshot.document_status, "issued"); assert.deepEqual(economy(snapshot), economy(before));
  assert.equal(snapshot.customer_name, null); assert.equal(snapshot.customer_tax_id, null);
  assert.equal(snapshot.total, 13); assert.equal(snapshot.tax_total, .85);
  assert.equal(query(`select json_agg(i order by i.id) from public.invoice_items i where invoice_id = '${single}';`), itemBefore);
  assert.equal(ledger(), moneyBefore);
  assert.equal(query(`select issue_date = (issued_at at time zone 'Atlantic/Canary')::date from public.invoices where id = '${single}';`), "t");
  const counted = counters(); assert.equal(issue(single), issued); assert.equal(counters(), counted); assert.deepEqual(row(single), snapshot);
  fails(single, "billing_not_authorized", `${auth} set test.role = 'staff';`);
  fails(single, "billing_entitlement_required", `${auth} set test.billing = 'false';`);
  fails(single, "pos_not_authorized", `${auth} set test.pos = 'false';`);
  fails(single, "billing_invalid_draft", `${auth} set test.org = '${uuid(99)}';`);

  const concurrent = prepare(202), cashBefore = ledger();
  const [a, b] = await Promise.all([
    concurrentQuery(`${auth} begin; select * from ${canonical(concurrent)}; select pg_sleep(0.5); commit;`),
    concurrentQuery(`${auth} begin; select * from ${canonical(concurrent)}; commit;`),
  ]);
  const identity = (output, id) => output.split("\n").find((line) => line.startsWith(`${id}|`));
  assert.ok(identity(a, concurrent)); assert.equal(identity(a, concurrent), identity(b, concurrent));
  assert.equal(query(`select count(*) from public.invoice_orders where invoice_id = '${concurrent}' and is_active;`), "1");
  assert.equal(ledger(), cashBefore);
  const one = prepare(203), two = prepare(204, { named: true });
  const [issuedOne, issuedTwo] = await Promise.all([
    concurrentQuery(`${auth} select * from ${canonical(one)};`), concurrentQuery(`${auth} select * from ${canonical(two)};`),
  ]);
  assert.notEqual(identity(issuedOne, one).split("|")[1], identity(issuedTwo, two).split("|")[1]);
  assert.equal(row(two).customer_name, "Named fixture");

  const partial = prepare(205); query(`update public.payments set amount = 5 where order_id = '${uuid(205)}';`);
  fails(partial, "billing_order_not_fully_paid");
  const refunded = prepare(206);
  query(`insert into public.payments (id, organization_id, order_id, amount, method, status, pos_session_id, recorded_by, confirmed_by, refunded_from_payment_id)
    values ('${uuid(6206)}', '${org}', '${uuid(206)}', 3, 'cash', 'refunded', '${session}', '${actor}', '${actor}', '${uuid(2206)}');`);
  fails(refunded, "billing_order_not_fully_paid");
  const badSession = prepare(207, { mixed: true });
  query(`update public.payments set pos_session_id = null where order_id = '${uuid(207)}' and method = 'card';`);
  fails(badSession, "billing_pos_registration_unverified");
  const changed = prepare(208); query(`update public.order_items set description = 'Changed source' where order_id = '${uuid(208)}';`);
  fails(changed, "billing_simplified_draft_incompatible");
  const incomplete = prepare(209);
  query(`${auth} select set_config('app.billing_mutation', 'on', false); update public.invoices set issuer_tax_id = null where id = '${incomplete}';`);
  fails(incomplete, "billing_issuer_configuration_required");
  // The preceding draft suite deliberately retained a mixed-rate negative fixture.
  const mixedRate = query(`select invoice_id from public.invoice_orders where order_id = '${uuid(14)}';`);
  fails(mixedRate, "billing_simplified_tax_model_unsupported");

  // Synthetic failure AFTER number allocation: invoice and counter must both
  // roll back. This retained test trigger targets only this negative fixture.
  const aborting = prepare(211);
  query(`create function public.test_abort_simplified_issue() returns trigger language plpgsql as $$
      begin raise exception 'synthetic_issue_abort_after_allocation'; end $$;
    create trigger test_simplified_issue_abort after update on public.invoices
    for each row when (new.id = '${aborting}'::uuid and new.document_status = 'issued')
    execute function public.test_abort_simplified_issue();`);
  fails(aborting, "synthetic_issue_abort_after_allocation");

  query(`${auth} select set_config('app.billing_mutation', 'on', false);
    do $$ begin
      begin update public.invoices set issuer_logo_path = 'changed' where id = '${single}';
      exception when others then if sqlerrm = 'billing_issued_snapshot_immutable' then return; end if; raise; end;
      raise exception 'Header must remain immutable'; end $$;
    do $$ begin
      begin update public.invoice_items set description = 'changed' where invoice_id = '${single}';
      exception when others then if sqlerrm = 'billing_issued_snapshot_immutable' then return; end if; raise; end;
      raise exception 'Items must remain immutable'; end $$;
    do $$ begin
      begin update public.invoice_orders set is_active = false where invoice_id = '${single}';
      exception when others then if sqlerrm = 'billing_issued_snapshot_immutable' then return; end if; raise; end;
      raise exception 'Order link must remain immutable'; end $$;`);
  assert.deepEqual(row(single), snapshot);
  // A refund after issue changes current payment state, never issued identity.
  query(`insert into public.payments (id, organization_id, order_id, amount, method, status, pos_session_id, recorded_by, confirmed_by, refunded_from_payment_id)
    values ('${uuid(6201)}', '${org}', '${uuid(201)}', 1, 'cash', 'refunded', '${session}', '${actor}', '${actor}', '${uuid(2201)}');`);
  const afterRefundCounters = counters(); assert.equal(issue(single), issued);
  assert.deepEqual(row(single), snapshot); assert.equal(counters(), afterRefundCounters);

  // Real ordinary issuance/retry/cancellation still delegates to the same body.
  query(`${auth} insert into public.orders (id, organization_id, customer_id) values ('${uuid(210)}', '${org}', '${uuid(92)}');
    insert into public.order_items (id, organization_id, order_id) values ('${uuid(1210)}', '${org}', '${uuid(210)}');`);
  const ordinary = query(`${auth} select public.create_billing_draft(array['${uuid(210)}']::uuid[]);`).split("\n").at(-1);
  const ordinaryIssue = issue(ordinary), ordinarySnapshot = row(ordinary), ordinaryCounters = counters();
  assert.equal(issue(ordinary), ordinaryIssue); assert.deepEqual(row(ordinary), ordinarySnapshot); assert.equal(counters(), ordinaryCounters);
  query(`${auth} select public.cancel_billing_invoice('${ordinary}', 'Synthetic ordinary regression');`);
  assert.equal(row(ordinary).document_status, "cancelled");
  assert.equal(query("select value from public.operational_receipt_sentinel;"), "unchanged");
  console.log("PASS simplified issuance SQL: single/retry/concurrent, distinct numbers, mixed POS, partial/refund/session/source blocks, tenant/auth, immutable snapshots, ordinary regression");
  console.log("Synthetic source/auth/POS fixtures only; full Supabase RLS, real POS/refund concurrency and legal eligibility remain separate validation gates.");
}
