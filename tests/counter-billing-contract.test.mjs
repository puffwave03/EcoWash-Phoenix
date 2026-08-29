import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("1 issuer autofill derives only from the authenticated tenant and its branding", async () => {
  const queries = await source("src/features/billing/server/queries.ts");
  assert.match(queries, /requireOwnerOrManager\(locale\)/);
  assert.match(queries, /FEATURES\.billingInvoicing/);
  assert.match(queries, /from\("organization_branding"\)/);
  assert.match(queries, /commercial_name, business_address, support_email, support_phone/);
  assert.match(queries, /eq\("organization_id", membership\.organization\.id\)/);
  assert.match(queries, /branding\?\.commercial_name.*membership\.organization\.name/);
  assert.match(queries, /isIssueReady = Boolean\([\s\S]*settings\?\.issuer_legal_name/);
});

test("2 tenant display identity stays an editable unconfirmed fallback", async () => {
  const [queries, panel, messages] = await Promise.all([
    source("src/features/billing/server/queries.ts"),
    source("src/components/billing/BillingSettingsPanel.tsx"),
    source("src/i18n/en/common.json"),
  ]);
  assert.match(queries, /autofilledFields\.push\("issuerLegalName"\)/);
  assert.match(panel, /settings\.autofilledFields\.length/);
  assert.match(messages, /tenant display name is not treated as a legal name until saved/);
});

test("3 issuer configuration is compact when ready and names missing required fields", async () => {
  const panel = await source("src/components/billing/BillingSettingsPanel.tsx");
  assert.match(panel, /<details open=\{!settings\.isIssueReady\}>/);
  assert.match(panel, /settings\.issuerLegalName.*settings\.issuerTaxId.*settings\.issuerAddressLine1/);
  assert.match(panel, /settings\.missingRequiredFields\.map/);
  assert.match(panel, /requiredLabels\[field\]/);
});

test("4 saved issuer values continue through the canonical owner-only upsert", async () => {
  const actions = await source("src/features/billing/server/actions.ts");
  assert.match(actions, /saveBillingSettingsAction[\s\S]*requireOwner\(locale\)/);
  assert.match(actions, /rpc\("upsert_organization_billing_settings"/);
  assert.doesNotMatch(actions, /from\("organization_billing_settings"\)\.(insert|update|upsert)/);
});

test("5 terminal success opens Billing with canonical order and customer context", async () => {
  const [terminal, types, action] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/features/shop-terminal/types.ts"),
    source("src/features/shop-terminal/server/actions.ts"),
  ]);
  assert.match(types, /customerId: string/);
  assert.match(action, /result: \{[\s\S]*customerId,/);
  assert.match(terminal, /canInvoice \? <Link/);
  assert.match(terminal, /billing\/new\?customerId=\$\{result\.customerId\}&orderId=\$\{result\.orderId\}&source=shop/);
});

test("6 counter Invoice action reuses Billing entitlement and excludes Staff", async () => {
  const page = await source("src/app/[locale]/app/(dashboard)/shop/page.tsx");
  assert.match(page, /FEATURES\.billingInvoicing/);
  assert.match(page, /canInvoice=\{entitlementEnabled\(entitlements, FEATURES\.billingInvoicing\) && access\.membership\.role !== "staff"\}/);
  assert.doesNotMatch(page, /new entitlement|planName|plan_name/i);
});

test("7 Billing route resolves and preselects the exact completed order", async () => {
  const [page, queries, form] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/billing/new/page.tsx"),
    source("src/features/billing/server/queries.ts"),
    source("src/components/billing/BillingCreateForm.tsx"),
  ]);
  assert.match(page, /listEligibleBillingOrders\(locale, query\.customerId, query\.orderId\)/);
  assert.match(page, /getBillingCustomerContext\(locale, query\.customerId\)/);
  assert.match(page, /!customerContext \|\| customerContext\.isFiscalReady/);
  assert.match(queries, /if \(customerId\) query = query\.eq\("customer_id", customerId\)/);
  assert.match(queries, /if \(orderId\) query = query\.eq\("id", orderId\)/);
  assert.match(form, /defaultChecked=\{order\.id === selectedOrderId\}/);
});

