import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveAccountingPeriod } from "../src/features/accounting/workspace.ts";
import { accountingPeriodBounds } from "../src/features/accounting/summary.ts";
import { addAccountantPostedExpense, addAccountantSalesEvent } from "../src/features/accounting/accountant-summary.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const root = "src/app/[locale]/app/(dashboard)/accounting/export/";

test("Quarter covers exact organization-local calendar boundaries in every quarter", () => {
  const cases = [
    ["1", "2026-01-01", "2026-04-01"],
    ["2", "2026-04-01", "2026-07-01"],
    ["3", "2026-07-01", "2026-10-01"],
    ["4", "2026-10-01", "2027-01-01"],
  ];
  for (const [quarter, startDate, endDateExclusive] of cases) {
    const selection = resolveAccountingPeriod("quarter", undefined, undefined, "Atlantic/Canary", new Date("2026-10-05T12:00:00Z"), { year: "2026", quarter });
    assert.equal(selection.preset, "quarter");
    assert.deepEqual(selection.period, { startDate, endDateExclusive });
  }
  const summer = resolveAccountingPeriod("quarter", undefined, undefined, "Atlantic/Canary", undefined, { year: "2024", quarter: "3" });
  assert.equal(accountingPeriodBounds(summer.period, "Atlantic/Canary").start, "2024-06-30T23:00:00.000Z");
  assert.equal(accountingPeriodBounds(summer.period, "Atlantic/Canary").end, "2024-09-30T23:00:00.000Z");
});

test("Quarter rejects malformed input while existing presets and Custom remain", () => {
  for (const input of [
    { year: "2026", quarter: "0" }, { year: "2026", quarter: "5" },
    { year: "2026", quarter: "2x" }, { year: "26", quarter: "1" },
    { year: "9999", quarter: "4" }, { year: "2026.0", quarter: "1" },
    { year: undefined, quarter: "1" },
  ]) assert.throws(() => resolveAccountingPeriod("quarter", undefined, undefined, "UTC", undefined, input));
  const now = new Date("2026-08-30T12:00:00Z");
  assert.deepEqual(resolveAccountingPeriod("today", undefined, undefined, "UTC", now).period, { startDate: "2026-08-30", endDateExclusive: "2026-08-31" });
  assert.deepEqual(resolveAccountingPeriod("week", undefined, undefined, "UTC", now).period, { startDate: "2026-08-24", endDateExclusive: "2026-08-31" });
  assert.deepEqual(resolveAccountingPeriod("month", undefined, undefined, "UTC", now).period, { startDate: "2026-08-01", endDateExclusive: "2026-08-31" });
  assert.deepEqual(resolveAccountingPeriod("previousMonth", undefined, undefined, "UTC", now).period, { startDate: "2026-07-01", endDateExclusive: "2026-08-01" });
  assert.deepEqual(resolveAccountingPeriod("custom", "2025-01-01", "2025-12-31", "UTC", now).period, { startDate: "2025-01-01", endDateExclusive: "2026-01-01" });
});

test("Quarter UI, shared resolver, five locales, and all four support links stay aligned", async () => {
  const [page, request, sales, expenses] = await Promise.all([
    read("src/app/[locale]/app/(dashboard)/accounting/page.tsx"),
    read("src/features/accounting/server/export-request.ts"),
    read(root + "sales/route.ts"), read(root + "expenses/route.ts"),
  ]);
  assert.match(page, /"quarter"/);
  assert.match(page, /name="year"/);
  assert.match(page, /name="quarter"/);
  assert.match(page, /selection\.preset === "quarter".*year: String\(selection\.year\).*quarter: String\(selection\.quarter\)/);
  assert.match(page, /invalidLocation/);
  for (const path of ["sales", "accountant-expenses", "summary", "daily-close-register"]) {
    assert.match(page, new RegExp(`export/${path}\\?\\$\\{exportQuery\\}`));
  }
  for (const route of [sales, expenses, await read(root + "accountant-expenses/route.ts"), await read(root + "summary/route.ts"), await read(root + "daily-close-register/route.ts")]) {
    assert.match(route, /accountingExportRequest/);
    assert.match(route, /accountingCsvResponse/);
  }
  assert.match(request, /getAccountingExportContext\(locale, url\.searchParams\.get\("location"\)\)/);
  assert.match(request, /InvalidAccountingExportLocationError[\s\S]*status: 400/);
  assert.match(request, /year: url\.searchParams\.get\("year"\)/);
  assert.match(sales, /accountingSalesCsvChunks/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await read(`src/i18n/${locale}/common.json`));
    const value = messages.accountingWorkspace;
    assert.equal(typeof value.presets.quarter, "string");
    for (const key of ["year", "quarter"]) assert.equal(typeof value.quarter[key], "string");
    for (const key of ["title", "postedExpenses", "summary", "dailyCloseRegister", "disclaimer", "dailyCloseNote"]) {
      assert.equal(typeof value.accountantSupport[key], "string");
    }
  }
});

