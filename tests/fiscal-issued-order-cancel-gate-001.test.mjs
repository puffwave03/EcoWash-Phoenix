import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261112100551_fiscal_issued_order_cancel_gate_001.sql');
const guard = migration.slice(0, migration.indexOf('-- Canonical ordinary overload'));
const issuer = migration.slice(migration.indexOf('create or replace function public.issue_billing_invoice'));
const baselineIssue = read('supabase/migrations/20261018000100_billing_simplified_invoice_001f_service_issuance.sql');
const originalIssuer = baselineIssue.slice(baselineIssue.indexOf('create or replace function public.issue_billing_invoice(target_invoice_id uuid)'), baselineIssue.indexOf('-- Explicit confirmation overload')).trim();
const plainSql = value => value.replace(/--[^\n]*/g, '');

// These tests inspect migration contracts; they do NOT execute PostgreSQL.
test('SQL contract: gate covers status UPDATE itself, including direct transitions; historic cancelled rows are untouched', () => {
  assert.match(guard, /before update of production_status on public\.orders/);
  assert.match(guard, /when \(new\.production_status = 'cancelled' and old\.production_status is distinct from new\.production_status\)/);
  assert.doesNotMatch(plainSql(guard), /current_setting\('app\.|update public\.|delete from|insert into/i);
  assert.doesNotMatch(migration, /create (?:or replace )?function public\.transition_order_status/);
});
test('SQL contract: both issued and previously issued fiscal history block regardless of inactive links or payments', () => {
  const predicate = plainSql(guard);
  assert.match(predicate, /l\.organization_id = old\.organization_id[\s\S]*l\.order_id = old\.id/);
  assert.match(predicate, /i\.organization_id = l\.organization_id and i\.id = l\.invoice_id/);
  assert.match(predicate, /i\.document_status in \('issued', 'cancelled'\) or i\.issued_at is not null/);
  assert.doesNotMatch(predicate, /is_active|public\.(payments|operational_receipts|service_albarans)/);
  assert.match(predicate, /order_fiscal_cancellation_blocked.*55000/);
});
test('SQL contract: trigger fails closed for stale isolation and has no directly granted endpoint or inverse invoice lock', () => {
  assert.match(guard, /transaction_isolation[\s\S]*read committed[\s\S]*order_fiscal_cancellation_conflict.*40001/);
  assert.match(guard, /security definer\nset search_path = public, pg_temp/);
  assert.match(guard, /revoke all on function public\.guard_order_fiscal_cancellation\(\)[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(plainSql(guard), /for (update|share)|lock table|grant /i);
});
test('SQL contract: ordinary issuance locks all tenant orders in deterministic order BEFORE invoice/counter', () => {
  const orderLock = issuer.indexOf('order by o.id for update of o');
  const invoiceLock = issuer.indexOf('  for update;');
  assert.ok(orderLock > 0 && invoiceLock > orderLock);
  assert.ok(issuer.indexOf('insert into public.billing_invoice_number_counters') > invoiceLock);
  assert.match(issuer, /o\.organization_id = org_id and exists[\s\S]*l\.organization_id = org_id/);
  assert.match(issuer, /cardinality\(locked_order_ids\) = 0[\s\S]*linked_order_ids is distinct from locked_order_ids/);
  assert.match(issuer, /billing_order_read_committed_required.*25000/);
  assert.match(issuer, /customer_order\.production_status = 'cancelled'/);
});
test('SQL contract: original issuer body, permission checks, replay and fiscal writes preserved except two bounded insertions', () => {
  let restored = issuer.slice(0, issuer.lastIndexOf('\ncommit;')).trim();
  restored = restored.replace('  locked_order_ids uuid[] := array[]::uuid[];\n  linked_order_ids uuid[];\n  source_order record;\n', '');
  const preludeStart = restored.indexOf('  -- FISCAL-ISSUED-ORDER-CANCEL-GATE-001:');
  const preludeEnd = restored.indexOf('\n  select * into invoice_row\n  from public.invoices invoice', restored.indexOf('  end if;', restored.indexOf('    end loop;', preludeStart)));
  assert.ok(preludeStart > 0 && preludeEnd > preludeStart);
  restored = restored.slice(0, preludeStart) + restored.slice(preludeEnd + 1);
  const recheckStart = restored.indexOf('  -- Recheck the association');
  const recheckEnd = restored.indexOf('  select * into settings_row', recheckStart);
  assert.ok(recheckEnd > recheckStart);
  restored = restored.slice(0, recheckStart) + restored.slice(recheckEnd);
  assert.equal(restored, originalIssuer);
  assert.doesNotMatch(plainSql(migration), /(?:update|insert into|delete from) public\.(orders|payments|daily_closes|invoice_orders)\b/);
});

function load(path, imports = {}) {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, FormData,
    console: { error() {} }, require(name) {
      if (name === 'server-only') return {};
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, imports);
      throw Error(`Unexpected dependency: ${name}`);
    } });
  return compiledModule.exports;
}
const orderId = '00000000-0000-4000-8000-000000000010';
const orgId = '00000000-0000-4000-8000-000000000020';
const actorId = '00000000-0000-4000-8000-000000000030';
const redirectError = path => Object.assign(Error('REDIRECT'), { path });
function action({ error = null, role = 'owner', capabilities = [], assignedTo = actorId, missing = false, unauthenticated = false } = {}) {
  const calls = [], invalidations = [], filters = [];
  const client = { from(table) {
    assert.equal(table, 'orders');
    const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
      async maybeSingle() { return { data: missing ? null : { assigned_to: assignedTo, production_status: 'received' }, error: null }; } };
    return query;
  }, async rpc(name, args) { calls.push({ name, args }); return { error }; } };
  const actions = load('src/features/orders/server/actions.ts', {
    'next/cache': { revalidatePath: path => invalidations.push(path) },
    'next/navigation': { redirect: path => { throw redirectError(path); } },
    '@/lib/auth/require-membership': { requireMembership: async () => {
      if (unauthenticated) throw redirectError('/login');
      return { membership: { role, capabilities, organization: { id: orgId } }, profile: { id: actorId } };
    } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => client },
  });
  const run = (surface = 'order', status = 'cancelled') => {
    const form = new FormData(); form.set('targetStatus', status); form.set('reason', '  Customer request  ');
    form.set('organization_id', 'UNTRUSTED_OTHER_TENANT');
    return actions.transitionOrderStatusAction('es', orderId, surface, form);
  };
  return { run, calls, invalidations, filters };
}
for (const surface of ['order', 'production', 'quality']) {
  test(`${surface}: fiscal database denial redirects to its localized error without success invalidation`, async () => {
    const a = action({ error: { code: '55000', message: 'order_fiscal_cancellation_blocked' } });
    const base = surface === 'order' ? 'orders' : `work/${surface}`;
    await assert.rejects(a.run(surface), error => error.path === `/es/app/${base}/${orderId}?cancellationError=fiscal-issued`);
    assert.equal(a.calls.length, 1); assert.equal(a.calls[0].name, 'transition_order_status');
    assert.equal(a.calls[0].args.target_reason, 'Customer request');
    assert.deepEqual(a.invalidations, []);
    assert.deepEqual(a.filters, [['organization_id', orgId], ['id', orderId]]);
    assert.equal(Object.hasOwn(a.calls[0].args, 'organization_id'), false);
  });
}
test('stale isolation denial gives a retry message, without claiming an issued invoice', async () => {
  const a = action({ error: { code: '40001', message: 'order_fiscal_cancellation_conflict' } });
  await assert.rejects(a.run(), error => error.path.endsWith('?cancellationError=conflict'));
  assert.deepEqual(a.invalidations, []);
});
test('successful ordinary cancellation retains the canonical RPC and refresh behavior', async () => {
  const a = action(); await a.run();
  assert.equal(a.calls.length, 1); assert.equal(a.calls[0].args.target_status, 'cancelled');
  assert.ok(a.invalidations.includes(`/es/app/orders/${orderId}`));
});
test('other transitions and unrelated errors do not get a fiscal denial', async () => {
  const a = action({ error: { code: 'XX000', message: 'PRIVATE_DETAIL' } });
  await a.run(); assert.deepEqual(a.invalidations, []);
  const b = action(); await b.run('order', 'washing');
  assert.equal(b.calls[0].args.target_status, 'washing');
});
for (const [label, options] of [
  ['missing/foreign-tenant order', { missing: true }],
  ['staff without production', { role: 'staff' }],
  ['staff assigned to another operator', { role: 'staff', capabilities: ['production'], assignedTo: 'other' }],
]) test(`server authorization preserved: ${label} never calls transition RPC`, async () => {
  const a = action(options); await a.run(); assert.equal(a.calls.length, 0);
});
test('unauthenticated access redirects before any RPC', async () => {
  const a = action({ unauthenticated: true });
  await assert.rejects(a.run(), error => error.path === '/login'); assert.equal(a.calls.length, 0);
});
test('assigned staff with production capability retains the existing ordinary path', async () => {
  const a = action({ role: 'staff', capabilities: ['production'] });
  await a.run(); assert.equal(a.calls.length, 1);
});

