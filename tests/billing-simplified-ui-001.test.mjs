import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPreviewModule, previewProps } from "../scripts/preview-billing-simplified-ticket.mjs";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const orgA = "5a5a6393-7366-5506-9527-8c9da2c11884", orgB = "b4e08840-0912-5db1-ad22-c0291af2abdd";
const orderId = "00000000-0000-4000-8000-000000000101", invoiceId = "00000000-0000-4000-8000-000000000201";
const lab = "phoenix-local-baseline-001", root = "/Volumes/DEV/Phoenix-Local-Baseline-001";
const stagingOrg = "601a0b5c-cfff-413d-952c-63be6b5978e5";
const stagingUrl = "https://exthnplfokcucaqydney.supabase.co";
const stagingEnv = { PHOENIX_BILLING_SIMPLIFIED_UI: "phoenix-staging-readonly-001",
  VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_ID: "prj_u7MwRwQOLyRSRvbuhRLdURx653aZ" };
const base = "src/features/billing/server/";
const pagePath = "src/app/[locale]/app/(dashboard)/billing/simplified/page.tsx";
const copyPath = "src/components/billing/simplified-ui-copy.ts";
const projection = loadPreviewModule("src/features/billing/simplified-document.ts");
const { BillingSimplifiedTicket } = loadPreviewModule("src/components/billing/BillingSimplifiedTicket.tsx");

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return text(node.props?.children);
}

