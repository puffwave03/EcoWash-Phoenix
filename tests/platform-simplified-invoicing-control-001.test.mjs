import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261028090700_platform_simplified_invoicing_tenant_control_001.sql");
const platformMigration = read("supabase/migrations/20260827000300_platform_admin_001_saas_control_center.sql");
const action = read("src/features/platform-admin/server/actions.ts");
const query = read("src/features/platform-admin/server/queries.ts");
const page = read("src/app/[locale]/platform/organizations/[organizationId]/page.tsx");
const control = read("src/components/platform/PlatformSimplifiedInvoicingControl.tsx");

test("Platform RPCs require an authenticated Platform Admin and expose only bounded grants", () => {
  assert.deepEqual([...migration.matchAll(/create function public\.(\w+)\(/g)].map((match) => match[1]), [
    "platform_get_simplified_invoicing_status",
    "platform_set_simplified_invoicing_enabled",
  ]);
  assert.equal((migration.match(/security definer/gi) ?? []).length, 3);
  assert.equal((migration.match(/set search_path = ''/gi) ?? []).length, 2);
  assert.match(migration, /perform public\.require_platform_admin_identity\(\)/);
  assert.match(migration, /actor_id uuid := public\.require_platform_admin_identity\(\)/);
  assert.match(migration, /revoke all on function public\.platform_set_simplified_invoicing_enabled\(uuid, boolean\)\s+from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.platform_set_simplified_invoicing_enabled\(uuid, boolean\)\s+to authenticated;/);
  assert.match(migration, /revoke all on function public\.platform_get_simplified_invoicing_status\(uuid\)\s+from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.platform_get_simplified_invoicing_status\(uuid\)\s+to authenticated;/);
  assert.doesNotMatch(migration, /grant execute on function public\.platform_(?:get|set)_simplified_invoicing_[\w]+\([^;]+\)\s+to\s+(?:public|anon|service_role)/i);
  const guardStart = platformMigration.indexOf("create function public.require_platform_admin_identity()");
  const guardEnd = platformMigration.indexOf("\n$$;", guardStart);
  const guard = platformMigration.slice(guardStart, guardEnd);
  assert.match(guard, /actor_id uuid := auth\.uid\(\)/);
  assert.match(guard, /not public\.platform_admin_is_active\(actor_id\)/);
  assert.doesNotMatch(migration, /has_organization_role|customer_portal_access/);
  assert.match(action, /await requirePlatformAdmin\(locale\);[\s\S]*?platform_set_simplified_invoicing_enabled/);
});

test("Billing-off exception permits only an active Platform Admin's isolated disable", () => {
  const start = migration.indexOf("create or replace function public.require_billing_entitlement()");
  const end = migration.indexOf("\n$$;", start);
  assert.ok(start >= 0 && end > start);
  const guard = migration.slice(start, end);
  assert.match(guard, /security definer\s+set search_path = public/);
  assert.match(guard, /if not public\.organization_entitlement_is_enabled\([\s\S]*?'billing\.invoicing'/);
  assert.match(guard, /tg_op = 'UPDATE'\s+and tg_relid = 'public\.organization_billing_settings'::regclass/);
  assert.match(guard, /old\.simplified_invoicing_enabled\s+and not new\.simplified_invoicing_enabled/);
  assert.match(guard, /public\.is_platform_admin\(\)\s+and new\.updated_by = auth\.uid\(\)/);
  assert.match(guard, /to_jsonb\(new\) - array\['simplified_invoicing_enabled', 'updated_by', 'updated_at'\]::text\[\]/);
  assert.match(guard, /= \(to_jsonb\(old\) - array\['simplified_invoicing_enabled', 'updated_by', 'updated_at'\]::text\[\]\) then\s+return new;/);
  assert.match(guard, /raise exception 'billing_entitlement_required' using errcode = '42501'/);
  assert.match(guard, /if tg_op = 'DELETE' then\s+return old;\s+end if;\s+return new;/);
  assert.doesNotMatch(guard, /\b(?:insert into|update public\.|delete from)\b/i);
});

test("enabling checks tenant-local Billing prerequisites and serializes the selected settings row", () => {
  const start = migration.indexOf("create function public.platform_set_simplified_invoicing_enabled(");
  const end = migration.indexOf("\n$$;", start);
  const fn = migration.slice(start, end);
  assert.match(fn, /where organization\.id = target_organization_id[\s\S]*?organization\.deleted_at is null/);
  assert.match(fn, /where settings\.organization_id = target_organization_id\s+for update/);
  assert.match(fn, /organization_entitlement_is_enabled\(\s*target_organization_id, 'billing\.invoicing'/);
  assert.match(fn, /settings_row\.simplified_series is not distinct from settings_row\.default_series/);
  assert.match(fn, /ownership\.organization_id = target_organization_id[\s\S]*?ownership\.fiscal_document_type = 'simplified'/);
  assert.match(fn, /settings_row\.fiscal_territory_code is distinct from 'ES-CN'/);
  assert.match(fn, /settings_row\.declared_tax_regime_code is distinct from 'IGIC-GENERAL'/);
  assert.match(fn, /settings_row\.issuer_country_code is distinct from 'ES'/);
  for (const field of ["issuer_legal_name", "issuer_tax_id", "issuer_address_line1", "issuer_city", "issuer_postal_code"]) {
    assert.ok(fn.includes(`settings_row.${field}`), field);
  }
  assert.match(fn, /raise exception 'platform_simplified_invoicing_requirements_missing'/);
});

test("only the boolean gate changes; actual transitions append before/after state and repeats are no-ops", () => {
  const start = migration.indexOf("create function public.platform_set_simplified_invoicing_enabled(");
  const end = migration.indexOf("\n$$;", start);
  const fn = migration.slice(start, end);
  assert.match(fn, /if previous_enabled is not distinct from target_enabled then\s+return false;/);
  assert.match(fn, /update public\.organization_billing_settings\s+set simplified_invoicing_enabled = target_enabled,\s+updated_by = actor_id\s+where organization_id = target_organization_id;/);
  assert.match(fn, /insert into public\.platform_audit_log\s*\(\s*platform_user_id, organization_id, action, target, before_state, after_state/);
  assert.match(fn, /actor_id,\s+target_organization_id,[\s\S]*?'billing\.simplified_invoicing',[\s\S]*?jsonb_build_object\('enabled', previous_enabled\),\s+pg_catalog\.jsonb_build_object\('enabled', target_enabled\)/);
  assert.doesNotMatch(fn, /update public\.(?:invoices|payments|orders|organization_entitlements|billing_invoice_number_counters)/i);
  assert.doesNotMatch(migration, /alter table|create table|create policy|grant .* on table/i);
});

test("Platform organization detail renders localized state, confirmation and prerequisite feedback", () => {
  assert.match(query, /platform_get_simplified_invoicing_status/);
  assert.match(page, /PlatformSimplifiedInvoicingControl/);
  assert.match(action, /confirmChange.*confirmed/);
  assert.match(control, /disabled=\{!confirmed \|\| \(nextEnabled && !checks\.every/);
  assert.match(control, /status\.enabled/);
  assert.match(control, /text\.preserved/);
  assert.match(control, /text\.legalBoundary/);

  const localeKeys = ["it", "en", "es", "fr", "de"].map((locale) => {
    const messages = JSON.parse(read(`src/i18n/${locale}/common.json`)).platform;
    return {
      control: Object.keys(messages.simplifiedInvoicing).sort(),
      results: Object.keys(messages.result).sort(),
      audit: Object.keys(messages.audit.actions).sort(),
    };
  });
  for (const keys of localeKeys.slice(1)) assert.deepEqual(keys, localeKeys[0]);
  assert.ok(localeKeys[0].audit.includes("simplified_invoicing_enabled"));
  assert.ok(localeKeys[0].audit.includes("simplified_invoicing_disabled"));
});
