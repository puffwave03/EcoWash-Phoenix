import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Static source contracts only. No database connection, migration application,
// mutation or simulated proof of fiscal compliance / runtime RLS enforcement.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationName = "20261016000200_billing_fiscal_profile_001_minimal_configuration.sql";
const migration = read(`supabase/migrations/${migrationName}`);
const code = migration.replace(/--[^\n]*/g, "").trim();
const foundation = read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
const inclusive = read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql");
const entitlements = read("supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql");
const typeFoundation = read("supabase/migrations/20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql");
const profileColumns = ["fiscal_territory_code", "declared_tax_regime_code", "simplified_invoicing_enabled"];

function sqlFunction(source, name) {
  const match = source.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"));
  assert.ok(match, `Missing canonical function ${name}`);
  return match[0];
}

test("one available migration identifier follows 001B without changing earlier history", () => {
  const names = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((name) => name.endsWith(".sql"));
  assert.equal(names.filter((name) => name.startsWith("20261016000200_")).length, 1);
  const earlier = names.filter((name) => name.slice(0, 14) < migrationName.slice(0, 14)).sort();
  assert.equal(earlier.at(-1), "20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql");
});

test("only the canonical settings table receives three additive fields in one atomic DDL unit", () => {
  const statements = code.split(";").map((part) => part.trim()).filter(Boolean);
  assert.equal(statements.length, 3);
  assert.equal(statements[0], "begin");
  assert.match(statements[1], /^alter table public\.organization_billing_settings\s/);
  assert.equal(statements[2], "commit");
  assert.deepEqual([...code.matchAll(/add column (\w+)/g)].map((match) => match[1]), profileColumns);
  assert.equal((code.match(/add constraint/g) ?? []).length, 3);
  assert.doesNotMatch(code, /\b(?:create|drop|rename|insert|update|delete|merge|truncate|execute|grant|revoke)\b/i);
  assert.doesNotMatch(code, /alter column|not valid|\bdisable\b|jsonb?|references|default_series|default_tax_rate/i);
});

test("existing tenants keep unknown territory/regime instead of receiving an inferred fiscal profile", () => {
  for (const column of profileColumns.slice(0, 2)) {
    assert.match(code, new RegExp(`add column ${column} text\\s*,`));
  }
  assert.equal((code.match(/\bdefault\b/gi) ?? []).length, 1);
  assert.match(code, /default false/);
  assert.doesNotMatch(code, /\b(?:ES|IGIC|IVA|VAT|EcoWash|Canary|Canarias)\b|\b7(?:\.0+)?\b/i);
  assert.doesNotMatch(code, /issuer_country_code|issuer_region|\btotal\b|tax_rate|approved|version/i);
});

test("declared codes have explicit bounded syntax; syntax is not legal approval", () => {
  for (const column of profileColumns.slice(0, 2)) {
    const check = code.match(new RegExp(`add constraint organization_billing_settings_${column}_valid check \\(([\\s\\S]*?)\\)`));
    assert.ok(check);
    assert.equal(check[1].trim(), `${column} is null\n    or ${column} ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'`);
    const syntax = new RegExp(check[1].match(/~ '([^']+)'/)[1]);
    // Technical fixtures, not a catalog of approved jurisdictions or regimes.
    for (const value of ["X", "TEST-A", "TEST.B_2", "A".repeat(64)]) assert.ok(syntax.test(value));
    for (const value of ["", " ", "test", " TEST", "TEST ", "TEST\nA", "A".repeat(65), "T/1", "T'1"]) assert.ok(!syntax.test(value));
  }
});

test("simplified is disabled by default and cannot be enabled or nulled by a settings write", () => {
  assert.match(code, /add column simplified_invoicing_enabled boolean not null default false/);
  const check = code.match(/add constraint organization_billing_settings_simplified_disabled check \(([^)]+)\)/);
  assert.ok(check);
  assert.equal(check[1].trim(), "simplified_invoicing_enabled = false");
  assert.doesNotMatch(check[1], /\bor\b|territory|regime|current_setting|auth\./i);
});

test("no alternate configuration store, client RPC, grant or RLS policy is introduced", () => {
  assert.deepEqual([...code.matchAll(/alter table public\.(\w+)/g)].map((match) => match[1]), ["organization_billing_settings"]);
  assert.doesNotMatch(code, /\b(?:function|policy|role|security|trigger|index|sequence|table if)\b/i);
  assert.match(foundation, /revoke all on table public\.organization_billing_settings from public, anon, authenticated/);
  assert.match(foundation, /grant select on table public\.organization_billing_settings to authenticated/);
  assert.match(foundation, /alter table public\.organization_billing_settings enable row level security/);
});

