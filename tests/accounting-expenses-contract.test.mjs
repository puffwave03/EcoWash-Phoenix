import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExpenseSummary } from "../src/features/accounting/expenses.ts";

const migrationPath = "supabase/migrations/20260830000200_accounting_001b_expenses_suppliers.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const period = { startDate: "2026-08-01", endDateExclusive: "2026-09-01" };
const fact = (overrides = {}) => ({ categoryId: "other", categoryName: "Other", currency: "EUR", expenseDate: "2026-08-15", grossAmount: 100, id: crypto.randomUUID(), locationId: null, locationName: null, status: "posted", supplierId: null, supplierName: null, taxAmount: null, ...overrides });

test("1 suppliers use stable tenant identity and archive lifecycle", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.suppliers/);
  assert.match(sql, /constraint suppliers_organization_id_id_unique unique \(organization_id, id\)/);
  assert.match(sql, /is_active boolean not null default true/);
  assert.match(sql, /create function public\.save_supplier/);
  assert.match(sql, /create function public\.set_supplier_active/);
  assert.doesNotMatch(sql, /delete from public\.suppliers/);
});

test("2 expense categories are tenant-defined, ordered and archivable without hardcoded bootstrap", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.expense_categories/);
  assert.match(sql, /display_order integer not null default 0/);
  assert.match(sql, /expense_categories_name_unique/);
  assert.match(sql, /set_expense_category_active/);
  assert.doesNotMatch(sql, /Rent.*Energy.*Laundry products/s);
});

test("3 expenses have canonical gross, optional tax metadata and no general ledger", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.expenses/);
  assert.match(sql, /gross_amount numeric\(14,2\) not null/);
  assert.match(sql, /tax_amount numeric\(14,2\)/);
  assert.match(sql, /tax_rate numeric\(7,4\)/);
  assert.match(sql, /expenses_tax_valid/);
  assert.doesNotMatch(sql, /general_ledger|journal_entries|chart_of_accounts/);
});

test("4 supplier payment state remains expense metadata outside customer payments", async () => {
  const [sql, actions] = await Promise.all([
    source(migrationPath),
    source("src/features/accounting/server/expense-actions.ts"),
  ]);
  assert.match(sql, /payment_status public\.expense_payment_status/);
  assert.match(sql, /paid_date date/);
  assert.match(sql, /payment_method public\.payment_method/);
  assert.doesNotMatch(sql, /insert into public\.payments/);
  assert.doesNotMatch(actions, /from\("payments"\)/);
});

test("5 cross-tenant location, supplier and category references are structurally rejected", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /expenses_location_same_organization foreign key \(organization_id, location_id\)/);
  assert.match(sql, /expenses_supplier_same_organization foreign key \(organization_id, supplier_id\)/);
  assert.match(sql, /expenses_category_same_organization foreign key \(organization_id, category_id\)/);
  assert.match(sql, /location\.organization_id = org_id/);
  assert.match(sql, /supplier\.organization_id = org_id/);
  assert.match(sql, /category\.organization_id = org_id/);
});

test("6 Owner manages suppliers/categories; Owner and Manager manage expenses; Staff is denied", async () => {
  const [sql, actions] = await Promise.all([
    source(migrationPath),
    source("src/features/accounting/server/expense-actions.ts"),
  ]);
  assert.match(sql, /supplier_management_denied[\s\S]*array\['owner'\]/);
  assert.match(sql, /expense_category_management_denied[\s\S]*array\['owner'\]/);
  assert.match(sql, /expense_management_denied[\s\S]*array\['owner', 'manager'\]/);
  assert.match(actions, /requireOwner\(locale\)/);
  assert.match(actions, /requireOwnerOrManager\(locale\)/);
  assert.doesNotMatch(sql, /array\['owner', 'manager', 'staff'\]/);
});

test("7 draft expenses can be posted or voided while posted values stay immutable", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create type public\.expense_status as enum \('draft', 'posted', 'void'\)/);
  assert.match(sql, /if current_status <> 'draft' then raise exception 'expense_posted_immutable'/);
  assert.match(sql, /current_status = 'posted' and target_status <> 'void'/);
  assert.match(sql, /posted_at/);
  assert.match(sql, /voided_at/);
});

