import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const paths = {
  action: "src/features/platform-admin/server/tenant-onboarding.ts",
  identity: "src/features/platform-admin/server/owner-identity.ts",
  validation: "src/features/platform-admin/tenant-onboarding-validation.ts",
};

async function renderForm(state) {
  const source = await readFile(new URL("../src/components/platform/PlatformTenantOnboardingForm.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  const requireMock = (specifier) => {
    if (specifier === "react") return { useState: React.useState, useActionState: () => [state, () => {}, false] };
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "@/components/Button") return { Button: (props) => React.createElement("button", props) };
    if (specifier === "@/components/Card") return { Card: (props) => React.createElement("div", props) };
    if (specifier === "@/i18n/navigation") return { Link: (props) => React.createElement("a", props) };
    if (specifier === "@/features/platform-admin/tenant-onboarding-validation") return { suggestTenantSlug: (name) => name };
    throw new Error(`unexpected component import: ${specifier}`);
  };
  new Function("require", "exports", compiled)(requireMock, exports);
  const messages = JSON.parse(await readFile(new URL("../src/i18n/en/common.json", import.meta.url), "utf8"));
  return renderToStaticMarkup(React.createElement(exports.PlatformTenantOnboardingForm, {
    action: () => {}, initialKey: "test-key", locale: "en", text: messages.platform.onboarding,
  }));
}

async function interactiveForm(initialState) {
  const source = await readFile(new URL("../src/components/platform/PlatformTenantOnboardingForm.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const slots = [];
  let slot = 0;
  let actionState = initialState;
  let submitted;
  let transitionCalls = 0;
  const exports = {};
  const useState = (initial) => {
    const index = slot++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (value) => { slots[index] = value; }];
  };
  const requireMock = (specifier) => {
    if (specifier === "react") return {
      useState,
      useActionState: () => [actionState, (data) => { submitted = data; }, false],
      startTransition: (callback) => { transitionCalls++; callback(); },
    };
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "@/components/Button") return { Button: "button" };
    if (specifier === "@/components/Card") return { Card: "div" };
    if (specifier === "@/i18n/navigation") return { Link: "a" };
    if (specifier === "@/features/platform-admin/tenant-onboarding-validation") return { suggestTenantSlug: (name) => name };
    throw new Error(`unexpected component import: ${specifier}`);
  };
  class CapturedFormData {
    constructor(form) { this.form = form; }
  }
  new Function("require", "exports", "FormData", compiled)(requireMock, exports, CapturedFormData);
  const messages = JSON.parse(await readFile(new URL("../src/i18n/en/common.json", import.meta.url), "utf8"));
  const render = () => {
    slot = 0;
    return exports.PlatformTenantOnboardingForm({ action: () => {}, initialKey: "test-key", locale: "en", text: messages.platform.onboarding });
  };
  const find = (root, predicate) => {
    if (Array.isArray(root)) return root.map((child) => find(child, predicate)).find(Boolean);
    if (!root || typeof root !== "object") return undefined;
    if (predicate(root)) return root;
    return find(root.props?.children, predicate);
  };
  return {
    render,
    input: (name, value) => find(render(), (node) => node.type === "input" && node.props.name === name && (value === undefined || node.props.value === value)),
    select: (name) => find(render(), (node) => node.type === "select" && node.props.name === name),
    form: () => find(render(), (node) => node.type === "form"),
    setResult: (result) => { actionState = result; },
    submission: () => ({ data: submitted, transitionCalls }),
  };
}

function assertSelectedMode(html, mode) {
  assert.match(html, new RegExp(`<input(?=[^>]*checked="")(?=[^>]*name="ownerMode")(?=[^>]*value="${mode}")[^>]*>`));
}

