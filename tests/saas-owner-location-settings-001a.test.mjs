import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyLocationSaveResult, parseLocationSettings } from "../src/features/location-settings/validation.ts";

const source = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

test("valid location edit normalizes optional fields and ISO country without altering identity", () => {
  const result = parseLocationSettings(form({
    name: "  Demo Counter  ", addressLine1: "  10 Main St  ", addressLine2: "",
    city: " Santa Cruz ", region: " Tenerife ", postalCode: "38600",
    countryCode: "es", phone: "+34 922 000 000",
  }));
  assert.equal(result.valid, true);
  assert.deepEqual(result.input, {
    name: "Demo Counter", addressLine1: "10 Main St", addressLine2: null,
    city: "Santa Cruz", region: "Tenerife", postalCode: "38600",
    countryCode: "ES", phone: "+34 922 000 000",
  });
  assert.equal(parseLocationSettings(form({ name: "Another", countryCode: "GB" })).valid, true);
  assert.equal(parseLocationSettings(form({ name: "Another", countryCode: "" })).valid, true);
});

test("rejects empty names, invalid countries, oversized fields and non-text input", () => {
  for (const fields of [
    { name: " " },
    { name: "Counter", countryCode: "SP" },
    { name: "Counter", countryCode: "ZZ" },
    { name: "Counter", countryCode: "ESP" },
    { name: "x".repeat(161) },
    { name: "Counter", postalCode: "x".repeat(33) },
  ]) assert.equal(parseLocationSettings(form(fields)).valid, false);
  const withFile = form({ name: "Counter" });
  withFile.set("city", new File(["text"], "city.txt"));
  assert.equal(parseLocationSettings(withFile).valid, false);
});

test("save result keeps validation, unavailable row and database failures distinct", () => {
  assert.equal(classifyLocationSaveResult(true, null), "saved");
  assert.equal(classifyLocationSaveResult(false, null), "unavailable");
  assert.equal(classifyLocationSaveResult(null, null), "unavailable");
  assert.equal(classifyLocationSaveResult(null, { code: "22023" }), "invalid");
  assert.equal(classifyLocationSaveResult(null, { code: "42501" }), "failure");
});

test("Owner routes and mutations bind both tenant and location; no service-role bypass", async () => {
  const [queries, actions, listPage, detailPage, settings] = await Promise.all([
    source("src/features/location-settings/server/queries.ts"),
    source("src/features/location-settings/server/actions.ts"),
    source("src/app/[locale]/app/(dashboard)/settings/locations/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/settings/locations/[locationId]/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/settings/page.tsx"),
  ]);
  assert.match(queries, /requireOwner\(locale\)/);
  assert.match(actions, /requireOwner\(locale\)/);
  assert.match(queries, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(queries, /\.eq\("id", locationId\)/);
  assert.match(actions, /requireOwner\(locale\)[\s\S]*\.rpc\("update_owner_location_settings"/);
  assert.match(actions, /target_location_id: locationId/);
  assert.match(actions, /classifyLocationSaveResult\(data, error\)/);
  assert.match(actions, /status !== "saved"/);
  assert.match(queries, /notFound\(\)/);
  assert.doesNotMatch(queries + actions, /createSupabaseAdminClient|service.role|organizationId.*formData/);
  assert.doesNotMatch(actions, /\.from\("locations"\)[\s\S]*\.update\(/);
  assert.match(listPage, /listOwnerLocations\(locale\)/);
  assert.match(detailPage, /getOwnerLocation\(locale, locationId\)/);
  assert.match(settings, /isOwner[\s\S]*href: "\/app\/settings\/locations"/);
  assert.match(actions, /target_name: parsed\.input\.name[\s\S]*target_phone: parsed\.input\.phone/);
  assert.doesNotMatch(actions, /insert\(|delete\(|organization_id:|is_active:|deleted_at:/);
});

test("five locales expose the same Owner location vocabulary", async () => {
  const keys = [];
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.settings.items.locations.title, "string");
    assert.equal(typeof messages.settings.items.locations.description, "string");
    keys.push(Object.keys(messages.locationSettings.fields).sort());
    assert.equal(typeof messages.locationSettings.saved, "string");
    assert.equal(typeof messages.locationSettings.invalid, "string");
    assert.equal(typeof messages.locationSettings.unavailable, "string");
    assert.equal(typeof messages.locationSettings.failure, "string");
  }
  for (const other of keys.slice(1)) assert.deepEqual(other, keys[0]);
});
