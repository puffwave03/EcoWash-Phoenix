import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Only actual local action/query/panel execution with doubles and static SQL
// contracts. No SQL is applied; these tests do NOT prove PostgreSQL concurrency,
// runtime RLS, fiscal eligibility or an implemented simplified issuance path.
const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationFile = "20261017000100_billing_simplified_invoice_001d_series_configuration.sql";
const sql = read(`supabase/migrations/${migrationFile}`).replace(/--[^\n]*/g, "");
const locales = ["it", "es", "en", "fr", "de"];
const labels = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(read(`src/i18n/${locale}/common.json`)).billing]));

function harness({ role = "owner", entitled = true, rpcError = null, transportFailure = false,
  entry = { kind: "issued", href: "/app/billing/memory-invoice" }, entryError = null } = {}) {
  const calls = { owners: 0, clients: 0, rpc: [], reads: [], revalidations: [], entry: [], operationalReceipt: 0, prints: 0 };
  const stored = { organization_id: "org-a", default_series: "MEM-A", default_tax_rate: 7,
    simplified_series: "MEM-S", issuer_legal_name: "Memory issuer" };
  const membership = { role, organization: { id: "org-a", name: "Memory tenant" } };
  const check = (roles) => { if (!roles.includes(role)) throw Error("ROLE_DENIED"); return { membership }; };
  const supabase = {
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      if (transportFailure) throw Error("RESPONSE_LOST");
      return { error: rpcError, data: null };
    },
    from(table) {
      assert.ok(["organization_billing_settings", "organization_branding"].includes(table));
      const call = { table, filters: [], select: "" }; calls.reads.push(call);
      return { select(s) { call.select = s; return this; }, eq(k, v) { call.filters.push([k, v]); return this; },
        async maybeSingle() {
          assert.deepEqual(call.filters, [["organization_id", "org-a"]]);
          return { error: null, data: table === "organization_billing_settings" ? stored : null };
        } };
    },
  };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const m = { exports: {} };
    const localRequire = (name) => {
      if (name === "server-only" || name === "@/features/billing/pagination") return {};
      if (name === "react/jsx-runtime") return require(name);
      if (name === "next/cache") return { revalidatePath: (path) => calls.revalidations.push(path) };
      if (name === "next/navigation") return { redirect(href) { throw Object.assign(Error("REDIRECT"), { href }); }, notFound() { throw Error("NOT_FOUND"); } };
      if (name === "@/features/billing/server/order-entry") return { getBillingOrderEntry: async (locale, orderId) => {
        check(["owner", "manager"]); if (!entitled) throw Error("ENTITLEMENT_DENIED");
        calls.entry.push({ locale, orderId }); if (entryError) throw entryError; return entry;
      } };
      if (name === "@/features/sales-documents/server/actions") return { issueOperationalReceipt: async () => {
        calls.operationalReceipt++; return { status: "issued", id: "operational-memory" };
      } };
      if (name === "@/lib/auth/require-role") return {
        requireOwner: async () => { calls.owners++; return check(["owner"]); },
        requireOwnerOrManager: async () => check(["owner", "manager"]),
      };
      if (name === "@/features/entitlements/server/resolver") return { requireEntitlement: async () => {
        if (!entitled) throw Error("ENTITLEMENT_DENIED");
      } };
      if (name === "@/features/entitlements/feature-catalog") return { FEATURES: { billingInvoicing: "billing.invoicing" } };
      if (name === "@/lib/supabase/server") return { createSupabaseServerClient: async () => { calls.clients++; return supabase; } };
      if (name === "@/components/Button") return { Button: ({ children, type }) => createElement("button", { type }, children) };
      if (name === "@/components/DisclosureSection") return { DisclosureSection: ({ children }) => createElement("section", null, children) };
      if (name === "next-intl/server") return { getTranslations: async ({ locale }) => (key) => {
        const text = key.split(".").reduce((o, k) => o?.[k], labels[locale]);
        assert.equal(typeof text, "string", `${locale}:${key}`); return text;
      } };
      if (name === "@/lib/number-format") return load("src/lib/number-format.ts");
      if (name === "@/components/Card") return { Card: ({ children }) => createElement("section", null, children) };
      if (name === "@/components/billing/BillingStatusBadge") return { BillingStatusBadge: ({ label }) => createElement("span", null, label) };
      if (name === "@/components/billing/PrintInvoiceButton") return load("src/components/billing/PrintInvoiceButton.tsx");
      if (name === "@/i18n/navigation") return { Link: ({ children, href }) => createElement("a", { href }, children) };
      if (name.startsWith("@/features/billing/")) return load(`src/${name.slice(2)}.ts`);
      throw Error(`Unexpected import: ${name}`);
    };
    const code = ts.transpileModule(read(path), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    runInNewContext(code, { module: m, exports: m.exports, require: localRequire, window: { print: () => { calls.prints++; } } }, { filename: path });
    cache.set(path, m.exports); return m.exports;
  }
  return { calls, stored, load,
    reserve: (data) => load("src/features/billing/server/actions.ts").reserveBillingSimplifiedSeriesAction("es", data),
    settings: () => load("src/features/billing/server/queries.ts").getBillingSettings("es"),
  };
}