async function harness() {
  const users = new Map();
  const profiles = new Set();
  const receipts = new Map();
  const slugs = new Set();
  const calls = { invites: 0, verifications: 0, rpc: 0, guard: 0 };
  const flags = { deny: false, profileReady: true, rpcError: null };
  const admin = {
    auth: { admin: {
      inviteUserByEmail: async (email) => {
        calls.invites++;
        const id = randomUUID();
        const user = { id, email, identities: [{ provider: "email", identity_data: { email } }] };
        users.set(id, user);
        if (flags.profileReady) profiles.add(id);
        return { data: { user }, error: null };
      },
      getUserById: async (id) => {
        calls.verifications++;
        return { data: { user: users.get(id) ?? null }, error: null };
      },
    } },
    from: (table) => {
      assert.equal(table, "profiles");
      return { select: () => ({ eq: (_column, id) => ({ maybeSingle: async () => ({
        data: profiles.has(id) ? { id } : null, error: null,
      }) }) }) };
    },
  };
  const session = { rpc: async (name, input) => {
    assert.equal(name, "platform_bootstrap_tenant");
    calls.rpc++;
    if (flags.rpcError) return { data: null, error: { message: flags.rpcError } };
    const prior = receipts.get(input.target_idempotency_key);
    if (prior) {
      if (prior.slug !== input.target_slug) return { data: null, error: { message: "platform_tenant_bootstrap_idempotency_conflict" } };
      return { data: [{ organization_id: prior.id, organization_slug: prior.slug, replayed: true }], error: null };
    }
    if (slugs.has(input.target_slug)) return { data: null, error: { message: "platform_tenant_bootstrap_slug_conflict" } };
    const id = randomUUID();
    receipts.set(input.target_idempotency_key, { id, slug: input.target_slug });
    slugs.add(input.target_slug);
    return { data: [{ organization_id: id, organization_slug: input.target_slug, replayed: false }], error: null };
  } };
  const mocks = {
    "next/cache": { revalidatePath: () => {} },
    "@/config/site": { siteConfig: { url: "http://localhost:3000" } },
    "@/lib/auth/require-platform-admin": { requirePlatformAdmin: async () => {
      calls.guard++;
      if (flags.deny) throw new Error("denied");
    } },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => admin },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => session },
    "@/i18n/routing": { routing: { locales: ["en", "it", "es", "fr", "de"] } },
    "server-only": {},
  };
  const compiled = {};
  for (const [name, path] of Object.entries(paths)) {
    const src = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    compiled[name] = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  }
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {};
    const imports = {
      "@/features/platform-admin/server/owner-identity": "identity",
      "@/features/platform-admin/tenant-onboarding-validation": "validation",
    };
    const customRequire = (specifier) => imports[specifier] ? load(imports[specifier]) :
      specifier === "node:crypto" ? { randomUUID } : mocks[specifier];
    new Function("require", "exports", compiled[name])(customRequire, exports);
    cache[name] = exports;
    return exports;
  }
  const initial = () => ({ key: randomUUID(), fingerprint: null, ownerMode: "invite", fieldErrors: {}, error: null, preparedOwner: null, success: null });
  const form = (overrides = {}) => {
    const data = new FormData();
    const fields = {
      name: "Test Laundry", slug: "test-laundry", currency: "USD", timezone: "UTC", locale: "en",
      country: "US", location: "First site", ownerEmail: "owner@example.test", ownerMode: "invite", ownerId: "", ...overrides,
    };
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  return { action: load("action").bootstrapTenantAction, users, profiles, calls, flags, initial, form, slugs };
}

test("new invited Owner is verified and bootstrapped before acceptance; exact replay reuses key", async () => {
  const h = await harness();
  const form = h.form();
  const first = await h.action("en", h.initial(), form);
  assert.equal(h.calls.guard, 1);
  assert.equal(h.calls.invites, 1);
  assert.equal(h.calls.verifications, 1);
  assert.equal(first.success?.invitation, "requested");
  assert.equal(first.success?.replayed, false);
  const replay = await h.action("en", first, form);
  assert.equal(replay.key, first.key);
  assert.equal(replay.success?.organizationId, first.success.organizationId);
  assert.equal(replay.success?.replayed, true);
  assert.equal(h.calls.invites, 1);
});

