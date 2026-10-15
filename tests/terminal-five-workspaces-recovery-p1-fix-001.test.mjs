import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readDraftMap } from "../src/features/shop-terminal/draft-storage.ts";
import { canCorrectRejectedSubmission, classifyDefinitiveTerminalRejection } from "../src/features/shop-terminal/submission-rejection.ts";
import { persistSubmissionAttempt, readSubmissionAttempt } from "../src/features/shop-terminal/submission-recovery.ts";
import { workspaceDraftKey, workspaceNamespace } from "../src/features/shop-terminal/workspace-storage.ts";

const storage = () => {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test("transient draft read failure never becomes an empty map or overwrites saved drafts", () => {
  const browser = storage();
  const key = workspaceDraftKey(workspaceNamespace("org-a", "location-a"), 1);
  const saved = JSON.stringify([["customer-a", { items: ["service-a"], notes: "keep" }]]);
  browser.setItem(key, saved);
  let failed = true;
  const flaky = { getItem: (name) => { if (failed) throw Error("blocked"); return browser.getItem(name); } };
  const parse = (value) => value && typeof value === "object" ? value : null;
  assert.deepEqual(readDraftMap(flaky, key, parse), { kind: "read_error" });
  assert.equal(browser.getItem(key), saved);
  failed = false;
  const restored = readDraftMap(flaky, key, parse);
  assert.equal(restored.kind, "loaded");
  assert.deepEqual(restored.drafts.get("customer-a"), { items: ["service-a"], notes: "keep" });
  assert.equal(browser.getItem(key), saved);
  assert.equal(readDraftMap(browser, "absent", parse).drafts.size, 0);
  assert.deepEqual(readDraftMap({ getItem: () => "corrupt" }, key, parse), { kind: "invalid" });
});

test("draft namespaces stay distinct across five sales, tenants, and locations", () => {
  const browser = storage();
  const namespace = workspaceNamespace("org-a", "location-a");
  const keys = [1, 2, 3, 4, 5].map((number) => workspaceDraftKey(namespace, number));
  assert.equal(new Set(keys).size, 5);
  assert.notEqual(keys[0], workspaceDraftKey(workspaceNamespace("org-b", "location-a"), 1));
  assert.notEqual(keys[0], workspaceDraftKey(workspaceNamespace("org-a", "location-b"), 1));
  for (const [index, key] of keys.entries()) browser.setItem(key, JSON.stringify([[`customer-${index}`, { items: [index] }]]));
  for (const [index, key] of keys.entries()) assert.deepEqual(readDraftMap(browser, key, (value) => value).drafts.get(`customer-${index}`), { items: [index] });
});

test("only exact PostgreSQL errors raised after the idempotency lock prove a rollback", () => {
  assert.equal(classifyDefinitiveTerminalRejection({ code: "55000", message: "daily_close_business_day_closed" }), "closedDay");
  assert.equal(classifyDefinitiveTerminalRejection({ code: "55000", message: "pos_session_not_open" }), "till");
  assert.equal(classifyDefinitiveTerminalRejection({ code: "42501", message: "shop_terminal_staff_discount_denied" }), "discount");
  assert.equal(classifyDefinitiveTerminalRejection({ code: "22023", message: "shop_terminal_item_invalid" }), "validation");
  for (const error of [
    null,
    { code: "23505", message: "shop_terminal_idempotency_conflict" },
    { code: "22023", message: "shop_terminal_customer_invalid" },
    { code: "PGRST301", message: "pos_session_not_open" },
    { code: "55000", message: "pos_session_not_open: network error" },
  ]) assert.equal(classifyDefinitiveTerminalRejection(error), null);
  assert.equal(canCorrectRejectedSubmission("after_lock", false), true);
  assert.equal(canCorrectRejectedSubmission("before_rpc", true), true);
  assert.equal(canCorrectRejectedSubmission("before_rpc", false), false);
  assert.equal(canCorrectRejectedSubmission(undefined, true), false);
});

test("confirmed rejection survives refresh with the original immutable payload and keys", () => {
  const browser = storage();
  const key = "3f112ef8-08df-47e4-b8e4-f0bb65d58172";
  const payload = JSON.stringify({ idempotencyKey: key, sessionId: "pos-session", payments: [{ idempotencyKey: "payment-key" }] });
  const rejected = { version: 1, key, payload, status: "rejected", orderId: null, orderNumber: null, rejectionReason: "till" };
  assert.equal(persistSubmissionAttempt(browser, "submission", rejected), true);
  assert.deepEqual(readSubmissionAttempt(browser, "submission"), { kind: "present", attempt: rejected });
  assert.deepEqual(JSON.parse(readSubmissionAttempt(browser, "submission").attempt.payload), JSON.parse(payload));
});

test("UI gates hydration, first-send proof, uncertain retry, and rejected-marker removal", async () => {
  const ui = await readFile(new URL("../src/components/shop-terminal/ShopTerminalWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /if \(loaded\.kind !== "loaded" \|\|[\s\S]*setDraftHydration\("error"\);\s*return;/);
  assert.match(ui, /hydratedDraftStorageKeyRef\.current = draftStorageKey;\s*setDraftHydration\("ready"\)/);
  assert.match(ui, /draftHydration !== "ready" \|\| attemptStorageLost/);
  assert.match(ui, /canCorrectRejectedSubmission\(result\.rejectionProof, firstDispatch\)/);
  assert.match(ui, /recoveryStatus === "not_found"/);
  assert.match(ui, /stored\.attempt\.key !== current\.key \|\| stored\.attempt\.payload !== current\.payload/);
  assert.match(ui, /if \(!removeBrowserSubmission\(submissionStorageKey\)\) \{/);
});