// Executes the actual gate, read adapter, actions and page. Auth, filesystem,
// Supabase and existing fiscal services are doubles; no network or DB writes.
function harness(options = {}) {
  const h = {
    env: { PHOENIX_BILLING_SIMPLIFIED_UI: lab, ...options.env },
    cwd: options.cwd ?? `${root}/runtime/web`, config: options.config ?? `project_id = "${lab}"`,
    org: options.org ?? orgA, role: options.role ?? "owner", entitled: options.entitled ?? true,
    pos: options.pos ?? true, posOrg: options.posOrg ?? options.org ?? orgA,
    url: options.url ?? "http://127.0.0.1:58321", calls: [],
    customer: { isSharedWalkIn: false, isFiscalReady: true, customerName: "Live customer", ...options.customer },
    settings: { isIssueReady: true, missingRequiredFields: [], ...options.settings },
    bridge: { status: "blocked", reason: "simplified_draft_required", context: null },
    rows: {
      orders: [{ id: orderId, organization_id: orgA, customer_id: "customer-a", order_number: "E2EA-000001" }],
      invoices: [{ id: invoiceId, organization_id: orgA, fiscal_document_type: "simplificada" }],
      invoice_orders: [{ invoice_id: invoiceId, organization_id: orgA, order_id: orderId, is_active: true }],
    },
  };
  const original = previewProps("named").document;
  h.preview = { document: { ...original, document: { ...original.document, id: invoiceId }, orders: [{ id: orderId, number: "E2EA-000001" }] },
    locale: "es", timeZone: "Atlantic/Canary", preview: true };
  h.detail = { invoice: {
    id: invoiceId, fiscalDocumentType: "simplificada", documentStatus: "issued", invoiceNumber: "2026-S-000001",
    sequenceNumber: 1, series: "S", issuedAt: "2026-11-19T12:00:00Z", issueDate: "2026-11-19", pricesIncludeTax: true,
    issuerLegalName: original.issuer.legalName, issuerTaxId: original.issuer.taxId, issuerAddressLine1: original.issuer.addressLine1,
    issuerCity: original.issuer.city, issuerPostalCode: original.issuer.postalCode, issuerCountryCode: "ES", issuerLogoPath: null,
    customerId: "customer-a", customerName: "Stored customer", customerTaxId: "STORED-NIF", customerAddressLine1: "Stored address",
    customerCity: "Stored city", customerPostalCode: "00000", customerCountryCode: "ES",
    currency: "EUR", subtotal: 14, discountTotal: 1, taxableBase: 12.15, taxTotal: .85, total: 13,
    paidTotal: 13, outstanding: 0, orderIds: [orderId], orderNumbers: ["E2EA-000001"],
  }, items: original.items, payments: [] };
  h.draft = () => { h.bridge = { status: "preview", ticket: h.preview, context: { activeInvoice: { id: invoiceId } } }; };
  h.issued = () => { h.bridge = { status: "blocked", reason: "invoice_already_issued", context: {
    activeInvoice: { id: invoiceId, fiscalDocumentType: "simplificada", documentStatus: "issued" },
  } }; };
  const client = {
    from(table) {
      assert.ok(table in h.rows, table);
      const filters = [], query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
        async maybeSingle() {
          h.calls.push({ read: table, filters });
          if (h.readError) return { data: null, error: Error("read failed") };
          const found = h.rows[table].filter((row) => filters.every(([key, value]) => row[key] === value));
          return { data: found.length === 1 ? found[0] : null, error: found.length > 1 ? Error("ambiguous") : null };
        } };
      return query;
    },
    async rpc(name, args) { h.calls.push({ rpc: name, args }); return { data: null, error: null }; },
    storage: { from() { throw Error("Fixture has no logo"); } },
  };
  const modules = new Map();
  const membership = () => ({ membership: { role: h.role, organization: { id: h.org, timezone: "Atlantic/Canary" } } });
  const mocks = {
    "server-only": {}, "react/jsx-runtime": require("react/jsx-runtime"),
    "node:fs/promises": {
      async realpath(path) { assert.equal(path, h.cwd); h.calls.push("path"); return h.cwd; },
      async readFile(path) { assert.equal(path, `${root}/runtime/supabase/config.toml`); h.calls.push("config"); return h.config; },
    },
    "@/lib/supabase/env": { getSupabaseConfig() { return { url: h.url }; } },
    "@/lib/auth/require-role": {
      async requireOwnerOrManager() { h.calls.push("role"); assert.ok(["owner", "manager"].includes(h.role), "ROLE_DENIED"); return membership(); },
      async requireOwner() { throw Error("Unused"); },
    },
    "@/features/entitlements/feature-catalog": { FEATURES: { billingInvoicing: "billing.invoicing" } },
    "@/features/entitlements/server/resolver": { async requireEntitlement() { h.calls.push("billing"); assert.ok(h.entitled, "BILLING_DENIED"); } },
    "@/features/pos/server/access": { async requirePosAccess() { h.calls.push("pos"); assert.ok(h.pos, "POS_DENIED"); return { membership: { organization: { id: h.posOrg } } }; } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { h.calls.push("client"); return client; } },
    "@/features/billing/server/queries": {
      async getBillingCustomerContext(locale, id) { assert.equal(id, "customer-a"); h.calls.push("customer"); return h.customer; },
      async getBillingSettings() { return h.settings; },
      async getBillingSimplifiedIssued(locale, id) { assert.equal(id, invoiceId); h.calls.push("issued-read"); if (h.detailError) throw h.detailError; return h.detail; },
      async getBillingInvoice(locale, id) {
        h.calls.push("ordinary-read");
        const row = h.rows.invoices.find((i) => i.id === id && i.organization_id === h.org);
        if (!row || row.fiscal_document_type !== "ordinaria") throw Error("NOT_FOUND");
        return h.detail;
      },
      async listBillingInvoices() { return { items: [] }; },
      async getBillingHistorySummary() { return { currency: "EUR", invoiceCount: 0, draftCount: 0, issuedTotal: 0, outstanding: 0 }; },
    },
    "@/features/billing/server/simplified-pos-bridge": { async getBillingSimplifiedPosPreview(locale, id) { assert.equal(id, orderId); h.calls.push("bridge"); return h.bridge; } },
    "@/features/billing/server/simplified-draft": { async createBillingSimplifiedDraft(locale, id, series) {
      h.calls.push({ prepare: { locale, id, series } }); if (h.prepareResult) return h.prepareResult;
      h.draft(); return { status: "draft", invoiceId, preview: h.bridge };
    } },
    "@/features/billing/server/simplified-issue": { async issueBillingSimplifiedInvoice(locale, id) {
      h.calls.push({ issue: { locale, id } }); if (h.issueResult) return h.issueResult;
      h.issued(); return { status: "issued", invoiceId, invoiceNumber: h.detail.invoice.invoiceNumber, ticket: null };
    } },
    "@/features/billing/simplified-document": projection,
    "@/features/billing/tax-rate": {},
    "next/cache": { revalidatePath(path) { h.calls.push({ revalidate: path }); } },
    "next/navigation": { redirect(href) { throw Object.assign(Error("REDIRECT"), { href }); }, notFound() { throw Error("NOT_FOUND"); } },
    "next-intl/server": { async getTranslations() { return Object.assign((key) => key, { raw: () => ({}) }); } },
    "@/components/Button": { Button: "button" }, "@/components/Card": { Card: "section" },
    "@/components/billing/BillingSimplifiedTicket": { BillingSimplifiedTicket },
    "@/components/billing/PrintInvoiceButton": { PrintInvoiceButton: "print-button" },
    "@/components/billing/BillingInvoiceView": { BillingInvoiceView: "ordinary-view" },
    "@/components/sales-documents/SalesDocumentViewTracker": { SalesDocumentViewTracker: "view-tracker" },
    "@/features/sales-documents/server/actions": { recordSalesDocumentEvent(...args) { h.calls.push({ event: args }); } },
    "@/components/billing/BillingSettingsPanel": { BillingSettingsPanel: "settings-panel" },
    "@/components/billing/BillingStatusBadge": { BillingStatusBadge: "status-badge" },
    "@/components/operational/OperationalUi": { PageHeader: "page-header", SummaryCard: "summary-card" },
    "@/features/billing/pagination": { normalizeBillingFilters: () => ({ status: "all" }), billingHistoryHref: () => "/app/billing" },
    "@/lib/number-format": { formatCurrency: String },
    "@/i18n/navigation": { Link: "a" },
  };
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const compiled = { exports: {} };
    runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
      module: compiled, exports: compiled.exports, process: { env: h.env, cwd: () => h.cwd }, URLSearchParams,
      require(name) {
        if (name in mocks) return mocks[name];
        if (name === "@/components/billing/simplified-ui-copy") return load(copyPath);
        if (name.startsWith("@/features/billing/server/simplified-ui")) return load(`${base}${name.split("/").at(-1)}.ts`);
        throw Error(`Unexpected import ${name}`);
      },
    }, { filename: path });
    modules.set(path, compiled.exports); return compiled.exports;
  }
  h.access = () => load(`${base}simplified-ui-access.ts`).requireBillingSimplifiedUiAccess("es");
  h.enabled = (org) => load(`${base}simplified-ui-access.ts`).billingSimplifiedUiEnabled(org);
  h.mutationEnabled = (org) => load(`${base}simplified-ui-access.ts`).billingSimplifiedUiMutationEnabled(org);
  h.state = (selection = { orderId }) => load(`${base}simplified-ui.ts`).getBillingSimplifiedUiState("es", selection);
  h.history = () => load(`${base}simplified-ui.ts`).getBillingSimplifiedUiOrderForInvoice("es", invoiceId);
  h.page = (query = { orderId }) => load(pagePath).default({ params: Promise.resolve({ locale: "es" }), searchParams: Promise.resolve(query) });
  h.action = (type, form = formData()) => load(`${base}simplified-ui-actions.ts`)[`${type}BillingSimplifiedUiAction`]("es", form);
  h.ordinaryIssue = () => load(`${base}actions.ts`).issueBillingInvoiceAction("es", invoiceId, "customer-a");
  h.detailPage = () => load("src/app/[locale]/app/(dashboard)/billing/[invoiceId]/page.tsx").default({ params: Promise.resolve({ locale: "es", invoiceId }) });
  h.printPage = () => load("src/app/[locale]/app/(dashboard)/billing/[invoiceId]/print/page.tsx").default({ params: Promise.resolve({ locale: "es", invoiceId }) });
  h.registry = () => load("src/components/sales-documents/SalesDocumentsRegistry.tsx").SalesDocumentsRegistry({
    locale: "es", cancelReceipt() { throw Error("Unexpected receipt action"); },
    documents: [{ id: invoiceId, kind: "invoice", status: "issued", documentNumber: h.detail.invoice.invoiceNumber,
      amount: h.detail.invoice.total, currency: "EUR", customer: "Stored customer", orderNumbers: ["E2EA-000001"], issuedAt: h.detail.invoice.issuedAt }],
    text: { kinds: { invoice: "Factura" }, statuses: { issued: "Emitida" }, open: "Abrir / reimprimir" },
  });
  h.home = () => load("src/app/[locale]/app/(dashboard)/billing/page.tsx").default({ params: Promise.resolve({ locale: "es" }), searchParams: Promise.resolve({}) });
  return h;
}
function stagingHarness(options = {}) {
  const h = harness({ org: stagingOrg, url: stagingUrl, cwd: "/vercel/path0", ...options,
    env: { ...stagingEnv, ...options.env } });
  for (const rows of Object.values(h.rows)) for (const row of rows) {
    if (row.organization_id === orgA) row.organization_id = stagingOrg;
  }
  return h;
}
function formData(ids = [orderId]) {
  const form = new FormData(); ids.forEach((id) => form.append("orderId", id)); form.set("series", "S"); form.set("confirm", "issue"); return form;
}
const redirected = (operation, match = /orderId=/) => assert.rejects(operation, (error) => error.message === "REDIRECT" && match.test(error.href));
const mutations = (h) => h.calls.filter((call) => call.prepare || call.issue || call.rpc);

