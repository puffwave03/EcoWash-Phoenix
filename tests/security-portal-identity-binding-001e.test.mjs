import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const read = path => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261021000100_security_portal_identity_binding_001e.sql");
function load(path, mocks) {
  const compiled = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports,
    require(name) { assert.ok(name in mocks, `Unexpected dependency: ${name}`); return mocks[name]; },
    URL, FormData, console: { error() {} },
  });
  return testModule.exports;
}

test("SQL contract: both management RPCs check Auth identity before writing and preserve their boundaries", () => {
  const functions = migration.split('CREATE OR REPLACE FUNCTION').slice(1);
  assert.equal(functions.length, 2);
  for (const body of functions) {
    assert.match(body, /SECURITY DEFINER/);
    assert.match(body, /SET "search_path" TO ''/);
    assert.match(body, /if actor_profile_id is null/);
    assert.match(body, /public\.has_organization_role\(org_id, array\['owner', 'manager'\]/);
    assert.match(body, /public\.organization_entitlement_is_enabled/);
    assert.match(body, /from auth\.users auth_user/);
    assert.match(body, /lower\(btrim\(auth_user\.email\)\) = lower\(btrim\((?:target|access)_email\)\)/);
    assert.match(body, /portal_identity_invalid.*errcode = '22023'/);
    assert.ok(body.indexOf('from auth.users') < body.indexOf(body.includes('insert into') ? 'insert into' : '  update public.'));
    assert.match(body, /for share/);
  }
  assert.match(functions[0], /auth_user\.id = target_user_id/);
  assert.match(functions[1], /auth_user\.id = access_user_id/);
  assert.match(functions[1], /for update of access/);
  assert.match(functions[1], /if target_is_active then[\s\S]*from auth\.users/);
  assert.match(migration, /revoke all on function public\.upsert_customer_portal_access\(uuid, uuid, text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.update_customer_portal_access\(uuid, boolean\) to authenticated/);
  assert.doesNotMatch(migration, /create table|alter table|create policy|create trigger|delete from|alter function.*owner/i);
});

test("canonical context still derives authorization from UUID and permits multiple contexts", () => {
  const sql = read("supabase/migrations/20261014000200_portal_entitlement_boundary_001.sql");
  const body = sql.slice(0, sql.indexOf('create or replace function public.get_customer_portal_ordering_context'));
  assert.match(body, /access\.user_id = auth\.uid\(\)/);
  assert.doesNotMatch(body, /auth\.jwt|auth\.email/);
  assert.match(body, /order by access\.created_at\s+limit 1/);
  assert.doesNotMatch(migration, /customer_portal_current_access|organization_memberships|platform_admin|unique index/i);
});

test("summary executes with tenant filters and no administrative Auth dependency or activity metadata", async () => {
  const filters = [];
  const row = { id: 'access', email: 'synthetic@example.test', is_active: true,
    created_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-21T11:00:00Z', disabled_at: null };
  const query = { select(fields) { assert.ok(!fields.includes('user_id')); return this; },
    eq(...filter) { filters.push(filter); return this; }, async maybeSingle() { return { data: row, error: null }; } };
  const api = load('src/features/portal/server/queries.ts', {
    'server-only': {}, 'next/navigation': {}, '@/lib/auth/require-auth': {},
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ from(table) { assert.equal(table, 'customer_portal_access'); return query; } }) },
    '@/lib/auth/require-membership': { requireMembership: async () => ({ membership: { organization: { id: 'tenant' } } }) },
    '@/features/portal/pagination': {}, '@/features/catalog-productization/server/queries': {},
    '@/features/catalog-productization/presentation': {},
  });
  const result = await api.getCustomerPortalAccessSummary('es', 'customer');
  assert.deepEqual(filters, [['organization_id', 'tenant'], ['customer_id', 'customer']]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { id: 'access', email: row.email, isActive: true,
    invitedAt: row.created_at, updatedAt: row.updated_at, disabledAt: null });
  for (const path of ['src/features/portal/server/queries.ts', 'src/features/portal/types.ts']) {
    assert.doesNotMatch(read(path), /lastSignInAt|last_sign_in_at|createSupabaseAdminClient/);
  }
});

