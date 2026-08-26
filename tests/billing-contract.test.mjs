import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function functionBody(migration, name, nextName) {
  const start = migration.indexOf(`create function public.${name}`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = nextName ? migration.indexOf(`create function public.${nextName}`, start + 1) : migration.length;
  assert.ok(end > start, `${name} body must be bounded`);
  return migration.slice(start, end);
}

test("invoice model is additive, tenant-scoped and snapshots legal and line data", async () => {
  const migration = await source(migrationPath);
  for (const table of ["organization_billing_settings", "billing_invoice_number_counters", "invoices", "invoice_items", "invoice_orders"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  for (const field of ["issuer_legal_name", "issuer_tax_id", "customer_name", "customer_tax_id", "description", "quantity", "unit_price", "tax_rate", "tax_amount", "line_total"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from public\.(orders|order_items|payments|customers))\b/i);
  assert.doesNotMatch(migration, /update public\.(orders|order_items|payments|customers)/i);
});

test("draft creation enforces same tenant, customer and currency and rejects invalid orders", async () => {
  const migration = await source(migrationPath);
  const draft = functionBody(migration, "create_billing_draft", "update_billing_draft");
  assert.match(draft, /public\.app_current_organization_id\(\)/);
  assert.match(draft, /count\(distinct customer_order\.customer_id\)/);
  assert.match(draft, /count\(distinct customer_order\.currency\)/);
  assert.match(draft, /customer_order\.organization_id = org_id/);
  assert.match(draft, /customer_order\.production_status <> 'cancelled'/);
  assert.match(draft, /billing_invalid_orders/);
});

test("active invoice links prevent accidental duplicate order invoicing", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /create unique index invoice_orders_one_active_invoice_per_order[\s\S]*where is_active/);
  assert.match(migration, /billing_order_already_invoiced/);
  assert.match(migration, /update public\.invoice_orders[\s\S]*set is_active = false/);
});

test("definitive numbering is organization and series scoped, atomic and issue-only", async () => {
  const migration = await source(migrationPath);
  const issue = functionBody(migration, "issue_billing_invoice", "cancel_billing_invoice");
  assert.match(migration, /primary key \(organization_id, series\)/);
  assert.match(issue, /insert into public\.billing_invoice_number_counters/);
  assert.match(issue, /on conflict \(organization_id, series\)[\s\S]*next_value = public\.billing_invoice_number_counters\.next_value \+ 1/);
  assert.match(issue, /returning next_value - 1 into allocated_sequence/);
  assert.match(issue, /set invoice_number = allocated_number[\s\S]*document_status = 'issued'/);
  assert.doesNotMatch(migration, /max\s*\(\s*(invoice_number|sequence_number)/i);
});

test("tax is configurable and invoice totals preserve subtotal, discount, taxable base and tax", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /default_tax_rate numeric\(7,4\) not null default 0/);
  assert.match(migration, /taxable_base = subtotal - discount_total/);
  assert.match(migration, /total = taxable_base \+ tax_total/);
  assert.match(migration, /tax_amount = round\(taxable_base \* tax_rate \/ 100, 2\)/);
  assert.doesNotMatch(migration, /\b(IVA|VAT|IGIC)\b/i);
});

test("tax-rate boundaries use percentage points and remove technical trailing decimals", async () => {
  const [taxRate, settings, create, detail] = await Promise.all([
    source("src/features/billing/tax-rate.ts"),
    source("src/components/billing/BillingSettingsPanel.tsx"),
    source("src/components/billing/BillingCreateForm.tsx"),
    source("src/components/billing/BillingInvoiceView.tsx"),
  ]);
  assert.match(taxRate, /parsed < 0 \|\| parsed > 100/);
  assert.match(taxRate, /Math\.round\(normalized \* 10000\) \/ 10000/);
  assert.match(taxRate, /maximumFractionDigits: 4/);
  assert.match(settings, /taxRateInputValue\(settings\.defaultTaxRate\)/);
  assert.match(create, /taxRateInputValue\(settings\.defaultTaxRate\)/);
  assert.match(detail, /formatTaxRate\(taxRate, locale\)/);
  assert.doesNotMatch(`${settings}\n${create}\n${detail}`, /step="0\.0001"/);
});

