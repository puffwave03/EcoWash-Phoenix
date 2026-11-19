import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261119115411_billing_simplified_anonymous_insert_001.sql");
const oldBuilder = read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql");
const oldDraft = read("supabase/migrations/20261118195512_billing_simplified_draft_001.sql");
function definition(source, name) {
  const begin = source.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`));
  assert.ok(begin >= 0, name);
  return source.slice(begin, source.indexOf("$$;", begin) + 3);
}
const builder = definition(sql, "create_billing_draft_for_type");
const ordinary = definition(sql, "create_billing_draft");
const simplified = definition(sql, "create_simplified_billing_draft");
const trigger = definition(sql, "prevent_shared_walk_in_invoice");

// Static contract/regression evidence only. Real trigger/ACL/transaction
// execution belongs to the separately prepared PostgreSQL test, not these tests.
test("type is inserted explicitly; ordinary public signature has a fixed ordinary type", () => {
  assert.match(builder, /insert into public\.invoices \(\s+organization_id,\s+customer_id,\s+fiscal_document_type,/);
  assert.match(builder, /select\s+org_id,\s+customer.id,\s+target_document_type,/);
  assert.match(ordinary, /target_order_ids uuid\[\],\s+target_series text default null,\s+target_tax_rate numeric default null,\s+target_notes text default null/);
  assert.match(ordinary, /target_order_ids, target_series, target_tax_rate, target_notes, 'ordinaria'/);
  assert.match(simplified, /array\[target_order_id\], normalized_series, null, null, 'simplificada'/);
  assert.doesNotMatch(simplified, /perform public.prepare_simplified_billing_draft|public.create_billing_draft\(/);
});

test("existing trigger checks the actual type and all anonymous snapshot fields; no generic bypass", () => {
  assert.match(trigger, /customer.organization_id = new.organization_id and customer.id = new.customer_id/);
  assert.match(trigger, /customer.customer_code = 'WALKIN-SHARED'/);
  assert.match(trigger, /new.fiscal_document_type is distinct from 'simplificada'[\s\S]*billing_registered_customer_required/);
  for (const field of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_address_line2", "customer_city", "customer_postal_code", "customer_country_code", "customer_email"]) {
    assert.ok(trigger.includes(`new.${field} is not null`));
  }
  assert.match(sql, /create or replace trigger invoices_prevent_shared_walk_in\s+before insert or update of organization_id, customer_id, fiscal_document_type,/);
  assert.doesNotMatch(trigger, /current_setting|set_config|current_user|session_user/);
  assert.doesNotMatch(sql, /disable trigger|drop trigger|session_replication_role|alter column.*default/i);
});

test("null anonymous snapshot at insert; identified field expressions and inclusive economic loop are preserved", () => {
  const condition = "target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED'";
  assert.equal(builder.split(condition).length - 1, 8);
  for (const field of ["tax_id", "billing_address_line1", "billing_address_line2", "billing_city", "billing_postal_code", "billing_country_code", "email"]) {
    assert.ok(builder.includes(`case when ${condition} then null else customer.${field} end`));
  }
  assert.match(builder, /else case when customer.customer_type = 'business'\s+then coalesce\(nullif\(customer.company_name, ''\), customer.display_name\)\s+else customer.display_name\s+end/);
  const economicLoop = (source) => source.slice(source.indexOf("  for order_row in"), source.indexOf("end;\n$$;", source.indexOf("  for order_row in")));
  assert.equal(economicLoop(builder), economicLoop(definition(oldBuilder, "create_billing_draft")));
  assert.doesNotMatch(sql, /Cliente sin identificar/i);
});

test("all simplified auth, tenant, POS, locking, retry and snapshot checks remain byte-identical", () => {
  const old = definition(oldDraft, "create_simplified_billing_draft");
  const head = (source) => source.slice(source.indexOf("declare"), source.indexOf("  else\n    --", source.indexOf("select link.invoice_id")));
  const tail = (source) => source.slice(source.indexOf("    select * into invoice_row", source.indexOf("  else\n    --", source.indexOf("select link.invoice_id"))));
  assert.equal(head(simplified), head(old)); assert.equal(tail(simplified), tail(old));
  assert.match(builder, /target_document_type = 'simplificada' and normalized_series = coalesce/);
  assert.match(builder, /cardinality\(target_order_ids\) <> 1/);
  assert.match(sql, /revoke all on function public.create_billing_draft_for_type\(uuid\[\], text, numeric, text, text\) from public, anon, authenticated/);
  assert.doesNotMatch(builder, /security definer/); // Called only under the existing definer wrappers.
  assert.match(ordinary, /security definer\s+set search_path = public/);
  assert.match(simplified, /security definer\s+set search_path = public/);
  assert.doesNotMatch(sql, /grant execute|create policy|alter policy|enable row level|disable row level/i);
});

test("migration adds no payment, document registry, issue, numbering or historical-row rewrite", () => {
  assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m);
  assert.doesNotMatch(sql, /record_pos_payment\(|record_pos_refund\(|issue_billing_invoice\(|billing_invoice_number_counters|nextval\(|create table|delete from/i);
  assert.equal((builder.match(/insert into public.invoices \(/g) ?? []).length, 1);
  assert.match(builder, /where invoice.organization_id = org_id\s+and invoice.id = new_invoice_id/);
  assert.match(builder, /exception when unique_violation then\s+raise exception 'billing_order_already_invoiced'/);
});
