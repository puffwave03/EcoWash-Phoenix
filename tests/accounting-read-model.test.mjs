import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { accountingPeriodBounds, buildAccountingSummary } from "../src/features/accounting/summary.ts";

const period = { startDate: "2026-08-01", endDateExclusive: "2026-09-01" };
const order = (overrides = {}) => ({ activeItemCount: 1, createdAt: "2026-08-15T10:00:00.000Z", currency: "EUR", id: crypto.randomUUID(), isQuickDrop: false, locationId: "loc-a", subtotal: 100, total: 100, ...overrides });
const payment = (overrides = {}) => ({ amount: 100, channel: "pos", currency: "EUR", id: crypto.randomUUID(), locationId: "loc-a", method: "cash", orderId: "order-a", paidAt: "2026-08-15T11:00:00.000Z", posSessionId: null, status: "confirmed", ...overrides });
const summary = (overrides = {}) => buildAccountingSummary({ locationId: null, paymentPeriod: period, periodPayments: [], posSessionPayments: [], posSessions: [], receivableConfirmedPayments: [], salesOrders: [], salesPeriod: period, timezone: "Atlantic/Canary", ...overrides }).currencies[0];

test("1 sale without payment is fully receivable", () => {
  const value = summary({ salesOrders: [order({ id: "order-a" })] });
  assert.equal(value.salesNet, 100); assert.equal(value.collectedGross, 0); assert.equal(value.outstanding, 100);
});

test("2 full payment settles the order", () => {
  const paid = payment();
  const value = summary({ periodPayments: [paid], receivableConfirmedPayments: [paid], salesOrders: [order({ id: "order-a" })] });
  assert.equal(value.collectedGross, 100); assert.equal(value.outstanding, 0);
});

test("3 partial payment and pay-later remain canonical receivables", () => {
  const paid = payment({ amount: 20 });
  const value = summary({ periodPayments: [paid], receivableConfirmedPayments: [paid], salesOrders: [order({ id: "order-a" })] });
  assert.equal(value.collectedNet, 20); assert.equal(value.outstanding, 80);
});

test("4 split cash/card is counted once and split accurately", () => {
  const cash = payment({ amount: 40, id: "cash" });
  const card = payment({ amount: 60, id: "card", method: "card" });
  const value = summary({ periodPayments: [cash, card], receivableConfirmedPayments: [cash, card], salesOrders: [order({ id: "order-a" })] });
  assert.equal(value.collectedGross, 100); assert.equal(value.cashCollected, 40); assert.equal(value.cardCollected, 60);
});

test("5 refunds reduce net collected without creating a second sale or receivable", () => {
  const paid = payment();
  const refund = payment({ amount: 20, id: "refund", status: "refunded" });
  const value = summary({ periodPayments: [paid, refund], receivableConfirmedPayments: [paid], salesOrders: [order({ id: "order-a" })] });
  assert.equal(value.salesNet, 100); assert.equal(value.refunds, 20); assert.equal(value.collectedNet, 80); assert.equal(value.outstanding, 0);
});

test("6 invoices are absent from the order-based sales input and cannot double count", async () => {
  const query = await readFile(new URL("../src/features/accounting/server/queries.ts", import.meta.url), "utf8");
  assert.doesNotMatch(query, /from\("invoices"\)|from\("invoice_items"\)/);
  assert.equal(summary({ salesOrders: [order()] }).salesNet, 100);
});

test("7 pending/reconciliation online attempts are excluded; confirmed canonical online payments count", () => {
  const pending = payment({ channel: "online", status: "pending" });
  const confirmed = payment({ amount: 30, channel: "online", id: "online", method: "card" });
  const value = summary({ periodPayments: [pending, confirmed] });
  assert.equal(value.collectedGross, 30); assert.equal(value.onlineCollected, 30); assert.equal(value.cardCollected, 0);
});

test("8 undetailed Quick Drop is excluded and detailed Quick Drop is normal", () => {
  const value = summary({ salesOrders: [order({ activeItemCount: 0, id: "pending", isQuickDrop: true, subtotal: 0, total: 0 }), order({ id: "detailed", isQuickDrop: true })] });
  assert.equal(value.orderCount, 1); assert.deepEqual(value.orderIds, ["detailed"]); assert.equal(value.salesNet, 100);
});

test("9 POS expected cash matches opening plus confirmed cash minus cash refunds", () => {
  const session = { countedCash: null, currency: "EUR", difference: null, expectedCash: null, id: "session", locationId: "loc-a", openedAt: "2026-08-15T09:00:00.000Z", openingCash: 50, status: "open" };
  const value = summary({ posSessionPayments: [payment({ amount: 40, posSessionId: "session" }), payment({ amount: 10, id: "refund", posSessionId: "session", status: "refunded" })], posSessions: [session] });
  assert.equal(value.posOpeningCash, 50); assert.equal(value.posExpectedCash, 80);
});

test("10 sales gross is subtotal, sales net is total, and discount is explicit", () => {
  const value = summary({ salesOrders: [order({ subtotal: 120, total: 100 })] });
  assert.equal(value.salesGross, 120); assert.equal(value.salesNet, 100); assert.equal(value.discountTotal, 20);
});

test("11 organization timezone produces explicit UTC period boundaries", () => {
  assert.deepEqual(accountingPeriodBounds(period, "Atlantic/Canary"), { start: "2026-07-31T23:00:00.000Z", end: "2026-08-31T23:00:00.000Z" });
  assert.throws(() => accountingPeriodBounds({ startDate: "2026-09-01", endDateExclusive: "2026-09-01" }, "UTC"));
});

test("12 location and tenant scope are enforced by the server query", async () => {
  const query = await readFile(new URL("../src/features/accounting/server/queries.ts", import.meta.url), "utf8");
  assert.match(query, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /\.eq\("organization_id", organizationId\)/g);
  assert.match(query, /accounting_location_invalid/);
  assert.match(query, /query = query\.eq\("location_id", locationId\)/);
  assert.match(query, /query = query\.eq\("order\.location_id", locationId\)/);
  assert.match(query, /\.gte\("created_at", salesBounds\.start\)\.lt\("created_at", salesBounds\.end\)/);
  assert.match(query, /\.gte\("paid_at", paymentBounds\.start\)\.lt\("paid_at", paymentBounds\.end\)/);
});

test("13 payment methods and mixed currencies remain separate", () => {
  const bank = payment({ amount: 25, method: "bank_transfer" });
  const other = payment({ amount: 5, currency: "USD", id: "other", method: "other" });
  const result = buildAccountingSummary({ locationId: null, paymentPeriod: period, periodPayments: [bank, other], posSessionPayments: [], posSessions: [], receivableConfirmedPayments: [], salesOrders: [], salesPeriod: period, timezone: "UTC" });
  assert.equal(result.currencies.length, 2);
  assert.equal(result.currencies.find((row) => row.currency === "EUR").bankTransferCollected, 25);
  assert.equal(result.currencies.find((row) => row.currency === "USD").otherCollected, 5);
});

test("14 canonical rows, not provider events, are the only payment input", async () => {
  const query = await readFile(new URL("../src/features/accounting/server/queries.ts", import.meta.url), "utf8");
  assert.match(query, /from\("payments"\)/);
  assert.doesNotMatch(query, /online_payment_attempts|online_payment_provider_events/);
  assert.match(query, /\.eq\("status", "confirmed"\)/);
});
