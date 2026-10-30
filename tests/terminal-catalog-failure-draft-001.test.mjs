import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { terminal, nodes, content, button, labels, labelsFor, customer, service, draftKey, deferred } from "./helpers/shop-terminal-harness.mjs";

const customerB = { ...customer, id: "customer-b", name: "B" };
const success = { segmentName: null, services: [service] };
const settle = () => new Promise(setImmediate);
const storedDraft = (ui, key = draftKey, id = customer.id) => new Map(JSON.parse(ui.storage.getItem(key))).get(id);
function choose(ui, name) {
  let tree = ui.render();
  if (!button(tree, name)) {
    button(tree, labels.changeCustomer).props.onClick();
    tree = ui.render();
  }
  assert.ok(button(tree, name), `Missing customer ${name}`);
  button(tree, name).props.onClick();
}
function persist(ui) {
  ui.render();
  ui.runEffect("customerDraftsRef.current.set(customerId");
}
function sale(options) {
  const ui = terminal(options);
  ui.props.customers = [customer, customerB];
  ui.props.productionAssignments = [{ id: "staff-a", label: "Staff" }];
  ui.props.deliveryAssignments = [{ id: "staff-a", label: "Staff" }];
  ui.props.actions.loadDeliveryOptions = async () => ({ billing: null, properties: [] });
  ui.state.set("customers", [customer, customerB]);
  ui.state.set("recentCustomers", [customer, customerB]);
  ui.state.set("cart", [{ quantity: 3, service }]);
  ui.state.set("customerNotes", "Customer note");
  ui.state.set("internalNotes", "Internal note");
  ui.state.set("discount", 2);
  ui.state.set("cardReference", "Card reference");
  ui.state.set("showSplitPayment", true);
  ui.state.set("splitCash", "1");
  ui.state.set("splitCard", "2");
  ui.state.set("productionAssigneeId", "staff-a");
  ui.render();
  ui.state.set("delivery", { ...ui.state.get("delivery"), requested: true, assignedTo: "staff-a", notes: "Delivery note", addressLine1: "Street 1", scheduledAt: "2026-10-17T12:00" });
  persist(ui);
  ui.props.actions.loadServices = async () => success;
  return ui;
}
async function failedReturn(ui) {
  choose(ui, "B");
  await settle();
  ui.props.actions.loadServices = async () => { throw Error("Catalog unavailable"); };
  choose(ui, "A");
  const before = ui.storage.getItem(draftKey);
  await settle();
  return before;
}

for (const walkIn of [false, true]) test(`A→B→A failure preserves the complete persisted draft; walk-in: ${walkIn}`, async () => {
  const ui = sale();
  if (walkIn) {
    ui.state.set("customers", [{ ...customer, isWalkIn: true }, customerB]);
    ui.state.set("walkInCustomer", { ...customer, isWalkIn: true });
  }
  const original = JSON.parse(JSON.stringify(storedDraft(ui)));
  const before = await failedReturn(ui);
  persist(ui);
  assert.equal(ui.state.get("catalogStatus"), "error");
  assert.equal(ui.refs.get("catalogCustomerRef").current, null);
  assert.equal(ui.storage.getItem(draftKey), before);
  assert.deepEqual(storedDraft(ui), original);
  const tree = ui.render();
  assert.ok(content(tree).includes(labels.catalogLoadError));
  assert.ok(!content(tree).includes(labels.emptyCatalog));
  assert.ok(button(tree, labels.retryCatalog));
  // Workspace switching saves the existing map instead of the empty visible cart.
  ui.runEffect("onRegisterSave(saveCurrentCustomerDraft)");
  assert.equal(ui.calls.save(), true);
  assert.equal(ui.storage.getItem(draftKey), before);
});

test("explicit retry restores the original draft using fresh server catalog data", async () => {
  const ui = sale();
  const original = storedDraft(ui);
  await failedReturn(ui);
  let loads = 0;
  const retry = deferred();
  ui.props.actions.loadServices = () => { loads++; return retry.promise; };
  button(ui.render(), labels.retryCatalog).props.onClick();
  assert.equal(ui.state.get("catalogStatus"), "loading");
  assert.equal(button(ui.render(), labels.retryCatalog), undefined);
  persist(ui);
  assert.deepEqual(storedDraft(ui), original);
  retry.resolve({ segmentName: "Fresh segment", services: [{ ...service, amount: 12 }] });
  await settle();
  assert.equal(loads, 1);
  assert.equal(ui.state.get("catalogStatus"), "ready");
  assert.equal(ui.state.get("cart")[0].quantity, 3);
  assert.equal(ui.state.get("cart")[0].service.amount, 12);
  assert.equal(ui.state.get("segmentName"), "Fresh segment");
  persist(ui);
  assert.deepEqual(storedDraft(ui), original);
});

