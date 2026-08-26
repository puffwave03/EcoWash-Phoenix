import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260824000600_catalog_segments_001_customer_quick_catalogs.sql";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("segment schema references the existing tenant catalog and one primary customer assignment", async () => {
  const migration = await source(migrationPath);

  assert.match(migration, /create table public\.catalog_segments/);
  assert.match(migration, /create table public\.catalog_segment_services/);
  assert.match(migration, /references public\.services \(organization_id, id\)/);
  assert.match(migration, /create table public\.catalog_segment_categories/);
  assert.match(migration, /add column catalog_segment_id uuid/);
  assert.doesNotMatch(migration, /insert into public\.services/);
  assert.doesNotMatch(migration, /update public\.service_prices/);
});

test("segment writes are Owner/Manager-only and Staff assignment replay is denied", async () => {
  const [migration, queries, actions] = await Promise.all([
    source(migrationPath),
    source("src/features/catalog-segments/server/queries.ts"),
    source("src/features/catalog-segments/server/actions.ts"),
  ]);

  assert.match(migration, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(migration, /catalog_segment_assignment_not_authorized/);
  assert.match(migration, /before update of catalog_segment_id on public\.customers/);
  assert.match(migration, /catalog_segments\.organization_id cannot be changed/);
  assert.match(queries, /requireOwnerOrManager\(locale\)/);
  assert.match(actions, /requireOwnerOrManager\(locale\)/);
});

test("transactional save rejects cross-tenant services, categories and customers", async () => {
  const migration = await source(migrationPath);
  const saveStart = migration.indexOf("create function public.save_catalog_segment(");
  const saveEnd = migration.indexOf("drop function public.list_customer_portal_services()", saveStart);
  const saveFunction = migration.slice(saveStart, saveEnd);

  assert.match(saveFunction, /service\.organization_id = target_organization_id/);
  assert.match(saveFunction, /category\.organization_id = target_organization_id/);
  assert.match(saveFunction, /customer\.organization_id = target_organization_id/);
  assert.match(saveFunction, /catalog_segment_cross_tenant_reference/);
  assert.match(saveFunction, /update public\.customers/);
  assert.match(saveFunction, /catalog_segment_id = saved_segment_id/);
});

test("Portal shortcuts enforce every global catalog and current-price rule", async () => {
  const migration = await source(migrationPath);
  const listStart = migration.indexOf("create function public.list_customer_portal_services()");
  const listFunction = migration.slice(listStart);

  assert.match(listFunction, /service\.organization_id = context\.organization_id/);
  assert.match(listFunction, /service\.is_active/);
  assert.match(listFunction, /service\.portal_visible/);
  assert.match(listFunction, /service\.customer_orderable/);
  assert.match(listFunction, /category\.portal_visible/);
  assert.match(listFunction, /price\.is_active/);
  assert.match(listFunction, /price\.valid_from <=/);
  assert.match(listFunction, /price\.valid_to is null/);
  assert.match(listFunction, /segment_service\.service_id is not null or segment_category\.category_key is not null/);
});

test("inactive or Portal-hidden segments resolve as no personalization and empty shortcuts stay hidden", async () => {
  const [migration, overview, orderForm] = await Promise.all([
    source(migrationPath),
    source("src/components/portal/CustomerPortalViews.tsx"),
    source("src/components/portal/CustomerOrderRequestForm.tsx"),
  ]);

  assert.match(migration, /segment\.is_active/);
  assert.match(migration, /segment\.portal_visible/);
  assert.match(overview, /segment && segmentCategories\.length > 0/);
  assert.match(orderForm, /segment && segmentServices\.length > 0/);
  assert.match(orderForm, /groupServicesByCategory\(services\)/);
  assert.match(orderForm, /serviceSearch/);
});

test("segment selection has one shared order quantity state and the full catalog remains present", async () => {
  const orderForm = await source("src/components/portal/CustomerOrderRequestForm.tsx");

  assert.match(orderForm, /const \[quantities, setQuantities\]/);
  assert.match(orderForm, /segmentServices\.map/);
  assert.match(orderForm, /visibleCategoryGroups\.map/);
  assert.match(orderForm, /text\.completeCatalog/);
});

test("customer account protects segment assignment behind the Owner/Manager route", async () => {
  const [detail, account] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/customers/[customerId]/page.tsx"),
    source("src/components/customers/CustomerAccountView.tsx"),
  ]);

  assert.match(detail, /requireOwnerOrManager\(locale\)/);
  assert.match(account, /<CustomerSegmentAssignmentPanel/);
  assert.match(account, /assignCustomerSegmentAction/);
});

test("optional starters only select existing tenant rows and never seed global segment data", async () => {
  const [migration, actions] = await Promise.all([
    source(migrationPath),
    source("src/features/catalog-segments/server/actions.ts"),
  ]);

  assert.doesNotMatch(migration, /Case Vacanze|Vacation rental|Hotel|Ristorazione|Restaurant|Privati/);
  assert.match(actions, /organization_portal_categories/);
  assert.match(actions, /\.eq\("organization_id", organizationId\)/);
  assert.match(actions, /\.eq\("portal_visible", true\)/);
  assert.match(actions, /\.eq\("customer_orderable", true\)/);
});

test("all five locales include segment admin, assignment and Portal personalization labels", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.catalogSegments.title, "string");
    assert.equal(typeof messages.catalogAdmin.segmentsLink, "string");
    assert.equal(typeof messages.customers.segment.title, "string");
    assert.equal(typeof messages.portal.segments.servicesForYou, "string");
    assert.equal(typeof messages.portal.segments.completeCatalog, "string");
  }
});
