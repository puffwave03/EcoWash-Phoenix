import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { terminal, nodes, content } from "./helpers/shop-terminal-harness.mjs";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const messages = (locale) => JSON.parse(read(`src/i18n/${locale}/common.json`));
const route = "src/app/[locale]/app/(dashboard)/orders/[orderId]/print/customer-copy/page.tsx";
const documentPath = "src/components/printing/OrderPrintDocument.tsx";
function load(path, imports) {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require(name) {
    if (name === "react/jsx-runtime") return require(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected import: ${name}`);
  } }, { filename: path });
  return compiledModule.exports;
}
const { formatCurrency, formatQuantity } = load("src/lib/number-format.ts", {});
function fixture() {
  return {
    branding: { brand: { name: "Laundry", logoPath: null }, support: {} },
    organizationName: "Laundry", locationName: "Shop", timezone: "Atlantic/Canary",
    order: { id: "order-test", orderNumber: "EW-TEST", customerName: "Synthetic customer",
      currency: "EUR", subtotal: 81, discountAmount: 5, total: 76,
      createdAt: "2026-11-05T09:00:00Z", dueAt: "2026-11-06T09:00:00Z",
      customerNotes: "CUSTOMER_WARNING: cold wash", internalNotes: "CONFIDENTIAL_STAFF_NOTE",
      futurePrivateField: "FUTURE_PRIVATE_DATA" },
    items: [{ id: "item-test", description: "Shirt", quantity: 2, unitType: "piece", unitPrice: 40.5, lineTotal: 81, notes: "UNCLASSIFIED_ITEM_NOTE" }],
    createdByName: "PRIVATE_OPERATOR", customerPhone: "PRIVATE_PHONE",
    logistics: { pickup: { status: "scheduled", scheduledAt: null, notes: "PRIVATE_LOGISTICS" }, delivery: null },
    payments: [{ reference: "PRIVATE_PAYMENT_REFERENCE" }],
    paymentSummary: { paymentStatus: "unpaid", totalDue: 76, totalPaid: 0, balanceDue: 76 }, quickDropFinancialState: null,
    barcodeEnabled: false, printerProfiles: {},
  };
}
const Document = load(documentPath, {
  "next/image": { default: "img" },
  "next-intl/server": { getTranslations: async ({ locale, namespace }) => {
    const dictionary = namespace.split(".").slice(1).reduce((obj, key) => obj[key], messages(locale));
    return (key) => {
      const value = key.split(".").reduce((obj, part) => obj?.[part], dictionary);
      assert.equal(typeof value, "string", `Missing ${locale}:${namespace}.${key}`);
      return value;
    };
  } },
  "@/components/printing/PrintButton": { PrintButton: ({ label }) => React.createElement("button", null, label) },
  "@/features/printing/labels": { buildPrintLabels: () => [] },
  "@/i18n/navigation": { Link: ({ href, className, children }) => React.createElement("a", { href, className }, children) },
  "@/lib/number-format": { formatCurrency, formatQuantity },
  "@/components/barcode/ScannableQrCode": { ScannableQrCode: () => React.createElement("svg") },
  "@/features/barcode/payload": { createOrderCode: (id) => id },
  "@/lib/organization-timezone": { formatOrganizationDateTime: (date) => date },
}).OrderPrintDocument;
// Resolve async server components, then serialize their real React element tree.
// No database, browser session, or fiscal action is involved.
async function resolveTree(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === "function") return resolveTree(await node.type(node.props));
  const children = await resolveTree(node.props.children);
  return React.cloneElement(node, {}, ...(Array.isArray(children) ? children : [children]));
}
async function render(context, locale, mode) {
  return renderToStaticMarkup(await resolveTree(await Document({ context, locale, mode })));
}
for (const locale of ["it", "es", "en", "fr", "de"]) {
  test(`${locale}: actual customer output contains warnings and excludes all private markers`, async () => {
    const context = fixture();
    const before = JSON.stringify(context);
    const html = await render(context, locale, "customer-copy");
    assert.match(html, /CUSTOMER_WARNING: cold wash/);
    assert.match(html, /EW-TEST/);
    assert.match(html, /Shirt/);
    assert.doesNotMatch(html, /CONFIDENTIAL|UNCLASSIFIED|PRIVATE|FUTURE_PRIVATE/);
    assert.ok(html.includes(messages(locale).print.customerCopy.title));
    assert.equal(JSON.stringify(context), before);
  });
  for (const [paymentStatus, totalPaid, balanceDue] of [["unpaid", 0, 76], ["paid", 76, 0], ["partially_paid", 31.25, 44.75]]) {
    test(`${locale}: current customer amounts for ${paymentStatus} use canonical values and exclude private information`, async () => {
      const context = fixture();
      context.paymentSummary = { ...context.paymentSummary, paymentStatus, totalPaid, balanceDue };
      const before = JSON.stringify(context);
      const html = await render(context, locale, "customer-copy");
      const t = messages(locale).print;
      for (const value of [t.customerCopy.unitPrice, t.customerCopy.currentSummary, t.fields.lineTotal,
        t.fields.subtotal, t.fields.discount, t.fields.total, t.fields.paid, t.fields.outstanding]) {
        assert.ok(html.includes(value), `Missing ${locale} label: ${value}`);
      }
      for (const amount of [context.items[0].unitPrice, context.items[0].lineTotal]) {
        assert.ok(html.includes(`<td>${formatCurrency(amount, context.order.currency, locale)}</td>`));
      }
      assert.ok(html.includes(`<td>${formatQuantity(context.items[0].quantity, locale)}</td>`));
      assert.ok(html.includes(`<td>${t.units.piece}</td>`));
      for (const [label, amount, prefix = ""] of [
        [t.fields.subtotal, context.order.subtotal], [t.fields.discount, context.order.discountAmount, "−"],
        [t.fields.total, context.order.total], [t.fields.paid, totalPaid], [t.fields.outstanding, balanceDue],
      ]) {
        assert.ok(html.includes(`<dt>${label}</dt><dd>${prefix}${formatCurrency(amount, context.order.currency, locale)}</dd>`), `Wrong ${locale} ${label}`);
      }
      assert.match(html, /CUSTOMER_WARNING: cold wash/);
      assert.doesNotMatch(html, /CONFIDENTIAL|UNCLASSIFIED|PRIVATE|FUTURE_PRIVATE/);
      assert.equal(JSON.stringify(context), before);
    });
  }
  test(`${locale}: staff ticket retains all three note sources`, async () => {
    const html = await render(fixture(), locale, "ticket");
    for (const marker of ["CUSTOMER_WARNING", "CONFIDENTIAL_STAFF_NOTE", "UNCLASSIFIED_ITEM_NOTE"]) assert.ok(html.includes(marker));
    assert.ok(html.includes(messages(locale).print.ticket.internalTicket));
  });
}
test("customer copy with no public note does not fall back to confidential notes", async () => {
  const context = fixture(); context.order.customerNotes = null;
  const html = await render(context, "it", "customer-copy");
  assert.doesNotMatch(html, /CONFIDENTIAL|UNCLASSIFIED|PRIVATE|CUSTOMER_WARNING/);
});
test("customer route uses only the authorized read query and shared customer renderer", async () => {
  const calls = [];
  const Page = load(route, {
    "@/components/printing/OrderPrintDocument": { OrderPrintDocument: Document },
    "@/features/printing/server/queries": { getPrintOrderContext: async (...args) => { calls.push(args); return fixture(); } },
  }).default;
  const html = renderToStaticMarkup(await resolveTree(await Page({ params: Promise.resolve({ locale: "it", orderId: "order-test" }) })));
  assert.deepEqual(calls, [["it", "order-test"]]);
  assert.match(html, /CUSTOMER_WARNING/);
  assert.doesNotMatch(html, /CONFIDENTIAL|UNCLASSIFIED|PRIVATE/);
  const DeniedPage = load(route, {
    "@/components/printing/OrderPrintDocument": { OrderPrintDocument: Document },
    "@/features/printing/server/queries": { getPrintOrderContext: async () => { throw Error("access denied"); } },
  }).default;
  await assert.rejects(DeniedPage({ params: Promise.resolve({ locale: "it", orderId: "foreign-order" }) }), /access denied/);
});
test("Terminal wraps each existing note field in a distinct accessible label", () => {
  const ui = terminal();
  const labels = nodes(ui.render()).filter((node) => node.type === "label");
  for (const [name, labelKey] of [["customerNotes", "customerNotesLabel"], ["internalNotes", "internalNotesLabel"]]) {
    const label = labels.find((node) => nodes(node).some((child) => child.type === "textarea" && child.props.name === name));
    assert.ok(label); assert.ok(content(label).includes(messages("es").shopTerminal.labels[labelKey]));
    const field = nodes(label).find((node) => node.type === "textarea");
    field.props.onChange({ target: { value: name + " distinct" } });
    assert.equal(ui.state.get(name), name + " distinct");
  }
});
test("all locales distinguish customer action, internal ticket and receipt", () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const d = messages(locale);
    for (const value of [d.print.actions["customer-copy"], d.print.customerCopy.title, d.print.customerCopy.notes, d.print.customerCopy.notFiscal, d.print.customerCopy.currentSummary, d.print.customerCopy.unitPrice,
      d.shopTerminal.labels.customerNotesLabel, d.shopTerminal.labels.internalNotesLabel]) assert.ok(typeof value === "string" && value.length > 0);
    assert.equal(new Set([d.print.actions["customer-copy"], d.print.actions.ticket, d.print.actions.receipt]).size, 3);
    assert.notEqual(d.shopTerminal.labels.customerNotesLabel, d.shopTerminal.labels.internalNotesLabel);
  }
  const actions = read("src/components/printing/PrintOrderActions.tsx");
  assert.match(actions, /\/print\/customer-copy/);
  assert.match(read("src/components/shop-terminal/ShopTerminalWorkspace.tsx"), /modes=\{\["customer-copy"\]\}/);
});
