import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parsePersistedDeliveryDraft, readDraftMap } from "../src/features/shop-terminal/draft-storage.ts";
import { createSubmissionFlight } from "../src/features/shop-terminal/submission-flight.ts";
import { canCorrectRejectedSubmission } from "../src/features/shop-terminal/submission-rejection.ts";
import { persistSubmissionAttempt, readSubmissionAttempt } from "../src/features/shop-terminal/submission-recovery.ts";
import { inspectWorkspaceDiscard, workspaceCustomerKey, workspaceDraftKey, workspaceNamespace, workspaceSubmissionKey, workspaceWalkInKey } from "../src/features/shop-terminal/workspace-storage.ts";

const makeStorage = () => {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
const deferred = () => {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
};
const customer = { id: "customer-a", name: "A", isWalkIn: false, phone: null, email: null, updatedAt: "2026-10-15" };
const delivery = { addressLine1: "street", addressLine2: "", assignedTo: "", city: "", contactName: "", contactPhone: "", countryCode: "ES", notes: "", postalCode: "", propertyId: "", scheduledAt: "", requested: true };
const parseDraft = (value) => value && typeof value === "object" && parsePersistedDeliveryDraft(value.delivery) ? value : null;

test("discard verifies every key and preserves a draft after read failure, corrupt JSON, or corrupt delivery", () => {
  const browser = makeStorage();
  const namespace = workspaceNamespace("org-a", "location-a");
  const draftKey = workspaceDraftKey(namespace, 1);
  const submissionKey = workspaceSubmissionKey(namespace, 1);
  const saved = JSON.stringify([[customer.id, { delivery }]]);
  browser.setItem(draftKey, saved);
  browser.setItem(workspaceCustomerKey(namespace, 1), JSON.stringify(customer));
  const inspect = (store) => inspectWorkspaceDiscard(store, namespace, 1, (raw) =>
    readDraftMap({ getItem: () => raw }, draftKey, parseDraft).kind === "loaded");
  const readFailure = { getItem: (key) => { if (key === draftKey) throw Error("transient"); return browser.getItem(key); } };
  assert.deepEqual(inspect(readFailure), { kind: "unreadable" });
  assert.equal(browser.getItem(draftKey), saved);
  assert.equal(inspect(browser).kind, "ready");
  browser.setItem(draftKey, "{broken-json");
  assert.deepEqual(inspect(browser), { kind: "unreadable" });
  assert.equal(browser.getItem(draftKey), "{broken-json");
  browser.setItem(draftKey, JSON.stringify([[customer.id, { delivery: { ...delivery, contactPhone: 123 } }]]));
  assert.equal(parsePersistedDeliveryDraft({ ...delivery, contactPhone: 123 }), null);
  assert.deepEqual(inspect(browser), { kind: "unreadable" });
  browser.setItem(draftKey, saved);
  browser.setItem(workspaceCustomerKey(namespace, 1), "{broken-customer");
  assert.deepEqual(inspect(browser), { kind: "unreadable" });
  browser.setItem(workspaceCustomerKey(namespace, 1), JSON.stringify(customer));
  browser.setItem(submissionKey, "unreadable submission");
  assert.deepEqual(inspect(browser), { kind: "submission" });
  browser.removeItem(submissionKey);
  assert.equal(inspect(browser).kind, "ready");
});

test("confirmed discard removes only the selected verified workspace", () => {
  const browser = makeStorage();
  const namespace = workspaceNamespace("org-a", "location-a");
  for (const workspace of [1, 2, 3, 4, 5]) {
    browser.setItem(workspaceDraftKey(namespace, workspace), JSON.stringify([[customer.id, { delivery }]]));
    browser.setItem(workspaceCustomerKey(namespace, workspace), JSON.stringify(customer));
    browser.setItem(workspaceWalkInKey(namespace, workspace), JSON.stringify({ ...customer, isWalkIn: true }));
  }
  const inspection = inspectWorkspaceDiscard(browser, namespace, 1, (raw) =>
    readDraftMap({ getItem: () => raw }, workspaceDraftKey(namespace, 1), parseDraft).kind === "loaded");
  assert.equal(inspection.kind, "ready");
  for (const key of inspection.keys) browser.removeItem(key);
  assert.equal(browser.getItem(workspaceDraftKey(namespace, 1)), null);
  for (const workspace of [2, 3, 4, 5]) assert.notEqual(browser.getItem(workspaceDraftKey(namespace, workspace)), null);
});

test("synchronous flight gate blocks double click, status, retry and correction until the active request settles", async () => {
  const flight = createSubmissionFlight();
  const browser = makeStorage();
  const key = "3f112ef8-08df-47e4-b8e4-f0bb65d58172";
  const payload = JSON.stringify({ idempotencyKey: key, sessionId: "pos-session", payments: [{ idempotencyKey: "payment-key" }] });
  const pending = { version: 1, key, payload, status: "pending", orderId: null, orderNumber: null };
  assert.equal(persistSubmissionAttempt(browser, "attempt", pending), true);
  const canCreateNewIdentity = () => !flight.hasActivity() && readSubmissionAttempt(browser, "attempt").kind === "missing";
  const first = deferred();
  const firstToken = flight.beginSubmission();
  assert.equal(typeof firstToken, "number");
  const firstResult = first.promise.then(() => flight.endSubmission(firstToken));
  assert.equal(flight.beginSubmission(), null); // immediate second click
  assert.equal(flight.beginStatusLookup(), false); // first request still active
  assert.equal(flight.beginSubmission(), null); // not_found cannot enable a concurrent retry
  assert.equal(flight.hasActivity(), true); // correction must remain unavailable
  assert.equal(canCreateNewIdentity(), false);
  first.resolve("client timeout; server outcome remains unknown");
  assert.equal(await firstResult, true);
  assert.equal(flight.hasActivity(), false);
  assert.equal(canCreateNewIdentity(), false); // timeout alone does not clear the marker
  const lookup = deferred();
  assert.equal(flight.beginStatusLookup(), true);
  const status = lookup.promise.then(() => flight.endStatusLookup());
  assert.equal(flight.beginSubmission(), null);
  lookup.resolve("not_found");
  await status;
  assert.equal(canCreateNewIdentity(), false); // not_found does not clear the marker
  const retry = deferred();
  const retryToken = flight.beginSubmission();
  assert.equal(typeof retryToken, "number");
  const retryResult = retry.promise.then(() => flight.endSubmission(retryToken));
  assert.equal(flight.hasActivity(), true);
  assert.equal(flight.beginSubmission(), null);
  const lateFirst = deferred();
  const lateFirstResult = lateFirst.promise.then(() => flight.endSubmission(firstToken));
  lateFirst.resolve("late original response");
  assert.equal(await lateFirstResult, false); // late first response cannot release the retry
  assert.equal(flight.hasActivity(), true);
  assert.equal(canCreateNewIdentity(), false);
  retry.resolve("completed");
  assert.equal(await retryResult, true);
  assert.equal(canCreateNewIdentity(), false); // only confirmed cleanup may remove the marker
});

test("a definitive rejection unlocks correction only after its sole active submission settles", async () => {
  const flight = createSubmissionFlight();
  const response = deferred();
  const token = flight.beginSubmission();
  const handled = response.promise.then(() => flight.endSubmission(token));
  assert.equal(flight.hasActivity(), true);
  response.resolve({ error: "validation", rejectionProof: "after_lock" });
  assert.equal(await handled, true);
  assert.equal(flight.hasActivity(), false);
  assert.equal(canCorrectRejectedSubmission("after_lock", false), true);
  assert.equal(canCorrectRejectedSubmission("before_rpc", false), false);
});

test("pending and rejected markers survive refresh with frozen order, payment and POS identifiers", () => {
  const browser = makeStorage();
  const key = "3f112ef8-08df-47e4-b8e4-f0bb65d58172";
  const payload = JSON.stringify({ idempotencyKey: key, sessionId: "pos-session", payments: [{ idempotencyKey: "payment-key" }] });
  const pending = { version: 1, key, payload, status: "pending", orderId: null, orderNumber: null };
  assert.equal(persistSubmissionAttempt(browser, "attempt", pending), true);
  assert.deepEqual(readSubmissionAttempt(browser, "attempt"), { kind: "present", attempt: pending });
  const rejected = { ...pending, status: "rejected", rejectionReason: "validation" };
  assert.equal(persistSubmissionAttempt(browser, "attempt", rejected), true);
  assert.deepEqual(JSON.parse(readSubmissionAttempt(browser, "attempt").attempt.payload), JSON.parse(payload));
});

test("Terminal uses synchronous flight checks at every transition", async () => {
  const ui = await readFile(new URL("../src/components/shop-terminal/ShopTerminalWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /flightRef\.current\.beginSubmission\(\)/);
  assert.match(ui, /flightRef\.current\.beginStatusLookup\(\)/);
  assert.match(ui, /flightRef\.current\.hasActivity\(\) \|\| attemptRef\.current/);
  assert.match(ui, /!definitiveRejection \|\| draftHydration !== "ready" \|\| flightRef\.current\.hasActivity\(\)/);
  assert.match(ui, /flightRef\.current\.endSubmission\(token\)/);
  assert.match(ui, /inspectWorkspaceDiscard\(storage, namespace, workspace/);
  assert.match(ui, /storedWalkIn\.kind === "present" && !storedWalkIn\.customer\.isWalkIn/);
});