test("rendered panel presents local activation and invitation date without claiming login or acceptance", () => {
  const { CustomerPortalAccessPanel: Panel } = load('src/components/customers/CustomerPortalAccessPanel.tsx', {
    react: { useActionState: (_action, state) => [state, () => {}, false] },
    'react/jsx-runtime': jsx,
    '@/components/Button': { Button: ({ children, ...props }) => jsx.jsx('button', { ...props, children }) },
  });
  for (const locale of ['en', 'it', 'es', 'fr', 'de']) {
    const text = JSON.parse(read(`src/i18n/${locale}/common.json`)).customers.portal;
    for (const key of ['lastSignIn', 'noLastSignIn', 'pending']) assert.equal(key in text, false);
    for (const isActive of [true, false]) {
      const html = renderToStaticMarkup(jsx.jsx(Panel, { locale, text, customerIsActive: true, previewUrl: null,
        defaultEmail: null, inviteAction() {}, manageAction() {},
        access: { id: 'access', email: 'synthetic@example.test', isActive, invitedAt: '2026-10-21T10:00:00Z' } }));
      assert.ok(html.includes(isActive ? text.active : text.accessDisabled));
      assert.ok(html.includes(renderToStaticMarkup(jsx.jsx(jsx.Fragment, { children: text.invitedAt }))));
      assert.ok(html.includes('synthetic@example.test'));
      assert.ok(html.includes(`value="${isActive ? 'disable' : 'enable'}"`));
      assert.ok(!html.includes('lastSignIn'));
    }
  }
});

function actionsHarness({ role = 'owner', existing = false, rpcError = false, mismatch = false } = {}) {
  const calls = [];
  const user = { id: 'auth-user', email: 'synthetic@example.test' };
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() {
    return { data: { id: 'access', is_active: true, user_id: user.id, email: user.email }, error: null };
  } };
  const admin = { auth: { admin: {
    async inviteUserByEmail(email) { calls.push(['invite', email]); return existing
      ? { data: {}, error: { code: 'email_exists' } } : { data: { user }, error: null }; },
    async generateLink() { calls.push(['lookup']); return { data: { user }, error: null }; },
    async getUserById(id) { calls.push(['getUser', id]); return { data: { user: { ...user, email: mismatch ? 'other@example.test' : user.email } }, error: null }; },
  }, async signInWithOtp() { calls.push(['otp']); return { error: null }; },
  async resetPasswordForEmail() { calls.push(['recovery']); return { error: null }; } } };
  const api = load('src/features/portal/server/actions.ts', {
    'next/cache': { revalidatePath() {} }, '@/config/site': { siteConfig: { url: 'https://example.test' } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => admin }, '@/lib/supabase/env': { hasSupabaseAdminConfig: () => true },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ from: () => query, async rpc(name, args) {
      calls.push(['rpc', name, args]); return { error: rpcError ? { code: '22023' } : null };
    } }) },
    '@/lib/auth/require-membership': { requireMembership: async () => ({ membership: { role, organization: { id: 'tenant' } } }) },
    '@/features/entitlements/feature-catalog': { FEATURES: { corePortal: 'core.portal' } },
    '@/features/entitlements/server/resolver': { hasEntitlement: async () => true },
  });
  const form = new FormData(); form.set('email', ' SYNTHETIC@EXAMPLE.TEST ');
  return { api, calls, form };
}

test("Owner/Manager invitations preserve Auth-derived UUID, normalization and existing-user flow", async () => {
  for (const role of ['owner', 'manager']) for (const existing of [false, true]) {
    const { api, calls, form } = actionsHarness({ role, existing });
    assert.equal((await api.inviteCustomerPortalAction('es', 'customer', undefined, form)).success, true);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.find(c => c[0] === 'rpc'))), ['rpc', 'upsert_customer_portal_access', {
      target_customer_id: 'customer', target_email: 'synthetic@example.test', target_user_id: 'auth-user',
    }]);
    assert.equal(calls.some(c => c[0] === 'otp'), existing);
  }
});

test("database rejection yields safe failure and sends no existing-user access email", async () => {
  const { api, calls, form } = actionsHarness({ existing: true, rpcError: true });
  const result = await api.inviteCustomerPortalAction('es', 'customer', undefined, form);
  assert.equal(result.success, false); assert.equal(result.formError, 'access');
  assert.ok(!calls.some(c => c[0] === 'otp'));
});

test("enable rejection is safe; resend/recovery refuse Auth-email mismatches", async () => {
  for (const intent of ['enable', 'resend', 'resetPassword']) {
    const { api, calls, form } = actionsHarness({ rpcError: true, mismatch: true }); form.set('intent', intent);
    const result = await api.manageCustomerPortalAccessAction('es', 'customer', undefined, form);
    assert.equal(result.success, false);
    assert.ok(!calls.some(c => ['otp', 'recovery'].includes(c[0])));
  }
});

test("normal enable/disable/resend/recovery retain management behavior", async () => {
  for (const intent of ['enable', 'disable', 'resend', 'resetPassword']) {
    const { api, calls, form } = actionsHarness(); form.set('intent', intent);
    assert.equal((await api.manageCustomerPortalAccessAction('es', 'customer', undefined, form)).success, true);
    if (['enable', 'disable'].includes(intent)) {
      const [, name, args] = calls.find(c => c[0] === 'rpc');
      assert.equal(name, 'update_customer_portal_access'); assert.equal(args.target_is_active, intent === 'enable');
    } else assert.ok(calls.some(c => c[0] === (intent === 'resend' ? 'otp' : 'recovery')));
  }
});
