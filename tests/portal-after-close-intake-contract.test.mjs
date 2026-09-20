import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260920000200_portal_after_close_intake_001.sql";
const source = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = await source(migrationPath);

test("1 Portal before close preserves created_at attribution and leaves the override null", () => {
  assert.match(migration, /add column operational_business_date date/);
  assert.match(
    migration,
    /if exists \([\s\S]*from public\.daily_closes[\s\S]*new\.operational_business_date := submission_business_date \+ 1;[\s\S]*end if;/,
  );
  assert.doesNotMatch(migration, /default\s+[^;]*operational_business_date/i);
});

test("2 Portal after close still creates immediately through the existing atomic RPC", () => {
  assert.match(
    migration,
    /perform set_config\('app\.portal_after_close_intake', 'on', true\);[\s\S]*create_customer_portal_order_request_catalog_001/,
  );
  assert.doesNotMatch(migration, /daily_close_business_day_closed/);
});

test("3 the true order creation timestamp is preserved", () => {
  assert.match(
    migration,
    /submission_business_date :=\s*\(new\.created_at at time zone organization_timezone\)::date/,
  );
  assert.doesNotMatch(migration, /new\.created_at\s*:=|update public\.orders/i);
});

test("4 an applicable definitive close assigns the next tenant-local business date", () => {
  assert.match(
    migration,
    /daily_close\.organization_id = new\.organization_id[\s\S]*daily_close\.business_date = submission_business_date[\s\S]*daily_close\.location_id is null[\s\S]*daily_close\.location_id = new\.location_id/,
  );
  assert.match(
    migration,
    /new\.operational_business_date := submission_business_date \+ 1/,
  );
});

test("5 the closed date excludes a deferred Portal order from order and sales attribution", () => {
  const matches = migration.match(
    /coalesce\(orders\.operational_business_date, \(orders\.created_at at time zone target_timezone\)::date\) = target_business_date/g,
  );
  assert.ok((matches?.length ?? 0) >= 4);
});

test("6 the next date includes the deferred order and open-order state", () => {
  assert.match(
    migration,
    /coalesce\(orders\.operational_business_date, \(orders\.created_at at time zone target_timezone\)::date\) <= target_business_date/,
  );
  assert.match(migration, /'createdIds', order_events\.created_ids/);
});

test("6a the live Daily Close preview uses the same nullable operational-date attribution", async () => {
  const [dailyCloseQuery, accountingQuery] = await Promise.all([
    source("src/features/daily-close/server/queries.ts"),
    source("src/features/accounting/server/queries.ts"),
  ]);
  assert.match(
    dailyCloseQuery,
    /operational_business_date\.is\.null,created_at\.gte\.\$\{day\.start\.toISOString\(\)\},created_at\.lt\.\$\{endExclusive\.toISOString\(\)\}/,
  );
  assert.match(
    dailyCloseQuery,
    /salesOperationalBusinessDate: day\.businessDate/,
  );
  assert.match(
    accountingQuery,
    /filter\.salesOperationalBusinessDate[\s\S]*operational_business_date\.eq\.\$\{filter\.salesOperationalBusinessDate\}[\s\S]*:\s*query\.gte\("created_at"/,
  );
});

test("7 idempotent retries retain the established request boundary", () => {
  assert.match(migration, /target_request_id uuid/);
  assert.match(
    migration,
    /create_customer_portal_order_request_catalog_001\(\s*target_request_id,/,
  );
  assert.equal(
    (migration.match(/before insert on public\.orders/g) ?? []).length,
    1,
  );
});

test("8 Portal pricing, items and pickup creation remain delegated unchanged", () => {
  assert.match(migration, /service\.customer_orderable/);
  assert.match(migration, /category\.portal_visible/);
  assert.match(migration, /create_customer_portal_order_request_catalog_001/);
  assert.doesNotMatch(
    migration,
    /insert into public\.(order_items|order_status_history|pickups)/,
  );
});

test("9 tenant and location scope are server-derived and isolated", () => {
  const portalScope = migration.slice(
    0,
    migration.indexOf(
      "create or replace function public.calculate_daily_close_snapshot(",
    ),
  );
  assert.match(
    portalScope,
    /access\.user_id = auth\.uid\(\)[\s\S]*access\.organization_id = new\.organization_id[\s\S]*access\.customer_id = new\.customer_id/,
  );
  assert.match(
    portalScope,
    /daily_close\.organization_id = new\.organization_id[\s\S]*daily_close\.location_id = new\.location_id/,
  );
  assert.doesNotMatch(portalScope, /target_organization_id/);
});

test("10 existing null operational dates retain tenant-local created_at semantics", () => {
  assert.match(
    migration,
    /coalesce\(orders\.operational_business_date, \(orders\.created_at at time zone target_timezone\)::date\)/,
  );
  assert.doesNotMatch(migration, /update public\.orders|alter column operational_business_date set not null/i);
});

test("10a operational attribution cannot be rewritten after insertion", () => {
  assert.match(
    migration,
    /new\.operational_business_date is distinct from old\.operational_business_date[\s\S]*orders\.operational_business_date cannot be changed/,
  );
  assert.match(
    migration,
    /before update of operational_business_date on public\.orders/,
  );
  assert.match(
    migration,
    /revoke all on function public\.protect_order_operational_business_date\(\)\s*from public, anon, authenticated/,
  );
});

test("11 persisted Daily Close snapshots and financial facts remain immutable", () => {
  assert.doesNotMatch(
    migration,
    /\b(update|delete from|truncate)\s+public\.(daily_closes|payments|pos_sessions|pickups|deliveries|order_customer_handoffs)\b/i,
  );
  assert.doesNotMatch(migration, /alter table public\.daily_closes/i);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.(record_pos_payment|record_pos_refund|close_daily_close)/,
  );
});

test("12 close and Portal intake serialize at organization and location scope", () => {
  assert.equal(
    (migration.match(/pg_advisory_xact_lock_shared/g) ?? []).length,
    2,
  );
  assert.match(
    migration,
    /submission_business_date::text \|\| ':organization'/,
  );
  assert.match(
    migration,
    /submission_business_date::text \|\| ':' \|\| new\.location_id::text/,
  );
});
