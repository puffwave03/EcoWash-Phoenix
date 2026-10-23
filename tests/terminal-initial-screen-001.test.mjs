import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/shop-terminal/ShopTerminalWorkspace.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "ShopTerminalWorkspace");
const compile = (text) => ts.transpileModule(text, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
} }).outputText;
const storageModule = { exports: {} };
runInNewContext(compile(readFileSync(new URL("../src/features/shop-terminal/workspace-storage.ts", import.meta.url), "utf8")), {
  module: storageModule, exports: storageModule.exports,
});
const keys = storageModule.exports;
const namespace = keys.workspaceNamespace("org-a", "location-a");
const selectionKey = keys.workspaceSelectionKey(namespace);
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node?.props ? [node, ...nodes(node.props.children)] : [];

// Execute the actual outer component with simulated hooks/timers, as in the
// existing Terminal harness. Child hydration is covered by the recovery suites.
function terminal({ values = new Map(), location = "location-a", fail = () => false, dropWrites = false } = {}) {
  const state = [], refs = [], timers = new Map(), writes = [], actions = [];
  let stateIndex, refIndex, nextTimer = 0, effects;
  const storage = {
    getItem(key) { if (fail("get", key)) throw Error("read unavailable"); return values.get(key) ?? null; },
    setItem(key, value) { if (fail("set", key)) throw Error("write unavailable"); writes.push([key, value]); if (!dropWrites) values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const exports = {};
  const props = { organizationId: "org-a", draftLocationId: location, session: null,
    text: { workspacePrompt: "Choose sale", workspaceStorageError: "Storage unavailable", workspaceLocationRequired: "Location required" },
    actions: { submit() { actions.push("submit"); }, submissionStatus() { actions.push("status"); } },
  };
  runInNewContext(compile(component.getText(ast)), {
    exports, require, ...keys, SaleWorkspace: "sale-workspace", browserSubmissionStorage: () => storage,
    parseStoredDraft: () => { throw Error("Unexpected draft parsing"); },
    readDraftMap: () => { throw Error("Unexpected draft loading"); },
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useCallback: (callback) => callback,
    useEffect: (effect) => effects.push(effect),
    window: {
      get sessionStorage() { if (fail("access")) throw Error("Storage unavailable"); return storage; },
      setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); }, confirm: () => true,
    },
  });
  const render = () => { stateIndex = refIndex = 0; effects = []; return exports.ShopTerminalWorkspace(props); };
  const sale = () => nodes(render()).find((node) => node.type === "sale-workspace");
  const buttons = () => nodes(render()).filter((node) => node.type === "button" && node.props.onClick?.toString().includes("chooseWorkspace"));
  render();
  const cleanup = effects[0]();
  return { values, writes, actions, state, refs, render, sale, buttons, cleanup,
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); },
  };
}

test("missing selection opens sale 1, keeps five buttons and normalizes only the selection key", () => {
  const ui = terminal();
  assert.equal(ui.sale(), undefined);
  ui.flush();
  assert.equal(ui.sale().props.workspace, 1);
  assert.equal(ui.buttons().length, 5);
  assert.equal(ui.values.get(selectionKey), "1");
  assert.equal(ui.values.size, 1);
  assert.equal(ui.actions.length, 0);
});

for (const workspace of [2, 3, 4, 5]) test("restores valid selection " + workspace + " without writing", () => {
  const ui = terminal({ values: new Map([[selectionKey, String(workspace)]]) });
  ui.flush();
  assert.equal(ui.sale().props.workspace, workspace);
  assert.equal(ui.writes.length, 0);
});

for (const value of ["", "0", "6", "invalid"]) test("invalid selection falls back safely: " + JSON.stringify(value), () => {
  const ui = terminal({ values: new Map([[selectionKey, value]]) });
  ui.flush();
  assert.equal(ui.sale().props.workspace, 1);
  assert.equal(ui.values.get(selectionKey), "1");
  assert.equal(keys.inspectWorkspaceDiscard({ getItem: (key) => ui.values.get(key) ?? null }, namespace, 1, () => true).kind, "ready");
});

for (const failure of ["access", "read", "inventory", "write", "readback", "dropped-write"]) test("storage failure blocks automatic opening: " + failure, () => {
  const ui = terminal({ dropWrites: failure === "dropped-write", fail: (operation, key) =>
    operation === "access" && failure === "access"
    || operation === "get" && key === selectionKey && (failure === "read" || failure === "readback" && ui.writes.length > 0)
    || operation === "get" && key === keys.workspaceDraftKey(namespace, 3) && failure === "inventory"
    || operation === "set" && failure === "write",
  });
  ui.flush();
  assert.equal(ui.sale(), undefined);
  assert.ok(nodes(ui.render()).some((node) => node.props.role === "alert"));
});

test("no location preserves the block and does not persist a fallback", () => {
  const ui = terminal({ location: null }); ui.flush();
  assert.equal(ui.sale(), undefined);
  assert.equal(ui.writes.length, 0);
  assert.ok(ui.buttons().every((node) => node.props.disabled));
});

test("manual selection before restoration wins; draft save failure still blocks switching", () => {
  const ui = terminal();
  ui.buttons()[3].props.onClick(); ui.flush();
  assert.equal(ui.sale().props.workspace, 4);
  assert.equal(ui.values.get(selectionKey), "4");
  ui.refs[0].current = () => false;
  ui.buttons()[1].props.onClick();
  assert.equal(ui.sale().props.workspace, 4);
  assert.equal(ui.values.get(selectionKey), "4");
});

test("restoration preserves all workspace data and never dispatches submission or status actions", () => {
  const values = new Map();
  for (const workspace of [1, 2, 3, 4, 5]) {
    for (const key of [keys.workspaceDraftKey, keys.workspaceCustomerKey, keys.workspaceWalkInKey, keys.workspaceSubmissionKey]) {
      values.set(key(namespace, workspace), "preserved-" + workspace);
    }
  }
  const before = [...values];
  const ui = terminal({ values }); ui.flush();
  for (const [key, value] of before) assert.equal(values.get(key), value);
  assert.equal(ui.sale().props.workspace, 1);
  assert.equal(ui.writes.length, 1);
  assert.equal(ui.actions.length, 0);
  assert.equal(ui.sale().props.customerId, undefined);
});

test("explicit discard leaves no selection and does not reapply the initial fallback", () => {
  const ui = terminal(); ui.flush();
  nodes(ui.render()).find((node) => node.type === "button" && node.props.onClick?.toString().includes("discardWorkspace(selected)")).props.onClick();
  ui.flush();
  assert.equal(ui.sale(), undefined);
  assert.equal(ui.values.has(selectionKey), false);
});
