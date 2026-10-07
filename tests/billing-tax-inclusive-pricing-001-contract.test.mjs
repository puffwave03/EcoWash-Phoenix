import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql");
const foundation = read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
const view = read("src/components/billing/BillingInvoiceView.tsx");
const queries = read("src/features/billing/server/queries.ts");
const types = read("src/features/billing/types.ts");

function section(start, end) {
  const from = sql.indexOf(start);
  const to = end ? sql.indexOf(end, from + start.length) : sql.length;
  assert.ok(from >= 0 && to > from, `missing SQL section: ${start}`);
  return sql.slice(from, to);
}

function inclusiveLine(grossCents, discountCents, rate) {
  const total = grossCents - discountCents;
  const base = Math.round(total / (1 + rate / 100));
  return { base, tax: total - base, total };
}

test("migration is corrective and the historical foundation is byte unchanged", () => {
  assert.match(sql, /BILLING-TAX-INCLUSIVE-PRICING-001/);
  assert.equal(createHash("sha256").update(foundation).digest("hex"), "e075ff5bedb05bc7fd22b533a22c0537a53f72e1050e85f69cabb030773cf72e");
  assert.match(sql, /lock table public\.invoices, public\.invoice_items, public\.invoice_orders, public\.orders in share mode/);
});

