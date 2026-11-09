import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const locales = ["it", "es", "en", "fr", "de"];
const orderPath = "src/app/[locale]/app/(dashboard)/orders/[orderId]/";
const dictionaries = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(read(`src/i18n/${locale}/common.json`))]));
function translations({ locale, namespace }) {
  const dictionary = namespace.split(".").slice(1).reduce((value, key) => value[key], dictionaries[locale]);
  const get = (key) => key.split(".").reduce((value, part) => value?.[part], dictionary);
  const t = (key) => { const value = get(key); assert.equal(typeof value, "string", `${locale}:${namespace}.${key}`); return value; };
  t.raw = get;
  return t;
}
function load(path, imports = {}, { logs = [], fallback } = {}) {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, console: { error: (...args) => logs.push(args) }, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name === "react/jsx-runtime") return require(name);
    if (name === "server-only") return {};
    if (fallback) return fallback(name);
    throw Error(`Unexpected import: ${name}`);
  } }, { filename: path });
  return compiledModule.exports;
}
const errors = load("src/features/payments/read-error.ts");
const { PaymentReadError } = errors;
const navigation = { Link: ({ locale, href, children, className }) => React.createElement("a", { href: `/${locale}${href}`, className }, children) };
const Notice = load("src/components/payments/PaymentReadErrorNotice.tsx", {
  "next-intl/server": { getTranslations: async (args) => translations(args) },
  "@/i18n/navigation": navigation,
}).PaymentReadErrorNotice;
const summaryRow = { balance_due: 76, payment_status: "unpaid", total_due: 76, total_paid: 0 };
const paymentRow = { id: "payment-a", amount: 31.25, channel: "pos", method: "cash", status: "confirmed",
  created_at: "2026-11-09T10:00:00Z", paid_at: "2026-11-09T10:00:00Z", proof_photo_id: null,
  recorded_by_profile: [{ display_name: "Synthetic operator" }], reference: null, refunded_from_payment_id: null };
function paymentQueries({ rows = [], summary = summaryRow, failed, missing, rejected, denied } = {}) {
  const calls = [], logs = [];
  const result = async (kind, data) => {
    if (rejected === kind) throw Error("PRIVATE_TRANSPORT_DETAILS");
    return { data: missing === kind ? null : data, error: failed === kind ? { code: "42501", message: "PRIVATE_DATABASE_DETAILS" } : null };
  };
  const client = {
    from(table) {
      calls.push(["from", table]);
      const query = {
        select() { return query; },
        eq: (key, value) => { calls.push([key, value]); return query; },
        order: () => query,
        returns: () => result("payments", rows),
      };
      return query;
    },
    rpc(name, args) { calls.push(["rpc", name, args]); return { single: () => result("summary", summary) }; },
  };
  return { calls, logs, ...load("src/features/payments/server/queries.ts", {
    "@/features/payments/read-error": errors,
    "@/lib/auth/require-membership": { requireMembership: async (locale) => {
      calls.push(["membership", locale]);
      if (denied) throw denied;
      return { membership: { organization: { id: "tenant-a" } } };
    } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => client },
  }, { logs }) };
}
test("successful empty ledger and genuine zero amounts remain valid, distinct from read errors", async () => {
  const queries = paymentQueries({ summary: { balance_due: 0, payment_status: "paid", total_due: 0, total_paid: 0 } });
  assert.equal((await queries.getOrderPayments("it", "order-a")).length, 0);
  const summary = await queries.getOrderPaymentSummary("it", "order-a");
  assert.equal(summary.balanceDue, 0);
  assert.equal(summary.totalDue, 0);
  assert.equal(summary.totalPaid, 0);
  assert.equal(summary.paymentStatus, "paid");
  assert.equal(queries.logs.length, 0);
});
for (const [status, paid, balance, refund] of [["partially_paid", 31.25, 44.75, 0], ["partially_paid", 21.25, 54.75, 10], ["refunded", 0, 76, 31.25], ["paid", 76, 0, 0]]) {
  test(`canonical ${status} summary and refund rows are returned unchanged (${refund} refunded)`, async () => {
    const rows = [{ ...paymentRow, amount: refund ? 31.25 : paid }];
    if (refund) rows.push({ ...paymentRow, id: "refund-a", amount: refund, status: "refunded", refunded_from_payment_id: paymentRow.id });
    const queries = paymentQueries({ rows, summary: { ...summaryRow, total_paid: paid, balance_due: balance, payment_status: status } });
    const payments = await queries.getOrderPayments("it", "order-a");
    const summary = await queries.getOrderPaymentSummary("it", "order-a");
    assert.equal(summary.totalPaid, paid);
    assert.equal(summary.balanceDue, balance);
    assert.equal(summary.paymentStatus, status);
    assert.equal(payments.length, rows.length);
    assert.equal(payments[0].recordedByName, "Synthetic operator");
    if (refund) assert.equal(payments[1].refundedFromPaymentId, paymentRow.id);
    assert.ok(queries.calls.some(([key, value]) => key === "organization_id" && value === "tenant-a"));
    assert.ok(queries.calls.some(([key, value]) => key === "order_id" && value === "order-a"));
    const rpc = queries.calls.find(([key]) => key === "rpc");
    assert.equal(rpc[1], "get_order_payment_summary");
    assert.equal(rpc[2].target_order_id, "order-a");
  });
}
for (const kind of ["payments", "summary"]) {
  for (const failure of ["failed", "missing", "rejected"]) {
    test(`${kind}: ${failure} read throws explicit safe error instead of a financial fallback`, async () => {
      const queries = paymentQueries({ [failure]: kind });
      await assert.rejects(queries[kind === "payments" ? "getOrderPayments" : "getOrderPaymentSummary"]("it", "order-a"), (error) => {
        assert.ok(error instanceof PaymentReadError);
        assert.doesNotMatch(error.message, /PRIVATE|42501/);
        return true;
      });
      assert.equal(queries.logs.length, 1);
      assert.equal(queries.logs[0][1], { failed: "42501", missing: "missing_data", rejected: "request_failed" }[failure]);
      assert.doesNotMatch(JSON.stringify(queries.logs), /PRIVATE/);
    });
  }
}
test("membership denial propagates unchanged and never starts payment reads", async () => {
  const denied = Error("auth redirect or denial");
  const queries = paymentQueries({ denied });
  for (const method of ["getOrderPayments", "getOrderPaymentSummary"]) {
    await assert.rejects(queries[method]("it", "order-a"), (error) => error === denied);
  }
  assert.ok(queries.calls.every(([key]) => key === "membership"));
  assert.equal(queries.logs.length, 0);
});

