import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const formSource = () => source("src/components/portal/CustomerOrderRequestForm.tsx");

test("failed client review shows one focused, accessible summary before the form sections", async () => {
  const form = await formSource();
  const editing = form.slice(form.indexOf("  return (\n    <div className=\"space-y-6\">"));
  assert.match(editing, /Object\.keys\(clientErrors\)\.length > 0 \? \(/);
  assert.ok(editing.indexOf("ref={validationSummaryRef}") < editing.indexOf('id="portal-request-services"'));
  assert.match(editing, /ref=\{validationSummaryRef\}[\s\S]*role="alert" tabIndex=\{-1\}/);
  assert.match(form, /useEffect\(\(\) => \{\s*if \(validationFocusRequest > 0\) validationSummaryRef\.current\?\.focus\(\);\s*\}, \[validationFocusRequest\]\)/);
});

test("the existing client rules and field errors remain visible and update after edits", async () => {
  const form = await formSource();
  const validation = form.slice(form.indexOf("function reviewErrors()"), form.indexOf("function handleSubmit("));
  for (const rule of [
    "selectedItems.length === 0", "quantity > 10000", "Number(quantity.toFixed(3)) !== quantity",
    "isDiscreteServiceUnit(service.unitType)", "!selectedProperty", "!completeProperty(selectedProperty)",
    "!requestedPickupAt", "requestedPickupAt <= minimumPickupAt",
  ]) assert.ok(validation.includes(rule), `missing rule: ${rule}`);
  assert.match(validation, /const clientErrors = validationAttempted \? reviewErrors\(\) : \{\}/);
  for (const key of ["items", "propertyId", "requestedPickupAt"]) {
    assert.match(form, new RegExp(`clientErrors\\.${key} \\? <p[^>]+role="alert"`));
  }
  assert.match(form, /aria-describedby=\{clientErrors\.propertyId/);
  assert.match(form, /aria-describedby=\{clientErrors\.requestedPickupAt/);
});

test("summary guidance follows service, property, pickup order and targets visible areas", async () => {
  const form = await formSource();
  const summary = form.slice(form.indexOf("ref={validationSummaryRef}"), form.indexOf('aria-labelledby="portal-request-services"'));
  const targets = ["serviceHeadingRef", "propertySelectRef", "pickupInputRef"];
  const positions = targets.map((target) => summary.indexOf(`${target}.current?.focus()`));
  assert.ok(positions.every((position) => position >= 0));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
  assert.match(form, /ref=\{serviceHeadingRef\}[\s\S]*id="portal-request-services" tabIndex=\{-1\}/);
  assert.match(form, /ref=\{propertySelectRef\}/);
  assert.match(form, /ref=\{pickupInputRef\}/);
});

test("failed validation stays on edit form; valid validation enters existing review", async () => {
  const form = await formSource();
  const validation = form.slice(form.indexOf("function validateReview()"), form.indexOf("function handleSubmit("));
  assert.match(validation, /if \(Object\.keys\(errors\)\.length === 0\) \{[\s\S]*setReviewing\(true\)/);
  assert.match(validation, /\} else \{\s*setValidationFocusRequest\(\(request\) => request \+ 1\)/);
  assert.doesNotMatch(validation, /formAction|actionInFlightRef|handleSubmit/);
  assert.match(form, /if \(reviewing\) \{\s*return \(\s*<form action=\{formAction\}/);
});

test("server action error alert remains separate on the review screen", async () => {
  const form = await formSource();
  const review = form.slice(form.indexOf("if (reviewing) {"), form.indexOf("  return (\n    <div className=\"space-y-6\">"));
  assert.match(form, /const serverError = state\.formError \? text\.errors\[state\.formError\] : null/);
  assert.match(review, /serverError \|\| serverValidationError \? \(/);
  assert.match(review, /role="alert"/);
  assert.doesNotMatch(review, /validationSummaryRef|text\.validationSummary/);
});

test("all supported locales supply the new Portal summary text through the page", async () => {
  const page = await source("src/app/[locale]/portal/requests/new/page.tsx");
  assert.match(page, /validationSummary: t\("request\.validationSummary"\)/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.portal.request.validationSummary?.trim(), `${locale} summary missing`);
  }
});
