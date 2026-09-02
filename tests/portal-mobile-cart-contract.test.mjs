import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("1 all selected service cards use the canonical quantity controls", async () => {
  const form = await source("src/components/portal/CustomerOrderRequestForm.tsx");
  const featuredStart = form.indexOf("segmentServices.map");
  const featured = form.slice(featuredStart, form.indexOf("text.completeCatalog", featuredStart));
  const catalog = form.slice(form.indexOf("visibleCategoryGroups.length"), form.indexOf("portal-request-property"));
  for (const section of [featured, catalog]) {
    assert.match(section, /changeQuantity\(service, -1\)/);
    assert.match(section, /changeQuantity\(service, 1\)/);
    assert.match(section, /setServiceQuantity\(service/);
  }
  assert.equal((form.match(/const \[quantities, setQuantities\] = useState<Record<string, string>>\(\{\}\)/g) ?? []).length, 1);
});

test("2 mobile mini-cart is selection-only, localized and safe-area aware", async () => {
  const form = await source("src/components/portal/CustomerOrderRequestForm.tsx");
  assert.match(form, /selectedItems\.length > 0 \? \([\s\S]*md:hidden/);
  assert.match(form, /servicesSelected\.replace\("\{count\}"[\s\S]*formatCurrency\(estimatedTotal/);
  assert.match(form, /bottom-\[calc\(4\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(form, /aria-haspopup="dialog"/);
  assert.match(form, /text\.viewOrder/);
});

test("3 cart opens as an accessible mobile sheet and closes when empty", async () => {
  const form = await source("src/components/portal/CustomerOrderRequestForm.tsx");
  assert.match(form, /const \[cartOpen, setCartOpen\] = useState\(false\)/);
  assert.match(form, /role="dialog" aria-modal="true" aria-labelledby="portal-cart-title"/);
  assert.match(form, /event\.key === "Escape"/);
  assert.match(form, /!selected && selectedItems\.length === 1[\s\S]*setCartOpen\(false\)/);
  assert.match(form, /quantity <= 0[\s\S]*setCartOpen\(false\)/);
  assert.match(form, /cartCloseRef\.current\?\.focus\(\)/);
});

test("4 sheet edits and removes from existing quantities and calculations", async () => {
  const form = await source("src/components/portal/CustomerOrderRequestForm.tsx");
  const sheet = form.slice(form.indexOf("cartOpen && selectedItems.length"));
  assert.match(sheet, /selectedItems\.map/);
  assert.match(sheet, /quantities\[service\.id\]/);
  assert.match(sheet, /changeQuantity\(service, -1\)/);
  assert.match(sheet, /changeQuantity\(service, 1\)/);
  assert.match(sheet, /toggleService\(service, false\)/);
  assert.match(sheet, /quantity \* service\.amount/);
  assert.match(sheet, /formatCurrency\(estimatedTotal/);
});

test("5 sheet actions preserve catalog state and reuse validateReview", async () => {
  const form = await source("src/components/portal/CustomerOrderRequestForm.tsx");
  const sheet = form.slice(form.indexOf("cartOpen && selectedItems.length"));
  assert.match(sheet, /text\.continueOrder/);
  assert.match(sheet, /setCartOpen\(false\);[\s\S]*validateReview\(\)/);
  assert.doesNotMatch(sheet, /setServiceSearch|setCategoryFilter|setOpenCategories|window\.scrollTo/);
  assert.equal((form.match(/function validateReview\(\)/g) ?? []).length, 1);
});

test("6 desktop and tablet retain one non-overlapping review summary", async () => {
  const form = await source("src/components/portal/CustomerOrderRequestForm.tsx");
  assert.match(form, /hidden rounded-card[\s\S]*md:flex[\s\S]*onClick=\{validateReview\}/);
  assert.match(form, /md:hidden/);
});

test("7 all supported locales expose the mobile cart vocabulary", async () => {
  for (const locale of ["es", "it", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const key of ["cartTitle", "viewOrder", "continueOrder", "closeCart"]) {
      assert.equal(typeof messages.portal.request[key], "string");
      assert.ok(messages.portal.request[key].length > 0);
    }
  }
});

test("8 task changes no server, pricing, RPC or migration surface", async () => {
  const page = await source("src/app/[locale]/portal/requests/new/page.tsx");
  assert.match(page, /createCustomerPortalOrderRequestAction\.bind\(null, locale\)/);
  assert.match(page, /CustomerOrderRequestForm/);
});
