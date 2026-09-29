import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const form = await readFile(new URL("../src/components/orders/OrderForm.tsx", import.meta.url), "utf8");
const customerSelect = form.match(/<select\b[^>]*name="customerId"[\s\S]*?<\/select>/)?.[0];
const propertySelect = form.match(/<select\b[^>]*name="propertyId"[\s\S]*?<\/select>/)?.[0];

test("new orders filter loaded properties by the selected customer", () => {
  assert.match(form, /const visibleProperties = order\s*\? properties\s*: properties\.filter\(\(property\) => property\.customerId === customerId\)/);
  assert.match(propertySelect, /visibleProperties\.map/);
  assert.match(customerSelect, /value=\{customerId\}/);
  assert.match(propertySelect, /value=\{propertyId\}/);
});

test("changing or clearing the customer clears the selected property", () => {
  assert.match(customerSelect, /onChange=\{\(event\) => \{\s*setCustomerId\(event\.target\.value\);\s*setPropertyId\(""\);\s*\}\}/);
  assert.match(propertySelect, /disabled=\{Boolean\(order\) \|\| !customerId\}/);
});

test("property is optional and never automatically selected", () => {
  assert.match(form, /\[propertyId, setPropertyId\] = useState\(order\?\.propertyId \?\? ""\)/);
  assert.match(propertySelect, /<option value="" \/>/);
  assert.doesNotMatch(propertySelect, /\brequired\b/);
  assert.match(propertySelect, /onChange=\{\(event\) => setPropertyId\(event\.target\.value\)\}/);
  assert.equal((form.match(/setPropertyId\(/g) ?? []).length, 2);
});

test("initialCustomerId seeds the customer used by the first property render", () => {
  assert.match(form, /\[customerId, setCustomerId\] = useState\(order\?\.customerId \?\? initialCustomerId \?\? ""\)/);
  assert.match(customerSelect, /value=\{customerId\}/);
});

test("edit orders retain existing options, disabled controls and original hidden values", () => {
  assert.match(form, /const visibleProperties = order\s*\? properties/);
  assert.match(customerSelect, /disabled=\{Boolean\(order\)\}/);
  assert.match(propertySelect, /disabled=\{Boolean\(order\) \|\| !customerId\}/);
  assert.match(form, /\{order \? \([\s\S]*<input name="customerId" type="hidden" value=\{order\.customerId\} \/>\s*<input name="propertyId" type="hidden" value=\{order\.propertyId \?\? ""\} \/>/);
});
