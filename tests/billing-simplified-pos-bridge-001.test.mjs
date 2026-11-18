import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPreviewModule, previewProps } from "../scripts/preview-billing-simplified-ticket.mjs";

const path = "src/features/billing/server/simplified-pos-bridge.ts";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const normalize = (value) => JSON.parse(JSON.stringify(value));
const { BillingSimplifiedPosPreview } = loadPreviewModule("src/components/billing/BillingSimplifiedPosPreview.tsx");
const { billingSimplifiedDraftDocument } = loadPreviewModule("src/features/billing/simplified-document.ts");
const html = (result) => renderToStaticMarkup(createElement(BillingSimplifiedPosPreview, { result, blockedLabel: "Anteprima bloccata" }));
const text = (markup) => markup.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const payment = (extra = {}) => ({ id: "payment-a", organization_id: "org-a", order_id: "order-a", amount: "13.00",
  channel: "pos", status: "confirmed", method: "cash", pos_session_id: "session-a", paid_at: "2026-11-18T12:00:00Z",
  recorded_by: "actor-a", confirmed_by: "actor-a", refunded_from_payment_id: null, ...extra });

// Execute the real bridge and renderer with a read-only client double. No live
// Supabase client, database, Docker, auth service or mutation RPC is imported.
function bridge({ role = "owner", billing = true, pos = true, posOrg = "org-a" } = {}) {
  const doc = previewProps().document;
  const rows = {
    orders: [{ id: "order-a", organization_id: "org-a", customer_id: "customer-a", order_number: "EW-001",
      currency: "EUR", subtotal: "14.00", discount_amount: "1.00", total: "13.00", is_active: true, production_status: "received", location_id: "shop-a" }],
    payments: [payment()],
    customers: [{ id: "customer-a", organization_id: "org-a", customer_code: "WALKIN-SHARED" }],
    pos_sessions: [{ id: "session-a", organization_id: "org-a", location_id: "shop-a", status: "open" }],
    invoice_orders: [{ organization_id: "org-a", invoice_id: "invoice-a", order_id: "order-a", is_active: true }],
    invoices: [{ id: "invoice-a", organization_id: "org-a", customer_id: "customer-a", document_status: "draft", fiscal_document_type: "simplificada" }],
  };
  const invoice = {
    id: "invoice-a", customerId: "customer-a", currency: "EUR", documentStatus: "draft", fiscalDocumentType: "simplificada",
    invoiceNumber: null, issuedAt: null, issueDate: "2026-11-18", series: "S", pricesIncludeTax: true,
    orderIds: ["order-a"], orderNumbers: ["EW-001"], subtotal: 14, discountTotal: 1, taxableBase: 12.15, taxTotal: .85, total: 13,
    customerName: null, customerTaxId: null, customerAddressLine1: null, customerAddressLine2: null, customerCity: null,
    customerPostalCode: null, customerCountryCode: null, customerEmail: null,
    issuerLegalName: doc.issuer.legalName, issuerTaxId: doc.issuer.taxId, issuerAddressLine1: doc.issuer.addressLine1,
    issuerCity: doc.issuer.city, issuerPostalCode: doc.issuer.postalCode, issuerCountryCode: doc.issuer.countryCode, issuerLogoPath: null,
  };
  const detail = { invoice, items: doc.items.map((item) => ({ ...item, sourceOrderId: "order-a" })), payments: [] };
  const failures = new Map(), overrides = new Map();
  const calls = { reads: [], rpc: [], draft: [], auth: [], clients: 0 };
  let summaryOverride;
  const client = {
    from(table) {
      assert.ok(table in rows, `Unexpected table: ${table}`);
      const filters = [];
      const call = { table, filters, range: null, limit: null };
      const execute = async (single) => {
        calls.reads.push(call);
        if (failures.has(table)) return { data: null, error: failures.get(table) };
        if (overrides.has(table)) return overrides.get(table);
        let selected = rows[table].filter((row) => filters.every(([column, values]) => values.includes(row[column])));
        if (call.range) selected = [...selected].sort((a, b) => a.id.localeCompare(b.id)).slice(call.range[0], call.range[1] + 1);
        if (call.limit) selected = selected.slice(0, call.limit);
        return { data: normalize(single ? selected[0] ?? null : selected), error: null };
      };
      const query = { select() { return query; }, eq(key, value) { filters.push([key, [value]]); return query; },
        in(key, values) { filters.push([key, values]); return query; }, order() { return query; },
        range(start, end) { call.range = [start, end]; return query; }, limit(count) { call.limit = count; return query; },
        maybeSingle: () => execute(true), returns: () => execute(false) };
      return query;
    },
    rpc(name, args) {
      assert.equal(name, "get_order_payment_summary", "Only the canonical read RPC is allowed");
      calls.rpc.push({ name, args });
      return { async single() {
        if (failures.has("summary")) return { data: null, error: failures.get("summary") };
        if (summaryOverride !== undefined) return summaryOverride;
        const due = Number(rows.orders[0].total);
        const paid = rows.payments.filter((row) => row.organization_id === "org-a" && row.order_id === "order-a")
          .reduce((sum, row) => sum + (row.status === "confirmed" ? 1 : row.status === "refunded" ? -1 : 0) * Math.round(Number(row.amount) * 100), 0) / 100;
        return { data: { total_due: due, total_paid: paid, balance_due: Math.max(Math.round((due - paid) * 100), 0) / 100,
          payment_status: paid >= due ? "paid" : paid > 0 ? "partially_paid" : "unpaid" } };
      } };
    },
    storage: { from(bucket) { assert.equal(bucket, "brand-media"); return { getPublicUrl(path) { return { data: { publicUrl: `https://example.invalid/${path}` } }; } }; } },
  };
  const imports = {
    "server-only": {}, "@/features/billing/simplified-document": { billingSimplifiedDraftDocument },
    "@/features/billing/server/queries": { async getBillingSimplifiedDraft(locale, id) {
      calls.draft.push({ locale, id });
      if (failures.has("draft")) throw failures.get("draft");
      return normalize(detail);
    } },
    "@/features/entitlements/feature-catalog": { FEATURES: { billingInvoicing: "billing.invoicing" } },
    "@/features/entitlements/server/resolver": { async requireEntitlement() { calls.auth.push("billing"); assert.ok(billing, "BILLING_DENIED"); } },
    "@/lib/auth/require-role": { async requireOwnerOrManager() {
      calls.auth.push("role"); assert.ok(["owner", "manager"].includes(role), "ROLE_DENIED");
      return { membership: { organization: { id: "org-a", timezone: "Atlantic/Canary" } } };
    } },
    "@/features/pos/server/access": { async requirePosAccess() {
      calls.auth.push("pos"); assert.ok(pos, "POS_DENIED"); return { membership: { organization: { id: posOrg } } };
    } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { calls.clients++; return client; } },
  };
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require(name) {
    assert.ok(name in imports, `Unexpected import: ${name}`); return imports[name];
  } }, { filename: path });
  return { rows, detail, failures, overrides, calls,
    read: (id = "order-a") => compiledModule.exports.getBillingSimplifiedPosPreview("es", id),
    summary(value) { summaryOverride = value; },
  };
}

