import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveShopCategoryLabel } from "../src/features/shop-terminal/category-label.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260829000200_shop_terminal_001_counter_experience.sql";
const operationalMigrationPath = "supabase/migrations/20260907000200_terminal_operational_checkout_001.sql";

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
  assert.match(ui, /aria-pressed=\{category === item\.key\}/);
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
    assert.equal(Object.keys(messages.shopTerminal.labels).length, 85);
    assert.equal(typeof messages.shopTerminal.labels.segmentCatalog, "string");
    assert.equal(Object.keys(messages.barcode.terminal).length, 6);
  }
});

test("29 compact visual cards use canonical images and the shared neutral fallback", async () => {
  const [ui, media] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/components/portal/PortalMedia.tsx"),
  ]);
  assert.match(ui, /data-terminal-service-grid/);
  assert.match(ui, /src=\{service\.imageUrl\}/);
  assert.match(ui, /alt=\{service\.imageUrl \? service\.name : ""\}/);
  assert.match(ui, /fit="contain"/);
  assert.match(ui, /h-28 w-full shrink-0 border-b border-border sm:h-32/);
  assert.match(media, /src && failedSrc !== src/);
  assert.match(media, /fit = "cover"/);
  assert.match(media, /fit === "contain" \? "object-contain" : "object-cover"/);
  assert.match(media, /absolute inset-0 flex items-center justify-center/);
  assert.doesNotMatch(ui, /\ud83d\udc55|\ud83d\udc56|\ud83e\udde5|\ud83d\udc57|\ud83d\udc5f/);
});

test("30 customer modes, cart controls and scanner stay compact and accessible", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(ui, /aria-pressed=\{customerMode === "regular"\}/);
  assert.match(ui, /aria-pressed=\{customerMode === "walk_in"\}/);
  assert.match(ui, /function clearCustomer/);
  assert.match(ui, /function addService/);
  assert.match(ui, /function updateQuantity/);
  assert.match(ui, /current\.filter\(\(item\) => item\.service\.id !== serviceId\)/);
  assert.match(ui, /onSubmit=\{resolveCode\}/);
  assert.match(ui, /placeholder=\{text\.searchServices\}/);
});

test("30a customer picker stays reachable without clearing the active order when opened", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const openPicker = ui.slice(ui.indexOf("function openCustomerPicker"), ui.indexOf("function clearCustomer"));

  assert.match(ui, /const \[isCustomerPickerOpen, setIsCustomerPickerOpen\] = useState\(true\)/);
  assert.match(ui, /onClick=\{openCustomerPicker\}[\s\S]*?\{text\.changeCustomer\}/);
  assert.match(openPicker, /setCustomerMode\(null\)/);
  assert.match(openPicker, /setIsCustomerPickerOpen\(true\)/);
  assert.doesNotMatch(openPicker, /setCustomerId|setCart|setServices|catalogRequestRef/);
  assert.match(ui, /!selectedCustomer \|\| isCustomerPickerOpen/);
  assert.match(ui, /!customerQuery \? <span[\s\S]*?\{text\.recentCustomers\}<\/span>/);
  assert.match(ui, /placeholder=\{text\.customerSearch\}/);
});

