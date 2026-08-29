import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260829000200_shop_terminal_001_counter_experience.sql";

test("1 terminal has a dedicated additive entitlement", async () => {
  const [sql, catalog] = await Promise.all([source(migrationPath), source("src/features/entitlements/feature-catalog.ts")]);
  assert.match(sql, /values \('shop_terminal', 'commerce'/);
  assert.match(catalog, /shopTerminal: "shop_terminal"/);
  assert.doesNotMatch(sql, /drop table|truncate|delete from public\.(orders|payments)/i);
});

test("2 route is gated server-side by terminal and POS access", async () => {
  const [page, access] = await Promise.all([source("src/app/[locale]/app/(dashboard)/shop/page.tsx"), source("src/features/shop-terminal/server/access.ts")]);
  assert.match(page, /requireShopTerminalAccess/);
  assert.match(access, /requireEntitlement\(locale, FEATURES\.shopTerminal\)/);
  assert.match(access, /requirePosAccess\(locale\)/);
});

test("3 Owner and Manager inherit POS capability", async () => {
  const capabilities = await source("src/lib/auth/capabilities.ts");
  assert.match(capabilities, /role === "owner" \|\| role === "manager"/);
});

test("4 Staff requires explicit POS capability", async () => {
  const capabilities = await source("src/lib/auth/capabilities.ts");
  assert.match(capabilities, /DEFAULT_STAFF_OPERATIONAL_CAPABILITIES[\s\S]*capability !== "pos"/);
});

test("5 database gate reuses authoritative POS capability", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /perform public\.require_pos_access\(target_organization_id\)/);
});

test("6 tenant customer search is organization scoped and active only", async () => {
  const queries = await source("src/features/shop-terminal/server/queries.ts");
  assert.match(queries, /from\("customers"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)[\s\S]*eq\("is_active", true\)/);
});

test("7 quick customer creation uses canonical customers with tenant identity", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  assert.match(actions, /from\("customers"\)\.insert/);
  assert.match(actions, /organization_id: membership\.organization\.id/);
  assert.doesNotMatch(actions, /shop_customers/);
});

test("8 inactive or cross-tenant customer is rejected in SQL", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /customer\.organization_id = org_id[\s\S]*customer\.is_active/);
});

test("9 current order architecture keeps customer required", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /public\.create_order\([\s\S]*target_customer_id/);
  assert.doesNotMatch(sql, /anonymous|walk.in/i);
});

test("10 catalog uses active internal tenant services", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /from public\.services service[\s\S]*service\.organization_id = org_id[\s\S]*service\.is_active/);
  assert.doesNotMatch(sql, /portal_visible|customer_orderable/);
});

test("11 catalog has category and search UX", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(ui, /setCategory/);
  assert.match(ui, /searchServices/);
});

test("12 service taps quick-add and safely increment", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(ui, /function addService/);
  assert.match(ui, /line\.quantity \+ increment/);
});

test("13 discrete quantities are integer constrained", async () => {
  const [ui, orderSql] = await Promise.all([source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"), source("supabase/migrations/20260728000200_app_006_orders_workflow.sql")]);
  assert.match(ui, /isDiscreteServiceUnit[\s\S]*Math\.trunc/);
  assert.match(orderSql, /piece quantity must be integer/);
});

test("14 continuous quantities preserve existing decimal semantics", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(ui, /step=\{isDiscreteServiceUnit\(line\.service\.unitType\) \? 1 : 0\.1\}/);
});

test("15 effective pricing resolver provides segment override and base fallback", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /public\.resolve_effective_service_price/);
  assert.match(sql, /price\.pricing_source, price\.segment_name/);
});

test("16 client never submits trusted price or total", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const payload = ui.slice(ui.indexOf("const payload ="), ui.indexOf("if (payloadRef.current)"));
  assert.doesNotMatch(payload, /unitPrice|subtotal:|total:/);
});

test("17 canonical price snapshot trigger remains authoritative", async () => {
  const pricing = await source("supabase/migrations/20260827000100_pricing_segments_001_segment_price_overrides.sql");
  assert.match(pricing, /create trigger order_items_resolve_effective_price/);
  assert.match(pricing, /new\.unit_price := effective_price/);
});

test("18 discount stays monetary and bounded", async () => {
  const [messages, sql] = await Promise.all([source("src/i18n/it/common.json"), source(migrationPath)]);
  assert.match(messages, /"discount": "Sconto \(€\)"/);
  assert.match(sql, /public\.update_order_discount\(created_order\.id, round\(target_discount_amount, 2\)\)/);
  assert.doesNotMatch(sql, /discount_percent/);
});

test("19 Staff cannot escalate into financial discount authority", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /member_role = 'staff'[\s\S]*shop_terminal_staff_discount_denied/);
});

test("20 submission creates through canonical order and item RPCs", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /public\.create_order\(/);
  assert.match(sql, /public\.save_order_item\(/);
});

test("21 duplicate submit is transactionally idempotent", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /primary key \(organization_id, idempotency_key\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /request_fingerprint <> fingerprint/);
});

test("22 pay later writes no fake payment", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /jsonb_array_length\(coalesce\(target_payments, '\[\]'::jsonb\)\) > 0/);
  assert.match(sql, /paid_total/);
});

test("23 pay now reuses canonical cash and manual-card POS ledger", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /public\.record_pos_payment\(/);
  assert.match(sql, /then 'manual'/);
  assert.match(sql, /then 'recorded_manual'/);
});

test("24 pay now requires an active till and exact recomputed total", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /target_pos_session_id is null or payment_total <> target_order\.total/);
});

test("25 online payment is not exposed by the terminal", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.doesNotMatch(ui, /online|provider/i);
});

test("26 success reports exact paid and outstanding values", async () => {
  const [sql, ui] = await Promise.all([source(migrationPath), source("src/components/shop-terminal/ShopTerminalWorkspace.tsx")]);
  assert.match(sql, /greatest\(target_order\.total - paid_total, 0\)/);
  assert.match(ui, /result\.paid/);
  assert.match(ui, /result\.outstanding/);
});

test("27 navigation presents one counter entry and preserves POS fallback", async () => {
  const navigation = await source("src/components/dashboard/AppNavigation.tsx");
  assert.match(navigation, /shopNavigationItem \? \[shopNavigationItem\] : posNavigationItem/);
  assert.match(navigation, /FEATURES\.shopTerminal/);
  assert.doesNotMatch(navigation, /\.\.\.counterNavigationItems,[\s\S]{0,120}\.\.\.counterNavigationItems/);
});

test("28 five locales expose complete terminal vocabulary", async () => {
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.auth.dashboard.shop, "string");
    assert.equal(Object.keys(messages.shopTerminal.labels).length, 68);
    assert.equal(Object.keys(messages.barcode.terminal).length, 6);
  }
});
