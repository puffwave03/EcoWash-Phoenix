import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260829000300_print_001_output_entitlement.sql";
const routes = ["receipt", "ticket", "labels"];

test("1 printing reuses the existing feature key", async () => {
  const catalog = await source("src/features/entitlements/feature-catalog.ts");
  assert.match(catalog, /printing: "printing"/);
  assert.doesNotMatch(catalog, /receiptPrinting|ticketPrinting|labelPrinting/);
});

test("2 bootstrap migration is additive and entitlement-only", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /insert into public\.organization_entitlements/);
  assert.match(sql, /'printing'/);
  assert.match(sql, /on conflict \(organization_id, feature_key\) do nothing/);
  assert.doesNotMatch(sql, /\b(update|delete|truncate|drop|alter table|create table)\b/i);
});

test("3 bootstrap is scoped to the EcoWash reference tenant", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /from public\.organizations/);
  assert.match(sql, /where organization\.slug = 'ecowash-la-tejita'/);
});

test("4 all three dedicated print routes exist", async () => {
  for (const route of routes) {
    const page = await source(`src/app/[locale]/app/(dashboard)/orders/[orderId]/print/${route}/page.tsx`);
    assert.match(page, /getPrintOrderContext\(locale, orderId\)/);
  }
});

test("5 every route uses the shared print document", async () => {
  for (const route of routes) {
    const page = await source(`src/app/[locale]/app/(dashboard)/orders/[orderId]/print/${route}/page.tsx`);
    assert.match(page, /OrderPrintDocument/);
    assert.match(page, new RegExp(`mode="${route}"`));
  }
});

test("6 access requires printing entitlement server-side", async () => {
  const access = await source("src/features/printing/server/access.ts");
  assert.match(access, /requireEntitlement\(locale, FEATURES\.printing\)/);
});

test("7 access also requires the established POS capability", async () => {
  const access = await source("src/features/printing/server/access.ts");
  assert.match(access, /requireOperationalCapability\(locale, "pos"\)/);
});

test("8 tenant isolation is explicit in print metadata lookup", async () => {
  const queries = await source("src/features/printing/server/queries.ts");
  assert.match(queries, /from\("orders"\)[\s\S]*eq\("organization_id", access\.membership\.organization\.id\)[\s\S]*eq\("id", orderId\)/);
});

test("9 canonical order, item, payment and logistics queries are reused", async () => {
  const queries = await source("src/features/printing/server/queries.ts");
  for (const query of ["getOrderById", "listOrderItems", "getOrderPayments", "getOrderPaymentSummary", "getOrderLogistics"]) {
    assert.match(queries, new RegExp(`${query}\\(locale, orderId\\)`));
  }
});

test("10 tenant branding and organization timezone are reused", async () => {
  const queries = await source("src/features/printing/server/queries.ts");
  assert.match(queries, /getTenantBranding\(access\.membership\.organization\.id\)/);
  assert.match(queries, /timezone: access\.membership\.organization\.timezone/);
});

test("11 receipt renders canonical monetary snapshots", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  for (const value of ["order.subtotal", "order.discountAmount", "order.total", "paymentSummary.totalPaid", "paymentSummary.balanceDue"]) {
    assert.match(document, new RegExp(value.replace(".", "\\.")));
  }
});

test("12 receipt reports payment methods without provider references", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  assert.match(document, /paymentMethodTotals/);
  assert.match(document, /paymentMethods\.\$\{method\}/);
  assert.doesNotMatch(document, /providerReference|provider_reference|payment\.reference/);
});

test("13 receipt excludes internal notes and states the non-fiscal boundary", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  const receipt = document.slice(document.indexOf("async function Receipt"), document.indexOf("async function Ticket"));
  assert.match(receipt, /order\.customerNotes/);
  assert.match(receipt, /receipt\.notFiscal/);
  assert.doesNotMatch(receipt, /internalNotes/);
});

