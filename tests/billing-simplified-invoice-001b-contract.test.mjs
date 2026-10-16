import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Static contracts only: no SQL execution or Supabase client. PostgreSQL
// validation of defaults, triggers, grants and existing rows is a separate gate.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationName = "20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql";
const migration = read(`supabase/migrations/${migrationName}`);
const code = migration.replace(/--[^\n]*/g, "").trim();
const foundation = read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
const inclusive = read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql");
const entitlements = read("supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql");
const walkIn = read("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql");
const queries = read("src/features/billing/server/queries.ts");

function sqlFunction(source, name) {
  const match = source.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"));
  assert.ok(match, `Missing SQL function ${name}`);
  return match[0];
}

test("migration has a unique identifier after the current local sequence", () => {
  const names = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((name) => name.endsWith(".sql"));
  assert.equal(names.filter((name) => name.startsWith("20261016000100_")).length, 1);
  const earlier = names.filter((name) => name.slice(0, 14) < migrationName.slice(0, 14)).sort();
  assert.equal(earlier.at(-1), "20261015000100_terminal_order_submission_recovery_001a.sql");
});

test("existing Billing has a lifecycle enum but no equivalent fiscal discriminator", () => {
  assert.match(foundation, /create type public\.billing_invoice_document_status as enum \('draft', 'issued', 'cancelled'\)/);
  assert.doesNotMatch(`${foundation}\n${inclusive}`, /fiscal_document_type/);
  assert.match(code, /create type public\.billing_fiscal_document_type as enum \('ordinary', 'simplified'\);/);
  assert.doesNotMatch(code, /alter type public\.billing_invoice_document_status|create table/i);
});

test("one non-null constant default technically classifies historical and future invoices as ordinary", () => {
  assert.match(code, /add column fiscal_document_type public\.billing_fiscal_document_type\s+not null default 'ordinary'::public\.billing_fiscal_document_type/);
  assert.equal((code.match(/add column/gi) ?? []).length, 1);
  assert.doesNotMatch(code, /\bupdate public\.|\binsert into\s|\bdelete from\s|\bmerge into\s|\btruncate\s/i);
  assert.doesNotMatch(code, /drop (?:not null|default)|set default|generated always/i);
});

test("invalid values and null are excluded; simplified is reserved and blocked at every lifecycle state", () => {
  const enumValues = code.match(/as enum \(([^)]+)\)/)[1];
  assert.deepEqual(enumValues.split(",").map((value) => value.trim()), ["'ordinary'", "'simplified'"]);
  const constraint = code.match(/add constraint invoices_fiscal_document_type_ordinary_only check \(([^)]+)\)/);
  assert.ok(constraint);
  assert.equal(constraint[1].trim(), "fiscal_document_type = 'ordinary'::public.billing_fiscal_document_type");
  assert.doesNotMatch(constraint[1], /document_status|\bor\b|\bnull\b|current_setting|auth\./i);
  assert.doesNotMatch(code, /not valid|disable trigger|session_replication_role/i);
});

test("type immutability independently covers issued and cancelled rows, including a simultaneous state change", () => {
  const guard = sqlFunction(code, "protect_billing_fiscal_document_type");
  assert.match(guard, /if old\.document_status <> 'draft'\s+and new\.fiscal_document_type is distinct from old\.fiscal_document_type\s+then/);
  assert.match(guard, /raise exception 'billing_issued_fiscal_type_immutable' using errcode = '55000'/);
  assert.match(guard, /return new;/);
  assert.doesNotMatch(guard, /new\.document_status|set_config|auth\.|\bexecute\b|security definer/i);
});

