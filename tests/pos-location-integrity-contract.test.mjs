import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260919000100_pos_location_integrity_001.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one active location is selected automatically while multiple locations require a choice", async () => {
  const [workspace, queries] = await Promise.all([
    source("src/components/pos/PosWorkspace.tsx"),
    source("src/features/pos/server/queries.ts"),
  ]);

  assert.match(workspace, /defaultValue=\{locations\.length === 1 \? locations\[0\]\.id : ""\}/);
  assert.match(workspace, /<option disabled value="">\{text\.session\.chooseLocation\}<\/option>/);
  assert.match(workspace, /name="locationId" required/);
  assert.doesNotMatch(workspace, /<option value="">\{text\.common\.noLocation\}<\/option>/);
  assert.match(queries, /listPosLocations[\s\S]*\.eq\("organization_id", membership\.organization\.id\)\.eq\("is_active", true\)\.is\("deleted_at", null\)/);
});

test("zero active locations blocks opening and explains the required setup", async () => {
  const workspace = await source("src/components/pos/PosWorkspace.tsx");

  assert.match(workspace, /const hasLocations = locations\.length > 0/);
  assert.match(workspace, /role="alert">\{text\.session\.noLocations\}/);
  assert.match(workspace, /disabled=\{pending \|\| !hasLocations\}/);
  assert.match(workspace, /disabled=\{!hasLocations\}[^>]*name="locationId"/);
});

test("server parsing rejects a missing or malformed location before the RPC", async () => {
  const validation = await source("src/features/pos/validation.ts");

  assert.match(validation, /if \(!locationId \|\| !UUID\.test\(locationId\)\)/);
  assert.match(validation, /fieldErrors\.locationId = locationId \? "invalid" : "required"/);
  assert.doesNotMatch(validation, /locationId: locationId \|\| null/);
});

test("RPC rejects null, inactive, deleted and cross-tenant locations", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /create or replace function public\.open_pos_session/);
  assert.match(sql, /target_location_id is null or not exists/);
  assert.match(sql, /location\.id = target_location_id/);
  assert.match(sql, /location\.organization_id = org_id/);
  assert.match(sql, /location\.is_active/);
  assert.match(sql, /location\.deleted_at is null/);
  assert.match(sql, /pos_location_invalid/);
});

test("valid active tenant location remains the persisted canonical location", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /perform public\.require_pos_access\(org_id\)/);
  assert.match(sql, /insert into public\.pos_sessions \(organization_id, location_id, opened_by, opening_cash, notes\)/);
  assert.match(sql, /values \(org_id, target_location_id, auth\.uid\(\)/);
  assert.match(sql, /grant execute on function public\.open_pos_session\(uuid, numeric, text\) to authenticated/);
  assert.doesNotMatch(sql, /service_role|grant execute[\s\S]*to anon/i);
});

test("migration preserves close, reconciliation, accounting and historical rows", async () => {
  const [migration, foundation] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql"),
  ]);

  assert.doesNotMatch(migration, /create or replace function public\.(close_pos_session|get_pos_session_summary|record_pos_payment|record_pos_refund)/);
  assert.doesNotMatch(migration, /\b(update|delete from|truncate|drop table|alter table)\b/i);
  assert.match(foundation, /close_pos_session[\s\S]*expected_cash = calculated_expected[\s\S]*counted_cash = round\(target_counted_cash, 2\)/);
  assert.match(foundation, /get_pos_session_summary[\s\S]*payment\.status = 'confirmed'[\s\S]*payment\.status = 'refunded'/);
});

test("all five locales include location choice and zero-location guidance", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.pos.session.chooseLocation, "string", `${locale}.pos.session.chooseLocation`);
    assert.equal(typeof messages.pos.session.noLocations, "string", `${locale}.pos.session.noLocations`);
    assert.ok(messages.pos.session.chooseLocation.trim());
    assert.ok(messages.pos.session.noLocations.trim());
  }
});
