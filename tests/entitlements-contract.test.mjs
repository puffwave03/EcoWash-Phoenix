import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("1 entitled tenant can access Billing through the centralized gate", async () => {
  const [migration, actions, queries] = await Promise.all([
    source(migrationPath),
    source("src/features/billing/server/actions.ts"),
    source("src/features/billing/server/queries.ts"),
  ]);
  assert.match(migration, /'billing\.invoicing'/);
  assert.match(actions, /requireEntitlement\(locale, FEATURES\.billingInvoicing\)/);
  assert.match(queries, /requireEntitlement\(locale, FEATURES\.billingInvoicing\)/);
});

test("2 non-entitled tenant is denied Billing reads and mutations", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /create trigger invoices_require_entitlement/);
  assert.match(migration, /billing_entitlement_required/);
  assert.match(migration, /has_organization_entitlement\(organization_id, 'billing\.invoicing'\)/);
});

test("3 direct Billing Server Action invocation cannot bypass the entitlement gate", async () => {
  const actions = await source("src/features/billing/server/actions.ts");
  const exports = actions.match(/export async function/g) ?? [];
  const gates = actions.match(/requireEntitlement\(locale, FEATURES\.billingInvoicing\)/g) ?? [];
  assert.equal(gates.length, exports.length);
});

test("4 disabling Billing never deletes or rewrites invoice history", async () => {
  const migration = await source(migrationPath);
  assert.doesNotMatch(migration, /delete from public\.(invoices|invoice_items|invoice_orders)/);
  assert.doesNotMatch(migration, /update public\.(invoices|invoice_items|invoice_orders)/);
});

test("5 entitled segment-pricing management is allowed through its feature boundary", async () => {
  const [migration, actions] = await Promise.all([
    source(migrationPath),
    source("src/features/pricing-segments/server/actions.ts"),
  ]);
  assert.match(migration, /'pricing\.segment_overrides'/);
  assert.match(actions, /requireEntitlement\(locale, FEATURES\.segmentPriceOverrides\)/);
});

test("6 disabled segment-pricing management is denied in UI, action and database", async () => {
  const [migration, page, queries] = await Promise.all([
    source(migrationPath),
    source("src/app/[locale]/app/(dashboard)/settings/catalog/segments/page.tsx"),
    source("src/features/pricing-segments/server/queries.ts"),
  ]);
  assert.match(migration, /segment_pricing_entitlement_required/);
  assert.match(page, /pricingEnabled \? getSegmentPricingSettings/);
  assert.match(queries, /requireEntitlement\(locale, FEATURES\.segmentPriceOverrides\)/);
});

test("7 configured segment overrides are preserved and runtime resolution remains continuous", async () => {
  const [migration, pricingMigration] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260827000100_pricing_segments_001_segment_price_overrides.sql"),
  ]);
  assert.doesNotMatch(migration, /delete from public\.catalog_segment_prices/);
  assert.doesNotMatch(migration, /update public\.catalog_segment_prices/);
  assert.doesNotMatch(pricingMigration.slice(pricingMigration.indexOf("create function public.resolve_effective_service_price")), /organization_entitlement/);
});

test("8 advanced branding writes and media mutation require white-label entitlement", async () => {
  const [migration, actions, queries] = await Promise.all([
    source(migrationPath),
    source("src/features/branding/server/actions.ts"),
    source("src/features/branding/server/queries.ts"),
  ]);
  assert.match(migration, /organization_branding_update_owner[\s\S]*branding\.full_white_label/);
  assert.match(migration, /brand_media_insert_owner[\s\S]*branding\.full_white_label/);
  assert.match(actions, /requireEntitlement\(locale, FEATURES\.fullWhiteLabel\)/);
  assert.match(queries, /requireEntitlement\(locale, FEATURES\.fullWhiteLabel\)/);
});

test("9 tenant Owner cannot self-enable paid features", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /grant select on public\.organization_entitlements to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*organization_entitlements to authenticated/);
  assert.doesNotMatch(migration, /create function public\.(save|update|upsert).*entitlement/);
});

