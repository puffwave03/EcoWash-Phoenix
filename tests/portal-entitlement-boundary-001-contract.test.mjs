import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const actions = readFileSync("src/features/portal/server/actions.ts", "utf8");
const preview = readFileSync("src/app/[locale]/portal/preview-test/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261014000200_portal_entitlement_boundary_001.sql",
  "utf8",
);

function bodyBetween(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `missing scoped body: ${start}`);
  return source.slice(first, last);
}

test("invitation and recovery emails cannot precede the effective Portal entitlement check", () => {
  const invite = bodyBetween(
    actions,
    "export async function inviteCustomerPortalAction",
    "export async function manageCustomerPortalAccessAction",
  );
  const inviteGate = invite.indexOf("hasEntitlement(locale, FEATURES.corePortal)");
  assert.ok(inviteGate >= 0);
  for (const effect of ["inviteUserByEmail", "generateLink", "signInWithOtp"]) {
    assert.ok(invite.indexOf(effect) > inviteGate, `${effect} preceded the Portal gate`);
  }

  const management = actions.slice(actions.indexOf("export async function manageCustomerPortalAccessAction"));
  const recovery = management.slice(management.indexOf('if (intent === "resend" || intent === "resetPassword")'));
  const recoveryGate = recovery.indexOf("hasEntitlement(locale, FEATURES.corePortal)");
  assert.ok(recoveryGate >= 0);
  assert.ok(recovery.indexOf("signInWithOtp") > recoveryGate);
  assert.ok(recovery.indexOf("resetPasswordForEmail") > recoveryGate);
  assert.ok(management.indexOf('intent === "disable"') < management.indexOf('intent === "resend"'));
});

test("disabled staging preview cannot reach Auth even for an entitled tenant", () => {
  assert.match(preview, /status: 404/);
  assert.doesNotMatch(preview, /import\s|createSupabase|createServerClient|generateLink|setSession|fetch\(/);
});

test("migration keeps the first active Portal context and does not backfill access or entitlements", () => {
  const canonical = bodyBetween(
    migration,
    "create or replace function public.customer_portal_current_access()",
    "create or replace function public.get_customer_portal_ordering_context()",
  );
  assert.match(canonical, /selected_access as materialized/);
  assert.ok(canonical.indexOf("limit 1") < canonical.indexOf("organization_entitlement_is_enabled"));
  assert.doesNotMatch(migration, /^insert into public\.(organization_entitlements|customer_portal_access)/im);
  assert.doesNotMatch(migration, /grant\s+(?:all|execute|select|update)\s+on/i);
  assert.match(migration, /if target_is_active\s+and not public\.organization_entitlement_is_enabled/s);
});

test("invitation never invokes Auth for unavailable entitlement, unauthorized actor or foreign customer", async () => {
  const compiled = ts.transpileModule(actions, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  async function runCase({ role = "owner", entitled = true, customer = { id: "own" }, intent = "invite", portalAccess = { id: "access", email: "synthetic@example.test", is_active: true, user_id: "auth-user" } }) {
    const authCalls = [];
    const filters = [];
    let rpcCalls = 0;
    const query = {
      select() { return this; },
      eq(field, value) { filters.push([field, value]); return this; },
      async maybeSingle() { return { data: intent === "invite" ? customer : portalAccess, error: null }; },
    };
    const supabase = {
      from(table) { assert.equal(table, intent === "invite" ? "customers" : "customer_portal_access"); return query; },
      async rpc(name) { assert.equal(name, "upsert_customer_portal_access"); rpcCalls++; return { error: null }; },
    };
    const admin = { auth: {
      admin: {
        async inviteUserByEmail() { authCalls.push("invite"); return { data: { user: { id: "auth-user" } }, error: null }; },
        async generateLink() { authCalls.push("link"); throw Error("unexpected link"); },
        async getUserById() { authCalls.push("lookup"); return { data: { user: { email: "synthetic@example.test" } }, error: null }; },
      },
      async signInWithOtp() { authCalls.push("otp"); throw Error("unexpected otp"); },
      async resetPasswordForEmail() { authCalls.push("recovery"); throw Error("unexpected recovery"); },
    } };
    const mocks = {
      "next/cache": { revalidatePath() {} },
      "@/lib/supabase/admin": { createSupabaseAdminClient: () => admin },
      "@/lib/supabase/env": { hasSupabaseAdminConfig: () => true },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => supabase },
      "@/config/site": { siteConfig: { url: "https://example.test" } },
      "@/lib/auth/require-membership": { requireMembership: async () => ({ membership: { role, organization: { id: "own-org" } } }) },
      "@/features/entitlements/feature-catalog": { FEATURES: { corePortal: "core.portal" } },
      "@/features/entitlements/server/resolver": { hasEntitlement: async () => entitled },
    };
    const testModule = { exports: {} };
    vm.runInNewContext(compiled, {
      module: testModule, exports: testModule.exports, require(id) { assert.ok(id in mocks, id); return mocks[id]; },
      URL, FormData, console,
    });
    const form = new FormData();
    form.set("email", "synthetic@example.test");
    form.set("intent", intent);
    const action = intent === "invite"
      ? testModule.exports.inviteCustomerPortalAction
      : testModule.exports.manageCustomerPortalAccessAction;
    const result = await action("es", "customer-id", undefined, form);
    return { result, authCalls, filters, rpcCalls };
  }

  for (const state of ["missing", "disabled", "expired"]) {
    const result = await runCase({ entitled: false });
    assert.equal(result.result.success, false, state);
    assert.deepEqual(result.authCalls, [], state);
    assert.equal(result.rpcCalls, 0, state);
  }
  const unauthorized = await runCase({ role: "staff" });
  assert.deepEqual(unauthorized.authCalls, []);
  assert.equal(unauthorized.rpcCalls, 0);

  const foreign = await runCase({ customer: null });
  assert.deepEqual(foreign.authCalls, []);
  assert.equal(foreign.rpcCalls, 0);
  assert.deepEqual(foreign.filters, [
    ["id", "customer-id"], ["organization_id", "own-org"], ["is_active", true],
  ]);

  const own = await runCase({});
  assert.deepEqual(own.authCalls, ["invite"]);
  assert.equal(own.rpcCalls, 1);

  for (const intent of ["resend", "resetPassword"]) {
    const noEntitlement = await runCase({ intent, entitled: false });
    assert.deepEqual(noEntitlement.authCalls, [], intent);
    const foreignAccess = await runCase({ intent, portalAccess: null });
    assert.deepEqual(foreignAccess.authCalls, [], intent);
    const staff = await runCase({ intent, role: "staff" });
    assert.deepEqual(staff.authCalls, [], intent);
  }
});
