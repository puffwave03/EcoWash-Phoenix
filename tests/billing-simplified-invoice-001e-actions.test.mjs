import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Real canonical action + real preparation + real assessment. In-memory read
// doubles only: no network, DB mutations, invoice issuance or PostgreSQL proof.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const otherOrderId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const plain = (value) => JSON.parse(JSON.stringify(value));

function harness({ role = "owner", entitled = true, errorTable, unavailableTable, lostTable, loseCreateResponse = false } = {}) {
  const draftId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
  const calls = { auth: 0, entitlement: 0, clients: 0, reads: [], rpc: [], preparation: [], facts: [], writes: 0 };
  const rows = {
    orders: [{ id: orderId, organization_id: "tenant-a", customer_id: "WALKIN-SHARED", currency: "EUR",
      total: "7.00", is_active: true, production_status: "ready", completed_at: "2026-10-17" }],
    organization_billing_settings: [{ organization_id: "tenant-a", fiscal_territory_code: "ES-CN",
      declared_tax_regime_code: "IGIC-GENERAL", simplified_invoicing_enabled: false, simplified_series: "TEST-S", default_tax_rate: 7 }],
    order_items: [{ id: "item-a", organization_id: "tenant-a", order_id: orderId, is_active: true }],
    invoice_orders: [], invoices: [], invoice_items: [], payments: [],
    billing_invoice_payment_links: [], billing_advance_event_declarations: [],
  };
  const readError = Error("READ_FAILURE"), lostError = Error("RESPONSE_LOST");
  const supabase = {
    from(table) {
      assert.ok(table in rows, `Unexpected table ${table}`);
      const call = { table, filters: [] }; calls.reads.push(call);
      function result(single) {
        if (table === lostTable) throw lostError;
        if (table === errorTable) return { data: null, error: readError };
        if (table === unavailableTable) return { data: null, error: null };
        const selected = rows[table].filter((row) => call.filters.every(([key, values]) => values.includes(row[key])));
        return { data: single ? selected[0] ?? null : selected, error: null };
      }
      return {
        select() { return this; }, eq(key, value) { call.filters.push([key, [value]]); return this; },
        in(key, values) { call.filters.push([key, values]); return this; }, order() { return this; },
        async maybeSingle() { return result(true); }, async returns() { return result(false); },
        insert() { calls.writes++; throw Error("WRITE_FORBIDDEN"); },
        update() { calls.writes++; throw Error("WRITE_FORBIDDEN"); },
        delete() { calls.writes++; throw Error("WRITE_FORBIDDEN"); },
      };
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      if (name === "create_billing_draft") {
        if (args.target_fiscal_document_type !== "simplified") return { data: "canonical-draft", error: null };
        if (rows.organization_billing_settings.length === 0) return { data: null, error: { message: "billing_simplified_series_required" } };
        // Synthetic DB arbiter. SQL behavior is checked separately, not proven
        // by this double. Exactly one active document wins the simulated race.
        if (rows.invoice_orders.some((link) => link.is_active)) return { data: null, error: { message: "billing_order_already_invoiced" } };
        rows.invoices.push({ id: draftId, organization_id: "tenant-a", document_status: "draft", fiscal_document_type: "simplified",
          series: "TEST-S", invoice_number: null, sequence_number: null, issued_at: null, created_at: "2026-10-17",
          issue_date: "2026-10-17", currency: "EUR", subtotal: 7, total: 7, taxable_base: 6.54, tax_total: 0.46,
          discount_total: 0, prices_include_tax: true, ...plain(args.target_recipient_snapshot),
          customer_id: args.target_recipient_snapshot.recipient_snapshot_mode === "identified" && rows.orders[0].customer_id !== "WALKIN-SHARED" ? rows.orders[0].customer_id : null });
        rows.invoice_orders.push({ organization_id: "tenant-a", order_id: orderId, invoice_id: draftId, is_active: true, billing_link_role: "final" });
        rows.invoice_items.push({ id: "snapshot-item", organization_id: "tenant-a", invoice_id: draftId, source_order_id: orderId,
          description: "Synthetic laundry", unit_type: "service", quantity: 1, unit_price: 7,
          line_subtotal: 7, discount_amount: 0, taxable_base: 6.54, tax_amount: 0.46, tax_rate: 7, line_total: 7, display_order: 1 });
        if (loseCreateResponse) throw lostError;
        return { data: draftId, error: null };
      }
      const invoice = rows.invoices.find((row) => row.id === args.target_invoice_id && row.organization_id === "tenant-a");
      if (name === "issue_billing_invoice") return { data: null, error: { message: "billing_simplified_issuance_disabled" } };
      assert.equal(name, "update_billing_draft");
      if (!invoice || invoice.document_status !== "draft" || (args.target_recipient_snapshot && invoice.fiscal_document_type !== "simplified")) {
        return { data: null, error: { message: "billing_invalid_draft" } };
      }
      if (args.target_recipient_snapshot) Object.assign(invoice, plain(args.target_recipient_snapshot), {
        customer_id: args.target_recipient_snapshot.recipient_snapshot_mode === "identified" && rows.orders[0].customer_id !== "WALKIN-SHARED" ? rows.orders[0].customer_id : null,
      });
      return { data: null, error: null };
    },
  };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const loaded = { exports: {} };
    const localRequire = (name) => {
      if (name === "server-only") return {};
      if (name === "next/cache") return { revalidatePath() {} };
      if (name === "next/navigation") return {
        redirect(href) { throw Object.assign(Error("REDIRECT"), { href }); }, notFound() { throw Error("NOT_FOUND"); },
      };
      if (name === "@/lib/auth/require-role") return {
        requireOwnerOrManager: async () => {
          calls.auth++; if (!["owner", "manager"].includes(role)) throw Error("ROLE_DENIED");
          return { membership: { role, organization: { id: "tenant-a" } } };
        },
      };
      if (name === "@/features/entitlements/feature-catalog") return { FEATURES: { billingInvoicing: "billing.invoicing" } };
      if (name === "@/features/entitlements/server/resolver") return { requireEntitlement: async () => {
        calls.entitlement++; if (!entitled) throw Error("ENTITLEMENT_DENIED");
      } };
      if (name === "@/lib/supabase/server") return { createSupabaseServerClient: async () => { calls.clients++; return supabase; } };
      if (name.startsWith("@/features/billing/")) return load(`src/${name.slice(2)}.ts`);
      throw Error(`Unexpected module ${name}`);
    };
    runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { module: loaded, exports: loaded.exports, require: localRequire });
    if (path.endsWith("/server/simplified-preparation.ts")) {
      const prepare = loaded.exports.prepareSimplifiedBillingRequest;
      loaded.exports.prepareSimplifiedBillingRequest = async (...args) => {
        const result = await prepare(...args); calls.preparation.push(result); return result;
      };
    }
    if (path.endsWith("/simplified-operation.ts")) {
      const assess = loaded.exports.assessSimplifiedOperation;
      loaded.exports.assessSimplifiedOperation = (...args) => { calls.facts.push(args[0]); return assess(...args); };
    }
    modules.set(path, loaded.exports); return loaded.exports;
  }
  return { calls, rows, readError, lostError, draftId,
    submit: (form) => load("src/features/billing/server/actions.ts").createBillingDraftAction("es", "untrusted-customer", form),
    update: (form, id = draftId) => load("src/features/billing/server/actions.ts").updateBillingDraftAction("es", id, null, form),
    readInvoice: (id = draftId) => load("src/features/billing/server/queries.ts").getBillingInvoice("es", id),
    issue: () => load("src/features/billing/server/actions.ts").issueBillingInvoiceAction("es", draftId, null),
  };
}

