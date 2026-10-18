import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (value) => JSON.parse(JSON.stringify(value));
const locales = ["it", "es", "en", "fr", "de"];
const messages = Object.fromEntries(locales.map((l) => [l, JSON.parse(read(`src/i18n/${l}/common.json`)).billing]));
const seriesFile = "20261016000300_billing_simplified_invoice_001c_series_reservation.sql";

// Real action/query/form/view execution with synthetic in-memory doubles only.
// RPC calls below are recorded, never sent to PostgreSQL or any remote service.
function billing({ role = "owner", entitled = true } = {}) {
  const calls = { auth: 0, entitlement: 0, clients: 0, rpc: [], reads: [] };
  const rows = {
    invoices: [{ id: "invoice-a", organization_id: "org-a", customer_id: "customer-a", customer_name: "Recipient",
      document_status: "issued", fiscal_document_type: "ordinary", invoice_number: "MEMORY-ONLY", series: "TEST-A",
      currency: "EUR", prices_include_tax: true, subtotal: 36, discount_total: 0, taxable_base: 33.64, tax_total: 2.36,
      total: 36, issue_date: "2026-10-16", issuer_legal_name: "Memory issuer", issuer_tax_id: "MEMORY" }],
    invoice_items: [{ id: "line-a", organization_id: "org-a", invoice_id: "invoice-a", source_order_id: "order-a",
      description: "Memory service", unit_type: "service", quantity: 4, unit_price: 9, line_subtotal: 36,
      discount_amount: 0, taxable_base: 33.64, tax_rate: 7, tax_amount: 2.36, line_total: 36, display_order: 0 }],
    organization_billing_settings: [],
    invoice_orders: [{ organization_id: "org-a", invoice_id: "invoice-a", order_id: "order-a" }],
    orders: [{ organization_id: "org-a", id: "order-a", order_number: "MEMORY-ORDER" }], payments: [],
  };
  let rpcError = null;
  const supabase = {
    async rpc(name, args) {
      assert.equal(name, "create_billing_draft");
      calls.rpc.push({ name, args });
      return { data: rpcError ? null : "memory-draft", error: rpcError };
    },
    from(table) {
      assert.ok(table in rows, table);
      const filters = [];
      const selected = () => rows[table].filter((r) => r.organization_id === "org-a"
        && filters.every(([k, values]) => values.includes(r[k])));
      const result = (single) => { calls.reads.push({ table, filters }); return { data: single ? selected()[0] ?? null : selected(), error: null }; };
      return { select() { return this; }, eq(k, v) { filters.push([k, [v]]); return this; },
        in(k, values) { filters.push([k, values]); return this; }, order() { return this; },
        async maybeSingle() { return result(true); }, async returns() { return result(false); } };
    },
  };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const m = { exports: {} };
    const localRequire = (name) => {
      if (name === "server-only") return {};
      if (name === "react/jsx-runtime") return require(name);
      if (name === "next/cache") return { revalidatePath() {} };
      if (name === "next/navigation") return { redirect(href) { throw Object.assign(Error("REDIRECT"), { href }); }, notFound() { throw Error("NOT_FOUND"); } };
      if (name === "@/lib/auth/require-role") return { requireOwnerOrManager: async () => {
        calls.auth++; if (!["owner", "manager"].includes(role)) throw Error("DENIED");
        return { membership: { organization: { id: "org-a" } } };
      } };
      if (name === "@/features/entitlements/server/resolver") return { requireEntitlement: async () => {
        calls.entitlement++; if (!entitled) throw Error("ENTITLEMENT_DENIED");
      } };
      if (name === "@/features/entitlements/feature-catalog") return { FEATURES: { billingInvoicing: "billing.invoicing" } };
      if (name === "@/lib/supabase/server") return { createSupabaseServerClient: async () => { calls.clients++; return supabase; } };
      if (name === "@/features/billing/pagination") return {};
      if (name.startsWith("@/features/billing/")) return load(`src/${name.slice(2)}.ts`);
      if (name === "@/lib/number-format") return load("src/lib/number-format.ts");
      if (name === "next-intl/server") return { getTranslations: async ({ locale }) => (key) => {
        const text = key.split(".").reduce((node, part) => node?.[part], messages[locale]);
        assert.equal(typeof text, "string", `${locale}:${key}`); return text;
      } };
      if (name === "@/components/Button") return { Button: ({ children }) => createElement("button", null, children) };
      if (name === "@/components/Card") return { Card: ({ children }) => createElement("section", null, children) };
      if (name === "@/components/billing/BillingStatusBadge") return { BillingStatusBadge: ({ label }) => createElement("span", null, label) };
      if (name === "@/components/billing/PrintInvoiceButton") return { PrintInvoiceButton: ({ label }) => createElement("button", null, label) };
      if (name === "@/i18n/navigation") return { Link: ({ children, href }) => createElement("a", { href }, children) };
      throw Error(`Unexpected import ${name}`);
    };
    const code = ts.transpileModule(read(path), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    runInNewContext(code, { module: m, exports: m.exports, require: localRequire }, { filename: path });
    modules.set(path, m.exports); return m.exports;
  }
  return { rows, calls, load, setRpcError(error) { rpcError = error; },
    submit: (form) => load("src/features/billing/server/actions.ts").createBillingDraftAction("es", "customer-a", form),
    read: () => load("src/features/billing/server/queries.ts").getBillingInvoice("es", "invoice-a"),
  };
}

