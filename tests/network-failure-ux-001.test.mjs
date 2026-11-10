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
const compiled = new Map();
function load(path, imports = {}, logs = []) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText);
  const compiledModule = { exports: {} };
  runInNewContext(compiled.get(path), { module: compiledModule, exports: compiledModule.exports, Buffer, URLSearchParams,
    crypto: { randomUUID: () => "synthetic-idempotency-key" },
    console: { error: (...args) => logs.push(args) }, require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === "server-only") return {};
      if (name === "react/jsx-runtime") return require(name);
      throw Error(`Unexpected import: ${name}`);
    },
  }, { filename: path });
  return compiledModule.exports;
}
const errors = load("src/features/pos/read-error.ts");
const pagination = load("src/features/pos/pagination.ts");
const sessionId = "11111111-1111-4111-8111-111111111111";
const rowId = "22222222-2222-4222-8222-222222222222";
const sessionRow = { id: sessionId, location_id: "site-a", opened_at: "2026-11-10T08:00:00Z", opening_cash: 20,
  status: "open", closed_at: null, counted_cash: null, difference: null, expected_cash: null,
  location: { name: "Synthetic site" }, opened_by_profile: { display_name: "Synthetic operator" } };
const orderRow = { id: "order-a", order_number: "EW-SYNTHETIC", customer_name: "Synthetic customer", location_id: "site-a",
  currency: "EUR", total: 8.5, total_paid: 0, outstanding: 8.5, production_status: "completed" };
const paymentRow = { id: "payment-a", order_id: "order-a", order: { order_number: "EW-SYNTHETIC" }, amount: 4,
  channel: "pos", method: "cash", status: "confirmed", created_at: "2026-11-10T09:00:00Z", paid_at: "2026-11-10T09:00:00Z",
  provider: null, refunded_from_payment_id: null, recorded_by_profile: { display_name: "Synthetic operator" } };
const summaryRow = { cash_payments: 4, cash_refunds: 4, expected_cash: 20, opening_cash: 20, transaction_count: 2 };
const defaultRows = { orders: [orderRow], payments: [paymentRow, { ...paymentRow, id: "refund-a", status: "refunded", refunded_from_payment_id: paymentRow.id }],
  history: [sessionRow], locations: [{ id: "site-a", name: "Synthetic site" }], summary: summaryRow };
const methods = {
  orders: (q) => q.listPosOrdersDue("it", "EW-123"),
  payments: (q, cursor = null) => q.listPosSessionPayments("it", sessionId, cursor),
  history: (q, cursor = null) => q.listPosSessionHistory("it", cursor),
  locations: (q) => q.listPosLocations("it"),
  summary: (q) => q.getPosSessionSummary("it", sessionId),
};
function queries({ failure = {}, rows = {}, role = "owner", denied } = {}) {
  const calls = [], logs = [];
  async function response(kind) {
    if (failure[kind] === "rejected") throw Error("PRIVATE_TRANSPORT_DETAILS");
    return { data: failure[kind] === "missing" ? null : Object.hasOwn(rows, kind) ? rows[kind] : defaultRows[kind],
      error: failure[kind] === "error" ? { code: "42501", message: "PRIVATE_DATABASE_DETAILS" } : null };
  }
  function chain(kind) {
    const query = {};
    for (const method of ["select", "eq", "order", "or", "limit", "is"]) query[method] = (...args) => {
      calls.push([kind, method, ...args]); return query;
    };
    query.returns = () => response(kind);
    query.single = () => response(kind);
    return query;
  }
  const client = {
    from(table) { calls.push(["from", table]); return chain({ payments: "payments", pos_sessions: "history", locations: "locations" }[table]); },
    rpc(name, args) { calls.push(["rpc", name, args]); return chain({ list_pos_orders_due: "orders", get_pos_session_summary: "summary" }[name]); },
  };
  const access = async () => {
    calls.push(["access"]);
    if (denied) throw denied;
    return { membership: { role, organization: { id: "tenant-a" } }, profile: { id: "operator-a" } };
  };
  return { calls, logs, access, ...load("src/features/pos/server/queries.ts", {
    "@/features/pos/read-error": errors,
    "@/features/pos/pagination": pagination,
    "@/features/pos/server/access": { requirePosAccess: access },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => client },
  }, logs) };
}