test("14 ticket emphasizes the order number and operational context", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  const ticket = document.slice(document.indexOf("async function Ticket"), document.indexOf("async function Labels"));
  for (const field of ["order.orderNumber", "order.customerName", "createdByName", "paymentSummary.paymentStatus", "logistics"]) {
    assert.match(ticket, new RegExp(field.replace(".", "\\.")));
  }
});

test("15 ticket stays provider-neutral and omits customer account history", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  const ticket = document.slice(document.indexOf("async function Ticket"), document.indexOf("async function Labels"));
  assert.doesNotMatch(ticket, /provider|invoice|accountHistory|customerAccount/);
});

test("16 discrete quantities produce one label per physical unit", async () => {
  const labels = await source("src/features/printing/labels.ts");
  assert.match(labels, /isDiscreteServiceUnit\(item\.unitType\) \? Math\.max\(1, Math\.trunc\(item\.quantity\)\) : 1/);
});

test("17 continuous quantities produce one label per order line", async () => {
  const labels = await source("src/features/printing/labels.ts");
  assert.match(labels, /: 1;/);
  assert.doesNotMatch(labels, /Math\.ceil\(item\.quantity\)/);
});

test("18 labels contain a reserved code area but no fabricated barcode", async () => {
  const [document, messages] = await Promise.all([
    source("src/components/printing/OrderPrintDocument.tsx"),
    source("src/i18n/en/common.json"),
  ]);
  assert.match(document, /print-code-area/);
  assert.match(messages, /RESERVED CODE AREA/);
  assert.doesNotMatch(document, /<svg|<canvas|barcode|qr-code/i);
});

test("19 print is explicit and never automatic", async () => {
  const button = await source("src/components/printing/PrintButton.tsx");
  assert.match(button, /onClick=\{\(\) => window\.print\(\)\}/);
  assert.doesNotMatch(button, /useEffect|setTimeout/);
});

test("20 browser print CSS defines receipt, ticket and label page formats", async () => {
  const css = await source("src/styles/globals.css");
  for (const mode of routes) assert.match(css, new RegExp(`@page ${mode}`));
  assert.match(css, /@media print/);
  assert.match(css, /break-inside: avoid/);
});

test("21 print output is isolated from the authenticated app shell", async () => {
  const css = await source("src/styles/globals.css");
  assert.match(css, /body:has\(\.order-print-document\) \*/);
  assert.match(css, /visibility: hidden/);
  assert.match(css, /\.order-print-document,[\s\S]*\.order-print-document \*[\s\S]*visibility: visible/);
});

test("22 Shop Terminal success integrates all three preview actions", async () => {
  const [page, workspace, actions] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/components/printing/PrintOrderActions.tsx"),
  ]);
  assert.match(page, /FEATURES\.printing/);
  assert.match(workspace, /PrintOrderActions/);
  for (const route of routes) assert.match(actions, new RegExp(`/print/${route}`));
});

test("23 order detail integrates printing behind entitlement and capability", async () => {
  const detail = await source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
  assert.match(detail, /entitlementEnabled\(entitlements, FEATURES\.printing\)/);
  assert.match(detail, /hasOperationalCapability\(access\.membership, "pos"\)/);
  assert.match(detail, /canPrint \? <PrintOrderActions/);
});

test("24 no printing code creates orders or mutates financial data", async () => {
  const files = await Promise.all([
    source("src/features/printing/server/queries.ts"),
    source("src/components/printing/OrderPrintDocument.tsx"),
    source("src/components/printing/PrintButton.tsx"),
  ]);
  assert.doesNotMatch(files.join("\n"), /\.insert\(|\.update\(|\.delete\(|createOrder|recordPayment/);
});

test("25 all five locales expose complete print vocabulary", async () => {
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.deepEqual(Object.keys(messages.print.actions).sort(), ["back", "labels", "print", "receipt", "ticket"]);
    assert.equal(Object.keys(messages.print.units).length, 6);
    assert.equal(Object.keys(messages.print.paymentMethods).length, 4);
    assert.equal(Object.keys(messages.print.paymentStatuses).length, 5);
    assert.equal(typeof messages.print.receipt.notFiscal, "string");
  }
});
