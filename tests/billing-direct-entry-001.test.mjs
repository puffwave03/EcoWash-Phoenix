import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { terminal, nodes, content, customer } from "./helpers/shop-terminal-harness.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(new URL(path, `file://${root}`), "utf8");
const entryPath = "src/features/billing/server/order-entry.ts";
const pagePath = "src/app/[locale]/app/(dashboard)/billing/new/page.tsx";
const actionPath = "src/components/billing/BillingOrderEntry.tsx";
const formPath = "src/components/billing/BillingCreateForm.tsx";
const normalize = (value) => JSON.parse(JSON.stringify(value));

// Execute real resolver, query, preparation page and action component. This
// client supports reads only; no live Supabase client or action is imported.
function billing({ role = "owner", entitled = true, locale = "it" } = {}) {
  const rows = {
    orders: [{ id: "order-a", organization_id: "org-a", customer_id: "customer-a", is_active: true, production_status: "received", created_at: "2026-10-16T12:00:00Z" }],
    customers: [{ id: "customer-a", organization_id: "org-a", customer_code: "C-1", customer_type: "individual", display_name: "A",
      billing_address_line1: "Street", billing_city: "Town", billing_postal_code: "12345", billing_country_code: "ES", tax_id: null }],
    invoice_orders: [], invoices: [], organization_billing_settings: [], organization_branding: [],
  };
  const calls = { reads: [], rpc: [], auth: [], entitlement: [] };
  const failures = new Map();
  const missing = Error("NEXT_NOT_FOUND"), denied = Error("ACCESS_DENIED"), featureDenied = Error("FEATURE_UNAVAILABLE");
  const supabase = {
    from(table) {
      assert.ok(table in rows, `Unexpected table ${table}`);
      const filters = [];
      return {
        select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
        async maybeSingle() {
          calls.reads.push({ table, filters });
          if (failures.has(table)) return { data: null, error: failures.get(table) };
          const selected = rows[table].filter((row) => filters.every(([key, value]) => row[key] === value));
          assert.ok(selected.length <= 1, "maybeSingle must reject ambiguous results");
          return { data: selected[0] ?? null, error: null };
        },
      };
    },
    rpc(name, args) {
      assert.equal(name, "list_eligible_billing_orders", "Only canonical discovery RPC is permitted");
      calls.rpc.push({ name, args });
      return { async returns() {
        if (failures.has("rpc")) return { data: null, error: failures.get("rpc") };
        // Existing SQL exclusions, including active invoice links. No writes.
        return { error: null, data: rows.orders.filter((order) => order.organization_id === "org-a"
          && order.is_active && order.production_status !== "cancelled"
          && order.id === args.target_order_id && order.customer_id === args.target_customer_id
          && rows.customers.some((c) => c.id === order.customer_id && c.organization_id === "org-a" && c.customer_code !== "WALKIN-SHARED")
          && !rows.invoice_orders.some((link) => link.organization_id === "org-a" && link.order_id === order.id && link.is_active))
          .map((order) => ({ ...order, order_number: "MEMORY-ONLY", total: 36, currency: "EUR", customer_active: true, customer_name: "A" })) };
      } };
    },
  };
  const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const compiled = { exports: {} };
    const localRequire = (name) => {
      if (name === "server-only") return {};
      if (name === "react/jsx-runtime") return require(name);
      if (name === "next/navigation") return { notFound() { throw missing; }, redirect(href) { throw Object.assign(Error("REDIRECT"), { href }); } };
      if (name === "@/lib/auth/require-role") return { requireOwnerOrManager: async (requestedLocale) => {
        calls.auth.push(requestedLocale);
        if (!["owner", "manager"].includes(role)) throw denied;
        return { membership: { role, organization: { id: "org-a", name: "Memory tenant" } } };
      } };
      if (name === "@/features/entitlements/server/resolver") return { requireEntitlement: async (...args) => {
        calls.entitlement.push(args); if (!entitled) throw featureDenied;
      } };
      if (name === "@/features/entitlements/feature-catalog") return { FEATURES: { billingInvoicing: "billing.invoicing" } };
      if (name === "@/lib/supabase/server") return { createSupabaseServerClient: async () => supabase };
      if (name === "@/features/billing/pagination") return {};
      if (name === "@/features/billing/types") return load("src/features/billing/types.ts");
      if (name === "@/features/billing/server/order-entry") return load(entryPath);
      if (name === "@/features/billing/server/queries") return load("src/features/billing/server/queries.ts");
      if (name === "@/components/billing/BillingCreateForm") return load(formPath);
      if (name === "@/components/Button") return { Button: "button" };
      if (name === "@/components/Card") return { Card: "section" };
      if (name === "@/features/billing/tax-rate") return load("src/features/billing/tax-rate.ts");
      if (name === "@/features/billing/server/actions") return { createBillingDraftAction() { throw Error("Unexpected mutation"); } };
      if (name === "@/components/billing/BillingCustomerFiscalPanel") return { BillingCustomerFiscalPanel: "fiscal-panel" };
      if (name === "@/components/operational/OperationalUi") return { PageHeader: "page-header" };
      if (name === "@/i18n/navigation") return { Link: "a" };
      if (name === "@/lib/number-format") return { formatCurrency: String };
      if (name === "next-intl/server") return { getTranslations: async ({ namespace }) => {
        const base = namespace.split(".").slice(1).reduce((obj, key) => obj[key], messages);
        const value = (key) => key.split(".").reduce((obj, part) => obj[part], base);
        return Object.assign((key) => { const text = value(key); assert.equal(typeof text, "string", key); return text; }, { raw: value });
      } };
      throw Error(`Unexpected import ${name}`);
    };
    const code = ts.transpileModule(read(path), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    runInNewContext(code, { module: compiled, exports: compiled.exports, require: localRequire }, { filename: path });
    modules.set(path, compiled.exports);
    return compiled.exports;
  }
  function linkInvoice(status, { active = status !== "cancelled", organizationId = "org-a" } = {}) {
    rows.invoice_orders.push({ organization_id: organizationId, order_id: "order-a", invoice_id: "invoice-a", is_active: active });
    rows.invoices.push({ organization_id: organizationId, id: "invoice-a", document_status: status });
  }
  return { rows, calls, failures, missing, denied, featureDenied, linkInvoice, messages,
    entry: (id = "order-a") => load(entryPath).getBillingOrderEntry(locale, id),
    action: () => load(actionPath).BillingOrderEntry({ locale, orderId: "order-a" }),
    page: (query = { orderId: "order-a" }) => load(pagePath).default({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }),
    form: (props) => load(formPath).BillingCreateForm(props),
  };
}

