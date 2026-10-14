import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { CATALOG_CSV_HEADERS, parseCsv, serializeCatalogCsv } from "../src/features/catalog-productization/csv.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function loadParser() {
  let code = ts.transpileModule(await source("src/features/catalog-productization/unified.ts"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [relative, path] of [
    ["./csv", "src/features/catalog-productization/csv.ts"],
    ["./types", "src/features/catalog-productization/types.ts"],
    ["../services/types", "src/features/services/types.ts"],
  ]) code = code.replace(`from "${relative}"`, `from "${new URL(path, root).href}"`);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

async function loadServiceValidation() {
  const code = ts.transpileModule(await source("src/features/services/validation.ts"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace('from "@/features/services/types"', `from "${new URL("src/features/services/types.ts", root).href}"`);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

function row(index, isFrom = false) {
  return {
    canonicalDescription: "Care", canonicalName: `Service ${index}`,
    categoryKey: "ironing", categoryTranslations: { es: "Planchado" },
    customerOrderable: true, customerVisible: true, featured: false,
    manualSortOrder: index, orderMode: "manual", serviceCode: `P-${String(index).padStart(3, "0")}`,
    serviceId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    status: "active", translations: { es: { name: `Servicio ${index}`, description: "" } },
    unitType: "piece", isFrom,
  };
}

test("complete 219-row CSV carries prices and preserves two starting-from flags", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const rows = Array.from({ length: 219 }, (_, index) => row(index + 1, index >= 217));
  const prices = new Map(rows.map((service) => [service.serviceId, {
    amount: "2.80", currency: "EUR", isFrom: service.isFrom,
    validFrom: "2026-08-24", validTo: null,
  }]));
  const csv = serializeCatalogCsv(rows, new Map(), prices);
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  assert.equal(table.length, 220);
  assert.equal(table[1][CATALOG_CSV_HEADERS.indexOf("base_price")], "2.80");
  const parsed = parseUnifiedCatalogCsv(csv, "prices_only");
  assert.equal(parsed.length, 219);
  assert.equal(parsed.filter((entry) => entry.row.price?.isFrom).length, 2);
  assert.ok(parsed.every((entry) => entry.errors.length === 0 && entry.row.serviceId === ""));
});

test("foreign source UUIDs and image references remain informational", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const service = row(1);
  const csv = serializeCatalogCsv([service], new Map([[service.serviceId, "foreign/tenant/image.webp"]]),
    new Map([[service.serviceId, { amount: "14.50", currency: "EUR", isFrom: true, validFrom: "2026-08-24", validTo: null }]]));
  const parsed = parseUnifiedCatalogCsv(csv, "prices_only");
  assert.equal(parsed[0].row.serviceId, "");
  assert.equal(parsed[0].row.price?.amount, "14.50");
  assert.equal(parsed[0].row.price?.isFrom, true);
  assert.ok(!JSON.stringify(parsed[0].row).includes("foreign/tenant"));
});

test("222-row price transfer includes 219 and excludes two archived plus one approved active service", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const rows = Array.from({ length: 222 }, (_, index) => ({
    ...row(index + 1), status: index < 219 || index === 221 ? "active" : "archived",
  }));
  const prices = new Map(rows.map((service) => [service.serviceId, {
    amount: "2.80", currency: "EUR", isFrom: false, validFrom: "2026-08-24", validTo: null,
  }]));
  const csv = serializeCatalogCsv(rows, new Map(), prices).replace(/(P-222[^\r\n]*),include,/, "$1,exclude,approved transfer exclusion");
  const parsed = parseUnifiedCatalogCsv(csv, "prices_only");
  assert.equal(parsed.filter((entry) => !entry.row.skip && entry.row.price).length, 219);
  assert.equal(parsed.filter((entry) => entry.row.skip && entry.row.skipReason === "archived").length, 2);
  assert.equal(parsed.filter((entry) => entry.row.skip && entry.row.skipReason === "approved transfer exclusion").length, 1);
  assert.ok(parsed.every((entry) => entry.errors.length === 0));
});

test("Prices only skips all three archived source rows when Solo stiro has no code", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const archived = [
    { ...row(1001), serviceCode: "001", canonicalName: "Bolso al kg", status: "archived" },
    { ...row(1002), serviceCode: "", canonicalName: "Solo stiro", status: "archived" },
    { ...row(1003), serviceCode: "SMOKE-WASH-DRY", canonicalName: "Lavaggio e asciugatura test", status: "archived" },
  ];
  const active = Array.from({ length: 219 }, (_, index) => row(index + 1));
  const services = [...archived, ...active];
  const prices = new Map(services.map((service) => [service.serviceId, {
    amount: "2.00", currency: "EUR", isFrom: false, validFrom: "2026-08-24", validTo: null,
  }]));
  const csv = serializeCatalogCsv(services, new Map(), prices);
  const parsed = parseUnifiedCatalogCsv(csv, "prices_only");
  assert.equal(parsed.length, 222);
  assert.equal(parsed.filter((entry) => !entry.row.skip && entry.row.price && !entry.errors.length).length, 219);
  assert.equal(parsed.filter((entry) => entry.row.skip && !entry.errors.length).length, 3);
  assert.equal(parsed.filter((entry) => entry.errors.length).length, 0);
  assert.deepEqual(parsed.filter((entry) => entry.row.skip).map((entry) => entry.row.canonicalName),
    ["Bolso al kg", "Solo stiro", "Lavaggio e asciugatura test"]);
  assert.equal(parsed[1].rowNumber, 3);
  assert.equal(parsed[1].row.serviceCode, "");
  assert.equal(parsed[1].row.skipReason, "archived");

  const activeWithoutCode = serializeCatalogCsv([{ ...row(1), serviceCode: "" }], new Map());
  assert.ok(parseUnifiedCatalogCsv(activeWithoutCode, "prices_only")[0].errors.includes("service_code"));
  assert.ok(parseUnifiedCatalogCsv(csv, "catalog_and_prices")[1].errors.includes("service_code"));
  const invalidArchived = serializeCatalogCsv([{ ...archived[1], unitType: "invalid" }], new Map());
  assert.ok(parseUnifiedCatalogCsv(invalidArchived, "prices_only")[0].errors.includes("unit_type"));
});

