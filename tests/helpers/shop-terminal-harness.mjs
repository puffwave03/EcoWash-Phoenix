import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../", import.meta.url));
const filename = resolve(root, "src/components/shop-terminal/ShopTerminalWorkspace.tsx");
const source = readFileSync(filename, "utf8");
const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "SaleWorkspace");
const hookNames = (hook) => component.body.statements.flatMap((node) => ts.isVariableStatement(node)
  ? node.declarationList.declarations.filter((declaration) => declaration.initializer
    && ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(ast) === hook)
    .map(({ name }) => ts.isArrayBindingPattern(name) ? name.elements[0].name.text : name.text) : []);
const stateNames = hookNames("useState");
const refNames = hookNames("useRef");
const labelsFor = (locale) => JSON.parse(readFileSync(resolve(root, `src/i18n/${locale}/common.json`), "utf8")).shopTerminal.labels;
const labels = labelsFor("es");
const customer = { id: "customer-a", name: "A", isWalkIn: false, phone: null, email: null, updatedAt: "2026-10-16" };
const service = { id: "service-a", name: "Test", amount: 10, currency: "EUR", unitType: "piece" };
const submissionKey = "diagnostic:1:submission";
const draftKey = "diagnostic:1:drafts";
const pendingAttempt = {
  version: 1, key: "attempt-a", status: "pending", orderId: null, orderNumber: null,
  payload: JSON.stringify({ customerId: customer.id, idempotencyKey: "attempt-a", sessionId: "pos-a", payments: [{ idempotencyKey: "payment-a", method: "cash", amount: 10 }] }),
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
};
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node?.props ? [node, ...nodes(node.props.children)] : [];
const content = (node) => Array.isArray(node) ? node.map(content).join(" ")
  : node?.props ? content(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : "";
const button = (tree, label) => nodes(tree).find((node) => node.type === "button" && content(node) === label);

// Execute the real TSX, handlers and cleanup with deferred action promises and
// in-memory storage. Hooks are simulated; this does not test React scheduling or DOM layout.
function terminal({ restored = null, refreshing = false, workspace = 1, storageValues = new Map(), confirmResult = true } = {}) {
  const state = new Map(), refs = new Map(), actionSlots = new Map(), modules = new Map();
  const calls = { submit: [], status: [], occupied: [], confirm: [] };
  const response = deferred();
  let stateIndex, refIndex, actionIndex, effects, timers = [];
  const storage = {
    getItem: (key) => storageValues.get(key) ?? null,
    setItem: (key, value) => storageValues.set(key, value),
    removeItem: (key) => storageValues.delete(key),
  };
  if (restored) storage.setItem(submissionKey, JSON.stringify(restored));
  const hooks = {
    useState(initial) {
      const name = stateNames[stateIndex++];
      if (!state.has(name)) state.set(name, typeof initial === "function" ? initial() : initial);
      return [state.get(name), (value) => state.set(name, typeof value === "function" ? value(state.get(name)) : value)];
    },
    useRef(initial) {
      const name = refNames[refIndex++];
      if (!refs.has(name)) refs.set(name, { current: initial });
      return refs.get(name);
    },
    useEffect: (effect) => effects.push(effect),
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useTransition: () => [false, (callback) => callback()],
    useActionState(action, initial) {
      const index = actionIndex++;
      if (!actionSlots.has(index)) actionSlots.set(index, { value: initial, pending: false });
      const slot = actionSlots.get(index);
      return [slot.value, async (data) => {
        slot.pending = true;
        try { slot.value = await action(slot.value, data); }
        finally { slot.pending = false; }
      }, slot.pending];
    },
  };
  function load(file, append = "") {
    if (modules.has(file)) return modules.get(file).exports;
    const compiledModule = { exports: {} };
    modules.set(file, compiledModule);
    const localRequire = (name) => {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return require(name);
      if (name === "@/i18n/navigation") return { Link: "a", useRouter: () => ({}) };
      if (name.startsWith("@/components/")) return { PrintOrderActions: "print-actions", PortalMedia: "media", QuickDropTerminalPanel: "quick-drop" };
      if (name === "@/lib/number-format") return { formatCurrency: String };
      if (name.startsWith("@/")) return load(resolve(root, "src", name.slice(2)) + ".ts");
      if (name.startsWith(".")) return load(resolve(dirname(file), name) + ".ts");
      throw Error(`Unexpected test import: ${name}`);
    };
    const code = ts.transpileModule(readFileSync(file, "utf8") + append, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    runInNewContext(code, {
      module: compiledModule, exports: compiledModule.exports, require: localRequire, crypto: webcrypto,
      window: { sessionStorage: storage, setTimeout: (callback) => timers.push(callback), clearTimeout() {},
        confirm(message) { calls.confirm.push(message); return confirmResult; } },
      FormData: class extends Map { get(key) { return super.get(key) ?? null; } },
    }, { filename: file });
    return compiledModule.exports;
  }
  const SaleWorkspace = load(filename, "\nexport { SaleWorkspace };").SaleWorkspace;
  const props = {
    actions: {
      submit: async (_state, data) => { calls.submit.push(data.get("payload")); return response.promise; },
      submissionStatus: async (key) => { calls.status.push(key); return props.statusResult; },
    },
    statusResult: { status: "not_found", orderId: null, orderNumber: null },
    customers: [customer], defaultCurrency: "EUR", defaultCountryCode: "ES", defaultProductionAssigneeId: null,
    productionAssignments: [], deliveryAssignments: [], locale: "es", namespace: "diagnostic", workspace,
    role: "owner", session: { id: "pos-a", locationId: "location-a" }, text: { ...labels, unitTypes: { piece: "pieza" } },
    categoryLabels: {}, pendingQuickDrops: [], onBusyChange() {}, onRegisterSave(save) { calls.save = save; },
    onOccupiedChange: (value) => calls.occupied.push(value), onStorageFailure() { throw Error("Unexpected storage failure"); },
  };
  if (!refreshing) {
    for (const [name, value] of Object.entries({ attemptLoaded: true, draftHydration: "ready", customerId: customer.id,
      catalogStatus: "ready", services: [service], cart: [{ quantity: 1, service }], dueAt: "2026-10-16T12:00", attempt: restored })) state.set(name, value);
    refs.set("hydratedDraftStorageKeyRef", { current: `diagnostic:${workspace}:drafts` });
    refs.set("catalogCustomerRef", { current: customer.id });
    if (restored) refs.set("attemptRef", { current: restored });
  }
  const render = () => { stateIndex = refIndex = actionIndex = 0; effects = []; return SaleWorkspace(props); };
  function start() {
    const form = nodes(render()).find((node) => node.type === "form" && node.props.onSubmit?.name === "prepareSubmission");
    assert.ok(form);
    const event = { nativeEvent: { submitter: { value: "cash" } }, preventDefault() { this.prevented = true; } };
    form.props.onSubmit(event);
    assert.ok(!event.prevented);
    return { form, event, settled: form.props.action(new Map()) };
  }
  function runEffect(fragment) {
    const effect = effects.find((callback) => callback.toString().includes(fragment));
    assert.ok(effect, `Missing effect: ${fragment}`);
    effect();
  }
  return { render, start, response, storage, calls, refs, state, props, runEffect,
    flushTimers() { const pending = timers; timers = []; pending.forEach((callback) => callback()); } };
}

export { terminal, nodes, content, button, labels, labelsFor, customer, service, submissionKey, draftKey, pendingAttempt, deferred };
