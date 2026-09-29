import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20260929000300_delivery_staging_and_transit_001a.sql");
const queries = read("src/features/warehouse/server/queries.ts");
const fields = read("src/components/warehouse/ReadyWarehouseFields.tsx");
const ui = read("src/components/warehouse/WarehousePositionManagement.tsx");
const actions = read("src/features/warehouse/server/actions.ts");
const rpc = sql.slice(sql.indexOf("create function public.set_warehouse_default_delivery_staging"));

test("explicit false flag and unique tenant/location default; no backfill or creation", () => {
  assert.match(sql, /add column is_default_delivery_staging boolean not null default false/);
  assert.match(sql, /create unique index\s+\w+\s+on public\.warehouse_positions \(organization_id, location_id\)\s+where is_default_delivery_staging/);
  assert.doesNotMatch(sql.split("create function")[0], /\b(update|insert|delete)\b/i);
  assert.doesNotMatch(sql, /insert into|\b(code|name|description|position_type)\s*=/i);
});

test("DB enforces separate roles and active position and location", () => {
  assert.match(sql, /check \(not \(is_default_inbound and is_default_delivery_staging\)\)/);
  assert.match(sql, /if new\.is_default_delivery_staging then[\s\S]*not new\.is_active[\s\S]*location\.organization_id = new\.organization_id[\s\S]*location\.id = new\.location_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(sql, /before insert or update of is_default_delivery_staging, is_active/);
  assert.match(rpc, /if target_enabled and target_inbound then/);
  assert.match(rpc, /if not coalesce\(target_active, false\) then/);
});

test("configured position and its location cannot be deactivated", () => {
  assert.match(sql, /old\.is_default_delivery_staging and not new\.is_active and new\.is_default_delivery_staging/);
  assert.match(sql, /not new\.is_active or new\.deleted_at is not null[\s\S]*position\.organization_id = new\.organization_id[\s\S]*position\.location_id = new\.id[\s\S]*position\.is_default_delivery_staging/);
  assert.match(sql, /before update of is_active, deleted_at on public\.locations/);
  assert.match(actions, /warehouse_default_delivery_staging_deactivation_forbidden/);
});

test("RPC and action permit only Owner/Manager with server-derived tenant", () => {
  assert.match(rpc, /security definer\s+set search_path = public/);
  assert.match(rpc, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(rpc, /membership\.organization_id = org_id[\s\S]*membership\.profile_id = auth\.uid\(\)[\s\S]*membership\.is_active[\s\S]*membership\.role in \('owner', 'manager'\)/);
  assert.match(rpc, /revoke all on function public\.set_warehouse_default_delivery_staging\(uuid, boolean\) from public, anon, authenticated/);
  assert.match(rpc, /grant execute on function public\.set_warehouse_default_delivery_staging\(uuid, boolean\) to authenticated/);
  assert.match(actions, /export async function setWarehouseDefaultDeliveryStagingAction[\s\S]*requireOwnerOrManager\(locale\)[\s\S]*createSupabaseServerClient\(\)[\s\S]*rpc\("set_warehouse_default_delivery_staging"/);
});

test("replacement and clearing are serialized and tenant/location-scoped in one RPC", () => {
  assert.match(rpc, /from public\.locations location[\s\S]*location\.organization_id = org_id[\s\S]*for update/);
  assert.match(rpc, /from public\.warehouse_positions position[\s\S]*position\.location_id = target_location_id[\s\S]*for update/);
  assert.match(rpc, /if target_enabled then\s+update public\.warehouse_positions\s+set is_default_delivery_staging = false\s+where organization_id = org_id\s+and location_id = target_location_id\s+and is_default_delivery_staging\s+and id <> target_position_id/);
  assert.match(rpc, /set is_default_delivery_staging = target_enabled\s+where organization_id = org_id\s+and location_id = target_location_id\s+and id = target_position_id/);
});

test("settings exposes default badge, set/remove controls and excludes inbound", () => {
  assert.match(ui, /position\.isDefaultDeliveryStaging \? <span[^>]*>\{text\.defaultDeliveryStaging\}/);
  assert.match(ui, /position\.isDefaultDeliveryStaging \? text\.removeDefaultDeliveryStaging : text\.setDefaultDeliveryStaging/);
  assert.match(ui, /position\.isDefaultDeliveryStaging \? "false" : "true"/);
  assert.match(ui, /disabled=\{stagingPending \|\| !position\.isActive \|\| position\.isDefaultInbound\}/);
  assert.match(read("src/app/[locale]/app/(dashboard)/settings/warehouse/page.tsx"), /defaultDeliveryStagingAction=\{setWarehouseDefaultDeliveryStagingAction\.bind\(null, locale\)\}/);
});

test("all five locales have equivalent settings keys and staging labels", () => {
  const messages = ["it", "es", "en", "fr", "de"].map((locale) => JSON.parse(read(`src/i18n/${locale}/common.json`)).warehousePositions.labels);
  for (const labels of messages) {
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(messages[0]).sort());
    for (const key of ["defaultDeliveryStaging", "setDefaultDeliveryStaging", "removeDefaultDeliveryStaging", "stagingUpdated", "stagingActiveError", "stagingDeactivationError", "stagingInboundError"]) assert.ok(labels[key]?.trim());
  }
});

// Execute the actual reader with tenant-scoped in-memory query results.
async function placement({ scheduled = true, staging = true, active = true, inbound = false, location = true } = {}) {
  const positions = [
    { id: "shelf", is_active: true, is_default_inbound: false, is_default_delivery_staging: false },
    { id: "area", is_active: active, is_default_inbound: inbound, is_default_delivery_staging: staging },
    { id: "inbound", is_active: true, is_default_inbound: true, is_default_delivery_staging: false },
  ];
  const calls = [];
  const admin = { from(table) {
    const filters = {};
    calls.push({ table, filters });
    const result = () => {
      assert.equal(filters.organization_id, "tenant");
      const data = table === "orders" ? { location_id: "location" }
        : table === "locations" ? (location ? { id: "location" } : null)
          : table === "order_storage" ? null
            : table === "warehouse_positions" ? positions
              : scheduled ? { id: "delivery" } : null;
      if (table === "warehouse_positions") assert.equal(filters.location_id, "location");
      if (table === "deliveries") {
        assert.equal(filters.order_id, "order");
        assert.equal(filters.status, "scheduled");
      }
      return Promise.resolve({ data, error: null });
    };
    const query = { select() { return this; }, eq(k, v) { filters[k] = v; return this; }, is() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle: result, returns: result };
    return query;
  } };
  const exports = {};
  const membership = async () => ({ membership: { organization: { id: "tenant" } } });
  vm.runInNewContext(ts.transpileModule(queries, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    require: (id) => id === "server-only" ? {} : id.endsWith("/admin") ? { createSupabaseAdminClient: () => admin } : { requireMembership: membership },
  });
  return { result: await exports.getReadyWarehousePlacement("en", "order"), calls };
}

test("scheduled delivery suggests explicit active staging and retains normal shelves", async () => {
  const { result } = await placement();
  assert.equal(result.suggestedPositionId, "area");
  assert.deepEqual(Array.from(result.positions, (p) => p.id), ["shelf", "area"]);
});

test("no delivery, no default, inactive default, inbound or invalid location has no suggestion", async () => {
  for (const config of [{ scheduled: false }, { staging: false }, { active: false }, { inbound: true }, { location: false }]) {
    const { result } = await placement(config);
    assert.equal(result.suggestedPositionId, undefined);
  }
});

test("fields prefer valid suggestion, fall back to current placement and allow override", () => {
  const selection = fields.slice(fields.indexOf("  const existingPosition"), fields.indexOf("  const errorText"));
  const select = new Function("placement", ts.transpileModule(selection + "\nreturn selectedPosition;", {}).outputText);
  const base = { positions: [{ id: "shelf" }, { id: "area" }], assignment: { positionId: "shelf" } };
  assert.equal(select({ ...base, suggestedPositionId: "area" }), "area");
  assert.equal(select(base), "shelf");
  assert.equal(select({ ...base, suggestedPositionId: "invalid" }), "shelf");
  assert.equal(select({ ...base, assignment: { positionId: "inbound" } }), "");
  assert.match(fields, /defaultValue=\{selectedPosition\} name="finalPositionId" required/);
  assert.match(fields, /placement\.positions\.map/);
  assert.match(fields, /defaultValue=\{placement\.assignment\.packageCount\}/);
  assert.match(fields, /defaultValue=\{placement\.assignment\.storageMode\}/);
});

test("flag is mapped explicitly by both warehouse readers", () => {
  for (const file of ["queries.ts", "overview-queries.ts"]) {
    const source = read(`src/features/warehouse/server/${file}`);
    assert.match(source, /is_default_delivery_staging: boolean/);
    assert.match(source, /isDefaultDeliveryStaging: row\.is_default_delivery_staging/);
    assert.match(source, /is_active, is_default_inbound, is_default_delivery_staging/);
  }
});

test("no lifecycle, storage exit or automatic movement changes", () => {
  assert.doesNotMatch(sql, /public\.(orders|order_storage|warehouse_movements|deliveries|pickups|payments)\b/);
  assert.doesNotMatch(queries, /\.(insert|update|delete|rpc)\(/);
  assert.doesNotMatch(fields, /useEffect|\.rpc\(|onChange|onSubmit/);
  assert.doesNotMatch(sql, /create or replace function/);
  const finalRpc = read("supabase/migrations/20260927000500_warehouse_001d_b2_ready_final_placement.sql");
  assert.match(finalRpc, /position\.is_active[\s\S]*not position\.is_default_inbound/);
  assert.doesNotMatch(finalRpc, /is_default_delivery_staging/);
});