test("30b customer creation modes return to recents and successful creation closes the picker", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");

  assert.match(ui, /onClick=\{\(\) => setCustomerMode\(null\)\} type="button">← \{text\.recentCustomers\}/);
  assert.match(ui, /setCustomers\(\(current\) => \[result\.customer!/);
  assert.match(ui, /selectCustomer\(result\.customer\.id\)/);
  assert.match(ui, /setIsCustomerPickerOpen\(false\)/);
});

test("30c switching customers saves independent drafts while same-customer picker selection preserves work", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const select = ui.slice(ui.indexOf("function selectCustomer"), ui.indexOf("function openCustomerPicker"));
  const saveDraft = ui.slice(ui.indexOf("function saveCurrentCustomerDraft"), ui.indexOf("function restoreCheckoutDraft"));

  assert.match(select, /if \(nextCustomerId === customerId\)[\s\S]*?return;/);
  assert.match(select, /saveCurrentCustomerDraft\(\)/);
  assert.match(select, /customerDraftsRef\.current\.get\(nextCustomerId\)/);
  assert.match(saveDraft, /customerDraftsRef\.current\.set\(customerId/);
  assert.match(saveDraft, /items: cart\.map/);
  assert.match(saveDraft, /discount,/);
  assert.match(saveDraft, /customerNotes,[\s\S]*dueAt,[\s\S]*internalNotes,/);
  assert.match(saveDraft, /showSplitPayment,[\s\S]*splitCard,[\s\S]*splitCash,/);
  assert.match(select, /restoreCheckoutDraft\(nextDraft\)/);
  assert.match(select, /setCart\(reconcileDraftCart\(nextDraft, catalog\.services\)\)/);
});

test("30d terminal drafts persist across remounts in tenant and location scoped session storage", async () => {
  const [ui, page] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
  ]);
  const load = ui.slice(ui.indexOf("function loadCustomerDrafts"), ui.indexOf("function persistCustomerDrafts"));
  const persist = ui.slice(ui.indexOf("function persistCustomerDrafts"), ui.indexOf("export function ShopTerminalWorkspace"));

  assert.match(page, /organizationId=\{access\.membership\.organization\.id\}/);
  assert.match(ui, /`\$\{terminalDraftStoragePrefix\}:\$\{organizationId\}:\$\{session\?\.locationId \?\? "no-location"\}`/);
  assert.match(load, /window\.sessionStorage\.getItem\(storageKey\)/);
  assert.match(persist, /window\.sessionStorage\.setItem\(storageKey, JSON\.stringify\(Array\.from\(drafts\.entries\(\)\)\)\)/);
  assert.match(ui, /customerDraftsRef\.current = loadCustomerDrafts\(draftStorageKey\)/);
  assert.match(ui, /hydratedDraftStorageKeyRef\.current = draftStorageKey/);
});

test("30e active changes persist without replacing a draft during temporary catalog loading", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const activePersistence = ui.slice(
    ui.indexOf("if (!customerId || catalogCustomerRef.current !== customerId || hydratedDraftStorageKeyRef.current !== draftStorageKey) return;"),
    ui.indexOf("useEffect(() => {\n    const submittedCustomerId"),
  );
  const select = ui.slice(ui.indexOf("function selectCustomer"), ui.indexOf("function openCustomerPicker"));

  assert.match(activePersistence, /customerDraftsRef\.current\.set\(customerId/);
  assert.match(activePersistence, /items: cart\.map/);
  assert.match(activePersistence, /persistCustomerDrafts\(draftStorageKey, customerDraftsRef\.current\)/);
  assert.match(activePersistence, /\[cardReference, cart, customerId, customerNotes, delivery, discount, draftStorageKey, dueAt, internalNotes, productionAssigneeId, showSplitPayment, splitCard, splitCash\]/);
  assert.match(select, /catalogCustomerRef\.current = null[\s\S]*setCart\(\[\]\)/);
});

test("30f customer catalog reload remains stale-safe and restored carts use only fresh eligible services", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const select = ui.slice(ui.indexOf("function selectCustomer"), ui.indexOf("function openCustomerPicker"));
  const reconcile = ui.slice(ui.indexOf("function reconcileDraftCart"), ui.indexOf("function selectCustomer"));

  assert.match(select, /catalogRequestRef\.current = requestId/);
  assert.match(select, /setCustomerId\(nextCustomerId\)/);
  assert.match(select, /setServices\(\[\]\)/);
  assert.match(select, /setSegmentName\(null\)/);
  assert.match(select, /setCart\(\[\]\)/);
  assert.match(select, /setCategory\("all"\)/);
  assert.match(select, /setServiceQuery\(""\)/);
  assert.match(select, /actions\.loadServices\(nextCustomerId, session\?\.locationId \?\? null\)/);
  assert.match(select, /if \(catalogRequestRef\.current !== requestId\) return/);
  assert.match(reconcile, /freshServiceById = new Map\(freshServices\.map/);
  assert.match(reconcile, /freshServiceById\.get\(item\.serviceId\)/);
  assert.match(reconcile, /service \? \[\{ quantity: item\.quantity, service \}\] : \[\]/);
  assert.doesNotMatch(reconcile, /item\.service\b/);
});

