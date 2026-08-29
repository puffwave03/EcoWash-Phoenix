import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one reusable disclosure uses a semantic accessible button", async () => {
  const disclosure = await source("src/components/DisclosureSection.tsx");

  assert.match(disclosure, /<button/);
  assert.match(disclosure, /type="button"/);
  assert.match(disclosure, /aria-expanded=\{isOpen\}/);
  assert.match(disclosure, /aria-controls=\{contentId\}/);
  assert.match(disclosure, /onClick=\{\(\) => setIsOpen/);
  assert.match(disclosure, /focus-visible:ring-2/);
  assert.match(disclosure, /hidden=\{!isOpen\}/);
  assert.doesNotMatch(disclosure, /localStorage|sessionStorage|fetch\(|form action/);
});

test("disclosure headers are touch-friendly and responsive", async () => {
  const disclosure = await source("src/components/DisclosureSection.tsx");

  assert.match(disclosure, /min-h-16 w-full/);
  assert.match(disclosure, /min-w-0/);
  assert.match(disclosure, /break-words/);
  assert.match(disclosure, /shrink-0/);
  assert.doesNotMatch(disclosure, /min-w-\[[^\]]+\]|overflow-x-auto|whitespace-nowrap/);
});

test("Customer Account collapses only long secondary lists using loaded data", async () => {
  const view = await source("src/components/customers/CustomerAccountView.tsx");

  assert.equal((view.match(/<DisclosureSection/g) ?? []).length, 3);
  assert.match(view, /count=\{financials\.orders\.length\}/);
  assert.match(view, /defaultOpen=\{financials\.orders\.length <= 3\}/);
  assert.match(view, /count=\{financials\.payments\.length\}/);
  assert.match(view, /defaultOpen=\{financials\.payments\.length <= 3\}/);
  assert.match(view, /count=\{properties\.length\}/);
  assert.match(view, /defaultOpen=\{properties\.length <= 3\}/);
  assert.match(view, /financials\.orders\[0\]/);
  assert.match(view, /financials\.payments\[0\]/);
});

test("primary customer and lifecycle information remains immediately visible", async () => {
  const view = await source("src/components/customers/CustomerAccountView.tsx");
  const firstDisclosure = view.indexOf("<DisclosureSection");

  assert.ok(view.indexOf('id="financial-summary"') < firstDisclosure);
  assert.ok(view.indexOf("<CustomerBillingSection") < firstDisclosure);
  assert.match(view, /<CustomerLifecycleControl/);
  assert.match(view, /<details[\s\S]*open>/);
});

test("order status and payment controls stay open while long histories collapse", async () => {
  const [status, payments] = await Promise.all([
    source("src/components/orders/StatusTransitionForm.tsx"),
    source("src/components/payments/PaymentsPanel.tsx"),
  ]);

  assert.match(status, /<form action=\{action\}/);
  assert.match(status, /count=\{history\.length\}/);
  assert.match(status, /defaultOpen=\{history\.length <= 3\}/);
  assert.match(payments, /text\.paymentStatus/);
  assert.match(payments, /summary\.balanceDue > 0/);
  assert.match(payments, /count=\{payments\.length\}/);
  assert.match(payments, /defaultOpen=\{payments\.length <= 3\}/);
});

test("all supported locales name order payment history", async () => {
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.orders.payments.history, "string");
  }
});