test("eligible order uses canonical selection and server-derived customer; GET creates nothing", async () => {
  const ui = billing();
  const before = JSON.stringify(ui.rows);
  assert.deepEqual(normalize(await ui.entry()), { kind: "prepare", customerId: "customer-a", href: "/app/billing/new?orderId=order-a" });
  const tree = await ui.page({ orderId: "order-a", customerId: "forged-customer", source: "shop" });
  const form = nodes(tree).find((node) => typeof node.type === "function" && node.type.name === "BillingCreateForm");
  assert.equal(form.props.selectedOrderId, "order-a");
  assert.equal(form.props.orders[0].customerId, "customer-a");
  const checkbox = nodes(ui.form(form.props)).find((node) => node.props.name === "orderId");
  assert.equal(checkbox.props.defaultChecked, true);
  assert.equal(checkbox.props.value, "order-a");
  assert.equal(nodes(tree).find((node) => node.type === "fiscal-panel").props.context.customerId, "customer-a");
  assert.equal(JSON.stringify(ui.rows), before);
});

for (const status of ["draft", "issued"]) test(`existing ${status} opens canonical invoice, never a second preparation`, async () => {
  const ui = billing(); ui.linkInvoice(status);
  // A consolidated invoice can link other orders without changing the target.
  ui.rows.invoice_orders.push({ organization_id: "org-a", order_id: "order-b", invoice_id: "invoice-a", is_active: true });
  const before = JSON.stringify(ui.rows);
  assert.deepEqual(normalize(await ui.entry()), { kind: status, href: "/app/billing/invoice-a" });
  const action = await ui.action();
  assert.equal(action.props.href, "/app/billing/invoice-a");
  assert.equal(content(action), ui.messages.billing.entry[status]);
  await assert.rejects(ui.page(), (error) => error.href === "/it/app/billing/invoice-a");
  assert.equal(ui.calls.rpc.length, 0);
  assert.equal(JSON.stringify(ui.rows), before);
});

