import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260919000300_order_location_integrity_001.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("canonical create_order auto-resolves only a single active tenant location", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /create or replace function public\.create_order\(/);
  assert.match(sql, /org_id := public\.app_current_organization_id\(\)/);
  assert.match(sql, /if target_location_id is null then[\s\S]*select[\s\S]*count\(\*\)[\s\S]*array_agg\(location\.id order by location\.created_at, location\.id\)/);
  assert.match(sql, /location\.organization_id = org_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(sql, /active_location_count = 0[\s\S]*order_location_unavailable/);
  assert.match(sql, /active_location_count > 1[\s\S]*order_location_selection_required/);
  assert.match(sql, /values \([\s\S]*org_id,[\s\S]*resolved_location_id,/);
});

test("canonical create_order accepts a valid explicit location and rejects invalid location states", async () => {
  const sql = await source(migrationPath);
  const explicitBranch = sql.slice(sql.indexOf("else\n    select location.id"), sql.indexOf("new_order_number :="));

  assert.match(explicitBranch, /location\.id = target_location_id/);
  assert.match(explicitBranch, /location\.organization_id = org_id/);
  assert.match(explicitBranch, /location\.is_active/);
  assert.match(explicitBranch, /location\.deleted_at is null/);
  assert.match(explicitBranch, /resolved_location_id is null[\s\S]*order_location_invalid/);
});

test("regular Order form selects one location, requires a choice for many, and blocks zero", async () => {
  const [form, page, queries] = await Promise.all([
    source("src/components/orders/OrderForm.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/new/page.tsx"),
    source("src/features/orders/server/queries.ts"),
  ]);

  assert.match(form, /defaultValue=\{locations\.length === 1 \? locations\[0\]\.id : ""\}/);
  assert.match(form, /<option disabled value="">\{text\.chooseLocation\}<\/option>/);
  assert.match(form, /name="locationId"[\s\S]*required/);
  assert.match(form, /const canCreate = Boolean\(order\) \|\| locations\.length > 0/);
  assert.match(form, /role="alert">\{text\.noLocations\}/);
  assert.match(form, /disabled=\{isPending \|\| !canCreate\}/);
  assert.match(page, /listActiveLocationsForOrder\(locale\)/);
  assert.match(page, /locations=\{locations\}/);
  assert.match(queries, /from\("locations"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)[\s\S]*eq\("is_active", true\)[\s\S]*is\("deleted_at", null\)/);
});

test("regular Order location control and submit action remain mobile-safe", async () => {
  const form = await source("src/components/orders/OrderForm.tsx");

  assert.match(form, /className="grid gap-4 md:grid-cols-2"/);
  assert.match(form, /md:col-span-2[\s\S]*text\.location/);
  assert.match(form, /min-h-12 w-full/);
  assert.match(form, /className="w-full sm:w-auto"/);
  assert.doesNotMatch(form, /type="hidden"[^>]*name="locationId"/);
});

test("Portal allows exactly one active location and returns a controlled error otherwise", async () => {
  const [sql, action, types, page] = await Promise.all([
    source(migrationPath),
    source("src/features/portal/server/order-request-actions.ts"),
    source("src/features/portal/types.ts"),
    source("src/app/[locale]/portal/requests/new/page.tsx"),
  ]);
  const portal = sql.slice(sql.indexOf("create or replace function public.create_customer_portal_order_request("));

  assert.match(portal, /portal_org_id[\s\S]*customer_portal_access/);
  assert.match(portal, /location\.organization_id = portal_org_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(portal, /active_location_count = 0[\s\S]*portal_request_location_unavailable/);
  assert.match(portal, /active_location_count > 1[\s\S]*portal_request_location_selection_required/);
  assert.match(portal, /create_customer_portal_order_request_catalog_001/);
  assert.match(action, /portal_request_location_[^\n]*return "location"/);
  assert.match(types, /\| "location"/);
  assert.match(page, /location: t\("request\.errors\.location"\)/);
});

test("insert trigger blocks null, inactive, deleted, and cross-tenant locations for every new order", async () => {
  const sql = await source(migrationPath);
  const trigger = sql.slice(0, sql.indexOf("create or replace function public.create_order("));

  assert.match(trigger, /tg_op = 'INSERT'/);
  assert.match(trigger, /new\.location_id is null/);
  assert.match(trigger, /location\.id = new\.location_id/);
  assert.match(trigger, /location\.organization_id = new\.organization_id/);
  assert.match(trigger, /location\.is_active/);
  assert.match(trigger, /location\.deleted_at is null/);
  assert.match(trigger, /order_location_invalid/);
});

test("migration is forward-only and leaves historical null-location orders untouched", async () => {
  const sql = await source(migrationPath);

  assert.doesNotMatch(sql, /\b(update|delete from|truncate)\s+public\.orders\b/i);
  assert.doesNotMatch(sql, /alter table public\.orders[\s\S]*location_id\s+set\s+not\s+null/i);
  assert.doesNotMatch(sql, /create trigger|drop trigger/i);
  assert.doesNotMatch(sql, /tg_op = 'UPDATE'[\s\S]*order_location_invalid/);
});

test("Shop Terminal and Quick Drop creation contracts remain unchanged", async () => {
  const [sql, quickDrop, shop] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260829000600_quick_drop_001a_canonical_intake.sql"),
    source("supabase/migrations/20260907000100_terminal_order_defaults_001.sql"),
  ]);

  assert.doesNotMatch(sql, /create or replace function public\.(submit_shop_terminal_order|create_quick_drop_order)/);
  assert.match(quickDrop, /target_location_id is null/);
  assert.match(quickDrop, /from public\.create_order\(/);
  assert.match(shop, /create or replace function public\.submit_shop_terminal_order\(/);
});

test("financial, lifecycle, fulfillment, and Daily Close behavior remain outside this migration", async () => {
  const sql = await source(migrationPath);

  assert.doesNotMatch(sql, /create or replace function public\.(record_pos_payment|record_pos_refund|close_pos_session|calculate_daily_close_snapshot|close_business_day)/);
  assert.doesNotMatch(sql, /create or replace function public\.(transition_order_status|complete_customer_handoff|complete_pickup|complete_delivery)/);
  assert.doesNotMatch(sql, /\b(insert into|update|delete from) public\.(payments|refunds|pos_sessions|daily_closes|pickups|deliveries|order_customer_handoffs)\b/i);
});

test("all five locales include Order and Portal location guidance", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.orders.form.location.trim(), `${locale}.orders.form.location`);
    assert.ok(messages.orders.form.chooseLocation.trim(), `${locale}.orders.form.chooseLocation`);
    assert.ok(messages.orders.form.noLocations.trim(), `${locale}.orders.form.noLocations`);
    assert.ok(messages.portal.request.errors.location.trim(), `${locale}.portal.request.errors.location`);
  }
});

test("location protection retains least privilege and server-derived tenant isolation", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /security definer[\s\S]*set search_path = public/);
  assert.match(sql, /org_id := public\.app_current_organization_id\(\)/);
  assert.match(sql, /revoke all on function public\.create_order[\s\S]*from public, anon/);
  assert.match(sql, /grant execute on function public\.create_order[\s\S]*to authenticated/);
  assert.match(sql, /revoke all on function public\.create_customer_portal_order_request[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(sql, /service_role|grant execute[\s\S]*to anon/i);
});
