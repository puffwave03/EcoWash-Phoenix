import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260830000100_catalog_structure_001_category_lifecycle.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("category lifecycle is additive, stable-keyed and blocks unsafe archival", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /add column is_active boolean not null default true/);
  assert.match(migration, /prevent_catalog_category_unsafe_archive/);
  assert.match(migration, /service\.is_active/);
  assert.match(migration, /coalesce\(service\.portal_category_key, service\.category\) = old\.category_key/);
  assert.match(migration, /raise exception 'catalog_category_has_active_services' using errcode = '23503'/);
  assert.doesNotMatch(migration, /delete from public\.(?:organization_portal_categories|services)/);
});

test("category create, rename and order keep the immutable category key", async () => {
  const [actions, validation] = await Promise.all([
    source("src/features/catalog-admin/server/actions.ts"),
    source("src/features/catalog-admin/validation.ts"),
  ]);
  assert.match(actions, /createCatalogCategoryAction/);
  assert.match(validation, /categoryKeyFromTitle/);
  assert.match(actions, /portal_title: parsed\.input\.portalTitle/);
  assert.match(actions, /category_key: parsed\.input\.categoryKey/);
  assert.match(actions, /portal_sort_order: parsed\.input\.portalSortOrder/);
  const categorySave = actions.slice(actions.indexOf("export async function saveCatalogCategoryAction"), actions.indexOf("export async function archiveCatalogCategoryAction"));
  assert.doesNotMatch(categorySave, /category_key:\s*parsed\.input\.portalTitle/);
});

test("service moves update internal and Portal category together without changing identity", async () => {
  const actions = await source("src/features/catalog-admin/server/actions.ts");
  const serviceSave = actions.slice(actions.indexOf("export async function saveCatalogServiceAction"), actions.indexOf("export async function saveCatalogCategoryAction"));
  assert.match(serviceSave, /category: parsed\.input\.portalCategoryKey/);
  assert.match(serviceSave, /portal_category_key: parsed\.input\.portalCategoryKey/);
  assert.match(serviceSave, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(serviceSave, /\.eq\("id", parsed\.input\.serviceId\)/);
  assert.doesNotMatch(serviceSave, /code:|id:/);
});

test("service retirement is archive-only and preserves dependent records", async () => {
  const actions = await source("src/features/catalog-admin/server/actions.ts");
  const archive = actions.slice(actions.indexOf("export async function archiveCatalogServiceAction"), actions.indexOf("export async function bulkUpdateCatalogServicesAction"));
  assert.match(archive, /is_active: false/);
  assert.match(archive, /portal_visible: false/);
  assert.match(archive, /customer_orderable: false/);
  assert.doesNotMatch(archive, /\.delete\(|service_prices|catalog_segment|order_items|invoice_items/);
});

test("live Catalog, Terminal and Portal respect current structure and inactive services", async () => {
  const [catalog, terminal, portalMigration] = await Promise.all([
    source("src/features/catalog-admin/server/queries.ts"),
    source("src/features/shop-terminal/server/queries.ts"),
    source("supabase/migrations/20260824000500_catalog_admin_001_customer_catalog.sql"),
  ]);
  assert.match(catalog, /is_active, portal_visible/);
  assert.match(terminal, /organization_portal_categories/);
  assert.match(terminal, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(terminal, /\.eq\("is_active", true\)/);
  assert.match(terminal, /categoryTitles\.get\(service\.category\)/);
  assert.match(portalMigration, /service\.is_active/);
  assert.match(portalMigration, /category\.portal_visible/);
});

test("historical order and invoice descriptions remain immutable snapshots", async () => {
  const [orders, billing, actions] = await Promise.all([
    source("supabase/migrations/20260728000200_app_006_orders_workflow.sql"),
    source("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql"),
    source("src/features/catalog-admin/server/actions.ts"),
  ]);
  assert.match(orders, /final_description := coalesce\(final_description, service_name\)/);
  assert.match(billing, /insert into public\.invoice_items[\s\S]*item_row\.description/);
  assert.doesNotMatch(actions, /from\("(?:order_items|invoice_items)"\)/);
});

test("Owner and Manager remain authorized, Staff is denied, and tenant scope is explicit", async () => {
  const [actions, migration] = await Promise.all([
    source("src/features/catalog-admin/server/actions.ts"),
    source(migrationPath),
  ]);
  assert.match(actions, /requireOwnerOrManager\(locale\)/);
  assert.match(actions, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(migration, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(migration, /org_id uuid := public\.app_current_organization_id\(\)/);
});

test("all locales expose create and safe archive controls", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.catalogAdmin.categoryCreate, "string");
    assert.equal(typeof messages.catalogAdmin.categoryArchiveBlocked, "string");
    assert.equal(typeof messages.catalogAdmin.serviceArchive, "string");
  }
});