test("default off; exact endpoint, path and project required, never NODE_ENV alone", async () => {
  for (const options of [
    { env: { PHOENIX_BILLING_SIMPLIFIED_UI: undefined, NODE_ENV: "development" } },
    { env: { VERCEL: "1" } }, { env: { VERCEL_ENV: "preview" } },
    { url: "https://example.supabase.co" }, { url: "http://localhost:58321" }, { url: "http://127.0.0.1:54321" },
    { cwd: "/Users/example/EcoWash-Phoenix" }, { config: 'project_id = "recovery"' },
  ]) {
    const h = harness(options); assert.equal(await h.enabled(orgA), false);
    await assert.rejects(h.access(), /ui_disabled/); assert.ok(!h.calls.includes("role")); assert.equal(mutations(h).length, 0);
  }
  const h = harness(); assert.equal(await h.enabled(orgA), true); assert.equal(await h.enabled(orgB), true);
  assert.equal(await h.enabled("real-tenant"), false);
});

test("server gates Owner/Manager, Billing, POS and synthetic membership before reads or mutations", async () => {
  for (const role of ["owner", "manager"]) await harness({ role }).access();
  for (const options of [{ role: "staff" }, { entitled: false }, { pos: false }, { org: "real-tenant" }, { posOrg: orgB }]) {
    const h = harness(options); await assert.rejects(h.action("issue"), /DENIED|denied/);
    assert.ok(!h.calls.includes("client")); assert.equal(mutations(h).length, 0);
  }
});

