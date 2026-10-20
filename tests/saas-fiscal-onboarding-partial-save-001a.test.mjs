import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute the real action and settings reader with in-memory IO doubles.
// The RPC double models only settings persistence, not PostgreSQL/RLS or issuance.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
function harness({ role = "owner", entitled = true, readError = false, rpcError = false, initial = null } = {}) {
  let saved = initial;
  const calls = { rpc: [], reads: [], clients: 0, revalidated: [] };
  const organization = { id: "tenant-a", name: "[tenant name]" };
  const access = { membership: { role, organization } };
  const guard = (roles) => async () => {
    if (!roles.includes(role)) throw Error("ROLE_DENIED");
    return access;
  };
  const supabase = {
    from(table) {
      assert.ok(["organization_billing_settings", "organization_branding"].includes(table));
      const call = { table, filters: [] }; calls.reads.push(call);
      return {
        select() { return this; },
        eq(column, value) { call.filters.push([column, value]); return this; },
        async maybeSingle() {
          assert.deepEqual(call.filters, [["organization_id", "tenant-a"]]);
          if (readError) return { data: null, error: { message: "read failed" } };
          return { data: table === "organization_branding" ? null : saved, error: null };
        },
      };
    },
    async rpc(name, args) {
      assert.equal(name, "upsert_organization_billing_settings", "Only settings persistence is allowed");
      calls.rpc.push({ name, args: plain(args) });
      if (rpcError) return { error: { message: "write failed" } };
      saved = { ...saved };
      for (const [key, value] of Object.entries(args)) saved[key.replace(/^target_/, "")] = typeof value === "string" ? value.trim() || null : value;
      return { error: null };
    },
  };
  function load(path) {
    const loaded = { exports: {} };
    const dependencies = {
      "server-only": {},
      "next/cache": { revalidatePath(path) { calls.revalidated.push(path); } },
      "next/navigation": { redirect(href) { throw Object.assign(Error("REDIRECT"), { href }); } },
      "@/lib/auth/require-role": { requireOwner: guard(["owner"]), requireOwnerOrManager: guard(["owner", "manager"]) },
      "@/features/entitlements/feature-catalog": { FEATURES: { billingInvoicing: "billing.invoicing" } },
      "@/features/entitlements/server/resolver": { requireEntitlement: async () => { if (!entitled) throw Error("ENTITLEMENT_DENIED"); } },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => { calls.clients++; return supabase; } },
    };
    runInNewContext(ts.transpileModule(read(path), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      module: loaded, exports: loaded.exports,
      require(name) {
        if (Object.hasOwn(dependencies, name)) return dependencies[name];
        if (["@/features/billing/tax-rate", "@/features/billing/types"].includes(name)) return load(`src/${name.slice(2)}.ts`);
        // Other Billing functions are outside this path and must never be called.
        if (name.startsWith("@/features/billing/")) return {};
        throw Error(`Unexpected import ${name}`);
      },
    });
    return loaded.exports;
  }
  const actions = load("src/features/billing/server/actions.ts");
  const queries = load("src/features/billing/server/queries.ts");
  return {
    calls, settings: () => saved,
    async save(values = {}) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ defaultSeries: "A", defaultTaxRate: "7", ...values })) form.set(key, value);
      await assert.rejects(actions.saveBillingSettingsAction("en", form), (error) => {
        if (!error.href) throw error;
        this.redirect = error.href;
        return true;
      });
      return this.redirect;
    },
    async get() { return plain(await queries.getBillingSettings("en")); },
  };
}

const complete = {
  issuer_legal_name: "[stored legal name]", issuer_tax_id: "12345678Z", // Published DNI checksum example, no tenant identity.
  issuer_address_line1: "[stored address]", issuer_address_line2: "[stored address 2]",
  issuer_city: "[stored city]", issuer_region: "[stored region]", issuer_postal_code: "[stored postcode]",
  issuer_country_code: "ES", issuer_email: "[stored email]", issuer_phone: "[stored phone]",
};

