import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const messages = Object.fromEntries(["it", "es", "en", "fr", "de"].map((locale) =>
  [locale, JSON.parse(read(`src/i18n/${locale}/common.json`)).billing]));
const forbiddenAction = () => { throw Error("Presentation must not invoke a server action"); };

// Execute the real shared view and formatters with local translations only.
// No database, Next server context, document tracker or business action is loaded.
const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const compiledModule = { exports: {} };
  const localRequire = (name) => {
    if (name === "react/jsx-runtime") return require(name);
    if (name === "next-intl/server") return { getTranslations: async ({ locale }) => (key) => {
      const value = key.split(".").reduce((node, part) => node?.[part], messages[locale]);
      assert.equal(typeof value, "string", `Missing ${locale} Billing translation: ${key}`);
      return value;
    } };
    if (["@/lib/number-format", "@/features/billing/tax-rate"].includes(name)) return load(`src/${name.slice(2)}.ts`);
    if (name === "@/features/billing/server/actions") return {
      cancelBillingInvoiceAction: forbiddenAction, deleteBillingDraftAction: forbiddenAction,
      issueBillingInvoiceAction: forbiddenAction, issueSimplifiedBillingInvoiceAction: forbiddenAction, updateBillingDraftAction: forbiddenAction,
      declareBillingAdvanceAction: forbiddenAction, issueBillingAdvanceAction: forbiddenAction,
      issueBillingFinalAfterAdvancesAction: forbiddenAction,
    };
    if (name === "@/components/Button") return { Button: ({ children }) => createElement("button", null, children) };
    if (name === "@/components/Card") return { Card: ({ children }) => createElement("div", null, children) };
    if (name === "@/components/billing/BillingStatusBadge") return { BillingStatusBadge: ({ label }) => createElement("span", null, label) };
    if (name === "@/components/billing/PrintInvoiceButton") return { PrintInvoiceButton: ({ label }) => createElement("button", null, label) };
    if (name === "@/i18n/navigation") return { Link: ({ children, href }) => createElement("a", { href }, children) };
    throw Error(`Unexpected import: ${name}`);
  };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: localRequire }, { filename: path });
  modules.set(path, compiledModule.exports);
  return compiledModule.exports;
}
const { BillingInvoiceView } = load("src/components/billing/BillingInvoiceView.tsx");
const { formatCurrency } = load("src/lib/number-format.ts");
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function detail(items, pricesIncludeTax = true) {
  const sum = (key) => Math.round(items.reduce((total, item) => total + item[key], 0) * 100) / 100;
  return freeze({
    invoice: { id: "memory-only", customerId: "customer-a", documentStatus: "issued", paymentStatus: "unpaid",
      invoiceNumber: "MEMORY-ONLY", issueDate: "2026-10-16", dueDate: null, series: "A", currency: "EUR",
      customerName: "Customer", issuerLegalName: "Issuer", orderIds: ["order-a"], orderNumbers: ["MEMORY-ORDER"],
      pricesIncludeTax, subtotal: sum("lineSubtotal"), discountTotal: sum("discountAmount"), taxableBase: sum("taxableBase"),
      taxTotal: sum("taxAmount"), total: sum("lineTotal"), paidTotal: 0, outstanding: sum("lineTotal") },
    items, payments: [],
  });
}
const line = (values = {}) => ({ id: "line-a", description: "Original service", quantity: 4, unitType: "piece",
  unitPrice: 9, lineSubtotal: 36, discountAmount: 0, taxableBase: 33.64, taxRate: 7, taxAmount: 2.36, lineTotal: 36, ...values });
const text = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
async function render(snapshot, printMode = false, locale = "it") {
  const before = JSON.stringify(snapshot);
  const html = renderToStaticMarkup(await BillingInvoiceView({ detail: snapshot, locale, printMode }));
  assert.equal(JSON.stringify(snapshot), before, "Frozen financial snapshots must remain unchanged");
  return html;
}
function unitPrice(html, locale, net) {
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/)?.[0];
  assert.ok(table, "Invoice line table must be rendered");
  const plain = text(table);
  assert.ok(plain.includes(text(`${messages[locale].items.unitPrice} ${messages[locale].items.unitNet}`)));
  assert.ok(!plain.includes(messages[locale].items.unitGross), "Gross/net must not be stacked in the unit cell");
  const firstRow = table.match(/<tbody>\s*<tr\b[^>]*>([\s\S]*?)<\/tr>/)?.[1];
  const cells = [...firstRow.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];
  assert.equal(text(cells[2][1]), text(formatCurrency(net, "EUR", locale)), "Only net unit price in the unit cell");
}
function totals(html, locale, values) {
  const plain = text(html);
  for (const [key, amount] of Object.entries(values)) {
    const label = messages[locale].totals[key];
    assert.ok(plain.includes(text(`${label} ${formatCurrency(amount, "EUR", locale)}`)), `${label}: ${amount}`);
  }
}

