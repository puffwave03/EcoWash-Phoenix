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
    if (name === "@/features/payments/read-error") return load("src/features/payments/read-error.ts", {});
    if (name === "@/components/payments/PaymentReadErrorNotice") return { PaymentReadErrorNotice: () => { throw Error("Unexpected payment read failure in success fixture"); } };
    if (name === "@/features/printer-settings/document-preferences") return load("src/features/printer-settings/document-preferences.ts", {});
    // Legacy no-preference fixtures still exercise the historical A4 fallback.
    // Actual preference reads and tenant/site filters have their own focused suite.
    if (name === "@/features/printer-settings/server/document-preference-queries") return { getCustomerCopyPreference: async () => null };
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
  "@/i18n/navigation": { Link: ({ href, locale, className, children, "aria-current": current }) => React.createElement("a", { href: `/${locale}${href}`, className, "aria-current": current }, children) },
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
async function render(context, locale, mode, customerCopyFormat) {
  return renderToStaticMarkup(await resolveTree(await Document({ context, locale, mode, customerCopyFormat })));
}
for (const locale of ["it", "es", "en", "fr", "de"]) {
  for (const format of ["a4", "58mm", "80mm"]) {
    test(`${locale}/${format}: actual customer output contains warnings and excludes all private markers`, async () => {
      const context = fixture();
      const before = JSON.stringify(context);
      const html = await render(context, locale, "customer-copy", format);
      assert.match(html, /CUSTOMER_WARNING: cold wash/);
      assert.match(html, /EW-TEST/);
      assert.match(html, /Shirt/);
      assert.doesNotMatch(html, /CONFIDENTIAL|UNCLASSIFIED|PRIVATE|FUTURE_PRIVATE/);
      assert.ok(html.includes(messages(locale).print.customerCopy.title));
      assert.equal(JSON.stringify(context), before);
    });
    for (const [paymentStatus, totalPaid, balanceDue] of [["unpaid", 0, 76], ["paid", 76, 0], ["partially_paid", 31.25, 44.75], ["refunded", 0, 76]]) {
      test(`${locale}/${format}: current customer amounts for ${paymentStatus} use canonical values and exclude private information`, async () => {
        const context = fixture();
        context.paymentSummary = { ...context.paymentSummary, paymentStatus, totalPaid, balanceDue };
        // Contradictory raw entries prove presentation reads the canonical summary,
        // rather than recalculating amounts from the financial ledger.
        context.payments = [{ status: "confirmed", amount: 999, method: "cash", reference: "PRIVATE_PAYMENT_REFERENCE" }];
        const beforeRender = JSON.stringify(context);
        const html = await render(context, locale, "customer-copy", format);
        const t = messages(locale).print;
        for (const value of [t.customerCopy.unitPrice, t.customerCopy.currentSummary, t.fields.lineTotal,
          t.fields.subtotal, t.fields.discount, t.fields.total, t.fields.paid, t.fields.outstanding]) {
          assert.ok(html.includes(value), `Missing ${locale} label: ${value}`);
        }
        for (const [label, amount] of [[t.customerCopy.unitPrice, context.items[0].unitPrice], [t.fields.lineTotal, context.items[0].lineTotal]]) {
          assert.ok(html.includes(`<td data-label="${label}">${formatCurrency(amount, context.order.currency, locale)}</td>`));
        }
        assert.ok(html.includes(`<td data-label="${t.fields.quantity}">${formatQuantity(context.items[0].quantity, locale)}</td>`));
        assert.ok(html.includes(`<td data-label="${t.fields.unit}">${t.units.piece}</td>`));
        for (const [label, amount, prefix = ""] of [
          [t.fields.subtotal, context.order.subtotal], [t.fields.discount, context.order.discountAmount, "−"],
          [t.fields.total, context.order.total], [t.fields.paid, totalPaid], [t.fields.outstanding, balanceDue],
        ]) {
          assert.ok(html.includes(`<dt>${label}</dt><dd>${prefix}${formatCurrency(amount, context.order.currency, locale)}</dd>`), `Wrong ${locale} ${label}`);
        }
        assert.match(html, /CUSTOMER_WARNING: cold wash/);
        assert.doesNotMatch(html, /CONFIDENTIAL|UNCLASSIFIED|PRIVATE|FUTURE_PRIVATE/);
        assert.equal(JSON.stringify(context), beforeRender);
      });
    }
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
  assert.match(read("src/components/shop-terminal/ShopTerminalWorkspace.tsx"), /modes=\{\["customer-copy", "receipt"\]\}/);
});

