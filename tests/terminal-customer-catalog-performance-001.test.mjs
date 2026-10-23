import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const queryCode = compile(read("src/features/shop-terminal/server/queries.ts"));
const presentationSource = ts.createSourceFile("presentation.ts", read("src/features/catalog-productization/server/queries.ts"), ts.ScriptTarget.Latest, true);
const presentationCode = compile(presentationSource.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "loadCatalogPresentation").getText(presentationSource));
const sortCode = compile(read("src/features/catalog-productization/presentation.ts"));
const plain = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(setImmediate);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function catalog({ segment = true, empty = false, gates = {}, responseErrors = [], transportError, denied = false, mainError = false } = {}) {
  const calls = [], logs = [];
  const services = empty ? [] : ["a", "b"].map((id) => ({ id, code: id, name: "Base " + id,
    description: "Base description", category: "laundry", amount: id === "a" ? "12.50" : "8.00",
    currency: "EUR", unit_type: "piece", price_is_from: false,
    pricing_source: segment ? "segment" : "base", pricing_segment_name: segment ? "Hotel" : null }));
  const results = {
    catalog: { data: services, error: mainError ? { code: "MAIN_ERROR" } : null },
    categories: { data: [{ category_key: "laundry", portal_title: "Category fallback" }], error: null },
    customer: { data: { catalog_segment_id: segment ? "segment-a" : null }, error: null },
    segment: { data: { name: "Hotel" }, error: null },
    media: { data: services.map(({ id }) => ({ id, portal_image_path: "images/" + id, portal_sort_order: 0 })), error: null },
    presentation: { data: services.map(({ id }) => ({ service_id: id, display_name: "Local " + id,
      display_description: "Local description", category_title: "Local category", order_mode: "alphabetical_desc",
      manual_sort_order: 0, category_sort_order: 0 })), error: null },
  };
  for (const key of responseErrors) results[key] = { data: null, error: { code: "ACCESSORY_ERROR" } };
  function query(kind, initial = {}) {
    const call = { kind, ...initial, filters: [] };
    const builder = {
      select(fields) { call.fields = fields; return this; },
      eq(key, value) { call.filters.push([key, value]); return this; },
      in(key, value) { call.filters.push([key, value]); return this; },
      returns() { return this; }, maybeSingle() { return this; },
      // Model PostgREST's lazy thenables: construction alone is not query start.
      then(resolve, reject) {
        calls.push(call);
        const response = transportError === kind ? Promise.reject(Error("Transport " + kind))
          : gates[kind]?.promise ?? Promise.resolve(results[kind]);
        return response.then(resolve, reject);
      },
    };
    return builder;
  }
  const supabase = {
    from(table) { return query({ organization_portal_categories: "categories", customers: "customer", catalog_segments: "segment", services: "media" }[table]); },
    rpc(name, args) { return query(name === "list_shop_terminal_services" ? "catalog" : "presentation", { args }); },
    storage: { from: (bucket) => ({ getPublicUrl: (path) => ({ data: { publicUrl: "https://media.example/" + bucket + "/" + path } }) }) },
  };
  const evaluate = (code, require) => {
    const compiledModule = { exports: {} };
    runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require, console: { error: (...args) => logs.push(args) } });
    return compiledModule.exports;
  };
  const presentation = evaluate(presentationCode);
  const sorting = evaluate(sortCode);
  const queryModule = evaluate(queryCode, (name) => {
    if (name === "server-only" || name === "next-intl/server" || name.endsWith("logistics/server/queries")) return {};
    if (name.endsWith("supabase/server")) return { createSupabaseServerClient: async () => supabase };
    if (name.endsWith("shop-terminal/server/access")) return { requireShopTerminalAccess: async () => {
      if (denied) throw Error("Denied");
      return { membership: { organization: { id: "tenant-a" } } };
    } };
    if (name.endsWith("catalog-productization/server/queries")) return presentation;
    if (name.endsWith("catalog-productization/presentation")) return sorting;
    throw Error("Unexpected import " + name);
  });
  return { calls, logs, results, run: () => queryModule.listShopServices("es", "customer-a", "location-a") };
}