function request(type = "simplified") {
  const form = new FormData();
  if (type !== undefined) form.set("fiscalDocumentType", type);
  form.set("orderId", orderId); form.set("recipientMode", "anonymous");
  form.set("series", "TEST-A"); form.set("taxRate", "7");
  return form;
}
const blocked = (e) => e.href?.endsWith("error=simplifiedUnavailable");

function linkedFinalWithAdvances(ui, count, status = "draft") {
  // Put advances first: selecting the first active document is incorrect.
  for (let n = 0; n < count; n++) {
    const id = `advance-${n}`;
    ui.rows.invoice_orders.push({ organization_id: "tenant-a", order_id: orderId,
      invoice_id: id, is_active: true, billing_link_role: "advance" });
    ui.rows.invoices.push({ organization_id: "tenant-a", id, document_status: "issued",
      fiscal_document_type: "simplified", billing_event_kind: "advance" });
  }
  ui.rows.invoice_orders.push({ organization_id: "tenant-a", order_id: orderId,
    invoice_id: ui.draftId, is_active: true, billing_link_role: "final" });
  ui.rows.invoices.push({ organization_id: "tenant-a", id: ui.draftId, document_status: status,
    fiscal_document_type: "simplified", billing_event_kind: "service" });
}

for (const count of [1, 3]) for (const status of ["draft", "issued"]) {
  test(`C2 reopens canonical ${status} with ${count} advances, without writes`, async () => {
    const ui = harness(); linkedFinalWithAdvances(ui, count, status);
    const before = JSON.stringify(ui.rows);
    for (let n = 0; n < 2; n++) await assert.rejects(ui.submit(request()),
      (e) => e.href === `/es/app/billing/${ui.draftId}`);
    assert.equal(ui.calls.rpc.length, 0);
    assert.equal(ui.calls.writes, 0);
    assert.equal(JSON.stringify(ui.rows), before);
    for (const read of ui.calls.reads) assert.ok(read.filters.some(([key, values]) =>
      key === "organization_id" && values[0] === "tenant-a"));
  });
}

