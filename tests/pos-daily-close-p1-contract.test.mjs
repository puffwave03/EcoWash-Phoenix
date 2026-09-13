import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  accountingPeriodBounds,
  buildAccountingSummary,
  buildReceivableBalances,
} from "../src/features/accounting/summary.ts";
import { deriveOrderDisplayStatus } from "../src/features/orders/display-status.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const order = (overrides = {}) => ({ activeItemCount: 1, createdAt: "2026-09-12T10:00:00Z", currency: "EUR", id: "order-1", isQuickDrop: false, locationId: "location-1", subtotal: 100, total: 100, ...overrides });
const payment = (overrides = {}) => ({ amount: 100, channel: "pos", currency: "EUR", id: "payment-1", locationId: "location-1", method: "cash", orderId: "order-1", paidAt: "2026-09-12T11:00:00Z", posSessionId: "session-1", status: "confirmed", ...overrides });
const period = { endDateExclusive: "2026-09-13", startDate: "2026-09-12" };

function summary({ payments = [], receivablePayments = payments, orders = [order()], sessions = [] } = {}) {
  return buildAccountingSummary({
    locationId: null,
    paymentPeriod: period,
    periodPayments: payments,
    posSessionPayments: payments,
    posSessions: sessions,
    receivableConfirmedPayments: receivablePayments,
    salesOrders: orders,
    salesPeriod: period,
    timezone: "Atlantic/Canary",
  }).currencies[0];
}

test("1 tenant-local boundaries remain DST-aware and do not assume UTC", () => {
  assert.deepEqual(accountingPeriodBounds({ startDate: "2026-07-01", endDateExclusive: "2026-07-02" }, "Atlantic/Canary"), {
    start: "2026-06-30T23:00:00.000Z",
    end: "2026-07-01T23:00:00.000Z",
  });
  assert.deepEqual(accountingPeriodBounds({ startDate: "2026-01-01", endDateExclusive: "2026-01-02" }, "Atlantic/Canary"), {
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-01-02T00:00:00.000Z",
  });
});

test("2 business date defaults tenant-locally and accepts a previous selected date", async () => {
  const [preview, page] = await Promise.all([
    source("src/features/daily-close/preview.ts"),
    source("src/app/[locale]/app/(dashboard)/daily-close/page.tsx"),
  ]);
  assert.match(preview, /resolveAccountingPeriod\("today"[\s\S]*timeZone, now\)/);
  assert.match(preview, /input && isBusinessDate\(input\) \? input : current/);
  assert.match(page, /searchParams: Promise<\{ date\?: string; location\?: string \}>/);
  assert.match(page, /businessDate: date, locationId: location/);
});

test("2a today and previous-date views distinguish live state without fabricating an as-of snapshot", async () => {
  const dashboard = await source("src/components/daily-close/DailyCloseDashboard.tsx");
  assert.match(dashboard, /const isHistoricalBusinessDate = data\.businessDate < data\.currentBusinessDate/);
  assert.match(dashboard, /isHistoricalBusinessDate \? <div[^>]*>[\s\S]*text\.semantics\.historicalNotice/);
  assert.match(dashboard, /text\.semantics\.selectedDateFacts/);
  assert.match(dashboard, /text\.semantics\.currentState/);
  assert.match(dashboard, /text\.semantics\.currentStateNote/);
  assert.doesNotMatch(dashboard, /asOf|historicalState|reconstructHistorical/);
});

test("2b date-bound order, payment and logistics values remain sourced from the selected day", async () => {
  const [dashboard, query] = await Promise.all([
    source("src/components/daily-close/DailyCloseDashboard.tsx"),
    source("src/features/daily-close/server/queries.ts"),
  ]);
  assert.ok(dashboard.indexOf("text.metrics.ordersCreated") < dashboard.indexOf("text.semantics.currentState"));
  assert.ok(dashboard.indexOf("text.metrics.collectedNet") < dashboard.indexOf("text.metrics.outstanding"));
  assert.match(query, /paymentPeriod: period,[\s\S]*salesPeriod: period/);
  assert.equal((query.match(/\.filter\(\(row\) => isDueForClose\(row, end\)\)/g) ?? []).length, 2);
});

test("3 selected-day order events use created, production-completed and cancelled timestamps", async () => {
  const query = await source("src/features/daily-close/server/queries.ts");
  for (const timestamp of ["created_at", "completed_at", "cancelled_at"]) {
    assert.match(query, new RegExp(`gte\\(\"${timestamp}\", day\\.start\\.toISOString\\(\\)\\)\\.lt\\(\"${timestamp}\", endExclusive\\.toISOString\\(\\)\\)`));
  }
  assert.match(query, /created: created\.length/);
  assert.match(query, /productionCompleted: productionCompleted\.length/);
  assert.match(query, /cancelled: cancelled\.length/);
});