test("8 supplier invoice references prevent accidental duplicates without amount/date uniqueness", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /expenses_supplier_reference_unique/);
  assert.match(sql, /organization_id, supplier_id, lower\(btrim\(supplier_reference\)\)/);
  const indexes = sql.slice(sql.indexOf("create unique index expenses_supplier_reference_unique"), sql.indexOf("create index expenses_period_idx"));
  assert.doesNotMatch(indexes, /gross_amount|expense_date/);
});

test("9 expense period query uses expense_date, explicit tenant scope and optional location", async () => {
  const query = await source("src/features/accounting/server/expense-queries.ts");
  assert.match(query, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /\.eq\("organization_id", organizationId\)/);
  assert.match(query, /\.gte\("expense_date", period\.startDate\)\.lt\("expense_date", period\.endDateExclusive\)/);
  assert.match(query, /query = query\.eq\("location_id", locationId\)/);
  assert.match(query, /membership\.organization\.timezone/);
});

test("10 controlled EUR 2,100 aggregation is exact by category and supplier", () => {
  const rows = [
    fact({ categoryId: "rent", categoryName: "Rent", grossAmount: 1200 }),
    fact({ categoryId: "energy", categoryName: "Energy", grossAmount: 500 }),
    fact({ categoryId: "products", categoryName: "Laundry products", grossAmount: 300, supplierId: "supplier-a", supplierName: "Laundry Chemicals" }),
    fact({ categoryId: "maintenance", categoryName: "Maintenance", grossAmount: 100 }),
  ];
  const value = buildExpenseSummary(rows, period, null, "Atlantic/Canary").currencies[0];
  assert.equal(value.expensesTotal, 2100);
  assert.deepEqual(Object.fromEntries(value.byCategory.map((row) => [row.label, row.totalGross])), { Rent: 1200, Energy: 500, "Laundry products": 300, Maintenance: 100 });
  assert.equal(value.bySupplier.find((row) => row.id === "supplier-a").totalGross, 300);
});

test("11 currencies remain separate and draft/void records are excluded", () => {
  const value = buildExpenseSummary([
    fact({ grossAmount: 100 }),
    fact({ currency: "USD", grossAmount: 50 }),
    fact({ grossAmount: 900, status: "draft" }),
    fact({ grossAmount: 800, status: "void" }),
  ], period, null);
  assert.equal(value.currencies.length, 2);
  assert.equal(value.currencies.find((row) => row.currency === "EUR").expensesTotal, 100);
  assert.equal(value.currencies.find((row) => row.currency === "USD").expensesTotal, 50);
});

test("12 tax/net aggregation is explicit only for rows carrying tax metadata", () => {
  const value = buildExpenseSummary([
    fact({ grossAmount: 107, taxAmount: 7 }),
    fact({ grossAmount: 50, taxAmount: null }),
  ], period, null).currencies[0];
  assert.equal(value.expensesTotal, 157);
  assert.equal(value.taxMetadataExpenseCount, 1);
  assert.equal(value.taxAmountKnown, 7);
  assert.equal(value.netAmountKnown, 100);
});

test("13 RLS is read-only and all mutation entry points are least-privilege RPCs", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /grant select on public\.suppliers, public\.expense_categories, public\.expenses to authenticated/);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete).*public\.(?:suppliers|expense_categories|expenses)/);
  assert.match(sql, /security definer[\s\S]*set search_path = public/g);
});

test("14 expense summary exposes category, supplier, location and period primitives", async () => {
  const summary = await source("src/features/accounting/expenses.ts");
  assert.match(summary, /byCategory/);
  assert.match(summary, /bySupplier/);
  assert.match(summary, /byLocation/);
  assert.match(summary, /byPeriod/);
  assert.match(summary, /expensesTotal/);
});

test("15 ACCOUNTING-001A canonical sales/payment read model remains untouched", async () => {
  const [query, summary] = await Promise.all([
    source("src/features/accounting/server/queries.ts"),
    source("src/features/accounting/summary.ts"),
  ]);
  assert.doesNotMatch(query, /from\("expenses"\)|from\("suppliers"\)|from\("expense_categories"\)/);
  assert.doesNotMatch(summary, /ExpenseFact|expensesTotal/);
  assert.match(query, /from\("orders"\)/);
  assert.match(query, /from\("payments"\)/);
});
