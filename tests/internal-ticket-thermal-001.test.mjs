import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const messages = (locale) => JSON.parse(read(`src/i18n/${locale}/common.json`));
const feature = "src/features/printer-settings/";
const documentPath = "src/components/printing/OrderPrintDocument.tsx";
function load(path, imports = {}, source = read(path)) {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, console: { error() {} }, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name === "react/jsx-runtime") return require(name);
    if (name === "server-only") return {};
    throw Error(`Unexpected import: ${name}`);
  } }, { filename: path });
  return compiledModule.exports;
}
const locA = "11111111-1111-4111-8111-111111111111";
const locB = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const profile = (paperFormat = "ticket_a4", extra = {}) => ({
  id: "44444444-4444-4444-8444-444444444444", locationId: locA, locationName: "Shop A",
  displayName: "Internal printer", purpose: "ticket", enabled: true, isDefault: true,
  connectionMode: "browser", paperFormat, ...extra,
});
function fixture(selected = null) {
  return {
    organizationName: "Laundry", locationName: "Shop A", timezone: "Atlantic/Canary",
    branding: { brand: { name: "Laundry", logoPath: null }, support: {} },
    barcodeEnabled: true, createdByName: "STAFF_OPERATOR", customerPhone: "SYNTHETIC_PHONE",
    order: { id: orderId, orderNumber: "EW-THERMAL-TEST", customerName: "Synthetic customer",
      createdAt: "2026-11-09T09:00:00Z", dueAt: "2026-11-10T12:00:00Z",
      customerNotes: "CUSTOMER_TREATMENT_WARNING", internalNotes: "CONFIDENTIAL_INTERNAL_NOTE",
      currency: "EUR", subtotal: 20, discountAmount: 2, total: 18 },
    items: [{ id: "item-1", description: "Synthetic shirt", quantity: 2, unitType: "piece",
      notes: "CONFIDENTIAL_ITEM_NOTE", unitPrice: 10, lineTotal: 20 }],
    logistics: { pickup: { status: "scheduled", scheduledAt: "2026-11-09T10:00:00Z" },
      delivery: { status: "scheduled", scheduledAt: "2026-11-10T13:00:00Z" } },
    paymentSummary: { paymentStatus: "partially_paid", totalPaid: 5, balanceDue: 13 },
    payments: [], quickDropFinancialState: null, printerProfiles: selected ? { ticket: selected } : {},
  };
}
const documentImports = {
  "next/image": { default: "img" },
  "next-intl/server": { getTranslations: async ({ locale, namespace }) => {
    const dictionary = namespace.split(".").slice(1).reduce((obj, key) => obj[key], messages(locale));
    return (key) => {
      const value = key.split(".").reduce((obj, part) => obj?.[part], dictionary);
      assert.equal(typeof value, "string", `Missing ${locale}:${namespace}.${key}`);
      return value;
    };
  } },
  "@/components/printing/PrintButton": { PrintButton: ({ label }) => React.createElement("button", null, label) },
  "@/features/printing/labels": { buildPrintLabels: () => [] },
  "@/i18n/navigation": { Link: ({ href, children }) => React.createElement("a", { href }, children) },
  "@/lib/number-format": load("src/lib/number-format.ts"),
  "@/components/barcode/ScannableQrCode": load("src/components/barcode/ScannableQrCode.tsx", { qrcode: { default: require("qrcode") } }),
  "@/features/barcode/payload": load("src/features/barcode/payload.ts"),
  "@/lib/organization-timezone": { formatOrganizationDateTime: (value) => value },
};
const Document = load(documentPath, documentImports).OrderPrintDocument;
async function resolveTree(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === "function") {
    const rendered = await node.type(node.props);
    return resolveTree(React.isValidElement(rendered) && node.key !== null ? React.cloneElement(rendered, { key: node.key }) : rendered);
  }
  const children = await resolveTree(node.props.children);
  return React.cloneElement(node, { children });
}
const render = async (context, locale = "it", mode = "ticket", customerCopyFormat) =>
  renderToStaticMarkup(await resolveTree(await Document({ context, locale, mode, customerCopyFormat })));
