import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const migrationName = "20260920000300_warehouse_001a_data_foundation.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = `supabase/migrations/${migrationName}`;

test("1 warehouse positions are tenant and active-location scoped", async () => {
  const sql = await source(migrationPath);
  const validator = sql.slice(
    sql.indexOf("create function public.validate_warehouse_position"),
    sql.indexOf("create trigger warehouse_positions_validate"),
  );
  assert.match(sql, /create type public\.warehouse_position_type as enum \([\s\S]*'shelf',[\s\S]*'rack',[\s\S]*'hanger',[\s\S]*'cabinet',[\s\S]*'other'[\s\S]*\)/);
  assert.match(sql, /create table public\.warehouse_positions/);
  for (const field of ["id", "organization_id", "location_id", "code", "name", "description", "position_type", "is_active", "created_at", "updated_at"]) {
    assert.match(sql, new RegExp(`\\n  ${field} `));
  }
  assert.match(sql, /warehouse_positions_location_same_org foreign key \(organization_id, location_id\)[\s\S]*references public\.locations \(organization_id, id\) on delete restrict/);
  assert.match(validator, /location\.organization_id = new\.organization_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(validator, /warehouse_position_location_invalid/);
  assert.match(validator, /warehouse_position_scope_immutable/);
});

test("2 position codes remain unique within a location including inactive positions", async () => {
  const sql = await source(migrationPath);
  const uniqueIndex = sql.slice(
    sql.indexOf("create unique index warehouse_positions_location_code_unique"),
    sql.indexOf("create index warehouse_positions_active_location_idx"),
  );
  assert.match(uniqueIndex, /\(location_id, lower\(btrim\(code\)\)\)/);
  assert.doesNotMatch(uniqueIndex, /where is_active/);
  assert.match(sql, /warehouse_positions_code_valid check \(length\(btrim\(code\)\) between 1 and 64\)/);
  assert.match(sql, /warehouse_position_delete_forbidden/);
  assert.match(sql, /before insert or update or delete on public\.warehouse_positions/);
});

test("3 order storage is one current assignment per order with valid package count", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create type public\.order_storage_mode as enum \([\s\S]*'folded',[\s\S]*'hanging',[\s\S]*'mixed',[\s\S]*'other'[\s\S]*\)/);
  assert.match(sql, /create table public\.order_storage/);
  for (const field of ["id", "organization_id", "order_id", "location_id", "warehouse_position_id", "package_count", "storage_mode", "entered_at", "created_at", "updated_at"]) {
    assert.match(sql, new RegExp(`\\n  ${field} `));
  }
  assert.match(sql, /order_storage_one_current_per_order unique \(organization_id, order_id\)/);
  assert.match(sql, /order_storage_package_count_positive check \(package_count >= 1\)/);
});

test("4 order location and position relationships cannot cross tenant or location", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /order_storage_order_same_org foreign key \(organization_id, order_id\)[\s\S]*references public\.orders \(organization_id, id\) on delete restrict/);
  assert.match(sql, /order_storage_location_same_org foreign key \(organization_id, location_id\)[\s\S]*references public\.locations \(organization_id, id\) on delete restrict/);
  assert.match(sql, /order_storage_position_same_location foreign key \([\s\S]*organization_id,[\s\S]*location_id,[\s\S]*warehouse_position_id[\s\S]*references public\.warehouse_positions \(organization_id, location_id, id\) on delete restrict/);
});

test("5 inactive positions and locations are rejected only when assigning or reassigning", async () => {
  const sql = await source(migrationPath);
  const validator = sql.slice(sql.indexOf("create function public.validate_order_storage"), sql.indexOf("create trigger order_storage_validate"));
  assert.match(validator, /tg_op = 'INSERT'[\s\S]*new\.warehouse_position_id is distinct from old\.warehouse_position_id/);
  assert.match(validator, /position\.is_active[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(validator, /order_storage_position_invalid/);
});

test("6 warehouse foundation does not mutate or duplicate order lifecycle", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /update public\.orders|insert into public\.(pickups|deliveries|order_customer_handoffs|payments)|production_status\s*=/i);
  assert.doesNotMatch(sql, /awaiting_pickup|warehouse_status|storage_status/);
  assert.match(sql, /physical storage foundation only/);
});

test("7 RLS and server queries preserve server-derived tenant isolation", async () => {
  const [sql, queries] = await Promise.all([
    source(migrationPath),
    source("src/features/warehouse/server/queries.ts"),
  ]);
  assert.match(sql, /alter table public\.warehouse_positions enable row level security/);
  assert.match(sql, /alter table public\.order_storage enable row level security/);
  assert.ok((sql.match(/organization_id = public\.app_current_organization_id\(\)/g) ?? []).length >= 2);
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
  assert.match(queries, /requireMembership\(locale\)/);
  assert.ok((queries.match(/\.eq\("organization_id", membership\.organization\.id\)/g) ?? []).length >= 2);
});

test("8 migration is one additive file with no historical rewrite or destructive DDL", async () => {
  const [sql, migrationFiles] = await Promise.all([
    source(migrationPath),
    readdir(new URL("../supabase/migrations", import.meta.url)),
  ]);
  assert.equal(migrationFiles.filter((name) => name.includes("warehouse_001a")).length, 1);
  assert.doesNotMatch(sql, /\b(drop|truncate|delete from|update public\.)\b/i);
  assert.doesNotMatch(sql, /alter table public\.orders|alter type public\.production_status/);
});
