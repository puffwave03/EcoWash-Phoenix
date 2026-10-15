import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SALES_WORKSPACES,
  legacyDraftKey,
  parseWorkspace,
  workspaceCustomerKey,
  workspaceDraftKey,
  workspaceNamespace,
  workspaceOccupied,
  workspaceSelectionKey,
  workspaceWalkInKey,
} from "../src/features/shop-terminal/workspace-storage.ts";

const source = () => readFile(new URL("../src/components/shop-terminal/ShopTerminalWorkspace.tsx", import.meta.url), "utf8");
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("five fixed sales workspaces have separate customer, walk-in and draft identities", () => {
  assert.deepEqual(SALES_WORKSPACES, [1, 2, 3, 4, 5]);
  const namespace = workspaceNamespace("tenant-a", "location-a");
  assert.equal(new Set(SALES_WORKSPACES.map((id) => workspaceDraftKey(namespace, id))).size, 5);
  assert.equal(new Set(SALES_WORKSPACES.map((id) => workspaceCustomerKey(namespace, id))).size, 5);
  assert.equal(new Set(SALES_WORKSPACES.map((id) => workspaceWalkInKey(namespace, id))).size, 5);
  assert.equal(parseWorkspace("1"), 1);
  assert.equal(parseWorkspace("5"), 5);
  assert.equal(parseWorkspace("6"), null);
});

test("two occasional drafts with the same technical customer remain independent and resumable", () => {
  const browser = storage();
  const namespace = workspaceNamespace("tenant-a", "location-a");
  const sharedId = "WALKIN-SHARED-UUID";
  browser.setItem(workspaceDraftKey(namespace, 1), JSON.stringify([[sharedId, { items: [{ serviceId: "service-a", quantity: 2 }] }]]));
  browser.setItem(workspaceDraftKey(namespace, 2), JSON.stringify([[sharedId, { items: [{ serviceId: "service-b", quantity: 1 }] }]]));
  browser.setItem(workspaceSelectionKey(namespace), "1");
  browser.setItem(workspaceSelectionKey(namespace), "2");
  browser.setItem(workspaceSelectionKey(namespace), "1");
  assert.equal(parseWorkspace(browser.getItem(workspaceSelectionKey(namespace))), 1);
  assert.equal(JSON.parse(browser.getItem(workspaceDraftKey(namespace, 1)))[0][1].items[0].serviceId, "service-a");
  assert.equal(JSON.parse(browser.getItem(workspaceDraftKey(namespace, 2)))[0][1].items[0].serviceId, "service-b");
  browser.removeItem(workspaceDraftKey(namespace, 1));
  assert.equal(browser.getItem(workspaceDraftKey(namespace, 1)), null);
  assert.equal(JSON.parse(browser.getItem(workspaceDraftKey(namespace, 2)))[0][1].items[0].serviceId, "service-b");
});

test("browser refresh status and tenant/location scopes are deterministic", () => {
  const browser = storage();
  const first = workspaceNamespace("tenant-a", "location-a");
  const otherTenant = workspaceNamespace("tenant-b", "location-a");
  const otherLocation = workspaceNamespace("tenant-a", "location-b");
  browser.setItem(workspaceCustomerKey(first, 3), JSON.stringify({ id: "customer-a" }));
  browser.setItem(workspaceSelectionKey(first), "3");
  assert.equal(parseWorkspace(browser.getItem(workspaceSelectionKey(first))), 3);
  assert.equal(workspaceOccupied(browser, first, 3), true);
  assert.equal(workspaceOccupied(browser, first, 4), false);
  assert.equal(workspaceOccupied(browser, otherTenant, 3), false);
  assert.equal(workspaceOccupied(browser, otherLocation, 3), false);
});

test("legacy customer-keyed drafts cannot collide with the new workspace store", () => {
  const browser = storage();
  const namespace = workspaceNamespace("tenant-a", null);
  browser.setItem(legacyDraftKey("tenant-a", null), JSON.stringify([["shared-id", { items: ["old"] }]]));
  assert.equal(SALES_WORKSPACES.every((id) => !workspaceOccupied(browser, namespace, id)), true);
  assert.notEqual(legacyDraftKey("tenant-a", null), workspaceDraftKey(namespace, 1));
});

test("a single active location supplies a stable namespace even before opening the till", async () => {
  const [page, queries, ui] = await Promise.all([
    readFile(new URL("../src/app/[locale]/app/(dashboard)/shop/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/shop-terminal/server/queries.ts", import.meta.url), "utf8"),
    source(),
  ]);
  assert.match(queries, /locationId: location\?\.id \?\? null/);
  assert.match(page, /draftLocationId=\{operationalOptions\.locationId\}/);
  assert.match(ui, /workspaceNamespace\(organizationId, draftLocationId\)/);
  assert.match(ui, /disabled=\{busy \|\| !draftLocationId\}/);
  assert.match(ui, /legacyDraftKey\(organizationId, null\)/);
});

test("Terminal wires explicit selection, confirmed discard, refresh hydration and per-workspace walk-in resume", async () => {
  const ui = await source();
  assert.match(ui, /SALES_WORKSPACES\.map\(\(workspace\) => <button/);
  assert.match(ui, /saveActiveDraftRef\.current && !saveActiveDraftRef\.current\(\)/);
  assert.match(ui, /window\.confirm\(text\.workspaceDiscardConfirm\)/);
  assert.match(ui, /inspectWorkspaceDiscard\(storage, namespace, workspace/);
  assert.match(ui, /for \(const key of inspected\.keys\) storage\.removeItem\(key\)/);
  assert.match(ui, /const loaded = loadCustomerDrafts\(draftStorageKey\)[\s\S]*if \(loaded\.kind !== "loaded" \|\|[\s\S]*customerDraftsRef\.current = loaded\.drafts/);
  assert.match(ui, /const storedCustomer = readStoredCustomer\(activeCustomerStorageKey\)/);
  assert.match(ui, /walkInCustomer \? selectCustomer\(walkInCustomer\.id, walkInCustomer\)/);
  assert.match(ui, /draftStorageKey = workspaceDraftKey\(namespace, workspace\)/);
  assert.doesNotMatch(ui, /loadCustomerDrafts\(legacyDraftKey/);
});

test("draft operations do not submit orders or payments and failed submission does not clear the slot", async () => {
  const ui = await source();
  const choose = ui.slice(ui.indexOf("function chooseWorkspace"), ui.indexOf("function discardWorkspace"));
  const discard = ui.slice(ui.indexOf("function discardWorkspace"), ui.indexOf("const workspaceButtons"));
  const success = ui.slice(ui.indexOf("const submittedCustomerId = submitState.result?.customerId"), ui.indexOf("useEffect(() => {\n    if (!isMobileCartOpen)"));
  assert.doesNotMatch(choose + discard, /actions\.submit|record_pos_payment|create_order|payments/);
  assert.match(success, /if \(!submittedCustomerId \|\| !submitState\.result\?\.orderId/);
  assert.match(ui, /disabled=\{busy\}/);
  assert.match(ui, /onBusyChange\(isSubmitting \|\| isCreatingCustomer\)/);
  assert.match(ui, /if \(attemptRef\.current\) return true/);
});