test("exact single-order lookup is tenant scoped; GET is read-only", async () => {
  const h = harness(); assert.equal((await h.state({ orderNumber: "E2EA-000001" })).status, "ready");
  const read = h.calls.find((call) => call.read === "orders");
  assert.deepEqual(read.filters, [["organization_id", orgA], ["order_number", "E2EA-000001"]]);
  assert.equal(mutations(h).length, 0);
  const foreign = harness({ org: orgB }); assert.equal((await foreign.state()).reason, "order_unavailable");
  assert.ok(!foreign.calls.includes("bridge"));
  assert.equal((await h.state({ orderId: "invalid" })).reason, "invalid_input");
  assert.equal((await h.state({ orderNumber: "x".repeat(81) })).reason, "invalid_input");
});

test("incomplete identified customer/issuer cannot reach draft service", async () => {
  for (const [options, reason] of [
    [{ customer: { isFiscalReady: false } }, "customer_incomplete"],
    [{ customer: { customerName: " " } }, "customer_incomplete"],
    [{ settings: { isIssueReady: false } }, "issuer_incomplete"],
  ]) {
    const h = harness(options); assert.equal((await h.state()).reason, reason);
    await redirected(h.action("prepare"), new RegExp(`error=${reason}`)); assert.equal(mutations(h).length, 0);
  }
});

test("bridge partial/unreconciled/ineligible/ordinary-invoiced states block both actions", async () => {
  for (const reason of ["not_fully_paid", "payment_reconciliation_failed", "pos_registration_unverified", "order_unavailable", "ordinary_draft_present", "invoice_already_issued", "unsupported_tax_model"]) {
    const h = harness(); h.bridge = { status: "blocked", reason, context: null };
    await redirected(h.action("prepare"), new RegExp(`error=${reason}`));
    await redirected(h.action("issue"), new RegExp(`error=${reason}`)); assert.equal(mutations(h).length, 0);
    const tree = await h.page(); assert.ok(nodes(tree).some((n) => n.props?.role === "alert"));
    assert.equal(nodes(tree).filter((n) => typeof n.props?.action === "function").length, 0);
  }
});

test("one draft creation with existing service; repeat reuses its preview and creates no payment", async () => {
  const h = harness(); await redirected(h.action("prepare")); await redirected(h.action("prepare"));
  assert.deepEqual(mutations(h), [{ prepare: { locale: "es", id: orderId, series: "S" } }]);
  const state = await h.state(); assert.equal(state.status, "draft"); assert.equal(state.invoiceId, invoiceId);
  const tree = await h.page(), ticket = nodes(tree).find((n) => n.type === BillingSimplifiedTicket);
  assert.equal(ticket.props.preview, true); assert.equal(ticket.props.document.fiscalUseAllowed, false);
  const html = renderToStaticMarkup(createElement(BillingSimplifiedTicket, ticket.props));
  assert.match(html, /data-fiscal-issued="false"/); assert.match(html, /VISTA PREVIA/);
  assert.ok(!nodes(tree).some((n) => n.type === "print-button"));
});

test("one server-derived invoice ID, retry retrieves issued document without another issue", async () => {
  const h = harness(); h.draft(); const form = formData(); form.set("invoiceId", "forged"); form.set("total", "0");
  await redirected(h.action("issue", form)); await redirected(h.action("issue", form));
  assert.deepEqual(mutations(h), [{ issue: { locale: "es", id: invoiceId } }]);
  assert.ok(h.calls.includes("issued-read"));
});

test("multi-order, missing selection and missing confirmation rejected server-side", async () => {
  for (const ids of [[], [orderId, orderId], [orderId, "another"]]) {
    const h = harness(); await redirected(h.action("prepare", formData(ids)), /error=invalid_input/);
    await redirected(h.action("issue", formData(ids)), /error=invalid_input/); assert.equal(mutations(h).length, 0);
  }
  const h = harness(); h.draft(); const form = formData(); form.delete("confirm");
  await redirected(h.action("issue", form), /error=invalid_input/); assert.equal(mutations(h).length, 0);
});

test("issued ticket copies persisted fiscal snapshot and supports read/print without mutations", async () => {
  const h = harness(); h.issued(); const before = JSON.stringify(h.detail);
  const tree = await h.page(), ticket = nodes(tree).find((n) => n.type === BillingSimplifiedTicket);
  assert.equal(ticket.props.preview, undefined); assert.equal(ticket.props.document.fiscalUseAllowed, true);
  assert.equal(ticket.props.document.recipient.name, "Stored customer");
  assert.equal(ticket.props.document.totals.total, 13); assert.equal(ticket.props.document.tax.amount, .85);
  const html = renderToStaticMarkup(createElement(BillingSimplifiedTicket, ticket.props));
  assert.match(html, /data-fiscal-issued="true"/); assert.match(html, /2026-S-000001/); assert.doesNotMatch(html, /Live customer|VISTA PREVIA/);
  assert.ok(nodes(tree).some((n) => n.type === "print-button")); assert.equal(mutations(h).length, 0);
  assert.equal(JSON.stringify(h.detail), before);
});

