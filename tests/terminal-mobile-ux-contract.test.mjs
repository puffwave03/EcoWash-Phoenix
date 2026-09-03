import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const uiPath = "src/components/shop-terminal/ShopTerminalWorkspace.tsx";

test("1 smartphone uses a dedicated one-column service list while md+ keeps the catalog grid", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-4/);
  assert.match(ui, /data-terminal-mobile-service-card[\s\S]*md:hidden/);
  assert.match(ui, /hidden h-full min-w-0 flex-col[\s\S]*md:flex/);
  assert.match(ui, /lg:grid-cols-\[minmax\(0,2\.1fr\)_minmax\(20rem,1fr\)\]/);
});

test("2 mobile service cards keep compact media and readable canonical details", async () => {
  const ui = await source(uiPath);
  const mobileCard = ui.slice(ui.indexOf("data-terminal-mobile-service-card"), ui.indexOf("data-terminal-service-card"));
  assert.match(mobileCard, /h-24 w-24/);
  assert.match(mobileCard, /service\.name/);
  assert.match(mobileCard, /categoryLabel/);
  assert.match(mobileCard, /formatCurrency\(service\.amount/);
  assert.doesNotMatch(mobileCard, /line-clamp|truncate/);
});

test("3 mobile add and quantity controls mutate the canonical cart", async () => {
  const ui = await source(uiPath);
  const mobileCard = ui.slice(ui.indexOf("data-terminal-mobile-service-card"), ui.indexOf("data-terminal-service-card"));
  assert.match(mobileCard, /addService\(service\)/);
  assert.match(mobileCard, /adjustQuantity\(line, -1\)/);
  assert.match(mobileCard, /updateQuantity\(service\.id/);
  assert.match(mobileCard, /adjustQuantity\(line, 1\)/);
  assert.match(mobileCard, /aria-label=\{`− \$\{text\.quantity\} · \$\{service\.name\}`\}/);
  assert.equal((ui.match(/const \[cart, setCart\] = useState<CartLine\[\]>\(\[\]\)/g) ?? []).length, 1);
});

test("4 mini-cart is item-only, uses canonical total and clears the bottom navigation", async () => {
  const ui = await source(uiPath);
  const miniCart = ui.slice(ui.indexOf("cart.length > 0 ? <div"), ui.indexOf("isMobileCartOpen && cart.length"));
  assert.match(miniCart, /data-terminal-mobile-mini-cart/);
  assert.match(miniCart, /formatCurrency\(total, currency, locale\)/);
  assert.match(miniCart, /setIsMobileCartOpen\(true\)/);
  assert.match(miniCart, /bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(ui, /pb-28[\s\S]*md:pb-4/);
});

test("5 mobile cart is an accessible in-place dialog", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /const \[isMobileCartOpen, setIsMobileCartOpen\] = useState\(false\)/);
  assert.match(ui, /aria-modal="true"[\s\S]*role="dialog"/);
  assert.match(ui, /aria-labelledby="terminal-mobile-cart-title"/);
  assert.match(ui, /mobileCartCloseRef\.current\?\.focus\(\)/);
  assert.match(ui, /event\.key === "Escape"/);
  assert.doesNotMatch(ui, /isMobileCartOpen[\s\S]{0,500}router\.push/);
});

test("6 sheet reuses cart handlers, financial values and existing checkout", async () => {
  const ui = await source(uiPath);
  const sheet = ui.slice(ui.indexOf("isMobileCartOpen && cart.length"));
  assert.match(sheet, /cart\.map/);
  assert.match(sheet, /adjustQuantity\(line, -1\)/);
  assert.match(sheet, /updateQuantity\(line\.service\.id/);
  assert.match(sheet, /adjustQuantity\(line, 1\)/);
  assert.match(sheet, /removeCartLine\(line\.service\.id\)/);
  assert.match(sheet, /formatCurrency\(subtotal/);
  assert.match(sheet, /formatCurrency\(safeDiscount/);
  assert.match(sheet, /formatCurrency\(total/);
  assert.match(ui, /id="terminal-checkout"/);
  assert.match(ui, /scrollIntoView/);
  assert.equal((ui.match(/<form action=\{submit\}/g) ?? []).length, 1);
});

test("7 simple cart close preserves catalog and customer context", async () => {
  const ui = await source(uiPath);
  const close = ui.slice(ui.indexOf("useEffect(() =>"), ui.indexOf("function selectCustomer"));
  assert.doesNotMatch(close, /setCustomerId|setServices|setSegmentName|setServiceQuery|setCategory|catalogRequestRef/);
  assert.match(ui, /selectedCustomerName/);
  assert.match(ui, /text\.changeCustomer/);
  const openPicker = ui.slice(ui.indexOf("function openCustomerPicker"), ui.indexOf("function clearCustomer"));
  assert.doesNotMatch(openPicker, /setCart|setServices|catalogRequestRef/);
});

test("8 changing customer retains stale-response and dependent-state protection", async () => {
  const ui = await source(uiPath);
  const select = ui.slice(ui.indexOf("function selectCustomer"), ui.indexOf("function openCustomerPicker"));
  assert.match(select, /catalogRequestRef\.current = requestId/);
  assert.match(select, /setCart\(\[\]\)/);
  assert.match(select, /setCategory\("all"\)/);
  assert.match(select, /setServiceQuery\(""\)/);
  assert.match(select, /catalogRequestRef\.current !== requestId/);
});

test("9 shared walk-in, segment eligibility and submit/payment paths remain canonical", async () => {
  const [ui, actions, query, sharedMigration, segmentMigration] = await Promise.all([
    source(uiPath),
    source("src/features/shop-terminal/server/actions.ts"),
    source("src/features/shop-terminal/server/queries.ts"),
    source("supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql"),
    source("supabase/migrations/20260902000100_terminal_segment_catalog_001.sql"),
  ]);
  assert.match(ui, /walkInName: selectedCustomer\?\.isWalkIn/);
  assert.match(actions, /resolve_shared_walk_in_customer/);
  assert.match(query, /rpc\("list_shop_terminal_services"/);
  assert.match(sharedMigration, /shop_terminal_service_is_eligible/);
  assert.match(segmentMigration, /shop_terminal_service_is_eligible/);
  assert.match(ui, /const total = roundMoney\(subtotal - safeDiscount\)/);
  assert.match(ui, /<form action=\{submit\}/);
});

test("10 mobile header and navigation are compact without losing destinations", async () => {
  const [ui, navigation] = await Promise.all([
    source(uiPath),
    source("src/components/dashboard/AppNavigation.tsx"),
  ]);
  assert.match(ui, /hidden border-b[\s\S]*md:block/);
  assert.match(ui, /md:hidden[\s\S]*organizationName[\s\S]*text\.title[\s\S]*text\.tillManagement/);
  assert.match(navigation, /min-h-14[\s\S]*text-\[0\.68rem\][\s\S]*line-clamp-2/);
  for (const path of ["/app/control", "/app/shop", "/app/orders", "/app/work", "/app/alerts"]) assert.match(navigation, new RegExp(path.replaceAll("/", "\\/")));
});

test("11 all locales retain the reused mobile cart vocabulary", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const key of ["cart", "continueToCatalog", "emptyCart", "openOrder", "payment", "quantity", "remove", "subtotal", "total"]) {
      assert.equal(typeof messages.shopTerminal.labels[key], "string");
    }
  }
});