test("an Owner can save and read an incomplete profile without a fictional NIF", async () => {
  const h = harness();
  assert.equal(await h.save({ issuerLegalName: "[field supplied]" }), "/en/app/billing?saved=settings");
  assert.equal(h.settings().issuer_tax_id, null);
  assert.equal(h.settings().issuer_address_line1, null);
  assert.equal(h.settings().default_series, "A");
  assert.equal(h.settings().default_tax_rate, 7);
  const result = await h.get();
  assert.equal(result.issuerLegalName, "[field supplied]");
  assert.equal(result.issuerTaxId, "");
  assert.equal(result.isIssueReady, false);
  assert.equal(result.simplifiedIssuanceReady, false);
  assert.ok(result.missingRequiredFields.includes("issuerTaxId"));
});

test("an entirely empty identity is saved while technical settings remain mandatory", async () => {
  const h = harness();
  await h.save();
  const result = await h.get();
  assert.equal(result.missingRequiredFields.length, 6);
  assert.equal(result.isIssueReady, false); // Prefilled organization name is not persisted legal identity.
});

test("blank and omitted fields preserve every existing issuer value; supplied values can replace them", async () => {
  const h = harness({ initial: complete });
  await h.save({ issuerTaxId: " \n ", issuerAddressLine1: "", issuerCity: " ", issuerPostalCode: "" });
  for (const [key, value] of Object.entries(complete)) assert.equal(h.settings()[key], value, key);
  await h.save({ issuerCity: "[replacement city]" });
  assert.equal(h.settings().issuer_city, "[replacement city]");
  assert.equal(h.settings().issuer_tax_id, complete.issuer_tax_id);
  assert.equal((await h.get()).isIssueReady, true);
});

test("a missing NIF remains incomplete even when all other fields are present", async () => {
  const h = harness({ initial: { ...complete, issuer_tax_id: null } });
  await h.save({ issuerTaxId: "" });
  const result = await h.get();
  assert.deepEqual(result.missingRequiredFields, ["issuerTaxId"]);
  assert.equal(result.isIssueReady, false);
});

test("each existing required field still controls readiness after a partial save", async () => {
  for (const field of ["issuer_legal_name", "issuer_tax_id", "issuer_address_line1", "issuer_city", "issuer_postal_code", "issuer_country_code"]) {
    const h = harness({ initial: { ...complete, [field]: null } });
    await h.save();
    assert.equal((await h.get()).isIssueReady, false, field);
  }
});

test("complete issuer fields do not activate simplified invoicing or change existing readiness rules", async () => {
  const h = harness({ initial: { ...complete, simplified_series: "S", fiscal_territory_code: "ES-CN", declared_tax_regime_code: "IGIC-GENERAL", simplified_invoicing_enabled: false } });
  await h.save();
  const result = await h.get();
  assert.equal(result.isIssueReady, true);
  assert.equal(result.simplifiedIssuanceReady, false);
  assert.equal(h.settings().simplified_invoicing_enabled, false);
  assert.ok(!Object.keys(h.calls.rpc[0].args).some((key) => /enabled|territory|regime/.test(key)));
});

test("missing or invalid technical defaults are rejected before IO, including a blank tax rate", async () => {
  for (const values of [{ defaultSeries: "" }, { defaultSeries: "A A" }, { defaultSeries: "A".repeat(13) },
    { defaultTaxRate: "" }, { defaultTaxRate: " " }, { defaultTaxRate: "no" }, { defaultTaxRate: "-1" }, { defaultTaxRate: "101" }]) {
    const h = harness();
    assert.equal(await h.save(values), "/en/app/billing?error=settingsInvalid");
    assert.equal(h.calls.clients, 0);
  }
  const h = harness();
  await h.save({ defaultSeries: "a-1", defaultTaxRate: "0" });
  assert.equal(h.settings().default_series, "A-1");
  assert.equal(h.settings().default_tax_rate, 0);
});

test("optional country still requires two characters when supplied", async () => {
  const h = harness();
  assert.equal(await h.save({ issuerCountryCode: "ESP" }), "/en/app/billing?error=settingsInvalid");
  assert.equal(h.calls.rpc.length, 0);
});