test("committed issue with failed document read shows issued status, no issue/print button", async () => {
  const h = harness(); h.issued(); h.detailError = Error("read failed");
  assert.equal((await h.state()).status, "issued_unavailable");
  const tree = await h.page(); assert.match(text(tree), /ya está emitida/);
  assert.ok(!nodes(tree).some((n) => n.type === "print-button" || n.type === BillingSimplifiedTicket));
  await redirected(h.action("issue")); assert.equal(mutations(h).length, 0);
});

test("RPC/service failures keep explicit blocked UI and never start an alternative flow", async () => {
  const h = harness(); h.prepareResult = { status: "blocked", reason: "draft_conflict" };
  await redirected(h.action("prepare"), /error=draft_conflict/);
  h.draft(); h.issueResult = { status: "blocked", reason: "issue_blocked" };
  await redirected(h.action("issue"), /error=issue_blocked/);
  assert.equal(mutations(h).length, 2);
});

test("disabled route and forged server actions cannot read or issue", async () => {
  const h = harness({ env: { PHOENIX_BILLING_SIMPLIFIED_UI: undefined } });
  await assert.rejects(h.page(), /NOT_FOUND/);
  await assert.rejects(h.action("prepare"), /ui_disabled/); await assert.rejects(h.action("issue"), /ui_disabled/);
  assert.ok(!h.calls.includes("client")); assert.equal(mutations(h).length, 0);
});

test("ordinary issue action preserves canonical RPC and rejects simplified/unknown targets", async () => {
  for (const type of ["simplificada", "unknown"]) {
    const h = harness(); h.rows.invoices[0].fiscal_document_type = type;
    await redirected(h.ordinaryIssue(), /billing\?error=unauthorized/); assert.equal(mutations(h).length, 0);
  }
  const h = harness(); h.rows.invoices[0].fiscal_document_type = "ordinaria";
  await redirected(h.ordinaryIssue(), /saved=issued/);
  assert.deepEqual(JSON.parse(JSON.stringify(mutations(h))), [{ rpc: "issue_billing_invoice", args: { target_invoice_id: invoiceId } }]);
  assert.deepEqual(h.calls.find((c) => c.read === "invoices").filters, [["organization_id", orgA], ["id", invoiceId]]);
});

test("ordinary detail has no POS requirement; enabled simplified history resolves exact tenant link", async () => {
  const h = harness({ pos: false }); h.rows.invoices[0].fiscal_document_type = "ordinaria";
  const tree = await h.detailPage(); assert.equal(tree.type, "ordinary-view"); assert.ok(!h.calls.includes("pos"));
  const simple = harness(); await redirected(simple.detailPage(), new RegExp(`orderId=${orderId}`));
  assert.equal(await simple.history(), orderId);
  const foreign = harness({ org: orgB }); assert.equal(await foreign.history(), null);
});

test("UI copy keeps the explicit issue confirmation in all five application locales", () => {
  for (const locale of ["es", "it", "en", "fr", "de"]) {
    const { billingSimplifiedUiCopy } = loadPreviewModule(copyPath);
    assert.ok(billingSimplifiedUiCopy(locale).confirm);
  }
});

test("anonymous simplified flow uses null recipient snapshots and the visual label only, with no second payment/document on retry", async () => {
  const h = harness({ customer: { isSharedWalkIn: true, isFiscalReady: false, customerName: "Technical operational label" } });
  h.preview.document.recipient = null;
  h.preview.presentation = { isSharedWalkIn: true };
  for (const field of ["customerName", "customerTaxId", "customerAddressLine1", "customerAddressLine2", "customerCity", "customerPostalCode", "customerCountryCode", "customerEmail"]) h.detail.invoice[field] = null;
  const before = JSON.stringify(h.detail);
  assert.equal((await h.state()).status, "ready");
  await redirected(h.action("prepare")); await redirected(h.action("prepare"));
  const draft = await h.state(); assert.equal(draft.status, "draft"); assert.equal(draft.ticket.document.recipient, null);
  await redirected(h.action("issue")); await redirected(h.action("issue"));
  const tree = await h.page(), ticket = nodes(tree).find((n) => n.type === BillingSimplifiedTicket);
  assert.equal(ticket.props.document.recipient, null); assert.equal(ticket.props.presentation.isSharedWalkIn, true);
  const html = renderToStaticMarkup(createElement(BillingSimplifiedTicket, ticket.props));
  assert.match(html, /Cliente sin identificar/); assert.match(html, /data-fiscal-issued="true"/);
  assert.doesNotMatch(html, /Technical operational label/);
  assert.deepEqual(mutations(h), [{ prepare: { locale: "es", id: orderId, series: "S" } }, { issue: { locale: "es", id: invoiceId } }]);
  assert.equal(JSON.stringify(h.detail), before);
});

test("shared customer cannot borrow an identified snapshot or missing provenance", async () => {
  const h = harness({ customer: { isSharedWalkIn: true } }); h.draft();
  assert.equal((await h.state()).reason, "recipient_mismatch");
  h.preview.document.recipient = null;
  assert.equal((await h.state()).reason, "recipient_mismatch");
  h.issued(); assert.equal((await h.state()).reason, "invoice_conflict");
  await redirected(h.action("issue"), /error=invoice_conflict/); assert.equal(mutations(h).length, 0);
});