function form(values = ["MEM-S"]) {
  const data = new FormData();
  for (const v of values) data.append("simplifiedSeries", v);
  return data;
}

for (const [input, result] of [["  mem-s  ", "MEM-S"], ["A", "A"], ["X".repeat(12), "X".repeat(12)]]) {
  test(`series parser accepts syntax without assigning a tenant default: ${input}`, () => {
    const parse = harness().load("src/features/billing/simplified-series.ts").parseBillingSimplifiedSeries;
    assert.equal(parse([input]), result);
  });
}

for (const values of [[], [""], [" "], ["X".repeat(13)], ["MEM S"], ["MEM/S"], ["MEM\nS"], ["É"], ["ß"], ["ı"], ["ſ"], ["A", "B"], ["A", "A"]]) {
  test(`invalid or ambiguous series is rejected before any client: ${JSON.stringify(values)}`, async () => {
    const ui = harness();
    await assert.rejects(ui.reserve(form(values)), (e) => e.href?.endsWith("error=simplifiedSeriesInvalid"));
    assert.equal(ui.calls.clients, 0); assert.equal(ui.calls.rpc.length, 0);
  });
}

test("uploaded non-string input is not coerced into a series", () => {
  const parse = harness().load("src/features/billing/simplified-series.ts").parseBillingSimplifiedSeries;
  for (const v of [null, 123, { toString: () => "MEM-S" }]) assert.equal(parse([v]), null);
});

for (const role of ["manager", "staff", "customer"]) test(`${role} cannot reserve a fiscal series`, async () => {
  const ui = harness({ role });
  await assert.rejects(ui.reserve(form()), /ROLE_DENIED/);
  assert.equal(ui.calls.clients, 0);
});

test("Owner still requires Billing entitlement before any database client", async () => {
  const ui = harness({ entitled: false });
  await assert.rejects(ui.reserve(form()), /ENTITLEMENT_DENIED/);
  assert.equal(ui.calls.clients, 0);
});

test("reservation sends only the declared series, ignoring forged tenant and activation fields", async () => {
  const ui = harness(), data = form(["  mem-s "]);
  for (const k of ["organization_id", "simplified_invoicing_enabled", "declared_tax_regime_code", "default_series", "invoice_id"]) data.set(k, "FORGED");
  await assert.rejects(ui.reserve(data), (e) => e.href === "/es/app/billing?saved=settings");
  assert.equal(ui.calls.owners, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.calls.rpc)), [{ name: "reserve_billing_simplified_series", args: { target_series: "MEM-S" } }]);
  assert.deepEqual(ui.calls.revalidations, ["/es/app/billing"]);
});

