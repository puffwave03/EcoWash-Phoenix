import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { loadPreviewModule, previewProps } from "../scripts/preview-billing-simplified-ticket.mjs";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const readerPath = "src/features/printing/server/rec-document.ts";
const pagePath = "src/app/[locale]/app/(dashboard)/orders/[orderId]/print/rec/page.tsx";
const orderId = "00000000-0000-4000-8000-000000000010";
const customerId = "00000000-0000-4000-8000-000000000020";
const invoiceId = "00000000-0000-4000-8000-000000000030";
const orgId = "00000000-0000-4000-8000-000000000001";
const foreignId = "00000000-0000-4000-8000-000000000002";
const plain = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const blockedStates = ["partial_or_advance", "paid_fiscal_review", "compatible_draft", "billing_conflict", "refunded", "reconciliation_anomaly", "unknown"];

// Exercise the actual route, adapter, B1 projections and B1 print components.
// Only the resolver/authorized reader boundaries and transport are doubled;
// the unchanged real resolver's authorization/tenant checks run in its suite.
function harness(options = {}) {
  const sample = previewProps("named").document;
  const h = {
    calls: [], failures: new Set(), role: options.role ?? "owner", billing: true, pos: true, printing: true,
    order: { id: orderId, organization_id: orgId, customer_id: customerId },
    settings: { id: orgId, ticket_footer: "Live footer\nSecond line", ticket_special_message: "Live special message" },
    customer: { customerId, isSharedWalkIn: false, isFiscalReady: false },
    context: {
      organizationName: "Tenant A", timezone: "Atlantic/Canary", quickDropFinancialState: null,
      branding: { brand: { name: "Tenant A", logoPath: "https://example.invalid/tenant-a.png" }, support: { address: "Stored address", email: null, phone: null } },
      order: { id: orderId, customerId, customerName: "Customer A", orderNumber: "LAB-001", isActive: true,
        productionStatus: "received", dueAt: "2026-11-20T10:00:00Z", currency: "EUR", subtotal: 14, discountAmount: 1, total: 13 },
      items: sample.items.map((item) => ({ ...item, lineTotal: item.lineSubtotal })),
      payments: [], paymentSummary: { totalDue: 13, totalPaid: 0, balanceDue: 13, paymentStatus: "unpaid" },
      logistics: { pickup: null, delivery: { status: "scheduled", scheduledAt: "2026-11-21T17:30:00Z" } },
    },
    detail: {
      invoice: {
        id: invoiceId, customerId, fiscalDocumentType: "simplificada", documentStatus: "issued",
        invoiceNumber: "2026-LAB-S-000001", sequenceNumber: 1, issuedAt: "2026-11-20T10:00:00Z",
        series: "LAB-S", issueDate: "2026-11-20", pricesIncludeTax: true, currency: "EUR",
        subtotal: 14, discountTotal: 1, taxableBase: 12.15, taxTotal: .85, total: 13,
        paidTotal: 0, outstanding: 0, orderIds: [orderId], orderNumbers: ["LAB-001"],
        issuerLegalName: sample.issuer.legalName, issuerTaxId: sample.issuer.taxId,
        issuerAddressLine1: sample.issuer.addressLine1, issuerAddressLine2: null,
        issuerCity: sample.issuer.city, issuerRegion: null, issuerPostalCode: sample.issuer.postalCode,
        issuerCountryCode: "ES", issuerLogoPath: `${orgId}/logo/stored.png`, issuerEmail: null, issuerPhone: null,
        customerName: "Stored Customer A", customerTaxId: null, customerAddressLine1: null, customerAddressLine2: null,
        customerCity: null, customerPostalCode: null, customerCountryCode: null, customerEmail: null,
        ticketPresentationVersion: 2, ticketTimezone: "Atlantic/Canary", ticketFooter: "Frozen fiscal footer",
        ticketSpecialMessage: "Frozen fiscal message", ticketScheduleByOrder: {
          [orderId]: { readyAt: "2026-11-20T10:00:00Z", pickupAt: "2026-11-21T11:00:00Z", deliveryAt: null },
        },
      }, items: sample.items.map((item) => ({ ...item, sourceOrderId: orderId })), payments: [],
    },
    state: { state: "unpaid", orderId, economic: { status: "unpaid", total: 13, collectedNet: 0, outstanding: 13 },
      billing: { status: "none" }, print: { status: "not_requested", source: "operational_order", documentId: null }, fiscalIssuanceAllowed: false },
  };
  const client = {
    from(table) {
      assert.ok(["orders", "organizations"].includes(table), `Unexpected table ${table}`);
      const filters = [], call = { table, filters };
      const execute = async () => {
        h.calls.push(call);
        if (h.failures.has(table)) return { data: null, error: Error("DB failure") };
        return { data: structuredClone(table === "orders" ? h.order : h.settings), error: null };
      };
      const q = { select() { return q; }, eq(key, value) { filters.push([key, value]); return q; }, maybeSingle: execute, single: execute };
      return q;
    },
    storage: { from(bucket) {
      assert.equal(bucket, "brand-media");
      return { getPublicUrl(path) { h.calls.push({ logo: path }); return { data: { publicUrl: `https://storage.invalid/${path}` } }; } };
    } },
    // No RPC or mutation methods are provided: an attempted call must fail.
  };
  const mocks = {
    "server-only": {},
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next-intl/server": { async getTranslations() { return () => "Imprimir"; } },
    "@/components/billing/BillingSimplifiedTicket": loadPreviewModule("src/components/billing/BillingSimplifiedTicket.tsx"),
    "@/components/printing/PrintButton": loadPreviewModule("src/components/printing/PrintButton.tsx"),
    "@/features/printing/unpaid-ticket": loadPreviewModule("src/features/printing/unpaid-ticket.ts"),
    "@/features/billing/simplified-document": loadPreviewModule("src/features/billing/simplified-document.ts"),
    "@/features/billing/types": loadPreviewModule("src/features/billing/types.ts"),
    "@/features/printing/server/access": { async requirePrintAccess() {
      h.calls.push("print-access"); assert.ok(h.printing, "PRINT_DENIED");
      return { membership: { organization: { id: orgId, timezone: "Atlantic/Canary" } } };
    } },
    "@/features/printing/server/rec-state": { async resolveOrderRecState(locale, target) {
      h.calls.push("resolver"); assert.equal(target, orderId);
      assert.ok(["owner", "manager"].includes(h.role), "ROLE_DENIED");
      assert.ok(h.billing, "BILLING_DENIED"); assert.ok(h.pos, "POS_DENIED");
      const count = h.calls.filter((call) => call === "resolver").length;
      return structuredClone(count > 1 && h.current ? h.current : h.state);
    } },
    "@/features/printing/server/queries": { async getPrintOrderContext(locale, target) {
      h.calls.push("context"); assert.equal(target, orderId);
      if (h.failures.has("context")) throw Error("Read failure");
      return structuredClone(h.context);
    } },
    "@/features/billing/server/queries": {
      async getBillingSimplifiedIssued(locale, target) {
        h.calls.push("issued"); assert.equal(target, invoiceId);
        if (h.failures.has("issued")) throw Error("Snapshot read failure");
        return structuredClone(h.detail);
      },
      async getBillingCustomerContext(locale, target) {
        h.calls.push("customer"); assert.equal(target, h.order.customer_id);
        if (h.failures.has("customer")) throw Error("Customer read failure");
        return structuredClone(h.customer);
      },
    },
    "@/lib/supabase/server": { async createSupabaseServerClient() { h.calls.push("client"); return client; } },
  };
  function load(path) {
    const compiled = { exports: {} };
    const code = ts.transpileModule(read(path), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    runInNewContext(code, { module: compiled, exports: compiled.exports, Intl, require(name) {
      assert.ok(name in mocks, `Unexpected import ${name}`); return mocks[name];
    } }, { filename: path });
    return compiled.exports;
  }
  const adapter = load(readerPath);
  mocks["@/features/printing/server/rec-document"] = adapter;
  mocks["@/features/printing/rec-copy"] = loadPreviewModule("src/features/printing/rec-copy.ts");
  const page = load(pagePath).default;
  h.document = () => adapter.getOrderRecDocument("es", orderId);
  h.element = (locale = "es") => page({ params: Promise.resolve({ locale, orderId }) });
  h.render = async (locale = "es") => renderToStaticMarkup(await h.element(locale));
  h.issued = () => {
    h.state.state = "simplified_issued";
    h.state.billing = { status: "simplified_issued", invoiceId, invoiceNumber: h.detail.invoice.invoiceNumber, snapshot: "identified" };
    h.state.print = { status: "not_requested", source: "billing_snapshot", documentId: invoiceId };
    h.state.economic = { status: "paid", total: 13, collectedNet: 13, outstanding: 0 };
  };
  return h;
}

test("unpaid REC renders the B1 80 mm layout, order, stored services, balance, dates and branding without fiscal identity", async () => {
  const h = harness(), before = JSON.stringify([h.context, h.settings]), html = await h.render(), text = plain(html);
  for (const value of ["TICKET OPERATIVO · NO FISCAL", "LAB-001", "Customer A", "camisa", "TOTAL 13,00", "Pendiente 13,00",
    "20 nov 2026, 10:00", "21 nov 2026, 17:30", "Live footer", "Live special message", "Imprimir"]) assert.ok(text.includes(value), value);
  assert.match(html, /size:80mm/); assert.match(html, /tenant-a\.png/); assert.match(html, /data-fiscal-issued="false"/);
  assert.doesNotMatch(text, /FACTURA SIMPLIFICADA|2026-LAB-S|Serie:|Fecha de emisión/);
  assert.equal(JSON.stringify([h.context, h.settings]), before);
  assert.equal(h.calls.filter((call) => call === "resolver").length, 2);
  assert.ok(!h.calls.includes("issued"));
});

test("issued REC reprints only the persisted Billing identity and frozen B1 presentation", async () => {
  const h = harness(); h.issued(); const before = JSON.stringify(h.detail), html = await h.render(), text = plain(html);
  for (const value of ["FACTURA SIMPLIFICADA", "2026-LAB-S-000001", "Stored Customer A", "Frozen fiscal footer", "Frozen fiscal message", "21 nov 2026, 11:00", "TOTAL 13,00"]) assert.ok(text.includes(value), value);
  assert.match(html, /data-fiscal-issued="true"/); assert.match(html, /customer-design/); assert.match(html, /\/logo\/stored.png/);
  assert.doesNotMatch(text, /Live footer|Live special message|TICKET OPERATIVO/);
  assert.ok(!h.calls.includes("context")); assert.ok(!h.calls.some((call) => call.table === "organizations"));
  assert.equal(JSON.stringify(h.detail), before); assert.equal(await h.render(), html);
});

test("issued historical snapshots remain printable after refund/cancellation or unreliable economic reads", async () => {
  for (const economic of [{ status: "refunded", total: 13, collectedNet: 0, outstanding: 13 }, { status: "unknown", reason: "read_failed" }]) {
    const h = harness(); h.issued(); h.state.economic = economic;
    h.context.order.isActive = false; h.context.order.productionStatus = "cancelled";
    h.failures.add("context"); h.failures.add("organizations");
    const html = await h.render(); assert.match(html, /data-fiscal-issued="true"/);
    assert.match(html, /2026-LAB-S-000001/);
    if (economic.status === "unknown") assert.match(plain(html), /Pagado No disponible.*Pendiente No disponible/);
  }
});

test("issued anonymous presentation comes only from the stored recipient, without invented identity", async () => {
  const h = harness(); h.issued();
  h.detail.invoice.customerName = null;
  h.customer = { customerId, isSharedWalkIn: false, customerName: "Current identified name", taxId: "NEW-NIF", billingAddressLine1: "New address" };
  const before = JSON.stringify(h.detail);
  const html = await h.render(); assert.match(plain(html), /Cliente sin identificar/);
  assert.match(html, /data-fiscal-issued="true"/);
  assert.doesNotMatch(plain(html), /Current identified name|NEW-NIF|New address/);
  assert.equal(JSON.stringify(h.detail), before);
  assert.ok(!h.calls.includes("customer"));
});

test("issued named presentation is unchanged after customer identity or classification changes", async () => {
  const h = harness(); h.issued();
  const original = await h.render();
  h.customer = { customerId, isSharedWalkIn: true, customerName: "Changed name", taxId: "NEW-NIF", billingAddressLine1: "Changed address" };
  const repeated = await h.render();
  assert.equal(repeated, original);
  assert.match(plain(repeated), /Stored Customer A/);
  assert.doesNotMatch(plain(repeated), /Changed name|NEW-NIF|Changed address|Cliente sin identificar/);
  assert.ok(!h.calls.includes("customer"));
});

test("issued named and anonymous snapshots do not require an available current customer record", async () => {
  for (const anonymous of [false, true]) {
    const h = harness(); h.issued(); if (anonymous) h.detail.invoice.customerName = null;
    h.customer = null; h.failures.add("customer");
    const html = await h.render();
    assert.match(html, /data-fiscal-issued="true"/);
    assert.match(plain(html), anonymous ? /Cliente sin identificar/ : /Stored Customer A/);
    assert.ok(!h.calls.includes("customer"));
  }
});

test("internally inconsistent or incomplete persisted recipients cannot select print", async () => {
  const optionalFields = ["customerTaxId", "customerAddressLine1", "customerAddressLine2", "customerCity", "customerPostalCode", "customerCountryCode", "customerEmail"];
  for (const field of optionalFields) {
    const h = harness(); h.issued(); h.detail.invoice.customerName = null;
    h.detail.invoice[field] = field === "customerEmail" ? "stored@example.invalid" : "Stored identity";
    const html = await h.render(); assert.match(html, /role="alert"/); assert.doesNotMatch(html, /<article|<button|Cliente sin identificar/);
  }
  for (const change of [
    h => { h.detail.invoice.customerName = " \n "; },
    h => { delete h.detail.invoice.customerName; },
    h => { delete h.detail.invoice.customerTaxId; },
    h => { h.detail.invoice.customerTaxId = 123; },
    h => { h.detail.invoice.customerName = null; h.detail.invoice.customerTaxId = ""; },
  ]) {
    const h = harness(); h.issued(); change(h);
    assert.doesNotMatch(await h.render(), /<article|<button|Cliente sin identificar/);
  }
});

for (const state of blockedStates) test(`${state}: localized safe message, no paper, print button or fallback reader`, async () => {
  const h = harness(); h.state.state = state;
  const html = await h.render(); assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /<button|<article|order-print-document|billing-simplified-ticket/);
  assert.deepEqual(h.calls, ["print-access", "resolver"]);
});