test("existing UUID and exact email bootstrap without invitation; mismatch blocks RPC", async () => {
  const h = await harness();
  const id = randomUUID();
  h.users.set(id, { id, email: "owner@example.test", identities: [{ provider: "email", identity_data: { email: "owner@example.test" } }] });
  h.profiles.add(id);
  const good = await h.action("en", h.initial(), h.form({ ownerMode: "existing", ownerId: id }));
  assert.equal(good.success?.invitation, "existing");
  assert.equal(h.calls.invites, 0);
  const bad = await h.action("en", h.initial(), h.form({ ownerMode: "existing", ownerId: id, ownerEmail: "other@example.test" }));
  assert.equal(bad.error, "identityMismatch");
  assert.equal(bad.ownerMode, "existing");
  assert.deepEqual(bad.preparedOwner, { id, email: "other@example.test" });
  const html = await renderForm(bad);
  assertSelectedMode(html, "existing");
  assert.match(html, /name="ownerId"[^>]*value="[^"]+"/);
  assert.match(html, /name="ownerEmail"[^>]*value="other@example.test"/);
  assert.equal(h.calls.rpc, 1);
  assert.equal(h.calls.invites, 0);
});

test("existing Owner and selected locale survive mismatch, membership and slug action responses", async () => {
  for (const rpcError of [null, "platform_tenant_bootstrap_owner_membership_conflict", "platform_tenant_bootstrap_slug_conflict"]) {
    const h = await harness();
    const id = randomUUID();
    h.users.set(id, { id, email: "owner@example.test", identities: [{ provider: "email", identity_data: { email: "owner@example.test" } }] });
    h.profiles.add(id);
    h.flags.rpcError = rpcError;
    const ui = await interactiveForm(h.initial());
    ui.input("ownerMode", "existing").props.onChange();
    ui.input("ownerId").props.onChange({ target: { value: id } });
    ui.input("ownerEmail").props.onChange({ target: { value: rpcError ? "owner@example.test" : "other@example.test" } });
    ui.select("locale").props.onChange({ target: { value: "es" } });
    for (const [field, value] of Object.entries({ currency: "EUR", timezone: "Atlantic/Canary", country: "ES", location: "First laundry" })) {
      ui.input(field).props.onChange({ target: { value } });
    }
    const marker = {};
    let prevented = false;
    assert.equal(ui.form().props.action, undefined);
    ui.form().props.onSubmit({ preventDefault: () => { prevented = true; }, currentTarget: marker });
    assert.equal(prevented, true);
    assert.equal(ui.submission().data.form, marker);
    assert.equal(ui.submission().transitionCalls, 1);
    const result = await h.action("en", h.initial(), h.form({
      ownerMode: "existing", ownerId: id, ownerEmail: rpcError ? "owner@example.test" : "other@example.test", locale: "es",
    }));
    ui.setResult(result);
    assert.equal(ui.input("ownerMode", "existing").props.checked, true);
    assert.equal(ui.input("ownerMode", "invite").props.checked, false);
    assert.equal(ui.input("ownerId").props.value, id);
    assert.equal(ui.input("ownerEmail").props.value, rpcError ? "owner@example.test" : "other@example.test");
    assert.equal(ui.select("locale").props.value, "es");
    for (const [field, value] of Object.entries({ currency: "EUR", timezone: "Atlantic/Canary", country: "ES", location: "First laundry" })) {
      assert.equal(ui.input(field).props.value, value);
    }
    assert.equal(h.calls.invites, 0);
  }
});

test("explicit invite selection survives an invite-path error without an extra invitation on render", async () => {
  const h = await harness();
  h.flags.rpcError = "platform_tenant_bootstrap_slug_conflict";
  const ui = await interactiveForm(h.initial());
  ui.input("ownerMode", "existing").props.onChange();
  ui.input("ownerMode", "invite").props.onChange();
  const result = await h.action("en", h.initial(), h.form());
  assert.equal(h.calls.invites, 1);
  ui.setResult(result);
  assert.equal(ui.input("ownerMode", "invite").props.checked, true);
  assert.equal(ui.input("ownerMode", "existing").props.checked, false);
  assert.equal(h.calls.invites, 1);
});

test("missing profile after invitation returns recovery identity and never calls bootstrap", async () => {
  const h = await harness();
  h.flags.profileReady = false;
  const result = await h.action("en", h.initial(), h.form());
  assert.equal(result.error, "identityIncomplete");
  assert.equal(result.ownerMode, "invite");
  assertSelectedMode(await renderForm(result), "invite");
  assert.ok(result.preparedOwner?.id);
  assert.equal(h.calls.rpc, 0);
  assert.equal(h.calls.invites, 1);
});