for (const [message, error] of [["billing_simplified_series_used", "simplifiedSeriesUsed"],
  ["billing_series_reserved_for_simplified", "simplifiedSeriesUsed"],
  ["billing_simplified_series_invalid", "simplifiedSeriesInvalid"], ["billing_settings_required", "simplifiedSeriesSettings"],
  ["billing_settings_not_authorized", "unauthorized"], ["unexpected database error", "generic"]]) {
  test(`database rejection remains visible without another call: ${message}`, async () => {
    const ui = harness({ rpcError: { message } });
    await assert.rejects(ui.reserve(form()), (e) => e.href?.endsWith(`error=${error}`));
    assert.equal(ui.calls.rpc.length, 1); assert.deepEqual(ui.calls.revalidations, []);
  });
}

test("lost response does not cause retry, a new series, counter allocation or fiscal emission", async () => {
  const ui = harness({ transportFailure: true });
  await assert.rejects(ui.reserve(form()), /RESPONSE_LOST/);
  assert.equal(ui.calls.rpc.length, 1); assert.equal(ui.calls.rpc[0].args.target_series, "MEM-S");
  const before = JSON.stringify(ui.stored);
  assert.equal((await ui.settings()).simplifiedSeries, "MEM-S");
  assert.equal(JSON.stringify(ui.stored), before);
});

test("two concurrent action calls retain the same reservation identity and never invoke numbering (RPC double)", async () => {
  const ui = harness();
  const results = await Promise.allSettled([ui.reserve(form()), ui.reserve(form())]);
  assert.ok(results.every((r) => r.status === "rejected" && r.reason.href === "/es/app/billing?saved=settings"));
  assert.equal(ui.calls.rpc.length, 2);
  for (const call of ui.calls.rpc) {
    assert.equal(call.name, "reserve_billing_simplified_series");
    assert.equal(call.args.target_series, "MEM-S");
    assert.deepEqual(Object.keys(call.args), ["target_series"]);
  }
});

test("series read uses the deployed canonical field and authenticated tenant filter", async () => {
  const ui = harness();
  assert.equal((await ui.settings()).simplifiedSeries, "MEM-S");
  const read = ui.calls.reads.find((c) => c.table === "organization_billing_settings");
  assert.match(read.select, /simplified_series/);
  ui.stored.simplified_series = null;
  assert.equal((await ui.settings()).simplifiedSeries, null);
});

for (const locale of locales) test(`${locale}: explicit disabled status, no default series and separate reservation form`, async () => {
  const ui = harness(); ui.stored.simplified_series = null;
  const settings = await ui.settings();
  const Panel = ui.load("src/components/billing/BillingSettingsPanel.tsx").BillingSettingsPanel;
  const before = JSON.stringify(settings);
  const html = renderToStaticMarkup(Panel({ locale, settings, text: labels[locale].settings }));
  assert.equal((html.match(/<form/g) ?? []).length, 2);
  assert.match(html, /name="simplifiedSeries"[^>]*value=""/);
  assert.match(html, /aria-describedby="billing-simplified-series-help"/);
  assert.ok(html.includes(labels[locale].settings.simplifiedSeriesTitle));
  assert.ok(html.includes(labels[locale].settings.simplifiedSeriesHelp));
  assert.doesNotMatch(html, /common\.billing\.|name="simplified_invoicing_enabled"|name="fiscal_territory_code"/);
  assert.equal(JSON.stringify(settings), before);
  for (const k of ["simplifiedSeriesInvalid", "simplifiedSeriesUsed", "simplifiedSeriesSettings"]) assert.equal(typeof labels[locale].errors[k], "string");
});

