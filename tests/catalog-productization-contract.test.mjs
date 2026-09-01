import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CATALOG_CSV_HEADERS, parseCsv, serializeCatalogCsv } from "../src/features/catalog-productization/csv.ts";
import { humanizeCatalogKey, sortCatalogPresentation } from "../src/features/catalog-productization/presentation.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260901000100_catalog_productization_001_multilingual_catalog.sql";

function presentation(id, name, manualSortOrder, categorySortOrder = 0) {
  return { categorySortOrder, categoryTitle: "Family", description: null, manualSortOrder, name, orderMode: "manual", serviceId: id };
}

test("1 translation storage keeps one tenant service/category identity across five canonical locales", async () => {
  const [sql, routing] = await Promise.all([source(migrationPath), source("src/i18n/routing.ts")]);
  assert.match(sql, /create table public\.service_catalog_translations[\s\S]*primary key \(organization_id, service_id, locale\)/);
  assert.match(sql, /create table public\.category_catalog_translations[\s\S]*primary key \(organization_id, category_key, locale\)/);
  assert.match(sql, /locale in \('en', 'it', 'es', 'fr', 'de'\)/g);
  assert.match(routing, /locales: \["en", "it", "es", "fr", "de"\]/);
});

test("2 translation fallback is requested locale then canonical default then readable canonical text", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /coalesce\(local_service\.name, default_service\.name, service\.name\)/);
  assert.match(sql, /coalesce\(local_category\.title, default_category\.title, category\.portal_title/);
  assert.match(sql, /initcap\(replace\(category\.category_key, '_', ' '\)\)/);
  assert.equal(humanizeCatalogKey("dry_cleaning"), "Dry cleaning");
});

test("3 locale-aware alphabetical and manual ordering are deterministic within families", () => {
  const items = [{ id: "a", name: "fallback" }, { id: "b", name: "fallback" }, { id: "c", name: "fallback" }];
  const views = new Map([
    ["a", presentation("a", "Árbol", 2)], ["b", presentation("b", "avion", 0)], ["c", presentation("c", "Bufanda", 1)],
  ]);
  assert.deepEqual(sortCatalogPresentation(items, views, "es", "alphabetical_asc").map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(sortCatalogPresentation(items, views, "es", "alphabetical_desc").map((item) => item.id), ["c", "b", "a"]);
  assert.deepEqual(sortCatalogPresentation(items, views, "es", "manual").map((item) => item.id), ["b", "c", "a"]);
});

test("4 existing tenants retain manual order and future tenants default to A-Z", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /update public\.organizations[\s\S]*catalog_order_mode = 'manual'/);
  assert.match(sql, /alter column catalog_order_mode set default 'alphabetical_asc'/);
  assert.doesNotMatch(sql.slice(0, sql.indexOf("create function public.apply_catalog_import")), /update public\.services\b/i);
});

test("5 Terminal and Portal share locale presentation and ordering without changing pricing", async () => {
  const [terminal, portal] = await Promise.all([
    source("src/features/shop-terminal/server/queries.ts"), source("src/features/portal/server/queries.ts"),
  ]);
  for (const sourceText of [terminal, portal]) {
    assert.match(sourceText, /loadCatalogPresentation/);
    assert.match(sourceText, /sortCatalogPresentation/);
  }
  assert.match(terminal, /rpc\("list_shop_terminal_services"/);
  assert.match(portal, /rpc\("list_customer_portal_services"/);
  assert.match(portal, /manualSortOrder: service\.segment_sort_order/);
});

test("6 CSV contains stable identity and independent multilingual columns without flattened prices", () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    assert.ok(CATALOG_CSV_HEADERS.includes(`service_name_${locale}`));
    assert.ok(CATALOG_CSV_HEADERS.includes(`service_description_${locale}`));
    assert.ok(CATALOG_CSV_HEADERS.includes(`category_name_${locale}`));
  }
  assert.ok(CATALOG_CSV_HEADERS.includes("service_id"));
  assert.ok(CATALOG_CSV_HEADERS.includes("manual_sort_order"));
  assert.ok(!CATALOG_CSV_HEADERS.some((header) => header.includes("price") || header.includes("amount")));
});

test("7 exported CSV round-trips quoting, translations, status and media reference", () => {
  const row = { canonicalDescription: "Care, gentle", canonicalName: "Coat", categoryKey: "dry_cleaning", categoryTranslations: { it: "Tintoria" }, customerOrderable: true, customerVisible: true, featured: false, manualSortOrder: 4, orderMode: "manual", serviceCode: "COAT", serviceId: "11111111-1111-4111-8111-111111111111", status: "active", translations: { it: { description: "Cura", name: "Cappotto" } }, unitType: "piece" };
  const csv = serializeCatalogCsv([row], new Map([[row.serviceId, "tenant/service/coat.webp"]]));
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  assert.equal(table.length, 2);
  assert.equal(table[1][CATALOG_CSV_HEADERS.indexOf("canonical_description")], "Care, gentle");
  assert.equal(table[1][CATALOG_CSV_HEADERS.indexOf("service_name_it")], "Cappotto");
  assert.equal(table[1][CATALOG_CSV_HEADERS.indexOf("media_reference")], "tenant/service/coat.webp");
});

test("8 export ownership is resolved from authenticated Owner/Manager context", async () => {
  const [route, query] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/settings/catalog/export/route.ts"),
    source("src/features/catalog-admin/server/queries.ts"),
  ]);
  assert.match(route, /getCatalogExportData\(locale\)/);
  assert.match(query, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /eq\("organization_id", membership\.organization\.id\)/g);
  assert.doesNotMatch(route, /organizationId|searchParams/);
});

