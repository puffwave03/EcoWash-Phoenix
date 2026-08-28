import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function body(sql, name, next) {
  const start = sql.indexOf(`create function public.${name}`);
  const end = next ? sql.indexOf(`create function public.${next}`, start) : sql.length;
  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return sql.slice(start, end);
}

test("1 Portal support navigation remains inside the authenticated Portal", async () => {
  const shell = await source("src/components/portal/CustomerPortalShell.tsx");

  assert.match(shell, /href: "\/portal\/support"/);
  assert.match(shell, /match: "\/portal\/support"/);
  assert.doesNotMatch(shell, /href: "\/contact"/);
});

test("2 Portal support route is customer-authenticated and tenant-scoped", async () => {
  const page = await source("src/app/[locale]/portal/support/page.tsx");

  assert.match(page, /requireCustomerPortalAccess\(locale\)/);
  assert.match(page, /getTenantBranding\(access\.organizationId\)/);
  assert.match(page, /<CustomerPortalShell/);
  assert.match(page, /data-portal-support-page/);
  assert.doesNotMatch(page, /SiteFrame|\/contact|marketing/i);
});

test("3 support page exposes only configured tenant contacts and hides missing fields", async () => {
  const page = await source("src/app/[locale]/portal/support/page.tsx");

  for (const field of ["brand.name", "support.email", "support.phone", "support.whatsapp", "support.address"]) {
    assert.match(page, new RegExp(`branding\\.${field.replace(".", "\\.")}`));
  }
  assert.match(page, /branding\.support\.email \? \(/);
  assert.match(page, /phoneHref \? \(/);
  assert.match(page, /whatsappNumber \? \(/);
  assert.match(page, /!hasContacts \?/);
  assert.doesNotMatch(page, /websiteUrl/);
});

test("4 Portal support copy exists in all five supported locales", async () => {
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const key of ["eyebrow", "title", "description", "address", "noContacts"]) {
      assert.equal(typeof messages.portal.support[key], "string", `${locale}.${key}`);
    }
  }
});

test("5 POS navigation has one canonical item and mutually exclusive role placement", async () => {
  const navigation = await source("src/components/dashboard/AppNavigation.tsx");

  assert.equal((navigation.match(/\{ href: "\/app\/pos", label: text\.pos, match: "\/app\/pos" \}/g) ?? []).length, 1);
  assert.equal((navigation.match(/\.\.\.\(posNavigationItem \? \[posNavigationItem\] : \[\]\)/g) ?? []).length, 2);
  assert.match(navigation, /const navigationGroups = isControlRole[\s\S]*?posNavigationItem[\s\S]*?: \[/);
});

test("6 POS item requires both capability and entitlement", async () => {
  const navigation = await source("src/components/dashboard/AppNavigation.tsx");

  assert.match(navigation, /const posNavigationItem = canUse\("pos"\) && entitlementEnabled\(entitlements, FEATURES\.pos\)/);
  assert.match(navigation, /role === "owner" \|\| role === "manager"/);
});

test("7 active-session read model disambiguates the tenant-safe location relationship", async () => {
  const queries = await source("src/features/pos/server/queries.ts");

  assert.match(queries, /location:locations!pos_sessions_location_same_org\(name\)/);
  assert.doesNotMatch(queries, /location:locations\(name\)/);
  assert.match(queries, /\.eq\("organization_id", membership\.organization\.id\)\.eq\("status", "open"\)/);
});

test("8 active-session query errors cannot degrade into a false Closed state", async () => {
  const queries = await source("src/features/pos/server/queries.ts");
  const currentSession = queries.slice(
    queries.indexOf("export async function getCurrentPosSession"),
    queries.indexOf("export async function getPosSessionSummary"),
  );

  assert.match(currentSession, /if \(error\) \{[\s\S]*throw new Error/);
  assert.match(currentSession, /return data\?\.\[0\] \? mapSession\(data\[0\]\) : null/);
});

test("9 POS workspace shows an existing session and never renders Open till beside it", async () => {
  const workspace = await source("src/components/pos/PosWorkspace.tsx");

  assert.match(workspace, /session \? text\.session\.open : text\.session\.closed/);
  assert.match(workspace, /session && summary \? \([\s\S]*\) : <OpenSessionForm/);
  assert.match(workspace, /value=\{session\?\.id \?\? ""\}/);
});

test("10 existing POS safety keeps duplicate-open, assignment and tenant guards", async () => {
  const migration = await source("supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql");
  const open = body(migration, "open_pos_session", "record_pos_payment");
  const payment = body(migration, "record_pos_payment", "record_pos_refund");

  assert.match(open, /pos_session_already_open/);
  assert.match(migration, /pos_sessions_one_open_till_idx[\s\S]*where status = 'open'/);
  assert.match(payment, /target_session\.opened_by <> auth\.uid\(\)[\s\S]*pos_session_not_assigned/);
  assert.match(payment, /target_session\.organization_id = org_id|session\.organization_id = org_id/);
});

test("11 order discount is monetary and must not be percentage-converted", async () => {
  const [migration, page, actions] = await Promise.all([
    source("supabase/migrations/20260728000200_app_006_orders_workflow.sql"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/orders/server/actions.ts"),
  ]);
  const discount = body(migration, "update_order_discount", "update_order_details");
  const action = actions.slice(
    actions.indexOf("export async function updateOrderDiscountAction"),
  );

  assert.match(migration, /discount_amount numeric\(12,2\)/);
  assert.match(discount, /target_discount_amount > current_subtotal/);
  assert.match(discount, /total = current_subtotal - round\(target_discount_amount, 2\)/);
  assert.match(page, /name="discountAmount"/);
  assert.match(action, /target_discount_amount: Math\.round\(discount \* 100\) \/ 100/);
  assert.doesNotMatch(`${page}\n${action}`, /discountPercent|discountRate|percentagePoints/);
});