test("fully paid order yields only a non-fiscal ticket preview from the existing Billing draft", async () => {
  const h = bridge(), before = JSON.stringify([h.rows, h.detail]);
  const result = await h.read();
  assert.equal(result.status, "preview");
  assert.equal(result.context.orderTotal, 13); assert.equal(result.context.posPaidTotal, 13); assert.equal(result.context.outstanding, 0);
  assert.equal(result.context.activeInvoice.id, "invoice-a");
  assert.equal(result.ticket.document.totals.total, 13); assert.equal(result.ticket.document.tax.amount, .85);
  assert.equal(result.ticket.document.document.number, null); assert.equal(result.ticket.document.document.issuedAt, null);
  assert.equal(result.ticket.preview, true); assert.equal("demonstration" in result.ticket, false);
  const plain = text(html(result));
  assert.match(plain, /VISTA PREVIA · SIN EMISIÓN FISCAL/);
  assert.match(plain, /CLIENTE SIN IDENTIFICAR/);
  assert.doesNotMatch(plain, /EJEMPLO-DEMO|FACTURA SIMPLIFICADA|DEMOSTRACIÓN/);
  assert.doesNotMatch(html(result), /<button|<form/);
  assert.equal(JSON.stringify([h.rows, h.detail]), before);
});

test("cash/card mixed payment is added once and reconciles to the canonical order summary", async () => {
  const h = bridge(); h.rows.payments = [payment({ amount: "5.00" }), payment({ id: "payment-b", amount: "8.00", method: "card" })];
  const result = await h.read(); assert.equal(result.status, "preview");
  assert.equal(result.context.posPaidTotal, 13); assert.equal(result.context.payments.length, 2);
  assert.deepEqual(normalize(result.context.payments.map((row) => row.method)), ["cash", "card"]);
});