test("Posted expense export reuses bounded 001K-A traversal and leaves standalone scope intact", async () => {
  const [readers, route] = await Promise.all([
    read("src/features/accounting/server/export-readers.ts"),
    read(root + "accountant-expenses/route.ts"),
  ]);
  assert.match(readers, /ACCOUNTANT_EXPENSE_HEADERS = \["expense_date", "document_date", "supplier", "category", "description", "reference", "location", "gross", "tax_amount", "tax_rate", "currency", "payment_status", "paid_date", "payment_method", "status"\]/);
  assert.match(readers, /accountingExpensePages\([\s\S]*postedOnly = false/);
  assert.match(readers, /if \(postedOnly\) query = query\.eq\("status", "posted"\)/);
  assert.match(readers, /expenseRows\(supabase, organizationId, period, locationId, false\)/);
  assert.match(readers, /expenseRows\(supabase, organizationId, period, locationId, true\)/);
  assert.match(readers, /\.order\("expense_date", \{ ascending: true \}\)[\s\S]*\.order\("id", \{ ascending: true \}\)[\s\S]*\.limit\(EXPORT_PAGE_SIZE\)/);
  assert.match(readers, /expense_date\.gt\.\$\{cursor\.date\}.*id\.gt\.\$\{cursor\.id\}/);
  assert.doesNotMatch(readers, /tax_base|deductible|recoverable|net_amount|\.range\(/i);
  assert.match(route, /accountantExpensesCsvChunks/);
});

test("Summary streams canonical page readers, isolates currencies and excludes online card from card bucket", async () => {
  const [source, aggregate] = await Promise.all([
    read("src/features/accounting/server/accountant-support.ts"),
    read("src/features/accounting/accountant-summary.ts"),
  ]);
  assert.match(source, /accountingSalesPages\(/);
  assert.match(source, /accountingExpensePages\(supabase, organizationId, period, locationId, true\)/);
  assert.match(source, /new Map<string, AccountantCurrencyTotals>/);
  assert.match(source, /addAccountantSalesEvent\(totals, event, channels\.get\(event\.event_id\)\)/);
  assert.match(source, /addAccountantPostedExpense\(totals, expense\)/);
  assert.match(source, /total\.collectedGross - total\.refunds/);
  assert.match(source, /total\.salesNet - total\.postedExpenses/);
  assert.match(aggregate, /event\.event_type === "sale"/);
  assert.match(aggregate, /event\.event_type === "refund"/);
  assert.match(aggregate, /paymentChannel === "online"\) total\.onlineCollected/);
  assert.match(aggregate, /event\.payment_method === "card" && paymentChannel !== "online"/);
  assert.match(aggregate, /expense\.status !== "posted"/);
  assert.match(source, /"accounting_support_non_fiscal"/);
  for (const value of ["orders.created_at", "payments.paid_at", "expenses.expense_date", "daily_closes.business_date"]) assert.ok(source.includes(value));
  assert.doesNotMatch(source, /getAccountingWorkspace|dailyCloseRegisterCsvChunks|\.range\(/);
});

test("Summary controlled facts keep refunds, posted expenses and online card separate per currency", () => {
  const totals = new Map();
  addAccountantSalesEvent(totals, { amount: "100.00", currency: "EUR", event_type: "sale", payment_method: null });
  addAccountantSalesEvent(totals, { amount: "50.00", currency: "EUR", event_type: "payment", payment_method: "card" }, "online");
  addAccountantSalesEvent(totals, { amount: "20.00", currency: "EUR", event_type: "payment", payment_method: "cash" }, "pos");
  addAccountantSalesEvent(totals, { amount: "5.00", currency: "EUR", event_type: "refund", payment_method: "card" });
  addAccountantPostedExpense(totals, { currency: "EUR", gross_amount: "12.00", status: "posted" });
  addAccountantPostedExpense(totals, { currency: "EUR", gross_amount: "9.00", status: "draft" });
  addAccountantPostedExpense(totals, { currency: "EUR", gross_amount: "3.00", status: "void" });
  addAccountantSalesEvent(totals, { amount: "8.00", currency: "USD", event_type: "sale", payment_method: null });
  const eur = totals.get("EUR");
  assert.deepEqual([eur.orderCount, eur.salesNet, eur.paymentCount, eur.collectedGross, eur.refundCount, eur.refunds], [1, 10000, 2, 7000, 1, 500]);
  assert.deepEqual([eur.onlineCollected, eur.cardCollected, eur.cashCollected, eur.postedExpenseCount, eur.postedExpenses], [5000, 0, 2000, 1, 1200]);
  assert.equal(eur.collectedGross - eur.refunds, 6500);
  assert.equal(eur.salesNet - eur.postedExpenses, 8800);
  assert.equal(totals.get("USD").salesNet, 800);
  assert.equal(totals.get("USD").collectedGross, 0);
  assert.throws(() => addAccountantSalesEvent(totals, { amount: "1.00", currency: "EUR", event_type: "payment", payment_method: "card" }));
});

test("Daily Close register reads persisted snapshots with keyset and one row per close", async () => {
  const source = await read("src/features/accounting/server/daily-close-register.ts");
  assert.match(source, /PAGE_SIZE = 250/);
  assert.match(source, /from\("daily_closes"\)/);
  assert.match(source, /\.eq\("organization_id", organizationId\)/);
  assert.match(source, /\.gte\("business_date", period\.startDate\)/);
  assert.match(source, /\.lt\("business_date", period\.endDateExclusive\)/);
  assert.match(source, /\.order\("business_date", \{ ascending: true \}\)[\s\S]*\.order\("closed_at", \{ ascending: true \}\)[\s\S]*\.order\("id", \{ ascending: true \}\)/);
  assert.match(source, /business_date\.gt\.\$\{cursor\.businessDate\}.*id\.gt\.\$\{cursor\.id\}/);
  assert.match(source, /if \(locationId\) query = query\.eq\("location_id", locationId\)/);
  for (const field of ["snapshot", "snapshot_hash", "snapshot_schema_version", "calculation_version", "tenant_timezone"]) assert.ok(source.includes(field));
  assert.match(source, /for \(const close of rows\) yield registerRow\(close\)/);
  assert.match(source, /"operational_daily_close_non_fiscal"/);
  assert.match(source, /JSON\.stringify\(result\.sort/);
  assert.match(source, /if \(number === ""\) return ""/);
  assert.doesNotMatch(source, /getDailyCloseData|getAccountingWorkspace|from\("orders"\)|from\("payments"\)|\.range\(/);
});

test("Standalone 001K-B downloads stay private, streamed and non-fiscal", async () => {
  const [readers, summary, register] = await Promise.all([
    read("src/features/accounting/server/export-readers.ts"),
    read("src/features/accounting/server/accountant-support.ts"),
    read("src/features/accounting/server/daily-close-register.ts"),
  ]);
  assert.match(readers, /"Cache-Control": "private, no-store"/);
  assert.match(readers, /"Content-Disposition": `attachment; filename=/);
  assert.match(readers, /yield `\\uFEFF\$\{line\(headers\)\}`/);
  assert.match(readers, /csvValue/);
  assert.match(readers, /new ReadableStream/);
  assert.match(summary, /yield\* csvChunks/);
  assert.match(register, /yield\* csvChunks/);
  assert.doesNotMatch(summary + register, /taxable|IGIC|IVA|VAT|Modelo|verifactu|export_jobs|ZIP|archive/i);
});
