import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261007000300_saas_productization_configuration_foundation_001.sql");
const hash = (text) => createHash("sha256").update(text).digest("hex");

test("historical tenant and inclusive Billing migrations are byte unchanged", () => {
  assert.equal(hash(read("supabase/migrations/20260727000100_app_003_tenant_foundation.sql")), "dac1ae8c49c91435160df9b1f62257e5b49aecf40f691e7b9cd93f15005e4e15");
  assert.equal(hash(read("supabase/migrations/20260728000400_app_008_1_organization_timezone.sql")), "caecc69e1a9684734b71610cae91dc4c0befd9afd21ac8db9c7d5861d25d15f1");
  assert.equal(hash(read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql")), "d7ce8c538efa466057a1da909665a535732d12708a74b41fb94246b5f640fee6");
});

test("new tenant settings have bounded fields without pilot currency, timezone or country defaults", () => {
  assert.match(migration, /add column default_locale text not null default 'en'/);
  assert.match(migration, /add column default_country_code text;/);
  assert.match(migration, /default_locale in \('en', 'it', 'es', 'fr', 'de'\)/);
  assert.match(migration, /default_country_code ~ '\^\[A-Z\]\{2\}\$'/);
  assert.match(migration, /alter column default_currency drop default/);
  assert.match(migration, /alter column timezone drop default/);
  assert.match(migration, /alter column billing_country_code drop default/);
  assert.match(migration, /alter column preferred_locale drop default/);
  assert.match(migration, /alter column country_code drop default/);
  assert.match(migration, /alter table public.orders alter column currency drop default/);
  assert.match(migration, /alter table public.service_prices alter column currency drop default/);
  assert.match(migration, /if new.currency is null then[\s\S]*organization.default_currency::text into new.currency/);
  assert.match(migration, /pg_catalog\.pg_timezone_names/);
  assert.match(migration, /where slug = 'ecowash-la-tejita'/);
  assert.match(migration, /set default_locale = 'es', default_country_code = 'ES'/);
});

test("owner RPC derives the tenant, validates inputs, and updates only approved settings", () => {
  const rpc = migration.split("create function public.update_current_organization_settings(")[1];
  assert.ok(rpc);
  assert.doesNotMatch(rpc.split(")\nreturns void")[0], /organization_id/);
  assert.match(rpc, /security definer\s+set search_path = public/);
  assert.match(rpc, /org_id uuid := public.app_current_organization_id\(\)/);
  assert.match(rpc, /has_organization_role\(org_id, array\['owner'\]/);
  assert.match(rpc, /set name = normalized_name,\s+default_currency = target_default_currency,\s+timezone = target_timezone,\s+default_locale = target_default_locale,\s+default_country_code = normalized_country/);
  assert.doesNotMatch(rpc, /set\s+(slug|status|deleted_at|created_by|commercial_plan_label)/);
  assert.match(migration, /revoke update on public.organizations from authenticated/);
  assert.match(migration, /revoke all on function public.update_current_organization_settings/);
  assert.match(migration, /grant execute on function public.update_current_organization_settings\(text, text, text, text, text\) to authenticated/);
});

test("currency and timezone changes stop at tenant-scoped historical fact boundaries", () => {
  const rpc = migration.split("create function public.update_current_organization_settings(")[1].split("\n-- Existing catalog/")[0];
  assert.match(rpc, /select organization\.default_currency::text, organization\.timezone\s+into current_currency, current_timezone[\s\S]*where organization\.id = org_id[\s\S]*for update;/);

  const currencyGuard = rpc.split("if target_default_currency is distinct from current_currency and (")[1].split("\n  ) then")[0];
  const timezoneGuard = rpc.split("if target_timezone is distinct from current_timezone and (")[1].split("\n  ) then")[0];
  assert.ok(currencyGuard && timezoneGuard);
  for (const table of ["service_prices", "catalog_segment_prices", "orders", "invoices", "expenses"]) {
    assert.match(currencyGuard, new RegExp(`exists \\(select 1 from public\\.${table} where organization_id = org_id\\)`));
  }
  for (const table of ["orders", "pos_sessions", "daily_closes", "invoices", "expenses"]) {
    assert.match(timezoneGuard, new RegExp(`exists \\(select 1 from public\\.${table} where organization_id = org_id\\)`));
  }
  assert.match(rpc, /raise exception 'organization_currency_locked' using errcode = '22023'/);
  assert.match(rpc, /raise exception 'organization_timezone_locked' using errcode = '22023'/);
  assert.match(rpc, /update public\.organizations\s+set name = normalized_name,\s+default_currency = target_default_currency,\s+timezone = target_timezone,\s+default_locale = target_default_locale,\s+default_country_code = normalized_country/);
  assert.doesNotMatch(rpc, /\b(update|delete from|truncate)\s+public\.(service_prices|catalog_segment_prices|orders|payments|refunds|invoices|expenses|pos_sessions|daily_closes)\b/i);
});

test("Owner settings are independent of Billing and Branding entitlements", () => {
  const settings = read("src/app/[locale]/app/(dashboard)/settings/page.tsx");
  const page = read("src/app/[locale]/app/(dashboard)/settings/organization/page.tsx");
  const action = read("src/features/organization-settings/server/actions.ts");
  assert.match(settings, /isOwner[\s\S]*href: "\/app\/settings\/organization"/);
  assert.match(page, /requireOwner\(locale\)/);
  assert.match(action, /await requireOwner\(locale\)/);
  assert.doesNotMatch(action, /requireEntitlement|organizationId|serviceRole|createSupabaseAdminClient/);
  assert.match(action, /error\.message === "organization_currency_locked"[\s\S]*error: "currencyLocked"/);
  assert.match(action, /error\.message === "organization_timezone_locked"[\s\S]*error: "timezoneLocked"/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
    assert.ok(messages.settings.items.organization.title);
    assert.ok(messages.organizationSettings.country);
    assert.ok(messages.organizationSettings.currencyLocked);
    assert.ok(messages.organizationSettings.timezoneLocked);
  }
});

test("organization locale round trip uses the selected value and verifies authoritative read-back", () => {
  const form = read("src/components/organization-settings/OrganizationSettingsForm.tsx");
  const action = read("src/features/organization-settings/server/actions.ts");
  const page = read("src/app/[locale]/app/(dashboard)/settings/organization/page.tsx");
  const membership = read("src/lib/auth/get-current-membership.ts");
  const rpc = migration.split("create function public.update_current_organization_settings(")[1].split("\n-- Existing catalog/")[0];

  assert.match(form, /<select[^>]*defaultValue=\{settings\.defaultLocale\}[^>]*key=\{settings\.defaultLocale\}[^>]*name="defaultLocale"/);
  for (const value of ["en", "it", "es", "fr", "de"]) {
    assert.match(form, new RegExp(`<option value="${value}">`));
  }
  assert.match(action, /formData\.get\("defaultLocale"\)/);
  assert.match(action, /routing\.locales\.includes\(defaultLocale/);
  assert.match(action, /target_default_locale: defaultLocale/);
  assert.match(rpc, /target_default_locale not in \('en', 'it', 'es', 'fr', 'de'\)/);
  assert.match(rpc, /default_locale = target_default_locale/);
  assert.match(action, /if \(error\) \{[\s\S]*saved: false[\s\S]*\}\s*const \{ data: savedOrganization, error: readError \}/);
  assert.match(action, /\.from\("organizations"\)\s*\.select\("default_locale"\)\s*\.eq\("id", membership\.organization\.id\)/);
  assert.match(action, /readError \|\| savedOrganization\?\.default_locale !== defaultLocale[\s\S]*saved: false/);
  assert.match(action, /revalidatePath\(`\/\$\{locale\}\/app\/settings\/organization`\)/);
  assert.match(page, /const organization = access\.membership\.organization/);
  assert.match(page, /settings=\{organization\}/);
  assert.match(membership, /defaultLocale: organization\.default_locale/);
  assert.doesNotMatch(action, /redirect\(|router\.replace|update\(\{[^}]*locale/);
  assert.doesNotMatch(migration, /\b(update|insert into|delete from)\s+public\.(profiles|customers)\b/i);
});

test("organization settings action saves es/it and never reports success on RPC or read-back failure", async () => {
  const source = read("src/features/organization-settings/server/actions.ts");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = { rpc: [], revalidated: [] };
  let rpcError = null;
  let storedLocale = "it";
  const modules = {
    "next/cache": { revalidatePath: (...args) => calls.revalidated.push(args) },
    "@/lib/auth/require-role": { requireOwner: async () => ({ membership: { organization: { id: "tenant-a" } } }) },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({
      rpc: async (name, args) => { calls.rpc.push({ name, args }); return { error: rpcError }; },
      from: (table) => {
        assert.equal(table, "organizations");
        return { select: (columns) => {
          assert.equal(columns, "default_locale");
          return { eq: (column, id) => {
            assert.deepEqual([column, id], ["id", "tenant-a"]);
            return { single: async () => ({ data: { default_locale: storedLocale }, error: null }) };
          } };
        } };
      },
    }) },
    "@/i18n/routing": { routing: { locales: ["en", "it", "es", "fr", "de"] } },
  };
  const actionModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      assert.ok(name in modules, `Unexpected module: ${name}`);
      return modules[name];
    }, actionModule, actionModule.exports,
  );
  const save = actionModule.exports.saveOrganizationSettingsAction;
  const form = (locale) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ name: "EcoWash", defaultCurrency: "EUR", timezone: "Atlantic/Canary", defaultLocale: locale, defaultCountryCode: "ES" })) data.set(key, value);
    return data;
  };

  assert.deepEqual(await save("it", { error: null, saved: false }, form("it")), { error: null, saved: true });
  assert.equal(calls.rpc.at(-1).args.target_default_locale, "it");
  assert.deepEqual(calls.revalidated[0], ["/it/app/settings/organization"]);
  storedLocale = "es";
  assert.deepEqual(await save("it", { error: null, saved: false }, form("es")), { error: null, saved: true });
  assert.equal(calls.rpc.at(-1).args.target_default_locale, "es");

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    rpcError = { code: "42501", message: "organization_settings_denied" };
    assert.deepEqual(await save("it", { error: null, saved: false }, form("it")), { error: "unavailable", saved: false });
    rpcError = null;
    assert.deepEqual(await save("it", { error: null, saved: false }, form("it")), { error: "unavailable", saved: false });
  } finally {
    console.error = originalConsoleError;
  }
});