test("30g successful A order removes only A and persists the remaining B drafts", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const successEffect = ui.slice(ui.indexOf("const submittedCustomerId = submitState.result?.customerId"), ui.indexOf("useEffect(() => {\n    if (!isMobileCartOpen)"));
  const reset = ui.slice(ui.indexOf("function resetOrder"), ui.indexOf("function resolveCode"));

  assert.match(successEffect, /customerDraftsRef\.current\.delete\(submittedCustomerId\)/);
  assert.match(successEffect, /persistCustomerDrafts\(draftStorageKey, customerDraftsRef\.current\)/);
  assert.doesNotMatch(successEffect, /customerDraftsRef\.current\.clear/);
  assert.match(reset, /customerDraftsRef\.current\.delete\(submitState\.result\.customerId\)/);
  assert.match(reset, /persistCustomerDrafts\(draftStorageKey, customerDraftsRef\.current\)/);
  assert.match(reset, /clearCustomer\(\{ preserveDraft: true \}\)/);
  assert.doesNotMatch(reset, /customerDraftsRef\.current\.clear/);
});

test("30h session persistence contains draft scalars and service ids, never services or prices", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const draftType = ui.slice(ui.indexOf("type ShopTerminalDraft"), ui.indexOf("export type ShopTerminalText"));
  const drafts = ui.slice(ui.indexOf("function saveCurrentCustomerDraft"), ui.indexOf("function openCustomerPicker"));

  assert.match(ui, /useRef\(new Map<string, ShopTerminalDraft>\(\)\)/);
  assert.match(draftType, /serviceId: string/);
  assert.match(draftType, /quantity: number/);
  assert.match(draftType, /discount: number/);
  assert.match(draftType, /dueAt: string/);
  assert.match(draftType, /customerNotes: string/);
  assert.match(draftType, /internalNotes: string/);
  assert.match(draftType, /cardReference: string/);
  assert.match(draftType, /splitCash: number/);
  assert.match(draftType, /splitCard: number/);
  assert.match(draftType, /showSplitPayment: boolean/);
  assert.match(draftType, /productionAssigneeId: string/);
  assert.match(draftType, /delivery: DeliveryDraft/);
  assert.doesNotMatch(draftType, /ShopService|amount|currency|price|total|orderId|paymentId/);
  assert.doesNotMatch(drafts, /actions\.submit|create_order|order_items|payments|invoice|supabase/i);
});

test("31 responsive POS structure keeps a dense catalog and persistent one-third cart", async () => {
  const [ui, queries] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/features/shop-terminal/server/queries.ts"),
  ]);
  assert.match(ui, /grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-4/);
  assert.match(ui, /lg:grid-cols-\[minmax\(0,2\.1fr\)_minmax\(20rem,1fr\)\]/);
  assert.match(ui, /lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto/);
  assert.match(queries, /rpc\("list_shop_terminal_services"/);
  assert.match(queries, /eq\("organization_id", membership\.organization\.id\)/);
  assert.match(queries, /imageUrl: serviceImageUrl/);
});

test("32 known Terminal families resolve through every active route locale", async () => {
  const expectations = {
    it: ["Lavaggio al kg", "Stireria", "Biancheria da letto", "Casa e tessili", "Autoservizio", "Servizi professionali", "Servizi speciali"],
    es: ["Lavado por kilo", "Planchado", "Ropa de cama", "Hogar y textiles", "Autoservicio", "Servicios profesionales", "Servicios especiales"],
    en: ["Laundry by weight", "Ironing", "Bed linen", "Home textiles", "Self-service", "Professional services", "Special services"],
    fr: ["Lavage au kilo", "Repassage", "Linge de lit", "Maison et textiles", "Libre-service", "Services professionnels", "Services spéciaux"],
    de: ["Wäsche nach Gewicht", "Bügelservice", "Bettwäsche", "Heimtextilien", "Selbstbedienung", "Gewerbliche Leistungen", "Spezialleistungen"],
  };
  const keys = ["laundry_by_weight", "ironing", "bed_linen", "home_textiles", "self_service", "professional_services", "special_services"];
  for (const [locale, expected] of Object.entries(expectations)) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.deepEqual(keys.map((key) => resolveShopCategoryLabel(key, key, messages.catalog.categories)), expected);
    assert.ok(expected.every((label) => !label.includes("_")));
  }
});

