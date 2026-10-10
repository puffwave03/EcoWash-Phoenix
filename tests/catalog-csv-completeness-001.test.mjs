import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { parseCsv, serializeCatalogCsv } from "../src/features/catalog-productization/csv.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const id = (index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const locales = ["en", "it", "es", "fr", "de"];

async function harness(count, { denied = false, failTranslationPage = false } = {}) {
  const tenant = "tenant-a";
  const other = "tenant-b";
  const services = Array.from({ length: count + 10 }, (_, index) => ({
    organization_id: index < count ? tenant : other,
    id: id(index + 1), code: `S${index + 1}`, name: `Service ${index + 1}`,
    description: `Description ${index + 1}`, category: "dry_cleaning", unit_type: "piece",
    is_active: index % 7 !== 0, portal_category_key: "dry_cleaning",
    portal_sort_order: index % 13, portal_visible: true, customer_orderable: true,
    portal_featured: false, portal_image_path: `tenant/${index + 1}.webp`,
  }));
  const serviceTranslations = services.flatMap((service) => locales.map((locale) => ({
    organization_id: service.organization_id, service_id: service.id, locale,
    name: `${locale}-${service.name}`, description: `${locale}-${service.description}`,
  })));
  const categoryTranslations = locales.map((locale) => ({
    organization_id: tenant, category_key: "dry_cleaning", locale, title: `${locale}-Dry cleaning`,
  }));
  const tables = {
    services,
    organization_portal_categories: [{ organization_id: tenant, category_key: "dry_cleaning", is_active: true }],
    service_catalog_translations: serviceTranslations,
    category_catalog_translations: categoryTranslations,
    organizations: [{ id: tenant, catalog_order_mode: "manual" }],
  };
  const calls = { guard: 0, queries: [], rpc: 0 };
  const client = {
    from(table) {
      assert.ok(table in tables, `unexpected table: ${table}`);
      const filters = [];
      const equalities = [];
      const orders = [];
      let limit = 1000;
      const query = {
        select: () => query,
        eq: (column, value) => { equalities.push([column, value]); filters.push((row) => row[column] === value); return query; },
        gt: (column, value) => { filters.push((row) => row[column] > value); return query; },
        in: (column, values) => { filters.push((row) => values.includes(row[column])); return query; },
        order: (column, options = {}) => { orders.push([column, options.ascending !== false]); return query; },
        limit: (value) => { limit = value; return query; },
        returns: async () => {
          calls.queries.push({ table, equalities, limit });
          if (table === "service_catalog_translations" && failTranslationPage && calls.queries.filter((call) => call.table === table).length === 2) {
            return { data: null, error: { code: "TEST_ERROR" } };
          }
          const rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
          rows.sort((left, right) => {
            for (const [column, ascending] of orders) {
              const result = String(left[column]).localeCompare(String(right[column]));
              if (result) return ascending ? result : -result;
            }
            return 0;
          });
          return { data: rows.slice(0, Math.min(limit, 1000)), error: null };
        },
        single: async () => {
          const result = await query.returns();
          return { data: result.data?.[0] ?? null, error: result.data?.length === 1 ? null : { code: "NO_ROW" } };
        },
      };
      return query;
    },
    rpc: async (name, args) => {
      assert.equal(name, "apply_catalog_import");
      assert.ok(args.target_rows.length <= 500);
      calls.rpc++;
      return { error: null };
    },
  };
  const guard = async () => {
    calls.guard++;
    if (denied) throw new Error("denied");
    return { membership: { organization: { id: tenant } } };
  };
  const mocks = {
    "server-only": {},
    "@/features/services/catalog": { SERVICE_CATEGORY_KEYS: ["dry_cleaning"] },
    "@/lib/auth/require-role": { requireOwnerOrManager: guard },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => client },
    "@/features/catalog-productization/csv": { parseCsv, CATALOG_CSV_HEADERS: (await import("../src/features/catalog-productization/csv.ts")).CATALOG_CSV_HEADERS },
    "@/features/catalog-productization/types": { CATALOG_ORDER_MODES: ["alphabetical_asc", "alphabetical_desc", "manual"] },
    "@/features/services/types": { SERVICE_UNIT_TYPES: ["piece", "weight", "area", "cycle", "service", "day"] },
    "@/i18n/routing": { routing: { locales } },
    "next/cache": { revalidatePath: () => {} },
  };
  class CatalogFile {
    constructor(contents) { this.contents = contents; this.size = Buffer.byteLength(contents); }
    async text() { return this.contents; }
  }
  const load = async (path, extra = {}) => {
    const compiled = ts.transpileModule(await source(path), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const exports = {};
    new Function("require", "exports", "File", compiled)((name) => {
      if (name in extra) return extra[name];
      if (name in mocks) return mocks[name];
      throw new Error(`unexpected import: ${name}`);
    }, exports, CatalogFile);
    return exports;
  };
  const queryModule = await load("src/features/catalog-productization/server/queries.ts");
  const actions = await load("src/features/catalog-productization/server/actions.ts", {
    "@/features/catalog-productization/server/queries": queryModule,
  });
  const file = (contents) => new CatalogFile(contents);
  return { actions, calls, file, getCatalogExportData: queryModule.getCatalogExportData };
}

