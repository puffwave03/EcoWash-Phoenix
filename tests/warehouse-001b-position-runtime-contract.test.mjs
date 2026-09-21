import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const pagePath = "src/app/[locale]/app/(dashboard)/settings/warehouse/page.tsx";
const queriesPath = "src/features/warehouse/server/queries.ts";

test("Warehouse settings render loads positions through a server-authorized tenant reader", async () => {
  const [page, queries] = await Promise.all([source(pagePath), source(queriesPath)]);
  const list = queries.slice(
    queries.indexOf("export async function listWarehousePositions"),
    queries.indexOf("export async function getOrderStorageAssignment"),
  );

  assert.match(page, /await requireOwnerOrManager\(locale\)/);
  assert.match(page, /listWarehouseLocations\(locale\)/);
  assert.match(page, /listWarehousePositions\(locale\)/);
  assert.match(list, /requireMembership\(locale\)/);
  assert.match(list, /createSupabaseAdminClient\(\)/);
  assert.match(list, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.doesNotMatch(list, /createSupabaseServerClient\(\)/);
});

test("Warehouse settings translation namespace exists in all five locales", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  const messages = await Promise.all(locales.map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`))));
  for (const message of messages) assert.ok(message.warehousePositions?.labels);

  assert.match(await source(pagePath), /namespace: "common\.warehousePositions"/);
});

test("runtime fix changes no schema, mutation, or Warehouse scope", async () => {
  const queries = await source(queriesPath);
  assert.doesNotMatch(queries, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(queries, /production_status|pickups|deliveries|payments/);
});
