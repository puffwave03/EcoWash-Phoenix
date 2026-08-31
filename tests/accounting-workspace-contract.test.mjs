import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExpenseSummary } from "../src/features/accounting/expenses.ts";
import { buildAccountingSummary } from "../src/features/accounting/summary.ts";
import { buildOperationalCurrencySummaries, buildUtf8Csv, resolveAccountingPeriod } from "../src/features/accounting/workspace.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const period = { startDate: "2026-08-01", endDateExclusive: "2026-09-01" };

test("1 period presets are deterministic in the organization timezone", () => {
  const now = new Date("2026-08-30T10:00:00.000Z");
  assert.deepEqual(resolveAccountingPeriod("today", undefined, undefined, "Atlantic/Canary", now).period, { startDate: "2026-08-30", endDateExclusive: "2026-08-31" });
  assert.deepEqual(resolveAccountingPeriod("week", undefined, undefined, "Atlantic/Canary", now).period, { startDate: "2026-08-24", endDateExclusive: "2026-08-31" });
  assert.deepEqual(resolveAccountingPeriod("month", undefined, undefined, "Atlantic/Canary", now).period, { startDate: "2026-08-01", endDateExclusive: "2026-08-31" });
  assert.deepEqual(resolveAccountingPeriod("previousMonth", undefined, undefined, "Atlantic/Canary", now).period, { startDate: "2026-07-01", endDateExclusive: "2026-08-01" });
  assert.throws(() => resolveAccountingPeriod("custom", "2026-08-20", "2026-08-01", "UTC", now));
});

test("2 controlled proof keeps sales, collections, refunds, expenses and operational result distinct", () => {
  const confirmed = [
    { amount: 300, channel: "pos", currency: "EUR", id: "cash", locationId: "loc", method: "cash", orderId: "order", paidAt: "2026-08-10T10:00:00Z", posSessionId: null, status: "confirmed" },
    { amount: 500, channel: "pos", currency: "EUR", id: "card", locationId: "loc", method: "card", orderId: "order", paidAt: "2026-08-10T10:00:00Z", posSessionId: null, status: "confirmed" },
  ];
  const accounting = buildAccountingSummary({
    locationId: "loc", paymentPeriod: period, periodPayments: [...confirmed, { ...confirmed[0], amount: 50, id: "refund", status: "refunded" }],
    posSessionPayments: [], posSessions: [], receivableConfirmedPayments: confirmed,
    salesOrders: [{ activeItemCount: 1, createdAt: "2026-08-10T09:00:00Z", currency: "EUR", id: "order", isQuickDrop: false, locationId: "loc", subtotal: 1000, total: 1000 }],
    salesPeriod: period, timezone: "Atlantic/Canary",
  });
  const expenseSummary = buildExpenseSummary([
    { categoryId: "rent", categoryName: "Rent", currency: "EUR", expenseDate: "2026-08-10", grossAmount: 400, id: "rent", locationId: "loc", locationName: "Main", status: "posted", supplierId: null, supplierName: null, taxAmount: null },
    { categoryId: "energy", categoryName: "Energy", currency: "EUR", expenseDate: "2026-08-10", grossAmount: 100, id: "energy", locationId: "loc", locationName: "Main", status: "posted", supplierId: null, supplierName: null, taxAmount: null },
    { categoryId: "chemicals", categoryName: "Chemicals", currency: "EUR", expenseDate: "2026-08-10", grossAmount: 100, id: "chemicals", locationId: "loc", locationName: "Main", status: "posted", supplierId: "supplier", supplierName: "Supplier", taxAmount: null },
  ], period, "loc", "Atlantic/Canary");
  const value = buildOperationalCurrencySummaries(accounting, expenseSummary)[0];
  assert.deepEqual(value, {
    bankTransferCollected: 0, cardCollected: 500, cashCollected: 300, collectedGross: 800, collectedNet: 750,
    currency: "EUR", expensesTotal: 600, onlineCollected: 0, operationalResult: 400, otherCollected: 0,
    outstanding: 200, refunds: 50, salesNet: 1000,
  });
});

