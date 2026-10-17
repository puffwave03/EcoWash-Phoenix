import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// SQL source contracts, not PostgreSQL execution/RLS/concurrency proof.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql");
const pricing = read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql");
const foundation = read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
const history = read("supabase/migrations/20261004000300_data_retention_scale_001h_billing_sales_document_history.sql");
const functions = (source, name) => [...source.matchAll(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "g"))].map((m) => m[0]);
const engine = functions(sql, "create_billing_draft_internal")[0];
const creation = functions(sql, "create_billing_draft");
const edits = functions(sql, "update_billing_draft");
const issue = functions(sql, "issue_billing_invoice")[0];

test("four-argument and explicit six-argument signatures delegate to one canonical engine", () => {
  assert.equal(creation.length, 2);
  assert.match(creation[0], /target_series text default null,[\s\S]*target_tax_rate numeric default null, target_notes text default null/);
  assert.match(creation[0], /'ordinary'::public.billing_fiscal_document_type, null::jsonb/);
  assert.match(creation[1], /target_fiscal_document_type public.billing_fiscal_document_type, target_recipient_snapshot jsonb/);
  for (const wrapper of creation) {
    assert.match(wrapper, /security definer set search_path = public/);
    assert.match(wrapper, /select public.create_billing_draft_internal\(/);
    assert.doesNotMatch(wrapper, /insert into|invoice_items|organization_id/);
  }
  assert.match(sql, /revoke all on function public.create_billing_draft_internal\(uuid\[\], text, numeric, text, public.billing_fiscal_document_type, jsonb\) from public, anon, authenticated/);
});

test("engine authenticates role/entitlement/organization and retains unchanged financial allocation", () => {
  assert.match(engine, /org_id uuid := public.app_current_organization_id\(\)/);
  assert.match(engine, /org_id is null or not public.has_organization_role/);
  assert.match(engine, /not public.organization_entitlement_is_enabled\(org_id, 'billing.invoicing', now\(\)\)/);
  const canonical = functions(pricing, "create_billing_draft")[0];
  const start = "  insert into public.invoice_orders";
  assert.equal(engine.slice(engine.indexOf(start)), canonical.slice(canonical.indexOf(start)));
  assert.doesNotMatch(engine, /billing_invoice_number_counters|sequence_number\s*[:=]|invoice_number\s*[:=]/);
});

test("ordinary recipient remains canonical; simplified NULL identity never copies WALKIN-SHARED", () => {
  assert.match(engine, /if target_fiscal_document_type = 'ordinary' then\s+if target_recipient_snapshot is not null then/);
  assert.match(engine, /recipient := public.normalize_billing_recipient_snapshot\(target_recipient_snapshot\)/);
  assert.match(engine, /when recipient ->> 'recipient_snapshot_mode' = 'identified'\s+and customer.customer_code is distinct from 'WALKIN-SHARED' then customer.id\s+else null end/);
  for (const field of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_city", "customer_postal_code", "customer_country_code"]) assert.ok(engine.includes(`recipient ->> '${field}'`));
  assert.match(sql, /when fiscal_document_type = 'ordinary' then[\s\S]*?customer_id is not null and customer_name is not null/);
  assert.doesNotMatch(sql, /drop trigger|create (?:or replace )?function public.prevent_shared_walk_in_invoice|drop.*invoices_customer_same_organization|grant (?:insert|update|delete|all)/i);
  assert.match(foundation, /references public.customers \(organization_id, id\)/);
});

test("recipient JSON is a closed normalized contract, with no tenant or permanent-customer override", () => {
  const parser = functions(sql, "normalize_billing_recipient_snapshot")[0];
  assert.match(parser, /not \(target_snapshot \?& required_keys\) or target_snapshot - required_keys <> '\{\}'::jsonb/);
  assert.match(parser, /target_snapshot -> 'customer_id' is distinct from 'null'::jsonb/);
  assert.match(parser, /jsonb_each\(target_snapshot - 'recipient_snapshot_mode'\)/);
  assert.match(parser, /e.value <> 'null'::jsonb/);
  assert.match(parser, /jsonb_typeof\(target_snapshot -> field_name\) is distinct from 'string'/);
  assert.match(parser, /set search_path = public/);
  assert.doesNotMatch(parser, /organization_id|insert into|update public/);
});

test("only the ordinary-only constraint is replaced, with simplified drafts only and no activation", () => {
  assert.deepEqual([...sql.matchAll(/drop constraint (\w+)/g)].map((m) => m[1]), ["invoices_fiscal_document_type_ordinary_only"]);
  assert.match(sql, /add constraint invoices_simplified_draft_only check \(\s*fiscal_document_type = 'ordinary' or document_status = 'draft'\s*\)/);
  assert.doesNotMatch(sql, /drop constraint organization_billing_settings_simplified_disabled|simplified_invoicing_enabled\s*=\s*true|not valid|disable trigger/i);
  assert.ok(issue.indexOf("billing_simplified_issuance_disabled") < issue.indexOf("insert into public.billing_invoice_number_counters"));
  const guard = "  if invoice_row.fiscal_document_type = 'simplified' then\n    raise exception 'billing_simplified_issuance_disabled' using errcode = '55000';\n  end if;\n\n";
  assert.equal(issue.replace(guard, ""), functions(pricing, "issue_billing_invoice")[0]);
});

test("ordered order locks, typed reserved series and unchanged active-link uniqueness arbitrate races", () => {
  assert.match(engine, /order by customer_order.id for update/);
  assert.match(engine, /cardinality\(target_order_ids\) <> 1/);
  assert.match(engine, /select settings.simplified_series, round\(settings.default_tax_rate,4\)/);
  assert.match(engine, /where settings.organization_id = org_id for share/);
  assert.match(engine, /billing_simplified_series_required/);
  assert.match(engine, /exception when unique_violation then\s+raise exception 'billing_order_already_invoiced'/);
  assert.match(foundation, /create unique index invoice_orders_one_active_invoice_per_order\s+on public.invoice_orders \(order_id\)\s+where is_active/);
  assert.doesNotMatch(sql, /drop index|drop.*series_ownership|create sequence/i);
});

test("recipient edits lock the actual tenant draft and use the same financial edit RPC", () => {
  assert.equal(edits.length, 2);
  for (const edit of edits) {
    assert.match(edit, /i.organization_id = org_id and i.id = target_invoice_id for update/);
    assert.match(edit, /locked_invoice.document_status <> 'draft'/);
  }
  assert.match(edits[1], /locked_invoice.fiscal_document_type <> 'simplified'/);
  assert.match(edits[1], /perform public.update_billing_draft\(target_invoice_id, target_issue_date, target_due_date,\s*target_series, target_tax_rate, target_notes\)/);
  assert.match(edits[1], /customer_id = case when recipient ->> 'recipient_snapshot_mode' = 'identified' then source_customer_id else null end/);
  assert.match(edits[1], /link.organization_id = org_id and link.invoice_id = target_invoice_id and link.is_active/);
  assert.match(edits[1], /c.customer_code is distinct from 'WALKIN-SHARED'/);
  assert.doesNotMatch(edits[1], /update public\.invoice_orders|insert into public\.invoice_orders|invoice_items|billing_invoice_number_counters/);
  const marker = "  perform set_config('app.billing_mutation', 'on', true);";
  const canonical = functions(pricing, "update_billing_draft")[0];
  assert.equal(edits[0].slice(edits[0].indexOf(marker)), canonical.slice(canonical.indexOf(marker)));
});

test("Billing order-number search remains functional with NULL anonymous names and unchanged tenant gates", () => {
  const listing = functions(sql, "list_billing_invoices_page")[0];
  const canonical = functions(history, "list_billing_invoices_page")[0];
  assert.equal(listing.replace("create or replace function", "create function").replace("coalesce(e.customer_name, '')", "e.customer_name"), canonical);
  assert.doesNotMatch(sql, /create policy|alter policy|disable row level security|grant select/i);
});

test("migration top level changes only schema/functions and grants explicit public overloads", () => {
  const topLevel = sql.replace(/create (?:or replace )?function [\s\S]*?\$\$;/g, "").replace(/--[^\n]*/g, "");
  assert.doesNotMatch(topLevel, /insert into|update public\.|delete from|truncate|create table|create sequence/i);
  assert.equal((topLevel.match(/grant execute/g) ?? []).length, 2);
  assert.match(sql, /revoke all on function public.normalize_billing_recipient_snapshot\(jsonb\) from public, anon, authenticated/);
  assert.match(topLevel, /grant execute on function public.create_billing_draft\(uuid\[\], text, numeric, text, public.billing_fiscal_document_type, jsonb\) to authenticated/);
  assert.match(topLevel, /grant execute on function public.update_billing_draft\(uuid, date, date, text, numeric, text, jsonb\) to authenticated/);
});