test("one available migration prepares ownership and reservation, with no activation or fiscal rule", () => {
  const names = readdirSync(new URL("../supabase/migrations/", import.meta.url));
  assert.equal(names.filter((n) => n.startsWith("20261017000100_")).length, 1);
  assert.equal(names.filter((n) => n < migrationFile).sort().at(-1), "20261016000300_billing_simplified_invoice_001c_series_reservation.sql");
  assert.match(sql.trim(), /^begin;/); assert.match(sql.trim(), /commit;$/);
  assert.doesNotMatch(sql, /\b(?:drop|disable|delete from|truncate|create policy)\b/i);
  assert.doesNotMatch(sql, /set simplified_invoicing_enabled|tax_rate|\b(?:3000|400)\b|EcoWash|IGIC/i);
  assert.equal((sql.match(/create table/g) ?? []).length, 1);
  assert.equal((sql.match(/create function/g) ?? []).length, 4);
  assert.equal((sql.match(/grant execute/g) ?? []).length, 1);
});

test("RPC derives organization, restricts Owner and entitlement and never assigns a number or creates settings", () => {
  const rpc = sql.slice(sql.indexOf("create function public.reserve_billing_simplified_series"));
  assert.match(rpc, /reserve_billing_simplified_series\(target_series text\)/);
  assert.match(rpc, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(rpc, /has_organization_role\(org_id, array\['owner'\]/);
  assert.match(rpc, /has_organization_entitlement\(org_id, 'billing\.invoicing'\)/);
  assert.match(rpc, /set simplified_series = normalized_series, updated_by = auth\.uid\(\)\s+where organization_id = org_id/);
  assert.match(rpc, /if not found then[\s\S]*billing_settings_required/);
  assert.doesNotMatch(rpc, /invoice_number|next_value|default_series|fiscal_territory|declared_tax/);
  assert.match(sql, /revoke all on function public\.guard_billing_series_reservation\(\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.reserve_billing_simplified_series\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.reserve_billing_simplified_series\(text\) to authenticated/);
  assert.equal((sql.match(/security definer\s+set search_path = public/g) ?? []).length, 3);
});

test("static concurrency contract: all writers claim the same UNIQUE ownership without isolation bans", () => {
  assert.match(sql, /primary key \(organization_id, series\)/);
  assert.match(sql, /on conflict \(organization_id, series\) do nothing/);
  assert.doesNotMatch(sql, /transaction_isolation|pg_advisory|do update/);
  const helper = sql.slice(sql.indexOf("create function public.claim_billing_series_ownership"), sql.indexOf("create function public.guard_billing_series_reservation"));
  assert.ok(helper.indexOf("insert into") < helper.indexOf("select fiscal_document_type into owned_type"));
  assert.match(helper, /if not found then[\s\S]*errcode = '40001'/);
  assert.match(helper, /if owned_type <> target_type then/);
  for (const [trigger, table] of [["organization_billing_settings_guard_series", "organization_billing_settings"],
    ["invoices_guard_reserved_series", "invoices"], ["billing_invoice_counters_guard_reserved_series", "billing_invoice_number_counters"]]) {
    assert.match(sql, new RegExp(`create trigger ${trigger}\\s+before insert or update[^;]*on public\\.${table}\\s+for each row execute function public\\.guard_billing_series_reservation\\(\\)`));
  }
  assert.match(sql, /claim_billing_series_ownership\(new.organization_id, claim.series, claim.fiscal_type\)/);
  assert.match(sql, /claim_billing_series_ownership\(new.organization_id, new.series, new.fiscal_document_type\)/);
});

test("static history includes every invoice status and orphan counters, independently of cancellation protection", () => {
  // Preserve the scoped regression: OLD.document_status belongs to the separate
  // cancellation guard, never to the history/backfill filters.
  const historyStart = sql.indexOf("with historical_series as");
  const historyEnd = sql.indexOf("create function public.protect_billing_series_ownership");
  assert.ok(historyStart >= 0 && historyEnd > historyStart, "history/backfill block must exist");
  const history = sql.slice(historyStart, historyEnd);
  assert.doesNotMatch(history, /document_status\s*=|\blimit\b|\bmax\(/i);
  for (const source of ["default_series as series", "simplified_series", "from public.invoices", "from public.billing_invoice_number_counters"]) {
    assert.ok(history.includes(source));
  }
  assert.match(history, /group by organization_id, series\s+having count\(distinct fiscal_document_type\) > 1/);
  assert.match(history, /raise exception 'billing_simplified_series_used'/);
  assert.ok(history.indexOf("raise exception") < history.indexOf("insert into public.billing_series_ownership"));
});

for (const table of ["invoices", "billing_invoice_number_counters"]) test(`static typed FK binds ${table} to the common ownership`, () => {
  assert.match(sql, new RegExp(`alter table public\\.${table}[\\s\\S]*?foreign key\\s+\\(organization_id, series, fiscal_document_type\\)\\s+references public\\.billing_series_ownership \\(organization_id, series, fiscal_document_type\\)`));
});

test("static ordinary counter default is gated by the disabled baseline; allocation and timestamps are untouched", () => {
  assert.match(sql, /conname = 'invoices_fiscal_document_type_ordinary_only' and convalidated/);
  assert.match(sql, /conname = 'organization_billing_settings_simplified_disabled' and convalidated/);
  assert.match(sql, /from public.invoices where fiscal_document_type <> 'ordinary'/);
  assert.ok(sql.indexOf("billing_series_unsupported_baseline") < sql.indexOf("add column fiscal_document_type"));
  assert.match(sql, /add column fiscal_document_type public.billing_fiscal_document_type\s+not null default 'ordinary'/);
  assert.doesNotMatch(sql, /update public\.(?:invoices|billing_invoice_number_counters)|insert into public\.(?:invoices|billing_invoice_number_counters)|next_value|set updated_at/);
});

test("static ownership is permanent, tenant-scoped and unavailable to direct client writers", () => {
  assert.match(sql, /organization_id uuid not null references public.organizations\(id\)/);
  assert.match(sql, /alter table public.billing_series_ownership enable row level security/);
  assert.match(sql, /revoke all on table public.billing_series_ownership from public, anon, authenticated/);
  assert.match(sql, /before update or delete on public.billing_series_ownership/);
  assert.match(sql, /raise exception 'billing_series_ownership_immutable'/);
  assert.match(sql, /revoke all on function public.claim_billing_series_ownership\(uuid, text, public.billing_fiscal_document_type\)\s+from public, anon, authenticated/);
});

test("static migration freezes historical sources; same-type steady-state reads do not update an owner", () => {
  assert.ok(sql.indexOf("lock table public.organization_billing_settings, public.invoices,") < sql.indexOf("with historical_series as"));
  assert.match(sql, /public.billing_invoice_number_counters in share row exclusive mode/);
  assert.match(sql, /set local lock_timeout = '5s'/);
  assert.match(sql, /order by series/);
  assert.doesNotMatch(sql, /exception when|update public.billing_series_ownership|delete from public.billing_series_ownership/);
});

test("both earlier guards and series foundation remain byte identical; no SQL definition replaces ordinary RPCs", () => {
  for (const [name, sha] of [
    ["20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql", "74f904597f2e802e684496fd7bd0724410108555763283a332debcc8db5e307b"],
    ["20261016000200_billing_fiscal_profile_001_minimal_configuration.sql", "d0abe9affbd95229233938ba87350bf9bfc352cec098ac569b339c72f4bfe8ab"],
    ["20261016000300_billing_simplified_invoice_001c_series_reservation.sql", "410b512e8499d3d174e990b551e9b641aff1e163d9b33148059df739b861536b"],
  ]) assert.equal(createHash("sha256").update(read(`supabase/migrations/${name}`)).digest("hex"), sha);
  assert.doesNotMatch(sql, /function public\.(create_billing_draft|issue_billing_invoice|update_billing_draft|cancel_billing_invoice)/);
  const gate = harness().load("src/features/billing/document-type.ts").validateBillingDocumentSelection;
  assert.equal(gate(["ordinary"]).allowed, true);
  assert.equal(gate(["simplified"]).allowed, false);
  assert.equal(gate(["simplified"]).reason, "simplifiedUnavailable");
});

// Synthetic future issued snapshots only: the deployed and proposed database
// guards still reject simplified documents. Rendering does not approve issuance.
function printFixture({ anonymous = false } = {}) {
  return {
    invoice: { id: "memory-invoice", fiscalDocumentType: "simplified", customerId: "memory-customer",
      documentStatus: "issued", paymentStatus: "partially_paid", invoiceNumber: "MEM-S-000001",
      series: "MEM-S", sequenceNumber: 1, issueDate: "2026-10-17", dueDate: null,
      issuerLegalName: "Memory issuer", issuerTaxId: "MEMORY-NOT-A-REAL-NIF", issuerAddressLine1: "Memory address",
      customerName: anonymous ? "" : "Memory recipient", customerTaxId: null, customerEmail: null,
      customerAddressLine1: anonymous ? null : "Memory recipient address", customerCity: null,
      customerAddressLine2: null, customerPostalCode: null, customerCountryCode: null,
      orderIds: ["memory-order"], orderNumbers: ["MEMORY-ORDER"], currency: "EUR", pricesIncludeTax: true,
      subtotal: 36, discountTotal: 0, taxableBase: 33.64, taxTotal: 2.36, total: 36, paidTotal: 2, outstanding: 34, notes: null },
    items: [{ id: "memory-line", sourceOrderId: "memory-order", description: "Memory laundry service",
      quantity: 4, unitType: "service", unitPrice: 9, lineSubtotal: 36, discountAmount: 0,
      taxableBase: 33.64, taxRate: 7, taxAmount: 2.36, lineTotal: 36 }],
    payments: [{ id: "memory-advance", amount: 2, method: "cash", status: "confirmed", paidAt: "2026-10-16" }],
  };
}

const elementNodes = (node) => Array.isArray(node) ? node.flatMap(elementNodes)
  : node?.props ? [node, ...elementNodes(node.props.children)] : [];

for (const locale of locales) test(`${locale}: one immutable invoice produces two identical fiscal bodies and one print control`, async () => {
  const ui = harness(), detail = printFixture(), before = JSON.stringify(detail);
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const html = renderToStaticMarkup(await View({ locale, detail, printMode: true }));
  assert.equal((html.match(/class="invoice-print-document /g) ?? []).length, 1);
  assert.equal((html.match(/class="billing-simplified-print-copy"/g) ?? []).length, 2);
  assert.ok(html.includes(labels[locale].document.customerCopy));
  assert.ok(html.includes(labels[locale].document.laundryCopy));
  const articles = html.match(/<article[\s\S]*?<\/article>/g);
  assert.equal(articles.length, 2); assert.equal(articles[0], articles[1]);
  assert.equal((html.match(/MEM-S-000001/g) ?? []).length, 2);
  assert.equal((html.match(/MEMORY-ORDER/g) ?? []).length, 2);
  assert.equal((html.match(/<button/g) ?? []).length, 1);
  assert.doesNotMatch(html, /common\.billing\.|name="reason"|name="issueDate"/);
  assert.equal(JSON.stringify(detail), before);
  assert.equal(ui.calls.clients, 0); assert.equal(ui.calls.rpc.length, 0);
});

test("both copies use a single history action and browser print, never an issue RPC", async () => {
  const ui = harness(); let history = 0;
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const Print = ui.load("src/components/billing/PrintInvoiceButton.tsx").PrintInvoiceButton;
  const tree = await View({ detail: printFixture(), locale: "es", printMode: true, printRequestedAction: async () => { history++; } });
  const buttons = elementNodes(tree).filter((n) => n.type === Print);
  assert.equal(buttons.length, 1); assert.equal(history, 0);
  await Print(buttons[0].props).props.onClick();
  assert.equal(history, 1); assert.equal(ui.calls.prints, 1); assert.equal(ui.calls.rpc.length, 0);
});

test("reprint stays identical after later order payments; no payment is fiscalized or added to the total", async () => {
  const ui = harness(), detail = printFixture();
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const first = renderToStaticMarkup(await View({ detail, locale: "es", printMode: true }));
  detail.invoice.paidTotal = 36; detail.invoice.outstanding = 0; detail.invoice.paymentStatus = "paid";
  detail.payments.push({ id: "memory-balance", amount: 34, method: "cash", status: "confirmed", paidAt: "2026-10-17" });
  const second = renderToStaticMarkup(await View({ detail, locale: "es", printMode: true }));
  assert.equal(first, second); assert.equal(detail.invoice.total, 36);
  assert.equal(ui.calls.rpc.length, 0);
});

test("anonymous synthetic snapshot prints no invented recipient, tax ID or address placeholder", async () => {
  const ui = harness(), detail = printFixture({ anonymous: true }), before = JSON.stringify(detail);
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const html = renderToStaticMarkup(await View({ detail, locale: "es", printMode: true }));
  assert.ok(!html.includes(labels.es.document.billTo));
  assert.ok(!html.includes(labels.es.document.addressPending));
  assert.doesNotMatch(html, /WALKIN-SHARED|Memory recipient/);
  assert.equal((html.match(/MEMORY-ORDER/g) ?? []).length, 2);
  assert.equal(JSON.stringify(detail), before);
  // This is NOT a persisted WALKIN-SHARED invoice or an enabled anonymous flow.
  assert.equal(ui.calls.clients, 0);
});

test("ordinary remains one copy with its existing financial presentation and print URL", async () => {
  const ui = harness(), detail = printFixture(); detail.invoice.fiscalDocumentType = "ordinary";
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const print = renderToStaticMarkup(await View({ detail, locale: "es", printMode: true }));
  assert.equal((print.match(/<article/g) ?? []).length, 1);
  assert.ok(print.includes(labels.es.totals.paid)); assert.ok(print.includes(labels.es.totals.outstanding));
  assert.doesNotMatch(print, /billing-simplified-print-copy/);
  const view = renderToStaticMarkup(await View({ detail, locale: "es" }));
  assert.match(view, /href="\/app\/billing\/memory-invoice\/print"/);
  assert.ok(view.includes(labels.es.actions.cancel));
});

test("simplified detail cannot offer ordinary cancellation as a fiscal correction", async () => {
  const ui = harness();
  const View = ui.load("src/components/billing/BillingInvoiceView.tsx").BillingInvoiceView;
  const html = renderToStaticMarkup(await View({ detail: printFixture(), locale: "es" }));
  assert.match(html, /\/orders\/memory-order\/print\/receipt\?document=fiscal/);
  assert.ok(html.includes(labels.es.document.simplifiedCorrectionBlocked));
  assert.doesNotMatch(html, /name="reason"/);
});

const receiptPage = "src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx";
function openReceipt(ui, document = "fiscal") {
  return ui.load(receiptPage).default({ params: Promise.resolve({ locale: "es", orderId: "memory-order" }),
    searchParams: document === undefined ? undefined : Promise.resolve({ document }) });
}

for (const kind of ["issued", "draft"]) test(`explicit fiscal receipt entry reuses the ${kind} document without a write`, async () => {
  const ui = harness({ entry: { kind, href: "/app/billing/memory-invoice" } });
  const target = `/es/app/billing/memory-invoice${kind === "issued" ? "/print" : ""}`;
  const results = await Promise.allSettled([openReceipt(ui), openReceipt(ui)]);
  assert.ok(results.every((r) => r.status === "rejected" && r.reason.href === target));
  assert.equal(ui.calls.entry.length, 2); assert.equal(ui.calls.operationalReceipt, 0);
  assert.equal(ui.calls.rpc.length, 0);
  assert.ok(ui.calls.entry.every((e) => e.locale === "es" && e.orderId === "memory-order"));
});

for (const entry of [{ kind: "prepare", customerId: "memory-customer", href: "unused" },
  { kind: "unavailable", reason: "sharedWalkIn" }, { kind: "unavailable", reason: "ineligible" }]) {
  test(`fiscal receipt entry cannot silently emit fiscal or operational data: ${JSON.stringify(entry)}`, async () => {
    const ui = harness({ entry });
    await assert.rejects(openReceipt(ui), (e) => e.href === "/es/app/billing/new?orderId=memory-order&error=simplifiedUnavailable");
    assert.equal(ui.calls.operationalReceipt, 0); assert.equal(ui.calls.rpc.length, 0);
  });
}

for (const error of [Error("READ_FAILED"), Error("RESPONSE_LOST"), Error("FOREIGN_ORDER_NOT_FOUND")]) {
  test(`failed/uncertain canonical fiscal lookup has no receipt fallback: ${error.message}`, async () => {
    const ui = harness({ entryError: error });
    await assert.rejects(openReceipt(ui), (e) => e === error);
    assert.equal(ui.calls.operationalReceipt, 0); assert.equal(ui.calls.rpc.length, 0);
  });
}

for (const options of [{ role: "staff" }, { role: "customer" }, { entitled: false }]) {
  test(`canonical role/entitlement failure never falls back to receipt issue: ${JSON.stringify(options)}`, async () => {
    const ui = harness(options);
    await assert.rejects(openReceipt(ui), /DENIED/);
    assert.equal(ui.calls.operationalReceipt, 0);
  });
}

for (const mode of ["", "ordinary", ["fiscal", "fiscal"], ["fiscal", "other"]]) test(`invalid fiscal-mode input is rejected without a write: ${JSON.stringify(mode)}`, async () => {
  const ui = harness(); await assert.rejects(openReceipt(ui, mode), /NOT_FOUND/);
  assert.equal(ui.calls.operationalReceipt, 0); assert.equal(ui.calls.entry.length, 0);
});

test("original receipt URL preserves the operational issue and persisted REC print route", async () => {
  const ui = harness();
  await assert.rejects(ui.load(receiptPage).default({ params: Promise.resolve({ locale: "es", orderId: "memory-order" }) }),
    (e) => e.href === "/es/app/accounting/documents/receipts/operational-memory/print");
  assert.equal(ui.calls.operationalReceipt, 1); assert.equal(ui.calls.entry.length, 0);
});

test("two-copy page rule is scoped to the single Billing print container", () => {
  const css = read("src/styles/globals.css");
  assert.match(css, /\.invoice-print-document \.billing-simplified-print-copy \+ \.billing-simplified-print-copy\s*\{\s*break-before: page;\s*margin-top: 0;/);
  assert.doesNotMatch(css, /\.billing-simplified-print-copy\s*\{[^}]*position:\s*absolute/);
});

test("unapproved advance/balance cases never create a simplified draft or fiscalize payment IDs", async () => {
  for (const alreadyDocumented of [false, true]) {
    const ui = harness(), data = new FormData();
    data.set("fiscalDocumentType", "simplified"); data.set("orderId", "memory-order");
    data.set("total", "7"); data.set("advancePaymentId", "memory-advance-2"); data.set("balancePaymentId", "memory-balance-5");
    data.set("advanceAlreadyFiscalized", String(alreadyDocumented));
    data.set("declared_tax_regime_code", "GENERAL"); data.set("taxRate", "7");
    await assert.rejects(ui.load("src/features/billing/server/actions.ts").createBillingDraftAction("es", "memory-customer", data),
      (e) => e.href?.endsWith("error=simplifiedUnavailable"));
    assert.equal(ui.calls.clients, 0); assert.equal(ui.calls.rpc.length, 0);
  }
});

test("SQL also blocks simplified issued-to-cancelled transitions pending a corrective fiscal workflow", () => {
  assert.match(sql, /if tg_table_name = 'invoices' and tg_op = 'UPDATE' then[\s\S]*old\.fiscal_document_type = 'simplified'[\s\S]*old\.document_status = 'issued'[\s\S]*new\.document_status is distinct from old\.document_status[\s\S]*billing_simplified_correction_workflow_required/);
  assert.match(sql, /before insert or update of organization_id, series, fiscal_document_type, document_status on public\.invoices/);
});