function form(types = []) {
  const data = new FormData();
  for (const value of types) data.append("fiscalDocumentType", value);
  data.append("orderId", "order-a"); data.set("series", "TEST-A"); data.set("taxRate", "7");
  return data;
}

test("legacy and explicit ordinary selection call the unchanged canonical draft RPC once", async () => {
  for (const types of [[], ["ordinary"]]) {
    const ui = billing(), data = form(types);
    data.set("organization_id", "foreign");
    await assert.rejects(ui.submit(data), (e) => e.href === "/es/app/billing/memory-draft");
    assert.deepEqual(normalize(ui.calls.rpc), [{ name: "create_billing_draft", args: {
      target_notes: null, target_order_ids: ["order-a"], target_series: "TEST-A", target_tax_rate: 7,
    } }]);
  }
});

for (const values of [["simplified"], ["other"], [""], ["ORDINARY"], ["ordinary", "simplified"], ["ordinary", "ordinary"]]) {
  test(`invalid or unavailable selection cannot create even an ordinary draft: ${JSON.stringify(values)}`, async () => {
    const ui = billing();
    await assert.rejects(ui.submit(form(values)), (e) => e.href?.endsWith(`error=${values.length === 1 && values[0] === "simplified" ? "simplifiedUnavailable" : "documentType"}`));
    assert.equal(ui.calls.clients, 0); assert.equal(ui.calls.rpc.length, 0);
    assert.equal(ui.calls.auth, 1); assert.equal(ui.calls.entitlement, 1);
  });
}

test("uploaded type is rejected; amounts, profile, regime, recipient and flags cannot authorize simplified", async () => {
  const gate = billing().load("src/features/billing/document-type.ts").validateBillingDocumentSelection;
  assert.equal(gate([{ name: "ordinary" }]).allowed, false);
  for (const amount of [0, 36, 399.99, 400, 400.01, 2999.99, 3000, 3000.01, 10000]) {
    const ui = billing(), data = form(["simplified"]);
    for (const [key, value] of Object.entries({ total: amount, fiscal_territory_code: "ES-CN", declared_tax_regime_code: "TEST",
      simplified_invoicing_enabled: true, simplified_series: "TEST-S", taxId: "MEMORY", operationCategory: "laundry" })) data.set(key, String(value));
    await assert.rejects(ui.submit(data), (e) => e.href?.endsWith("error=simplifiedUnavailable"));
    assert.equal(ui.calls.clients, 0);
  }
});

