import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const uiPath = "src/components/shop-terminal/ShopTerminalWorkspace.tsx";

test("1 shop route keeps the authoritative shop-terminal gate", async () => {
  const [page, access] = await Promise.all([source("src/app/[locale]/app/(dashboard)/shop/page.tsx"), source("src/features/shop-terminal/server/access.ts")]);
  assert.match(page, /requireShopTerminalAccess\(locale\)/);
  assert.match(access, /requireEntitlement\(locale, FEATURES\.shopTerminal\)/);
  assert.match(access, /requirePosAccess\(locale\)/);
});

test("2 Owner and Manager keep inherited POS/shop capability", async () => {
  const capabilities = await source("src/lib/auth/capabilities.ts");
  assert.match(capabilities, /role === "owner" \|\| role === "manager"/);
});

test("3 Staff still requires explicit POS capability", async () => {
  const capabilities = await source("src/lib/auth/capabilities.ts");
  assert.match(capabilities, /DEFAULT_STAFF_OPERATIONAL_CAPABILITIES[\s\S]*capability !== "pos"/);
});

test("4 register uses a wide catalog and fixed checkout from the tablet breakpoint", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /lg:grid-cols-\[minmax\(0,2\.1fr\)_minmax\(20rem,1fr\)\]/);
  assert.match(ui, /lg:sticky/);
  assert.match(ui, /counter-register-shell/);
});

test("5 compact top bar exposes organization, operator, location and till management", async () => {
  const [ui, page] = await Promise.all([source(uiPath), source("src/app/[locale]/app/(dashboard)/shop/page.tsx")]);
  assert.match(ui, /text\.operator/);
  assert.match(ui, /session\.locationName/);
  assert.match(ui, /text\.tillManagement/);
  assert.match(page, /operatorName=/);
});

test("6 existing customer search covers name, phone and email", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /\[customer\.name, customer\.phone, customer\.email\]/);
  assert.match(ui, /type="search"/);
});

test("7 regular customer creation remains a quick canonical action", async () => {
  const [ui, actions] = await Promise.all([source(uiPath), source("src/features/shop-terminal/server/actions.ts")]);
  assert.match(ui, /value=\{customerMode\}/);
  assert.match(ui, /"regular"/);
  assert.match(actions, /from\("customers"\)\.insert/);
});

test("8 each walk-in gets a distinct traceable canonical customer", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  assert.match(actions, /customerKind"\) === "walk_in"/);
  assert.match(actions, /`WALKIN-\$\{crypto\.randomUUID\(\)\.toUpperCase\(\)\}`/);
  assert.match(actions, /Occasional customer created at the shop terminal/);
});

test("9 walk-in never uses a shared global anonymous customer", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  assert.doesNotMatch(actions, /shared|anonymous_customer|global_walk/i);
  assert.match(actions, /crypto\.randomUUID/);
});

test("10 customer creation remains tenant scoped and attributable", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  assert.match(actions, /organization_id: membership\.organization\.id/);
  assert.match(actions, /created_by: user\.id/);
  assert.match(actions, /updated_by: user\.id/);
});

test("11 no parallel walk-in schema or COUNTER migration was added", async () => {
  const migrations = await readdir(new URL("../supabase/migrations", import.meta.url));
  assert.equal(migrations.some((name) => /counter_ux_002|walk.?in/i.test(name)), false);
});

test("12 catalog offers real category navigation and service search", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /const categories = useMemo/);
  assert.match(ui, /setCategory/);
  assert.match(ui, /setServiceQuery/);
});

test("13 service tiles are touch-sized and add immediately", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /min-h-40/);
  assert.match(ui, /onClick=\{\(\) => addService\(service\)\}/);
});

test("14 repeated service taps increment the existing line", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /const existing = current\.find/);
  assert.match(ui, /line\.quantity \+ increment/);
});

test("15 discrete quantity remains integer-only", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /discrete \? Math\.trunc\(raw\)/);
  assert.match(ui, /isDiscreteServiceUnit\(line\.service\.unitType\) \? 1 : 0\.1/);
});

