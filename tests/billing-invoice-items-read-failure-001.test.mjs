import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const queryPath = "src/features/billing/server/queries.ts";
const detailPath = "src/app/[locale]/app/(dashboard)/billing/[invoiceId]/page.tsx";
const printPath = "src/app/[locale]/app/(dashboard)/billing/[invoiceId]/print/page.tsx";
const readFailure = { code: "XX000", message: "Simulated database read failure" };
const normalize = (value) => JSON.parse(JSON.stringify(value));

// Real query and page functions, with in-memory read-only Supabase/auth doubles.
// Unknown imports and every unsupported operation fail; no live client is loaded.
function billing({ role = "owner" } = {}) {
  const notFound = Error("NEXT_NOT_FOUND");
  const rows = {
    invoices: [{ id: "invoice-a", organization_id: "org-a", customer_id: "customer-a", customer_name: "A",
      invoice_number: "MEMORY-ONLY", series: "A", sequence_number: 1, document_status: "issued",
      issue_date: "2026-10-16", due_date: null, currency: "EUR", subtotal: "10.70", discount_total: "0.00",
      taxable_base: "10.00", tax_total: "0.70", total: "10.70", prices_include_tax: true,
      issuer_legal_name: "Memory issuer", issuer_tax_id: "MEMORY", notes: "Original note" }],
    invoice_items: [{ id: "line-a", organization_id: "org-a", invoice_id: "invoice-a", source_order_id: "order-a",
      description: "Original service", unit_type: "piece", quantity: "1", unit_price: "10.70",
      line_subtotal: "10.70", discount_amount: "0.00", taxable_base: "10.00", tax_rate: "7.0000",
      tax_amount: "0.70", line_total: "10.70", display_order: 0 }],
    invoice_orders: [{ organization_id: "org-a", invoice_id: "invoice-a", order_id: "order-a" }],
    orders: [{ organization_id: "org-a", id: "order-a", order_number: "MEMORY-ONLY" }],
    payments: [{ id: "payment-a", organization_id: "org-a", order_id: "order-a", amount: "5.00",
      method: "cash", status: "confirmed", paid_at: "2026-10-16T12:00:00Z" }],
  };
  const calls = { reads: [], auth: [], entitlement: [] };
  const overrides = new Map();
  let authorizationError = null, entitlementError = null;
  const supabase = { from(table) {
    assert.ok(table in rows, `Unexpected table: ${table}`);
    const filters = [];
    const read = async (single) => {
      calls.reads.push({ table, filters: [...filters] });
      if (overrides.has(table)) {
        const result = overrides.get(table);
        if (result instanceof Error) throw result;
        return result;
      }
      // Simulate existing RLS in addition to explicit query filters.
      const selected = rows[table].filter((row) => row.organization_id === "org-a"
        && filters.every(([column, values]) => values.includes(row[column])));
      return { data: single ? selected[0] ?? null : selected, error: null };
    };
    return { select() { return this; }, eq(column, value) { filters.push([column, [value]]); return this; },
      in(column, values) { filters.push([column, values]); return this; }, order() { return this; },
      maybeSingle: () => read(true), returns: () => read(false) };
  } };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const compiledModule = { exports: {} };
    const localRequire = (name) => {
      if (name === "server-only") return {};
      if (name === "react/jsx-runtime") return require(name);
      if (name === "next/navigation") return { notFound() { throw notFound; } };
      if (name === "@/lib/auth/require-role") return { requireOwnerOrManager: async (locale) => {
        calls.auth.push(locale);
        if (authorizationError) throw authorizationError;
        assert.ok(["owner", "manager"].includes(role));
        return { membership: { role, organization: { id: "org-a" } } };
      } };
      if (name === "@/features/entitlements/server/resolver") return { requireEntitlement: async (...args) => {
        calls.entitlement.push(args);
        if (entitlementError) throw entitlementError;
      } };
      if (name === "@/features/entitlements/feature-catalog") return { FEATURES: { billingInvoicing: "billing.invoicing" } };
      if (name === "@/lib/supabase/server") return { createSupabaseServerClient: async () => supabase };
      if (name === "@/features/billing/server/queries") return load(queryPath);
      if (name === "@/features/billing/types" || name === "@/features/billing/pagination") return {};
      if (name === "@/components/billing/BillingInvoiceView") return { BillingInvoiceView: "invoice-view" };
      if (name === "@/components/sales-documents/SalesDocumentViewTracker") return { SalesDocumentViewTracker: "view-tracker" };
      if (name === "@/features/sales-documents/server/actions") return { recordSalesDocumentEvent() { throw Error("Unexpected history write"); } };
      throw Error(`Unexpected import: ${name}`);
    };
    const code = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: localRequire }, { filename: path });
    modules.set(path, compiledModule.exports);
    return compiledModule.exports;
  }
  return { rows, calls, overrides, notFound,
    read: (id = "invoice-a") => load(queryPath).getBillingInvoice("es", id),
    page: (path, id = "invoice-a") => load(path).default({ params: Promise.resolve({ invoiceId: id, locale: "es" }) }),
    denyAuthorization(error) { authorizationError = error; },
    denyEntitlement(error) { entitlementError = error; },
  };
}
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];

