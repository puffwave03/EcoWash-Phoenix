import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { loadPreviewModule, previewProps } from "../scripts/preview-billing-simplified-ticket.mjs";

const path = "src/features/printing/server/rec-state.ts";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const copy = (value) => JSON.parse(JSON.stringify(value));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1), foreignOrg = id(2), orderId = id(10), customerId = id(20), invoiceId = id(30);
const projection = loadPreviewModule("src/features/billing/simplified-document.ts");
const payment = (extra = {}) => ({
  id: id(100), organization_id: org, order_id: orderId, amount: "13.00", status: "confirmed",
  method: "cash", channel: "pos", paid_at: "2026-11-20T10:00:00Z", refunded_from_payment_id: null,
  pos_session_id: id(40), recorded_by: id(50), confirmed_by: id(50), ...extra,
});

// Real resolver + real canonical draft bridge/projections. Only auth, readers
// and the Supabase transport are doubled. No network/client/runtime is loaded.
function harness(options = {}) {
  const original = previewProps().document;
  const h = {
    rows: {
      orders: [{ id: orderId, organization_id: org, customer_id: customerId, order_number: "LAB-001",
        currency: "EUR", subtotal: "14.00", discount_amount: "1.00", total: "13.00",
        is_active: true, production_status: "received", location_id: id(60) }],
      order_items: original.items.map((item, index) => ({ id: id(70 + index), organization_id: org, order_id: orderId,
        description: item.description, quantity: item.quantity, unit_price: item.unitPrice, line_total: item.lineSubtotal, is_active: true })),
      payments: [], invoice_orders: [], invoices: [],
      customers: [{ id: customerId, organization_id: org, customer_code: "WALKIN-SHARED" }],
      pos_sessions: [{ id: id(40), organization_id: org, location_id: id(60), status: "closed" }],
    },
    detail: { invoice: {
      id: invoiceId, customerId, currency: "EUR", fiscalDocumentType: "simplificada", documentStatus: "draft",
      invoiceNumber: null, issuedAt: null, sequenceNumber: null, issueDate: "2026-11-20", series: "LAB-S",
      pricesIncludeTax: true, subtotal: 14, discountTotal: 1, taxableBase: 12.15, taxTotal: .85, total: 13,
      orderIds: [orderId], orderNumbers: ["LAB-001"], customerName: null, customerTaxId: null,
      customerAddressLine1: null, customerAddressLine2: null, customerCity: null, customerPostalCode: null,
      customerCountryCode: null, customerEmail: null, issuerLegalName: original.issuer.legalName,
      issuerTaxId: original.issuer.taxId, issuerAddressLine1: original.issuer.addressLine1,
      issuerCity: original.issuer.city, issuerPostalCode: original.issuer.postalCode,
      issuerCountryCode: "ES", issuerLogoPath: null,
    }, items: original.items.map((item) => ({ ...item, sourceOrderId: orderId })), payments: [] },
    summary: { total_due: "13.00", total_paid: "0.00", balance_due: "13.00", payment_status: "unpaid" },
    failures: new Set(), overrides: new Map(), calls: [], role: options.role ?? "owner",
    pageCap: 200, posOrg: options.posOrg ?? org,
  };
  const client = {
    from(table) {
      assert.ok(table in h.rows, `Unexpected table ${table}`);
      const filters = [], call = { table, filters, range: null, limit: null, exact: false };
      async function execute(single) {
        h.calls.push(call);
        if (h.failures.has(table)) return { data: null, error: Error("DB failure"), count: null };
        if (h.overrides.has(table)) {
          const value = h.overrides.get(table);
          return typeof value === "function" ? value(call) : value;
        }
        let rows = h.rows[table].filter((row) => filters.every(([key, values]) => values.includes(row[key])));
        const count = rows.length;
        if (call.range) rows = rows.sort((a, b) => a.id.localeCompare(b.id))
          .slice(call.range[0], Math.min(call.range[1] + 1, call.range[0] + h.pageCap));
        if (call.limit) rows = rows.slice(0, call.limit);
        return { data: copy(single ? rows[0] ?? null : rows), error: null, count: call.exact ? count : null };
      }
      const q = {
        select(columns, opts) { call.exact = opts?.count === "exact"; return q; },
        eq(key, value) { filters.push([key, [value]]); return q; },
        in(key, values) { filters.push([key, values]); return q; }, order() { return q; },
        range(start, end) { call.range = [start, end]; return q; }, limit(n) { call.limit = n; return q; },
        maybeSingle: () => execute(true), returns: () => execute(false),
      };
      return q;
    },
    rpc(name, args) {
      h.calls.push({ rpc: name, args });
      assert.equal(name, "get_order_payment_summary", "Only the canonical read RPC is allowed");
      assert.equal(args.target_order_id, orderId);
      return { async single() {
        if (h.failures.has("summary")) return { data: null, error: Error("summary failed") };
        return { data: copy(h.summary), error: null };
      } };
    },
    storage: { from() { throw Error("No fixture logo"); } },
  };
  const mocks = {
    "server-only": {},
    "@/features/billing/simplified-document": projection,
    "@/features/payments/types": loadPreviewModule("src/features/payments/types.ts"),
    "@/features/orders/types": loadPreviewModule("src/features/orders/types.ts"),
    "@/features/entitlements/feature-catalog": { FEATURES: { billingInvoicing: "billing.invoicing" } },
    "@/features/entitlements/server/resolver": { async requireEntitlement() {
      assert.notEqual(options.billing, false, "BILLING_DENIED");
    } },
    "@/lib/auth/require-role": { async requireOwnerOrManager() {
      assert.ok(["owner", "manager"].includes(h.role), "ROLE_DENIED");
      return { membership: { organization: { id: org, timezone: "Atlantic/Canary" } } };
    } },
    "@/features/pos/server/access": { async requirePosAccess() {
      assert.notEqual(options.pos, false, "POS_DENIED");
      return { membership: { organization: { id: h.posOrg } } };
    } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { h.calls.push("client"); return client; } },
    "@/features/billing/server/queries": {
      async getBillingSimplifiedIssued(locale, target) {
        assert.equal(target, invoiceId); h.calls.push("issued-reader");
        if (h.failures.has("issued")) throw Error("snapshot unavailable");
        return copy(h.detail);
      },
      async getBillingSimplifiedDraft(locale, target) {
        assert.equal(target, invoiceId); h.calls.push("draft-reader");
        if (h.failures.has("draft")) throw Error("draft unavailable");
        return copy(h.detail);
      },
    },
  };
  function load(file) {
    const m = { exports: {} };
    runInNewContext(ts.transpileModule(read(file), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { module: m, exports: m.exports, require(name) {
      assert.ok(name in mocks, `Unexpected import ${name}`); return mocks[name];
    } }, { filename: file });
    return m.exports;
  }
  const bridge = load("src/features/billing/server/simplified-pos-bridge.ts");
  mocks["@/features/billing/server/simplified-pos-bridge"] = {
    async getBillingSimplifiedPosPreview(...args) {
      h.calls.push("bridge"); h.beforeBridge?.(); return bridge.getBillingSimplifiedPosPreview(...args);
    },
  };
  const resolver = load(path);
  h.resolve = async (target = orderId) => {
    const r = await resolver.resolveOrderRecState("es", target);
    assert.equal(r.fiscalIssuanceAllowed, false);
    assert.equal(r.print.status, "not_requested");
    assert.ok(h.calls.filter((c) => c.rpc).every((c) => c.rpc === "get_order_payment_summary"));
    return copy(r);
  };
  h.paid = () => {
    h.rows.payments = [payment()];
    h.summary = { total_due: 13, total_paid: 13, balance_due: 0, payment_status: "paid" };
  };
  h.draft = () => {
    h.rows.invoice_orders = [{ organization_id: org, invoice_id: invoiceId, order_id: orderId, is_active: true }];
    h.rows.invoices = [{ id: invoiceId, organization_id: org, customer_id: customerId,
      document_status: "draft", fiscal_document_type: "simplificada", invoice_number: null, sequence_number: null, issued_at: null }];
  };
  h.issued = () => {
    h.draft();
    Object.assign(h.rows.invoices[0], { document_status: "issued", invoice_number: "2026-LAB-S-000001", sequence_number: 1, issued_at: "2026-11-20T10:00:00Z" });
    Object.assign(h.detail.invoice, { documentStatus: "issued", invoiceNumber: "2026-LAB-S-000001", sequenceNumber: 1, issuedAt: "2026-11-20T10:00:00Z" });
  };
  return h;
}

test("no confirmed payment selects only the non-fiscal operational source", async () => {
  const h = harness(), before = JSON.stringify(h.rows), r = await h.resolve();
  assert.equal(r.state, "unpaid"); assert.equal(r.economic.outstanding, 13);
  assert.equal(r.billing.status, "none"); assert.equal(r.print.source, "operational_order");
  assert.equal(JSON.stringify(h.rows), before); assert.ok(!h.calls.includes("bridge"));
});

test("single full payment requires fiscal review, never issuance", async () => {
  const h = harness(); h.paid(); const r = await h.resolve();
  assert.equal(r.state, "paid_fiscal_review"); assert.equal(r.economic.collectedNet, 13);
  assert.equal(r.economic.confirmedPaymentCount, 1); assert.equal(r.print.source, null);
});

test("mixed payment and settlement after advances retain history without inventing fiscal treatment", async () => {
  for (const later of [false, true]) {
    const h = harness(); h.paid();
    h.rows.payments = [payment({ amount: 5 }), payment({ id: id(101), method: "card", amount: 8,
      paid_at: later ? "2026-11-21T10:00:00Z" : "2026-11-20T10:00:00Z" })];
    const r = await h.resolve();
    assert.equal(r.state, "paid_fiscal_review"); assert.equal(r.economic.status, "paid");
    assert.equal(r.economic.multiplePayments, true); assert.equal(r.economic.collectedNet, 13);
    assert.equal(r.economic.collectionTimes.length, later ? 2 : 1);
    assert.equal(r.economic.advanceTreatment, "not_assessed"); assert.equal(r.print.source, null);
  }
});

test("partial payment is distinct from unpaid and retains the real balance", async () => {
  const h = harness(); h.rows.payments = [payment({ amount: 5 })];
  h.summary = { total_due: 13, total_paid: 5, balance_due: 8, payment_status: "partially_paid" };
  const r = await h.resolve(); assert.equal(r.state, "partial_or_advance");
  assert.equal(r.economic.outstanding, 8); assert.equal(r.print.source, null);
});

test("partial and full refunds never become unpaid, including net zero", async () => {
  for (const amount of [3, 13]) {
    const h = harness(); h.paid();
    h.rows.payments.push(payment({ id: id(101), amount, status: "refunded", refunded_from_payment_id: id(100) }));
    h.summary = { total_due: 13, total_paid: 13 - amount, balance_due: amount,
      payment_status: amount === 13 ? "refunded" : "partially_paid" };
    const r = await h.resolve(); assert.equal(r.state, "refunded");
    assert.equal(r.economic.refunded, amount); assert.equal(r.print.source, null);
  }
});

test("issued snapshot identity survives refunds, cancelled orders and economic read failures", async () => {
  for (const change of [
    (h) => { h.rows.orders[0].is_active = false; h.rows.orders[0].production_status = "cancelled"; h.failures.add("summary"); },
    (h) => { h.failures.add("payments"); },
    (h) => { h.rows.payments.push(payment({ id: id(101), amount: 13, status: "refunded", refunded_from_payment_id: id(100) }));
      h.summary = { total_due: 13, total_paid: 0, balance_due: 13, payment_status: "refunded" }; },
    (h) => { h.rows.payments[0].amount = 14; },
  ]) {
    const h = harness(); h.paid(); h.issued(); change(h);
    const first = await h.resolve(), second = await h.resolve();
    assert.equal(first.state, "simplified_issued"); assert.deepEqual(first.billing, second.billing);
    assert.equal(first.billing.invoiceId, invoiceId); assert.equal(first.billing.snapshot, "identified");
    assert.equal(first.print.documentId, invoiceId); assert.equal(first.print.source, "billing_snapshot");
    assert.ok(!h.calls.includes("bridge"));
  }
});

test("issued invoice for another customer in the same tenant cannot select a print source", async () => {
  const h = harness(); h.paid(); h.issued();
  h.rows.invoices[0].customer_id = id(21);
  h.detail.invoice.customerId = id(21);
  const r = await h.resolve();
  assert.equal(r.state, "unknown");
  assert.equal(r.print.source, null); assert.equal(r.print.documentId, null);
});

test("issued snapshot customer must match the invoice customer before selecting print", async () => {
  const h = harness(); h.paid(); h.issued();
  h.detail.invoice.customerId = id(21);
  const r = await h.resolve();
  assert.equal(r.state, "unknown");
  assert.equal(r.billing.snapshot, "unavailable");
  assert.equal(r.print.source, null); assert.equal(r.print.documentId, null);
});

test("unavailable issued snapshot returns unknown while preserving the known issued identity", async () => {
  const h = harness(); h.issued(); h.failures.add("issued"); const r = await h.resolve();
  assert.equal(r.state, "unknown"); assert.equal(r.billing.status, "simplified_issued");
  assert.equal(r.billing.invoiceId, invoiceId); assert.equal(r.billing.snapshot, "unavailable");
  assert.equal(r.print.source, null);
});

test("compatible draft reuses the real canonical bridge and returns the existing ID", async () => {
  const h = harness(); h.paid(); h.draft(); const before = JSON.stringify(h.detail), r = await h.resolve();
  assert.equal(r.state, "compatible_draft"); assert.equal(r.billing.invoiceId, invoiceId);
  assert.ok(h.calls.includes("bridge") && h.calls.includes("draft-reader"));
  assert.equal(JSON.stringify(h.detail), before); assert.equal(r.print.source, null);
});

test("ordinary documents and incompatible simplified drafts require explicit handling", async () => {
  for (const change of [
    (h) => { h.rows.invoices[0].fiscal_document_type = "ordinaria"; },
    (h) => { h.rows.invoices[0].document_status = "issued"; h.rows.invoices[0].fiscal_document_type = "ordinaria"; },
    (h) => { h.detail.items[0].lineTotal = 6; },
    (h) => { h.detail.invoice.orderIds = [id(999)]; },
    (h) => { h.rows.invoices[0].customer_id = id(999); },
    (h) => { h.rows.invoices[0].invoice_number = "UNEXPECTED"; },
  ]) {
    const h = harness(); h.paid(); h.draft(); change(h); const r = await h.resolve();
    assert.equal(r.state, "billing_conflict"); assert.equal(r.billing.invoiceId, invoiceId);
    assert.equal(r.print.source, null);
  }
});

test("observable changes between economic and draft reads fail closed", async () => {
  const h = harness(); h.draft(); h.rows.payments = [payment({ amount: 5 })];
  h.summary = { total_due: 13, total_paid: 5, balance_due: 8, payment_status: "partially_paid" };
  h.beforeBridge = h.paid;
  const r = await h.resolve(); assert.equal(r.state, "unknown");
  assert.equal(r.reason, "draft_reference_mismatch"); assert.equal(r.print.source, null);
});

test("database errors and missing results fail closed at every read stage", async () => {
  for (const table of ["orders", "invoice_orders", "invoices", "payments", "order_items", "summary", "draft"]) {
    const h = harness(); h.paid(); h.draft(); h.failures.add(table);
    assert.equal((await h.resolve()).state, "unknown", table);
  }
  for (const table of ["orders", "invoices", "payments", "order_items", "invoice_orders"]) {
    const h = harness(); h.paid(); h.draft(); h.overrides.set(table, { data: null, error: null, count: null });
    assert.equal((await h.resolve()).state, "unknown", table);
  }
});

test("missing, truncated, duplicate or changing-count ledger results cannot prove unpaid", async () => {
  for (const override of [
    { data: [], error: null, count: 1 }, { data: [], error: null, count: null },
    { data: [payment(), payment()], error: null, count: 2 },
  ]) {
    const h = harness(); h.overrides.set("payments", override); assert.equal((await h.resolve()).state, "unknown");
  }
  const h = harness(); h.paid(); h.overrides.set("payments", (call) => call.range[0] === 0
    ? { data: [payment({ amount: 5 })], error: null, count: 2 }
    : { data: [payment({ id: id(101), amount: 8 })], error: null, count: 3 });
  assert.equal((await h.resolve()).state, "unknown");
});

test("server row caps are paginated to the exact count without skipping payments", async () => {
  const h = harness(); h.paid(); h.pageCap = 1;
  h.rows.payments = [payment({ amount: 5 }), payment({ id: id(101), method: "card", amount: 8 })];
  const r = await h.resolve(); assert.equal(r.state, "paid_fiscal_review"); assert.equal(r.economic.confirmedPaymentCount, 2);
  assert.deepEqual(h.calls.filter((c) => c.table === "payments").map((c) => c.range[0]), [0, 1]);
});

test("cross-tenant requests and unexpectedly unscoped rows expose no foreign document", async () => {
  const foreign = harness(); foreign.rows.orders[0].organization_id = foreignOrg;
  assert.equal((await foreign.resolve()).state, "unknown");
  for (const table of ["orders", "invoice_orders", "invoices", "payments", "order_items"]) {
    const h = harness(); h.paid(); h.draft();
    const row = { ...h.rows[table][0], organization_id: foreignOrg };
    h.overrides.set(table, { data: ["orders", "invoices"].includes(table) ? row : [row], error: null, count: 1 });
    const r = await h.resolve(); assert.equal(r.state, "unknown", table);
    assert.equal(JSON.stringify(r).includes(foreignOrg), false);
  }
});

test("all transport reads filter tenant ownership and preserve current role/entitlement gates", async () => {
  for (const role of ["owner", "manager"]) {
    const h = harness({ role }); h.paid(); h.draft(); await h.resolve();
    assert.ok(h.calls.filter((c) => c.table).every((c) => c.filters.some(([k, v]) => k === "organization_id" && v[0] === org)));
  }
  for (const opts of [{ role: "staff" }, { role: "customer" }, { billing: false }, { pos: false }]) {
    const h = harness(opts); await assert.rejects(h.resolve(), /DENIED/); assert.equal(h.calls.length, 0);
  }
  const mismatch = harness({ posOrg: foreignOrg });
  assert.equal((await mismatch.resolve()).state, "unknown"); assert.equal(mismatch.calls.length, 0);
});

test("inconsistent monetary facts and refund references have a dedicated anomaly state", async () => {
  for (const change of [
    (h) => { h.rows.payments[0].amount = "13.001"; },
    (h) => { h.rows.payments[0].amount = -1; },
    (h) => { h.rows.payments[0].amount = 14; },
    (h) => { h.summary.total_paid = 12; },
    (h) => { h.summary.payment_status = "unpaid"; },
    (h) => { h.rows.payments.push(payment({ id: id(101), status: "refunded", amount: 3, refunded_from_payment_id: id(999) })); },
    (h) => { h.rows.payments.push(payment({ id: id(101), status: "refunded", amount: 14, refunded_from_payment_id: id(100) })); },
  ]) {
    const h = harness(); h.paid(); change(h); const r = await h.resolve();
    assert.equal(r.state, "reconciliation_anomaly"); assert.equal(r.print.source, null);
  }
});

test("missing fields, items and inconsistent order references produce unknown", async () => {
  for (const change of [
    (h) => { h.rows.order_items = []; }, (h) => { h.rows.order_items[0].line_total = 7; },
    (h) => { h.rows.orders[0].discount_amount = 2; }, (h) => { h.rows.orders[0].currency = ""; },
    (h) => { h.rows.orders[0].is_active = false; }, (h) => { h.rows.orders[0].production_status = "cancelled"; },
    (h) => { h.rows.orders[0].production_status = "invalid"; },
    (h) => { h.rows.payments = [payment()]; delete h.rows.payments[0].status; },
    (h) => { h.rows.payments = [payment()]; delete h.rows.payments[0].amount; },
    (h) => { h.rows.payments = [payment({ order_id: id(999) })]; h.overrides.set("payments", { data: h.rows.payments, count: 1 }); },
    (h) => { h.draft(); h.overrides.set("invoice_orders", { data: [{ ...h.rows.invoice_orders[0], order_id: id(999) }], count: 1 }); },
  ]) {
    const h = harness(); change(h); assert.equal((await h.resolve()).state, "unknown");
  }
});

test("malformed IDs, pending facts and invalid issued identities never select an operational receipt", async () => {
  const invalid = harness(); assert.equal((await invalid.resolve("not-a-uuid")).state, "unknown"); assert.equal(invalid.calls.length, 0);
  const pending = harness(); pending.rows.payments = [payment({ status: "pending" })];
  assert.equal((await pending.resolve()).state, "unknown");
  for (const change of [
    (h) => { h.rows.invoices[0].invoice_number = null; },
    (h) => { h.rows.invoices[0].issued_at = "invalid"; },
    (h) => { h.detail.invoice.orderIds = [id(999)]; },
    (h) => { h.detail.items[0].sourceOrderId = id(999); },
    (h) => { h.detail.invoice.id = id(999); },
    (h) => { h.detail.invoice.sequenceNumber = 2; },
  ]) {
    const h = harness(); h.issued(); change(h); const r = await h.resolve();
    assert.equal(r.state, "unknown"); assert.equal(r.print.source, null);
  }
});