test("16 continuous quantity retains decimal semantics", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /Math\.round\(raw \* 1000\) \/ 1000/);
  assert.match(ui, /0\.001/);
});

test("17 effective segment pricing and base fallback remain server authoritative", async () => {
  const [sql, queries] = await Promise.all([source("supabase/migrations/20260829000200_shop_terminal_001_counter_experience.sql"), source("src/features/shop-terminal/server/queries.ts")]);
  assert.match(sql, /resolve_effective_service_price/);
  assert.match(queries, /list_shop_terminal_services/);
});

test("18 client submits service IDs and quantities, never trusted prices or totals", async () => {
  const ui = await source(uiPath);
  const payload = ui.slice(ui.indexOf("const payload ="), ui.indexOf("if (payloadRef.current)"));
  assert.match(payload, /serviceId: line\.service\.id/);
  assert.doesNotMatch(payload, /unitPrice|subtotal:|total:/);
});

test("19 discount is monetary-only and role bounded", async () => {
  const [ui, italian] = await Promise.all([source(uiPath), source("src/i18n/it/common.json")]);
  assert.match(italian, /"discount": "Sconto \(€\)"/);
  assert.match(ui, /const canDiscount = role === "owner" \|\| role === "manager"/);
  assert.doesNotMatch(`${ui}\n${italian}`, /discountPercent|percentuale/i);
});

test("20 cash is a direct large pay-now action", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /intent === "cash"/);
  assert.match(ui, /value="cash"/);
  assert.match(ui, /method: "cash"/);
});

test("21 manual card is a direct action without raw card fields", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /intent === "card"/);
  assert.match(ui, /method: "card"/);
  assert.doesNotMatch(ui, /\bPAN\b|\bCVV\b|cardNumber|expiry/i);
});

test("22 pay later sends no payment and no till session", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /intent === "later" \? null : session\?\.id/);
  assert.match(ui, /value="later"/);
  assert.match(ui, /: \[\];/);
});

test("23 split cash/card remains available for exact reconciliation", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /splitCash/);
  assert.match(ui, /splitCard/);
  assert.match(ui, /roundMoney\(splitCash \+ splitCard\) !== total/);
});

test("24 payment reuses the supplied current till and never opens one", async () => {
  const [ui, page] = await Promise.all([source(uiPath), source("src/app/[locale]/app/(dashboard)/shop/page.tsx")]);
  assert.match(page, /getCurrentPosSession\(locale\)/);
  assert.match(ui, /session\?\.id/);
  assert.doesNotMatch(ui, /openPosSession|open_pos_session/);
});

test("25 duplicate submit remains transactionally idempotent", async () => {
  const sql = await source("supabase/migrations/20260829000200_shop_terminal_001_counter_experience.sql");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /shop_terminal_idempotency_conflict/);
});

test("26 success remains in-terminal and exposes all PRINT actions", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /PrintOrderActions/);
  assert.match(ui, /text\.newOrder/);
  assert.match(ui, /text\.openOrder/);
  assert.doesNotMatch(ui, /redirect\(/);
});

test("27 no fake online-payment action is rendered", async () => {
  const ui = await source(uiPath);
  assert.doesNotMatch(ui, /online|provider/i);
});

test("28 layout stays responsive without a horizontal register grid on mobile", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /grid min-w-0/);
  assert.match(ui, /xl:grid-cols/);
  assert.doesNotMatch(ui, /grid-cols-\[minmax\(0,2fr\).*\](?![\s\S]*xl:)/);
});

test("29 navigation keeps one terminal entry with POS as management fallback", async () => {
  const navigation = await source("src/components/dashboard/AppNavigation.tsx");
  assert.match(navigation, /counterNavigationItems = shopNavigationItem \? \[shopNavigationItem\] : posNavigationItem/);
  assert.equal((navigation.match(/counterNavigationItems =/g) ?? []).length, 1);
});

test("30 five locales expose the professional-register vocabulary", async () => {
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(Object.keys(messages.shopTerminal.labels).length, 68);
    for (const key of ["catalog", "occasionalCustomer", "regularCustomer", "splitPayment", "tillManagement"]) assert.equal(typeof messages.shopTerminal.labels[key], "string");
  }
});
