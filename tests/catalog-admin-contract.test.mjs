import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260824000500_catalog_admin_001_customer_catalog.sql";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("catalog administration uses the existing Owner/Manager guard while branding stays Owner-only", async () => {
  const [catalogQueries, catalogActions, brandingQueries, brandingActions] = await Promise.all([
    source("src/features/catalog-admin/server/queries.ts"),
    source("src/features/catalog-admin/server/actions.ts"),
    source("src/features/branding/server/queries.ts"),
    source("src/features/branding/server/actions.ts"),
  ]);

  assert.match(catalogQueries, /requireOwnerOrManager\(locale\)/);
  assert.match(catalogActions, /requireOwnerOrManager\(locale\)/);
  assert.match(brandingQueries, /requireOwner\(locale\)/);
  assert.match(brandingActions, /requireOwner\(locale\)/);
});

test("Staff navigation does not include management catalog routes", async () => {
  const navigation = await source("src/components/dashboard/AppNavigation.tsx");
  const controlBranch = navigation.indexOf("const navigationGroups = isControlRole");
  const staffBranch = navigation.indexOf("    : [", controlBranch);
  const catalogRoute = navigation.indexOf("/app/settings/catalog", controlBranch);

  assert.ok(controlBranch >= 0 && staffBranch > controlBranch);
  assert.ok(catalogRoute > controlBranch && catalogRoute < staffBranch);
});

test("Portal discovery enforces active service, visibility, visible category and current price", async () => {
  const migration = await source(migrationPath);
  const listStart = migration.indexOf("create function public.list_customer_portal_services()");
  const listEnd = migration.indexOf("revoke all on function public.list_customer_portal_services()", listStart);
  const listFunction = migration.slice(listStart, listEnd);

  assert.match(listFunction, /service\.is_active/);
  assert.match(listFunction, /service\.portal_visible/);
  assert.match(listFunction, /category\.portal_visible/);
  assert.match(listFunction, /price\.is_active/);
  assert.match(listFunction, /price\.valid_from <=/);
  assert.match(listFunction, /price\.valid_to is null/);
});

test("Portal writes additionally enforce organization, orderability and category visibility", async () => {
  const migration = await source(migrationPath);
  const wrapperStart = migration.indexOf("create function public.create_customer_portal_order_request(");
  const wrapper = migration.slice(wrapperStart);

  assert.match(wrapper, /service\.organization_id = portal_org_id/);
  assert.match(wrapper, /service\.portal_visible/);
  assert.match(wrapper, /service\.customer_orderable/);
  assert.match(wrapper, /category\.portal_visible/);
  assert.match(wrapper, /create_customer_portal_order_request_catalog_001/);
});

test("internal New Order service query remains independent from Portal presentation flags", async () => {
  const internalQuery = await source("src/features/services/server/queries.ts");

  assert.doesNotMatch(internalQuery, /portal_visible/);
  assert.doesNotMatch(internalQuery, /customer_orderable/);
  assert.match(internalQuery, /listActiveServicesForOrder/);
});

test("new internal services default non-orderable and tenant media paths are organization-scoped", async () => {
  const migration = await source(migrationPath);

  assert.match(migration, /customer_orderable boolean not null default false/);
  assert.match(migration, /customer_orderable = portal_visible/);
  assert.match(migration, /when category ~ '\^\[a-z0-9_\]\{1,64\}\$' then category/);
  assert.match(migration, /app_brand_media_path_organization_id\(portal_image_path\) = organization_id/);
  assert.match(migration, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(migration, /split_part\(name, '\/', 2\) in \('category', 'service'\)/);
});

test("all five locales expose catalog management and informational-only labels", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.catalogAdmin.title, "string");
    assert.equal(typeof messages.catalog.informationOnly, "string");
    assert.equal(typeof messages.auth.dashboard.catalogAdmin, "string");
  }
});

test("runtime placeholder strings stay raw and server-action forms delegate encoding to React", async () => {
  const [page, management] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/settings/catalog/page.tsx"),
    source("src/components/catalog-admin/CatalogManagement.tsx"),
  ]);
  assert.match(page, /t\.raw\("bulkConfirm"\)/);
  assert.match(page, /t\.raw\("selectedCount"\)/);
  assert.doesNotMatch(management, /encType=/);
});
