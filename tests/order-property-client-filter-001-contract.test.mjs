import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20261001000100_order_property_client_filter_001.sql";

test("property ownership is immutable without changing editable fields, lifecycle or historical rows", async () => {
  const [sql, original] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260728000100_app_005_customers_properties.sql"),
  ]);
  assert.match(original, /before update on public\.properties\s+for each row execute function public\.protect_property_immutable_fields\(\)/);
  assert.match(sql, /create or replace function public\.protect_property_immutable_fields\(\)[\s\S]*returns trigger/);
  for (const field of ["organization_id", "created_by", "customer_id"]) {
    assert.match(sql, new RegExp(`if new\\.${field} (?:<>|is distinct from) old\\.${field} then\\s+raise exception 'properties\\.${field} cannot be changed'`));
  }
  assert.match(sql, /return new;\s*end;/);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|alter table|create policy|drop policy|grant|revoke|foreign key)\b/i);
  assert.doesNotMatch(sql, /new\.(is_active|name|address_line1|updated_by)\s+(?:<>|is distinct from)\s+old\./);
});

test("new Order eligibility remains optional, active and customer-scoped at the RPC boundary", async () => {
  const [sql, action, queries] = await Promise.all([
    source("supabase/migrations/20260919000300_order_location_integrity_001.sql"),
    source("src/features/orders/server/actions.ts"),
    source("src/features/orders/server/queries.ts"),
  ]);
  const create = sql.slice(sql.indexOf("create or replace function public.create_order("), sql.indexOf("create or replace function public.create_customer_portal_order_request("));
  assert.match(create, /customer\.id = target_customer_id[\s\S]*customer\.organization_id = org_id[\s\S]*customer\.is_active/);
  assert.match(create, /if target_property_id is not null and not exists \([\s\S]*property\.id = target_property_id[\s\S]*property\.customer_id = target_customer_id[\s\S]*property\.organization_id = org_id[\s\S]*property\.is_active[\s\S]*raise exception 'invalid property'/);
  assert.match(action, /target_property_id: optionalDbValue\(input\.propertyId\)/);
  assert.match(queries, /from\("properties"\)[\s\S]*\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("is_active", true\)/);
  assert.match(sql, /property\.customer_id = new\.customer_id/);
});

test("new Order selector filters by customer, clears on change, and allows no property", async () => {
  const form = await source("src/components/orders/OrderForm.tsx");
  const create = form.slice(form.indexOf("{order ? ("), form.indexOf("<span>{text.priority}</span>"));
  assert.match(form, /const visibleProperties = properties\.filter\(\(property\) => property\.customerId === customerId\)/);
  assert.match(create, /setCustomerId\(event\.target\.value\);\s*setPropertyId\(""\)/);
  assert.match(create, /disabled=\{!customerId\}/);
  assert.match(create, /<option value="" \/>/);
  assert.match(create, /visibleProperties\.map/);
  assert.doesNotMatch(create, /\brequired\b/);
});

test("Order edit shows its canonical historical names and does not offer reassignment", async () => {
  const [form, page, actions, queries] = await Promise.all([
    source("src/components/orders/OrderForm.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/edit/page.tsx"),
    source("src/features/orders/server/actions.ts"),
    source("src/features/orders/server/queries.ts"),
  ]);
  const edit = form.slice(form.indexOf("{order ? ("), form.indexOf(") : (", form.indexOf("{order ? (")));
  assert.match(edit, /order\.customerName/);
  assert.match(edit, /order\.propertyId \? order\.propertyName \?\? "-" : "-"/);
  assert.doesNotMatch(edit, /<select|visibleProperties|customers\.map/);
  assert.match(form, /<input name="customerId" type="hidden" value=\{order\.customerId\}/);
  assert.match(form, /<input name="propertyId" type="hidden" value=\{order\.propertyId \?\? ""\}/);
  assert.match(page, /getOrderById\(locale, orderId\)/);
  assert.doesNotMatch(page, /listCustomersForOrder|listPropertiesForCustomer/);
  assert.match(queries, /property:properties!orders_property_same_customer\(name\)/);
  assert.match(queries, /propertyName: relationName\(row\.property\)/);
  const update = actions.slice(actions.indexOf("export async function updateOrderAction("), actions.indexOf("export async function updateOrderAssignmentAction("));
  assert.match(update, /rpc\("update_order_details"/);
  assert.doesNotMatch(update, /target_customer_id|target_property_id/);
});

test("Terminal, Quick Drop and Portal retain their separate property boundaries", async () => {
  const [terminal, quickDrop, portalList, portalRequest, sql] = await Promise.all([
    source("supabase/migrations/20260907000200_terminal_operational_checkout_001.sql"),
    source("supabase/migrations/20260829000600_quick_drop_001a_canonical_intake.sql"),
    source("supabase/migrations/20260823000100_portal_002_1_customer_order_request.sql"),
    source("supabase/migrations/20260823000200_portal_002_1_fix_order_request_rpc.sql"),
    source(migrationPath),
  ]);
  assert.match(terminal, /from public\.create_order\(\s*target_customer_id, null,/);
  assert.match(quickDrop, /from public\.create_order\(\s*target_customer_id,\s*null,/);
  assert.match(portalList, /property\.customer_id = access\.customer_id[\s\S]*property\.is_active/);
  assert.match(portalRequest, /property\.organization_id = portal_org_id[\s\S]*property\.customer_id = portal_customer_id[\s\S]*property\.is_active/);
  assert.doesNotMatch(sql, /create or replace function public\.(submit_shop_terminal_order|create_quick_drop_order|create_customer_portal_order_request)/);
});
