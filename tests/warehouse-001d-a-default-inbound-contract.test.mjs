import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260927000100_warehouse_001d_a_default_inbound.sql";
const actionsPath = "src/features/warehouse/server/actions.ts";

// These contracts inspect the unapplied migration and narrow runtime wiring; staging UAT follows CTO approval.
test("1 explicit default is false for existing positions and has no inferred backfill", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /add column is_default_inbound boolean not null default false/);
  assert.doesNotMatch(sql, /update public\.warehouse_positions[\s\S]*code\s*=\s*'00'/);
  assert.doesNotMatch(sql, /insert into public\.order_storage/);
});

test("2 per-tenant, per-location partial index permits one default per location", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create unique index warehouse_positions_one_default_inbound_per_location\s+on public\.warehouse_positions \(organization_id, location_id\)\s+where is_default_inbound/);
  assert.doesNotMatch(sql, /unique index[^\n]*\(organization_id\)\s+where is_default_inbound/);
});

test("3 inactive position or location cannot become default", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /if new\.is_default_inbound then[\s\S]*not new\.is_active[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(sql, /create trigger warehouse_default_inbound_validate\s+before insert or update of is_default_inbound, is_active/);
});

test("4 default position cannot be deactivated and location deactivation is blocked", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /old\.is_default_inbound and not new\.is_active and new\.is_default_inbound[\s\S]*warehouse_default_inbound_deactivation_forbidden/);
  assert.match(sql, /create trigger warehouse_default_inbound_location_protect\s+before update of is_active, deleted_at on public\.locations/);
});

test("5 replacement and clearing share one transaction and serialize by location", async () => {
  const sql = await source(migrationPath);
  const rpc = sql.slice(sql.indexOf("create function public.set_warehouse_default_inbound"));
  assert.match(rpc, /from public\.locations location[\s\S]*for update/);
  assert.match(rpc, /if target_enabled then[\s\S]*set is_default_inbound = false[\s\S]*location_id = target_location_id[\s\S]*id <> target_position_id/);
  assert.match(rpc, /set is_default_inbound = target_enabled[\s\S]*id = target_position_id/);
});

test("6 owner/manager only, tenant derived server-side, staff denied in RPC", async () => {
  const sql = await source(migrationPath);
  const actions = await source(actionsPath);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /membership\.role in \('owner', 'manager'\)/);
  assert.match(sql, /warehouse_default_inbound_not_authorized/);
  assert.match(actions, /export async function setWarehouseDefaultInboundAction[\s\S]*requireOwnerOrManager\(locale\)/);
  assert.match(sql, /grant execute on function public\.set_warehouse_default_inbound\(uuid, boolean\) to authenticated/);
});

test("7 settings exposes explicit per-position selection, clearing, and deactivation error", async () => {
  const [component, actions, page] = await Promise.all([
    source("src/components/warehouse/WarehousePositionManagement.tsx"),
    source(actionsPath),
    source("src/app/[locale]/app/(dashboard)/settings/warehouse/page.tsx"),
  ]);
  assert.match(component, /position\.isDefaultInbound \? text\.removeDefaultInbound : text\.setDefaultInbound/);
  assert.match(component, /position\.isDefaultInbound \? "false" : "true"/);
  assert.match(component, /state\.formError === "defaultDeactivation"/);
  assert.match(actions, /warehouse_default_inbound_deactivation_forbidden/);
  assert.match(page, /await requireOwnerOrManager\(locale\)/);
  assert.match(page, /defaultInboundAction=\{setWarehouseDefaultInboundAction\.bind\(null, locale\)\}/);
});

test("8 overview reads and badges default without changing summary", async () => {
  const [query, page, overview] = await Promise.all([
    source("src/features/warehouse/server/overview-queries.ts"),
    source("src/app/[locale]/app/(dashboard)/warehouse/page.tsx"),
    source("src/features/warehouse/overview.ts"),
  ]);
  assert.match(query, /\.select\("id, location_id, code, name, description, position_type, is_active, is_default_inbound"\)/);
  assert.match(query, /isDefaultInbound: row\.is_default_inbound/);
  assert.match(page, /position\.isDefaultInbound[\s\S]*t\("defaultInbound"\)/);
  assert.doesNotMatch(overview, /isDefaultInbound|is_default_inbound/);
});

test("9 five locale labels have matching keys", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  const messages = await Promise.all(locales.map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`))));
  const keys = (value) => Object.keys(value.warehousePositions.labels).sort();
  for (const message of messages) {
    assert.deepEqual(keys(message), keys(messages[0]));
    assert.equal(typeof message.warehouseOverview.defaultInbound, "string");
    assert.equal(typeof message.warehousePositions.labels.defaultDeactivationError, "string");
  }
});

test("10 migration and actions leave order storage, lifecycle and fulfillment unchanged", async () => {
  const [sql, actions] = await Promise.all([source(migrationPath), source(actionsPath)]);
  assert.doesNotMatch(sql, /\b(create|insert|update|delete)\s+(into\s+|from\s+)?public\.(orders|order_storage|pickups|deliveries|payments)\b/i);
  assert.doesNotMatch(actions, /\.from\("order_storage"\)|transition_order_status|transition_pickup_status/);
});