for (const count of [499, 500, 501, 1203]) {
  test(`${count} services export completely with stable order and no cross-tenant rows`, async () => {
    const h = await harness(count);
    const { rows, mediaPaths } = await h.getCatalogExportData("en");
    assert.equal(rows.length, count);
    assert.equal(new Set(rows.map((row) => row.serviceId)).size, count);
    assert.deepEqual(new Set(rows.map((row) => row.serviceId)), new Set(Array.from({ length: count }, (_, index) => id(index + 1))));
    assert.deepEqual(rows.map((row) => [row.manualSortOrder, row.serviceId]), [...rows]
      .sort((left, right) => left.manualSortOrder - right.manualSortOrder || left.serviceId.localeCompare(right.serviceId))
      .map((row) => [row.manualSortOrder, row.serviceId]));
    assert.equal(rows[0].translations.es?.name.startsWith("es-Service"), true);
    assert.equal(rows[0].categoryTranslations.fr, "fr-Dry cleaning");
    assert.equal(mediaPaths.size, count);
    const csv = serializeCatalogCsv(rows, mediaPaths);
    assert.equal(parseCsv(csv.replace(/^\uFEFF/, "")).length - 1, count);
    assert.ok(h.calls.queries.filter((call) => call.table === "services").length >= Math.ceil(count / 500));
    assert.ok(h.calls.queries.every((call) => call.equalities.some(([column, value]) =>
      column === (call.table === "organizations" ? "id" : "organization_id") && value === "tenant-a")));
  });
}

test("export denies unauthorized users before any data read and fails closed on a later query error", async () => {
  const denied = await harness(501, { denied: true });
  await assert.rejects(denied.getCatalogExportData("en"), /denied/);
  assert.equal(denied.calls.queries.length, 0);
  const failed = await harness(501, { failTranslationPage: true });
  await assert.rejects(failed.getCatalogExportData("en"), /catalog_export_unavailable/);
});

test("500-row import preview and confirmation remain accepted; 501 rows fail before RPC", async () => {
  const h = await harness(500);
  const exported = await h.getCatalogExportData("en");
  const csv = serializeCatalogCsv(exported.rows, exported.mediaPaths);
  const preview = await h.actions.previewCatalogImportAction("en", undefined, { get: () => h.file(csv) });
  assert.equal(preview.error, null);
  assert.ok(preview.payload !== null);
  assert.equal(h.calls.rpc, 0);
  const confirmData = new FormData();
  confirmData.set("payload", preview.payload);
  const confirmed = await h.actions.confirmCatalogImportAction("en", undefined, confirmData);
  assert.equal(confirmed.success, true);
  assert.equal(h.calls.rpc, 1);
  const extraRow = { ...exported.rows[0], serviceId: id(9999), serviceCode: "EXTRA" };
  const rejectedPreview = await h.actions.previewCatalogImportAction("en", undefined, {
    get: () => h.file(serializeCatalogCsv([...exported.rows, extraRow], exported.mediaPaths)),
  });
  assert.equal(rejectedPreview.error, "rows");
  assert.equal(rejectedPreview.payload, null);
  assert.equal(h.calls.rpc, 1);
  const tooMany = new FormData();
  tooMany.set("payload", JSON.stringify([...exported.rows, extraRow]));
  const rejected = await h.actions.confirmCatalogImportAction("en", undefined, tooMany);
  assert.equal(rejected.error, "rows");
  assert.equal(h.calls.rpc, 1);
});

test("all locales explain the 500-row import limit in the existing UI error path", async () => {
  const component = await source("src/components/catalog-admin/CatalogTools.tsx");
  assert.match(component, /previewState\.error === "rows" \? text\.importSizeError/);
  assert.match(component, /confirmState\.error === "rows" \? text\.importSizeError/);
  for (const locale of locales) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.match(messages.catalogProductization.importSizeError, /500/);
  }
});