test("all supported locales have complete state-specific messages", async () => {
  const { recBlockedMessage } = loadPreviewModule("src/features/printing/rec-copy.ts");
  for (const locale of ["es", "it", "en", "fr", "de"]) {
    const values = blockedStates.map((state) => recBlockedMessage(locale, state));
    assert.ok(values.every((value) => typeof value === "string" && value.length > 30));
    assert.equal(new Set(values).size, blockedStates.length);
    assert.equal(recBlockedMessage(locale + "-XX", "unknown"), recBlockedMessage(locale, "unknown"));
  }
});

test("Owner/Manager pass; Staff, customer and missing Billing/POS/Printing permissions cannot reach document reads", async () => {
  for (const role of ["owner", "manager"]) assert.match(await harness({ role }).render(), /<article/);
  for (const change of [h => { h.role = "staff"; }, h => { h.role = "customer"; }, h => { h.billing = false; }, h => { h.pos = false; }, h => { h.printing = false; }]) {
    const h = harness(); change(h); await assert.rejects(h.render(), /DENIED/);
    assert.ok(!h.calls.includes("client") && !h.calls.includes("context") && !h.calls.includes("issued"));
  }
});

test("all direct reads filter server-derived tenant/order; foreign or mismatched presentation references fail closed", async () => {
  const valid = harness(); await valid.render();
  for (const call of valid.calls.filter((call) => call.table)) assert.ok(call.filters.some(([field, value]) => field === (call.table === "orders" ? "organization_id" : "id") && value === orgId));
  for (const change of [
    h => { h.order.organization_id = foreignId; }, h => { h.order.id = foreignId; },
    h => { h.settings.id = foreignId; }, h => { h.context.order.id = foreignId; },
    h => { h.context.order.customerId = foreignId; }, h => { h.state.orderId = foreignId; },
  ]) {
    const h = harness(); change(h); const html = await h.render();
    assert.match(html, /role="alert"/); assert.doesNotMatch(html, /<article|<button/); assert.ok(!html.includes(foreignId));
  }
});

