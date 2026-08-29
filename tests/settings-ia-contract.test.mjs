import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Settings replaces low-frequency setup links in daily navigation", async () => {
  const navigation = await source("src/components/dashboard/AppNavigation.tsx");

  assert.match(navigation, /href: "\/app\/settings", label: text\.settings/);
  assert.doesNotMatch(navigation, /href: "\/app\/settings\/(?:branding|catalog|printers)"/);
  assert.doesNotMatch(navigation, /href: "\/app\/staff"/);
  for (const route of ["shop", "orders", "customers", "billing", "work/production"]) {
    assert.match(navigation, new RegExp(`/app/${route.replace("/", "\\/")}`));
  }
});

test("Settings hub groups only existing routes without duplicating forms", async () => {
  const [settings, billing, billingPanel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/settings/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/billing/page.tsx"),
    source("src/components/billing/BillingSettingsPanel.tsx"),
  ]);

  for (const route of [
    "/app/billing#issuer-settings",
    "/app/settings/branding",
    "/app/settings/catalog",
    "/app/settings/printers",
    "/app/staff",
  ]) assert.equal((settings.match(new RegExp(route.replaceAll("/", "\\/"), "g")) ?? []).length, 1);
  assert.match(billing, /<BillingSettingsPanel/);
  assert.match(billingPanel, /id="issuer-settings"/);
  assert.doesNotMatch(settings, /BillingSettingsPanel|BrandingSettingsForm|PrinterSettingsWorkspace|StaffManagement/);
});

test("Settings visibility preserves route roles and premium feature gates", async () => {
  const [settings, branding, staff, printers] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/settings/page.tsx"),
    source("src/features/branding/server/queries.ts"),
    source("src/features/staff/server/queries.ts"),
    source("src/features/printer-settings/server/access.ts"),
  ]);

  assert.match(settings, /requireOwnerOrManager\(locale\)/);
  assert.match(settings, /isOwner && entitlementEnabled\(entitlements, FEATURES\.billingInvoicing\)/);
  assert.match(settings, /isOwner && entitlementEnabled\(entitlements, FEATURES\.fullWhiteLabel\)/);
  assert.match(settings, /entitlementEnabled\(entitlements, FEATURES\.printing\)/);
  assert.match(branding, /requireOwner\(locale\)/);
  assert.match(staff, /requireOwner\(locale\)/);
  assert.match(printers, /requireOwnerOrManager\(locale\)/);
  assert.match(printers, /requireEntitlement\(locale, FEATURES\.printing\)/);
});

test("all supported locales expose matching Settings vocabulary", async () => {
  const keySets = [];
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.auth.dashboard.settings, "string");
    assert.equal(typeof messages.settings.title, "string");
    assert.equal(typeof messages.settings.groups.company.title, "string");
    assert.equal(typeof messages.settings.groups.appearance.title, "string");
    assert.equal(typeof messages.settings.groups.operations.title, "string");
    assert.equal(typeof messages.settings.groups.people.title, "string");
    keySets.push(Object.keys(messages.settings.items).sort());
  }
  for (const keys of keySets.slice(1)) assert.deepEqual(keys, keySets[0]);
});