test("active exclusions require a reason; empty prices preserve rather than zero", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const rows = [row(1), row(2)];
  const csv = serializeCatalogCsv(rows, new Map());
  const parsed = parseUnifiedCatalogCsv(csv, "prices_only");
  assert.equal(parsed[0].row.price, null);
  assert.equal(parsed[0].row.skip, false);
  assert.ok(!parsed[0].errors.includes("price_required"));
  const excluded = csv.replace("P-001", "P-001").replace(",include,\r\n", ",exclude,approved historical exclusion\r\n");
  assert.equal(parseUnifiedCatalogCsv(excluded, "prices_only")[0].row.skip, true);
  const invalid = excluded.replace("approved historical exclusion", "");
  assert.ok(parseUnifiedCatalogCsv(invalid, "prices_only")[0].errors.includes("exclude_reason"));
});

test("219 prices with ten changed values create only ten versions", async () => {
  const { planUnifiedPrice } = await loadParser();
  const existing = [{ amount: 2.8, currency: "EUR", is_from: false, valid_from: "2026-08-24", valid_to: null }];
  const actions = Array.from({ length: 219 }, (_, index) => planUnifiedPrice(existing,
    { amount: index < 10 ? "3.00" : "2.80", currency: "EUR", isFrom: false, validTo: null },
    "2026-10-20", "2026-10-13", "EUR").action);
  assert.equal(actions.filter((action) => action === "close_and_create").length, 10);
  assert.equal(actions.filter((action) => action === "unchanged").length, 209);
});

test("Spanish spreadsheet semicolon CSV safely normalizes ungrouped comma decimals", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const services = [row(1), row(2), row(3)];
  const prices = new Map(services.map((service, index) => [service.serviceId, {
    amount: ["2.80", "14.50", "18.00"][index], currency: "EUR", isFrom: false,
    validFrom: "2026-08-24", validTo: null,
  }]));
  const canonical = serializeCatalogCsv(services, new Map(), prices);
  const spanish = canonical.replaceAll(",", ";")
    .replace("2.80", "2,80").replace("14.50", "14,50").replace("18.00", "18,00");
  const parsed = parseUnifiedCatalogCsv(spanish, "prices_only");
  assert.deepEqual(parsed.map((entry) => entry.row.price?.amount), ["2.80", "14.50", "18.00"]);
  assert.ok(parsed.every((entry) => entry.errors.length === 0));
  const oneDecimal = spanish.replace("2,80", "2,8");
  assert.equal(parseUnifiedCatalogCsv(oneDecimal, "prices_only")[0].row.price?.amount, "2.80");
  for (const malformed of ["1.234,56", "1,234.56", "2,800", "2.800", "1 234,56"]) {
    const candidate = spanish.replace("2,80", malformed);
    assert.ok(parseUnifiedCatalogCsv(candidate, "prices_only")[0].errors.includes("base_price"), malformed);
  }
  const canonicalCommaDecimal = canonical.replace("2.80", '"2,80"');
  assert.ok(parseUnifiedCatalogCsv(canonicalCommaDecimal, "prices_only")[0].errors.includes("base_price"));
  const localizedDate = spanish.replace("2026-08-24", "24/08/2026");
  assert.ok(parseUnifiedCatalogCsv(localizedDate, "prices_only")[0].errors.includes("price_valid_from"));
  const localizedBoolean = spanish.replace(";false;2026-08-24", ";VERDADERO;2026-08-24");
  assert.ok(parseUnifiedCatalogCsv(localizedBoolean, "prices_only")[0].errors.includes("price_is_from"));
});

