import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { persistSubmissionAttempt, readSubmissionAttempt, removeSubmissionAttempt } from "../src/features/shop-terminal/submission-recovery.ts";
import { workspaceNamespace, workspaceSubmissionKey } from "../src/features/shop-terminal/workspace-storage.ts";

const key = "9b73bff2-e503-4c64-95d0-0c89cae0c25b";
const payload = JSON.stringify({ customerId: "customer-1", idempotencyKey: key, sessionId: "session-1", payments: [{ idempotencyKey: "payment-1", method: "cash" }] });
const attempt = { version: 1, key, payload, status: "pending", orderId: null, orderNumber: null };
const makeStorage = () => {
  const values = new Map();
  return {
    values,
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
};

test("five workspaces and tenant/location namespaces retain independent submission identities", () => {
  const storage = makeStorage();
  const first = workspaceNamespace("tenant-a", "location-a");
  const keys = [1, 2, 3, 4, 5].map((workspace) => workspaceSubmissionKey(first, workspace));
  assert.equal(new Set(keys).size, 5);
  assert.notEqual(keys[0], workspaceSubmissionKey(workspaceNamespace("tenant-b", "location-a"), 1));
  assert.notEqual(keys[0], workspaceSubmissionKey(workspaceNamespace("tenant-a", "location-b"), 1));
  for (const storageKey of keys) assert.equal(persistSubmissionAttempt(storage, storageKey, attempt), true);
  assert.equal(readSubmissionAttempt(storage, keys[1]).kind, "present");
  assert.equal(removeSubmissionAttempt(storage, keys[0]), true);
  assert.equal(readSubmissionAttempt(storage, keys[0]).kind, "missing");
  assert.equal(readSubmissionAttempt(storage, keys[1]).kind, "present");
});

test("write failures and failed read-back do not confirm persistence", () => {
  const storage = makeStorage();
  const storageKey = "submission";
  assert.equal(persistSubmissionAttempt({ ...storage, setItem: () => { throw Error("quota"); } }, storageKey, attempt), false);
  assert.equal(storage.getItem(storageKey), null);
  assert.equal(persistSubmissionAttempt({ ...storage, getItem: () => null }, storageKey, attempt), false);
  assert.equal(persistSubmissionAttempt(storage, storageKey, attempt), true);
  assert.deepEqual(readSubmissionAttempt(storage, storageKey), { kind: "present", attempt });
});

test("refresh restores frozen order, POS session and payment keys; corruption blocks recovery", () => {
  const storage = makeStorage();
  persistSubmissionAttempt(storage, "submission", attempt);
  const restored = readSubmissionAttempt(storage, "submission");
  assert.equal(restored.kind, "present");
  assert.deepEqual(JSON.parse(restored.attempt.payload), JSON.parse(payload));
  storage.setItem("submission", JSON.stringify({ ...attempt, key: "different" }));
  assert.equal(readSubmissionAttempt(storage, "submission").kind, "invalid");
  assert.equal(readSubmissionAttempt({ getItem: () => { throw Error("blocked"); } }, "submission").kind, "unavailable");
});

test("failed cleanup keeps confirmed marker for refresh reconciliation", () => {
  const storage = makeStorage();
  const completed = { ...attempt, status: "completed", orderId: "order-1", orderNumber: "EW-000144" };
  assert.equal(persistSubmissionAttempt(storage, "submission", completed), true);
  assert.equal(removeSubmissionAttempt({ ...storage, removeItem: () => { throw Error("blocked"); } }, "submission"), false);
  assert.deepEqual(readSubmissionAttempt(storage, "submission"), { kind: "present", attempt: completed });
});

test("Terminal uses read-back before sending, frozen retry, status lookup and marker-last cleanup", async () => {
  const [ui, server, page] = await Promise.all([
    readFile(new URL("../src/components/shop-terminal/ShopTerminalWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/shop-terminal/server/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/[locale]/app/(dashboard)/shop/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /persistBrowserSubmission\(submissionStorageKey, nextAttempt\)/);
  assert.match(ui, /frozen\.set\("payload", stored\.attempt\.payload\)/);
  assert.match(ui, /frozen\.set\("payload", current\.payload\)/);
  assert.match(ui, /removeBrowserSubmission\(submissionStorageKey\)/);
  assert.match(ui, /recoveryStatus === "not_found"/);
  assert.match(server, /requireShopTerminalAccess\(locale\)/);
  assert.match(server, /rpc\("get_shop_terminal_submission_status"/);
  assert.match(page, /submissionStatus: getShopSubmissionStatusAction\.bind\(null, locale\)/);
});
