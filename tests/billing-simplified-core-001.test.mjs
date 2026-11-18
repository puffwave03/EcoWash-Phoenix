import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261118175639_billing_simplified_core_001.sql");
const previous = read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql");
const normalize = (value) => JSON.parse(JSON.stringify(value));

function load(path, imports = {}) {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require(name) {
    if (name in imports) return imports[name];
    throw Error(`Unexpected import: ${name}`);
  } }, { filename: path });
  return compiledModule.exports;
}
const { billingSimplifiedDraftDocument: document } = load("src/features/billing/simplified-document.ts");
const fixture = () => ({
  invoice: {
    id: "draft-a", customerId: "shared-a", customerName: null, fiscalDocumentType: "simplificada",
    documentStatus: "draft", invoiceNumber: null, issuedAt: null, issueDate: "2026-11-18", series: "S",
    currency: "EUR", pricesIncludeTax: true, issuerLegalName: "Issuer", issuerTaxId: "EXAMPLE",
    issuerAddressLine1: "Address", issuerCity: "City", issuerCountryCode: "ES", issuerPostalCode: "00000",
    orderIds: ["order-a"], orderNumbers: ["EW-EXAMPLE"], subtotal: 10, discountTotal: 2,
    taxableBase: 7.48, taxTotal: 0.52, total: 8,
  },
  items: [{ id: "line-a", sourceOrderId: "order-a", description: "Laundry service", quantity: 2,
    unitType: "piece", unitPrice: 5, lineSubtotal: 10, discountAmount: 2,
    taxableBase: 7.48, taxRate: 7, taxAmount: 0.52, lineTotal: 8, displayOrder: 1 }],
  payments: [{ id: "payment-a", amount: 8, status: "confirmed" }],
});

test("ticket contract reads original services, discounts, tax and order references without a payment projection", () => {
  const detail = fixture();
  const before = JSON.stringify(detail);
  const result = document(detail);
  assert.equal(result.document.fiscalDocumentType, "simplificada");
  assert.equal(result.document.number, null);
  assert.equal(result.document.series, "S");
  assert.equal(result.issuer.taxId, "EXAMPLE");
  assert.deepEqual(normalize(result.orders), [{ id: "order-a", number: "EW-EXAMPLE" }]);
  assert.deepEqual(normalize(result.items), detail.items);
  assert.equal(result.tax.taxableBase + result.tax.amount, result.totals.total);
  assert.equal(result.totals.total, detail.invoice.subtotal - result.totals.discount);
  assert.equal(result.totals.total, 8); // Tax has not been added to the public price.
  assert.equal(result.fiscalUseAllowed, false);
  assert.equal(result.tax.treatmentValidated, false);
  assert.equal("payments" in result, false);
  assert.equal(JSON.stringify(detail), before);
  result.items[0].description = "Changed projection";
  assert.equal(detail.items[0].description, "Laundry service");
});

test("omitted recipient has no invented fiscal identity; a named recipient preserves snapshots", () => {
  const detail = fixture();
  assert.equal(document(detail).recipient, null);
  Object.assign(detail.invoice, { customerName: "Original recipient", customerTaxId: "ORIGINAL",
    customerAddressLine1: "Original address", customerCity: "Original city" });
  const recipient = document(detail).recipient;
  assert.equal(recipient.name, "Original recipient");
  assert.equal(recipient.taxId, "ORIGINAL");
  assert.equal(recipient.addressLine1, "Original address");
});

for (const rate of [0, 3, 7, 9.5]) test(`the contract preserves the persisted rate ${rate} without assuming an IGIC treatment`, () => {
  const detail = fixture();
  detail.items[0].taxRate = rate;
  const result = document(detail);
  assert.equal(result.tax.rate, rate);
  assert.equal(result.tax.treatmentValidated, false);
});

for (const change of [
  (detail) => { detail.invoice.fiscalDocumentType = "ordinaria"; },
  (detail) => { detail.invoice.documentStatus = "issued"; },
  (detail) => { detail.invoice.documentStatus = "cancelled"; },
  (detail) => { detail.invoice.invoiceNumber = "NOT-A-DRAFT"; },
  (detail) => { detail.invoice.issuedAt = "2026-11-18"; },
]) test("ordinary/definitive documents cannot use the preparatory ticket contract", () => {
  const detail = fixture();
  change(detail);
  assert.throws(() => document(detail), /billing_simplified_draft_required/);
});

