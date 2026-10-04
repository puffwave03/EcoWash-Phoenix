import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const queryPath = "src/features/shop-terminal/server/queries.ts";
const actionPath = "src/features/shop-terminal/server/actions.ts";
const pagePath = "src/app/[locale]/app/(dashboard)/shop/page.tsx";
const uiPath = "src/components/shop-terminal/ShopTerminalWorkspace.tsx";

test("001E recent customers are an independent eight-row tenant-scoped presentation list", async () => {
  const queries = await source(queryPath);
  const recent = queries.slice(queries.indexOf("export async function listShopRecentCustomers"), queries.indexOf("export async function searchShopCustomers"));
  assert.match(recent, /requireShopTerminalAccess\(locale\)/);
  assert.match(recent, /eq\("organization_id", membership\.organization\.id\)/);
  assert.match(recent, /eq\("is_active", true\)/);
  assert.match(recent, /customer_code\.is\.null,customer_code\.not\.like\.WALKIN-%/);
  assert.match(recent, /order\("updated_at", \{ ascending: false \}\)[\s\S]*order\("id", \{ ascending: false \}\)[\s\S]*limit\(8\)/);
  assert.doesNotMatch(recent, /limit\(80\)/);
});

test("001E search filters the full tenant on name, phone and email before limiting", async () => {
  const queries = await source(queryPath);
  const search = queries.slice(queries.indexOf("export async function searchShopCustomers"), queries.indexOf("export async function listShopRecentOrders"));
  assert.match(search, /requireShopTerminalAccess\(locale\)/);
  assert.match(search, /typeof rawQuery === "string" \? rawQuery : ""\)\.trim\(\)\.slice\(0, 80\)/);
  assert.match(search, /replace\(\/\[\^\\p\{L\}\\p\{N\}\\s@\.\+\\-'\]\/gu, " "\)/);
  assert.match(search, /if \(!search\) return \[\]/);
  assert.match(search, /eq\("organization_id", membership\.organization\.id\)/);
  assert.match(search, /eq\("is_active", true\)/);
  assert.match(search, /customer_code\.is\.null,customer_code\.not\.like\.WALKIN-%/);
  assert.match(search, /display_name\.ilike\.%\$\{search\}%,phone\.ilike\.%\$\{search\}%,email\.ilike\.%\$\{search\}%/);
  assert.ok(search.indexOf(".or(`display_name.ilike") < search.indexOf(".limit(8)"));
  assert.match(search, /order\("updated_at", \{ ascending: false \}\)[\s\S]*order\("id", \{ ascending: false \}\)/);
  assert.doesNotMatch(search, /organizationId:|serviceRole|limit\(80\)/);
});

test("001E server action and page bind locale without client tenant identity", async () => {
  const [actions, page] = await Promise.all([source(actionPath), source(pagePath)]);
  assert.match(actions, /searchShopCustomersAction\(locale: string, rawQuery: string\)[\s\S]*return searchShopCustomers\(locale, rawQuery\)/);
  assert.match(page, /listShopRecentCustomers\(locale\)/);
  assert.match(page, /searchCustomers: searchShopCustomersAction\.bind\(null, locale\)/);
  assert.doesNotMatch(page, /listShopCustomers\(/);
});

test("001E blank query shows recents; nonblank search is debounced and stale-safe", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /const normalizedCustomerQuery = customerQuery\.trim\(\)/);
  assert.match(ui, /normalizedCustomerQuery[\s\S]*customerSearchResults\.query === normalizedCustomerQuery[\s\S]*: recentCustomers/);
  assert.match(ui, /if \(!normalizedCustomerQuery\) return/);
  assert.match(ui, /setTimeout\(async \(\) => \{[\s\S]*actions\.searchCustomers\(normalizedCustomerQuery\)[\s\S]*\}, 250\)/);
  assert.match(ui, /customerSearchRequestRef\.current !== requestId\) return/);
  assert.match(ui, /clearTimeout\(timer\)[\s\S]*customerSearchRequestRef\.current \+= 1/);
  assert.match(ui, /text\.searchingCustomers/);
  assert.match(ui, /text\.noCustomerMatches/);
  assert.doesNotMatch(ui, /customers\.filter\(\(customer\) => !customer\.isWalkIn/);
});

test("001E searched customers use existing selection and customer drafts", async () => {
  const ui = await source(uiPath);
  assert.match(ui, /selectCustomer\(customer\.id, normalizedCustomerQuery \? customer : undefined\)/);
  assert.match(ui, /if \(foundCustomer\) setCustomers/);
  assert.match(ui, /setRecentCustomers\(\(current\) => \[result\.customer!/);
  assert.match(ui, /selectCustomer\(result\.customer\.id\)/);
  const select = ui.slice(ui.indexOf("function selectCustomer"), ui.indexOf("function openCustomerPicker"));
  assert.match(select, /saveCurrentCustomerDraft\(\)/);
  assert.match(select, /customerDraftsRef\.current\.get\(nextCustomerId\)/);
  assert.match(select, /restoreCheckoutDraft\(nextDraft\)/);
  assert.match(select, /actions\.loadServices\(nextCustomerId/);
  assert.match(ui, /<QuickDropTerminalPanel[\s\S]*customer=\{selectedCustomer/);
});

test("001E search feedback is available in all five locales", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const labels = JSON.parse(await source(`src/i18n/${locale}/common.json`)).shopTerminal.labels;
    assert.ok(labels.searchingCustomers);
    assert.ok(labels.noCustomerMatches);
  }
});