test("33 custom and missing-label families keep canonical titles with a safe final fallback", () => {
  assert.equal(resolveShopCategoryLabel("custom_family", "Tintoreria", {}), "Tintoreria");
  assert.equal(resolveShopCategoryLabel("custom_family", null, {}), "Custom family");
  assert.equal(resolveShopCategoryLabel("custom_family", "custom_family", {}), "Custom family");
});

test("34 Terminal category filtering and order retain stable keys", async () => {
  const [ui, queries, page] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/features/shop-terminal/server/queries.ts"),
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
  ]);
  assert.match(ui, /service\.categoryKey === category/);
  assert.match(ui, /Array\.from\(options, \(\[key, label\]\) => \(\{ key, label \}\)\)/);
  assert.match(queries, /categoryKey: service\.category/);
  assert.match(page, /catalogT\.raw\("categories"\)/);
});

test("35 compact cards preserve normalized previews and Terminal behavior", async () => {
  const [ui, queries] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/features/shop-terminal/server/queries.ts"),
  ]);
  assert.match(ui, /hidden h-full min-w-0 flex-col[\s\S]*md:flex/);
  assert.match(ui, /h-28 w-full shrink-0 border-b border-border sm:h-32/);
  assert.match(ui, /flex w-full flex-1 flex-col px-2\.5 py-1\.5/);
  assert.match(ui, /line-clamp-2 min-h-8 text-sm leading-4/);
  assert.match(ui, /mt-0\.5 block truncate text-\[0\.65rem\]/);
  assert.match(ui, /mt-auto block pt-1 text-base font-black text-primary sm:text-lg/);
  assert.match(ui, /flex h-8 w-8 shrink-0/);
  assert.match(ui, /onClick=\{\(\) => addService\(service\)\}/);
  assert.match(ui, /service\.categoryKey === category/);
  assert.match(ui, /grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-4/);
  assert.match(queries, /imageUrl: serviceImageUrl/);
});

test("36 production assignment options require active staff production capability in deterministic order", async () => {
  const queries = await source("src/features/logistics/server/queries.ts");
  const assignable = queries.slice(queries.indexOf("export async function listAssignableStaff"), queries.indexOf("export async function isAssignableStaffForCapability"));

  assert.match(assignable, /eq\("organization_id", membership\.organization\.id\)/);
  assert.match(assignable, /eq\("is_active", true\)/);
  assert.match(assignable, /eq\("role", "staff"\)/);
  assert.match(assignable, /order\("profile_id", \{ ascending: true \}\)/);
  assert.match(assignable, /all: staff[\s\S]*hasOperationalCapability\(\{ capabilities, role \}, "production"\)[\s\S]*map\(\(\{ option \}\) => option\)/);
});

