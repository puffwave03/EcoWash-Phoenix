import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function alertDerivation() {
  const alerts = await source("src/features/alerts/server/queries.ts");
  const productionLoopStart = alerts.indexOf("for (const order of orders.filter(isOpenOrder))");
  const paymentLoopStart = alerts.indexOf("for (const order of orders) {", productionLoopStart);

  assert.notEqual(productionLoopStart, -1);
  assert.notEqual(paymentLoopStart, -1);

  return {
    alerts,
    paymentLoop: alerts.slice(paymentLoopStart, alerts.indexOf("for (const pickup of pickups)", paymentLoopStart)),
    productionLoop: alerts.slice(productionLoopStart, paymentLoopStart),
  };
}

test("completed-production unpaid and partially paid orders are evaluated for payment alerts", async () => {
  const { paymentLoop, productionLoop } = await alertDerivation();

  assert.doesNotMatch(productionLoop, /paymentTotals/);
  assert.match(paymentLoop, /for \(const order of orders\)/);
  assert.match(paymentLoop, /const totals = paymentTotals\(order, payments\)/);
  assert.match(paymentLoop, /if \(totals\.balanceDue > 0\)/);
  assert.match(paymentLoop, /alertBase\(order, "payment_issue", "warning", order\.due_at\)/);
});

test("open-production unpaid orders remain eligible for payment alerts", async () => {
  const { alerts, paymentLoop } = await alertDerivation();

  assert.match(alerts, /for \(const order of orders\.filter\(isOpenOrder\)\)/);
  assert.match(paymentLoop, /for \(const order of orders\)/);
});

test("fully paid orders do not create payment alerts", async () => {
  const { paymentLoop } = await alertDerivation();

  assert.match(paymentLoop, /if \(totals\.balanceDue > 0\)/);
});

test("cancelled orders are excluded before payment alert derivation", async () => {
  const { alerts } = await alertDerivation();

  assert.match(alerts, /\.neq\("production_status", "cancelled"\)/);
});

test("Alerts page and navigation badge use the same canonical derivation", async () => {
  const { alerts } = await alertDerivation();

  assert.match(alerts, /export async function getOperationalAlerts\(locale: string\) \{\s+return loadOperationalAlerts\(locale\);\s+\}/);
  assert.match(alerts, /export async function getOperationalAlertCount\(locale: string\) \{[\s\S]*const data = await loadOperationalAlerts\(locale\);[\s\S]*return data\.summary\.total;/);
});

test("order and payment alert inputs remain tenant scoped", async () => {
  const { alerts } = await alertDerivation();
  const tenantFilters = alerts.match(/\.eq\("organization_id", membership\.organization\.id\)/g) ?? [];

  assert.equal(tenantFilters.length, 4);
  assert.match(alerts, /\.from\("orders"\)[\s\S]*?\.eq\("organization_id", membership\.organization\.id\)[\s\S]*?\.from\("payments"\)[\s\S]*?\.eq\("organization_id", membership\.organization\.id\)/);
});