for (const printMode of [false, true]) {
  const mode = printMode ? "print/PDF" : "detail";
  test(`${mode}: four units at EUR 9 preserve gross 36, base 33.64 and included tax 2.36`, async () => {
    const html = await render(detail([line()]), printMode);
    unitPrice(html, "it", 8.41);
    totals(html, "it", { subtotal: 36, taxable: 33.64, total: 36, outstanding: 36 });
    assert.ok(text(html).includes("7% 2,36 €"));
    assert.ok(text(html).includes("Imposta inclusa (7%) 2,36 €"));
    assert.match(text(html.match(/<tbody>[\s\S]*?<\/tbody>/)[0]), /Imponibile\s*:\s*33,64 €/);
    assert.ok(text(html).includes(messages.it.items.unitRoundingNote));
  });
  test(`${mode}: four separate service snapshots retain their own bases and taxes`, async () => {
    const items = Array.from({ length: 4 }, (_, index) => line({ id: `line-${index}`, quantity: 1, lineSubtotal: 9,
      taxableBase: 8.41, taxAmount: .59, lineTotal: 9 }));
    const html = await render(detail(items), printMode);
    assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr\b/g) ?? []).length, 4);
    totals(html, "it", { taxable: 33.64, total: 36 });
  });
  test(`${mode}: allocated discount preserves pre-discount unit prices and canonical discounted base`, async () => {
    const html = await render(detail([line({ discountAmount: 10, taxableBase: 24.30, taxAmount: 1.70, lineTotal: 26 })]), printMode);
    unitPrice(html, "it", 8.41);
    totals(html, "it", { taxable: 24.30, total: 26 });
    assert.ok(text(html).includes("−10,00 €"));
  });
  test(`${mode}: fractional quantity and allocated discount retain stored line rounding`, async () => {
    const html = await render(detail([line({ quantity: .375, unitType: "weight", lineSubtotal: 3.38,
      discountAmount: .38, taxableBase: 2.80, taxAmount: .20, lineTotal: 3 })]), printMode);
    unitPrice(html, "it", 8.41);
    assert.ok(text(html).includes("0,375 kg"));
    totals(html, "it", { taxable: 2.80, total: 3 });
  });
  test(`${mode}: repeating net unit does not reconstruct the line base from rounded units`, async () => {
    const html = await render(detail([line({ quantity: 3, unitPrice: 1, lineSubtotal: 3,
      taxableBase: 2.80, taxAmount: .20, lineTotal: 3 })]), printMode);
    unitPrice(html, "it", .93);
    totals(html, "it", { taxable: 2.80, total: 3 });
    assert.ok(!text(html).includes("2,79 €"));
  });
  test(`${mode}: zero rate preserves identical gross and net units`, async () => {
    const html = await render(detail([line({ taxRate: 0, taxableBase: 36, taxAmount: 0 })]), printMode);
    unitPrice(html, "it", 9);
    totals(html, "it", { taxable: 36, total: 36 });
  });
  test(`${mode}: legacy exclusive snapshot keeps net unit and original discounted financial amounts`, async () => {
    const html = await render(detail([line({ quantity: 2, unitPrice: 9, lineSubtotal: 18,
      discountAmount: 2, taxableBase: 16, taxAmount: 1.12, lineTotal: 17.12 })], false), printMode);
    unitPrice(html, "it", 9);
    totals(html, "it", { subtotal: 18, taxable: 16, total: 17.12 });
    assert.ok(text(html).includes("7% 1,12 €"));
  });
}
for (const locale of Object.keys(messages)) test(`${locale}: both document modes use translated unit labels and rounding note`, async () => {
  for (const printMode of [false, true]) {
    const html = await render(detail([line()]), printMode, locale);
    unitPrice(html, locale, 8.41);
    assert.ok(text(html).includes(messages[locale].items.unitRoundingNote));
  }
});