test("C2 rejects duplicate finals, orphan advances and inconsistent advance history", async () => {
  const corruptions = [
    ui => ui.rows.invoice_orders.push({ ...ui.rows.invoice_orders.at(-1) }),
    ui => ui.rows.invoice_orders.pop(),
    ui => { ui.rows.invoices[0].document_status = "draft"; },
    ui => { ui.rows.invoices[0].document_status = "cancelled"; },
    ui => { ui.rows.invoices[0].fiscal_document_type = "ordinary"; },
    ui => { ui.rows.invoices[0].billing_event_kind = "service"; },
    ui => { ui.rows.invoice_orders[0].is_active = false; },
    ui => { ui.rows.invoice_orders[0].billing_link_role = "unknown"; },
    ui => { ui.rows.invoices[0].organization_id = "tenant-b"; },
  ];
  for (const corrupt of corruptions) {
    const ui = harness(); linkedFinalWithAdvances(ui, 1); corrupt(ui);
    await assert.rejects(ui.submit(request()), /billing_order_entry_invalid_document/);
    assert.equal(ui.calls.rpc.length, 0);
    assert.equal(ui.calls.writes, 0);
  }
});

test("canonical action transfers anonymous snapshot through the six-argument draft contract", async () => {
  const ui = harness();
  await assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  assert.equal(ui.calls.auth, 1); assert.equal(ui.calls.entitlement, 1);
  assert.equal(ui.calls.preparation.length, 1); assert.equal(ui.calls.facts.length, 1);
  const prepared = ui.calls.preparation[0];
  assert.equal(prepared.kind, "assessed");
  assert.equal(prepared.assessment.recipientSnapshot.recipient_snapshot_mode, "anonymous");
  assert.equal(prepared.assessment.recipientSnapshot.customer_id, null);
  assert.equal(prepared.assessment.recipientSnapshot.customer_name, null);
  assert.equal(prepared.assessment.issuanceAvailable, false);
  assert.equal(ui.calls.facts[0].totalCents, 700);
  assert.equal(ui.calls.facts[0].itemCount, 1);
  assert.equal(ui.calls.rpc.length, 1); assert.equal(ui.calls.writes, 0);
  const payload = plain(ui.calls.rpc[0].args);
  assert.equal(payload.target_fiscal_document_type, "simplified");
  assert.equal(payload.target_recipient_snapshot.customer_id, null);
  assert.deepEqual(payload.target_order_ids, [orderId]);
  assert.equal(payload.target_series, null); assert.equal(payload.target_tax_rate, null);
  assert.equal(ui.rows.invoices[0].invoice_number, null); assert.equal(ui.rows.invoices[0].document_status, "draft");
});