for (const kind of ["orders", "payments", "history", "locations"]) {
  test(`${kind}: successful empty list is valid`, async () => {
    const q = queries({ rows: { [kind]: [] } });
    const result = await methods[kind](q);
    assert.equal((result.items ?? result).length, 0);
    assert.equal(q.logs.length, 0);
  });
}
test("summary: a real zero-movement/zero-cash row remains valid", async () => {
  const q = queries({ rows: { summary: { cash_payments: 0, cash_refunds: 0, expected_cash: 0, opening_cash: 0, transaction_count: 0 } } });
  const result = await methods.summary(q);
  assert.ok(result);
  assert.deepEqual(Object.values(result), [0, 0, 0, 0, 0]);
});
test("successful reads preserve canonical amounts, refunds, locations and sessions", async () => {
  const q = queries();
  const orders = await methods.orders(q), payments = await methods.payments(q), history = await methods.history(q);
  const locations = await methods.locations(q), summary = await methods.summary(q);
  assert.equal(orders[0].outstanding, 8.5);
  assert.equal(orders[0].totalPaid, 0);
  assert.equal(payments.items[1].status, "refunded");
  assert.equal(payments.items[1].refundedFromPaymentId, paymentRow.id);
  assert.equal(payments.items[1].amount, 4);
  assert.equal(history.items[0].expectedCash, null);
  assert.equal(locations[0].id, "site-a");
  assert.equal(summary.cashPayments, 4);
  assert.equal(summary.cashRefunds, 4);
  assert.equal(summary.expectedCash, 20);
  assert.equal(summary.transactionCount, 2);
});
for (const kind of Object.keys(methods)) {
  for (const failure of ["error", "rejected", "missing"]) {
    test(`${kind}: ${failure} produces a typed error, with sanitized diagnostics`, async () => {
      const q = queries({ failure: { [kind]: failure } });
      await assert.rejects(methods[kind](q), (error) => error instanceof errors.PosReadError && !/PRIVATE/.test(error.message));
      assert.equal(q.logs.length, 1);
      assert.equal(q.logs[0][1], { error: "42501", rejected: "request_failed", missing: "missing_data" }[failure]);
      assert.doesNotMatch(JSON.stringify(q.logs), /PRIVATE/);
    });
  }
}
test("access denial propagates unchanged before any query", async () => {
  const denied = Error("NEXT_REDIRECT: access denied");
  const q = queries({ denied });
  for (const method of Object.values(methods)) await assert.rejects(method(q), (error) => error === denied);
  assert.ok(q.calls.every(([kind]) => kind === "access"));
  assert.equal(q.logs.length, 0);
});
test("Staff history remains intentionally hidden without querying the database", async () => {
  const q = queries({ role: "staff", failure: { history: "error" } });
  assert.equal((await methods.history(q)).items.length, 0);
  assert.ok(q.calls.every(([kind]) => kind === "access"));
  assert.equal(q.logs.length, 0);
});
test("tenant, session, active-site and RPC filters are unchanged", async () => {
  const q = queries();
  for (const method of Object.values(methods)) await method(q);
  for (const kind of ["payments", "history", "locations"])
    assert.ok(q.calls.some(([k, op, key, value]) => k === kind && op === "eq" && key === "organization_id" && value === "tenant-a"));
  assert.ok(q.calls.some(([k, op, key, value]) => k === "payments" && op === "eq" && key === "pos_session_id" && value === sessionId));
  assert.ok(q.calls.some(([k, op, key, value]) => k === "locations" && op === "eq" && key === "is_active" && value === true));
  assert.ok(q.calls.some(([k, op, key, value]) => k === "locations" && op === "is" && key === "deleted_at" && value === null));
  assert.ok(q.calls.some(([op, name, args]) => op === "rpc" && name === "list_pos_orders_due" && args.target_query === "EW-123" && args.target_limit === 30));
  assert.ok(q.calls.some(([op, name, args]) => op === "rpc" && name === "get_pos_session_summary" && args.target_session_id === sessionId));
});
for (const direction of ["older", "newer"]) test(`${direction}: query ordering, boundary and cursor encoding remain canonical`, async () => {
  const rows = Array.from({ length: 26 }, (_, index) => ({ ...paymentRow, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));
  const q = queries({ rows: { payments: rows, history: rows.map((row) => ({ ...sessionRow, id: row.id })) } });
  const cursor = { direction, timestamp: paymentRow.created_at, id: rowId, sessionId };
  const payments = await methods.payments(q, cursor), history = await methods.history(q, cursor);
  assert.equal(payments.items.length, 25);
  assert.equal(history.items.length, 25);
  assert.equal(payments.items[0].id, rows[direction === "newer" ? 24 : 0].id);
  assert.ok(pagination.decodePosPaymentCursor(payments.pagination.olderCursor, sessionId));
  assert.ok(pagination.decodePosSessionCursor(history.pagination.newerCursor));
  for (const [kind, column] of [["payments", "created_at"], ["history", "opened_at"]]) {
    assert.ok(q.calls.some(([k, op, value]) => k === kind && op === "limit" && value === 26));
    assert.ok(q.calls.some(([k, op, key, options]) => k === kind && op === "order" && key === column && options.ascending === (direction === "newer")));
    assert.ok(q.calls.some(([k, op, value]) => k === kind && op === "or" && value === pagination.posCursorBoundary(column, cursor)));
  }
});

const locales = ["it", "es", "en", "fr", "de"];
const messages = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(read(`src/i18n/${locale}/common.json`)).pos]));
const noAction = async () => { assert.fail("rendering must not execute a financial action"); };
function workspace(locale) {
  return load("src/components/pos/PosWorkspace.tsx", {
    react: { useActionState: (_action, initial) => [initial, noAction, false],
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}] },
    "@/components/Button": { Button: ({ children, ...props }) => { delete props.variant; return React.createElement("button", props, children); } },
    "@/components/Card": { Card: ({ children, ...props }) => React.createElement("section", props, children) },
    "@/lib/number-format": { formatCurrency: (value, currency, language) => new Intl.NumberFormat(language, { style: "currency", currency }).format(value) },
    "@/i18n/navigation": { Link: ({ href, children, ...props }) => React.createElement("a", { ...props, href: `/${locale}${href}` }, children) },
  }).PosWorkspace;
}
async function page({ locale = "it", q = queries(), current = sessionRow, search = {}, overrides = {}, denied } = {}) {
  const Page = load("src/app/[locale]/app/(dashboard)/pos/page.tsx", {
    "@/components/pos/PosWorkspace": { PosWorkspace: workspace(locale) },
    "@/features/pos/server/actions": { closePosSessionAction: noAction, openPosSessionAction: noAction, recordPosPaymentAction: noAction, refundPosPaymentAction: noAction },
    "@/features/pos/server/queries": { ...q, getCurrentPosSession: async () => current ? { ...current, id: sessionId } : null,
      getPosCurrency: async () => "EUR", ...overrides },
    "@/features/pos/server/access": { requirePosAccess: async () => { if (denied) throw denied; return q.access(); } },
    "@/features/pos/read-error": errors,
    "@/features/pos/pagination": pagination,
    "next-intl/server": { getTranslations: async () => Object.assign((key) => {
      assert.equal(typeof messages[locale][key], "string"); return messages[locale][key];
    }, { raw: (key) => { assert.ok(messages[locale][key]); return messages[locale][key]; } }) },
  }).default;
  return Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(search) });
}
function resolve(node) {
  if (Array.isArray(node)) return node.map(resolve);
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === "function") return resolve(node.type(node.props));
  return React.cloneElement(node, {}, resolve(node.props.children));
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, predicate));
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props.children, predicate)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (React.isValidElement(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
const input = (tree, name) => nodes(tree, (node) => node.type === "input" && node.props.name === name).length > 0;

for (const locale of locales) {
  test(`${locale}: successful empty lists show their real empty states, not read warnings`, async () => {
    const root = resolve(await page({ locale, q: queries({ rows: { orders: [], payments: [], history: [] } }) }));
    const content = text(root);
    for (const kind of ["orders", "payments", "history"]) assert.ok(content.includes(messages[locale][kind].empty));
    assert.equal(nodes(root, (node) => node.props.role === "alert").length, 0);
    assert.ok(input(root, "countedCash"));
  });
  for (const kind of Object.keys(methods)) test(`${locale}: ${kind} failure warns and blocks only dependent actions`, async () => {
    const q = queries({ failure: { [kind]: "error" } });
    const result = await page({ locale, q });
    const root = resolve(result), content = text(root);
    assert.ok(content.includes(messages[locale].readErrors[kind]));
    assert.match(renderToStaticMarkup(root), /role="alert"/);
    if (messages[locale][kind]?.empty) assert.ok(!content.includes(messages[locale][kind].empty));
    assert.equal(input(root, "orderId"), kind !== "orders");
    assert.equal(input(root, "paymentId"), kind !== "payments");
    assert.equal(input(root, "countedCash"), kind !== "summary");
    assert.equal(input(root, "openingCash"), false);
    if (kind === "summary") assert.ok(!content.includes(messages[locale].session.expected));
    assert.ok(!content.includes("PRIVATE"));
    if (kind !== "history") assert.ok(content.includes(messages[locale].history.title));
    assert.ok(nodes(root, (node) => node.type === "a" && node.props.href === `/${locale}/app/pos`).length > 0);
  });
}
test("a valid absent session skips summary/payments and keeps the normal open-till path", async () => {
  const q = queries({ failure: { summary: "error", payments: "error" } });
  const root = resolve(await page({ q, current: null }));
  assert.ok(input(root, "openingCash"));
  assert.ok(!input(root, "countedCash"));
  assert.ok(!input(root, "orderId"));
  assert.ok(!input(root, "paymentId"));
  assert.ok(text(root).includes(messages.it.session.closed));
  assert.ok(!text(root).includes(messages.it.readErrors.summary));
  assert.ok(!q.calls.some(([op, name]) => op === "rpc" && name === "get_pos_session_summary"));
  assert.ok(!q.calls.some(([op, name]) => op === "from" && name === "payments"));
});
test("a real zero summary renders as zero while the populated order/payment data stays intact", async () => {
  const q = queries({ rows: { summary: { cash_payments: 0, cash_refunds: 0, expected_cash: 0, opening_cash: 0, transaction_count: 0 } } });
  const result = await page({ q });
  assert.equal(result.props.summary.expectedCash, 0);
  assert.equal(result.props.orders[0].outstanding, 8.5);
  assert.equal(result.props.payments[1].refundedFromPaymentId, paymentRow.id);
  const root = resolve(result);
  assert.equal(nodes(root, (node) => node.props.role === "alert").length, 0);
  assert.ok(text(root).includes(messages.it.session.expected));
  assert.ok(text(root).includes("0,00"));
  assert.ok(input(root, "countedCash"));
  assert.ok(input(root, "orderId"));
  assert.ok(input(root, "paymentId"));
});
test("Manager retains history and independent operations on an order-list read failure", async () => {
  const q = queries({ role: "manager", failure: { orders: "error" } });
  const root = resolve(await page({ q }));
  assert.ok(text(root).includes(messages.it.readErrors.orders));
  assert.ok(text(root).includes(messages.it.history.title));
  assert.ok(!input(root, "orderId"));
  assert.ok(input(root, "paymentId"));
  assert.ok(input(root, "countedCash"));
});
test("missing locations prevent opening without pretending there are no configured sites", async () => {
  const root = resolve(await page({ current: null, q: queries({ failure: { locations: "missing" } }) }));
  assert.ok(!input(root, "openingCash"));
  assert.ok(text(root).includes(messages.it.readErrors.locations));
  assert.ok(!text(root).includes(messages.it.session.noLocations));
});
test("a successful zero-location read retains the existing disabled setup state", async () => {
  const root = resolve(await page({ current: null, q: queries({ rows: { locations: [] } }) }));
  const fields = nodes(root, (node) => node.props.name === "openingCash" || node.props.name === "locationId");
  assert.equal(fields.length, 2);
  assert.ok(fields.every((node) => node.props.disabled));
  assert.ok(text(root).includes(messages.it.session.noLocations));
  assert.ok(!text(root).includes(messages.it.readErrors.locations));
});
test("concurrent independent read failures never become normal empty lists or open/close forms", async () => {
  const q = queries({ failure: Object.fromEntries(Object.keys(methods).map((kind) => [kind, "error"])) });
  const root = resolve(await page({ q }));
  assert.equal(nodes(root, (node) => node.props.role === "alert").length, 5);
  for (const name of ["openingCash", "orderId", "paymentId", "countedCash"]) assert.ok(!input(root, name));
  for (const kind of ["orders", "payments", "history"]) assert.ok(!text(root).includes(messages.it[kind].empty));
});
test("Staff never receives history or a history error, even with a history cursor", async () => {
  const q = queries({ role: "staff", failure: { history: "error" } });
  const root = resolve(await page({ q, search: { historyCursor: "not-valid" } }));
  assert.ok(!text(root).includes(messages.it.history.title));
  assert.ok(!text(root).includes(messages.it.readErrors.history));
  assert.ok(!q.calls.some(([op, table]) => op === "from" && table === "pos_sessions"));
  assert.ok(input(root, "orderId"));
});
test("retry uses a locale-aware normal GET with the existing search and both valid cursors", async () => {
  const position = { timestamp: "2026-11-10T09:00:00Z", id: rowId };
  const paymentCursor = pagination.encodePosPaymentCursor(position, "older", sessionId);
  const historyCursor = pagination.encodePosSessionCursor(position, "newer");
  for (const locale of locales) {
    const result = await page({ locale, q: queries({ failure: { payments: "error" } }), search: { q: "EW- & ?", paymentCursor, historyCursor } });
    assert.equal(result.props.paymentNavigation.currentCursor, paymentCursor);
    assert.equal(result.props.historyNavigation.currentCursor, historyCursor);
    assert.equal(result.props.paymentNavigation.olderHref, null);
    const root = resolve(result);
    const link = nodes(root, (node) => node.type === "a" && text(node) === messages[locale].readErrors.retry)[0];
    const url = new URL(link.props.href, "https://synthetic.invalid");
    assert.equal(url.pathname, `/${locale}/app/pos`);
    assert.equal(url.searchParams.get("q"), "EW- & ?");
    assert.equal(url.searchParams.get("paymentCursor"), paymentCursor);
    assert.equal(url.searchParams.get("historyCursor"), historyCursor);
  }
});
test("page does not swallow access/navigation or unexpected programming failures", async () => {
  for (const message of ["NEXT_REDIRECT", "not found", "unexpected programming failure"]) {
    const error = Error(message);
    await assert.rejects(page({ overrides: { listPosOrdersDue: async () => { throw error; } } }), (actual) => actual === error);
  }
  const denied = Error("access denied");
  await assert.rejects(page({ denied }), (actual) => actual === denied);
});
