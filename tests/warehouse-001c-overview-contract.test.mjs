import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { filterCurrentStoredOrders, summarizeCurrentWarehouse } from "../src/features/warehouse/overview.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const positions = [
  { id: "p1", code: "A1", name: "Front", locationId: "l1", positionType: "shelf", isActive: true, description: null },
  { id: "p2", code: "B2", name: null, locationId: "l1", positionType: "rack", isActive: false, description: null },
  { id: "p3", code: "C3", name: null, locationId: "l2", positionType: "hanger", isActive: true, description: null },
  { id: "p4", code: "D4", name: null, locationId: "l2", positionType: "other", isActive: false, description: null },
];
const locations = [
  { id: "l1", name: "North", isActive: true },
  { id: "l2", name: "South", isActive: false },
];
const orders = [
  { orderId: "o1", orderNumber: "ORD-101", customerName: "Alice", locationId: "l1", positionId: "p1", packageCount: 2, storageMode: "folded", enteredAt: "2026-09-25T10:00:00Z", productionStatus: "ready" },
  { orderId: "o2", orderNumber: "ORD-102", customerName: "Bob", locationId: "l1", positionId: "p2", packageCount: 3, storageMode: "hanging", enteredAt: "2026-09-25T11:00:00Z", productionStatus: "completed" },
  { orderId: "o3", orderNumber: "ORD-103", customerName: "Carla", locationId: "l2", positionId: "p3", packageCount: 1, storageMode: "mixed", enteredAt: "2026-09-25T12:00:00Z", productionStatus: "packing" },
];
const filters = { query: "", locationId: "", positionId: "", storageMode: "" };

test("current storage totals and position-type grouping use current rows", () => {
  const result = summarizeCurrentWarehouse(positions, locations, orders);
  assert.equal(result.totalOrders, 3);
  assert.equal(result.totalPackages, 6);
  assert.deepEqual(result.ordersByType, { shelf: 1, rack: 1, hanger: 1, cabinet: 0, other: 0 });
  assert.deepEqual(result.positions.find((position) => position.id === "p2"), {
    ...positions[1], locationName: "North", orderCount: 1, packageCount: 3,
  });
  assert.equal(result.positions.find((position) => position.id === "p4")?.orderCount, 0);
  assert.equal(result.positions[0]?.id, "p1");
});

test("cancelled current storage remains in physical totals and has a separate custody count", async () => {
  const cancelled = { ...orders[0], orderId: "cancelled-order", orderNumber: "ORD-C", productionStatus: "cancelled", packageCount: 4 };
  const result = summarizeCurrentWarehouse(positions, locations, [...orders, cancelled]);
  assert.equal(result.totalOrders, 4);
  assert.equal(result.totalPackages, 10);
  assert.equal(result.cancelledOrdersInCustody, 1);
  assert.equal(result.ordersByType.shelf, 2);
  assert.equal(result.positions.find((position) => position.id === "p1")?.packageCount, 6);
  assert.equal(summarizeCurrentWarehouse(positions, locations, orders).cancelledOrdersInCustody, 0);
  assert.ok(filterCurrentStoredOrders([...orders, cancelled], filters).some((order) => order.orderId === cancelled.orderId));

  const [page, query, cancellation] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/warehouse/page.tsx"),
    source("src/features/warehouse/server/overview-queries.ts"),
    source("supabase/migrations/20260913000100_order_pickup_production_gate_001.sql"),
  ]);
  assert.match(page, /order\.productionStatus === "cancelled"/);
  assert.match(page, /statusLabels\[order\.productionStatus\]/);
  assert.match(page, /t\("toReturn"\)/);
  assert.match(page, /overview\.cancelledOrdersInCustody/);
  assert.match(page, /href=\{`\/app\/orders\/\$\{order\.orderId\}`\}/);
  assert.match(query, /await requireOwnerOrManager\(locale\)/);
  assert.match(query, /from\("order_storage"\)/);
  assert.doesNotMatch(query, /neq\("production_status", "cancelled"\)|delete\(/);
  assert.doesNotMatch(cancellation, /delete from public\.order_storage/i);
});