test("issue validates identity and totals then locks issued snapshots", async () => {
  const migration = await source(migrationPath);
  const issue = functionBody(migration, "issue_billing_invoice", "cancel_billing_invoice");
  assert.match(issue, /billing_issuer_configuration_required/);
  assert.match(issue, /billing_customer_configuration_required/);
  assert.match(issue, /billing_totals_invalid/);
  assert.match(issue, /for update/);
  assert.match(migration, /billing_issued_snapshot_immutable/);
  assert.match(migration, /billing_issued_delete_forbidden/);
  assert.match(migration, /billing_paid_cancellation_requires_credit_note/);
});

test("payments remain the existing order-linked source of truth", async () => {
  const [migration, queries] = await Promise.all([
    source(migrationPath),
    source("src/features/billing/server/queries.ts"),
  ]);
  assert.doesNotMatch(migration, /create table public\.invoice_payments/);
  assert.doesNotMatch(migration, /insert into public\.payments|update public\.payments/);
  assert.match(queries, /from\("payments"\)/);
  assert.match(queries, /payment\.status === "confirmed"/);
  assert.match(queries, /payment\.status === "refunded"/);
});

test("Billing is Owner/Manager-only with no direct authenticated mutation grants", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(migration, /array\['owner'\]::public\.app_role\[\]/);
  assert.doesNotMatch(migration, /array\['owner', 'manager', 'staff'\]/);
  assert.doesNotMatch(migration, /grant (insert|update|delete|all) on table public\.(invoices|invoice_items|invoice_orders)/i);
  assert.match(migration, /grant select on table public\.invoices to authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/);
});

test("SECURITY DEFINER billing functions use fixed search paths and explicit grants", async () => {
  const migration = await source(migrationPath);
  assert.equal((migration.match(/security definer/g) ?? []).length, 6);
  assert.equal((migration.match(/set search_path = public/g) ?? []).length, 8);
  for (const signature of [
    "create_billing_draft\\(uuid\\[\\], text, numeric, text\\)",
    "update_billing_draft\\(uuid, date, date, text, numeric, text\\)",
    "issue_billing_invoice\\(uuid\\)",
    "cancel_billing_invoice\\(uuid, text\\)",
    "delete_billing_draft\\(uuid\\)",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`));
  }
});

test("Customer Account, management, detail and printable routes integrate Billing", async () => {
  const [accountPage, accountView, listPage, detailPage, printPage, navigation] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/customers/[customerId]/page.tsx"),
    source("src/components/customers/CustomerAccountView.tsx"),
    source("src/app/[locale]/app/(dashboard)/billing/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/billing/[invoiceId]/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/billing/[invoiceId]/print/page.tsx"),
    source("src/components/dashboard/AppNavigation.tsx"),
  ]);
  assert.match(accountPage, /getCustomerBillingOverview/);
  assert.match(accountView, /CustomerBillingSection/);
  assert.match(listPage, /requireOwnerOrManager/);
  assert.match(detailPage, /BillingInvoiceView/);
  assert.match(printPage, /printMode/);
  assert.match(navigation, /\/app\/billing/);
});

test("all five locales contain complete Billing and Customer Account vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.auth.dashboard.billing, "string");
    assert.equal(typeof messages.billing.actions.issue, "string");
    assert.equal(typeof messages.billing.settings.legalName, "string");
    assert.equal(typeof messages.billing.create.form.inactiveNote, "string");
    assert.equal(typeof messages.billing.totals.taxable, "string");
    assert.equal(typeof messages.customerAccount.billingSection.create, "string");
  }
});