test("37 single-location Terminal submit atomically assigns the first production-eligible staff member", async () => {
  const [sql, ui, queries] = await Promise.all([
    source(operationalMigrationPath),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/features/shop-terminal/server/queries.ts"),
  ]);

  assert.match(sql, /create function public\.submit_shop_terminal_order\(/);
  assert.match(sql, /select count\(\*\) into active_location_count[\s\S]*from public\.locations location[\s\S]*location\.organization_id = org_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
  assert.match(sql, /elsif active_location_count = 1 then[\s\S]*membership\.organization_id = org_id[\s\S]*membership\.is_active[\s\S]*membership\.role = 'staff'[\s\S]*'production' = any\(membership\.operational_capabilities::text\[\]\)[\s\S]*order by membership\.profile_id asc[\s\S]*limit 1/);
  assert.match(sql, /update public\.orders orders[\s\S]*assigned_to = production_assignee/);
  assert.match(ui, /productionAssignments\[0\]\?\.id \?\? ""/);
  assert.match(ui, /setProductionAssigneeId\(event\.target\.value\)/);
  assert.match(queries, /productionAssignments: !locations\.error && locations\.count === 1 \? assignments\.all : \[\]/);
});

test("38 no eligible staff and multi-location tenants safely retain an unassigned order", async () => {
  const sql = await source(operationalMigrationPath);
  const assignment = sql.slice(sql.indexOf("select count(*) into active_location_count"), sql.indexOf("select created.id, created.order_number"));

  assert.match(sql, /production_assignee uuid;/);
  assert.match(assignment, /elsif active_location_count = 1 then/);
  assert.match(assignment, /active_location_count <> 1 or not exists[\s\S]*shop_terminal_production_assignee_invalid/);
});

test("39 missing pickup and delivery render as not requested without creating logistics rows", async () => {
  const [page, sql, logisticsActions] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source(operationalMigrationPath),
    source("src/features/logistics/server/actions.ts"),
  ]);

  assert.match(page, /logistics\.pickup \? logisticsStatusLabels\[logistics\.pickup\.status\] : logisticsStatusLabels\.not_required/);
  assert.match(page, /logistics\.delivery \? logisticsStatusLabels\[logistics\.delivery\.status\] : logisticsStatusLabels\.not_required/);
  assert.match(page, /empty: logisticsStatusLabels\.not_required/);
  assert.match(sql, /if target_delivery_requested then[\s\S]*public\.create_or_update_delivery\(/);
  assert.doesNotMatch(sql, /create_or_update_pickup/);
  assert.match(logisticsActions, /rpc\("create_or_update_pickup"/);
  assert.match(logisticsActions, /rpc\("create_or_update_delivery"/);
});

test("40 Terminal operational defaults leave multi-draft session persistence intact", async () => {
  const ui = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");

  assert.match(ui, /window\.sessionStorage\.setItem\(storageKey/);
  assert.match(ui, /customerDraftsRef\.current\.get\(nextCustomerId\)/);
  assert.match(ui, /setCart\(reconcileDraftCart\(nextDraft, catalog\.services\)\)/);
});

test("41 dueAt is prominent, collection-specific, required in UI and RPC", async () => {
  const [ui, sql] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source(operationalMigrationPath),
  ]);
  assert.match(ui, /border-2 border-primary\/30[\s\S]*name="dueAt"[\s\S]*required type="datetime-local"/);
  assert.match(sql, /or target_due_at is null/);
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.doesNotMatch(messages.shopTerminal.labels.dueAt, /delivery|entrega|consegna/i);
  }
});

test("42 delivery options are lazy, tenant-scoped and apply the approved address fallback", async () => {
  const [ui, queries, actions, page] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/features/shop-terminal/server/queries.ts"),
    source("src/features/shop-terminal/server/actions.ts"),
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
  ]);
  assert.match(page, /loadDeliveryOptions: loadShopDeliveryOptionsAction\.bind\(null, locale\)/);
  assert.match(actions, /loadShopDeliveryOptions as queryShopDeliveryOptions/);
  assert.match(actions, /return queryShopDeliveryOptions\(locale, customerId\)/);
  assert.match(ui, /if \(requested && customerId\) loadDeliveryOptionsForCustomer\(customerId, true\)/);
  assert.match(ui, /options\.properties\.length === 1 \? options\.properties\[0\] : null/);
  assert.match(ui, /options\.properties\.length === 0 \? options\.billing : null/);
  assert.match(queries, /customerResult\.data\.customer_code === "WALKIN-SHARED"[\s\S]*billing: null, properties: \[\]/);
  assert.match(queries, /from\("properties"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)[\s\S]*eq\("customer_id", customerId\)[\s\S]*eq\("is_active", true\)/);
  assert.doesNotMatch(queries, /from\("properties"\)\.update|from\("customers"\)\.update/);
});