test("creation defaults come from current membership, not Spanish or EUR constants", () => {
  const membership = read("src/lib/auth/get-current-membership.ts");
  const customerActions = read("src/features/customers/server/actions.ts");
  const customerValidation = read("src/features/customers/server/validation.ts");
  const shop = read("src/features/shop-terminal/server/actions.ts");
  const shopView = read("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  const service = read("src/features/services/validation.ts");
  const pos = read("src/features/pos/server/queries.ts");
  const segmentPricing = read("src/features/pricing-segments/server/queries.ts");
  assert.match(membership, /default_currency, default_locale, default_country_code/);
  assert.match(customerActions, /countryCode: membership.organization.defaultCountryCode/);
  assert.match(customerActions, /locale: membership.organization.defaultLocale/);
  assert.match(customerActions, /parsePropertyForm\(formData, membership.organization.defaultCountryCode\)/);
  assert.doesNotMatch(customerValidation, /"ES"|"es"/);
  assert.match(shop, /billing_country_code: membership.organization.defaultCountryCode/);
  assert.match(shop, /: membership.organization.defaultLocale/);
  assert.match(shopView, /services\[0\]\?\.currency \?\? defaultCurrency/);
  assert.match(shopView, /emptyDeliveryDraft\(deliveryAssignments\[0\]\?\.id, defaultCountryCode \?\? ""\)/);
  assert.match(service, /\|\| defaultCurrency/);
  assert.match(pos, /return membership.organization.defaultCurrency/);
  assert.match(segmentPricing, /currency: membership.organization.defaultCurrency/);
});

test("migration changes neither financial history nor bootstrap, entitlements, locations or fiscal behavior", () => {
  assert.doesNotMatch(migration, /\b(update|insert into|delete from|truncate)\s+public\.(orders|order_items|service_prices|payments|refunds|invoices|invoice_items|organization_entitlements|locations)\b/i);
  assert.doesNotMatch(migration, /\b(update|insert into|delete from|truncate)\s+public\.(customers|properties)\b/i);
  assert.doesNotMatch(migration, /\b(VeriFactu|IGIC|IVA|VAT|tax_rate|prices_include_tax)\b/i);
  assert.doesNotMatch(migration, /insert into public.organizations|insert into public.organization_memberships/i);
});