test("cancelled invoice remains historical and inactive link permits canonical preparation", async () => {
  const ui = billing(); ui.linkInvoice("cancelled");
  const before = JSON.stringify(ui.rows);
  assert.equal((await ui.entry()).kind, "prepare");
  assert.equal(JSON.stringify(ui.rows), before);
});

test("manager access reuses Billing without requiring POS or a POS session", async () => {
  const ui = billing({ role: "manager" });
  assert.equal((await ui.entry()).kind, "prepare");
  assert.ok(ui.calls.entitlement.every(([, feature]) => feature === "billing.invoicing"));
});

test("missing customer fiscal fields retain the existing completion panel and block the draft form", async () => {
  const ui = billing(); ui.rows.customers[0].billing_city = null;
  const tree = await ui.page();
  const panel = nodes(tree).find((node) => node.type === "fiscal-panel");
  assert.equal(panel.props.context.isFiscalReady, false);
  assert.ok(panel.props.context.missingRequiredFields.includes("billingCity"));
  assert.equal(nodes(tree).some((node) => typeof node.type === "function" && node.type.name === "BillingCreateForm"), false);
});

test("Billing without an order parameter preserves the general discovery path", async () => {
  const ui = billing();
  await ui.page({});
  assert.equal(ui.calls.reads.some(({ table }) => ["orders", "invoice_orders", "invoices"].includes(table)), false);
  assert.equal(ui.calls.rpc.length, 1);
  assert.equal(ui.calls.rpc[0].args.target_order_id, null);
});

for (const change of ["cancelled", "inactive"]) test(`${change} order is unavailable without a preparation form`, async () => {
  const ui = billing();
  if (change === "cancelled") ui.rows.orders[0].production_status = "cancelled";
  else ui.rows.orders[0].is_active = false;
  assert.deepEqual(normalize(await ui.entry()), { kind: "unavailable", reason: "ineligible" });
  const tree = await ui.page();
  assert.ok(content(tree).includes(ui.messages.billing.entry.ineligible));
  assert.equal(nodes(tree).some((node) => node.type === "form" || typeof node.type === "function"), false);
  assert.equal(nodes(await ui.action()).some((node) => node.type === "a"), false);
});

test("WALKIN-SHARED stays excluded even with forged URL customer, with a clear unavailable explanation", async () => {
  const ui = billing(); ui.rows.customers[0].customer_code = "WALKIN-SHARED";
  assert.deepEqual(normalize(await ui.entry()), { kind: "unavailable", reason: "sharedWalkIn" });
  const tree = await ui.page({ orderId: "order-a", customerId: "registered-other" });
  assert.ok(content(tree).includes(ui.messages.billing.entry.sharedWalkIn));
  assert.equal(nodes(tree).some((node) => node.type === "form" || typeof node.type === "function"), false);
  assert.equal(ui.calls.rpc.length, 0);
});

for (const config of [{ role: "staff" }, { entitled: false }]) test(`server access gate blocks reads: ${JSON.stringify(config)}`, async () => {
  const ui = billing(config);
  await assert.rejects(ui.entry(), (error) => error === (config.role ? ui.denied : ui.featureDenied));
  await assert.rejects(ui.page(), (error) => error === (config.role ? ui.denied : ui.featureDenied));
  assert.equal(ui.calls.reads.length, 0);
  assert.equal(ui.calls.rpc.length, 0);
});

