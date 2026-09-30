import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
const section = page.slice(page.indexOf('<SectionShell id="warehouse-storage"'), page.indexOf('<SectionShell id="logistics"'));

test("real current storage keeps the existing assignment panel", () => {
  assert.match(section, /storageAssignment \|\| \(logistics\.delivery\?\.status !== "in_progress" && logistics\.delivery\?\.status !== "completed"\) \? <OrderStoragePanel/);
  assert.match(section, /assignment=\{storageAssignment\}[\s\S]*positions=\{activeWarehousePositions\}/);
});

test("departed delivery shows distinct read-only transit and delivered custody states", () => {
  const callout = section.slice(section.indexOf("/> : ("), section.indexOf("<WarehouseMovementHistory"));
  assert.match(callout, /logistics\.delivery\.status === "in_progress" \? "inDeliveryTitle" : "deliveredTitle"/);
  assert.match(callout, /logistics\.delivery\.status === "in_progress" \? "inDeliveryDescription" : "deliveredDescription"/);
  assert.doesNotMatch(callout, /OrderStoragePanel|positionCode|positionName|warehousePosition|positions=|assignment=/);
});

test("current custody and historical movement remain separate in the same authorized section", () => {
  assert.match(page, /\{canManageAssignments \? \([\s\S]*<SectionShell id="warehouse-storage" title=\{storageT\("title"\)\}>/);
  assert.match(section, /\)\}\s*<WarehouseMovementHistory/);
  assert.match(section, /history=\{warehouseMovements\}/);
});

test("all five locales use a neutral section title and matching custody keys", () => {
  const keys = ["title", "inDeliveryTitle", "inDeliveryDescription", "deliveredTitle", "deliveredDescription"];
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const storage = JSON.parse(read(`src/i18n/${locale}/common.json`)).orderStorage;
    for (const key of keys) assert.ok(storage[key], `${locale}: ${key}`);
    assert.doesNotMatch(storage.title, /Deposito in magazzino|Warehouse storage|Stockage en entrepôt|Lagerzuordnung|^Almacenamiento$/);
  }
});
