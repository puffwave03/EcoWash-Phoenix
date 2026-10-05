import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const migrationPath = "supabase/migrations/20261005000200_portal_context_isolation_001.sql";
const portalFoundationPath = "supabase/migrations/20260803000200_portal_001_safe_customer_rpc.sql";

function functionBody(sql, name) {
  const startPattern = new RegExp(`create(?: or replace)? function public\\.${name}\\s*\\(`, "i");
  const start = sql.search(startPattern);
  assert.notEqual(start, -1, `${name} definition missing`);
  const bodyStart = sql.indexOf("as $$", start);
  assert.notEqual(bodyStart, -1, `${name} body missing`);
  const end = sql.indexOf("$$;", bodyStart);
  assert.notEqual(end, -1, `${name} body terminator missing`);
  return sql.slice(start, end + 3);
}

test("1 the existing data model still permits one user to have multiple Portal contexts", async () => {
  const [schema, migration] = await Promise.all([
    source("supabase/migrations/20260803000100_portal_001_customer_portal.sql"),
    source(migrationPath),
  ]);

  assert.match(schema, /unique index customer_portal_access_user_customer_unique[\s\S]*\(user_id, customer_id\)/);
  assert.doesNotMatch(schema, /unique[^;\n]*\(user_id\)/i);
  assert.doesNotMatch(migration, /unique|delete\s+from\s+public\.customer_portal_access|update\s+public\.customer_portal_access/i);
});

test("2 customer_portal_current_access remains the one canonical visible context", async () => {
  const sql = await source(portalFoundationPath);
  const currentAccess = functionBody(sql, "customer_portal_current_access");

  assert.match(currentAccess, /access\.user_id = auth\.uid\(\)/);
  assert.match(currentAccess, /access\.is_active/);
  assert.match(currentAccess, /customer\.is_active/);
  assert.match(currentAccess, /order by access\.created_at[\s\S]*limit 1/);
});

test("3 every legacy Portal order read binds both tenant keys to the canonical context", async () => {
  const sql = await source(migrationPath);
  const names = [
    "list_customer_portal_orders",
    "get_customer_portal_order",
    "list_customer_portal_order_items",
    "list_customer_portal_order_history",
    "list_customer_portal_logistics",
    "list_customer_portal_order_photos",
    "list_customer_portal_next_tasks",
    "can_access_customer_order_photo",
  ];

  for (const name of names) {
    const body = functionBody(sql, name);
    assert.match(body, /public\.customer_portal_current_access\(\) portal_context/);
    assert.match(body, /portal_context\.organization_id = orders\.organization_id/);
    assert.match(body, /portal_context\.customer_id = orders\.customer_id/);
    assert.doesNotMatch(body, /public\.customer_portal_access/);
  }
});

test("4 direct Order detail and all child reads reject a non-canonical Order", async () => {
  const sql = await source(migrationPath);
  const targets = [
    ["get_customer_portal_order", /orders\.id = target_order_id/],
    ["list_customer_portal_order_items", /item\.order_id = target_order_id/],
    ["list_customer_portal_order_history", /history\.order_id = target_order_id/],
    ["list_customer_portal_logistics", /pickup\.order_id = target_order_id[\s\S]*delivery\.order_id = target_order_id/],
    ["list_customer_portal_order_photos", /photo\.order_id = target_order_id/],
  ];

  for (const [name, targetPattern] of targets) {
    const body = functionBody(sql, name);
    assert.match(body, targetPattern);
    assert.match(body, /orders\.is_active/);
    assert.match(body, /orders\.production_status <> 'cancelled'/);
  }
});

test("5 customer photos and Storage authorization share the canonical Order boundary", async () => {
  const sql = await source(migrationPath);
  const photoList = functionBody(sql, "list_customer_portal_order_photos");
  const storageAuthorization = functionBody(sql, "can_access_customer_order_photo");

  for (const body of [photoList, storageAuthorization]) {
    assert.match(body, /photo\.is_active/);
    assert.match(body, /photo\.customer_visible/);
    assert.match(body, /portal_context\.organization_id = orders\.organization_id/);
    assert.match(body, /portal_context\.customer_id = orders\.customer_id/);
    assert.match(body, /orders\.production_status <> 'cancelled'/);
  }
  assert.match(storageAuthorization, /photo\.storage_bucket = target_bucket/);
  assert.match(storageAuthorization, /photo\.storage_path = target_path/);
});

test("6 financial reads are canonical while established payment math is unchanged", async () => {
  const sql = await source(migrationPath);
  const financials = functionBody(sql, "list_customer_portal_order_financials");
  const payments = functionBody(sql, "list_customer_portal_order_payments");

  for (const body of [financials, payments]) {
    assert.match(body, /portal_context\.organization_id = orders\.organization_id/);
    assert.match(body, /portal_context\.customer_id = orders\.customer_id/);
    assert.match(body, /orders\.is_active/);
    assert.match(body, /orders\.production_status <> 'cancelled'/);
  }
  assert.match(financials, /payments\.status = 'confirmed'/);
  assert.match(financials, /payments\.status = 'refunded'/);
  assert.match(financials, /confirmed_total - payment_totals\.refunded_total/);
  assert.match(payments, /payments\.status in \('confirmed', 'refunded'\)/);
});