test("the existing settings writer remains Owner-only and derives its tenant on the server", () => {
  const writer = sqlFunction(foundation, "upsert_organization_billing_settings");
  const args = writer.slice(0, writer.indexOf("returns void"));
  assert.doesNotMatch(args, /organization_id|org_id/);
  assert.match(writer, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(writer, /public\.has_organization_role\(org_id, array\['owner'\]::public\.app_role\[\]\)/);
  assert.match(writer, /on conflict \(organization_id\)/);
  assert.match(writer, /org_id,[\s\S]*actor_id/);
  assert.doesNotMatch(writer, /fiscal_territory_code|declared_tax_regime_code|simplified_invoicing_enabled/);
  assert.match(read("src/features/billing/server/actions.ts"), /export async function saveBillingSettingsAction[\s\S]*?await requireOwner\(locale\);[\s\S]*?await requireEntitlement\(locale, FEATURES\.billingInvoicing\)/);
});

test("legacy settings upserts preserve declarations already present on the conflicting row", () => {
  const writer = sqlFunction(foundation, "upsert_organization_billing_settings");
  const columns = writer.match(/insert into public\.organization_billing_settings\s*\(([\s\S]*?)\) values/);
  assert.ok(columns);
  const updates = writer.slice(writer.indexOf("on conflict (organization_id)"));
  for (const column of profileColumns) {
    assert.doesNotMatch(columns[1], new RegExp(`\\b${column}\\b`));
    assert.doesNotMatch(updates, new RegExp(`\\b${column}\\b`));
  }
});

test("existing management reads retain role, entitlement and tenant boundaries, excluding Terminal staff", () => {
  assert.match(entitlements, /create policy organization_billing_settings_select_management\s+on public\.organization_billing_settings\s+for select to authenticated\s+using \(\s+public\.has_organization_role\(organization_id, array\['owner', 'manager'\]::public\.app_role\[\]\)\s+and public\.has_organization_entitlement\(organization_id, 'billing.invoicing'\)\s+\)/);
  assert.match(entitlements, /create trigger organization_billing_settings_require_entitlement\s+before insert or update or delete on public\.organization_billing_settings/);
  const queries = read("src/features/billing/server/queries.ts");
  const settingsRead = queries.slice(queries.indexOf("export async function getBillingSettings"), queries.indexOf("export async function getBillingCustomerContext"));
  assert.match(settingsRead, /requireOwnerOrManager\(locale\)/);
  assert.match(settingsRead, /requireEntitlement\(locale, FEATURES\.billingInvoicing\)/);
  assert.match(settingsRead, /\.eq\("organization_id", membership\.organization\.id\)/);
});

test("ordinary creation and issue keep their existing settings, amounts and numbering contracts", () => {
  const draft = sqlFunction(inclusive, "create_billing_draft");
  const issue = sqlFunction(inclusive, "issue_billing_invoice");
  assert.match(issue, /settings_row public\.organization_billing_settings%rowtype/);
  assert.match(issue, /select \* into settings_row[\s\S]*where settings\.organization_id = org_id/);
  assert.match(issue, /on conflict \(organization_id, series\)/);
  assert.match(draft, /settings\.default_tax_rate/);
  for (const column of profileColumns) assert.doesNotMatch(`${draft}\n${issue}`, new RegExp(`\\b${column}\\b`));
  assert.doesNotMatch(code, /invoices\b|invoice_items|invoice_orders|payments|refunds|prices_include_tax|taxable_base|tax_total|billing_invoice_number_counters/i);
});

test("the independent approved 001B ordinary-only guard stays byte-identical and active in SQL", () => {
  assert.equal(createHash("sha256").update(typeFoundation).digest("hex"), "74f904597f2e802e684496fd7bd0724410108555763283a332debcc8db5e307b");
  assert.match(typeFoundation, /add constraint invoices_fiscal_document_type_ordinary_only check \(\s*fiscal_document_type = 'ordinary'::public\.billing_fiscal_document_type\s*\)/);
  assert.doesNotMatch(code, /invoices_fiscal_document_type_ordinary_only|billing_fiscal_document_type/);
});
