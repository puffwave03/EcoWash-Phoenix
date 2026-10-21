import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const routePath = "src/app/[locale]/portal/preview-test/route.ts";
const helperPath = "src/features/portal/server/preview.ts";
const pagePath = "src/app/[locale]/app/(dashboard)/customers/[customerId]/page.tsx";
const locales = ["en", "it", "es", "fr", "de"];

function load(path, mocks = {}, env = {}) {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, Response, URL, process: { env },
    // Any attempted Auth/client import or real network call fails the test.
    require(name) { assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name]; },
    fetch() { assert.fail("Preview must never contact an external service"); },
  });
  return testModule.exports;
}

async function assertDenied(route, locale, query = "", authenticated = false) {
  const request = new Request(`https://example.test/${locale}/portal/preview-test${query}`, {
    headers: authenticated ? { cookie: "synthetic-session=synthetic" } : {},
  });
  const response = await route.GET(request, { params: Promise.resolve({ locale }) });
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("location"), null);
}

test("direct preview requests fail closed in every locale regardless of configuration", async () => {
  for (const flag of [undefined, "false", "true"]) {
    const route = load(routePath, {}, {
      ENABLE_STAGING_CUSTOMER_PREVIEW: flag,
      NEXT_PUBLIC_SITE_INDEXING: "false",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-preview-key",
    });
    for (const locale of locales) await assertDenied(route, locale);
  }
});

test("unexpired legacy signatures and malformed or expired links cannot authenticate", async () => {
  const key = "synthetic-preview-key";
  const customerId = "00000000-0000-4000-8000-000000000001";
  const route = load(routePath, {}, {
    ENABLE_STAGING_CUSTOMER_PREVIEW: "true", NEXT_PUBLIC_SITE_INDEXING: "false", SUPABASE_SERVICE_ROLE_KEY: key,
  });
  for (const locale of locales) {
    for (const expires of [Math.floor(Date.now() / 1000) + 300, 1]) {
      // Reproduce the old signing format with synthetic material only.
      const sig = createHmac("sha256", key).update(`${locale}.${customerId}.${expires}`).digest("hex");
      const query = `?${new URLSearchParams({ customerId, expires: String(expires), sig })}`;
      await assertDenied(route, locale, query);
    }
    await assertDenied(route, locale, "?customerId=synthetic&expires=invalid&sig=invalid");
  }
});

test("preview never changes or clears an existing legitimate session", async () => {
  const route = load(routePath, {}, { ENABLE_STAGING_CUSTOMER_PREVIEW: "true" });
  for (const locale of locales) await assertDenied(route, locale, "", true);
});

test("preview helper returns no operational link even with the environment flag enabled", () => {
  const helper = load(helperPath, { "server-only": {} }, {
    ENABLE_STAGING_CUSTOMER_PREVIEW: "true", NEXT_PUBLIC_SITE_INDEXING: "false",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-preview-key",
  });
  assert.deepEqual(Object.keys(helper), ["createStagingCustomerPreviewPath"]);
  for (const locale of locales) {
    assert.equal(helper.createStagingCustomerPreviewPath(locale, "synthetic-customer"), null);
  }
});

test("customer detail pages pass no preview link for Owner or Manager", async () => {
  const helper = load(helperPath, { "server-only": {} }, { ENABLE_STAGING_CUSTOMER_PREVIEW: "true" });
  const customer = { id: "synthetic-customer" };
  for (const role of ["owner", "manager"]) {
    const page = load(pagePath, {
      "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
      "@/components/customers/CustomerAccountView": { CustomerAccountView: "CustomerAccountView" },
      "@/features/billing/server/queries": { getCustomerBillingOverview: async () => null },
      "@/features/catalog-segments/server/queries": { getCustomerSegmentAssignment: async () => null },
      "@/features/customer-account/server/queries": { getCustomerAccountFinancials: async () => ({}) },
      "@/features/customer-account/validation": { parseCustomerAccountPeriod: () => ({}) },
      "@/features/customer-lifecycle/server/queries": { getCustomerLifecycleEligibility: async () => ({}) },
      "@/features/customers/server/queries": { getCustomerById: async () => customer, listPropertiesByCustomer: async () => [] },
      "@/features/portal/server/preview": helper,
      "@/features/portal/server/queries": { getCustomerPortalAccessSummary: async () => null },
      "@/lib/auth/require-role": { requireOwnerOrManager: async () => ({ membership: { role } }) },
      "@/features/entitlements/feature-catalog": { FEATURES: { billingInvoicing: "billing.invoicing" } },
      "@/features/entitlements/server/resolver": { hasEntitlement: async () => false },
    });
    const result = await page.default({ params: Promise.resolve({ locale: "es", customerId: customer.id }), searchParams: Promise.resolve({}) });
    assert.equal(result.props.previewUrl, null);
    assert.equal(result.props.customer, customer);
  }
  const view = readFileSync("src/components/customers/CustomerAccountView.tsx", "utf8");
  const panel = readFileSync("src/components/customers/CustomerPortalAccessPanel.tsx", "utf8");
  assert.match(view, /previewUrl=\{previewUrl\}/);
  assert.match(panel, /\{previewUrl \? \([\s\S]*?href=\{previewUrl\}/);
});