for (const last of ["segment", "media", "presentation"]) test("starts all accessory reads concurrently and waits for " + last, async () => {
  const gates = Object.fromEntries(["segment", "media", "presentation"].map((key) => [key, deferred()]));
  const ui = catalog({ gates });
  let completed = false;
  const pending = ui.run().then((result) => { completed = true; return result; });
  await settle();
  assert.deepEqual(ui.calls.map(({ kind }) => kind).sort(), ["catalog", "categories", "customer", "media", "presentation", "segment"]);
  for (const key of Object.keys(gates).filter((key) => key !== last)) gates[key].resolve(ui.results[key]);
  await settle(); assert.equal(completed, false);
  gates[last].resolve(ui.results[last]);
  const result = await pending;
  assert.equal(result.services.length, 2);
  assert.equal(completed, true);
});

for (const segment of [false, true]) test("preserves complete localized catalog, prices and tenant filters; segment: " + segment, async () => {
  const ui = catalog({ segment });
  assert.deepEqual(plain(await ui.run()), {
    segmentName: segment ? "Hotel" : null,
    services: ["b", "a"].map((id) => ({ amount: id === "a" ? 12.5 : 8, category: "Local category", categoryKey: "laundry",
      code: id, currency: "EUR", description: "Local description", id,
      imageUrl: "https://media.example/brand-media/images/" + id, name: "Local " + id, priceIsFrom: false,
      pricingSegmentName: segment ? "Hotel" : null, pricingSource: segment ? "segment" : "base", unitType: "piece" })),
  });
  assert.equal(ui.calls.some(({ kind }) => kind === "segment"), segment);
  for (const call of ui.calls.filter(({ kind }) => ["categories", "customer", "segment", "media"].includes(kind))) {
    assert.ok(call.filters.some(([key, value]) => key === "organization_id" && value === "tenant-a"));
  }
  assert.deepEqual(plain(ui.calls.find(({ kind }) => kind === "catalog").args), { target_customer_id: "customer-a", target_location_id: "location-a" });
  assert.deepEqual(plain(ui.calls.find(({ kind }) => kind === "presentation").args), { target_locale: "es", target_service_ids: ["a", "b"] });
});

for (const segment of [false, true]) test("valid empty catalog skips media/presentation requests; segment: " + segment, async () => {
  const ui = catalog({ segment, empty: true });
  assert.deepEqual(plain(await ui.run()), { segmentName: segment ? "Hotel" : null, services: [] });
  assert.ok(!ui.calls.some(({ kind }) => ["media", "presentation"].includes(kind)));
});

for (const kind of ["segment", "media", "presentation"]) test("resolved accessory error retains existing fallback: " + kind, async () => {
  const ui = catalog({ responseErrors: [kind] });
  const result = plain(await ui.run());
  assert.equal(result.services.length, 2);
  assert.equal(result.segmentName, kind === "segment" ? null : "Hotel");
  assert.ok(ui.logs.some((args) => args.includes("ACCESSORY_ERROR")));
  for (const row of result.services) {
    assert.equal(row.name, (kind === "presentation" ? "Base " : "Local ") + row.id);
    assert.equal(row.category, kind === "presentation" ? "Category fallback" : "Local category");
    assert.equal(row.description, kind === "presentation" ? "Base description" : "Local description");
    assert.equal(row.imageUrl, kind === "media" ? null : "https://media.example/brand-media/images/" + row.id);
    assert.equal(row.amount, row.id === "a" ? 12.5 : 8);
  }
});

for (const kind of ["segment", "media", "presentation"]) test("accessory transport rejection is not a successful empty catalog: " + kind, async () => {
  await assert.rejects(catalog({ transportError: kind }).run(), new RegExp("Transport " + kind));
});

test("access control and initial reads complete before accessory queries start", async () => {
  const customer = deferred();
  const ui = catalog({ gates: { customer } });
  const pending = ui.run(); await settle();
  assert.deepEqual(ui.calls.map(({ kind }) => kind).sort(), ["catalog", "categories", "customer"]);
  customer.resolve(ui.results.customer); await pending;
  for (const options of [{ denied: true }, { mainError: true }]) {
    const denied = catalog(options); await assert.rejects(denied.run());
    assert.ok(!denied.calls.some(({ kind }) => ["segment", "media", "presentation"].includes(kind)));
  }
});
