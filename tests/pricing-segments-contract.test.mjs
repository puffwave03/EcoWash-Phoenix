import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260827000100_pricing_segments_001_segment_price_overrides.sql";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function resolver() {
  const migration = await source(migrationPath);
  return migration.slice(
    migration.indexOf("create function public.resolve_effective_service_price("),
    migration.indexOf("create function public.save_catalog_segment_price("),
  );
}

test("1 customer without segment resolves the current base price", async () => {
  const sql = await resolver();
  assert.match(sql, /from base_price base[\s\S]*left join active_segment segment on true/);
  assert.match(sql, /coalesce\(segment_price\.amount, base\.amount\)/);
});

test("2 segment without override safely falls back to the base price", async () => {
  const sql = await resolver();
  assert.match(sql, /left join segment_price on true/);
  assert.match(sql, /case when segment_price\.id is null then 'base'/);
});

test("3 a valid segment override wins over the base price", async () => {
  const sql = await resolver();
  assert.match(sql, /price\.segment_id = segment\.id/);
  assert.match(sql, /case when segment_price\.id is null then 'base' else 'segment' end/);
});

test("4 an inactive override cannot win", async () => {
  assert.match(await resolver(), /price\.is_active/);
});

test("5 future and expired overrides are excluded by effective dates", async () => {
  const sql = await resolver();
  assert.match(sql, /price\.valid_from <= target_effective_date/);
  assert.match(sql, /price\.valid_to is null or price\.valid_to >= target_effective_date/);
});

test("6 pricing is scoped to the customer's active segment", async () => {
  const sql = await resolver();
  assert.match(sql, /segment\.id = context\.catalog_segment_id/);
  assert.match(sql, /segment\.is_active/);
});

test("7 Portal visibility and orderability still win", async () => {
  const migration = await source(migrationPath);
  const portal = migration.slice(migration.indexOf("create function public.list_customer_portal_services()"));
  assert.match(portal, /service\.is_active and service\.portal_visible/);
  assert.match(portal, /category\.portal_visible/);
  assert.match(portal, /service\.customer_orderable/);
});

test("8 internal order service selection uses the centralized effective resolver", async () => {
  const [migration, page] = await Promise.all([
    source(migrationPath),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
  ]);
  assert.match(migration, /create function public\.list_effective_order_services/);
  assert.match(page, /listEffectiveServicesForOrder\(locale, orderId\)/);
});

test("9 Portal uses the same centralized effective resolver", async () => {
  const migration = await source(migrationPath);
  const calls = migration.match(/public\.resolve_effective_service_price\(/g) ?? [];
  assert.ok(calls.length >= 3);
  assert.match(migration.slice(migration.indexOf("create function public.list_customer_portal_services()")), /current_price\.pricing_source/);
});

test("10 final order lines snapshot the server-resolved effective price", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /create trigger order_items_resolve_effective_price/);
  assert.match(migration, /new\.unit_price := effective_price/);
  assert.match(migration, /new\.line_total := round\(new\.quantity \* effective_price, 2\)/);
});

test("11 a tampered client unit price is overwritten by server truth", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /before insert or update of service_id, quantity, unit_price on public\.order_items/);
  assert.match(migration, /select price\.amount into effective_price/);
});

test("12 changing an override never mutates historical orders", async () => {
  const migration = await source(migrationPath);
  assert.doesNotMatch(migration, /update public\.orders/);
  assert.doesNotMatch(migration, /update public\.order_items/);
  assert.match(migration, /before insert or update of service_id, quantity, unit_price/);
});

test("13 Billing remains based on historical order snapshots", async () => {
  const [pricing, billing] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql"),
  ]);
  assert.doesNotMatch(pricing, /public\.invoices/);
  assert.match(billing, /item_row\.unit_price/);
  assert.doesNotMatch(billing, /resolve_effective_service_price/);
});

test("14 Owner can administer segment prices", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(migration, /grant execute on function public\.save_catalog_segment_price/);
});

test("15 Manager can administer segment prices through the feature boundary", async () => {
  const [migration, actions, queries] = await Promise.all([
    source(migrationPath),
    source("src/features/pricing-segments/server/actions.ts"),
    source("src/features/pricing-segments/server/queries.ts"),
  ]);
  assert.match(migration, /'manager'/);
  assert.match(actions, /requireOwnerOrManager\(locale\)/);
  assert.match(queries, /requireOwnerOrManager\(locale\)/);
});

test("16 Staff has neither table write access nor administration route access", async () => {
  const [migration, page] = await Promise.all([
    source(migrationPath),
    source("src/app/[locale]/app/(dashboard)/settings/catalog/segments/page.tsx"),
  ]);
  assert.match(migration, /grant select on public\.catalog_segment_prices to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*catalog_segment_prices to authenticated/);
  assert.match(page, /getSegmentPricingSettings\(locale\)/);
});

test("17 cross-tenant overrides are rejected by composite FKs and secure RPC validation", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /references public\.catalog_segments \(organization_id, id\)/);
  assert.match(migration, /references public\.services \(organization_id, id\)/);
  assert.match(migration, /references public\.locations \(organization_id, id\)/);
  assert.match(migration, /catalog_segment_price_cross_tenant_reference/);
});

test("active overrides reject overlapping periods in the same tenant scope", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /daterange\(existing\.valid_from, existing\.valid_to, '\[\]'\)/);
  assert.match(migration, /catalog_segment_price_period_overlap/);
});

test("the migration is additive and does not seed or rewrite catalogue business data", async () => {
  const migration = await source(migrationPath);
  assert.doesNotMatch(migration, /insert into public\.services/);
  assert.doesNotMatch(migration, /update public\.service_prices/);
  assert.doesNotMatch(migration, /insert into public\.catalog_segments/);
});

test("all five locales expose pricing administration copy", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.pricingSegments.title, "string");
    assert.equal(typeof messages.orders.items.segmentPrice, "string");
  }
});