const order = { id: "order-a", orderNumber: "EW-SYNTHETIC", customerName: "Synthetic customer", locationId: "site-a",
  productionStatus: "completed", isActive: true, priority: "normal", currency: "EUR", total: 76, discountAmount: 0,
  customerNotes: "PUBLIC_NOTE", internalNotes: "PRIVATE_NOTE" };
function printContext(queries) {
  const calls = [];
  return { calls, ...load("src/features/printing/server/queries.ts", {
    "@/features/branding/server/queries": { getTenantBranding: async () => ({}) },
    "@/features/logistics/server/queries": { getOrderLogistics: async () => ({ pickup: null, delivery: null }) },
    "@/features/orders/server/queries": { getOrderById: async () => order, listOrderItems: async () => [] },
    "@/features/payments/server/queries": queries,
    "@/features/quick-drop/server/queries": { getQuickDropOrderOrNull: async () => null },
    "@/features/printing/server/access": { requirePrintAccess: async () => ({ membership: { organization: { id: "tenant-a", name: "Synthetic", timezone: "Atlantic/Canary" } } }) },
    "@/features/printer-settings/server/queries": { getDefaultPrinterProfiles: async () => { calls.push("profiles"); return {}; } },
    "@/features/entitlements/feature-catalog": { FEATURES: { barcode: "barcode" } },
    "@/features/entitlements/server/resolver": { hasEntitlement: async () => false },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ from: () => {
      const query = { select: () => query, eq: (key, value) => { calls.push([key, value]); return query; },
        maybeSingle: async () => ({ data: { location_id: "site-a", location: null, customer: null, created_by_profile: null }, error: null }) };
      return query;
    } }) },
    "next/navigation": { notFound: () => { throw Error("not found"); } },
  }) };
}
async function resolveTree(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === "function") return resolveTree(await node.type(node.props));
  const children = await resolveTree(node.props.children);
  return React.cloneElement(node, {}, ...(Array.isArray(children) ? children : [children]));
}
for (const mode of ["customer-copy", "ticket", "labels"]) {
  for (const kind of ["payments", "summary"]) {
    test(`${mode}: failed ${kind} read blocks the actual shared context and renderer in all five languages`, async () => {
      for (const locale of locales) {
        const context = printContext(paymentQueries({ failed: kind }));
        const Page = load(`${orderPath}print/${mode}/page.tsx`, {
          "@/components/payments/PaymentReadErrorNotice": { PaymentReadErrorNotice: Notice },
          "@/features/payments/read-error": errors,
          "@/components/printing/OrderPrintDocument": { OrderPrintDocument: () => { assert.fail("financial document must not render"); } },
          "@/features/printing/server/queries": context,
          "@/features/printer-settings/document-preferences": { resolveCustomerCopyFormat: () => { assert.fail("no format processing after read failure"); } },
          "@/features/printer-settings/server/document-preference-queries": { getCustomerCopyPreference: async () => { assert.fail("no preference read after failure"); } },
        }).default;
        const result = await Page({ params: Promise.resolve({ locale, orderId: order.id }) });
        const html = renderToStaticMarkup(await resolveTree(result));
        assert.ok(html.includes(dictionaries[locale].orders.payments.readError));
        assert.match(html, /role="alert"/);
        assert.ok(html.includes(`href="/${locale}/app/orders/order-a"`));
        assert.doesNotMatch(html, /<button|<form|PRIVATE|0,00|0\.00/);
        assert.ok(!context.calls.includes("profiles"));
        assert.ok(context.calls.some(([key, value]) => key === "organization_id" && value === "tenant-a"));
      }
    });
  }
  test(`${mode}: valid empty ledger/zero balance still renders and auth/navigation failures are not masked`, async () => {
    const context = printContext(paymentQueries({ summary: { ...summaryRow, balance_due: 0, total_paid: 76, payment_status: "paid" } }));
    const imports = {
      "@/components/payments/PaymentReadErrorNotice": { PaymentReadErrorNotice: Notice },
      "@/features/payments/read-error": errors,
      "@/components/printing/OrderPrintDocument": { OrderPrintDocument: "financial-document" },
      "@/features/printing/server/queries": context,
      "@/features/printer-settings/document-preferences": { resolveCustomerCopyFormat: () => "a4" },
      "@/features/printer-settings/server/document-preference-queries": { getCustomerCopyPreference: async () => null },
    };
    const params = Promise.resolve({ locale: "it", orderId: order.id });
    const Page = load(`${orderPath}print/${mode}/page.tsx`, imports).default;
    const result = await Page({ params });
    assert.equal(result.type, "financial-document");
    assert.equal(result.props.context.paymentSummary.balanceDue, 0);
    assert.equal(result.props.context.payments.length, 0);
    for (const reason of ["access denied", "NEXT_REDIRECT", "not found"]) {
      const error = Error(reason);
      const DeniedPage = load(`${orderPath}print/${mode}/page.tsx`, { ...imports,
        "@/features/printing/server/queries": { getPrintOrderContext: async () => { throw error; } },
      }).default;
      await assert.rejects(DeniedPage({ params }), (actual) => actual === error);
    }
  });
}

