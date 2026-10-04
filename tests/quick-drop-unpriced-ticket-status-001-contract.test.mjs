import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live print context reuses canonical tenant-scoped Quick Drop financial state", async () => {
  const [query, types, quickDropQuery] = await Promise.all([
    source("src/features/printing/server/queries.ts"),
    source("src/features/printing/types.ts"),
    source("src/features/quick-drop/server/queries.ts"),
  ]);
  assert.match(query, /requirePrintAccess\(locale\)/);
  assert.match(query, /getQuickDropOrderOrNull\(locale, orderId\)/);
  assert.match(query, /quickDropFinancialState: quickDrop\?\.financialState \?\? null/);
  assert.match(types, /quickDropFinancialState: QuickDropFinancialState \| null/);
  assert.match(quickDropQuery, /financialState: pendingDetail \? "unpriced" : "priced"/);
  assert.match(quickDropQuery, /eq\("organization_id", organizationId\)/);
  assert.match(quickDropQuery, /contains\("metadata", \{ source: "quick_drop" \}\)/);
  assert.doesNotMatch(query, /quickDropFinancialState:\s*(?:order\.total|items\.length)/);
});

test("only the internal ticket substitutes the existing localized unpriced concept", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  const receipt = document.slice(document.indexOf("async function Receipt"), document.indexOf("async function Ticket"));
  const ticket = document.slice(document.indexOf("async function Ticket"), document.indexOf("async function Labels"));
  const labels = document.slice(document.indexOf("async function Labels"), document.indexOf("export async function OrderPrintDocument"));
  assert.match(ticket, /getTranslations\(\{ locale, namespace: "common\.quickDrop" \}\)/);
  assert.match(ticket, /context\.quickDropFinancialState === "unpriced" \? quickDropT\("unpriced"\) : t\(`paymentStatuses\.\$\{context\.paymentSummary\.paymentStatus\}`\)/);
  assert.doesNotMatch(ticket, /order\.total\s*===?\s*0|items\.length\s*===?\s*0/);
  assert.doesNotMatch(receipt, /quickDropFinancialState|quickDropT/);
  assert.doesNotMatch(labels, /quickDropFinancialState|quickDropT/);
});

test("priced Quick Drops and normal zero-value Orders retain canonical payment summary", async () => {
  const [query, document, paymentTypes, summaryQuery] = await Promise.all([
    source("src/features/printing/server/queries.ts"),
    source("src/components/printing/OrderPrintDocument.tsx"),
    source("src/features/payments/types.ts"),
    source("src/features/payments/server/queries.ts"),
  ]);
  assert.match(query, /getOrderPaymentSummary\(locale, orderId\)/);
  assert.match(query, /quickDropFinancialState: quickDrop\?\.financialState \?\? null/);
  const ticket = document.slice(document.indexOf("async function Ticket"), document.indexOf("async function Labels"));
  assert.match(ticket, /context\.quickDropFinancialState === "unpriced" \? quickDropT\("unpriced"\) : t\(`paymentStatuses\.\$\{context\.paymentSummary\.paymentStatus\}`\)/);
  assert.match(paymentTypes, /DERIVED_PAYMENT_STATUSES = \["unpaid", "partially_paid", "paid", "refunded", "void"\]/);
  assert.match(summaryQuery, /rpc\("get_order_payment_summary", \{ target_order_id: orderId \}\)/);
});

test("all existing Quick Drop unpriced translations remain available without print duplication", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.quickDrop.unpriced);
    assert.equal(Object.hasOwn(messages.print.paymentStatuses, "unpriced"), false);
  }
});