for (const partialData of [false, true]) test(`item read error rejects instead of returning empty/partial lines; partial: ${partialData}`, async () => {
  const ui = billing();
  ui.overrides.set("invoice_items", { data: partialData ? ui.rows.invoice_items : null, error: readFailure });
  const before = JSON.stringify(ui.rows);
  await assert.rejects(ui.read(), (error) => error === readFailure);
  assert.equal(ui.calls.reads.filter(({ table }) => table === "invoice_items").length, 1);
  assert.equal(JSON.stringify(ui.rows), before);
});

for (const path of [detailPath, printPath]) test(`${path.includes("/print/") ? "print" : "detail"} route does not return a document when lines fail, then recovers on a new read`, async () => {
  const ui = billing();
  const before = JSON.stringify(ui.rows);
  ui.overrides.set("invoice_items", { data: null, error: readFailure });
  await assert.rejects(ui.page(path), (error) => error === readFailure);
  assert.equal(ui.calls.reads.filter(({ table }) => table === "invoice_items").length, 1);
  ui.overrides.delete("invoice_items");
  const tree = await ui.page(path);
  const view = nodes(tree).find((node) => node.type === "invoice-view");
  assert.ok(view);
  assert.equal(Boolean(view.props.printMode), path === printPath);
  assert.equal(view.props.detail.items[0].description, "Original service");
  assert.equal(view.props.detail.invoice.invoiceNumber, "MEMORY-ONLY");
  assert.equal(ui.calls.reads.filter(({ table }) => table === "invoice_items").length, 2);
  assert.equal(JSON.stringify(ui.rows), before);
});

for (const role of ["owner", "manager"]) test(`normal authorized ${role} read preserves original financial values and tenant filters`, async () => {
  const ui = billing({ role });
  const before = JSON.stringify(ui.rows);
  const detail = await ui.read();
  assert.deepEqual(normalize(detail.items), [{ id: "line-a", sourceOrderId: "order-a", description: "Original service",
    quantity: 1, unitType: "piece", unitPrice: 10.7, lineSubtotal: 10.7, discountAmount: 0,
    taxableBase: 10, taxRate: 7, taxAmount: .7, lineTotal: 10.7, displayOrder: 0 }]);
  assert.equal(detail.invoice.documentStatus, "issued");
  assert.equal(detail.invoice.total, 10.7);
  assert.equal(detail.invoice.paidTotal, 5);
  assert.equal(detail.invoice.outstanding, 5.7);
  assert.equal(detail.invoice.pricesIncludeTax, true);
  assert.deepEqual(ui.calls.auth, ["es"]);
  assert.deepEqual(ui.calls.entitlement, [["es", "billing.invoicing"]]);
  for (const table of ["invoices", "invoice_items"]) {
    const request = ui.calls.reads.find((read) => read.table === table);
    assert.ok(request.filters.some(([column, values]) => column === "organization_id" && values[0] === "org-a"));
    assert.ok(request.filters.some(([column, values]) => column === (table === "invoices" ? "id" : "invoice_id") && values[0] === "invoice-a"));
  }
  assert.equal(JSON.stringify(ui.rows), before);
});

test("genuinely empty successful draft item result is preserved", async () => {
  const ui = billing();
  ui.rows.invoices[0].document_status = "draft";
  ui.rows.invoice_items = [];
  const detail = await ui.read();
  assert.deepEqual(normalize(detail.items), []);
  assert.equal(detail.invoice.documentStatus, "draft");
});

for (const data of [null, undefined, {}]) test(`unavailable item data without a reported error is rejected: ${String(data)}`, async () => {
  const ui = billing();
  ui.overrides.set("invoice_items", { data, error: null });
  await assert.rejects(ui.read(), /billing_invoice_items_invalid_response/);
});

for (const headerError of [false, true]) test(`missing/header-error result keeps existing not-found behavior; error: ${headerError}`, async () => {
  const ui = billing();
  if (headerError) ui.overrides.set("invoices", { data: null, error: readFailure });
  await assert.rejects(ui.read(headerError ? "invoice-a" : "missing"), (error) => error === ui.notFound);
});

test("foreign organization invoice remains inaccessible even if item reading also fails", async () => {
  const ui = billing();
  ui.rows.invoices.push({ ...ui.rows.invoices[0], id: "invoice-b", organization_id: "org-b" });
  ui.rows.invoice_items.push({ ...ui.rows.invoice_items[0], invoice_id: "invoice-b", organization_id: "org-b", description: "Foreign private service" });
  ui.overrides.set("invoice_items", { data: null, error: readFailure });
  await assert.rejects(ui.read("invoice-b"), (error) => error === ui.notFound);
});

for (const gate of ["denyAuthorization", "denyEntitlement"]) test(`${gate} rejects before any database read`, async () => {
  const ui = billing();
  const denied = Error("Access denied");
  ui[gate](denied);
  await assert.rejects(ui.read(), (error) => error === denied);
  assert.deepEqual(ui.calls.reads, []);
});

test("rejected transport read blocks output without retry or persistent changes", async () => {
  const ui = billing();
  const unavailable = Error("Transport unavailable");
  const before = JSON.stringify(ui.rows);
  ui.overrides.set("invoice_items", unavailable);
  await assert.rejects(ui.page(printPath), (error) => error === unavailable);
  assert.equal(ui.calls.reads.filter(({ table }) => table === "invoice_items").length, 1);
  assert.equal(JSON.stringify(ui.rows), before);
});