test("3 mixed currencies are never summed", () => {
  const accounting = buildAccountingSummary({ locationId: null, paymentPeriod: period, periodPayments: [], posSessionPayments: [], posSessions: [], receivableConfirmedPayments: [], salesOrders: [
    { activeItemCount: 1, createdAt: "2026-08-10T09:00:00Z", currency: "EUR", id: "eur", isQuickDrop: false, locationId: null, subtotal: 100, total: 100 },
    { activeItemCount: 1, createdAt: "2026-08-10T09:00:00Z", currency: "USD", id: "usd", isQuickDrop: false, locationId: null, subtotal: 50, total: 50 },
  ], salesPeriod: period, timezone: "UTC" });
  const expenses = buildExpenseSummary([], period, null);
  assert.deepEqual(buildOperationalCurrencySummaries(accounting, expenses).map((value) => [value.currency, value.salesNet]), [["EUR", 100], ["USD", 50]]);
});

test("4 CSV is UTF-8, quoted and formula-injection safe", () => {
  const csv = buildUtf8Csv(["reference", "amount"], [["=1+1", 800], ["+SUM(A1)", 600], ["-2", 50], ["@cmd", 400], ['A"B', 1000]]);
  assert.ok(csv.startsWith("\uFEFF"));
  for (const value of ["'=1+1", "'+SUM(A1)", "'-2", "'@cmd"]) assert.ok(csv.includes(`"${value}"`));
  assert.match(csv, /"A""B"/);
  assert.match(csv, /"800"/);
});

test("5 workspace and exports remain canonical, tenant guarded and anti-double-count", async () => {
  const [queries, salesExport, expenseExport] = await Promise.all([
    source("src/features/accounting/server/workspace-queries.ts"),
    source("src/app/[locale]/app/(dashboard)/accounting/export/sales/route.ts"),
    source("src/app/[locale]/app/(dashboard)/accounting/export/expenses/route.ts"),
  ]);
  assert.match(queries, /requireOwnerOrManager\(locale\)/);
  assert.match(queries, /\.eq\("organization_id", organizationId\)/);
  assert.match(queries, /getAccountingSummary/);
  assert.match(queries, /getExpenseSummary/);
  assert.doesNotMatch(queries, /from\("invoices"\)|online_payment_attempts|general_ledger|journal/);
  assert.match(salesExport, /buildUtf8Csv/);
  assert.match(expenseExport, /buildUtf8Csv/);
  assert.match(salesExport, /text\/csv; charset=utf-8/);
  assert.match(expenseExport, /tax_amount/);
});

test("6 navigation and UI preserve Owner, Manager and Staff boundaries", async () => {
  const [navigation, page, management, actions] = await Promise.all([
    source("src/components/dashboard/AppNavigation.tsx"),
    source("src/app/[locale]/app/(dashboard)/accounting/page.tsx"),
    source("src/components/accounting/AccountingManagement.tsx"),
    source("src/features/accounting/server/expense-actions.ts"),
  ]);
  assert.match(navigation, /isControlRole[\s\S]*href: "\/app\/accounting"/);
  assert.match(page, /getAccountingPeriodContext/);
  assert.match(management, /const owner = role === "owner"/);
  assert.match(management, /expense\.status === "draft"/);
  assert.match(management, /expense\.status === "posted"/);
  assert.match(actions, /requireOwnerOrManager\(locale\)/);
  assert.match(actions, /requireOwner\(locale\)/);
});

test("7 all locales expose the Accounting workspace contract", async () => {
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.auth.dashboard.accounting, "string");
    assert.equal(typeof messages.accountingWorkspace.summary.operationalResult, "string");
    assert.equal(typeof messages.accountingWorkspace.exports.sales, "string");
    assert.equal(typeof messages.accountingWorkspace.management.expenses.title, "string");
  }
});