test("Facturación offers two clear choices only in the authorized lab; ordinary URL stays identical", async () => {
  for (const enabled of [true, false]) {
    const h = harness({ env: enabled ? {} : { PHOENIX_BILLING_SIMPLIFIED_UI: undefined } });
    const tree = await h.home(), action = nodes(tree).find((n) => n.type === "page-header").props.action;
    const links = nodes(action).filter((n) => n.type === "a");
    assert.equal(links[0].props.href, "/app/billing/new");
    assert.equal(links.length, enabled ? 2 : 1);
    if (enabled) { assert.match(text(action), /Factura ordinaria.*Factura simplificada/); assert.equal(links[1].props.href, "/app/billing/simplified"); }
    else assert.equal(text(action), "actions.create ");
    assert.equal(mutations(h).length, 0);
  }
});

test("unreadable or missing invoices cannot enter ordinary issuance, foreign order cannot enter either action", async () => {
  for (const setup of [(h) => { h.readError = true; }, (h) => { h.rows.invoices = []; }]) {
    const h = harness(); setup(h); await redirected(h.ordinaryIssue(), /error=unauthorized/); assert.equal(mutations(h).length, 0);
  }
  const h = harness({ org: orgB });
  await redirected(h.action("prepare"), /error=order_unavailable/);
  await redirected(h.action("issue"), /error=order_unavailable/); assert.equal(mutations(h).length, 0);
});

test("new draft form contains one server-resolved order, series only, with no financial or recipient payload", async () => {
  const h = harness(); const tree = await h.page({ orderNumber: "E2EA-000001" });
  const form = nodes(tree).find((n) => typeof n.props?.action === "function");
  const fields = nodes(form).filter((n) => n.type === "input");
  assert.deepEqual(fields.map((n) => n.props.name), ["orderId", "series"]);
  assert.equal(fields[0].props.value, orderId); assert.equal(fields[1].props.defaultValue, undefined);
  assert.equal(mutations(h).length, 0);
});

test("registry print URL opens existing simplified ticket with original number, date and amounts, without financial actions", async () => {
  const h = harness(); h.issued();
  Object.assign(h.detail.invoice, { invoiceNumber: "2026-SLAB-000001", series: "SLAB", subtotal: 10.7,
    discountTotal: 0, taxableBase: 10, taxTotal: .7, total: 10.7, paidTotal: 10.7 });
  h.detail.items = [{ ...h.detail.items[0], quantity: 1, unitPrice: 10.7, lineSubtotal: 10.7,
    discountAmount: 0, taxableBase: 10, taxAmount: .7, lineTotal: 10.7 }];
  const open = nodes(h.registry()).find((n) => n.type === "a");
  assert.equal(open.props.href, `/app/billing/${invoiceId}/print`);
  assert.equal(text(open), "Abrir / reimprimir");
  const before = JSON.stringify([h.rows, h.detail]);
  for (let retry = 0; retry < 2; retry++) {
    await redirected(h.printPage(), new RegExp(`orderId=${orderId}`));
    const tree = await h.page({ orderId }), ticket = nodes(tree).find((n) => n.type === BillingSimplifiedTicket);
    assert.equal(ticket.props.document.document.number, "2026-SLAB-000001");
    assert.equal(ticket.props.document.document.series, "SLAB");
    assert.equal(ticket.props.document.document.issuedAt, h.detail.invoice.issuedAt);
    assert.equal(ticket.props.document.document.issueDate, h.detail.invoice.issueDate);
    assert.deepEqual([ticket.props.document.totals.total, ticket.props.document.tax.amount], [10.7, .7]);
    const html = renderToStaticMarkup(createElement(BillingSimplifiedTicket, ticket.props));
    assert.match(html, /data-fiscal-issued="true"/); assert.match(html, /2026-SLAB-000001/);
    assert.match(html, /80mm/); assert.match(html, /10,70/); assert.match(html, /0,70/);
    assert.ok(nodes(tree).some((n) => n.type === "print-button"));
  }
  assert.equal(JSON.stringify([h.rows, h.detail]), before);
  assert.equal(mutations(h).length, 0); assert.ok(!h.calls.includes("ordinary-read"));
  assert.ok(!h.calls.some((c) => c.event));
});

test("ordinary reprint retains its view, print mode and existing event callbacks without requiring POS", async () => {
  for (const enabled of [true, false]) {
    const h = harness({ pos: false, env: enabled ? {} : { PHOENIX_BILLING_SIMPLIFIED_UI: undefined } });
    h.rows.invoices[0].fiscal_document_type = "ordinaria";
    const tree = await h.printPage(), view = nodes(tree).find((n) => n.type === "ordinary-view");
    assert.equal(view.props.detail, h.detail); assert.equal(view.props.printMode, true);
    const tracker = nodes(tree).find((n) => n.type === "view-tracker");
    assert.equal(typeof tracker.props.viewedAction, "function");
    assert.equal(typeof view.props.printRequestedAction, "function");
    assert.ok(!h.calls.includes("pos")); assert.equal(mutations(h).length, 0);
    h.calls.length = 0; tracker.props.viewedAction(); view.props.printRequestedAction();
    assert.deepEqual(h.calls.map((c) => c.event), [["es", "invoice", invoiceId, "viewed"], ["es", "invoice", invoiceId, "print_requested"]]);
  }
});