test("invite mode remains selected on validation failure without inviting", async () => {
  const h = await harness();
  const result = await h.action("en", h.initial(), h.form({ ownerEmail: "invalid" }));
  assert.equal(result.ownerMode, "invite");
  assert.equal(result.fieldErrors.ownerEmail, "invalidEmail");
  assertSelectedMode(await renderForm(result), "invite");
  assert.equal(h.calls.invites, 0);
  assert.equal(h.calls.rpc, 0);
});

test("slug collision preserves invited identity; recovery with changed slug avoids second invite", async () => {
  const h = await harness();
  h.slugs.add("test-laundry");
  const failed = await h.action("en", h.initial(), h.form());
  assert.equal(failed.error, "slugConflict");
  assert.equal(failed.ownerMode, "invite");
  assertSelectedMode(await renderForm(failed), "invite");
  assert.ok(failed.preparedOwner?.id);
  const recovered = await h.action("en", failed, h.form({ slug: "test-laundry-2", ownerMode: "existing", ownerId: failed.preparedOwner.id }));
  assert.ok(recovered.success?.organizationId);
  assert.notEqual(recovered.key, failed.key);
  assert.equal(h.calls.invites, 1);
});

test("existing Owner membership and slug errors retain selected mode and recovery values without inviting", async () => {
  for (const [rpcError, expected] of [
    ["platform_tenant_bootstrap_owner_membership_conflict", "ownerMembershipConflict"],
    ["platform_tenant_bootstrap_slug_conflict", "slugConflict"],
  ]) {
    const h = await harness();
    const id = randomUUID();
    h.users.set(id, { id, email: "owner@example.test", identities: [{ provider: "email", identity_data: { email: "owner@example.test" } }] });
    h.profiles.add(id);
    h.flags.rpcError = rpcError;
    const result = await h.action("en", h.initial(), h.form({ ownerMode: "existing", ownerId: id }));
    assert.equal(result.error, expected);
    assert.equal(result.ownerMode, "existing");
    assert.deepEqual(result.preparedOwner, { id, email: "owner@example.test" });
    const invitesBeforeRender = h.calls.invites;
    const html = await renderForm(result);
    assertSelectedMode(html, "existing");
    assert.match(html, new RegExp(`name="ownerId"[^>]*value="${id}"`));
    assert.match(html, /name="ownerEmail"[^>]*value="owner@example.test"/);
    assert.equal(h.calls.invites, invitesBeforeRender);
    assert.equal(h.calls.invites, 0);
    assert.equal(h.calls.rpc, 1);
  }
});

test("membership and Portal conflicts map safely and keep the Owner for recovery", async () => {
  for (const [dbError, expected] of [
    ["platform_tenant_bootstrap_owner_membership_conflict", "ownerMembershipConflict"],
    ["platform_tenant_bootstrap_owner_portal_conflict", "ownerPortalConflict"],
  ]) {
    const h = await harness();
    h.flags.rpcError = dbError;
    const result = await h.action("en", h.initial(), h.form());
    assert.equal(result.error, expected);
    assert.ok(result.preparedOwner?.id);
    assert.equal(h.calls.invites, 1);
  }
});

test("invite success plus database failure exposes recovery identity and later recovery does not invite", async () => {
  const h = await harness();
  h.flags.rpcError = "platform_tenant_bootstrap_slug_conflict";
  const failed = await h.action("en", h.initial(), h.form());
  assert.equal(failed.preparedOwner.email, "owner@example.test");
  h.flags.rpcError = null;
  const result = await h.action("en", failed, h.form({ ownerMode: "existing", ownerId: failed.preparedOwner.id }));
  assert.ok(result.success);
  assert.equal(h.calls.invites, 1);
});

test("non-Platform Admin is denied before Auth Admin or RPC work", async () => {
  const h = await harness();
  h.flags.deny = true;
  await assert.rejects(h.action("en", h.initial(), h.form()), /denied/);
  assert.equal(h.calls.invites, 0);
  assert.equal(h.calls.rpc, 0);
});
