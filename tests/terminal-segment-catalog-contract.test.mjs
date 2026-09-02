import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260902000100_terminal_segment_catalog_001.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer without an active segment retains the general active location catalog", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /not exists \(select 1 from active_segment\)/);
  assert.match(sql, /service\.is_active/);
  assert.match(sql, /service\.location_id is null or service\.location_id = target_location_id/);
});

test("active customer segment restricts Terminal services without duplicating catalog rows", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /customer\.catalog_segment_id/);
  assert.match(sql, /segment\.organization_id = target_organization_id/);
  assert.match(sql, /segment\.is_active/);
  assert.match(sql, /segment_service\.service_id = service\.id/);
  assert.doesNotMatch(sql, /insert into public\.(services|service_prices|catalog_segment_services)/);
});

test("segment categories can only further restrict explicit segment services", async () => {
  const sql = await source(migrationPath);
  const serviceMembership = sql.indexOf("segment_service.service_id = service.id");
  const categoryMembership = sql.indexOf("segment_category.category_key = service.portal_category_key");
  assert.ok(serviceMembership > 0 && categoryMembership > serviceMembership);
  assert.match(sql, /not exists \([\s\S]*catalog_segment_categories[\s\S]*or exists \([\s\S]*category_key = service\.portal_category_key/);
});

test("inactive or foreign tenant segment cannot affect the general catalog", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /segment\.organization_id = target_organization_id[\s\S]*segment\.id = context\.catalog_segment_id[\s\S]*segment\.is_active/);
  assert.match(sql, /customer\.organization_id = target_organization_id/);
});

test("Terminal query resolves only the selected tenant customer active segment name", async () => {
  const queries = await source("src/features/shop-terminal/server/queries.ts");
  assert.match(queries, /from\("customers"\)[\s\S]*select\("catalog_segment_id"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)/);
  assert.match(queries, /from\("catalog_segments"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)[\s\S]*eq\("is_active", true\)/);
  assert.match(queries, /segmentName: segmentResult\.data\?\.name \?\? null/);
});

test("customer switch clears catalog state and ignores stale asynchronous responses", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(ui, /catalogRequestRef/);
  assert.match(ui, /setServices\(\[\]\)[\s\S]*setSegmentName\(null\)/);
  assert.match(ui, /catalogRequestRef\.current !== requestId/);
  assert.match(ui, /setServices\(catalog\.services\)/);
});

test("category chips derive only from the currently returned service set", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(ui, /for \(const service of services\)/);
  assert.match(ui, /Array\.from\(options/);
  assert.match(ui, /\[categoryLabels, services\]/);
});

test("canonical pricing resolver and precedence remain unchanged", async () => {
  const [sql, pricing] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260827000100_pricing_segments_001_segment_price_overrides.sql"),
  ]);
  assert.match(sql, /public\.resolve_effective_service_price\(/);
  assert.doesNotMatch(sql, /create or replace function public\.resolve_effective_service_price|update public\.(service_prices|catalog_segment_prices)/);
  assert.match(pricing, /coalesce\(segment_price\.amount, base\.amount\)/);
});

test("Terminal submission rejects manipulated services through the same eligibility predicate", async () => {
  const sql = await source(migrationPath);
  const submit = sql.slice(sql.indexOf("create or replace function public.submit_shop_terminal_order"));
  assert.match(submit, /public\.shop_terminal_service_is_eligible\([\s\S]*\(item->>'serviceId'\)::uuid/);
  assert.match(submit, /shop_terminal_service_not_eligible/);
  assert.match(submit, /public\.save_order_item\(/);
});

test("Terminal renders a compact localized segment indicator", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(ui, /segmentName \? [\s\S]*text\.segmentCatalog[\s\S]*segmentName/);
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.shopTerminal.labels.segmentCatalog, "string");
    assert.ok(messages.shopTerminal.labels.segmentCatalog.length > 0);
  }
});
