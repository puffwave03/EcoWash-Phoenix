import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260826000100_customer_account_001_financial_summary.sql";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function functionBody(migration, name, nextName) {
  const start = migration.indexOf(`create function public.${name}`);
  const end = nextName ? migration.indexOf(`create function public.${nextName}`, start) : migration.length;

  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return migration.slice(start, end);
}

test("financial summary keeps the existing confirmed-minus-refunded semantics", async () => {
  const migration = await source(migrationPath);
  const summary = functionBody(migration, "get_customer_account_summary", "list_customer_account_orders");

  assert.match(summary, /payments\.status = 'confirmed'/);
  assert.match(summary, /payments\.status = 'refunded'/);
  assert.match(summary, /confirmed_total - payment_totals\.refunded_total/);
  assert.match(summary, /greatest\([\s\S]*eligible_orders\.total - \(payment_totals\.confirmed_total - payment_totals\.refunded_total\)[\s\S]*0/);
  assert.match(summary, /count\(\*\) filter \(where order_financials\.balance_due > 0\)/);
  assert.match(summary, /round\(avg\(order_financials\.total\), 2\)/);
});

test("cancelled and inactive orders never enter customer commercial values", async () => {
  const migration = await source(migrationPath);

  for (const body of [
    functionBody(migration, "get_customer_account_summary", "list_customer_account_orders"),
    functionBody(migration, "list_customer_account_orders", "list_customer_account_payments"),
    functionBody(migration, "list_customer_account_payments", null),
  ]) {
    assert.match(body, /orders\.is_active/);
    assert.match(body, /orders\.production_status <> 'cancelled'/);
  }
});

test("every account RPC is tenant-bound and Owner or Manager only", async () => {
  const migration = await source(migrationPath);

  assert.equal((migration.match(/public\.app_current_organization_id\(\)/g) ?? []).length, 3);
  assert.equal((migration.match(/array\['owner', 'manager'\]::public\.app_role\[\]/g) ?? []).length, 3);
  assert.equal((migration.match(/customer\.organization_id = org_id/g) ?? []).length, 3);
  assert.equal((migration.match(/orders\.organization_id = org_id/g) ?? []).length, 3);
  assert.match(migration, /customer_account_not_authorized/);
  assert.doesNotMatch(migration, /service_role/);
});

test("SECURITY DEFINER functions use a safe search path and least-privilege grants", async () => {
  const migration = await source(migrationPath);

  assert.equal((migration.match(/security definer/g) ?? []).length, 3);
  assert.equal((migration.match(/set search_path = public/g) ?? []).length, 3);
  assert.equal((migration.match(/revoke all on function/g) ?? []).length, 3);
  assert.equal((migration.match(/grant execute on function/g) ?? []).length, 3);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/);
});

test("order financial statuses cover paid, partial, unpaid, refund and void truth", async () => {
  const migration = await source(migrationPath);
  const orders = functionBody(migration, "list_customer_account_orders", "list_customer_account_payments");

  for (const status of ["paid", "partially_paid", "unpaid", "refunded", "void"]) {
    assert.match(orders, new RegExp(`'${status}'`));
  }
  assert.match(orders, /refunded_total > 0/);
  assert.match(orders, /void_count > 0/);
});

test("order and payment histories are bounded and support recent, year and all", async () => {
  const [migration, validation, queries] = await Promise.all([
    source(migrationPath),
    source("src/features/customer-account/validation.ts"),
    source("src/features/customer-account/server/queries.ts"),
  ]);

  assert.equal((migration.match(/least\(coalesce\(target_limit/g) ?? []).length, 2);
  assert.equal((migration.match(/limit safe_limit/g) ?? []).length, 2);
  assert.match(migration, /target_period not in \('recent', 'year', 'all'\)/);
  assert.match(migration, /date_trunc\('year'/);
  assert.match(validation, /CUSTOMER_ACCOUNT_PERIODS/);
  assert.match(queries, /all: \{ orders: 100, payments: 100 \}/);
});

test("payment history exposes safe business fields and omits provider internals", async () => {
  const migration = await source(migrationPath);
  const payments = functionBody(migration, "list_customer_account_payments", null);

  assert.match(payments, /order_number text/);
  assert.match(payments, /method public\.payment_method/);
  assert.match(payments, /status public\.payment_record_status/);
  assert.match(payments, /refunded_from_payment_id uuid/);
  assert.doesNotMatch(payments, /reference text/);
  assert.doesNotMatch(payments, /provider/);
});

test("management route denies Staff before loading customer financials", async () => {
  const [page, queries] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/customers/[customerId]/page.tsx"),
    source("src/features/customer-account/server/queries.ts"),
  ]);

  const guard = page.indexOf("requireOwnerOrManager(locale)");
  const financialLoad = page.indexOf("getCustomerAccountFinancials(locale", guard);
  assert.ok(guard >= 0 && financialLoad > guard);
  assert.match(queries, /requireOwnerOrManager\(locale\)/);
  assert.doesNotMatch(page, /requireMembership/);
});

test("customer account integrates properties, segments, Portal and truthful billing state", async () => {
  const view = await source("src/components/customers/CustomerAccountView.tsx");

  assert.match(view, /PropertyList/);
  assert.match(view, /CustomerSegmentAssignmentPanel/);
  assert.match(view, /CustomerPortalAccessPanel/);
  assert.match(view, /segmentAssignment\.segments\.find/);
  assert.match(view, /CustomerBillingSection/);
  assert.match(view, /billing\.manage/);
  assert.doesNotMatch(view, /billing\.notConfigured/);
});

test("customer quick order action safely preselects an active known customer", async () => {
  const [view, page, form] = await Promise.all([
    source("src/components/customers/CustomerAccountView.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/new/page.tsx"),
    source("src/components/orders/OrderForm.tsx"),
  ]);

  assert.match(view, /orders\/new\?customerId=/);
  assert.match(page, /customers\.some\(\(customer\) => customer\.id === rawSearchParams\.customerId\)/);
  assert.match(form, /initialCustomerId/);
});

test("empty accounts and multiple properties have explicit responsive presentation", async () => {
  const view = await source("src/components/customers/CustomerAccountView.tsx");

  assert.match(view, /financials\.summaries\.length === 0/);
  assert.match(view, /financials\.orders\.length === 0/);
  assert.match(view, /financials\.payments\.length === 0/);
  assert.match(view, /properties\.length/);
  assert.match(view, /grid-cols-2/);
  assert.match(view, /lg:grid-cols-2/);
});

test("all five locales include complete customer account vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.customerAccount.financial.outstanding, "string");
    assert.equal(typeof messages.customerAccount.orders.title, "string");
    assert.equal(typeof messages.customerAccount.payments.title, "string");
    assert.equal(typeof messages.customerAccount.billing.notConfigured, "string");
    assert.equal(typeof messages.customerAccount.lifecycle.description, "string");
    assert.equal(typeof messages.customerAccount.productionStatuses.quality_check, "string");
    assert.equal(typeof messages.customerAccount.paymentStatuses.partially_paid, "string");
    assert.equal(typeof messages.customerAccount.paymentMethods.bank_transfer, "string");
  }
});

test("migration is additive and never mutates historical financial/customer data", async () => {
  const migration = await source(migrationPath);

  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.doesNotMatch(migration, /\bupdate\s+public\.(orders|payments|customers)\b/i);
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b/i);
});