test("identified occasional and registered-order requests keep explicit per-document identity only", async () => {
  for (const sourceCustomer of ["WALKIN-SHARED", "registered-a"]) {
    const ui = harness({ role: "manager" }), form = request();
    ui.rows.orders[0].customer_id = sourceCustomer;
    form.set("recipientMode", "identified");
    for (const [key, value] of Object.entries({ recipientName: "Explicit recipient", recipientTaxId: "TEST-NIF",
      recipientAddressLine1: "Test address", recipientCity: "Test city", recipientPostalCode: "00000", recipientCountryCode: "es" })) form.set(key, value);
    await assert.rejects(ui.submit(form), (e) => e.href === `/es/app/billing/${ui.draftId}`);
    const snapshot = ui.calls.preparation[0].assessment.recipientSnapshot;
    assert.equal(snapshot.customer_name, "Explicit recipient"); assert.equal(snapshot.customer_tax_id, "TEST-NIF");
    assert.equal(snapshot.customer_id, null); assert.equal(snapshot.customer_country_code, "ES");
    assert.equal(ui.rows.invoices[0].customer_id, sourceCustomer === "WALKIN-SHARED" ? null : sourceCustomer);
    assert.equal(ui.calls.rpc.length, 1); assert.equal(ui.calls.writes, 0);
    assert.ok(!ui.calls.reads.some((r) => r.table === "customers"));
  }
});