test("Manager, Staff and absent entitlement cannot save", async () => {
  for (const role of ["manager", "staff"]) {
    const h = harness({ role });
    await assert.rejects(h.save(), /ROLE_DENIED/);
    assert.equal(h.calls.clients, 0);
  }
  const h = harness({ entitled: false });
  await assert.rejects(h.save(), /ENTITLEMENT_DENIED/);
  assert.equal(h.calls.clients, 0);
});

test("tenant comes from authenticated membership; submitted tenant IDs are ignored", async () => {
  const h = harness();
  await h.save({ organization_id: "tenant-b", organizationId: "tenant-b" });
  assert.deepEqual(h.calls.reads[0].filters, [["organization_id", "tenant-a"]]);
  assert.ok(!Object.keys(h.calls.rpc[0].args).some((key) => /organization/.test(key)));
  assert.equal(h.calls.rpc.length, 1);
});

test("a failed preservation read cannot overwrite saved data or show success", async () => {
  const h = harness({ initial: complete, readError: true });
  assert.equal(await h.save(), "/en/app/billing?error=generic");
  assert.equal(h.calls.rpc.length, 0);
  assert.deepEqual(h.settings(), complete);
  assert.deepEqual(h.calls.revalidated, []);
});

test("RPC failure produces error feedback without a success redirect", async () => {
  const h = harness({ initial: complete, rpcError: true });
  assert.equal(await h.save(), "/en/app/billing?error=generic");
  assert.deepEqual(h.calls.revalidated, []);
});

test("form permits partial identity, preserves technical requirements and displays neutral status", () => {
  const panel = read("src/components/billing/BillingSettingsPanel.tsx");
  for (const field of ["LegalName", "TaxId", "AddressLine1", "City", "PostalCode", "CountryCode"]) {
    assert.match(panel, new RegExp(`settings\\.issuer${field}, false\\]`));
  }
  assert.match(panel, /settings\.defaultSeries, true\]/);
  assert.match(panel, /name="defaultTaxRate" required/);
  assert.match(panel, /text\.partialSaveHelp/);
  assert.match(panel, /text\.verificationNotice/);
  assert.match(panel, /settings\.missingRequiredFields\.map/);
  const page = read("src/app/[locale]/app/(dashboard)/billing/page.tsx");
  assert.match(page, /query\.saved === "settings" \? "issuerSettingsSaved" : "saved"/);
});

test("all five languages distinguish saved, missing, complete and unverified states", () => {
  let keys;
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const billing = JSON.parse(read(`src/i18n/${locale}/common.json`)).billing;
    const currentKeys = Object.keys(billing.settings).sort();
    if (keys) assert.deepEqual(currentKeys, keys); else keys = currentKeys;
    const labels = [billing.issuerSettingsSaved, billing.settings.ready, billing.settings.missing,
      billing.settings.partialSaveHelp, billing.settings.verificationNotice, billing.errors.settingsInvalid];
    assert.equal(new Set(labels).size, labels.length);
    for (const label of labels) assert.equal(typeof label, "string");
    assert.match(billing.settings.verificationNotice, /not|non|No |n’a pas|nicht/);
  }
});

test("canonical SQL already allows incomplete settings and retains database authorization and issue safeguards", () => {
  const sql = read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
  const writer = sql.slice(sql.indexOf("create function public.upsert_organization_billing_settings("), sql.indexOf("create function public.create_billing_draft("));
  assert.match(writer, /app_current_organization_id\(\)/);
  assert.match(writer, /array\['owner'\]::public\.app_role\[\]/);
  assert.match(writer, /nullif\(btrim\(target_issuer_tax_id\), ''\)/);
  const issue = read("supabase/migrations/20261018000100_billing_simplified_invoice_001f_service_issuance.sql");
  assert.match(issue, /nullif\(btrim\(settings_row\.issuer_tax_id\), ''\) is null/);
  assert.match(issue, /billing_issuer_configuration_required/);
});