test("semicolon spreadsheet fields keep quoted boundaries, Unicode and formula protection", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const service = { ...row(1), canonicalDescription: "Café; ropa, especial" };
  const canonical = serializeCatalogCsv([service], new Map());
  // Convert through the parsed table so quoted delimiters remain correctly escaped.
  const csv = `\uFEFF${parseCsv(canonical.replace(/^\uFEFF/, "")).map((cells) =>
    cells.map((cell) => /[;"\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(";")).join("\r\n")}\r\n`;
  assert.equal(parseUnifiedCatalogCsv(csv, "catalog_and_prices")[0].row.canonicalDescription, "Café; ropa, especial");
  const formula = csv.replace("Café; ropa, especial", "=SUM(1;2)");
  assert.ok(parseUnifiedCatalogCsv(formula, "catalog_and_prices")[0].errors.includes("catalog_text"));
});

test("currency-scoped preview matches SQL price-version outcomes and rejects ambiguous global prices", async () => {
  const { planUnifiedPrice } = await loadParser();
  const eur = { amount: 2.8, currency: "EUR", is_from: false, valid_from: "2026-08-24", valid_to: null };
  const gbp = { ...eur, amount: 3.5, currency: "GBP" };
  const incoming = { amount: "2.80", currency: "EUR", isFrom: false, validTo: null };
  const plan = (rows, price = incoming) => planUnifiedPrice(rows, price, "2026-10-20", "2026-10-13", "EUR");
  assert.deepEqual([plan([]).action, plan([eur]).action,
    plan([eur], { ...incoming, amount: "3.00" }).action],
  ["create", "unchanged", "close_and_create"]);
  assert.equal(plan([gbp]).action, "none");
  assert.equal(plan([gbp]).previous, null);
  assert.deepEqual(plan([eur, gbp]).errors, ["cross_currency_price_conflict"]);
  assert.deepEqual(plan([eur], { ...incoming, currency: "GBP" }).errors, ["currency_mismatch"]);
  const closedGbp = { ...gbp, valid_to: "2026-10-19" };
  assert.equal(plan([eur, closedGbp]).action, "unchanged");
  assert.equal(plan([closedGbp]).action, "create");
});

test("cross-currency preview uses both inclusive price-period bounds", async () => {
  const { planUnifiedPrice } = await loadParser();
  const futureGbp = { amount: 4, currency: "GBP", is_from: false,
    valid_from: "2026-12-01", valid_to: null };
  const closedGbp = { ...futureGbp, valid_from: "2026-09-01", valid_to: "2026-10-19" };
  const incoming = { amount: "2.80", currency: "EUR", isFrom: false, validTo: "2026-10-31" };
  const plan = (rows, price) => planUnifiedPrice(rows, price, "2026-10-20", "2026-10-13", "EUR");
  const outside = plan([futureGbp], incoming);
  assert.equal(outside.action, "create");
  assert.deepEqual(outside.errors, []);
  assert.deepEqual(plan([futureGbp], { ...incoming, validTo: "2026-12-01" }).errors,
    ["cross_currency_price_conflict"]);
  assert.deepEqual(plan([closedGbp], incoming).errors, []);
  assert.equal(plan([closedGbp], incoming).action, "create");
  assert.deepEqual(plan([futureGbp], { ...incoming, validTo: null }).errors,
    ["cross_currency_price_conflict"]);
});

test("round trip preserves Unicode, booleans, image isolation and formula-like text", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const services = [
    { ...row(1), canonicalDescription: "Café ñandú", customerVisible: false, featured: true },
    { ...row(2), canonicalDescription: "=HYPERLINK(\"https://invalid\")", status: "archived" },
    { ...row(3), canonicalDescription: "'=literal" },
  ];
  const prices = new Map([[services[0].serviceId, {
    amount: "12.30", currency: "EUR", isFrom: true, validFrom: "2026-08-24", validTo: null,
  }]]);
  const csv = serializeCatalogCsv(services, new Map([[services[0].serviceId, "source/image.webp"]]), prices);
  const parsed = parseUnifiedCatalogCsv(csv, "catalog_and_prices");
  assert.ok(parsed.every((entry) => entry.errors.length === 0));
  assert.equal(parsed[0].row.canonicalDescription, "Café ñandú");
  assert.equal(parsed[0].row.customerVisible, false);
  assert.equal(parsed[0].row.featured, true);
  assert.equal(parsed[0].row.price?.amount, "12.30");
  assert.equal(parsed[1].row.canonicalDescription, services[1].canonicalDescription);
  assert.equal(parsed[1].row.status, "archived");
  assert.equal(parsed[2].row.canonicalDescription, services[2].canonicalDescription);
  assert.ok(!JSON.stringify(parsed).includes("source/image.webp"));
});

