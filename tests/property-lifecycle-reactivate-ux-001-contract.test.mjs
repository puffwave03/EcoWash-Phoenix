import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("property detail offers exactly the action for its current lifecycle state", async () => {
  const page = await source("src/app/[locale]/app/(dashboard)/properties/[propertyId]/page.tsx");
  const lifecycle = page.slice(page.indexOf("{property.isActive ? ("), page.indexOf("</div>", page.indexOf("{property.isActive ? (") + 1));

  assert.match(lifecycle, /action=\{deactivatePropertyAction\.bind\(null, locale, property\.id\)\}/);
  assert.match(lifecycle, /label=\{t\("deactivate"\)\}/);
  assert.match(lifecycle, /\) : \(\s*<DeactivateButton[\s\S]*action=\{reactivatePropertyAction\.bind\(null, locale, property\.id\)\}/);
  assert.match(lifecycle, /label=\{t\("reactivate"\)\}/);
  assert.match(lifecycle, /confirmLabel=\{t\("confirmReactivate"\)\}/);
  assert.match(lifecycle, /pendingLabel=\{t\("reactivating"\)\}/);
});

test("both lifecycle actions retain authenticated tenant scope and refresh property and customer views", async () => {
  const actions = await source("src/features/customers/server/actions.ts");
  const lifecycle = actions.slice(actions.indexOf("async function setPropertyActive("));

  assert.match(lifecycle, /const \{ membership, user \} = await requireMembership\(locale\)/);
  assert.match(lifecycle, /\.from\("properties"\)[\s\S]*\.update\(\{ is_active: isActive, updated_by: user\.id \}\)[\s\S]*\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", propertyId\)/);
  assert.match(lifecycle, /deactivatePropertyAction[\s\S]*setPropertyActive\(locale, propertyId, false\)/);
  assert.match(lifecycle, /reactivatePropertyAction[\s\S]*setPropertyActive\(locale, propertyId, true\)/);
  assert.match(lifecycle, /revalidateCustomers\(locale\)/);
  assert.match(lifecycle, /revalidatePath\(`\/\$\{locale\}\/app\/properties`\)/);
  assert.match(lifecycle, /revalidatePath\(`\/\$\{locale\}\/app\/properties\/\$\{propertyId\}`\)/);
  assert.match(lifecycle, /revalidatePath\(`\/\$\{locale\}\/app\/customers\/\$\{data\.customer_id\}`\)/);
});

test("ordinary editing preserves inactive state and property customer ownership stays immutable", async () => {
  const [form, actions, migration] = await Promise.all([
    source("src/components/properties/PropertyForm.tsx"),
    source("src/features/customers/server/actions.ts"),
    source("supabase/migrations/20261001000100_order_property_client_filter_001.sql"),
  ]);
  const update = actions.slice(actions.indexOf("export async function updatePropertyAction("), actions.indexOf("async function setPropertyActive("));

  assert.match(form, /name="isActive" type="hidden" value=\{property\?\.isActive === false \? "false" : "true"\}/);
  assert.match(update, /is_active: input\.isActive/);
  assert.doesNotMatch(update, /customer_id:/);
  assert.match(migration, /new\.customer_id is distinct from old\.customer_id[\s\S]*properties\.customer_id cannot be changed/);
});

test("all five locales supply confirmation, pending and action labels", async () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const key of ["deactivate", "deactivating", "confirmDeactivate", "reactivate", "reactivating", "confirmReactivate"]) {
      assert.ok(messages.properties[key]?.trim(), `${locale}.properties.${key}`);
    }
  }
});