test("simplified reprint denies foreign tenant, unauthorized role/entitlement/POS and disabled laboratory", async () => {
  for (const options of [{ org: orgB }, { role: "staff" }, { entitled: false }, { pos: false },
    { env: { PHOENIX_BILLING_SIMPLIFIED_UI: undefined } }, { url: "https://example.supabase.co" }]) {
    const h = harness(options); h.issued();
    await assert.rejects(h.printPage(), /NOT_FOUND|DENIED|denied/);
    assert.equal(mutations(h).length, 0); assert.ok(!h.calls.includes("issued-read"));
    assert.ok(!h.calls.some((c) => c.event));
  }
});

test("staging opt-in requires the exact Vercel project, Supabase endpoint and synthetic tenant; it never enables writes", async () => {
  for (const environment of ["preview", "production"]) {
    const h = stagingHarness({ env: { VERCEL_ENV: environment } });
    assert.equal(await h.enabled(stagingOrg), true);
    assert.equal(await h.mutationEnabled(stagingOrg), false);
    assert.equal(await h.mutationEnabled(), false);
    await h.access();
    assert.ok(!h.calls.includes("config") && !h.calls.includes("path"));
  }
  const local = harness();
  for (const org of [orgA, orgB]) assert.equal(await local.mutationEnabled(org), true);
  assert.equal(await local.enabled(stagingOrg), false);
  assert.equal(await local.mutationEnabled(stagingOrg), false);
});

test("staging rejects missing opt-in, other Vercel projects, local runtimes and lookalike or other Supabase endpoints", async () => {
  for (const options of [
    { env: { PHOENIX_BILLING_SIMPLIFIED_UI: undefined } },
    { env: { PHOENIX_BILLING_SIMPLIFIED_UI: lab } },
    { env: { VERCEL: undefined } }, { env: { VERCEL: "0" } },
    { env: { VERCEL_PROJECT_ID: undefined } }, { env: { VERCEL_PROJECT_ID: "commercial-production" } },
    { env: { VERCEL_ENV: undefined } }, { env: { VERCEL_ENV: "development", NODE_ENV: "production" } },
    { url: "http://127.0.0.1:58321" }, { url: "https://other.supabase.co" },
    { url: `${stagingUrl}.example.test` }, { url: stagingUrl.replace("https:", "http:") },
  ]) {
    const h = stagingHarness(options);
    assert.equal(await h.enabled(stagingOrg), false);
    await assert.rejects(h.page(), /NOT_FOUND/);
    for (const action of ["prepare", "issue"]) await assert.rejects(h.action(action), /ui_disabled/);
    assert.equal(mutations(h).length, 0); assert.ok(!h.calls.includes("client"));
  }
});

test("staging derives the tenant from membership and preserves Owner/Manager, Billing and POS authorization", async () => {
  for (const role of ["owner", "manager"]) await stagingHarness({ role }).access();
  for (const options of [{ role: "staff" }, { entitled: false }, { pos: false }, { posOrg: orgA },
    { org: orgA }, { org: orgB }, { org: "other-real-tenant" }]) {
    const h = stagingHarness(options);
    await assert.rejects(h.page(), /DENIED|denied/);
    for (const action of ["prepare", "issue"]) await assert.rejects(h.action(action), /DENIED|denied/);
    assert.equal(mutations(h).length, 0); assert.ok(!h.calls.includes("client"));
    if (options.org) assert.equal(await h.enabled(options.org), false);
  }
});

test("staging navigation exposes Factura simplificada only for the allowlisted tenant and preserves the ordinary URL", async () => {
  for (const org of [stagingOrg, orgA, orgB, "other-real-tenant"]) {
    const h = stagingHarness({ org }), tree = await h.home();
    const action = nodes(tree).find((n) => n.type === "page-header").props.action;
    const links = nodes(action).filter((n) => n.type === "a");
    assert.equal(links[0].props.href, "/app/billing/new");
    assert.equal(links.length, org === stagingOrg ? 2 : 1);
    if (org === stagingOrg) assert.match(text(action), /Factura simplificada/);
    assert.equal(mutations(h).length, 0);
  }
});