test("43 operational fields survive A-B-A switching and session remount without serializing entities", async () => {
  const [ui, types] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/features/shop-terminal/types.ts"),
  ]);
  const draftType = ui.slice(ui.indexOf("type DeliveryDraft"), ui.indexOf("export type ShopTerminalText"));
  const saveDraft = ui.slice(ui.indexOf("function saveCurrentCustomerDraft"), ui.indexOf("function restoreCheckoutDraft"));
  assert.match(saveDraft, /delivery,[\s\S]*productionAssigneeId/);
  assert.match(ui, /const restoredProductionAssigneeId = draft\?\.productionAssigneeId/);
  assert.match(ui, /productionAssignments\.some\(\(assignment\) => assignment\.id === restoredProductionAssigneeId\)/);
  assert.match(ui, /const restoredDelivery = draft\?\.delivery/);
  assert.match(ui, /deliveryAssignments\.some\(\(assignment\) => assignment\.id === restoredDelivery\.assignedTo\)/);
  for (const field of ["requested", "propertyId", "scheduledAt", "assignedTo", "notes"]) {
    assert.match(draftType, new RegExp(`${field}:`));
  }
  for (const field of ["addressLine1", "contactName", "contactPhone"]) assert.match(types, new RegExp(`${field}:`));
  assert.match(draftType, /type DeliveryDraft = ShopDeliveryAddress/);
  assert.doesNotMatch(draftType, /ShopService|amount|currency|price|total|payment/);
  assert.match(ui, /parseDeliveryDraft\(draft\.delivery\)/);
});

test("44 delivery OFF creates no row; ON validates and creates the scheduled row in the order transaction", async () => {
  const [sql, action] = await Promise.all([
    source(operationalMigrationPath),
    source("src/features/shop-terminal/server/actions.ts"),
  ]);
  assert.match(action, /target_delivery_requested: deliveryRequested/);
  assert.match(action, /deliveryRequested && \(!delivery \|\| !deliveryScheduledAt[\s\S]*!deliveryAddressLine1\)/);
  assert.match(sql, /target_delivery_requested and \([\s\S]*target_delivery_scheduled_at is null[\s\S]*target_delivery_address_line1/);
  assert.match(sql, /target_delivery_assigned_to[\s\S]*membership\.is_active[\s\S]*membership\.role = 'staff'[\s\S]*'delivery' = any\(membership\.operational_capabilities::text\[\]\)/);
  assert.match(sql, /select created\.id, created\.order_number into created_order[\s\S]*if target_delivery_requested then[\s\S]*public\.create_or_update_delivery\([\s\S]*created_order\.id/);
  assert.doesNotMatch(sql, /commit;|exception when/i);
});

test("45 Terminal lookup accepts order numbers and UUIDs without weakening Phoenix code validation", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  const resolve = actions.slice(actions.indexOf("export async function resolveShopCodeAction"), actions.indexOf("export async function loadShopServicesAction"));
  const orderLookup = resolve.slice(resolve.indexOf("const orderQuery"), resolve.indexOf("if (parsed?.kind"));

  assert.match(actions, /const ORDER_NUMBER = \/\^\[a-z\]\{2,12\}-\\d\{1,12\}\$\/i/);
  assert.match("EW-000068", /^[a-z]{2,12}-\d{1,12}$/i);
  assert.match(actions, /const ORDER_ID = \/\^\[0-9a-f\]\{8\}-/);
  assert.match(resolve, /const input = raw\.trim\(\)/);
  assert.match(resolve, /ORDER_NUMBER\.test\(input\) \? input\.toUpperCase\(\) : null/);
  assert.match(resolve, /ORDER_ID\.test\(input\) \? input : null/);
  assert.match(resolve, /eq\("organization_id", membership\.organization\.id\)/);
  assert.match(resolve, /orderQuery\.eq\("order_number", orderNumber\)/);
  assert.match(resolve, /orderQuery\.eq\("id", orderId \?\? parsed!\.orderId\)/);
  assert.doesNotMatch(orderLookup, /eq\("(?:status|is_active)"/);
  assert.match(resolve, /orderNumber \|\| orderId \? null : parsePhoenixCode\(input\)/);
  assert.match(resolve, /if \(!orderNumber && !orderId && !parsed\) return \{ error: "invalid"/);
  assert.match(resolve, /if \(orderError \|\| !order\)[\s\S]*error: "not_found"/);
  assert.match(resolve, /if \(parsed\?\.kind === "label"\)[\s\S]*from\("order_items"\)/);
});