test("501 rows import completely and oversized files reject before mutation", async () => {
  const { parseUnifiedCatalogCsv, MAX_UNIFIED_ROWS } = await loadParser();
  const services = Array.from({ length: 501 }, (_, index) => row(index + 1));
  assert.equal(parseUnifiedCatalogCsv(serializeCatalogCsv(services, new Map()), "catalog_and_prices").length, 501);
  const tooMany = Array.from({ length: MAX_UNIFIED_ROWS + 1 }, (_, index) => row(index + 1));
  assert.throws(() => parseUnifiedCatalogCsv(serializeCatalogCsv(tooMany, new Map()), "catalog_and_prices"), /rows|file/);
});

test("manual catalog-only editing leaves price blank and validates editable is_from", async () => {
  const { parseServiceForm } = await loadServiceValidation();
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Café", unitType: "piece", amount: "", currency: "EUR",
    validFrom: "2026-10-13", priceIsFrom: "true",
  })) form.set(key, value);
  const edit = parseServiceForm(form, "EUR", true);
  assert.equal(edit.valid, true);
  assert.equal(edit.input.amount, null);
  assert.equal(edit.input.priceIsFrom, true);
  assert.equal(parseServiceForm(form, "EUR").fieldErrors.amount, "invalid");
  form.set("priceIsFrom", "maybe");
  assert.equal(parseServiceForm(form, "EUR", true).fieldErrors.priceIsFrom, "invalid");
});

test("duplicate codes, malformed money and invalid dates block preview", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const services = [row(1), row(1)];
  const prices = new Map([[services[0].serviceId, {
    amount: "2.80", currency: "EUR", isFrom: false, validFrom: "2026-08-24", validTo: null,
  }]]);
  let csv = serializeCatalogCsv(services, new Map(), prices);
  csv = csv.replaceAll("2.80", "2.805").replaceAll("2026-08-24", "2026-02-30");
  const parsed = parseUnifiedCatalogCsv(csv, "prices_only");
  assert.ok(parsed[0].errors.includes("base_price"));
  assert.ok(parsed[0].errors.includes("price_valid_from"));
  assert.ok(parsed[1].errors.includes("duplicate_service_code"));
});

test("malformed quoted CSV is rejected before preview", async () => {
  const { parseUnifiedCatalogCsv } = await loadParser();
  const service = row(1);
  const csv = serializeCatalogCsv([service], new Map());
  assert.throws(() => parseUnifiedCatalogCsv(`${csv}"unterminated`, "catalog_and_prices"), /csv_syntax/);
});

test("CSV export neutralizes spreadsheet formula cells", () => {
  const service = { ...row(1), canonicalDescription: "=HYPERLINK(\"https://invalid\")" };
  const csv = serializeCatalogCsv([service], new Map());
  assert.ok(csv.includes("'="));
});

test("unified RPC has one transaction, no client tenant ID and no image mutation", async () => {
  const [sql, actions, manual] = await Promise.all([
    source("supabase/migrations/20261013000100_phoenix_unified_catalog_002j.sql"),
    source("src/features/catalog-productization/server/unified-actions.ts"),
    source("src/features/services/server/actions.ts"),
  ]);
  assert.match(sql, /create function public\.apply_unified_catalog_import[\s\S]*security definer/);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /unified_catalog_stale_preview/);
  assert.match(sql, /public\.apply_catalog_import\(catalog_batch\)/);
  assert.match(sql, /public\.apply_base_price_version\(/);
  assert.match(sql, /unified_catalog_inactive_service/);
  assert.match(actions, /original\.status !== "active"/);
  assert.match(sql, /base_price_cross_currency_conflict/);
  assert.match(sql, /revoke all on function public\.apply_unified_catalog_import/);
  assert.match(actions, /rpc\("apply_unified_catalog_import"/);
  assert.doesNotMatch(actions, /serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY|organization_id:/);
  assert.match(manual, /rpc\("save_service_with_versioned_price"/);
  assert.doesNotMatch(manual.slice(manual.indexOf("export async function updateServiceAction"), manual.indexOf("export async function deactivateServiceAction")), /\.from\("service_prices"\)\.update/);
  assert.doesNotMatch(sql, /portal_image_path\s*=|delete from public\.service_prices|update public\.(orders|order_items|payments|invoices)/i);
});