test("customer preview server allowlist defaults safely and never bypasses order access", async () => {
  for (const [input, expected] of [[undefined, "a4"], ["a4", "a4"], ["58mm", "58mm"], ["80mm", "80mm"],
    ["", "a4"], ["receipt_58mm", "a4"], ["../ticket", "a4"], ["58mm extra", "a4"], [["58mm", "80mm"], "a4"]]) {
    const calls = [];
    const Page = load(route, {
      "@/components/printing/OrderPrintDocument": { OrderPrintDocument: Document },
      "@/features/printing/server/queries": { getPrintOrderContext: async (...args) => { calls.push(args); return fixture(); } },
    }).default;
    const params = Promise.resolve({ locale: "it", orderId: "order-test" });
    const searchParams = Promise.resolve({ format: input, organization_id: "foreign", receiptId: "ignored" });
    const html = renderToStaticMarkup(await resolveTree(await Page({ params, searchParams })));
    assert.match(html, new RegExp(`order-print-customer-${expected}[ "]`));
    assert.equal(html.includes("order-print-customer-thermal"), expected !== "a4");
    assert.deepEqual(calls, [["it", "order-test"]]);
    const DeniedPage = load(route, {
      "@/components/printing/OrderPrintDocument": { OrderPrintDocument: () => { assert.fail("must not render denied order"); } },
      "@/features/printing/server/queries": { getPrintOrderContext: async () => { throw Error("access denied"); } },
    }).default;
    await assert.rejects(DeniedPage({ params, searchParams }), /access denied/);
  }
});

test("default A4 equals explicit A4; customer format never affects staff, labels or legacy receipt", async () => {
  const context = fixture();
  context.printerProfiles.ticket = { displayName: "Staff profile", connectionMode: "local_bridge", paperFormat: "ticket_a4" };
  assert.equal(await render(context, "it", "customer-copy"), await render(context, "it", "customer-copy", "a4"));
  for (const mode of ["ticket", "labels", "receipt"]) {
    for (const format of ["a4", "58mm", "80mm"]) {
      assert.equal(await render(context, "it", mode, format), await render(context, "it", mode));
    }
  }
  const html = await render(context, "it", "customer-copy", "58mm");
  assert.doesNotMatch(html, /Staff profile/);
  assert.ok(html.includes(messages("it").print.customerCopy.paperHint));
});

test("many services, long descriptions and public notes remain complete in every format and locale", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const context = fixture();
    const longText = "Caffè, più qualità — Étiquette très délicate, Größe 123456789012345678901234567890";
    context.items = Array.from({ length: 45 }, (_, i) => ({ ...context.items[0], id: `item-${i}`, description: `${longText} — ${i}`, quantity: 1.25, unitType: "weight" }));
    context.order.customerNotes = `${longText}\n${longText}`;
    for (const format of ["a4", "58mm", "80mm"]) {
      const html = await render(context, locale, "customer-copy", format);
      const tbody = html.split("<tbody>")[1].split("</tbody>")[0];
      assert.equal((tbody.match(/<tr>/g) ?? []).length, 45);
      assert.ok(html.includes(`${longText} — 44`));
      assert.ok(html.includes(formatQuantity(1.25, locale)));
      assert.ok(html.includes("€"));
      assert.ok(html.includes(messages(locale).print.customerCopy.notFiscal));
      assert.doesNotMatch(html, /CONFIDENTIAL|UNCLASSIFIED|PRIVATE/);
    }
  }
});