for (const options of [{ role: "staff" }, { entitled: false }]) test(`authorization precedes any database access: ${JSON.stringify(options)}`, async () => {
  const ui = billing(options);
  await assert.rejects(ui.submit(form(["ordinary"])), /DENIED/);
  assert.equal(ui.calls.clients, 0);
});

test("canonical duplicate rejection is retained without retry or second draft call", async () => {
  const ui = billing(); ui.setRpcError({ message: "billing_order_already_invoiced" });
  await assert.rejects(ui.submit(form(["ordinary"])), (e) => e.href?.endsWith("error=duplicate"));
  assert.equal(ui.calls.rpc.length, 1);
});

for (const locale of locales) test(`${locale}: real form explains blocked simplified selection; real view/print use the canonical type`, async () => {
  const ui = billing();
  const Form = ui.load("src/components/billing/BillingCreateForm.tsx").BillingCreateForm;
  const html = renderToStaticMarkup(Form({ locale, hasMore: false, settings: { defaultSeries: "TEST-A", defaultTaxRate: 7 },
    orders: [{ id: "order-a", customerId: "customer-a", currency: "EUR", createdAt: "2026-10-16", customerName: "Memory", customerActive: true, total: 36 }],
    text: messages[locale].create.form }));
  assert.match(html, /name="fiscalDocumentType"/);
  assert.match(html, /<option[^>]*value="ordinary"[^>]*selected=""/);
  assert.match(html, /<option[^>]*disabled=""[^>]*value="simplified"/);
  assert.ok(html.includes(messages[locale].create.form.simplifiedUnavailable));
  assert.doesNotMatch(html, /common\.billing\./);
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  // Synthetic read-only presentation fixture, not a permitted persisted invoice.
  for (const type of ["ordinary", "simplified"]) {
    ui.rows.invoices[0].fiscal_document_type = type;
    const detail = await ui.read(), before = JSON.stringify(detail);
    for (const printMode of [false, true]) {
      const document = renderToStaticMarkup(await View({ detail, locale, printMode }));
      const title = type === "simplified" ? messages[locale].document.simplifiedInvoice : messages[locale].document.invoice;
      assert.ok(document.includes(`${title}</p>`));
      assert.ok(document.includes("MEMORY-ONLY"));
      assert.ok(document.includes("/app/orders/order-a"));
      assert.ok(document.includes("Memory service"));
      assert.equal(JSON.stringify(detail), before);
    }
  }
});

test("simplified synthetic draft permits editing but cannot offer fiscal issuance", async () => {
  const ui = billing(); ui.rows.invoices[0].fiscal_document_type = "simplified"; ui.rows.invoices[0].document_status = "draft";
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const html = renderToStaticMarkup(await View({ detail: await ui.read(), locale: "es" }));
  assert.ok(!html.includes(messages.es.actions.issue));
  assert.ok(html.includes(messages.es.actions.saveDraft));
});

for (const locale of locales) test(`${locale}: persisted-style anonymous draft reads and renders editable identity without fiscal issue controls`, async () => {
  const ui = billing();
  Object.assign(ui.rows.invoices[0], { fiscal_document_type: "simplified", document_status: "draft",
    recipient_snapshot_mode: "anonymous", customer_id: null, customer_name: null, customer_tax_id: null,
    customer_address_line1: null, customer_address_line2: null, customer_city: null,
    customer_postal_code: null, customer_country_code: null, customer_email: null });
  const detail = await ui.read();
  assert.equal(detail.invoice.customerId, null); assert.equal(detail.invoice.recipientSnapshotMode, "anonymous");
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const html = renderToStaticMarkup(await View({ detail, locale }));
  assert.match(html, /name="recipientMode"/); assert.match(html, /name="recipientName"/);
  assert.ok(html.includes(messages[locale].document.anonymousRecipient));
  assert.ok(html.includes(messages[locale].actions.saveDraft));
  assert.ok(!html.includes(messages[locale].actions.issue));
  assert.doesNotMatch(html, /common\.billing\.|WALKIN-SHARED/);
});

