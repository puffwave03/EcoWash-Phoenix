import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Real TSX rendering with supplied form-status and DOM-effect doubles. No app
// server, real action submission, browser layout, Supabase or fiscal documents.
const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const messages = (locale) => JSON.parse(read(`src/i18n/${locale}/common.json`)).billing;
const settings = { isIssueReady: true, organizationName: "[tenant]", issuerLegalName: "[name]",
  issuerTaxId: "", issuerAddressLine1: "", issuerAddressLine2: "", issuerCity: "", issuerRegion: "",
  issuerPostalCode: "", issuerCountryCode: "", issuerEmail: "", issuerPhone: "", defaultSeries: "A",
  defaultTaxRate: 7, simplifiedSeries: null, autofilledFields: [], missingRequiredFields: [] };

function harness({ pending = false, role = "owner", locale = "en" } = {}) {
  const effects = [], dom = [], modules = new Map();
  const target = { focus(options) { dom.push(["focus", options]); }, scrollIntoView(options) { dom.push(["scroll", options]); } };
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const m = { exports: {} };
    const deps = {
      react: { ...require("react"), useEffect: (effect) => effects.push(effect), useRef: () => ({ current: target }) },
      "react-dom": { useFormStatus: () => ({ pending }) },
      "react/jsx-runtime": require("react/jsx-runtime"),
      "@/components/DisclosureSection": { DisclosureSection: ({ children, defaultOpen, ...props }) => createElement("section", { id: props.id, "data-open": defaultOpen }, children) },
      "@/features/billing/server/actions": { saveBillingSettingsAction() {}, reserveBillingSimplifiedSeriesAction() {} },
      "@/lib/auth/require-role": { requireOwnerOrManager: async () => {
        if (!["owner", "manager"].includes(role)) throw Error("ROLE_DENIED");
        return { membership: { role } };
      } },
      "next-intl/server": { getTranslations: async () => {
        const text = messages(locale), get = (key) => key.split(".").reduce((value, part) => value[part], text);
        const t = (key) => { const value = get(key); assert.equal(typeof value, "string", key); return value; };
        t.raw = get; return t;
      } },
      "@/features/billing/server/queries": { getBillingSettings: async () => settings,
        listBillingInvoices: async () => ({ items: [] }), getBillingHistorySummary: async () => ({ currency: "EUR", invoiceCount: 0, draftCount: 0, issuedTotal: 0, outstanding: 0 }) },
      "@/features/billing/pagination": { normalizeBillingFilters: () => ({ status: "all" }) },
      "@/components/Card": { Card: ({ children }) => createElement("div", null, children) },
      "@/components/operational/OperationalUi": { PageHeader: () => null, SummaryCard: () => null },
      "@/components/billing/BillingStatusBadge": { BillingStatusBadge: () => null },
      "@/i18n/navigation": { Link: ({ children, href }) => createElement("a", { href }, children) },
      "@/lib/number-format": { formatCurrency: (value) => String(value) },
    };
    runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText, {
      module: m, exports: m.exports,
      require(name) {
        if (Object.hasOwn(deps, name)) return deps[name];
        if (name === "@/features/billing/tax-rate") return load("src/features/billing/tax-rate.ts");
        if (name.startsWith("@/components/")) return load(`src/${name.slice(2)}.tsx`);
        throw Error(`Unexpected import: ${name}`);
      },
    });
    modules.set(path, m.exports); return m.exports;
  }
  const render = (component, props) => renderToStaticMarkup(createElement(component, props));
  return {
    effects, dom,
    controls(saved = false) {
      const text = messages(locale).settings;
      return render(load("src/components/billing/BillingIssuerSaveControls.tsx").BillingIssuerSaveControls,
        { label: text.save, pendingLabel: text.saving, savedLabel: text.saved, saved });
    },
    panel(saved = false) { return render(load("src/components/billing/BillingSettingsPanel.tsx").BillingSettingsPanel, { locale, settings, text: messages(locale).settings, saved }); },
    async page(query) {
      const page = await load("src/app/[locale]/app/(dashboard)/billing/page.tsx").default({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
      return renderToStaticMarkup(page);
    },
  };
}

test("issuer submit initially shows the normal label, enabled, without a confirmation", () => {
  const html = harness().controls();
  assert.match(html, /type="submit"/);
  assert.match(html, /Save issuer settings/);
  assert.match(html, /aria-busy="false"/);
  assert.doesNotMatch(html, /disabled=""|Issuer settings saved\./);
});

for (const locale of ["en", "it", "es", "fr", "de"]) {
  test(`${locale}: pending status disables the native submit button and announces localized progress`, () => {
    const h = harness({ pending: true, locale });
    const html = h.controls(true);
    assert.match(html, /<button(?=[^>]*disabled="")(?=[^>]*type="submit")/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /aria-live="polite"/);
    assert.ok(html.includes(messages(locale).settings.saving));
    assert.ok(!html.includes(messages(locale).settings.saved));
    h.effects.forEach((effect) => effect());
    assert.equal(h.dom.length, 0, "No success focus/scroll while submitting");
  });
}

test("confirmed success is adjacent to the issuer button, focusable and scrolled into view", () => {
  const h = harness();
  const html = h.controls(true);
  assert.match(html, /id="issuer-save-feedback"[^>]*tabindex="-1"/);
  assert.match(html, /<button[\s\S]*<p[^>]*role="status">Issuer settings saved\.<\/p>/);
  h.effects.forEach((effect) => effect());
  assert.deepEqual(h.dom.map(([name]) => name), ["focus", "scroll"]);
  assert.equal(h.dom[0][1].preventScroll, true);
  assert.equal(h.dom[1][1].block, "center");
});

test("an unsaved/error result never announces success or moves focus", () => {
  const h = harness();
  assert.ok(!h.controls(false).includes(messages("en").settings.saved));
  h.effects.forEach((effect) => effect());
  assert.equal(h.dom.length, 0);
});

test("navigation opens a complete issuer panel only for the distinct successful issuer save", async () => {
  const saved = await harness().page({ saved: "issuerSettings" });
  assert.match(saved, /id="issuer-settings" data-open="true"/);
  assert.ok(saved.includes(messages("en").settings.saved));
  const normal = await harness().page({});
  assert.match(normal, /id="issuer-settings" data-open="false"/);
  assert.ok(!normal.includes(messages("en").settings.saved));
  // Shared DisclosureSection only reads defaultOpen on mount. The local key
  // remounts it when transitioning from ordinary display to saved feedback.
  assert.match(read("src/components/billing/BillingSettingsPanel.tsx"), /key=\{saved \? "issuer-saved" : "issuer-settings"\}/);
});

test("series reservation keeps its own form/button and cannot trigger issuer confirmation", async () => {
  const h = harness({ pending: true });
  const html = h.panel();
  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((m) => m[0]);
  assert.equal(forms.length, 2);
  assert.match(forms[0], /issuer-save-feedback/);
  assert.match(forms[0], /disabled=""/);
  assert.match(forms[1], /name="simplifiedSeries"/);
  assert.doesNotMatch(forms[1], /disabled=|issuer-save-feedback|aria-busy/);
  const seriesSaved = await harness().page({ saved: "settings" });
  assert.ok(!seriesSaved.includes(messages("en").settings.saved));
});

test("an error overrides any saved marker and retains accessible error feedback", async () => {
  for (const saved of [undefined, "issuerSettings", "settings"]) {
    const html = await harness().page({ saved, error: "generic" });
    assert.match(html, /role="alert"/);
    assert.ok(html.includes(messages("en").errors.generic));
    assert.ok(!html.includes(messages("en").settings.saved));
    assert.ok(!html.includes(messages("en").issuerSettingsSaved));
  }
});

test("Owner/Manager presentation remains separate and Staff is denied", async () => {
  assert.match(await harness().page({}), /id="issuer-settings"/);
  assert.doesNotMatch(await harness({ role: "manager" }).page({ saved: "issuerSettings" }), /id="issuer-settings"|issuer-save-feedback/);
  await assert.rejects(harness({ role: "staff" }).page({}), /ROLE_DENIED/);
});

test("five locales have consistent feedback keys and neutral success wording", () => {
  let keys;
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const text = messages(locale).settings;
    for (const key of ["save", "saving", "saved"]) assert.equal(typeof text[key], "string");
    assert.equal(new Set([text.save, text.saving, text.saved]).size, 3);
    if (keys) assert.deepEqual(Object.keys(text).sort(), keys); else keys = Object.keys(text).sort();
  }
});