test("canonical action consumes invalid recipient result instead of storing partial identity", async () => {
  for (const mode of ["identified", "invalid", null]) {
    const ui = harness(), form = request();
    if (mode === null) form.delete("recipientMode"); else form.set("recipientMode", mode);
    await assert.rejects(ui.submit(form), (e) => e.href?.endsWith("error=customer"));
    assert.equal(ui.calls.preparation[0].assessment.recipientSnapshot, null);
    assert.equal(ui.calls.rpc.length, 0);
  }
  const ui = harness(), form = request(); form.append("recipientTaxId", "invented");
  await assert.rejects(ui.submit(form), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  assert.equal(ui.rows.invoices[0].customer_tax_id, null);
  assert.equal(ui.calls.writes, 0);
});

test("tenant/role/profile/date/amount/payment flags submitted by client cannot replace server facts", async () => {
  const ui = harness(), form = request();
  ui.rows.organization_billing_settings[0].declared_tax_regime_code = "OTHER";
  ui.rows.payments.push({ organization_id: "tenant-a", order_id: orderId, id: "actual-payment", status: "confirmed" });
  for (const [key, value] of Object.entries({ organization_id: "tenant-b", customerId: "foreign", role: "owner",
    declared_tax_regime_code: "IGIC-GENERAL", simplified_invoicing_enabled: "true", fiscalContextVerified: "true",
    fiscalDate: "2026-10-17", fiscalDateVerified: "true", total: "1", paymentContext: "no_advance", operationScope: "laundry_dry_cleaning" })) form.set(key, value);
  await assert.rejects(ui.submit(form), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  const facts = ui.calls.facts[0];
  assert.equal(facts.organizationId, "tenant-a"); assert.equal(facts.orderOrganizationId, "tenant-a");
  assert.equal(facts.regime, "OTHER"); assert.equal(facts.totalCents, 700);
  assert.equal(facts.fiscalDate, null); assert.equal(facts.fiscalDateVerified, false);
  assert.equal(facts.fiscalContextVerified, false); assert.equal(facts.paymentContext, "unverified");
  assert.equal(ui.calls.rpc.length, 1);
  assert.ok(!("organization_id" in ui.calls.rpc[0].args));
  assert.equal(ui.rows.invoices[0].document_status, "draft");
  for (const read of ui.calls.reads) assert.ok(read.filters.some(([k, values]) => k === "organization_id" && values[0] === "tenant-a"));
});

test("missing profile or a changed enable flag never enables a simplified write", async () => {
  for (const enabled of [null, true]) {
    const ui = harness();
    if (enabled === null) ui.rows.organization_billing_settings = [];
    else ui.rows.organization_billing_settings[0].simplified_invoicing_enabled = enabled;
    await assert.rejects(ui.submit(request()), enabled === null ? blocked : (e) => e.href === `/es/app/billing/${ui.draftId}`);
    assert.equal(ui.calls.preparation[0].assessment.issuanceAvailable, false);
    assert.equal(ui.calls.rpc.length, 1); assert.equal(ui.calls.writes, 0);
    if (enabled !== null) assert.equal(ui.rows.invoices[0].invoice_number, null);
  }
});

test("EUR7 order keeps canonical payments while persisting an unnumbered preparation only", async () => {
  const ui = harness();
  ui.rows.payments.push(...["2.00", "5.00"].map((amount, index) => ({
    organization_id: "tenant-a", order_id: orderId, id: `payment-${index}`, status: "confirmed", amount,
  })));
  const before = JSON.stringify(ui.rows.payments);
  await assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  assert.equal(ui.calls.facts[0].totalCents, 700);
  assert.equal(ui.calls.facts[0].paymentContext, "unverified");
  assert.ok(ui.calls.preparation[0].assessment.reasons.includes("advance_or_payment_workflow_required"));
  assert.equal(JSON.stringify(ui.rows.payments), before);
  assert.equal(ui.rows.invoices[0].invoice_number, null);
  assert.equal(ui.calls.rpc.length, 1); assert.equal(ui.calls.writes, 0);
});

test("foreign order stops before dependent reads and never uses submitted customer context", async () => {
  const ui = harness(); ui.rows.orders[0].organization_id = "tenant-b";
  await assert.rejects(ui.submit(request()), /NOT_FOUND/);
  assert.deepEqual(ui.calls.reads.map((r) => r.table), ["orders"]);
  assert.equal(ui.calls.rpc.length, 0); assert.equal(ui.calls.writes, 0);
});

test("authorization and entitlement precede preparation/database reads", async () => {
  for (const options of [{ role: "staff" }, { entitled: false }]) {
    const ui = harness(options);
    await assert.rejects(ui.submit(request()), /DENIED/);
    assert.equal(ui.calls.clients, 0); assert.equal(ui.calls.preparation.length, 0);
  }
});

test("invalid/ambiguous types and order IDs never invoke RPC or read unrelated orders", async () => {
  for (const invalidType of ["other", "", "ORDINARY"]) {
    const ui = harness(), form = request(invalidType);
    await assert.rejects(ui.submit(form), (e) => e.href?.endsWith("error=documentType"));
    assert.equal(ui.calls.clients, 0);
  }
  for (const values of [[orderId, otherOrderId], [orderId, orderId], ["invalid"], []]) {
    const ui = harness(), form = request(); form.delete("orderId");
    for (const id of values) form.append("orderId", id);
    await assert.rejects(ui.submit(form), blocked);
    assert.equal(ui.calls.clients, 0); assert.equal(ui.calls.rpc.length, 0);
  }
});

test("active draft and issued invoice are reopened idempotently without a second preparation/write", async () => {
  for (const documentStatus of ["draft", "issued"]) {
    const ui = harness();
    ui.rows.invoice_orders.push({ organization_id: "tenant-a", order_id: orderId, invoice_id: "existing-invoice", is_active: true, billing_link_role: "final" });
    ui.rows.invoices.push({ organization_id: "tenant-a", id: "existing-invoice", document_status: documentStatus });
    const before = JSON.stringify(ui.rows);
    for (let i = 0; i < 2; i++) await assert.rejects(ui.submit(request()), (e) => e.href === "/es/app/billing/existing-invoice");
    assert.ok(ui.calls.preparation.every((p) => p.kind === "existing_document"));
    assert.equal(ui.calls.rpc.length, 0); assert.equal(ui.calls.writes, 0);
    assert.equal(JSON.stringify(ui.rows), before);
  }
});

test("cancelled inactive history remains while canonical rules permit a new unnumbered draft", async () => {
  const ui = harness();
  ui.rows.invoice_orders.push({ organization_id: "tenant-a", order_id: orderId, invoice_id: "cancelled-invoice", is_active: false, billing_link_role: "final" });
  ui.rows.invoices.push({ organization_id: "tenant-a", id: "cancelled-invoice", document_status: "cancelled" });
  await assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  assert.equal(ui.calls.facts[0].existingFiscalDocument, "cancelled");
  assert.equal(ui.calls.rpc.length, 1);
  assert.equal(ui.rows.invoices[0].document_status, "cancelled");
  assert.equal(ui.rows.invoices[1].document_status, "draft");
});

test("missing/foreign linked invoice is a read inconsistency, never a successful empty history", async () => {
  const ui = harness();
  ui.rows.invoice_orders.push({ organization_id: "tenant-a", order_id: orderId, invoice_id: "missing-invoice", is_active: true, billing_link_role: "final" });
  ui.rows.invoices.push({ organization_id: "tenant-b", id: "missing-invoice", document_status: "issued" });
  await assert.rejects(ui.submit(request()), /billing_order_entry_invalid_document/);
  assert.equal(ui.calls.rpc.length, 0);
});

test("read errors and unavailable arrays propagate without a fallback invoice or automatic retry", async () => {
  for (const table of ["orders", "organization_billing_settings", "order_items", "invoice_orders", "payments"]) {
    const ui = harness({ errorTable: table });
    await assert.rejects(ui.submit(request()), (e) => e === ui.readError);
    assert.equal(ui.calls.reads.filter((r) => r.table === table).length, 1);
    assert.equal(ui.calls.rpc.length, 0);
  }
  for (const table of ["order_items", "invoice_orders", "payments"]) {
    const ui = harness({ unavailableTable: table });
    await assert.rejects(ui.submit(request()), /billing_simplified_invalid_read_response/);
    assert.equal(ui.calls.rpc.length, 0);
  }
  const ui = harness({ lostTable: "orders" });
  await assert.rejects(ui.submit(request()), (e) => e === ui.lostError);
  assert.equal(ui.calls.reads.length, 1); assert.equal(ui.calls.rpc.length, 0);
});

test("cancelled/empty orders and invalid canonical amounts are consumed as blockers by the action", async () => {
  for (const patch of [{ production_status: "cancelled" }, { total: "7.001" }, { total: -7 }]) {
    const ui = harness(); Object.assign(ui.rows.orders[0], patch);
    await assert.rejects(ui.submit(request()), (e) => e.href?.endsWith("error=orders"));
    assert.equal(ui.calls.rpc.length, 0);
  }
  const ui = harness(); ui.rows.order_items = [];
  await assert.rejects(ui.submit(request()), (e) => e.href?.endsWith("error=orders"));
  assert.equal(ui.calls.rpc.length, 0);
});

test("concurrent requests recover the simulated unique-index winner without retrying writes", async () => {
  const ui = harness();
  await Promise.all(Array.from({ length: 4 }, async () => assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`)));
  assert.equal(ui.calls.rpc.length, 4); assert.equal(ui.calls.writes, 0);
  assert.equal(ui.rows.invoices.length, 1); assert.equal(ui.rows.invoice_orders.length, 1);
  assert.equal(ui.rows.invoices[0].invoice_number, null);
});

 test("lost create response is recovered by manual re-entry without allocating another draft", async () => {
  const ui = harness({ loseCreateResponse: true });
  await assert.rejects(ui.submit(request()), (e) => e === ui.lostError);
  assert.equal(ui.rows.invoices.length, 1);
  await assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  assert.equal(ui.calls.rpc.length, 1); assert.equal(ui.rows.invoices.length, 1);
});

test("ordinary selection retains exact canonical RPC/payload and bypasses simplified preparation", async () => {
  for (const explicit of [true, false]) {
    const ui = harness(), form = request("ordinary");
    if (!explicit) form.delete("fiscalDocumentType");
    form.set("notes", "Canonical note");
    await assert.rejects(ui.submit(form), (e) => e.href === "/es/app/billing/canonical-draft");
    assert.deepEqual(plain(ui.calls.rpc), [{ name: "create_billing_draft", args: {
      target_notes: "Canonical note", target_order_ids: [orderId], target_series: "TEST-A", target_tax_rate: 7,
    } }]);
    assert.equal(ui.calls.preparation.length, 0); assert.equal(ui.calls.reads.length, 0);
  }
});

test("real read query restores a persisted-style anonymous draft, its type and original amounts", async () => {
  const ui = harness();
  await assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  const detail = await ui.readInvoice();
  assert.equal(detail.invoice.customerId, null); assert.equal(detail.invoice.customerName, null);
  assert.equal(detail.invoice.recipientSnapshotMode, "anonymous");
  assert.equal(detail.invoice.fiscalDocumentType, "simplified");
  assert.equal(detail.invoice.documentStatus, "draft"); assert.equal(detail.invoice.invoiceNumber, null);
  assert.deepEqual(plain(detail.invoice.orderIds), [orderId]);
  assert.equal(detail.invoice.total, 7); assert.equal(detail.invoice.taxableBase, 6.54);
  assert.equal(detail.items.length, 1); assert.equal(detail.items[0].unitPrice, 7);
});

test("recipient edit transfers an explicit snapshot through canonical update, then reads the same draft", async () => {
  const ui = harness();
  await assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  const form = request(); form.set("recipientMode", "identified");
  for (const [key, value] of Object.entries({ recipientName: "Explicit changed recipient", recipientTaxId: "TEST-EDIT",
    recipientAddressLine1: "Explicit address", recipientCity: "Test city", recipientPostalCode: "00000", recipientCountryCode: "es" })) form.set(key, value);
  form.set("issueDate", "2026-10-17");
  await assert.rejects(ui.update(form), (e) => e.href === `/es/app/billing/${ui.draftId}?saved=draft`);
  const payload = plain(ui.calls.rpc.at(-1));
  assert.equal(payload.name, "update_billing_draft");
  assert.equal(payload.args.target_invoice_id, ui.draftId);
  assert.equal(payload.args.target_recipient_snapshot.customer_id, null);
  assert.equal(payload.args.target_recipient_snapshot.customer_name, "Explicit changed recipient");
  assert.ok(!("organization_id" in payload.args));
  const detail = await ui.readInvoice();
  assert.equal(detail.invoice.id, ui.draftId); assert.equal(detail.invoice.recipientSnapshotMode, "identified");
  assert.equal(detail.invoice.customerName, "Explicit changed recipient");
  assert.equal(detail.invoice.total, 7); assert.equal(detail.invoice.invoiceNumber, null);
  assert.equal(ui.rows.invoice_orders.length, 1);
  const anonymous = request(); anonymous.set("issueDate", "2026-10-17");
  await assert.rejects(ui.update(anonymous), (e) => e.href?.endsWith("saved=draft"));
  assert.equal((await ui.readInvoice()).invoice.customerName, null);
});

test("invalid recipient edit does not reach RPC and ordinary edits retain their six-argument payload", async () => {
  const ui = harness(), form = request(); form.set("recipientMode", "identified");
  await assert.rejects(ui.update(form), (e) => e.href?.endsWith("error=customer"));
  assert.equal(ui.calls.rpc.length, 0);
  ui.rows.invoices.push({ id: ui.draftId, organization_id: "tenant-a", document_status: "draft", fiscal_document_type: "ordinary" });
  form.delete("recipientMode"); form.set("issueDate", "2026-10-17"); form.set("notes", "Existing edit");
  await assert.rejects(ui.update(form), (e) => e.href?.endsWith("saved=draft"));
  assert.deepEqual(plain(ui.calls.rpc[0]), { name: "update_billing_draft", args: {
    target_due_date: null, target_invoice_id: ui.draftId, target_issue_date: "2026-10-17",
    target_notes: "Existing edit", target_series: "TEST-A", target_tax_rate: 7,
  } });
});

test("issued/foreign edits and simplified issue rejection propagate without allocating numbers", async () => {
  const ui = harness();
  await assert.rejects(ui.submit(request()), (e) => e.href === `/es/app/billing/${ui.draftId}`);
  await assert.rejects(ui.issue(), (e) => e.href?.endsWith("error=simplifiedUnavailable"));
  assert.equal(ui.rows.invoices[0].invoice_number, null);
  ui.rows.invoices[0].document_status = "issued";
  const before = JSON.stringify(ui.rows);
  await assert.rejects(ui.update(request()), (e) => e.href?.endsWith("error=generic"));
  assert.equal(JSON.stringify(ui.rows), before);
  ui.rows.invoices[0].document_status = "draft"; ui.rows.invoices[0].organization_id = "tenant-b";
  await assert.rejects(ui.readInvoice(), /NOT_FOUND/);
  await assert.rejects(ui.update(request()), (e) => e.href?.endsWith("error=generic"));
  // Rejection above is a double; live PostgreSQL enforcement remains untested.
});