for (const services of [[], [{ ...service, id: "new-service" }]]) test(`successful catalog reconciles genuinely unavailable services; empty: ${services.length === 0}`, async () => {
  const ui = sale();
  choose(ui, "B"); await settle();
  ui.props.actions.loadServices = async () => ({ segmentName: null, services });
  choose(ui, "A"); await settle();
  const tree = ui.render();
  assert.equal(ui.state.get("catalogStatus"), "ready");
  assert.equal(ui.state.get("cart").length, 0);
  assert.ok(!content(tree).includes(labels.catalogLoadError));
  assert.equal(content(tree).includes(labels.emptyCatalog), services.length === 0);
  persist(ui);
  assert.deepEqual(storedDraft(ui).items, []);
});

test("catalog pending or failed blocks checkout and creates no submission identity", async () => {
  const ui = sale();
  const request = deferred();
  ui.props.actions.loadServices = () => request.promise;
  choose(ui, "B");
  for (const status of ["loading", "error"]) {
    if (status === "error") { request.reject(Error("Network unavailable")); await settle(); }
    const tree = ui.render();
    const form = nodes(tree).find((node) => node.type === "form" && node.props.onSubmit?.name === "prepareSubmission");
    assert.equal(nodes(form).find((node) => node.type === "fieldset").props.disabled, true);
    const event = { preventDefault() { this.prevented = true; } };
    form.props.onSubmit(event);
    assert.equal(event.prevented, true);
    assert.equal(ui.storage.getItem("diagnostic:1:submission"), null);
    assert.equal(ui.calls.submit.length, 0);
    assert.equal(ui.refs.get("attemptRef").current, null);
  }
});

test("refresh after catalog failure reloads and restores saved items", async () => {
  const storageValues = new Map();
  const ui = sale({ storageValues });
  await failedReturn(ui);
  const before = ui.storage.getItem(draftKey);
  const refreshed = terminal({ refreshing: true, storageValues });
  refreshed.props.productionAssignments = ui.props.productionAssignments;
  refreshed.props.deliveryAssignments = ui.props.deliveryAssignments;
  refreshed.props.actions.loadDeliveryOptions = ui.props.actions.loadDeliveryOptions;
  refreshed.props.actions.loadServices = async () => success;
  refreshed.render();
  refreshed.runEffect("const restored = readBrowserSubmission");
  refreshed.flushTimers();
  await settle();
  assert.equal(refreshed.state.get("catalogStatus"), "ready");
  assert.equal(refreshed.state.get("cart")[0].quantity, 3);
  persist(refreshed);
  assert.deepEqual(JSON.parse(refreshed.storage.getItem(draftKey)), JSON.parse(before));
});

test("five workspaces retain independent drafts through catalog failures and remounts", async () => {
  const storageValues = new Map();
  const before = [];
  for (let workspace = 1; workspace <= 5; workspace++) {
    const ui = sale({ workspace, storageValues });
    ui.state.set("cart", [{ quantity: workspace, service }]);
    persist(ui);
    const key = `diagnostic:${workspace}:drafts`;
    choose(ui, "B"); await settle();
    ui.props.actions.loadServices = async () => { throw Error("Database unavailable"); };
    choose(ui, "A"); await settle();
    before.push(ui.storage.getItem(key));
    persist(ui);
    ui.runEffect("onRegisterSave(saveCurrentCustomerDraft)");
    assert.equal(ui.calls.save(), true);
    assert.equal(ui.storage.getItem(key), before[workspace - 1]);
  }
  for (let workspace = 1; workspace <= 5; workspace++) {
    const ui = terminal({ workspace, refreshing: true, storageValues });
    ui.props.productionAssignments = [{ id: "staff-a", label: "Staff" }];
    ui.props.deliveryAssignments = [{ id: "staff-a", label: "Staff" }];
    ui.props.actions.loadDeliveryOptions = async () => ({ billing: null, properties: [] });
    ui.props.actions.loadServices = async () => success;
    ui.render(); ui.runEffect("const restored = readBrowserSubmission"); ui.flushTimers();
    await settle(); persist(ui);
    assert.equal(ui.state.get("cart")[0].quantity, workspace);
    assert.deepEqual(JSON.parse(ui.storage.getItem(`diagnostic:${workspace}:drafts`)), JSON.parse(before[workspace - 1]));
  }
});