test("order number, customer, location, position and mode filters compose", () => {
  assert.deepEqual(filterCurrentStoredOrders(orders, { ...filters, query: "ord-102" }).map((order) => order.orderId), ["o2"]);
  assert.deepEqual(filterCurrentStoredOrders(orders, { ...filters, query: "ALICE" }).map((order) => order.orderId), ["o1"]);
  assert.deepEqual(filterCurrentStoredOrders(orders, { ...filters, locationId: "l2" }).map((order) => order.orderId), ["o3"]);
  assert.deepEqual(filterCurrentStoredOrders(orders, { ...filters, positionId: "p2" }).map((order) => order.orderId), ["o2"]);
  assert.deepEqual(filterCurrentStoredOrders(orders, { ...filters, storageMode: "mixed" }).map((order) => order.orderId), ["o3"]);
  assert.deepEqual(filterCurrentStoredOrders(orders, { ...filters, query: "bob", locationId: "l2" }), []);
});

test("server reader is owner/manager guarded and every table is tenant scoped", async () => {
  const query = await source("src/features/warehouse/server/overview-queries.ts");
  assert.match(query, /await requireOwnerOrManager\(locale\)/);
  for (const table of ["order_storage", "warehouse_positions", "locations", "orders"])
    assert.match(query, new RegExp(`from\\("${table}"\\)[\\s\\S]*?\\.eq\\("organization_id", organizationId\\)`));
  assert.match(query, /\.range\(offset, offset \+ PAGE_SIZE - 1\)/);
  assert.doesNotMatch(query, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test("operational route, order links and role-based navigation are isolated", async () => {
  const [page, nav, ordersPage] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/warehouse/page.tsx"),
    source("src/components/dashboard/AppNavigation.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/page.tsx"),
  ]);
  assert.match(page, /href=\{`\/app\/orders\/\$\{order\.orderId\}`\}/);
  assert.match(page, /href=\{`\/app\/warehouse\?position=\$\{encodeURIComponent\(position\.id\)\}#stored-orders`\}/);
  assert.match(page, /name="q"/);
  for (const name of ["location", "position", "mode"]) assert.match(page, new RegExp(`name="${name}"`));
  assert.match(nav, /const isControlRole = role === "owner" \|\| role === "manager"/);
  const controlNav = nav.slice(nav.indexOf("const navigationGroups"), nav.indexOf("    : [", nav.indexOf("const navigationGroups")));
  assert.match(controlNav, /href: "\/app\/warehouse"/);
  assert.doesNotMatch(nav.slice(nav.indexOf("    : [", nav.indexOf("const navigationGroups")), nav.indexOf("  const navigationItems")), /href: "\/app\/warehouse"/);
  assert.match(ordersPage, /canViewWarehouse = access\.membership\.role === "owner" \|\| access\.membership\.role === "manager"/);
  assert.doesNotMatch(page, /\/app\/settings\/warehouse/);
});

test("five locales have the same overview and navigation keys", async () => {
  const files = await Promise.all(["en", "it", "es", "fr", "de"].map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`))));
  const baseline = JSON.stringify(Object.keys(files[0].warehouseOverview).sort());
  const types = JSON.stringify(Object.keys(files[0].warehouseOverview.types).sort());
  const modes = JSON.stringify(Object.keys(files[0].warehouseOverview.modes).sort());
  for (const file of files) {
    assert.equal(typeof file.auth.dashboard.warehouse, "string");
    assert.equal(JSON.stringify(Object.keys(file.warehouseOverview).sort()), baseline);
    assert.equal(JSON.stringify(Object.keys(file.warehouseOverview.types).sort()), types);
    assert.equal(JSON.stringify(Object.keys(file.warehouseOverview.modes).sort()), modes);
    assert.ok(file.warehouseOverview.cancelledInCustody);
    assert.ok(file.warehouseOverview.toReturn);
  }
});
