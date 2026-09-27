import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Owner/Manager desktop destinations feed a compact primary bar and complete More menu", async () => {
  const nav = await source("src/components/dashboard/AppNavigation.tsx");
  const owner = nav.slice(nav.indexOf("const navigationGroups"), nav.indexOf("\n    : [\n        {\n          items:", nav.indexOf("const navigationGroups")));
  for (const route of ["/app/control", "/app/orders", "/app/work", "/app/work/production", "/app/work/quality", "/app/work/deliveries", "/app/warehouse", "/app/customers", "/app/billing", "/app/accounting", "/app/services", "/app/settings", "/app/alerts", "/app/daily-close"])
    assert.ok(owner.includes(`href: "${route}"`), `${route} missing from owner desktop`);
  assert.match(nav, /const primaryItems = isControlRole[\s\S]*"\/app\/control"[\s\S]*"\/app\/shop"[\s\S]*"\/app\/orders"[\s\S]*"\/app\/pos"[\s\S]*"\/app\/work"/);
  const primary = nav.slice(nav.indexOf("const primaryItems"), nav.indexOf("const primaryHrefs"));
  assert.doesNotMatch(primary, /"\/app\/alerts"|"\/app\/daily-close"|"\/app\/warehouse"/);
  assert.match(nav, /const primaryHrefs = new Set\(primaryItems\.map/);
  assert.match(nav, /const moreGroups = isControlRole[\s\S]*navigationGroups\.map[\s\S]*group\.items\.filter\(\(item\) => !primaryHrefs\.has\(item\.href\)\)/);
  assert.match(nav, /mobileItemCount = primaryItems\.length \+ \(isControlRole \? 1 : 0\)/);
});

test("Shop/POS, Billing, staff capability, and active-route gates are preserved", async () => {
  const nav = await source("src/components/dashboard/AppNavigation.tsx");
  assert.match(nav, /canUse\("pos"\) && entitlementEnabled\(entitlements, FEATURES\.pos\)/);
  assert.match(nav, /entitlementEnabled\(entitlements, FEATURES\.shopTerminal\)/);
  assert.match(nav, /counterNavigationItems = shopNavigationItem \? \[shopNavigationItem\] : posNavigationItem \? \[posNavigationItem\] : \[\]/);
  assert.match(nav, /entitlementEnabled\(entitlements, FEATURES\.billingInvoicing\)/);
  assert.match(nav, /const isControlRole = role === "owner" \|\| role === "manager"/);
  assert.match(nav, /canUse\("production"\)/);
  assert.match(nav, /canUse\("quality"\)/);
  assert.match(nav, /canUse\("delivery"\)/);
  assert.match(nav, /const moreActive = moreGroups\.some[\s\S]*activeItem\.href/);
  assert.match(nav, /activeItem\.label/);
});

test("More is a keyboard-accessible, safe-area-aware disclosure", async () => {
  const nav = await source("src/components/dashboard/AppNavigation.tsx");
  assert.match(nav, /aria-expanded=\{moreOpen\}/);
  assert.match(nav, /aria-controls=\{moreOpen \? "mobile-more-destinations" : undefined\}/);
  assert.match(nav, /role="region"/);
  assert.match(nav, /event\.key === "Escape"[\s\S]*moreButtonRef\.current\?\.focus\(\)/);
  assert.match(nav, /document\.addEventListener\("pointerdown", closeOutside\)/);
  assert.match(nav, /querySelector<HTMLAnchorElement>\("a"\)\?\.focus\(\)/);
  assert.match(nav, /onClick=\{\(\) => setMoreOpen\(false\)\}/);
  assert.match(nav, /pb-\[max\(env\(safe-area-inset-bottom\),0\.375rem\)\]/);
  assert.match(nav, /max-h-\[65vh\] overflow-y-auto/);
});

test("all five locales have More and Close More labels", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  for (const locale of locales) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.auth.dashboard.more.length > 0);
    assert.ok(messages.auth.dashboard.closeMore.length > 0);
  }
});