test("7 properties, branding and category reads cannot authorize another linked context", async () => {
  const sql = await source(migrationPath);
  const properties = functionBody(sql, "list_customer_portal_properties");
  const organizationAccess = functionBody(sql, "is_customer_portal_user_for_organization");

  assert.match(properties, /public\.customer_portal_current_access\(\) portal_context/);
  assert.match(properties, /property\.organization_id = portal_context\.organization_id/);
  assert.match(properties, /property\.customer_id = portal_context\.customer_id/);
  assert.match(properties, /organization\.status = 'active'/);
  assert.match(properties, /organization\.deleted_at is null/);
  assert.match(organizationAccess, /public\.customer_portal_current_access\(\) portal_context/);
  assert.match(organizationAccess, /portal_context\.organization_id = target_organization_id/);
  assert.match(organizationAccess, /organization\.platform_service_status = 'active'/);
});

test("8 existing order request and catalog flows select one matching Portal context", async () => {
  const [ordering, services, request] = await Promise.all([
    source("supabase/migrations/20260823000100_portal_002_1_customer_order_request.sql"),
    source("supabase/migrations/20260827000100_pricing_segments_001_segment_price_overrides.sql"),
    source("supabase/migrations/20260920000200_portal_after_close_intake_001.sql"),
  ]);

  for (const body of [
    functionBody(ordering, "get_customer_portal_ordering_context"),
    functionBody(services, "list_customer_portal_services"),
    functionBody(request, "create_customer_portal_order_request"),
  ]) {
    assert.match(body, /access\.user_id = auth\.uid\(\)/);
    assert.match(body, /access\.is_active/);
    assert.match(body, /customer\.is_active/);
    assert.match(body, /order by access\.created_at[\s\S]*limit 1/);
    assert.match(body, /organization\.status = 'active'/);
    assert.match(body, /organization\.deleted_at is null/);
  }
});

test("9 online payment availability and attempt creation remain single-context and Order-bound", async () => {
  const sql = await source("supabase/migrations/20260828000200_payments_online_001_customer_checkout.sql");
  for (const name of [
    "get_customer_portal_online_payment_availability",
    "create_customer_online_payment_attempt",
  ]) {
    const body = functionBody(sql, name);
    assert.match(body, /access\.user_id = auth\.uid\(\)/);
    assert.match(body, /access\.is_active/);
    assert.match(body, /customer\.is_active/);
    assert.match(body, /organization\.platform_service_status = 'active'/);
    assert.match(body, /order by access\.created_at[\s\S]*limit 1/);
    assert.match(body, /orders\.organization_id = portal_access\.organization_id/);
    assert.match(body, /orders\.customer_id = portal_access\.customer_id/);
    assert.match(body, /orders\.production_status <> 'cancelled'/);
  }
});

test("10 application branding and latest payment attempt use the canonical access values", async () => {
  const [portalPage, paymentQueries] = await Promise.all([
    source("src/app/[locale]/portal/page.tsx"),
    source("src/features/online-payments/server/queries.ts"),
  ]);

  assert.match(portalPage, /const access = await requireCustomerPortalAccess\(locale\)/);
  assert.match(portalPage, /getTenantBranding\(access\.organizationId\)/);
  assert.match(paymentQueries, /const access = await requireCustomerPortalAccess\(locale\)/);
  assert.match(paymentQueries, /\.eq\("organization_id", access\.organizationId\)/);
  assert.match(paymentQueries, /\.eq\("customer_id", access\.customerId\)/);
});

test("11 all replaced SECURITY DEFINER functions keep a fixed search path and deny anon", async () => {
  const sql = await source(migrationPath);
  const names = [
    "list_customer_portal_orders",
    "get_customer_portal_order",
    "list_customer_portal_order_items",
    "list_customer_portal_order_history",
    "list_customer_portal_logistics",
    "list_customer_portal_order_photos",
    "list_customer_portal_next_tasks",
    "can_access_customer_order_photo",
    "list_customer_portal_order_financials",
    "list_customer_portal_order_payments",
    "list_customer_portal_properties",
    "is_customer_portal_user_for_organization",
  ];

  for (const name of names) {
    const body = functionBody(sql, name);
    assert.match(body, /security definer[\s\S]*set search_path = public/);
  }
  assert.equal((sql.match(/revoke all on function/g) ?? []).length, names.length);
  assert.equal((sql.match(/from public, anon, authenticated/g) ?? []).length, names.length);
  assert.equal((sql.match(/grant execute on function/g) ?? []).length, names.length);
});

test("12 the migration contains no data, table, policy, trigger or index mutation", async () => {
  const sql = await source(migrationPath);

  assert.doesNotMatch(sql, /\b(?:alter|create|drop)\s+table\b/i);
  assert.doesNotMatch(sql, /\b(?:create|drop)\s+(?:policy|trigger|index)\b/i);
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate)\b/i);
  assert.doesNotMatch(sql, /create_customer_portal_order_request|create_customer_online_payment_attempt/);
});