test("partial payment returns an explicit blocked state and outstanding amount", async () => {
  const h = bridge(); h.rows.payments[0].amount = 5;
  const result = await h.read(); assert.equal(result.reason, "not_fully_paid");
  assert.equal(result.context.posPaidTotal, 5); assert.equal(result.context.outstanding, 8);
  assert.equal(h.calls.draft.length, 0); assert.doesNotMatch(html(result), /<article/);
});

test("an already-issued ordinary or simplified invoice blocks preview and exposes no issuance control", async () => {
  for (const type of ["ordinaria", "simplificada"]) {
    const h = bridge(); Object.assign(h.rows.invoices[0], { document_status: "issued", fiscal_document_type: type });
    const result = await h.read(); assert.equal(result.reason, "invoice_already_issued");
    assert.equal(result.context.activeInvoice.documentStatus, "issued"); assert.equal(h.calls.draft.length, 0);
  }
});

test("missing simplified draft and existing ordinary draft never cause creation or conversion", async () => {
  const missing = bridge(); missing.rows.invoice_orders = [];
  assert.equal((await missing.read()).reason, "simplified_draft_required");
  const ordinary = bridge(); ordinary.rows.invoices[0].fiscal_document_type = "ordinaria";
  assert.equal((await ordinary.read()).reason, "ordinary_draft_present");
});

test("all financial reads have explicit current-tenant filters; foreign orders are unavailable", async () => {
  const h = bridge(); await h.read();
  assert.ok(h.calls.reads.every((call) => call.filters.some(([key, values]) => key === "organization_id" && values[0] === "org-a")));
  h.rows.orders[0].organization_id = "org-b";
  const result = await h.read(); assert.equal(result.reason, "order_unavailable"); assert.equal(result.context, null);
});

test("foreign payments/invoices cannot contribute amounts or document identifiers", async () => {
  const h = bridge(); h.rows.payments.push(payment({ id: "foreign-payment", organization_id: "org-b", amount: 1000 }));
  h.rows.invoices.push({ ...h.rows.invoices[0], id: "foreign-invoice", organization_id: "org-b", document_status: "issued" });
  const result = await h.read(); assert.equal(result.status, "preview");
  assert.equal(result.context.posPaidTotal, 13); assert.equal(result.context.activeInvoice.id, "invoice-a");
  assert.equal(JSON.stringify(result).includes("foreign-"), false);
});

test("unscoped or foreign rows returned unexpectedly fail closed", async () => {
  const h = bridge(); h.overrides.set("payments", { data: [payment({ organization_id: "org-b" })] });
  const result = await h.read(); assert.equal(result.reason, "read_failed"); assert.equal(result.context, null);
});

test("non-POS financial facts are not treated as POS receipts", async () => {
  for (const channel of ["order", "online", "manual_external"]) {
    const h = bridge(); h.rows.payments[0].channel = channel;
    assert.equal((await h.read()).reason, "payment_not_pos");
  }
});