test("foreign tenant order is not found; foreign links/documents do not affect navigation", async () => {
  const ui = billing();
  ui.rows.orders.push({ ...ui.rows.orders[0], id: "foreign", organization_id: "org-b" });
  await assert.rejects(ui.entry("foreign"), (error) => error === ui.missing);
  ui.linkInvoice("issued", { organizationId: "org-b" });
  assert.equal((await ui.entry()).kind, "prepare");
  for (const { filters } of ui.calls.reads) assert.ok(filters.some(([key, value]) => key === "organization_id" && value === "org-a"));
});

test("foreign invoice behind an inconsistent active link fails closed", async () => {
  const ui = billing(); ui.linkInvoice("issued"); ui.rows.invoices[0].organization_id = "org-b";
  await assert.rejects(ui.page(), /billing_order_entry_invalid_document/);
  assert.equal(ui.calls.rpc.length, 0);
});

for (const table of ["orders", "customers", "invoice_orders", "invoices", "rpc"]) test(`failed ${table} read propagates instead of offering a new invoice`, async () => {
  const ui = billing(); if (table === "invoices") ui.linkInvoice("issued");
  const failure = Error("Read unavailable"); ui.failures.set(table, failure);
  await assert.rejects(ui.page(), (error) => error === failure);
});

test("new navigation rechecks current state if another operator prepares the invoice", async () => {
  const ui = billing(); assert.equal((await ui.entry()).kind, "prepare");
  ui.linkInvoice("draft");
  await assert.rejects(ui.page(), (error) => error.href === "/it/app/billing/invoice-a");
});

for (const locale of ["it", "es", "en", "fr", "de"]) test(`${locale}: translated prepare/draft/issued/unavailable action and localized redirect`, async () => {
  const ui = billing({ locale });
  assert.equal(content(await ui.action()), ui.messages.billing.entry.prepare);
  assert.equal((await ui.action()).props.href, "/app/billing/new?orderId=order-a");
  for (const label of Object.values(ui.messages.billing.entry)) {
    assert.ok(label.trim()); assert.doesNotMatch(label, /common\.billing\./);
  }
  ui.linkInvoice("issued");
  await assert.rejects(ui.page(), (error) => error.href === `/${locale}/app/billing/invoice-a`);
});

test("Order detail renders the shared action only for Billing-entitled owner/manager", () => {
  const page = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
  assert.match(page, /canManageAssignments = access\.membership\.role === "owner" \|\| access\.membership\.role === "manager"/);
  assert.match(page, /getCurrentEntitlements\(locale, \[FEATURES\.pos, FEATURES\.printing, FEATURES\.billingInvoicing\]\)/);
  assert.match(page, /canManageAssignments && entitlementEnabled\(entitlements, FEATURES\.billingInvoicing\) \? <BillingOrderEntry locale=\{locale\} orderId=\{order\.id\} \/> : null/);
});

for (const canInvoice of [true, false]) for (const isWalkIn of [true, false]) test(`Terminal success Billing link: authorization=${canInvoice}, walk-in=${isWalkIn}`, async () => {
  const ui = terminal(); ui.props.canInvoice = canInvoice;
  assert.equal(nodes(ui.render()).some((node) => node.props.href?.startsWith("/app/billing/")), false);
  const request = ui.start();
  ui.response.resolve({ error: null, result: { customerId: customer.id, customerName: "A", isWalkIn,
    orderId: "order-a", orderNumber: "MEMORY-ONLY", total: 36, paid: 0, outstanding: 36 } });
  await request.settled;
  const link = nodes(ui.render()).find((node) => node.props.href?.startsWith("/app/billing/"));
  assert.equal(Boolean(link), canInvoice && !isWalkIn);
  if (link) {
    assert.equal(link.props.href, "/app/billing/new?orderId=order-a&source=shop");
    const billingUi = billing(); const query = Object.fromEntries(new URL(link.props.href, "https://memory.invalid").searchParams);
    assert.ok(nodes(await billingUi.page(query)).some((node) => node.props.selectedOrderId === "order-a"));
  }
  assert.equal(ui.calls.submit.length, 1);
  assert.equal(ui.calls.status.length, 0);
});