const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : React.isValidElement(node) ? [node, ...nodes(node.props.children)] : [];
const component = (name) => { const Stub = () => null; Stub.displayName = name; return Stub; };
const components = new Map();
function orderPage(queries) {
  const noop = async () => {};
  const lists = { getOrderById: async () => order, listOrderItems: async () => [], getOrderHistory: async () => [],
    getOrderLogistics: async () => ({ pickup: null, delivery: null }), listAssignableStaff: async () => [],
    getCustomerHandoff: async () => null, getOrderPhotos: async () => [], getQuickDropOrderOrNull: async () => null,
    listEffectiveServicesForOrder: async () => [], getOrderStorageAssignment: async () => null,
    listWarehousePositions: async () => [], listWarehouseMovements: async () => [], getCurrentPosSession: async () => ({ id: "pos-a" }) };
  return load(`${orderPath}page.tsx`, {
    "next-intl/server": { getTranslations: async (args) => translations(args) },
    "@/features/payments/read-error": errors,
    "@/features/payments/server/queries": queries,
    "@/components/payments/PaymentReadErrorNotice": { PaymentReadErrorNotice: Notice },
    "@/i18n/navigation": navigation,
    "@/lib/auth/require-membership": { requireMembership: async () => ({ membership: { role: "owner", organization: { timezone: "Atlantic/Canary" } }, profile: { displayName: "Synthetic" }, user: {} }) },
    "@/features/entitlements/feature-catalog": { FEATURES: { pos: "pos", printing: "printing", billingInvoicing: "billing" }, entitlementEnabled: () => true },
    "@/features/entitlements/server/resolver": { getCurrentEntitlements: async () => ({}) },
    "@/lib/auth/capabilities": { hasOperationalCapability: () => true },
    "@/features/orders/workflow": { canEditCatalog: () => true },
    "@/features/orders/display-status": { deriveOrderDisplayStatus: () => "ready_for_customer_pickup", hasInboundPickupProductionAnomaly: () => false },
    "@/features/logistics/lifecycle": { isOperationalLogisticsParent: () => true },
    "@/lib/number-format": load("src/lib/number-format.ts"),
    "@/lib/organization-timezone": { formatOrganizationDateTime: () => "synthetic date" },
  }, { fallback(name) {
    if (name.startsWith("@/components/")) return new Proxy({}, { get: (_, key) => {
      if (!components.has(key)) components.set(key, component(key));
      return components.get(key);
    } });
    if (name.endsWith("/actions") || /\/manual-external(?:-refund)?-actions$/.test(name) || name.endsWith("/storage-actions")) return new Proxy({}, { get: () => noop });
    if (name.endsWith("/queries") || name.endsWith("/order-services")) return new Proxy({}, { get: (_, key) => {
      assert.ok(Object.hasOwn(lists, key), `Missing query fixture: ${key}`); return lists[key];
    } });
    throw Error(`Unexpected order dependency: ${name}`);
  } }).default;
}
for (const kind of ["payments", "summary"]) {
  test(`order detail: failed ${kind} read leaves operations visible, hides financial/handoff controls and never shows fake balances`, async () => {
    const Page = orderPage(paymentQueries({ failed: kind }));
    const tree = await Page({ params: Promise.resolve({ locale: "it", orderId: order.id }), searchParams: Promise.resolve({}) });
    const elements = nodes(tree);
    assert.ok(elements.some((node) => node.type === Notice));
    assert.ok(elements.some((node) => node.type.displayName === "StatusTransitionForm"));
    assert.ok(elements.some((node) => node.type.displayName === "PrintOrderActions"));
    assert.ok(!elements.some((node) => ["PaymentsPanel", "CustomerHandoffPanel"].includes(node.type.displayName)));
    const values = elements.filter((node) => node.type === "dd").map((node) => node.props.children);
    assert.ok(values.includes(dictionaries.it.orders.payments.unavailable));
    assert.ok(!values.some((value) => typeof value === "string" && /^0[,.]00/.test(value)));
  });
}
for (const [status, paid, balance] of [["unpaid", 0, 76], ["partially_paid", 31.25, 44.75], ["paid", 76, 0], ["refunded", 0, 76]]) {
  test(`order detail: successful ${status} still passes the canonical ledger/summary to existing controls`, async () => {
    const rows = status === "refunded"
      ? [paymentRow, { ...paymentRow, id: "refund-a", status: "refunded", refunded_from_payment_id: paymentRow.id }]
      : paid ? [{ ...paymentRow, amount: paid }] : [];
    const Page = orderPage(paymentQueries({ rows, summary: { ...summaryRow, payment_status: status, total_paid: paid, balance_due: balance } }));
    const tree = await Page({ params: Promise.resolve({ locale: "it", orderId: order.id }), searchParams: Promise.resolve({}) });
    const elements = nodes(tree);
    assert.ok(!elements.some((node) => node.type === Notice));
    const panel = elements.find((node) => node.type.displayName === "PaymentsPanel");
    assert.equal(panel.props.summary.balanceDue, balance);
    assert.equal(panel.props.summary.totalPaid, paid);
    assert.equal(panel.props.payments.length, rows.length);
    if (rows.length) assert.equal(panel.props.payments[0].id, paymentRow.id);
    assert.equal(panel.props.posSessionId, "pos-a");
    assert.equal(elements.find((node) => node.type.displayName === "CustomerHandoffPanel").props.balanceDue, balance);
  });
}
test("order detail does not mask authentication/navigation errors as missing financial data", async () => {
  const denied = Error("authentication denied");
  const Page = orderPage(paymentQueries({ denied }));
  await assert.rejects(Page({ params: Promise.resolve({ locale: "it", orderId: order.id }), searchParams: Promise.resolve({}) }), (error) => error === denied);
});
