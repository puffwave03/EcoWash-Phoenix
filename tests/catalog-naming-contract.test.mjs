import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("canonical service name is editable in the existing Owner/Manager experience", async () => {
  const [page, form, action] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/services/[serviceId]/edit/page.tsx"),
    source("src/components/services/ServiceForm.tsx"),
    source("src/features/services/server/actions.ts"),
  ]);
  assert.match(page, /requireOwnerOrManager\(locale\)/);
  assert.match(page, /updateServiceAction\.bind\(null, locale, serviceId\)/);
  assert.match(form, /defaultValue=\{service\?\.name \?\? ""\}/);
  assert.match(form, /maxLength=\{160\}[\s\S]*name="name" required/);
  assert.match(action, /name: input\.name/);
});

test("name validation trims Unicode, rejects empty values and rejects overlength without silent truncation", async () => {
  const validation = await source("src/features/services/validation.ts");
  assert.match(validation, /String\(formData\.get\("name"\) \?\? ""\)\.trim\(\)/);
  assert.match(validation, /if \(!name\) fieldErrors\.name = "required"/);
  assert.match(validation, /name\.length > 160/);
  assert.doesNotMatch(validation, /requiredName[\s\S]*slice\(/);
});

test("a name-only save keeps identity fields and the active price records untouched", async () => {
  const action = await source("src/features/services/server/actions.ts");
  assert.match(action, /serviceFieldsUnchanged/);
  assert.match(action, /submittedPriceAlreadyExists/);
  assert.match(action, /if \(nameOnlyUpdate\)[\s\S]*redirect/);
  const renameBranch = action.slice(action.indexOf("if (nameOnlyUpdate)"), action.indexOf("await supabase", action.indexOf("if (nameOnlyUpdate)")));
  assert.doesNotMatch(renameBranch, /service_prices/);
  assert.match(action, /\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", serviceId\)[\s\S]*\.select\("id"\)/);
});

test("live catalog consumers read the canonical current service name", async () => {
  const [catalog, terminal, portal, orders] = await Promise.all([
    source("src/features/catalog-admin/server/queries.ts"),
    source("src/features/shop-terminal/server/queries.ts"),
    source("src/features/portal/server/queries.ts"),
    source("src/features/services/server/queries.ts"),
  ]);
  assert.match(catalog, /name: service\.name/);
  assert.match(terminal, /name: service\.name/);
  assert.match(portal, /name: service\.name/);
  assert.match(orders, /id, code, name, description/);
});

test("new order items snapshot the current name while historical order and invoice descriptions remain stored", async () => {
  const [ordersMigration, billingMigration, action] = await Promise.all([
    source("supabase/migrations/20260728000200_app_006_orders_workflow.sql"),
    source("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql"),
    source("src/features/services/server/actions.ts"),
  ]);
  assert.match(ordersMigration, /final_description := coalesce\(final_description, service_name\)/);
  assert.match(ordersMigration, /insert into public\.order_items[\s\S]*final_description/);
  assert.match(billingMigration, /insert into public\.invoice_items[\s\S]*item_row\.description/);
  assert.doesNotMatch(action, /order_items|invoice_items/);
});

test("permissions and tenant isolation remain authoritative and no bulk rename exists", async () => {
  const [action, policies] = await Promise.all([
    source("src/features/services/server/actions.ts"),
    source("supabase/migrations/20260728000200_app_006_orders_workflow.sql"),
  ]);
  assert.match(action, /requireOwnerOrManager\(locale\)/);
  assert.match(action, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(policies, /services_update_manager[\s\S]*array\['owner', 'manager'\]/);
  assert.doesNotMatch(action, /updateMany|bulk.*name|order_items.*update|invoice_items.*update/i);
});