test("10 tenant Manager cannot self-enable paid features", async () => {
  const migration = await source(migrationPath);
  const policy = migration.slice(migration.indexOf("create policy organization_entitlements_select_management"), migration.indexOf("revoke all on public.platform_feature_catalog"));
  assert.match(policy, /for select/);
  assert.doesNotMatch(policy, /for (insert|update|delete|all)/);
});

test("11 Staff cannot administer entitlements or use unauthorized premium navigation", async () => {
  const [migration, navigation] = await Promise.all([
    source(migrationPath),
    source("src/components/dashboard/AppNavigation.tsx"),
  ]);
  assert.match(migration, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(navigation, /isControlRole/);
  assert.match(navigation, /entitlementEnabled\(entitlements, FEATURES\.billingInvoicing\)/);
});

test("12 Tenant A cannot read or resolve Tenant B private entitlement state", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /public\.is_organization_member\(target_organization_id\)/);
  assert.match(migration, /public\.has_organization_role\([\s\S]*organization_id/);
  assert.doesNotMatch(migration, /grant execute on function public\.organization_entitlement_is_enabled/);
});

test("13 expired and not-yet-valid entitlements resolve disabled", async () => {
  const migration = await source(migrationPath);
  assert.match(migration, /entitlement\.valid_from is null or entitlement\.valid_from <= target_at/);
  assert.match(migration, /entitlement\.valid_until is null or entitlement\.valid_until >= target_at/);
});

test("14 existing EcoWash behavior is bootstrapped without granting future modules", async () => {
  const migration = await source(migrationPath);
  const bootstrap = migration.slice(migration.indexOf("insert into public.organization_entitlements"), migration.indexOf("create function public.require_billing_entitlement"));
  for (const key of ["core.orders", "core.customers", "core.operations", "core.portal", "catalog.management", "catalog.segments", "pricing.segment_overrides", "billing.invoicing", "branding.basic", "branding.custom_colors", "branding.full_white_label"]) {
    assert.match(bootstrap, new RegExp(`'${key.replaceAll(".", "\\.")}'`));
  }
  for (const key of ["reports.advanced", "pos", "printing", "barcode", "accounting", "e_invoice", "multi_location"]) {
    assert.doesNotMatch(bootstrap, new RegExp(`'${key.replaceAll(".", "\\.")}'`));
  }
  assert.match(bootstrap, /bootstrap_existing_20260827/);
});

test("15 unavailable feature UX is consistent and localized in all five locales", async () => {
  const [page, panel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/feature-unavailable/page.tsx"),
    source("src/components/entitlements/FeatureUnavailablePanel.tsx"),
  ]);
  assert.match(page, /common\.entitlements\.unavailable/);
  assert.match(panel, /shadow-card/);
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.entitlements.unavailable.title, "string");
    assert.equal(typeof messages.entitlements.unavailable.description, "string");
  }
});

test("16 core non-premium order, customer and operations workflows remain ungated", async () => {
  const paths = [
    "src/features/orders/server/actions.ts",
    "src/features/customers/server/actions.ts",
    "src/features/logistics/server/actions.ts",
  ];
  for (const path of paths) assert.doesNotMatch(await source(path), /requireEntitlement|organization_entitlement/);
});

test("feature keys are centralized and application logic never branches on plan names", async () => {
  const [catalog, resolver, navigation] = await Promise.all([
    source("src/features/entitlements/feature-catalog.ts"),
    source("src/features/entitlements/server/resolver.ts"),
    source("src/components/dashboard/AppNavigation.tsx"),
  ]);
  assert.match(catalog, /billingInvoicing: "billing\.invoicing"/);
  assert.match(catalog, /segmentPriceOverrides: "pricing\.segment_overrides"/);
  assert.match(catalog, /fullWhiteLabel: "branding\.full_white_label"/);
  assert.doesNotMatch(`${resolver}\n${navigation}`, /plan\s*===|premium\s*===/i);
});

test("Customer Account removes Billing actions when invoicing is not entitled", async () => {
  const [page, view] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/customers/[customerId]/page.tsx"),
    source("src/components/customers/CustomerAccountView.tsx"),
  ]);
  assert.match(page, /billingEnabled \? getCustomerBillingOverview/);
  assert.match(view, /billingOverview \? \(/);
});
