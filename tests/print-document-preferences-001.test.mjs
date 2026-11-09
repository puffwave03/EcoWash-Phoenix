import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const feature = "src/features/printer-settings/";
const route = "src/app/[locale]/app/(dashboard)/orders/[orderId]/print/customer-copy/page.tsx";
const queryPath = feature + "server/document-preference-queries.ts";
const actionPath = feature + "server/document-preference-actions.ts";
const migration = read("supabase/migrations/20261108205704_print_document_preferences_001.sql");
function load(path, imports = {}) {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, console: { error() {} }, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name === "@/features/payments/read-error") return load("src/features/payments/read-error.ts", {});
    if (name === "@/components/payments/PaymentReadErrorNotice") return { PaymentReadErrorNotice: () => { throw Error("Unexpected payment read failure in success fixture"); } };
    if (name === "react/jsx-runtime") return require(name);
    if (name === "server-only") return {};
    if (name === "@/features/printer-settings/document-preferences") return preferences;
    throw Error(`Unexpected import: ${name}`);
  } }, { filename: path });
  return compiledModule.exports;
}
const preferences = load(feature + "document-preferences.ts");
const orgA = "00000000-0000-4000-8000-000000000001";
const orgB = "00000000-0000-4000-8000-000000000002";
const locA = "20000000-0000-4000-8000-000000000001";
const locB = "20000000-0000-4000-8000-000000000002";
const locForeign = "20000000-0000-4000-8000-000000000003";
const profileId = "30000000-0000-4000-8000-000000000001";
const state = { error: null, success: false };
const rows = [
  { organization_id: orgA, location_id: locA, document_type: "customer-copy", paper_format: "58mm", printer_profile_id: null },
  { organization_id: orgA, location_id: locB, document_type: "customer-copy", paper_format: "80mm", printer_profile_id: profileId },
  { organization_id: orgB, location_id: locForeign, document_type: "customer-copy", paper_format: "a4", printer_profile_id: null },
];
function queries({ organizationId = orgA, error = null, denied = false, dataRows = rows } = {}) {
  const calls = [];
  const guard = async (locale) => {
    calls.push(["access", locale]);
    if (denied) throw Error("access denied");
    return { membership: { organization: { id: organizationId } } };
  };
  const client = { from(table) {
    assert.equal(table, "document_print_preferences");
    const filters = [];
    const query = {
      select(columns) { calls.push(["select", columns]); return query; },
      eq(column, value) { filters.push([column, value]); calls.push([column, value]); return query; },
      returns: async () => ({ data: dataRows.filter((row) => filters.every(([k, v]) => row[k] === v)), error }),
      maybeSingle: async () => ({ data: dataRows.find((row) => filters.every(([k, v]) => row[k] === v)) ?? null, error }),
    };
    return query;
  } };
  return { calls, ...load(queryPath, {
    "@/features/printing/server/access": { requirePrintAccess: guard },
    "@/features/printer-settings/server/access": { requirePrinterSettingsAccess: guard },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => client },
  }) };
}
function action({ denied = false, error = null } = {}) {
  const calls = [], revalidated = [];
  return { calls, revalidated, ...load(actionPath, {
    "@/features/printer-settings/server/access": { requirePrinterSettingsAccess: async () => { if (denied) throw Error("access denied"); } },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ rpc: async (name, args) => {
      calls.push([name, args]); return { data: error ? null : profileId, error };
    } }) },
    "next/cache": { revalidatePath: (...args) => revalidated.push(args) },
  }) };
}
const form = (format = "a4", locationId = locA, profile = "") => new Map([
  ["paperFormat", format], ["locationId", locationId], ["printerProfileId", profile], ["organization_id", orgB],
]);