test("4 production completion and final fulfillment remain distinct", () => {
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", pickupStatus: "scheduled", deliveryStatus: null }), "pickup_scheduled");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", pickupStatus: "completed", deliveryStatus: null }), "ready_for_customer_pickup");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", pickupStatus: null, deliveryStatus: "completed" }), "completed");
});

test("5-8 payment totals, refunds, methods and outstanding reuse Accounting canon", () => {
  const payments = [
    payment({ amount: 60, id: "cash", method: "cash" }),
    payment({ amount: 25, id: "card", method: "card" }),
    payment({ amount: 10, id: "refund", method: "cash", status: "refunded" }),
  ];
  const value = summary({ payments, receivablePayments: payments.filter((item) => item.status === "confirmed") });
  assert.equal(value.collectedGross, 85);
  assert.equal(value.refunds, 10);
  assert.equal(value.collectedNet, 75);
  assert.equal(value.cashCollected, 60);
  assert.equal(value.cardCollected, 25);
  assert.equal(value.outstanding, 15);
  assert.equal(buildReceivableBalances([order()], payments).get("order-1"), 15);
});

test("9-11 future logistics is excluded, overdue work included and cancelled parents rejected", async () => {
  const query = await source("src/features/daily-close/server/queries.ts");
  assert.match(query, /return Boolean\(row\.scheduled_at && new Date\(row\.scheduled_at\) <= end\)/);
  assert.match(query, /new Date\(row\.scheduled_at as string\) < now/);
  assert.match(query, /isOperationalLogisticsParent\(\{\s+isActive: order\.is_active,\s+productionStatus: order\.production_status,/);
  assert.equal((query.match(/\.filter\(\(row\) => isDueForClose\(row, end\)\)/g) ?? []).length, 2);
});

test("12-13 POS readiness flags open sessions and summarizes closed-session cash", async () => {
  const query = await source("src/features/daily-close/server/queries.ts");
  assert.match(query, /openSessions: openIds\.size/);
  assert.match(query, /closedSessions: sessions\.filter\(\(row\) => row\.status === \"closed\"\)\.length/);
  assert.match(query, /expectedCash: currency\.posExpectedCash/);
  assert.match(query, /countedCash: currency\.posCountedCash/);
  assert.match(query, /variance: currency\.posDifference/);
});

test("14 source failure is explicit and cannot look like a complete close preview", async () => {
  const query = await source("src/features/daily-close/server/queries.ts");
  assert.match(query, /Promise\.allSettled/);
  assert.match(query, /failedSources\.push\("orders"\)/);
  assert.match(query, /failedSources\.push\("payments"\)/);
  assert.match(query, /complete: failedSources\.length === 0/);
  assert.match(query, /source_unavailable/);
});

test("15 tenant and location isolation are server-derived and owner-manager access is preserved", async () => {
  const [query, page] = await Promise.all([
    source("src/features/daily-close/server/queries.ts"),
    source("src/app/[locale]/app/(dashboard)/daily-close/page.tsx"),
  ]);
  assert.match(query, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /const organizationId = membership\.organization\.id/);
  assert.ok((query.match(/\.eq\("organization_id", organizationId\)/g) ?? []).length >= 10);
  assert.match(query, /locations\.some\(\(location\) => location\.id === requestedLocationId\)/);
  assert.match(page, /if \(access\.membership\.role === "staff"\) \{\s+redirect/);
});

test("all locales contain the Phase 1 preview, non-fiscal, section and blocker vocabulary", async () => {
  for (const locale of ["de", "en", "es", "fr", "it"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.dailyClose.previewLabel, "string");
    assert.equal(typeof messages.dailyClose.nonFiscal, "string");
    for (const semantic of ["selectedDateFacts", "selectedDateNote", "currentState", "currentStateNote", "historicalNotice"]) assert.equal(typeof messages.dailyClose.semantics[semantic], "string");
    for (const section of ["businessDay", "orders", "payments", "pos", "logistics", "attention"]) assert.equal(typeof messages.dailyClose.sections[section], "string");
    for (const blocker of ["source_unavailable", "future_business_date", "open_pos_session", "cash_without_session", "unassigned_location"]) assert.equal(typeof messages.dailyClose.blockers[blocker], "string");
  }
});