test("staging GET stays read-only for empty, ready, blocked and existing draft states; no fiscal forms are rendered", async () => {
  for (const status of ["empty", "ready", "blocked", "draft"]) {
    const h = stagingHarness();
    if (status === "blocked") h.bridge = { status: "blocked", reason: "not_fully_paid", context: null };
    if (status === "draft") h.draft();
    const before = JSON.stringify([h.rows, h.detail, h.preview]);
    const tree = await h.page(status === "empty" ? {} : { orderId });
    assert.match(text(tree), /solo consulta.*creación de borradores.*emisión.*deshabilitadas/);
    const forms = nodes(tree).filter((n) => n.type === "form");
    assert.equal(forms.length, 1); assert.equal(forms[0].props.method, "get");
    assert.ok(!nodes(tree).some((n) => ["series", "confirm"].includes(n.props?.name)));
    if (status === "draft") {
      assert.match(text(tree), /VISTA PREVIA · SIN EMISIÓN FISCAL/);
      const ticket = nodes(tree).find((n) => n.type === BillingSimplifiedTicket);
      assert.equal(ticket.props.preview, true);
      assert.match(renderToStaticMarkup(createElement(BillingSimplifiedTicket, ticket.props)), /data-fiscal-issued="false"/);
    }
    if (status !== "empty") {
      const read = h.calls.find((c) => c.read === "orders");
      assert.deepEqual(read.filters, [["organization_id", stagingOrg], ["id", orderId]]);
    }
    assert.equal(JSON.stringify([h.rows, h.detail, h.preview]), before);
    assert.equal(mutations(h).length, 0);
  }
});

test("forged staging prepare/issue submissions are rejected before any order read, service, RPC or revalidation", async () => {
  for (const role of ["owner", "manager"]) for (const status of ["ready", "draft", "issued"]) {
    const h = stagingHarness({ role });
    if (status === "draft") h.draft();
    if (status === "issued") h.issued();
    const form = formData(); form.set("organizationId", orgA); form.set("invoiceId", invoiceId);
    for (let retry = 0; retry < 2; retry++) for (const action of ["prepare", "issue"]) {
      await assert.rejects(h.action(action, form), /billing_simplified_ui_read_only/);
    }
    assert.equal(mutations(h).length, 0);
    assert.ok(!h.calls.includes("client") && !h.calls.includes("bridge"));
    assert.ok(!h.calls.some((call) => call.revalidate));
  }
});

test("staging retrieves an existing issued ticket without changing snapshots or enabling ordinary-action bypass", async () => {
  const h = stagingHarness(); h.issued(); const before = JSON.stringify([h.detail, h.rows]);
  for (let retry = 0; retry < 2; retry++) {
    await redirected(h.printPage(), new RegExp(`orderId=${orderId}`));
    const tree = await h.page(), ticket = nodes(tree).find((n) => n.type === BillingSimplifiedTicket);
    assert.equal(ticket.props.document.document.number, h.detail.invoice.invoiceNumber);
    assert.deepEqual([ticket.props.document.totals.total, ticket.props.document.tax.amount], [13, .85]);
    assert.equal(nodes(tree).filter((n) => typeof n.props?.action === "function").length, 0);
  }
  await redirected(h.ordinaryIssue(), /billing\?error=unauthorized/);
  assert.equal(JSON.stringify([h.detail, h.rows]), before); assert.equal(mutations(h).length, 0);
});

test("staging cannot retrieve another tenant's order or issued document", async () => {
  const h = stagingHarness();
  for (const rows of Object.values(h.rows)) for (const row of rows) row.organization_id = orgA;
  assert.equal((await h.state()).reason, "order_unavailable");
  assert.equal(await h.history(), null);
  assert.ok(!h.calls.includes("bridge") && !h.calls.includes("issued-read"));
  assert.equal(mutations(h).length, 0);
});

test("read-only staging explanation is available in all five UI locales", () => {
  const { billingSimplifiedUiCopy } = loadPreviewModule(copyPath);
  for (const locale of ["es", "it", "en", "fr", "de"]) assert.ok(billingSimplifiedUiCopy(locale).readOnly?.trim());
});

test("retired B1 UAT opt-in cannot enable release reads or mutations", async () => {
  const options = { env: { PHOENIX_BILLING_SIMPLIFIED_UI: "phoenix-b1-uat-001" },
    cwd: "/Volumes/DEV/Phoenix-B1-UAT-001/runtime/web", url: "http://127.0.0.1:58421", config: 'project_id = "phoenix-b1-uat-001"' };
  for (const overrides of [{}, { url: "http://127.0.0.1:58321", cwd: `${root}/runtime/web`, config: `project_id = "${lab}"` },
    { env: { ...options.env, VERCEL: "1" } },
    { env: { PHOENIX_BILLING_SIMPLIFIED_UI: lab } },
    { env: { PHOENIX_BILLING_SIMPLIFIED_UI: "phoenix-staging-readonly-001", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_PROJECT_ID: stagingEnv.VERCEL_PROJECT_ID } }]) {
    const h = harness({ ...options, ...overrides });
    for (const organizationId of [orgA, orgB, stagingOrg, "real-tenant"]) {
      assert.equal(await h.enabled(organizationId), false);
      assert.equal(await h.mutationEnabled(organizationId), false);
    }
    for (const action of ["prepare", "issue"]) await assert.rejects(h.action(action), /billing_simplified_ui_disabled/);
    assert.equal(mutations(h).length, 0);
    assert.ok(!h.calls.includes("client") && !h.calls.includes("bridge"));
  }
});