test("historical A4 without preferences; valid manual override precedes saved preference", () => {
  for (const saved of [undefined, null, "a4", "58mm", "80mm", "invalid"]) {
    for (const manual of ["a4", "58mm", "80mm"]) assert.equal(preferences.resolveCustomerCopyFormat(manual, saved), manual);
    for (const invalid of [undefined, "", "58", "../ticket", ["80mm"], {}, null]) {
      assert.equal(preferences.resolveCustomerCopyFormat(invalid, saved), ["a4", "58mm", "80mm"].includes(saved) ? saved : "a4");
    }
  }
});
for (const format of ["a4", "58mm", "80mm"]) {
  test(`save ${format}: only scoped preference RPC, canonical document type, no client organization`, async () => {
    const a = action(); const result = await a.saveDocumentPrintPreferenceAction("it", state, form(format));
    assert.equal(result.success, true); assert.equal(a.calls.length, 1);
    const [rpc, args] = a.calls[0]; assert.equal(rpc, "save_document_print_preference");
    assert.deepEqual(JSON.parse(JSON.stringify(args)), {
      target_location_id: locA, target_document_type: "customer-copy", target_paper_format: format, target_printer_profile_id: null,
    });
    assert.equal(a.revalidated.length, 2);
  });
}
test("invalid format/location/profile cannot reach the RPC", async () => {
  for (const input of [form("bad"), form(["58mm"]), form("80mm", "bad"), form("a4", locA, "bad")]) {
    const a = action(); const result = await a.saveDocumentPrintPreferenceAction("de", state, input);
    assert.equal(result.error, "validation"); assert.equal(a.calls.length, 0);
  }
});
test("unauthorized action and preference read fail before database access", async () => {
  const a = action({ denied: true }); await assert.rejects(a.saveDocumentPrintPreferenceAction("es", state, form()), /access denied/);
  assert.equal(a.calls.length, 0);
  const q = queries({ denied: true }); await assert.rejects(q.getCustomerCopyPreference("es", locA), /access denied/);
  await assert.rejects(q.listDocumentPrintPreferences("es"), /access denied/);
  assert.equal(q.calls.filter(([kind]) => kind === "select").length, 0);
});
test("preferences use the authenticated tenant and exact location; foreign site returns nothing", async () => {
  for (const [organizationId, locationId, expected] of [[orgA, locA, "58mm"], [orgA, locB, "80mm"], [orgA, locForeign, null], [orgB, locA, null], [orgB, locForeign, "a4"]]) {
    const q = queries({ organizationId }); const saved = await q.getCustomerCopyPreference("fr", locationId);
    assert.equal(saved?.paperFormat ?? null, expected);
    assert.ok(q.calls.some(([key, value]) => key === "organization_id" && value === organizationId));
    assert.ok(q.calls.some(([key, value]) => key === "location_id" && value === locationId));
  }
  const q = queries(); const result = await q.listDocumentPrintPreferences("it");
  assert.equal(result.preferences.length, 2); assert.ok(result.preferences.every((p) => p.locationId !== locForeign));
});
test("missing table, missing rows, null location and corrupt format keep printing available", async () => {
  for (const code of ["42P01", "PGRST205", "42501", "PGRST000"]) {
    const q = queries({ error: { code } });
    assert.equal(await q.getCustomerCopyPreference("en", locA), null);
    assert.equal((await q.listDocumentPrintPreferences("en")).available, false);
  }
  assert.equal(await queries().getCustomerCopyPreference("en", null), null);
  assert.equal(await queries({ dataRows: [] }).getCustomerCopyPreference("en", locA), null);
  assert.equal(await queries({ dataRows: [{ ...rows[0], paper_format: "label_custom" }] }).getCustomerCopyPreference("en", locA), null);
});
test("SQL rejections remain failures, including disabled/incompatible profiles and unavailable RPC", async () => {
  for (const [code, expected] of [["22023", "validation"], ["42501", "generic"], ["PGRST202", "unavailable"], ["42883", "unavailable"]]) {
    const a = action({ error: { code } }); const result = await a.saveDocumentPrintPreferenceAction("it", state, form("58mm", locA, profileId));
    assert.equal(result.success, false); assert.equal(result.error, expected); assert.equal(a.revalidated.length, 0);
  }
});
test("profile compatibility excludes disabled, wrong-site, wrong-format and all label profiles", () => {
  for (const format of ["a4", "58mm", "80mm"]) {
    for (const purpose of ["receipt", "ticket", "label"]) {
      for (const paperFormat of ["receipt_58mm", "receipt_80mm", "browser_pdf", "ticket_a4", "label_custom"]) {
        const p = { enabled: true, locationId: locA, purpose, paperFormat };
        const expected = purpose !== "label" && (format === "a4" ? ["browser_pdf", "ticket_a4"].includes(paperFormat) : purpose === "receipt" && paperFormat === `receipt_${format}`);
        assert.equal(preferences.isCustomerCopyProfileCompatible(p, locA, format), expected);
        assert.equal(preferences.isCustomerCopyProfileCompatible({ ...p, enabled: false }, locA, format), false);
        assert.equal(preferences.isCustomerCopyProfileCompatible(p, locB, format), false);
      }
    }
  }
});
for (const locale of ["it", "es", "en", "fr", "de"]) {
  test(`${locale}: real customer route uses the order site, never query-string tenant/site, with temporary override`, async () => {
    for (const [override, saved, expected] of [[undefined, "58mm", "58mm"], ["80mm", "58mm", "80mm"], ["a4", "80mm", "a4"], ["invalid", "80mm", "80mm"], [["58mm"], "58mm", "58mm"], [undefined, null, "a4"]]) {
      const calls = [];
      const Page = load(route, {
        "@/components/printing/OrderPrintDocument": { OrderPrintDocument: "print-document" },
        "@/features/printing/server/queries": { getPrintOrderContext: async (...args) => { calls.push(["order", ...args]); return { order: { locationId: locA } }; } },
        "@/features/printer-settings/server/document-preference-queries": { getCustomerCopyPreference: async (...args) => { calls.push(["preference", ...args]); return saved ? { paperFormat: saved } : null; } },
      }).default;
      const result = await Page({ params: Promise.resolve({ locale, orderId: "order-a" }), searchParams: Promise.resolve({ format: override, locationId: locForeign, organization_id: orgB }) });
      assert.equal(result.props.customerCopyFormat, expected);
      assert.deepEqual(calls, [["order", locale, "order-a"], ["preference", locale, locA]]);
    }
  });
}
test("denied order never reads preferences or renders a document", async () => {
  const Page = load(route, {
    "@/components/printing/OrderPrintDocument": { OrderPrintDocument: "print-document" },
    "@/features/printing/server/queries": { getPrintOrderContext: async () => { throw Error("access denied"); } },
    "@/features/printer-settings/server/document-preference-queries": { getCustomerCopyPreference: async () => { assert.fail("no preference access for denied order"); } },
  }).default;
  await assert.rejects(Page({ params: Promise.resolve({ locale: "en", orderId: "foreign" }) }), /access denied/);
});
const dictionaries = ["it", "es", "en", "fr", "de"].map((locale) => JSON.parse(read(`src/i18n/${locale}/common.json`)));
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
function ui(preference, { available = true, profiles = [], locations = [{ id: locA, name: "One" }], dictionary = dictionaries[0] } = {}) {
  const props = { action: async () => state, available, profiles, locations, preferences: preference ? [preference] : [], text: dictionary.printerSettings.documentPreferences };
  const hooks = { ...React, useState: (value) => [value, () => {}], useActionState: (action, value) => [value, action, false] };
  const Component = load("src/components/printer-settings/DocumentPrintPreferences.tsx", { react: hooks }).DocumentPrintPreferences;
  const resolve = (node) => {
    if (Array.isArray(node)) return node.map(resolve);
    if (!React.isValidElement(node)) return node;
    if (typeof node.type === "function") return resolve(node.type(node.props));
    return React.cloneElement(node, {}, resolve(node.props.children));
  };
  return resolve(Component(props));
}
test("settings render all formats without requiring a printer and disable only the new form when unavailable", () => {
  for (const dictionary of dictionaries) {
    const tree = ui(null, { dictionary }); const elements = nodes(tree);
    const format = elements.find((n) => n.type === "select" && n.props.name === "paperFormat");
    assert.equal(format.props.value, "a4");
    assert.deepEqual(nodes(format).filter((n) => n.type === "option").map((n) => n.props.value), ["a4", "58mm", "80mm"]);
    assert.equal(nodes(elements.find((n) => n.props.name === "printerProfileId")).filter((n) => n.type === "option").length, 1);
    const html = renderToStaticMarkup(tree); assert.ok(html.includes(dictionary.printerSettings.documentPreferences.customerCopy));
    assert.equal(nodes(ui(null, { available: false, dictionary })).find((n) => n.type === "fieldset").props.disabled, true);
    assert.equal(nodes(ui(null, { locations: [], dictionary })).filter((n) => n.type === "form").length, 0);
  }
});
test("settings offer only active matching profiles at the selected site, keeping the saved paper format", () => {
  const p = { id: profileId, displayName: "Compatible", enabled: true, locationId: locA, purpose: "receipt", paperFormat: "receipt_58mm" };
  const allProfiles = [p, { ...p, id: "disabled", enabled: false }, { ...p, id: "wrong-site", locationId: locB }, { ...p, id: "wrong-format", paperFormat: "receipt_80mm" }];
  const pref = { locationId: locA, paperFormat: "58mm", printerProfileId: profileId };
  const tree = ui(pref, { profiles: allProfiles });
  assert.equal(nodes(tree).find((n) => n.props.name === "paperFormat").props.value, "58mm");
  const select = nodes(tree).find((n) => n.props.name === "printerProfileId");
  assert.equal(select.props.value, profileId);
  assert.deepEqual(nodes(select).filter((n) => n.type === "option").map((n) => n.props.value), ["", profileId]);
  const detached = ui(pref, { profiles: [] });
  assert.equal(nodes(detached).find((n) => n.props.name === "printerProfileId").props.value, "");
  assert.equal(nodes(detached).find((n) => n.props.name === "paperFormat").props.value, "58mm");
});
test("new vocabulary has identical keys in all five locales; existing profile vocabulary is preserved", () => {
  const keys = (obj) => Object.keys(obj).sort();
  for (const d of dictionaries) {
    const p = d.printerSettings.documentPreferences;
    assert.deepEqual(keys(p), keys(dictionaries[0].printerSettings.documentPreferences));
    assert.deepEqual(keys(p.formats), ["58mm", "80mm", "a4"]);
    assert.ok(Object.values(p).every((v) => typeof v === "object" || typeof v === "string" && v.length > 0));
    for (const mode of ["browser", "network", "local_bridge", "vendor_adapter"]) assert.equal(typeof d.printerSettings.labels.connectionModes[mode], "string");
  }
});
test("SQL contract: unique tenant/site/document, constrained formats, tenant-qualified site/profile FKs and RLS", () => {
  assert.match(migration, /unique \(organization_id, location_id, document_type\)/);
  assert.match(migration, /document_type in \('customer-copy'\)/);
  assert.match(migration, /paper_format in \('a4', '58mm', '80mm'\)/);
  assert.match(migration, /foreign key \(organization_id, location_id\)/);
  assert.match(migration, /foreign key \(organization_id, printer_profile_id\)/);
  assert.match(migration, /on delete set null \(printer_profile_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_organization_member\(organization_id\)/);
  assert.match(migration, /has_organization_entitlement\(organization_id, 'printing'\)/);
  assert.match(migration, /revoke all on public.document_print_preferences from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)/i);
});
test("SQL contract: authenticated scoped Owner/Manager RPC, locked compatibility and non-destructive profile detach", () => {
  assert.match(migration, /org_id uuid := public.app_current_organization_id\(\)/);
  assert.match(migration, /auth.uid\(\) is null/);
  assert.match(migration, /array\['owner', 'manager'\]::public.app_role\[\]/);
  assert.match(migration, /location.is_active and location.deleted_at is null/);
  assert.match(migration, /for share;/);
  assert.ok(migration.indexOf("for share;") < migration.indexOf("insert into public.document_print_preferences"));
  assert.match(migration, /selected_profile.location_id <> target_location_id/);
  assert.match(migration, /not selected_profile.enabled/);
  assert.match(migration, /after update of organization_id, location_id, enabled, purpose, paper_format on public.printer_profiles/);
  assert.match(migration, /set printer_profile_id = null, updated_by = auth.uid\(\)/);
  assert.match(migration, /on conflict \(organization_id, location_id, document_type\) do update/);
  assert.equal((migration.match(/security definer set search_path = ''/g) ?? []).length, 2);
});
test("no financial mutation or new printer subsystem; profile management and ordinary order command remain", () => {
  const sql = migration.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(sql, /(?:update|delete from|insert into) public\.(?:printer_profiles|orders|payments|billing_invoices|accounting_sales_documents)\b/i);
  for (const path of [route, queryPath, actionPath]) {
    assert.doesNotMatch(read(path), /issueOperationalReceipt|issue_billing|record_pos|save_printer_profile|\.from\("(?:orders|payments)"\)\.(?:insert|update|delete)/);
  }
  const page = read("src/app/[locale]/app/(dashboard)/settings/printers/page.tsx");
  assert.match(page, /<PrinterSettingsWorkspace/); assert.match(page, /savePrinterProfileAction.bind/);
  assert.match(page, /<DocumentPrintPreferences/);
  const actions = read("src/components/printing/PrintOrderActions.tsx");
  assert.match(actions, /\/print\/customer-copy/); assert.doesNotMatch(actions, /customer-copy\?format=/);
});