test("query preserves stored IGIC amounts for A/B/C, fractions, zero and historical exclusive pricing", async () => {
  for (const [subtotal, discount, base, tax, total, inclusive, quantity, unitPrice, rate] of [
    [36, 0, 33.64, 2.36, 36, true, 4, 9, 7], [3, 0, 2.80, .20, 3, true, 3, 1, 7], [36, 10, 24.30, 1.70, 26, true, 4, 9, 7],
    [13.5, 0, 12.62, .88, 13.5, true, 1.5, 9, 7], [36, 0, 36, 0, 36, true, 4, 9, 0], [36, 10, 26, 1.82, 27.82, false, 4, 9, 7],
  ]) {
    const ui = billing(); Object.assign(ui.rows.invoices[0], { subtotal, discount_total: discount, taxable_base: base, tax_total: tax, total, prices_include_tax: inclusive });
    Object.assign(ui.rows.invoice_items[0], { quantity, unit_price: unitPrice, line_subtotal: subtotal,
      discount_amount: discount, taxable_base: base, tax_rate: rate, tax_amount: tax, line_total: total });
    const before = JSON.stringify(ui.rows), detail = await ui.read();
    assert.deepEqual([detail.invoice.subtotal, detail.invoice.discountTotal, detail.invoice.taxableBase, detail.invoice.taxTotal, detail.invoice.total, detail.invoice.pricesIncludeTax], [subtotal, discount, base, tax, total, inclusive]);
    assert.equal(detail.invoice.fiscalDocumentType, "ordinary");
    assert.equal(JSON.stringify(ui.rows), before);
  }
});

test("legacy missing discriminator remains ordinary; corrupt discriminator prevents document output", async () => {
  const ui = billing(); delete ui.rows.invoices[0].fiscal_document_type;
  assert.equal((await ui.read()).invoice.fiscalDocumentType, "ordinary");
  for (const value of [null, "unknown"]) {
    ui.rows.invoices[0].fiscal_document_type = value;
    await assert.rejects(ui.read(), /billing_invalid_fiscal_document_type/);
  }
});

test("foreign-tenant invoice is inaccessible in the real read query", async () => {
  const ui = billing(); ui.rows.invoices[0].organization_id = "org-b";
  await assert.rejects(ui.read(), /NOT_FOUND/);
  const call = ui.calls.reads.find((c) => c.table === "invoices");
  assert.ok(call.filters.some(([k, v]) => k === "organization_id" && v[0] === "org-a"));
});

test("series migration is additive only: no assigned series/counter and neither guard relaxed", () => {
  const names = readdirSync(new URL("../supabase/migrations/", import.meta.url));
  assert.equal(names.filter((n) => n.startsWith("20261016000300_")).length, 1);
  const sql = read(`supabase/migrations/${seriesFile}`).replace(/--[^\n]*/g, "").trim();
  assert.equal(sql.split(";").map((s) => s.trim()).filter(Boolean).length, 3);
  assert.match(sql, /add column simplified_series text,/);
  assert.match(sql, /simplified_series is null\s+or simplified_series ~ '\^\[A-Z0-9-\]\{1,12\}\$'/);
  assert.doesNotMatch(sql, /\b(?:default|insert|update|delete|grant|revoke|drop|function|policy|invoices|counter)\b/i);
  // 001D can now read the series column already deployed by 001C. This remains
  // a declaration only; neither the original migration nor either guard changes.
  assert.match(read("src/features/billing/server/queries.ts"), /simplifiedSeries: settings\?\.simplified_series \?\? null/);
  for (const [path, sha] of [
    ["20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql", "74f904597f2e802e684496fd7bd0724410108555763283a332debcc8db5e307b"],
    ["20261016000200_billing_fiscal_profile_001_minimal_configuration.sql", "d0abe9affbd95229233938ba87350bf9bfc352cec098ac569b339c72f4bfe8ab"],
  ]) assert.equal(createHash("sha256").update(read(`supabase/migrations/${path}`)).digest("hex"), sha);
});