const { ProductionDetail } = load('src/components/production/ProductionDetail.tsx', {
  '@/i18n/navigation': { Link: ({ children }) => React.createElement('span', null, children) },
  '@/components/production/ProductionTransitionForm': { ProductionTransitionForm: () => null },
});
const productionProps = {
  allowedTransitions: ['cancelled'], locale: 'en', timeZone: 'Atlantic/Canary',
  task: { id: orderId, orderNumber: 'SYNTHETIC', productionStatus: 'received', priority: 'normal',
    urgency: 'normal', serviceNames: [], items: [] },
  text: { statuses: {}, priorities: {}, urgencies: {}, units: {} },
};
test('production notice is accessible, escapes content, and is absent without denial', () => {
  const rendered = renderToStaticMarkup(React.createElement(ProductionDetail, {
    ...productionProps, cancellationErrorText: 'Fiscal denial <private>',
  }));
  assert.match(rendered, /role="alert"[^>]*>Fiscal denial &lt;private&gt;/);
  const absent = renderToStaticMarkup(React.createElement(ProductionDetail, productionProps));
  assert.doesNotMatch(absent, /role="alert"/);
});
for (const surface of ['production', 'quality']) {
  test(`${surface} page maps only known errors to translated messages`, async () => {
    const translate = key => key; translate.raw = () => ({});
    const page = load(`src/app/[locale]/app/(dashboard)/work/${surface}/[orderId]/page.tsx`, {
      'next-intl/server': { getTranslations: async () => translate },
      '@/components/production/ProductionDetail': { ProductionDetail: () => null },
      '@/features/orders/server/actions': { transitionOrderStatusAction() {} },
      '@/features/production/server/queries': {
        getProductionWorkspaceTask: async () => ({ allowedTransitions: ['cancelled'], task: productionProps.task }),
        getQualityWorkspaceTask: async () => ({ allowedTransitions: ['cancelled'], task: productionProps.task }),
      },
      '@/features/warehouse/server/queries': { getReadyWarehousePlacement() { throw Error('unexpected warehouse call'); } },
    }).default;
    for (const [error, expected] of [['fiscal-issued', 'fiscalCancellationBlocked'], ['conflict', 'fiscalCancellationConflict'], ['PRIVATE_DETAIL', undefined]]) {
      const rendered = await page({ params: Promise.resolve({ locale: 'es', orderId }), searchParams: Promise.resolve({ cancellationError: error }) });
      assert.equal(rendered.props.cancellationErrorText, expected);
    }
  });
}
test('order page binds a known-code accessible warning without removing history, payment or refund panels', () => {
  const page = read('src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx');
  assert.match(page, /routeSearch\.cancellationError === "fiscal-issued" \|\| routeSearch\.cancellationError === "conflict"/);
  assert.match(page, /role="alert">\s*\{commonT\(routeSearch\.cancellationError/);
  assert.match(page, /<StatusTransitionForm/); assert.match(page, /<PaymentsPanel/);
});
test('all five locales contain distinct actionable cancellation and conflict messages', () => {
  const messages = new Set();
  for (const locale of ['it', 'es', 'en', 'fr', 'de']) {
    const t = JSON.parse(read(`src/i18n/${locale}/common.json`));
    for (const key of ['fiscalCancellationBlocked', 'fiscalCancellationConflict']) {
      assert.equal(typeof t[key], 'string'); assert.ok(t[key].length > 70); messages.add(t[key]);
    }
  }
  assert.equal(messages.size, 10);
});