test("pending/void attempts never become confirmed money", async () => {
  const h = bridge(); h.rows.payments.push(payment({ id: "pending", amount: 999, status: "pending" }), payment({ id: "void", amount: 999, status: "void" }));
  const result = await h.read(); assert.equal(result.status, "preview"); assert.equal(result.context.payments.length, 1);
  h.rows.payments[0].status = "pending";
  assert.equal((await h.read()).reason, "not_fully_paid");
});

test("POS registration requires recorded/confirmed actors, a valid paid timestamp and a visible session", async () => {
  for (const patch of [{ pos_session_id: null }, { recorded_by: null }, { confirmed_by: null }, { paid_at: "invalid" }]) {
    const h = bridge(); Object.assign(h.rows.payments[0], patch);
    assert.equal((await h.read()).reason, "pos_registration_unverified");
  }
  for (const patch of [{ organization_id: "org-b" }, { location_id: "shop-b" }, { status: "unknown" }]) {
    const h = bridge(); Object.assign(h.rows.pos_sessions[0], patch);
    assert.equal((await h.read()).reason, "pos_registration_unverified");
  }
  const closed = bridge(); closed.rows.pos_sessions[0].status = "closed";
  assert.equal((await closed.read()).status, "preview");
});

test("refunds reduce net collected; repayment is read without rewriting any financial fact", async () => {
  const h = bridge(); h.rows.payments.push(payment({ id: "refund-a", amount: 5, status: "refunded", refunded_from_payment_id: "payment-a" }));
  const partial = await h.read(); assert.equal(partial.reason, "not_fully_paid"); assert.equal(partial.context.posPaidTotal, 8);
  h.rows.payments.push(payment({ id: "payment-b", amount: 5, method: "card" }));
  const result = await h.read(); assert.equal(result.status, "preview"); assert.equal(result.context.posPaidTotal, 13);
});

test("orphan or excessive refunds and duplicate ledger rows block reconciliation", async () => {
  for (const source of ["missing", "payment-a"]) {
    const h = bridge(); h.rows.payments.push(payment({ id: "refund-a", amount: 14, status: "refunded", refunded_from_payment_id: source }));
    assert.equal((await h.read()).reason, "payment_reconciliation_failed");
  }
  const h = bridge(); h.rows.payments.push(payment());
  assert.equal((await h.read()).reason, "payment_reconciliation_failed");
});

test("summary errors, missing data and ledger disagreement cannot become a paid order", async () => {
  for (const data of [null, { total_due: 13, total_paid: 0, balance_due: 0, payment_status: "paid" }]) {
    const h = bridge(); h.summary({ data });
    assert.equal((await h.read()).status, "blocked");
  }
});

test("cent arithmetic supports 0.10 + 0.20 without adding IGIC a second time", async () => {
  const h = bridge(); Object.assign(h.rows.orders[0], { total: ".30", subtotal: ".30", discount_amount: 0 });
  h.rows.orders[0].total = "0.30"; h.rows.orders[0].subtotal = "0.30";
  h.rows.payments = [payment({ amount: .1 }), payment({ id: "payment-b", amount: .2, method: "card" })];
  Object.assign(h.detail.invoice, { total: .3, subtotal: .3, discountTotal: 0, taxableBase: .28, taxTotal: .02 });
  h.detail.items = [{ ...h.detail.items[0], quantity: 3, unitPrice: .1, lineSubtotal: .3, discountAmount: 0, taxableBase: .28, taxAmount: .02, lineTotal: .3 }];
  const result = await h.read(); assert.equal(result.status, "preview");
  assert.equal(result.context.posPaidTotal, .3); assert.equal(result.ticket.document.totals.total, .3);
});

test("fractional cents and overpayment do not pass the full-payment gate", async () => {
  const fractional = bridge(); fractional.rows.payments[0].amount = "13.001";
  assert.equal((await fractional.read()).reason, "invalid_amounts");
  const over = bridge(); over.rows.payments[0].amount = "13.01";
  assert.equal((await over.read()).reason, "payment_exceeds_order");
});