const article = (html) => html.match(/<article[\s\S]*<\/article>/)[0];
// Captured from the unchanged A4 renderer at baseline 0835407, using this synthetic fixture.
const historicalA4 = {
  it: "9396aba68f1f7f9c6386db5e5c4f955c55b10ba3153fcf7bba4187c23547df83",
  es: "a65570326bd304e0e5c5629c7741deaf7b70b58c0dbc519beb0ebec751801f5a",
  en: "8b8a9748574d622863dec0978de69a22ab1efe7cc8bcfc8bd0fb891b74ee84d8",
  fr: "1ae312430be6f023158f6419c181dc656b0b153806ced3a7a30fc84a088fa87a",
  de: "86dfcd83fce31c5e8276af7d8cececac414e9c27238dcb432999d95fc060d879",
};
for (const locale of ["it", "es", "en", "fr", "de"]) {
  test(`${locale}: A4 content matches the pre-mission baseline, including PDF fallback`, async () => {
    for (const selected of [null, profile("ticket_a4"), profile("browser_pdf")]) {
      const html = await render(fixture(selected), locale);
      assert.equal(createHash("sha256").update(article(html)).digest("hex"), historicalA4[locale]);
      assert.doesNotMatch(html, /order-print-ticket-(?:thermal|58mm|80mm)/);
    }
  });
  for (const width of ["58mm", "80mm"]) {
    test(`${locale}: ${width} retains all A4 operational data, private notes and the same real QR`, async () => {
      const context = fixture(profile(`ticket_${width}`));
      const before = JSON.stringify(context);
      const html = await render(context, locale);
      const a4 = await render(fixture(), locale);
      assert.ok(html.includes(`order-print-ticket-${width} order-print-ticket-thermal`));
      for (const text of ["Laundry", "Shop A", "EW-THERMAL-TEST", "Synthetic customer", "Synthetic shirt",
        "STAFF_OPERATOR", "SYNTHETIC_PHONE", "CUSTOMER_TREATMENT_WARNING", "CONFIDENTIAL_INTERNAL_NOTE",
        "CONFIDENTIAL_ITEM_NOTE", context.order.createdAt, context.order.dueAt,
        context.logistics.pickup.scheduledAt, context.logistics.delivery.scheduledAt]) assert.ok(html.includes(text), text);
      const t = messages(locale).print;
      for (const label of [t.fields.quantity, t.fields.unit, t.fields.itemNotes]) assert.ok(html.includes(`data-label="${label}"`));
      for (const text of [t.ticket.internalTicket, t.paymentStatuses.partially_paid, t.units.piece, t.logistics.pickup, t.logistics.delivery]) assert.ok(html.includes(text), text);
      assert.equal(html.match(/<svg[\s\S]*?<\/svg>/)[0], a4.match(/<svg[\s\S]*?<\/svg>/)[0]);
      assert.equal(JSON.stringify(context), before);
    });
  }
}
test("invalid, wrong-purpose, disabled and non-default profiles fall back to historical A4", async () => {
  for (const selected of [profile("invalid"), profile("receipt_58mm"), profile("label_custom"),
    profile("ticket_58mm", { purpose: "receipt" }), profile("ticket_80mm", { enabled: false }),
    profile("ticket_58mm", { isDefault: false })]) {
    assert.equal(await render(fixture(selected)), await render(fixture()));
  }
});
test("thermal tickets preserve Quick Drop status, barcode entitlement and long operational content", async () => {
  for (const width of ["58mm", "80mm"]) {
    const context = fixture(profile(`ticket_${width}`));
    context.barcodeEnabled = false; context.quickDropFinancialState = "unpriced";
    context.order.internalNotes = "LONG_INTERNAL_NOTE_".repeat(150);
    context.items = Array.from({ length: 45 }, (_, i) => ({ ...context.items[0], id: `item-${i}`, description: `LONG_SERVICE_${i}_` + "x".repeat(180) }));
    const html = await render(context);
    assert.doesNotMatch(html, /<svg/);
    assert.ok(html.includes(messages("it").quickDrop.unpriced));
    assert.ok(html.includes(context.order.internalNotes));
    for (const item of context.items) assert.ok(html.includes(item.description));
  }
});
test("a thermal ticket default cannot alter customer copy, receipt or labels", async () => {
  for (const mode of ["customer-copy", "receipt", "labels"]) {
    for (const selected of [profile("ticket_58mm"), profile("ticket_80mm")]) {
      const html = await render(fixture(selected), "it", mode);
      assert.equal(html, await render(fixture(), "it", mode));
      assert.doesNotMatch(html, /order-print-ticket-(?:thermal|58mm|80mm)/);
      if (mode === "customer-copy") assert.doesNotMatch(html, /CONFIDENTIAL|STAFF_OPERATOR|SYNTHETIC_PHONE/);
    }
  }
});