test("Order actions expose one customer preview; Quick Drop and separate REC issuance are preserved", async () => {
  let issued = 0;
  const { PrintOrderActions } = load("src/components/printing/PrintOrderActions.tsx", {
    "@/i18n/navigation": { Link: ({ href, locale, children }) => React.createElement("a", { href: `/${locale}${href}` }, children) },
    "react-dom": { useFormStatus: () => ({ pending: false }) },
    "@/features/sales-documents/server/actions": { issueOperationalReceiptAction: () => { issued += 1; } },
  });
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const t = messages(locale).print;
    const base = { locale, orderId: "order-test", text: t.actions };
    const tree = await resolveTree(PrintOrderActions(base));
    const anchors = nodes(tree).filter((node) => node.type === "a");
    assert.equal(anchors.length, 3);
    for (const mode of ["customer-copy", "ticket", "labels"]) {
      const matches = anchors.filter((node) => node.props.href === `/${locale}/app/orders/order-test/print/${mode}`);
      assert.equal(matches.length, 1);
      assert.equal(content(matches[0]), t.actions[mode]);
    }
    const html = renderToStaticMarkup(tree);
    assert.doesNotMatch(html, /\?format|\/print\/receipt/);
    assert.equal(nodes(tree).filter((node) => node.type === "form").length, 1);
    assert.equal(nodes(tree).filter((node) => node.type === "button" && node.props.type === "submit").length, 1);
    const restricted = renderToStaticMarkup(await resolveTree(PrintOrderActions({ ...base, modes: ["ticket"] })));
    assert.doesNotMatch(restricted, /customer-copy/);
    assert.ok(restricted.includes(`/app/orders/order-test/print/ticket`));
    assert.doesNotMatch(restricted, /<form/);
  }
  assert.equal(issued, 0);
  const orderPage = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
  assert.match(orderPage, /canPrint \? <PrintOrderActions locale=/);
  assert.match(orderPage, /modes=\{pendingQuickDrop \? \["ticket"\] : undefined\}/);
  assert.doesNotMatch(orderPage, /customerCopyFormats/);
  assert.doesNotMatch(read(route), /\.rpc\(|issueOperationalReceipt|savePrinter|window\.print/);
});

for (const locale of ["it", "es", "en", "fr", "de"]) {
  for (const format of ["a4", "58mm", "80mm"]) {
    test(`${locale}/${format}: preview links select one visible format and preserve the complete customer document`, async () => {
      const context = fixture();
      const before = JSON.stringify(context);
      const tree = await resolveTree(await Document({ context, locale, mode: "customer-copy", customerCopyFormat: format }));
      const nav = nodes(tree).find((node) => node.type === "nav");
      const t = messages(locale).print.customerCopy;
      assert.ok(nav);
      assert.equal(nav.props["aria-label"], t.formatLabel);
      assert.deepEqual(Object.keys(t.formatOptions).sort(), ["58mm", "80mm", "a4"]);
      const links = nodes(nav).filter((node) => node.type === "a");
      assert.equal(links.length, 3);
      for (const [index, value] of ["a4", "58mm", "80mm"].entries()) {
        const link = links[index];
        assert.equal(link.props.href, `/${locale}/app/orders/order-test/print/customer-copy?format=${value}`);
        assert.equal(content(link), t.formatOptions[value]);
        assert.equal(link.props["aria-current"], value === format ? "page" : undefined);
        assert.equal(link.props.className.split(" ").includes("bg-primary"), value === format);
        assert.match(link.props.className, /min-h-11/);
        assert.match(link.props.className, /focus-visible:outline/);
        assert.equal(link.props.onClick, undefined);
      }
      assert.equal(links.filter((link) => link.props["aria-current"] === "page").length, 1);
      const article = nodes(tree).find((node) => node.type === "article");
      const a4 = await resolveTree(await Document({ context, locale, mode: "customer-copy" }));
      assert.equal(renderToStaticMarkup(article), renderToStaticMarkup(nodes(a4).find((node) => node.type === "article")));
      assert.equal(JSON.stringify(context), before);
      assert.doesNotMatch(renderToStaticMarkup(tree), /CONFIDENTIAL|UNCLASSIFIED|PRIVATE|FUTURE_PRIVATE/);
    });
  }
}