test("additional trigger is limited to the fiscal column and retains all existing guards", () => {
  assert.match(code, /create trigger invoices_protect_fiscal_document_type\s+before update of fiscal_document_type on public\.invoices\s+for each row execute function public\.protect_billing_fiscal_document_type\(\);/);
  assert.equal((code.match(/create trigger/gi) ?? []).length, 1);
  assert.doesNotMatch(code, /drop trigger|create or replace function|protect_billing_invoice_mutation\(|protect_billing_child_mutation\(|require_billing_entitlement\(/i);
  assert.match(foundation, /create trigger invoices_controlled_mutation\s+before update or delete on public\.invoices/);
  assert.match(entitlements, /create trigger invoices_require_entitlement\s+before insert or update or delete on public\.invoices/);
});

test("existing draft RPC explicitly omits the new column and therefore retains the ordinary default", () => {
  const draft = sqlFunction(inclusive, "create_billing_draft");
  const columns = draft.match(/insert into public\.invoices\s*\(([\s\S]*?)\)\s*select/i);
  assert.ok(columns);
  assert.match(columns[1], /organization_id/);
  assert.match(columns[1], /prices_include_tax/);
  assert.doesNotMatch(draft, /fiscal_document_type/);
  assert.match(draft, /returns uuid/);
  assert.doesNotMatch(code, /create (?:or replace )?function public\.(?:create|update|issue|cancel|delete)_billing_/i);
});

test("issue/update/cancel contracts remain compatible; no current RPC accepts or enables simplified", () => {
  const issue = sqlFunction(inclusive, "issue_billing_invoice");
  const update = sqlFunction(inclusive, "update_billing_draft");
  const cancel = sqlFunction(foundation, "cancel_billing_invoice");
  assert.match(issue, /invoice_row public\.invoices%rowtype/);
  assert.match(issue, /select \* into invoice_row/);
  assert.match(issue, /returns table \(invoice_id uuid, invoice_number text\)/);
  assert.match(issue, /invoice_row\.document_status <> 'draft'/);
  assert.doesNotMatch(`${issue}\n${update}\n${cancel}`, /fiscal_document_type/);
  assert.doesNotMatch(read("src/features/billing/server/actions.ts"), /target_fiscal_document_type|fiscal_document_type/);
});

test("numbering and active-order invoice uniqueness are not altered", () => {
  assert.doesNotMatch(code, /billing_invoice_number_counters|invoice_number\s*=|sequence_number\s*=|create (?:unique )?index|drop index|invoice_orders/i);
  assert.match(foundation, /create unique index invoice_orders_one_active_invoice_per_order\s+on public\.invoice_orders \(order_id\)\s+where is_active/);
  const issue = sqlFunction(inclusive, "issue_billing_invoice");
  assert.match(issue, /on conflict \(organization_id, series\)/);
  assert.match(issue, /returning next_value - 1 into allocated_sequence/);
});

test("financial amounts, existing snapshots and related domain tables are outside migration writes", () => {
  const targets = [...code.matchAll(/alter table public\.(\w+)/gi)].map((match) => match[1]);
  assert.deepEqual(targets, ["invoices"]);
  assert.doesNotMatch(code, /\b(?:orders|order_items|invoice_items|payments|refunds|customers|organization_billing_settings)\b/i);
  assert.doesNotMatch(code, /\b(?:subtotal|discount_total|taxable_base|tax_total|total|prices_include_tax|unit_price|tax_rate)\b/i);
  assert.doesNotMatch(code, /\bdrop\b|\brename\b|\bset data type\b/i);
});

test("RLS, entitlement and role protections stay unchanged; no direct write privilege is added", () => {
  assert.doesNotMatch(code, /\bpolicy\b|\brow level security\b|\bgrant\b|security definer|set_config/i);
  assert.match(code, /revoke all on function public\.protect_billing_fiscal_document_type\(\)\s+from public, anon, authenticated;/);
  assert.match(foundation, /revoke all on table public\.invoices from public, anon, authenticated/);
  assert.match(foundation, /grant select on table public\.invoices to authenticated/);
  assert.match(entitlements, /on public\.invoices\s+for select to authenticated[\s\S]*has_organization_role\(organization_id, array\['owner', 'manager'\]/);
  assert.match(entitlements, /has_organization_entitlement\(organization_id, 'billing.invoicing'\)/);
});

test("detail/print queries still work without the historical field and do not depend on it", () => {
  const select = queries.match(/const INVOICE_SELECT = "([^"]+)";/)[1].split(", ");
  assert.ok(select.includes("prices_include_tax"));
  assert.ok(select.includes("invoice_number"));
  assert.ok(!select.includes("fiscal_document_type"));
  assert.ok(!select.includes("*"));
  assert.doesNotMatch(queries, /fiscal_document_type|fiscalDocumentType/);
  for (const route of ["page.tsx", "print/page.tsx"]) {
    const page = read(`src/app/[locale]/app/(dashboard)/billing/[invoiceId]/${route}`);
    assert.match(page, /const detail = await getBillingInvoice\(locale, invoiceId\)/);
    assert.match(page, /<BillingInvoiceView/);
  }
  assert.match(queries, /if \(itemsResult\.error\) throw itemsResult\.error/);
});

test("WALKIN-SHARED exclusion and invoice trigger are unchanged", () => {
  assert.doesNotMatch(code, /WALKIN|walk_in|prevent_shared_walk_in_invoice|customers_protect_shared_walk_in/i);
  const guard = sqlFunction(walkIn, "prevent_shared_walk_in_invoice");
  assert.match(guard, /customer\.customer_code = 'WALKIN-SHARED'/);
  assert.match(guard, /raise exception 'billing_registered_customer_required'/);
  assert.match(walkIn, /create trigger invoices_prevent_shared_walk_in\s+before insert or update of customer_id on public\.invoices/);
  assert.match(read("supabase/migrations/20261007000100_billing_eligible_order_selector_001.sql"), /c\.customer_code is distinct from 'WALKIN-SHARED'/);
});

test("static SQL envelope permits only one additive atomic DDL unit and a non-mutating trigger body", () => {
  const statements = code.replace(/\$\$[\s\S]*?\$\$/g, "$$BODY$$").split(";").map((part) => part.trim()).filter(Boolean);
  const allowed = [
    /^begin$/i,
    /^create type public\.billing_fiscal_document_type as enum/i,
    /^alter table public\.invoices\s+add column fiscal_document_type/i,
    /^create function public\.protect_billing_fiscal_document_type\(\)\s+returns trigger/i,
    /^create trigger invoices_protect_fiscal_document_type/i,
    /^revoke all on function public\.protect_billing_fiscal_document_type\(\)/i,
    /^commit$/i,
  ];
  assert.equal(statements.length, allowed.length);
  statements.forEach((statement, index) => assert.match(statement, allowed[index]));
  assert.equal((code.match(/\$\$/g) ?? []).length, 2);
  const guard = sqlFunction(code, "protect_billing_fiscal_document_type");
  assert.doesNotMatch(guard, /\b(?:insert|update|delete|select|perform|execute)\b|new\.\w+\s*:=/i);
  assert.match(guard, /set search_path = public/);
  const unquoted = code.replace(/'(?:[^']|'')*'/g, "");
  let depth = 0;
  for (const char of unquoted) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    assert.ok(depth >= 0, "Unbalanced SQL parentheses");
  }
  assert.equal(depth, 0);
});
