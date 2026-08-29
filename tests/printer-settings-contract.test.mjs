import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260829000400_counter_ui_003_printer_profiles.sql";

test("1 printer profiles are an additive tenant-owned model", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.printer_profiles/);
  assert.match(sql, /organization_id uuid not null references public\.organizations/);
  assert.doesNotMatch(sql, /alter table public\.(orders|payments|pos_sessions|invoices)/);
});

test("2 every profile location is constrained to the same tenant", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /printer_profiles_location_same_organization foreign key \(organization_id, location_id\)[\s\S]*references public\.locations \(organization_id, id\)/);
});

test("3 one default per tenant location and purpose is database enforced", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create unique index printer_profiles_one_default_per_scope_idx[\s\S]*\(organization_id, location_id, purpose\)[\s\S]*where is_default/);
});

test("4 writes are atomic through a locked server function", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create function public\.save_printer_profile/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /update public\.printer_profiles[\s\S]*set is_default = false/);
});

test("5 privileged save has a safe search path and least privilege", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /security definer\s+set search_path = public/);
  assert.match(sql, /revoke all on public\.printer_profiles from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.printer_profiles to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete) on public\.printer_profiles to authenticated/);
});

test("6 configuration is Owner or Manager only and printing-entitled", async () => {
  const [access, sql] = await Promise.all([source("src/features/printer-settings/server/access.ts"), source(migrationPath)]);
  assert.match(access, /requireOwnerOrManager\(locale\)/);
  assert.match(access, /requireEntitlement\(locale, FEATURES\.printing\)/);
  assert.match(sql, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(sql, /organization_entitlement_is_enabled\(org_id, 'printing'/);
});

test("7 location validation is current-tenant and active", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /location\.organization_id = org_id/);
  assert.match(sql, /location\.id = target_location_id/);
  assert.match(sql, /location\.is_active/);
  assert.match(sql, /location\.deleted_at is null/);
});

test("8 profiles stay provider-neutral and store no hardware secrets", async () => {
  const [types, sql] = await Promise.all([source("src/features/printer-settings/types.ts"), source(migrationPath)]);
  for (const mode of ["browser", "network", "local_bridge", "vendor_adapter"]) assert.match(types, new RegExp(`"${mode}"`));
  for (const secret of ["password", "api_key", "token", "pan", "cvv", "pin"]) assert.doesNotMatch(sql, new RegExp(`\\b${secret}\\b`, "i"));
});

test("9 receipt, label and optional ticket purposes are supported", async () => {
  const types = await source("src/features/printer-settings/types.ts");
  for (const purpose of ["receipt", "label", "ticket"]) assert.match(types, new RegExp(`"${purpose}"`));
});

test("10 settings route supports multiple editable profiles and honest status", async () => {
  const [page, ui] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/settings/printers/page.tsx"),
    source("src/components/printer-settings/PrinterSettingsWorkspace.tsx"),
  ]);
  assert.match(page, /listPrinterProfiles\(locale\)/);
  assert.match(ui, /profiles\.map/);
  assert.match(ui, /profile\.isDefault/);
  assert.match(ui, /!profile\.enabled/);
  assert.match(ui, /profile\.connectionMode !== "browser"/);
});