test("8 customer fiscal completion requests only fields missing from the current model", async () => {
  const [queries, panel] = await Promise.all([
    source("src/features/billing/server/queries.ts"),
    source("src/components/billing/BillingCustomerFiscalPanel.tsx"),
  ]);
  for (const field of ["billingAddressLine1", "billingCity", "billingPostalCode", "billingCountryCode"]) {
    assert.match(queries, new RegExp(`missingRequiredFields\\.push\\("${field}"\\)`));
  }
  assert.match(queries, /customer_type === "business".*missingRequiredFields\.push\("taxId"\)/);
  assert.match(panel, /context\.missingRequiredFields\.map/);
  assert.match(panel, /context\.isWalkIn \? text\.walkInDescription : text\.description/);
});

test("9 fiscal completion is management-only, entitled and tenant-scoped", async () => {
  const actions = await source("src/features/billing/server/actions.ts");
  const start = actions.indexOf("export async function saveBillingCustomerFiscalAction");
  const end = actions.indexOf("export async function createBillingDraftAction", start);
  const body = actions.slice(start, end);
  assert.match(body, /requireOwnerOrManager\(locale\)/);
  assert.match(body, /requireEntitlement\(locale, FEATURES\.billingInvoicing\)/);
  assert.equal((body.match(/eq\("organization_id", membership\.organization\.id\)/g) ?? []).length, 2);
  assert.match(body, /if \(!current\?\.trim\(\)\)/);
  assert.doesNotMatch(body, /\.insert\(|createCustomer|payments|orders\)\.update/);
});

test("10 counter bridge cannot duplicate invoice lines or payment rows", async () => {
  const files = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/app/[locale]/app/(dashboard)/billing/new/page.tsx"),
    source("src/components/billing/BillingCustomerFiscalPanel.tsx"),
    source("src/features/billing/server/actions.ts"),
  ]);
  const bridge = files.join("\n");
  assert.doesNotMatch(bridge, /from\("invoice_items"\)\.(insert|update)|from\("payments"\)\.(insert|update)/);
  assert.match(bridge, /rpc\("create_billing_draft"/);
});

test("11 operational receipt remains explicitly non-fiscal", async () => {
  const messages = await source("src/i18n/en/common.json");
  assert.match(messages, /Operational order\/payment document\. This is not an invoice or fiscal receipt\./);
  assert.doesNotMatch(messages, /official simplified invoice|fiscal receipt ready/i);
});

test("12 simplified invoice is not fabricated by this task", async () => {
  const [migration, terminal, page] = await Promise.all([
    source("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/app/[locale]/app/(dashboard)/billing/new/page.tsx"),
  ]);
  assert.doesNotMatch(migration, /factura simplificada|simplified_invoice|document_type/i);
  assert.doesNotMatch(`${terminal}\n${page}`, /simplified invoice|factura simplificada/i);
  const migrations = await readdir(new URL("../supabase/migrations", import.meta.url));
  assert.equal(migrations.some((name) => name.includes("counter_billing_001")), false);
});

test("13 all locales expose matching counter Billing vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.shopTerminal.labels.invoice, "string");
    assert.equal(typeof messages.billing.settings.autofillNotice, "string");
    assert.equal(typeof messages.billing.settings.missingFields, "string");
    assert.equal(typeof messages.billing.create.counterContext, "string");
    assert.equal(typeof messages.billing.create.customerFiscal.walkInDescription, "string");
    assert.deepEqual(Object.keys(messages.billing.create.customerFiscal), Object.keys(JSON.parse(await source("src/i18n/en/common.json")).billing.create.customerFiscal));
  }
});