test("mismatched Billing totals and multiple rates block without recalculation", async () => {
  const amounts = bridge(); amounts.detail.items[0].taxAmount = .47;
  assert.equal((await amounts.read()).reason, "billing_totals_mismatch");
  const rates = bridge(); rates.detail.items[1].taxRate = 3;
  assert.equal((await rates.read()).reason, "unsupported_tax_model");
});

test("the draft must belong solely to this order/customer and retain the anonymous recipient boundary", async () => {
  for (const patch of [{ orderIds: ["order-a", "order-b"] }, { customerId: "other-customer" }]) {
    const h = bridge(); Object.assign(h.detail.invoice, patch);
    assert.equal((await h.read()).reason, "draft_order_mismatch");
  }
  const h = bridge(); h.detail.invoice.customerName = "Invented identity";
  assert.equal((await h.read()).reason, "recipient_mismatch");
});

test("named recipient reads only its existing Billing identity", async () => {
  const h = bridge(); h.rows.customers[0].customer_code = "C-1"; h.detail.invoice.customerName = "Real stored name";
  const result = await h.read(); assert.equal(result.status, "preview");
  assert.match(text(html(result)), /Real stored name/); assert.doesNotMatch(text(html(result)), /CLIENTE SIN IDENTIFICAR/);
});

test("all source errors and unavailable Billing columns produce blocked results without a schema change", async () => {
  for (const source of ["orders", "payments", "summary", "invoice_orders", "customers", "invoices", "pos_sessions", "draft"]) {
    const h = bridge(); h.failures.set(source, { code: "XX000" });
    assert.equal((await h.read()).reason, "read_failed", source);
  }
  const schema = bridge(); schema.failures.set("invoices", { code: "42703" });
  assert.equal((await schema.read()).reason, "billing_schema_unavailable");
});

test("role, Billing and POS gates run before any data client; changed tenant context is rejected", async () => {
  for (const options of [{ role: "staff" }, { billing: false }, { pos: false }]) {
    const h = bridge(options); await assert.rejects(h.read(), /DENIED/); assert.equal(h.calls.clients, 0);
  }
  const h = bridge({ posOrg: "org-b" }); assert.equal((await h.read()).status, "blocked"); assert.equal(h.calls.clients, 0);
  assert.equal((await bridge({ role: "manager" }).read()).status, "preview");
});

test("ledger pagination reads all 201 facts without duplication", async () => {
  const h = bridge(); h.rows.payments = Array.from({ length: 201 }, (_, i) => payment({ id: `payment-${String(i).padStart(3, "0")}`, amount: .01 }));
  Object.assign(h.rows.orders[0], { total: 2.01, subtotal: 2.01, discount_amount: 0 });
  Object.assign(h.detail.invoice, { total: 2.01, subtotal: 2.01, discountTotal: 0, taxableBase: 1.88, taxTotal: .13 });
  h.detail.items = [{ ...h.detail.items[0], quantity: 1, unitPrice: 2.01, lineSubtotal: 2.01, discountAmount: 0, taxableBase: 1.88, taxAmount: .13, lineTotal: 2.01 }];
  const result = await h.read(); assert.equal(result.status, "preview"); assert.equal(result.context.payments.length, 201);
  assert.deepEqual(normalize(h.calls.reads.filter((call) => call.table === "payments").map((call) => call.range)), [[0, 199], [200, 399]]);
});

test("repeated preview/render produces no writes, duplicate payment, invoice or number", async () => {
  const h = bridge(), before = JSON.stringify([h.rows, h.detail]);
  const first = await h.read(), second = await h.read();
  assert.deepEqual(normalize(first), normalize(second)); assert.equal(html(first), html(second));
  assert.equal(JSON.stringify([h.rows, h.detail]), before);
  assert.ok(h.calls.rpc.every((call) => call.name === "get_order_payment_summary"));
  assert.doesNotMatch(read(path), /\.insert\(|\.update\(|\.delete\(|record_pos_payment|issue_billing_invoice|create_billing_draft|prepare_simplified_billing_draft/);
});
