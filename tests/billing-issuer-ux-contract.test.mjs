import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("configured issuer defaults to a compact essential summary with edit affordance", async () => {
  const panel = await source("src/components/billing/BillingSettingsPanel.tsx");

  assert.match(panel, /defaultOpen=\{!settings\.isIssueReady\}/);
  assert.match(panel, /actionLabel=\{settings\.isIssueReady \? text\.edit : text\.review\}/);
  assert.match(panel, /statusLabel=\{settings\.isIssueReady \? text\.ready : text\.missing\}/);
  assert.match(panel, /summary=\{settings\.isIssueReady \? issuerSummary/);
  for (const field of ["issuerLegalName", "issuerTaxId", "issuerAddressLine1", "issuerCity", "issuerPostalCode", "issuerCountryCode"]) {
    assert.match(panel, new RegExp(`settings\\.${field}`));
  }
  assert.doesNotMatch(panel.slice(panel.indexOf("const issuerSummary"), panel.indexOf("return (")), /issuerEmail|issuerPhone|defaultSeries|defaultTaxRate/);
});

test("incomplete issuer stays open with suggestions missing fields and the canonical form", async () => {
  const panel = await source("src/components/billing/BillingSettingsPanel.tsx");

  assert.match(panel, /defaultOpen=\{!settings\.isIssueReady\}/);
  assert.match(panel, /!settings\.isIssueReady && settings\.autofilledFields\.length/);
  assert.match(panel, /!settings\.isIssueReady && settings\.missingRequiredFields\.length/);
  assert.match(panel, /settings\.missingRequiredFields\.map/);
  assert.match(panel, /requiredLabels\[field\]/);
  assert.match(panel, /action=\{saveBillingSettingsAction\.bind\(null, locale\)\}/);
});

test("Settings fiscal entry lands on the shared issuer configuration", async () => {
  const [settings, panel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/settings/page.tsx"),
    source("src/components/billing/BillingSettingsPanel.tsx"),
  ]);

  assert.equal((settings.match(/\/app\/billing#issuer-settings/g) ?? []).length, 1);
  assert.match(panel, /id="issuer-settings"/);
  assert.doesNotMatch(settings, /BillingSettingsPanel|saveBillingSettingsAction/);
});

test("issuer presentation preserves Owner Manager and Staff boundaries", async () => {
  const [page, actions, settings] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/billing/page.tsx"),
    source("src/features/billing/server/actions.ts"),
    source("src/app/[locale]/app/(dashboard)/settings/page.tsx"),
  ]);

  assert.match(page, /requireOwnerOrManager\(locale\)/);
  assert.match(page, /access\.membership\.role === "owner" \? <BillingSettingsPanel/);
  assert.match(page, /managerMissing/);
  assert.match(actions, /saveBillingSettingsAction[\s\S]*requireOwner\(locale\)/);
  assert.match(settings, /isOwner && entitlementEnabled\(entitlements, FEATURES\.billingInvoicing\)/);
});

test("issuer disclosure remains semantic focus-visible and narrow-screen safe", async () => {
  const disclosure = await source("src/components/DisclosureSection.tsx");

  assert.match(disclosure, /<button/);
  assert.match(disclosure, /aria-expanded=\{isOpen\}/);
  assert.match(disclosure, /aria-controls=\{contentId\}/);
  assert.match(disclosure, /focus-visible:ring-2/);
  assert.match(disclosure, /min-h-16 w-full/);
  assert.match(disclosure, /max-w-\[48%\]/);
  assert.match(disclosure, /break-words/);
});