for (const staleFails of [false, true]) test(`stale catalog response cannot overwrite the current customer; rejection: ${staleFails}`, async () => {
  const ui = sale();
  const stale = deferred();
  ui.props.actions.loadServices = () => stale.promise;
  choose(ui, "B");
  ui.props.actions.loadServices = async () => success;
  choose(ui, "A"); await settle();
  if (staleFails) stale.reject(Error("Stale failure")); else stale.resolve({ segmentName: null, services: [] });
  await settle(); persist(ui);
  assert.equal(ui.state.get("customerId"), customer.id);
  assert.equal(ui.state.get("catalogStatus"), "ready");
  assert.equal(storedDraft(ui).items[0].quantity, 3);
});

// Run the real server query with in-memory Supabase reads, including resolved
// PostgREST errors (which do not reject) and rejected transport/auth operations.
function catalogQuery({ failure, empty = false } = {}) {
  const queryFile = new URL("../src/features/shop-terminal/server/queries.ts", import.meta.url);
  const results = {
    services: { data: empty ? [] : [{ ...service, price_is_from: false, pricing_source: "base", unit_type: "piece" }], error: null },
    organization_portal_categories: { data: [], error: null },
    customers: { data: { catalog_segment_id: null }, error: null },
  };
  if (failure === "missing-customer") results.customers.data = null;
  else if (failure === "null-services") results.services.data = null;
  else if (["services", "organization_portal_categories", "customers"].includes(failure)) results[failure] = { data: null, error: { code: "42501" } };
  const chain = (table) => ({ select() { return this; }, eq() { return this; }, in() { return this; },
    returns: async () => table === "services" ? { data: [], error: null } : results[table],
    maybeSingle: async () => results[table] });
  const supabase = { from: chain, rpc: () => ({ returns: async () => {
    if (failure === "transport") throw Error("Network unavailable");
    return results.services;
  } }) };
  const compiledModule = { exports: {} };
  const require = (name) => {
    if (name === "server-only") return {};
    if (name === "next-intl/server") return {};
    if (name.endsWith("/supabase/server")) return { createSupabaseServerClient: async () => supabase };
    if (name.endsWith("/access")) return { requireShopTerminalAccess: async () => {
      if (failure === "auth") throw Error("Access denied");
      return { membership: { organization: { id: "organization-a" } } };
    } };
    if (name.endsWith("/server/queries")) return { loadCatalogPresentation: async () => new Map() };
    if (name.endsWith("/presentation")) return { sortCatalogPresentation: (services) => services };
    throw Error(`Unexpected server import: ${name}`);
  };
  const code = ts.transpileModule(readFileSync(queryFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require, console: { error() {} } });
  return compiledModule.exports.listShopServices("es", customer.id, "location-a");
}
for (const failure of ["services", "organization_portal_categories", "customers", "missing-customer", "null-services", "transport", "auth"]) test(`server catalog failure is not a successful empty catalog: ${failure}`, async () => {
  await assert.rejects(catalogQuery({ failure }));
});
test("server catalog accepts a genuinely empty successful result", async () => {
  const result = await catalogQuery({ empty: true });
  assert.equal(result.services.length, 0);
  assert.equal(result.segmentName, null);
});
test("server catalog success keeps server prices and eligibility", async () => {
  const result = await catalogQuery();
  assert.equal(result.services.length, 1);
  assert.equal(result.services[0].id, service.id);
  assert.equal(result.services[0].amount, service.amount);
});
test("catalog error and retry translations exist in all five locales", () => {
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const text = labelsFor(locale);
    assert.ok(text.catalogLoadError.length > 30);
    assert.ok(text.retryCatalog.length > 5);
    assert.deepEqual(Object.keys(text).sort(), Object.keys(labels).sort());
  }
});
