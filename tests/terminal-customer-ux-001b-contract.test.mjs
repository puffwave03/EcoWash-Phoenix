import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql";

test("1 occasional visits resolve one tenant-scoped shared customer", async () => {
  const [action, sql] = await Promise.all([
    source("src/features/shop-terminal/server/actions.ts"),
    source(migrationPath),
  ]);
  assert.match(action, /rpc\("resolve_shared_walk_in_customer"\)/);
  assert.doesNotMatch(action, /`WALKIN-\$\{/);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /require_shop_terminal_access\(org_id\)/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*WALKIN-SHARED/);
  assert.match(sql, /on conflict \(organization_id, customer_code\)[\s\S]*do nothing/);
  assert.doesNotMatch(sql, /resolve_shared_walk_in_customer\([^)]*organization/i);
});

test("2 shared visitor data stays on the order and registered orders reject snapshots", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /add column walk_in_name text/);
  assert.match(sql, /char_length\(walk_in_name\) between 1 and 160/);
  assert.match(sql, /add column walk_in_phone text/);
  assert.match(sql, /char_length\(walk_in_phone\) between 1 and 40/);
  assert.match(sql, /set walk_in_name = normalized_walk_in_name,[\s\S]*walk_in_phone = normalized_walk_in_phone/);
  assert.match(sql, /selected_customer_code is distinct from 'WALKIN-SHARED'[\s\S]*normalized_walk_in_name is not null or normalized_walk_in_phone is not null/);
  assert.match(sql, /new\.customer_code = 'WALKIN-SHARED'[\s\S]*new\.phone is not null/);
});

test("3 Terminal picker hides every technical or legacy walk-in", async () => {
  const [query, workspace] = await Promise.all([
    source("src/features/shop-terminal/server/queries.ts"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
  ]);
  assert.match(query, /customer_code\.not\.like\.WALKIN-%/);
  assert.match(workspace, /!customer\.isWalkIn/);
  assert.match(workspace, /required=\{customerMode === "regular"\}/);
  assert.match(workspace, /customerMode === "regular" \? <label[\s\S]*customerEmail/);
});

test("4 shared walk-in remains on the general catalog while segment eligibility stays authoritative", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /'WALKIN-SHARED', 'individual', 'Walk-in customer'[\s\S]*null, null, true/);
  assert.match(sql, /new\.catalog_segment_id is not null/);
  assert.match(sql, /public\.shop_terminal_service_is_eligible\([\s\S]*target_customer_id[\s\S]*item->>'serviceId'/);
  assert.match(sql, /raise exception 'shop_terminal_service_not_eligible'/);
});

test("5 Terminal and Quick Drop fingerprints bind order-local identity", async () => {
  const [sql, quickDropFoundation] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260829000600_quick_drop_001a_canonical_intake.sql"),
  ]);
  assert.equal((sql.match(/'walkInName', normalized_walk_in_name/g) ?? []).length, 2);
  assert.equal((sql.match(/'walkInPhone', normalized_walk_in_phone/g) ?? []).length, 2);
  assert.match(sql, /'kind', 'quick_drop'/);
  assert.match(sql, /production_status = 'received'/);
  assert.match(sql, /jsonb_build_object\('source', 'quick_drop'\)/);
  assert.match(quickDropFoundation, /quick_drop_detail_required/);
});

test("6 Quick Drop forwards and reads the shared order snapshot", async () => {
  const [panel, action, query] = await Promise.all([
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
    source("src/features/quick-drop/server/actions.ts"),
    source("src/features/quick-drop/server/queries.ts"),
  ]);
  assert.match(panel, /if \(customer\.isWalkIn\)[\s\S]*walkInName[\s\S]*walkInPhone/);
  assert.match(action, /target_walk_in_name: walkInName \|\| null/);
  assert.match(action, /target_walk_in_phone: walkInPhone \|\| null/);
  assert.match(query, /walk_in_name, walk_in_phone/);
});

test("7 shared customer fiscal edits and invoices are rejected server-side", async () => {
  const [sql, actions, queries, panel] = await Promise.all([
    source(migrationPath),
    source("src/features/billing/server/actions.ts"),
    source("src/features/billing/server/queries.ts"),
    source("src/components/billing/BillingCustomerFiscalPanel.tsx"),
  ]);
  assert.match(sql, /invoices_prevent_shared_walk_in/);
  assert.match(sql, /billing_registered_customer_required/);
  assert.match(actions, /customer_code === "WALKIN-SHARED"/);
  assert.match(queries, /customer_code !== "WALKIN-SHARED"/);
  assert.match(panel, /context\.isSharedWalkIn[\s\S]*registeredCustomerRequired/);
});

test("8 legacy walk-ins are preserved and shared identity presentation uses the order snapshot", async () => {
  const [sql, orderQuery, printQuery, terminalQuery] = await Promise.all([
    source(migrationPath),
    source("src/features/orders/server/queries.ts"),
    source("src/features/printing/server/queries.ts"),
    source("src/features/shop-terminal/server/queries.ts"),
  ]);
  assert.doesNotMatch(sql, /(?:delete|update)\s+(?:from\s+)?public\.customers/i);
  assert.doesNotMatch(sql, /update\s+public\.orders[\s\S]*where[\s\S]*customer_code\s+like/i);
  assert.match(orderQuery, /row\.walk_in_name \|\| occasionalCustomer/);
  assert.match(terminalQuery, /order\.walk_in_name \?\?[\s\S]*occasionalCustomer/);
  assert.match(printQuery, /order\.isSharedWalkIn \? order\.walkInPhone/);
});

test("9 all supported locales explain that invoicing requires a registered customer", async () => {
  for (const locale of ["es", "it", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.billing.create.customerFiscal.registeredCustomerRequired, "string");
    assert.ok(messages.billing.create.customerFiscal.registeredCustomerRequired.length > 0);
  }
});
