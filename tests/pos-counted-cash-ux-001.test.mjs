import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
function load(path, dependencies = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: loaded, exports: loaded.exports, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name === "react/jsx-runtime") return require(name);
    throw Error("Unexpected dependency: " + name);
  } });
  return loaded.exports;
}

const validation = load("src/features/pos/validation.ts", {
  "@/features/payments/types": load("src/features/payments/types.ts"),
});
const sessionId = "11111111-1111-4111-8111-111111111111";
function closeData(amount) {
  const data = new FormData();
  data.set("sessionId", sessionId);
  data.set("notes", "Counted by operator");
  if (amount !== undefined) data.set("countedCash", amount);
  return data;
}

function closeAction() {
  const calls = [], refreshes = [], access = [];
  const actions = load("src/features/pos/server/actions.ts", {
    "next/cache": { revalidatePath: (path) => refreshes.push(path) },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => {
      calls.push("client");
      return { rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } };
    } },
    "@/features/pos/server/access": { requirePosAccess: async (locale) => access.push(locale) },
    "@/features/pos/validation": validation,
    "@/features/pos/providers/types": { MANUAL_CARD_PROVIDER: "manual" },
    "@/lib/daily-close-error": { isBusinessDayClosedError: () => false },
  });
  return { action: actions.closePosSessionAction, calls, refreshes, access };
}

// Execute the actual exported workspace and its actual CloseSessionForm child.
// Hooks and server dependencies are doubles; this is not a browser or DB test.
function workspace(action) {
  const { PosWorkspace } = load("src/components/pos/PosWorkspace.tsx", {
    react: { useActionState: (callback, initial) => [initial, (data) => callback(initial, data), false], useState: (initial) => [initial, () => {}] },
    "@/components/Button": { Button: ({ children, ...props }) => ({ type: "button", props: { ...props, children } }) },
    "@/components/Card": { Card: ({ children }) => children },
    "@/lib/number-format": { formatCurrency: (amount) => String(amount) },
    "@/i18n/navigation": { Link: "a" },
  });
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    if (typeof node.type === "function") return nodes(node.type(node.props));
    return node.props ? [node, ...nodes(node.props.children)] : [];
  }
  const text = JSON.parse(read("src/i18n/en/common.json")).pos;
  return nodes(PosWorkspace({
    actions: { close: action }, canSeeHistory: false, currency: "EUR", history: [], historyNavigation: {},
    locale: "en", locations: [], orders: [], payments: [], paymentNavigation: {}, query: "",
    session: { id: sessionId },
    summary: { openingCash: 20, cashPayments: 100, cashRefunds: 15, expectedCash: 105, transactionCount: 3 }, text,
  }));
}

test("real workspace leaves counted cash empty while preserving expected cash and input constraints", () => {
  const tree = workspace(async () => {});
  const input = tree.find((node) => node.type === "input" && node.props.name === "countedCash");
  assert.ok(input);
  assert.equal(input.props.value, undefined);
  assert.ok(input.props.defaultValue === undefined || input.props.defaultValue === "");
  assert.equal(input.props.type, "number");
  assert.equal(input.props.required, true);
  assert.equal(input.props.min, "0");
  assert.equal(input.props.step, "0.01");
  assert.ok(tree.some((node) => node.type === "dd" && node.props.children === "105"));
});

for (const [label, amount] of [["missing", undefined], ["empty", ""], ["whitespace", "   "], ["negative", "-1"], ["nonnumeric", "abc"]]) {
  test(label + " counted cash fails real validation and the real form/action never reaches RPC", async () => {
    const data = closeData(amount);
    const parsed = validation.parseCloseSession(data);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.fieldErrors.countedCash, "invalid");
    const harness = closeAction();
    const form = workspace(harness.action.bind(null, "en")).find((node) => node.type === "form"
      && Array.isArray(node.props.children) && node.props.children.some((child) => child?.props?.name === "sessionId"));
    assert.ok(form);
    const result = await form.props.action(data);
    assert.equal(result.success, false);
    assert.equal(result.formError, "validation");
    assert.equal(result.fieldErrors.countedCash, "invalid");
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.access.length, 0);
    assert.equal(harness.refreshes.length, 0);
  });
}

for (const [amount, expected] of [["0", 0], ["12.50", 12.5]]) {
  test("explicit " + amount + " reaches the unchanged close RPC with the entered amount", async () => {
    const data = closeData(amount);
    const parsed = validation.parseCloseSession(data);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.input.countedCash, expected);
    const harness = closeAction();
    const result = await harness.action("en", undefined, data);
    assert.equal(result.success, true);
    assert.equal(harness.access.length, 1);
    assert.equal(harness.calls.length, 2);
    assert.equal(harness.calls[1].name, "close_pos_session");
    assert.equal(harness.calls[1].args.target_counted_cash, expected);
    assert.equal(harness.calls[1].args.target_session_id, sessionId);
    assert.equal(harness.calls[1].args.target_notes, "Counted by operator");
    assert.ok(harness.refreshes.includes("/en/app/pos"));
  });
}
