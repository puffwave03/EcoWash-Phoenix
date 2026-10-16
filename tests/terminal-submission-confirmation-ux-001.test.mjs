import assert from "node:assert/strict";
import test from "node:test";
import { terminal, content, button, labels, labelsFor, customer, service, submissionKey, draftKey, pendingAttempt } from "./helpers/shop-terminal-harness.mjs";

test("delayed submission shows waiting and blocks a second submit without changing its frozen identity", async () => {
  const ui = terminal();
  const request = ui.start();
  const frozen = ui.storage.getItem(submissionKey);
  const tree = ui.render();
  assert.ok(content(tree).includes(labels.submissionSaving));
  assert.ok(!content(tree).includes(labels.submissionUnknown));
  request.form.props.onSubmit(request.event);
  assert.equal(request.event.prevented, true);
  assert.equal(ui.calls.submit.length, 1);
  assert.equal(ui.storage.getItem(submissionKey), frozen);
  assert.equal(ui.calls.status.length, 0);
  ui.response.resolve({ error: "unknown", result: null });
  await request.settled;
});

for (const keepOtherDraft of [false, true]) test(`success frees the submitted draft; other customer draft present: ${keepOtherDraft}`, async () => {
  const ui = terminal();
  const drafts = new Map([[customer.id, { items: [service.id] }]]);
  if (keepOtherDraft) drafts.set("customer-b", { items: ["service-b"] });
  ui.refs.set("customerDraftsRef", { current: drafts });
  ui.storage.setItem(draftKey, JSON.stringify([...drafts]));
  ui.storage.setItem("diagnostic:2:submission", JSON.stringify(pendingAttempt));
  const request = ui.start();
  ui.response.resolve({ error: null, result: { customerId: customer.id, customerName: "A", isWalkIn: false,
    orderId: "order-a", orderNumber: "EW-TEST", total: 10, paid: 10, outstanding: 0 } });
  await request.settled;
  assert.ok(content(ui.render()).includes(labels.orderSuccess));
  ui.runEffect("const submittedCustomerId");
  assert.equal(ui.storage.getItem(submissionKey), null);
  assert.deepEqual(JSON.parse(ui.storage.getItem(draftKey)), keepOtherDraft ? [["customer-b", { items: ["service-b"] }]] : null);
  assert.equal(ui.calls.occupied.at(-1), keepOtherDraft);
  assert.ok(ui.storage.getItem("diagnostic:2:submission"));
  assert.equal(button(ui.render(), labels.newOrder).props.disabled, false);
});

for (const outcome of ["error", "throw"]) test(`uncertain ${outcome} retains warning, marker and submission lock`, async () => {
  const ui = terminal();
  const request = ui.start();
  const frozen = ui.storage.getItem(submissionKey);
  if (outcome === "throw") ui.response.reject(Error("Response unavailable"));
  else ui.response.resolve({ error: "generic", result: null });
  await request.settled;
  const tree = ui.render();
  assert.ok(content(tree).includes(labels.submissionUnknown));
  assert.ok(!content(tree).includes(labels.submissionSaving));
  assert.equal(button(tree, labels.submissionRetry), undefined);
  assert.equal(button(tree, labels.submissionCorrectDraft), undefined);
  request.form.props.onSubmit(request.event);
  assert.equal(request.event.prevented, true);
  assert.equal(ui.storage.getItem(submissionKey), frozen);
  assert.equal(ui.calls.submit.length, 1);
});

test("refresh restores pending identity as uncertain without automatic dispatch or status lookup", () => {
  const ui = terminal({ restored: pendingAttempt, refreshing: true });
  ui.render();
  ui.runEffect("const restored = readBrowserSubmission");
  ui.flushTimers();
  const tree = ui.render();
  assert.ok(content(tree).includes(labels.submissionUnknown));
  assert.ok(!content(tree).includes(labels.submissionSaving));
  assert.equal(ui.storage.getItem(submissionKey), JSON.stringify(pendingAttempt));
  assert.equal(ui.calls.submit.length, 0);
  assert.equal(ui.calls.status.length, 0);
});

test("not_found preserves identity and requires manual identical retry, which shows waiting", async () => {
  const ui = terminal({ restored: pendingAttempt });
  await button(ui.render(), labels.submissionCheck).props.onClick();
  let tree = ui.render();
  assert.ok(content(tree).includes(labels.submissionNotFound));
  assert.equal(button(tree, labels.submissionCorrectDraft), undefined);
  assert.equal(ui.calls.submit.length, 0);
  const retry = button(tree, labels.submissionRetry).props.onClick();
  tree = ui.render();
  assert.ok(content(tree).includes(labels.submissionSaving));
  assert.ok(!content(tree).includes(labels.submissionUnknown));
  assert.deepEqual(ui.calls.submit, [pendingAttempt.payload]);
  ui.response.resolve({ error: "generic", result: null });
  await retry;
  assert.equal(ui.storage.getItem(submissionKey), JSON.stringify(pendingAttempt));
  assert.ok(content(ui.render()).includes(labels.submissionUnknown));
});

test("status pending, completed, definitive rejection and storage warnings retain their own messages", async () => {
  const ui = terminal({ restored: pendingAttempt });
  ui.props.statusResult = { status: "pending", orderId: null, orderNumber: null };
  await button(ui.render(), labels.submissionCheck).props.onClick();
  assert.ok(content(ui.render()).includes(labels.submissionPending));
  ui.state.set("definitiveRejection", "till");
  assert.ok(content(ui.render()).includes(labels.submissionRejected));
  ui.state.set("attemptStorageLost", true);
  assert.ok(content(ui.render()).includes(labels.submissionStorageLost));
  const completed = terminal({ restored: { ...pendingAttempt, status: "completed", orderId: "order-a", orderNumber: "EW-TEST" } });
  assert.ok(content(completed.render()).includes(labels.submissionCompleted));
});

test("all five locales provide the waiting label and preserve matching translation keys", () => {
  const locales = ["it", "es", "en", "fr", "de"].map(labelsFor);
  for (const text of locales) {
    assert.equal(typeof text.submissionSaving, "string");
    assert.ok(text.submissionSaving.length > 10);
    assert.deepEqual(Object.keys(text).sort(), Object.keys(locales[0]).sort());
  }
  assert.equal(locales[0].submissionSaving, "Salvataggio ordine in corso… Attendi.");
  assert.equal(locales[1].submissionSaving, "Guardando pedido… Por favor, espera.");
});