test("failed and missing reads never fall back to an operational or fiscal document", async () => {
  for (const failure of ["orders", "organizations", "context", "issued"]) {
    const h = harness(); if (failure === "issued") h.issued(); h.failures.add(failure);
    assert.doesNotMatch(await h.render(), /<article|<button/);
  }
  for (const field of ["order", "settings", "context", "detail"]) {
    const h = harness(); if (field === "detail") h.issued(); h[field] = null;
    assert.doesNotMatch(await h.render(), /<article|<button/);
  }
});

test("fallback payment summaries, partial collections and state changes during unpaid reads cannot authorize print", async () => {
  for (const change of [
    h => { h.context.paymentSummary = { totalDue: 0, totalPaid: 0, balanceDue: 0, paymentStatus: "unpaid" }; },
    h => { h.context.payments = [{ status: "confirmed", amount: 5 }]; },
    h => { h.context.order.total = 12; }, h => { h.context.quickDropFinancialState = "unpriced"; },
    h => { h.context.items.pop(); }, h => { h.context.items[1].id = h.context.items[0].id; },
    h => { h.current = { ...h.state, state: "partial_or_advance" }; },
    h => { h.current = { ...h.state, state: "unknown" }; },
    h => { h.current = { ...h.state, billing: { status: "compatible_draft" } }; },
  ]) { const h = harness(); change(h); assert.doesNotMatch(await h.render(), /<article|<button/); }
});