test("the entire migration owns one transaction around its lock and final grants", () => {
  const executable = sql.replace(/^(?:\s*--[^\n]*\n)+/, "").trim();
  assert.match(executable, /^begin;\s+lock table public\.invoices, public\.invoice_items, public\.invoice_orders, public\.orders in share mode;/i);
  assert.match(executable, /grant execute on function public\.issue_billing_invoice\(uuid\) to authenticated;\s+commit;$/i);
  assert.equal((sql.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((sql.match(/^commit;$/gim) ?? []).length, 1);
  assert.doesNotMatch(sql, /\bconcurrently\b|\bvacuum\b|\breindex\b|\balter\s+system\b|\b(?:create|drop)\s+database\b/i);
});

test("both snapshots distinguish legacy exclusive rows from inclusive drafts", () => {
  for (const table of ["invoices", "invoice_items"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table}\\s+add column prices_include_tax boolean not null default false`));
    assert.match(sql, new RegExp(`alter table public\\.${table} alter column prices_include_tax set default true`));
  }
  assert.match(sql, /where invoice\.document_status = 'draft'/);
  assert.doesNotMatch(section("-- Only drafts are mutable.", "alter table public.invoices alter column prices_include_tax set default true"), /document_status\s*=\s*'(issued|cancelled)'/);
  assert.match(sql, /billing_draft_conversion_unsafe/);
  assert.match(sql, /items\.gross_total <> links\.order_total/);
  assert.match(sql, /source_order\.total <> \(/);
});

test("dual constraints retain exclusive math and enforce cent-exact inclusive math", () => {
  const checks = section("alter table public.invoices add constraint invoices_amounts_valid", "create or replace function public.protect_billing_invoice_mutation");
  assert.match(checks, /not prices_include_tax and taxable_base = subtotal - discount_total\s+and total = taxable_base \+ tax_total/);
  assert.match(checks, /prices_include_tax and total = subtotal - discount_total\s+and total = taxable_base \+ tax_total/);
  assert.match(checks, /not prices_include_tax and taxable_base = line_subtotal - discount_amount\s+and tax_amount = round\(taxable_base \* tax_rate \/ 100, 2\)/);
  assert.match(checks, /prices_include_tax and line_total = line_subtotal - discount_amount\s+and taxable_base = round\(line_total \/ \(1 \+ tax_rate \/ 100\), 2\)\s+and tax_amount = line_total - taxable_base/);
});

test("draft creation extracts tax after discount and reconciles to selected Orders", () => {
  const create = section("create or replace function public.create_billing_draft", "create or replace function public.update_billing_draft");
  assert.match(create, /public\.app_current_organization_id\(\)/);
  assert.match(create, /has_organization_role\(org_id, array\['owner', 'manager'\]/);
  assert.match(create, /cardinality\(target_order_ids\) > 50/);
  assert.match(create, /count\(distinct customer_order\.customer_id\)/);
  assert.match(create, /count\(distinct customer_order\.currency\)/);
  assert.match(create, /customer_order\.production_status <> 'cancelled'/);
  assert.match(create, /invoice_order\.is_active/);
  assert.match(create, /remaining_discount := order_row\.discount_amount/);
  assert.match(create, /item_taxable := round\(\(item_row\.line_total - item_discount\) \/ \(1 \+ effective_tax_rate \/ 100\), 2\)/);
  assert.match(create, /item_tax := item_row\.line_total - item_discount - item_taxable/);
  assert.match(create, /item_row\.line_total - item_discount,\s+true,\s+display_index/);
  assert.match(create, /select round\(sum\(customer_order\.total\), 2\)\s+into expected_total/);
  assert.match(create, /actual_total is distinct from expected_total[\s\S]*billing_order_total_mismatch/);
});

test("rate edits change only decomposition; issuing retains numbering and snapshots", () => {
  const update = section("create or replace function public.update_billing_draft", "create or replace function public.issue_billing_invoice");
  const issue = section("create or replace function public.issue_billing_invoice", "revoke all on function public.protect_billing_invoice_mutation");
  assert.match(update, /invoice\.prices_include_tax/);
  assert.match(update, /set taxable_base = round\(item\.line_total \/ \(1 \+ effective_tax_rate \/ 100\), 2\)/);
  assert.match(update, /tax_amount = item\.line_total - round\(item\.line_total \/ \(1 \+ effective_tax_rate \/ 100\), 2\)/);
  assert.doesNotMatch(update, /set[\s\S]*?line_total\s*=/);
  assert.match(issue, /item\.prices_include_tax is distinct from invoice_row\.prices_include_tax/);
  assert.match(issue, /insert into public\.billing_invoice_number_counters/);
  assert.match(issue, /returning next_value - 1 into allocated_sequence/);
  assert.match(issue, /document_status = 'issued'/);
  assert.match(sql, /new\.prices_include_tax is distinct from old\.prices_include_tax/);
  assert.match(sql, /revoke all on function public\.create_billing_draft\(uuid\[\], text, numeric, text\)/);
  assert.match(sql, /grant execute on function public\.issue_billing_invoice\(uuid\) to authenticated/);
});

test("6.00 at 7%, discounted 8.00, zero rate, and multi-line totals are exact", () => {
  assert.deepEqual(inclusiveLine(600, 0, 7), { base: 561, tax: 39, total: 600 });
  assert.deepEqual(inclusiveLine(1000, 200, 7), { base: 748, tax: 52, total: 800 });
  assert.deepEqual(inclusiveLine(600, 0, 0), { base: 600, tax: 0, total: 600 });
  const lines = [inclusiveLine(600, 0, 7), inclusiveLine(1000, 200, 7), inclusiveLine(1, 0, 7)];
  const sum = (key) => lines.reduce((value, line) => value + line[key], 0);
  assert.equal(sum("base") + sum("tax"), sum("total"));
  assert.equal(sum("total"), 600 + 800 + 1);
  assert.equal(Math.max(600 - 600, 0), 0);
});

test("invoice read and print show inclusive tax only for inclusive snapshots", () => {
  assert.match(queries, /prices_include_tax: boolean/);
  assert.match(queries, /total, prices_include_tax, notes/);
  assert.match(queries, /pricesIncludeTax: row\.prices_include_tax/);
  assert.match(types, /pricesIncludeTax: boolean/);
  assert.match(view, /invoice\.pricesIncludeTax \? "items\.taxIncluded" : "items\.tax"/);
  assert.match(view, /invoice\.pricesIncludeTax \? "totals\.taxIncluded" : "totals\.tax"/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
    assert.ok(messages.billing.items.taxIncluded);
    assert.ok(messages.billing.totals.taxIncluded);
  }
});

test("financial sources and fiscal boundaries stay untouched", () => {
  assert.doesNotMatch(sql, /\b(update|insert into|delete from|truncate)\s+public\.(orders|order_items|payments|refunds)\b/i);
  assert.doesNotMatch(sql, /\b(IGIC|IVA|VAT|VeriFactu|AEAT)\b/i);
  assert.doesNotMatch(sql, /\b(create table|create policy|alter policy)\b/i);
});