test("exclusive prices, absent lines and mixed rates are not accepted by the simplified projection", () => {
  for (const change of [
    (detail) => { detail.invoice.pricesIncludeTax = false; },
    (detail) => { detail.items = []; },
    (detail) => { detail.items.push({ ...detail.items[0], id: "line-b", taxRate: 3 }); },
  ]) {
    const detail = fixture();
    change(detail);
    assert.throws(() => document(detail), /billing_simplified_tax_model_unsupported/);
  }
});

// These assertions inspect SQL source. They are not PostgreSQL execution,
// tenant/RLS proof, or a competing-session concurrency test.
test("SQL contract: historical ordinary documents retain the default and recipient requirement", () => {
  assert.match(sql, /fiscal_document_type text not null default 'ordinaria'/);
  assert.match(sql, /fiscal_document_type <> 'ordinaria' or customer_name is not null/);
  assert.doesNotMatch(sql, /update public\.invoices[\s\S]*where.*document_status = '(issued|cancelled)'/);
  for (const rpc of ["create_billing_draft", "update_billing_draft", "issue_billing_invoice", "cancel_billing_invoice"]) {
    assert.doesNotMatch(sql, new RegExp(`create (?:or replace )?function public\\.${rpc}\\(`));
  }
  assert.match(previous, /billing_customer_configuration_required/);
});

test("SQL contract: preparation uses current tenant, role, entitlement and a scoped row lock", () => {
  const prepare = sql.slice(sql.indexOf("create function public.prepare_simplified_billing_draft"));
  assert.match(prepare, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(prepare, /has_organization_role\(org_id, array\['owner', 'manager'\]/);
  assert.match(prepare, /organization_entitlement_is_enabled\(org_id, 'billing.invoicing', now\(\)\)/);
  assert.match(prepare, /where invoice\.organization_id = org_id and invoice\.id = target_invoice_id\s+for update/);
  assert.match(prepare, /invoice_row\.id is null or invoice_row\.document_status <> 'draft'/);
  assert.match(prepare, /where customer\.organization_id = org_id and customer\.id = invoice_row\.customer_id/);
  assert.match(prepare, /revoke all on function public\.prepare_simplified_billing_draft\(uuid, text\) from public, anon, authenticated/);
  assert.match(prepare, /grant execute on function public\.prepare_simplified_billing_draft\(uuid, text\) to authenticated/);
});

test("SQL contract: shared walk-in omission only changes the document snapshot", () => {
  assert.match(sql, /customer\.customer_code = 'WALKIN-SHARED' into omit_recipient/);
  for (const column of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_address_line2",
    "customer_city", "customer_postal_code", "customer_country_code", "customer_email"]) {
    assert.ok(sql.includes(`${column} = case when omit_recipient then null else invoice.${column} end`));
  }
  assert.doesNotMatch(sql, /set[\s\S]*?customer_id\s*=/);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from) public\.(customers|orders|order_items|payments|refunds|operational_receipts|daily_closes)\b/i);
});

test("SQL contract: no new counter, calculation, event, payment or issue RPC is introduced", () => {
  const executable = sql.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(executable, /create table|create policy|alter policy|billing_invoice_number_counters|invoice_orders|sales_document_events/i);
  assert.doesNotMatch(executable, /\b(subtotal|taxable_base|tax_total|total|sequence_number|invoice_number)\s*=/);
  assert.match(sql, /count\(distinct item\.tax_rate\)/);
  assert.match(sql, /not invoice_row\.prices_include_tax/);
});

test("SQL contract: type/series guard and unconditional fiscal block protect every issue path", () => {
  assert.match(sql, /check \(fiscal_document_type <> 'simplificada' or document_status = 'draft'\)/);
  assert.match(sql, /new\.fiscal_document_type = 'simplificada' and new\.document_status <> 'draft'/);
  assert.match(sql, /old\.document_status <> 'draft'[\s\S]*billing_issued_snapshot_immutable/);
  assert.match(sql, /billing_simplified_conversion_forbidden/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /invoice\.organization_id = new\.organization_id[\s\S]*invoice\.series = new\.series[\s\S]*invoice\.fiscal_document_type <> new\.fiscal_document_type/);
});