test("issued reread rejects different customers, orders, invoice identities and unreadable snapshots", async () => {
  for (const change of [
    h => { h.detail.invoice.customerId = foreignId; }, h => { h.detail.invoice.id = foreignId; },
    h => { h.detail.invoice.orderIds = [foreignId]; }, h => { h.detail.items[0].sourceOrderId = foreignId; },
    h => { h.detail.invoice.invoiceNumber = "OTHER-001"; }, h => { h.detail.invoice.documentStatus = "draft"; },
    h => { h.detail.invoice.issuerTaxId = null; }, h => { h.detail.items = []; },
    h => { h.detail.invoice.total = 14; }, h => { h.detail.items.pop(); },
    h => { h.detail.items[0].taxableBase = 6.55; },
    h => { h.detail.items[0].lineTotal = NaN; }, h => { h.detail.invoice.ticketTimezone = "Invalid/Zone"; },
    h => { h.state.billing.snapshot = "unavailable"; }, h => { h.state.print.documentId = foreignId; },
  ]) {
    const h = harness(); h.issued(); change(h); const html = await h.render();
    assert.match(html, /role="alert"/); assert.doesNotMatch(html, /<article|<button|2026-LAB-S-000001/);
    assert.ok(!h.calls.includes("context"));
  }
});

test("repeated selection and explicit browser print carry no financial, numbering or document-history callback", async () => {
  const h = harness(), first = await h.element(), before = JSON.stringify([h.context, h.detail, h.settings]);
  const print = first.props.children[0].props.children;
  assert.deepEqual(Object.keys(print.props), ["label"]);
  assert.equal(renderToStaticMarkup(first), await h.render());
  assert.equal(JSON.stringify([h.context, h.detail, h.settings]), before);
  assert.doesNotMatch(read(readerPath) + read(pagePath), /\.rpc\(|\.insert\(|\.update\(|\.delete\(|printRequestedAction|issueOperationalReceipt|prepareBilling|issueBilling|useEffect|window\.print/);
});