const types = load(feature + "types.ts");
function action(denied = false) {
  const calls = [];
  const mod = load(feature + "server/actions.ts", {
    "@/features/printer-settings/types": types,
    "@/features/printer-settings/server/access": { requirePrinterSettingsAccess: async () => { if (denied) throw Error("access denied"); } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ rpc: async (name, args) => {
      calls.push([name, args]); return { data: profile().id, error: null };
    } }) },
    "next/cache": { revalidatePath() {} },
  });
  return { calls, save: mod.savePrinterProfileAction };
}
const form = (purpose, paperFormat) => new Map([
  ["locationId", locA], ["displayName", "Internal printer"], ["purpose", purpose], ["paperFormat", paperFormat],
  ["connectionMode", "browser"], ["enabled", "true"], ["isDefault", "true"], ["organization_id", "foreign-tenant"],
]);
test("ticket formats use the existing authorized save RPC without client tenant context", async () => {
  for (const format of ["ticket_a4", "ticket_58mm", "ticket_80mm", "browser_pdf"]) {
    const a = action(); assert.equal((await a.save("it", undefined, form("ticket", format))).success, true);
    assert.equal(a.calls.length, 1); assert.equal(a.calls[0][0], "save_printer_profile");
    assert.equal(a.calls[0][1].target_purpose, "ticket"); assert.equal(a.calls[0][1].target_paper_format, format);
    assert.equal(a.calls[0][1].target_location_id, locA);
    assert.ok(!Object.keys(a.calls[0][1]).some((key) => /organization/.test(key)));
  }
});
test("cross-purpose formats and unauthorized changes cannot reach the save RPC", async () => {
  for (const [purpose, format] of [["ticket", "receipt_58mm"], ["ticket", "label_custom"],
    ["receipt", "ticket_58mm"], ["label", "ticket_80mm"], ["ticket", "invalid"]]) {
    const a = action(); assert.equal((await a.save("it", undefined, form(purpose, format))).error, "validation");
    assert.equal(a.calls.length, 0);
  }
  const a = action(true); await assert.rejects(a.save("it", undefined, form("ticket", "ticket_58mm")), /access denied/);
  assert.equal(a.calls.length, 0);
});
test("the existing profile editor offers thermal formats only for ticket purpose", () => {
  const values = new Map(); let index = 0;
  const { PrinterSettingsWorkspace } = load("src/components/printer-settings/PrinterSettingsWorkspace.tsx", {
    react: { useActionState: () => [{ error: null, success: false }, () => {}, false],
      useState(initial) { const key = index++; if (!values.has(key)) values.set(key, initial); return [values.get(key), (value) => values.set(key, value)]; } },
  });
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    return React.isValidElement(node) ? [node, ...nodes(node.props.children)] : [];
  }
  const renderUi = () => { index = 0; return nodes(PrinterSettingsWorkspace({ action() {}, locations: [{ id: locA, name: "Shop A" }], profiles: [], text: messages("it").printerSettings.labels })); };
  for (const purpose of ["ticket", "receipt", "label"]) {
    renderUi().find((n) => n.type === "select" && n.props.name === "purpose").props.onChange({ target: { value: purpose } });
    const select = renderUi().find((n) => n.type === "select" && n.props.name === "paperFormat");
    const options = nodes(select).filter((n) => n.type === "option").map((n) => n.props.value);
    assert.deepEqual(options, purpose === "ticket" ? ["ticket_a4", "ticket_58mm", "ticket_80mm", "browser_pdf"]
      : purpose === "receipt" ? ["receipt_58mm", "receipt_80mm", "browser_pdf"] : ["label_custom", "browser_pdf"]);
    assert.equal(select.props.value, purpose === "ticket" ? "ticket_a4" : purpose === "receipt" ? "receipt_80mm" : "label_custom");
  }
});
test("default profile reads remain tenant/site scoped and ignore disabled/non-default profiles", async () => {
  const rows = [
    { organization_id: "tenant-A", location_id: locA, purpose: "ticket", paper_format: "ticket_58mm", enabled: true, is_default: true },
    { organization_id: "tenant-A", location_id: locB, purpose: "ticket", paper_format: "ticket_80mm", enabled: true, is_default: true },
    { organization_id: "tenant-B", location_id: locA, purpose: "ticket", paper_format: "ticket_a4", enabled: true, is_default: true },
    { organization_id: "tenant-A", location_id: locA, purpose: "ticket", paper_format: "ticket_80mm", enabled: false, is_default: true },
    { organization_id: "tenant-A", location_id: locA, purpose: "ticket", paper_format: "ticket_80mm", enabled: true, is_default: false },
  ];
  for (const [org, location, expected] of [["tenant-A", locA, "ticket_58mm"], ["tenant-A", locB, "ticket_80mm"],
    ["tenant-B", locA, "ticket_a4"], ["tenant-B", locB, null], ["tenant-A", null, null]]) {
    const calls = []; let filtered = rows;
    const chain = { select() { return chain; }, eq(key, value) { calls.push([key, value]); filtered = filtered.filter((r) => r[key] === value); return chain; },
      returns: async () => ({ data: filtered, error: null }) };
    const queries = load(feature + "server/queries.ts", {
      "@/features/printing/server/access": { requirePrintAccess: async () => ({ membership: { organization: { id: org } } }) },
      "@/features/printer-settings/server/access": {},
      "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ from: (table) => { assert.equal(table, "printer_profiles"); return chain; } }) },
    });
    const defaults = await queries.getDefaultPrinterProfiles("it", location);
    assert.equal(defaults.ticket?.paperFormat ?? null, expected);
    if (location) assert.deepEqual(calls, [["organization_id", org], ["location_id", location], ["enabled", true], ["is_default", true]]);
    else assert.equal(calls.length, 0);
  }
});
test("migration only widens the two approved constraints, retaining old formats and other purposes", () => {
  const paths = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((p) => p.endsWith("_internal_ticket_thermal_001.sql"));
  assert.equal(paths.length, 1);
  const sql = read(`supabase/migrations/${paths[0]}`).replace(/--[^\n]*/g, "").trim();
  assert.equal((sql.match(/;/g) || []).length, 1);
  assert.match(sql, /^alter table public\.printer_profiles/);
  assert.deepEqual([...sql.matchAll(/drop constraint (\w+)/g)].map((m) => m[1]), ["printer_profiles_paper_format", "printer_profiles_ticket_format"]);
  assert.deepEqual([...sql.matchAll(/add constraint (\w+)/g)].map((m) => m[1]), ["printer_profiles_paper_format", "printer_profiles_ticket_format"]);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate|create|policy|grant|revoke|function|trigger)\b/i);
  for (const format of types.PRINTER_PAPER_FORMATS) assert.ok(sql.includes(`'${format}'`));
  assert.match(sql, /purpose <> 'ticket' or paper_format in \('ticket_a4', 'ticket_58mm', 'ticket_80mm', 'browser_pdf'\)/);
});
test("thermal CSS is isolated, readable and keeps browser pagination and real QR space", () => {
  const css = read("src/styles/globals.css");
  assert.match(css, /\.order-print-ticket-58mm \{ --internal-ticket-width: 58mm;/);
  assert.match(css, /\.order-print-ticket-80mm \{ --internal-ticket-width: 80mm;/);
  assert.match(css, /\.order-print-ticket-thermal \.print-ticket-sheet \{[^}]*box-sizing: border-box;[^}]*padding: 3mm;[^}]*overflow-wrap: anywhere;/);
  assert.match(css, /\.order-print-ticket-thermal \.print-ticket-qr \{ width: 30mm;/);
  assert.match(css, /@page internal-ticket-roll \{ size: auto; margin: 0; \}/);
  assert.match(css, /\.order-print-ticket-thermal \{ page: internal-ticket-roll; position: static;/);
  assert.match(css, /\.order-print-ticket-thermal \.print-items-table td\[data-label\]::before \{ content: attr\(data-label\)/);
});