test("9 preview is mandatory, bounded and performs no mutation", async () => {
  const actions = await source("src/features/catalog-productization/server/actions.ts");
  const preview = actions.slice(actions.indexOf("export async function previewCatalogImportAction"), actions.indexOf("export async function confirmCatalogImportAction"));
  assert.match(preview, /file\.size > 1_000_000/);
  assert.match(preview, /table\.length - 1 > 500/);
  assert.doesNotMatch(preview, /apply_catalog_import|\.insert\(|\.update\(|\.delete\(/);
  assert.match(actions, /payload: validation\.preview\.errors === 0/);
});

test("10 confirmed import revalidates and applies once through an atomic tenant RPC", async () => {
  const [actions, sql] = await Promise.all([source("src/features/catalog-productization/server/actions.ts"), source(migrationPath)]);
  assert.match(actions, /validateRows\(locale, records\)/);
  assert.match(actions, /rpc\("apply_catalog_import", \{ target_rows: validation\.rows \}\)/);
  assert.match(sql, /create function public\.apply_catalog_import\(target_rows jsonb\)[\s\S]*security definer[\s\S]*set search_path = public/);
  assert.match(sql, /public\.app_current_organization_id\(\)/);
  assert.match(sql, /has_organization_role\(org_id, array\['owner', 'manager'\]/);
});

test("11 stable ID/code reconciliation rejects foreign IDs, conflicting codes and categories", async () => {
  const [actions, sql] = await Promise.all([source("src/features/catalog-productization/server/actions.ts"), source(migrationPath)]);
  for (const contract of ["foreign_service_id", "conflicting_service_code", "duplicate_service_id", "duplicate_service_code", "unknown_category"]) assert.match(actions, new RegExp(contract));
  assert.match(sql, /service\.id = requested_id and service\.organization_id = org_id/);
  assert.match(sql, /category\.organization_id = org_id and category\.category_key = requested_category/);
  assert.doesNotMatch(actions, /displayName.*identity|translated.*identity/i);
});

test("12 blank translations and media cells preserve existing values", async () => {
  const [actions, sql] = await Promise.all([source("src/features/catalog-productization/server/actions.ts"), source(migrationPath)]);
  assert.match(actions, /translations: \{ \.\.\.current\.translations, \.\.\.parsed\.row\.translations \}/);
  assert.match(actions, /categoryTranslations: \{ \.\.\.current\.categoryTranslations, \.\.\.parsed\.row\.categoryTranslations \}/);
  assert.doesNotMatch(sql, /portal_image_path\s*=/);
  assert.doesNotMatch(sql, /storage\.objects|brand-media/);
});

test("13 missing CSV rows are non-destructive and unchanged rows are not applied", async () => {
  const actions = await source("src/features/catalog-productization/server/actions.ts");
  assert.match(actions, /action !== "unchanged"/);
  assert.doesNotMatch(actions, /missing.*archive|delete.*services/i);
  assert.doesNotMatch(await source(migrationPath), /delete from public\.services|truncate public\.services/i);
});

test("14 archive/reactivation preserve identity and permanent delete remains unavailable", async () => {
  const [adminActions, component, sql] = await Promise.all([
    source("src/features/catalog-admin/server/actions.ts"), source("src/components/catalog-admin/CatalogManagement.tsx"), source(migrationPath),
  ]);
  assert.match(adminActions, /archiveCatalogServiceAction[\s\S]*is_active: false/);
  assert.match(adminActions, /reactivateCatalogServiceAction[\s\S]*is_active: true/);
  assert.match(component, /serviceReactivate/);
  assert.doesNotMatch(adminActions, /\.from\("services"\)\.delete|deleteCatalogService/);
  assert.doesNotMatch(sql, /delete from public\.(services|order_items|invoice_items|orders|invoices)/i);
});

test("15 translations, lifecycle, reorder and import never rewrite historical snapshots", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /update public\.(orders|order_items|invoices|invoice_items|payments)/i);
  assert.doesNotMatch(sql, /delete from public\.(orders|order_items|invoices|invoice_items|payments)/i);
  assert.match(sql, /primary key \(organization_id, service_id, locale\)/);
});

test("16 admin exposes translations, ordering, export/import preview and archive controls in five locales", async () => {
  const [page, component, tools] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/settings/catalog/page.tsx"),
    source("src/components/catalog-admin/CatalogManagement.tsx"),
    source("src/components/catalog-admin/CatalogTools.tsx"),
  ]);
  assert.match(page, /CatalogTools/);
  assert.match(component, /routing\.locales\.map/g);
  assert.match(tools, /confirmImport/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.deepEqual(Object.keys(messages.catalogProductization.modes).sort(), ["alphabetical_asc", "alphabetical_desc", "manual"]);
    assert.equal(typeof messages.catalogProductization.translations, "string");
  }
});

test("17 import validates unit, numeric, boolean, lifecycle, locale columns and file limits", async () => {
  const actions = await source("src/features/catalog-productization/server/actions.ts");
  for (const value of ["unit_type", "manual_sort_order", "active_or_archived", "customer_visible", "customer_orderable", "featured", "invalidLocaleHeaders", "1_000_000", "500"]) assert.match(actions, new RegExp(value));
});

test("18 category keys and service IDs remain stable while localized values update independently", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /on conflict \(organization_id, service_id, locale\) do update set[\s\S]*name = excluded\.name/);
  assert.match(sql, /on conflict \(organization_id, category_key, locale\) do update set[\s\S]*title = excluded\.title/);
  assert.doesNotMatch(sql, /set service_id =|set category_key =/);
});

test("19 catalog productization adds no EcoWash clone or starter dataset", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /EcoWash|La Tejita|starter_catalog/i);
});