function queryHarness({ role = "owner", entitled = true, type = "simplificada", status = "draft", tenant = "org-a" } = {}) {
  const notFound = Error("NOT_FOUND");
  const calls = [];
  const rows = {
    invoices: [{ id: "draft-a", organization_id: tenant, customer_id: "shared-a", customer_name: null,
      fiscal_document_type: type, document_status: status, total: 8 }],
    invoice_items: fixture().items, invoice_orders: [],
  };
  const client = { from(table) {
    const filters = [];
    const selected = () => rows[table].filter((row) => filters.every(([key, value]) => row[key] === value));
    const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      order() { return query; }, async maybeSingle() { return { data: selected()[0] ?? null }; },
      async returns() { return { data: table === "invoice_items" ? rows[table] : selected() }; },
      in() { return query; } };
    calls.push({ table, filters });
    return query;
  } };
  const queries = load("src/features/billing/server/queries.ts", {
    "server-only": {}, "@/features/billing/pagination": {}, "@/features/billing/types": {},
    "@/features/entitlements/feature-catalog": { FEATURES: { billingInvoicing: "billing.invoicing" } },
    "next/navigation": { notFound() { throw notFound; } },
    "@/lib/auth/require-role": { async requireOwnerOrManager() {
      assert.ok(["owner", "manager"].includes(role), "ROLE_DENIED");
      return { membership: { organization: { id: "org-a" } } };
    } },
    "@/features/entitlements/server/resolver": { async requireEntitlement() { assert.ok(entitled, "ENTITLEMENT_DENIED"); } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { return client; } },
  });
  return { queries, calls, notFound };
}

test("dedicated authorized draft read exposes the new type; ordinary/print reads reject it", async () => {
  for (const role of ["owner", "manager"]) {
    const h = queryHarness({ role });
    const result = await h.queries.getBillingSimplifiedDraft("es", "draft-a");
    assert.equal(result.invoice.fiscalDocumentType, "simplificada");
    assert.equal(result.invoice.customerName, null);
    await assert.rejects(h.queries.getBillingInvoice("es", "draft-a"), (error) => error === h.notFound);
    assert.ok(h.calls.some((call) => call.table === "invoices"
      && call.filters.some(([key, value]) => key === "organization_id" && value === "org-a")));
  }
});

test("legacy rows without a type are read as ordinary and cannot use the simplified read", async () => {
  const h = queryHarness({ type: null });
  assert.equal((await h.queries.getBillingInvoice("es", "draft-a")).invoice.fiscalDocumentType, "ordinaria");
  await assert.rejects(h.queries.getBillingSimplifiedDraft("es", "draft-a"), (error) => error === h.notFound);
});

test("role and entitlement failures stop before any document read", async () => {
  for (const options of [{ role: "staff" }, { entitled: false }]) {
    const h = queryHarness(options);
    await assert.rejects(h.queries.getBillingSimplifiedDraft("es", "draft-a"), /DENIED/);
    assert.equal(h.calls.length, 0);
  }
});

test("other-tenant, issued and cancelled simplified targets are rejected", async () => {
  for (const options of [{ tenant: "org-b" }, { status: "issued" }, { status: "cancelled" }]) {
    const h = queryHarness(options);
    await assert.rejects(h.queries.getBillingSimplifiedDraft("es", "draft-a"), (error) => error === h.notFound);
  }
});

test("existing detail and print routes continue through the guarded ordinary reader", () => {
  for (const path of [
    "src/app/[locale]/app/(dashboard)/billing/[invoiceId]/page.tsx",
    "src/app/[locale]/app/(dashboard)/billing/[invoiceId]/print/page.tsx",
  ]) {
    assert.match(read(path), /await getBillingInvoice\(locale, invoiceId\)/);
    assert.doesNotMatch(read(path), /getBillingSimplifiedDraft/);
  }
});