test("11 save action accepts only bounded profile values and calls canonical RPC", async () => {
  const action = await source("src/features/printer-settings/server/actions.ts");
  assert.match(action, /PRINTER_PURPOSES\.includes/);
  assert.match(action, /PRINTER_CONNECTION_MODES\.includes/);
  assert.match(action, /PRINTER_PAPER_FORMATS\.includes/);
  assert.match(action, /rpc\("save_printer_profile"/);
  assert.doesNotMatch(action, /organizationId.*formData/);
});

test("12 receipt formats include 58 mm, 80 mm and browser PDF", async () => {
  const [ui, css] = await Promise.all([source("src/components/printer-settings/PrinterSettingsWorkspace.tsx"), source("src/styles/globals.css")]);
  for (const format of ["receipt_58mm", "receipt_80mm", "browser_pdf"]) assert.match(ui, new RegExp(format));
  assert.match(css, /@page receipt-58/);
  assert.match(css, /print-receipt-sheet-58mm/);
  assert.match(css, /print-receipt-sheet-pdf/);
});

test("13 label profile controls dimensions orientation copies margin and gap", async () => {
  const [ui, document, css] = await Promise.all([
    source("src/components/printer-settings/PrinterSettingsWorkspace.tsx"),
    source("src/components/printing/OrderPrintDocument.tsx"),
    source("src/styles/globals.css"),
  ]);
  for (const field of ["labelWidthMm", "labelHeightMm", "labelOrientation", "labelCopies", "labelMarginMm", "labelGapMm"]) assert.match(ui, new RegExp(field));
  assert.match(document, /Array\.from\(\{ length: copies \}/);
  assert.match(css, /--print-label-width/);
});

test("14 PRINT resolves defaults by exact order location and tenant", async () => {
  const [printing, profiles] = await Promise.all([
    source("src/features/printing/server/queries.ts"),
    source("src/features/printer-settings/server/queries.ts"),
  ]);
  assert.match(printing, /location_id/);
  assert.match(printing, /getDefaultPrinterProfiles\(locale, metadata\.location_id\)/);
  assert.match(profiles, /eq\("organization_id", membership\.organization\.id\)/);
  assert.match(profiles, /eq\("location_id", locationId\)/);
  assert.match(profiles, /eq\("enabled", true\)/);
  assert.match(profiles, /eq\("is_default", true\)/);
});

test("15 missing or adapter-only configuration keeps browser print fallback", async () => {
  const [document, messages] = await Promise.all([
    source("src/components/printing/OrderPrintDocument.tsx"),
    source("src/i18n/en/common.json"),
  ]);
  assert.match(document, /profile \? .*profile\.displayName.*: t\("profile\.browserFallback"\)/);
  assert.match(document, /profile\.connectionMode !== "browser"/);
  assert.match(messages, /browser print dialog/);
});

test("16 existing shared receipt ticket and label renderers remain canonical", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  for (const renderer of ["Receipt", "Ticket", "Labels"]) assert.equal((document.match(new RegExp(`function ${renderer}`, "g")) ?? []).length, 1);
  assert.match(document, /buildPrintLabels\(context\)/);
});

test("17 no barcode, proprietary SDK or silent printing was added", async () => {
  const files = await Promise.all([
    source("src/components/printer-settings/PrinterSettingsWorkspace.tsx"),
    source("src/features/printer-settings/server/actions.ts"),
    source("src/components/printing/OrderPrintDocument.tsx"),
  ]);
  assert.doesNotMatch(files.join("\n"), /\b(?:zebra|epson|brother|star)\b|esc\/pos|window\.print\(\).*useEffect|barcode|qr-code/i);
});

test("18 management navigation exposes one printer settings entry", async () => {
  const navigation = await source("src/components/dashboard/AppNavigation.tsx");
  assert.match(navigation, /href: "\/app\/settings\/printers"/);
  assert.match(navigation, /FEATURES\.printing/);
  assert.equal((navigation.match(/href: "\/app\/settings\/printers"/g) ?? []).length, 1);
});

test("19 counter shell is compact on desktop while mobile navigation remains", async () => {
  const [shell, css, terminal] = await Promise.all([
    source("src/components/dashboard/DashboardShell.tsx"),
    source("src/styles/globals.css"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
  ]);
  assert.match(shell, /dashboard-desktop-nav/);
  assert.match(css, /:has\(\.counter-register-shell\)/);
  assert.match(terminal, /lg:grid-cols-\[minmax\(0,2\.1fr\)_minmax\(20rem,1fr\)\]/);
});

test("20 all locales expose matching printer and print-profile vocabulary", async () => {
  const localeKeys = [];
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.auth.dashboard.printers, "string");
    assert.equal(typeof messages.shopTerminal.labels.printerSettings, "string");
    assert.equal(typeof messages.print.profile.browserFallback, "string");
    localeKeys.push(Object.keys(messages.printerSettings.labels).sort());
  }
  for (const keys of localeKeys.slice(1)) assert.deepEqual(keys, localeKeys[0]);
});