for (const locale of Object.keys(messages)) test(`${locale}: every catalog unit has a Billing translation in detail and print`, async () => {
  const catalog = JSON.parse(read(`src/i18n/${locale}/common.json`)).catalog.unitTypes;
  for (const printMode of [false, true]) {
    for (const unitType of Object.keys(catalog)) {
      const html = await render(detail([line({ unitType })]), printMode, locale);
      assert.equal(typeof messages[locale].units[unitType], "string", `${locale}: ${unitType}`);
      assert.ok(text(html).includes(text(`4 ${messages[locale].units[unitType]}`)));
      assert.doesNotMatch(html, /common\.billing\.|units\./);
    }
  }
});

test("both modes preserve and escape long descriptions with scoped table and amount layout", async () => {
  const description = 'Long service <script>unsafe</script> ' + 'LongUnbrokenDescription'.repeat(12);
  for (const printMode of [false, true]) {
    const html = await render(detail([line({ description, unitType: "service" })]), printMode);
    assert.ok(html.includes(description.replaceAll("<", "&lt;").replaceAll(">", "&gt;")));
    assert.match(html, /class="billing-invoice-table-scroll/);
    assert.match(html, /<colgroup>/);
    assert.equal((html.match(/scope="col"/g) ?? []).length, 6);
    assert.match(html, /class="billing-invoice-amount/);
    assert.doesNotMatch(html, /min-w-\[44rem\]/);
  }
});

for (const locale of ["it","es","en","fr","de"]) test(`${locale}: issued simplified copies carry the same service date and immutable fiscal number`, async()=>{
 const fixture=JSON.parse(JSON.stringify(detail([line()])));
 Object.assign(fixture.invoice,{fiscalDocumentType:"simplified",servicePerformedOn:"2026-10-18",recipientSnapshotMode:"anonymous",customerId:null,customerName:null});
 const html=await render(fixture,true,locale);const label=messages[locale].serviceIssue.date;
 assert.equal(text(html).split(label).length-1,2);
 assert.equal(text(html).split(fixture.invoice.invoiceNumber).length-1,2);
 assert.equal(text(html).split(messages[locale].document.customerCopy).length-1,1);
 assert.ok(!text(html).includes("common.billing."));
});
test("enabled simplified declaration uses blank explicit date, with operational time only as reference",async()=>{
 const fixture=JSON.parse(JSON.stringify(detail([line()])));
 Object.assign(fixture.invoice,{fiscalDocumentType:"simplified",documentStatus:"draft",paymentStatus:"draft",recipientSnapshotMode:"anonymous",customerId:null,customerName:null});
 fixture.simplifiedIssuanceReady=true;fixture.operationalCompletedAt="2026-10-17T12:00:00Z";
 const html=await render(fixture,false,"it");assert.match(html,/name="servicePerformedOn"/);
 assert.doesNotMatch(html,/name="servicePerformedOn"[^>]*value=/);assert.match(html,/name="serviceConfirmed"/);
});

for (const locale of ["it", "es", "en", "fr", "de"]) test(`C2 ${locale}: document payment heading and refund sign preserve issued snapshot`, async () => {
  const snapshot = JSON.parse(JSON.stringify(detail([line()])));
  Object.assign(snapshot.invoice, { fiscalDocumentType: "simplified", billingEventKind: "advance", paidTotal: 1.5 });
  snapshot.payments = [
    { id: "p", amount: 2, status: "confirmed", method: "cash", paidAt: "2026-10-19T10:00:00Z" },
    { id: "r", amount: .5, status: "refunded", method: "cash", paidAt: "2026-10-19T11:00:00Z" },
  ];
  const html = await render(freeze(snapshot), false, locale);
  assert.ok(text(html).includes(messages[locale].payments.documentTitle));
  assert.ok(text(html).includes(text(`−${formatCurrency(.5, "EUR", locale)}`)));
  assert.ok(text(html).includes(text(`${messages[locale].totals.paid} ${formatCurrency(1.5, "EUR", locale)}`)));
});

test("C2 draft delete action follows issued advances; ordinary and unpaid drafts remain deletable", async () => {
  for (const fiscalDocumentType of ["ordinary", "simplified"]) {
    for (const invoiceNumber of [null, "2026-S-000001"]) {
      const snapshot = JSON.parse(JSON.stringify(detail([line()])));
      Object.assign(snapshot.invoice, { fiscalDocumentType, documentStatus: "draft", paymentStatus: "draft" });
      snapshot.advanceDocuments = [{ id: "advance", invoiceNumber, total: 2 }];
      snapshot.simplifiedIssuanceReady = false;
      const html = await render(snapshot);
      assert.equal(text(html).includes(messages.it.actions.deleteDraft),
        fiscalDocumentType === "ordinary" || invoiceNumber === null);
    }
  }
});
