import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, imports = {}) {
  const compiledModule = { exports: {} };
  const compiled = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, Buffer, URLSearchParams, console: { error() {} }, require(name) {
    if (name === 'server-only') return {};
    if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return compiledModule.exports;
}
const timezone = load('src/lib/organization-timezone.ts');
const register = load('src/features/service-albarans/register.ts', { '@/lib/organization-timezone': timezone });
const { normalizeAlbaranRegisterFilters: normalize, albaranRegisterDateRange: dateRange, albaranRegisterSearch: search, albaranRegisterHref: href } = register;
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const locales = ['it', 'es', 'en', 'fr', 'de'];
const messages = locale => JSON.parse(read(`src/i18n/${locale}/common.json`));
const translate = async ({ locale, namespace }) => (key, values = {}) => {
  const value = `${namespace}.${key}`.split('.').slice(1).reduce((v, part) => v[part], messages(locale));
  assert.equal(typeof value, 'string', `${locale}/${key}`);
  return value.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
};
const fixture = n => ({ id: id(n), organization_id: id(1001), order_id: id(10000 + n), document_number: `ALB-2026-${String(n).padStart(6, '0')}`, document_status: n % 2 ? 'issued' : 'cancelled', issued_at: n % 2 ? '2026-11-10T23:59:59Z' : '2026-11-11T00:00:00Z', snapshot_version: 1, customer_name: `Historical Hotel ${n}`, location_name: 'Historical site', property_name: 'Historical property', order_number: `EW-${n}`, internal_notes: 'PRIVATE', total: 999 });
const rows = Array.from({ length: 137 }, (_, n) => fixture(n + 1));

// Real supabase-js/PostgREST query builder; in-memory HTTP responses, no remote service.
function api({ denied = false, data = rows, fail = false, transport = false, missingCount = false, organization = id(1001) } = {}) {
  const requests = [];
  let clients = 0;
  const client = createClient('http://127.0.0.1:57321', 'synthetic-test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, options) => {
    const url = new URL(input);
    requests.push({ url, options });
    if (transport) throw Error('synthetic transport failure');
    if (fail) return new Response(JSON.stringify({ code: '42501', message: 'synthetic denial' }), { status: 403 });
    let selected = data.filter(row => `eq.${row.organization_id}` === url.searchParams.get('organization_id'));
    const status = url.searchParams.get('document_status');
    if (status) selected = selected.filter(row => `eq.${row.document_status}` === status);
    for (const bound of url.searchParams.getAll('issued_at')) {
      if (bound.startsWith('gte.')) selected = selected.filter(row => row.issued_at >= bound.slice(4));
      if (bound.startsWith('lt.')) selected = selected.filter(row => row.issued_at < bound.slice(3));
    }
    const or = url.searchParams.get('or');
    if (or) {
      const quoted = or.match(/document_number\.ilike\.("(?:\\.|[^"\\])*")/)[1];
      const term = JSON.parse(quoted).slice(1, -1).replace(/\\([%_\\])/g, '$1').toLowerCase();
      selected = selected.filter(row => [row.document_number, row.customer_name, row.order_number].some(v => v.toLowerCase().includes(term)));
    }
    const count = selected.length;
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit'));
    if (offset > 0 && offset >= count) return new Response(JSON.stringify({ code: 'PGRST103', message: 'Requested range not satisfiable' }), { status: 416 });
    selected = selected.sort((a, b) => b.issued_at.localeCompare(a.issued_at) || b.id.localeCompare(a.id)).slice(offset, offset + limit);
    const fields = ['id', 'order_id', 'document_number', 'document_status', 'issued_at', 'snapshot_version', 'customer_name', 'property_name', 'location_name', 'order_number'];
    return new Response(JSON.stringify(selected.map(row => Object.fromEntries(fields.map(key => [key, row[key]])))), { headers: missingCount ? {} : { 'content-range': `${offset}-${offset + selected.length - 1}/${count}` } });
  } } });
  const queries = load('src/features/service-albarans/server/register-queries.ts', {
    '@/features/printing/server/access': { requirePrintAccess: async () => { if (denied) throw Error('ACCESS_DENIED'); return { membership: { organization: { id: organization, timezone: 'Atlantic/Canary' } } }; } },
    '@/features/service-albarans/register': register,
    '@/lib/supabase/server': { createSupabaseServerClient: async () => { clients++; return client; } },
  });
  return { list: queries.listServiceAlbaranRegister, requests, clients: () => clients };
}

test('filters normalize scalar input and reject invalid page/status without accepting URL tenant input', () => {
  const f = normalize({ q: ' hotel ', status: 'issued', page: '5', from: '2026-11-10', organization_id: 'foreign' });
  assert.equal(f.query, 'hotel'); assert.equal(f.page, 5); assert.equal(f.status, 'issued'); assert.ok(!('organization_id' in f));
  for (const page of ['-1', '0', '1e5', 'Infinity', '1.5', '999999999', 'abc']) assert.equal(normalize({ page }).page, 1);
  assert.equal(normalize({ status: 'draft', q: ['foreign'] }).status, 'all');
  assert.equal(normalize({ q: 'x'.repeat(1000) }).query.length, 120);
});
test('date bounds include the entire final organization day and handle DST', () => {
  const f = normalize({ from: '2026-03-29', to: '2026-03-29' });
  const r = dateRange(f, 'Atlantic/Canary');
  assert.equal(r.from, '2026-03-29T00:00:00.000Z'); assert.equal(r.until, '2026-03-29T23:00:00.000Z');
  assert.equal(dateRange(normalize({ from: '2026-10-25', to: '2026-10-25' }), 'Atlantic/Canary').from, '2026-10-24T23:00:00.000Z');
});
test('invalid dates and inverted intervals are rejected', () => {
  for (const f of [{ from: '2026-02-30' }, { to: 'invalid' }, { from: '2026-11-11', to: '2026-11-10' }, { from: '2026-11-10junk' }]) assert.equal(dateRange(normalize(f), 'Atlantic/Canary'), null);
});
test('search quotes grammar punctuation and escapes literal SQL wildcards', () => {
  const expression = search('A%,_(x)."\\');
  assert.match(expression, /^document_number\.ilike\."/);
  assert.ok(expression.includes('snapshot->customer->>name.ilike.'));
  assert.ok(expression.includes('snapshot->order->>number.ilike.'));
  assert.equal(expression.match(/\.ilike\./g).length, 3);
  assert.ok(expression.includes('\\\\%')); assert.ok(expression.includes('\\"'));
});
test('pagination links retain all filters and new filter submissions reset the page', () => {
  const f = normalize({ q: 'Hotel & A', status: 'cancelled', from: '2026-11-01', to: '2026-11-10', page: '6' });
  const url = new URL(href(f, 3), 'http://local');
  for (const [key, value] of Object.entries({ q: f.query, status: f.status, from: f.from, to: f.to, page: '3' })) assert.equal(url.searchParams.get(key), value);
  assert.equal(new URL(href(f), 'http://local').searchParams.has('page'), false);
});
test('server paging traverses all 137 documents with deterministic ordering and no 100-document cap', async () => {
  const instance = api(); const seen = [];
  for (let page = 1; page <= 6; page++) {
    const result = await instance.list('en', { page: String(page) });
    assert.equal(result.state, 'ready'); assert.equal(result.count, 137); assert.equal(result.pages, 6);
    assert.ok(result.items.length <= 25); seen.push(...result.items.map(row => row.id));
  }
  assert.equal(new Set(seen).size, 137);
  for (const { url, options } of instance.requests) {
    assert.equal(url.pathname, '/rest/v1/service_albarans'); assert.equal(url.searchParams.get('limit'), '25');
    assert.equal(url.searchParams.get('order'), 'issued_at.desc,id.desc');
    assert.equal(new Headers(options.headers).get('Prefer'), 'count=exact');
    assert.equal(url.searchParams.get('organization_id'), `eq.${id(1001)}`);
    assert.doesNotMatch(url.searchParams.get('select'), /\*|price|total|notes|payment|items/);
  }
});
for (const q of ['ALB-2026-000137', 'Historical Hotel 137', 'EW-137']) test(`server search: ${q}`, async () => {
  const instance = api(); const result = await instance.list('es', { q });
  assert.equal(result.state, 'ready'); assert.equal(result.count, 1); assert.equal(result.items[0].id, id(137));
  assert.ok(instance.requests[0].url.searchParams.has('or'));
});
test('status and inclusive date filters are sent to the database and combined', async () => {
  const instance = api(); const result = await instance.list('en', { status: 'issued', from: '2026-11-10', to: '2026-11-10' });
  assert.equal(result.state, 'ready'); assert.equal(result.count, 69);
  assert.ok(result.items.every(row => row.document_status === 'issued'));
  assert.deepEqual(instance.requests[0].url.searchParams.getAll('issued_at'), ['gte.2026-11-10T00:00:00.000Z', 'lt.2026-11-11T00:00:00.000Z']);
});
test('tenant is derived from access, never from URL; another tenant never appears', async () => {
  const foreign = { ...fixture(999), organization_id: id(2001) };
  const instance = api({ data: [...rows, foreign] });
  const result = await instance.list('en', { organization_id: id(2001) });
  assert.equal(result.count, 137); assert.ok(result.items.every(row => row.id !== foreign.id));
  const other = await api({ data: [...rows, foreign], organization: id(2001) }).list('en', {});
  assert.equal(other.count, 1); assert.equal(other.items[0].id, foreign.id);
});
test('access denial propagates before client creation, including direct URL requests', async () => {
  const instance = api({ denied: true });
  await assert.rejects(instance.list('en', {}), /ACCESS_DENIED/);
  assert.equal(instance.clients(), 0); assert.equal(instance.requests.length, 0);
});
test('invalid dates do not execute a query; failures never masquerade as an empty register', async () => {
  const instance = api(); assert.equal((await instance.list('en', { from: 'bad' })).state, 'invalidFilters'); assert.equal(instance.clients(), 0);
  for (const options of [{ fail: true }, { transport: true }, { missingCount: true }, { data: [{ ...fixture(1), snapshot_version: 2 }] }]) assert.equal((await api(options).list('en', {})).state, 'unavailable');
  const empty = await api({ data: [] }).list('en', {}); assert.equal(empty.state, 'ready'); assert.equal(empty.count, 0);
});
test('out-of-range page resolves to the final filtered page', async () => {
  const instance = api(); const result = await instance.list('en', { page: '999' });
  assert.equal(result.page, 6); assert.equal(result.items.length, 12); assert.equal(instance.requests.length, 3);
});
test('an out-of-range page on an empty filtered register remains a valid empty state', async () => {
  const instance = api({ data: [] }); const result = await instance.list('en', { page: '999', q: 'missing' });
  assert.equal(result.state, 'ready'); assert.equal(result.page, 1); assert.equal(result.count, 0); assert.equal(result.items.length, 0);
});

const Link = ({ href, children }) => React.createElement('a', { href }, children);
const primitives = load('src/components/operational/OperationalUi.tsx');
function page(history) {
  return load('src/app/[locale]/app/(dashboard)/albarans/page.tsx', {
    'next-intl/server': { getTranslations: translate },
    '@/components/Button': { Button: ({ children, type }) => React.createElement('button', { type }, children) },
    '@/components/Card': { Card: ({ children, ...props }) => React.createElement('div', props, children) },
    '@/components/operational/OperationalUi': primitives,
    '@/features/service-albarans/register': register,
    '@/features/service-albarans/server/register-queries': { listServiceAlbaranRegister: async () => history },
    '@/i18n/navigation': { Link }, '@/lib/organization-timezone': timezone,
  }).default;
}
for (const locale of locales) test(`${locale}: register renders historical labels, status, original links and A4 without financial/private fields`, async () => {
  const history = { filters: normalize({}), timeZone: 'Atlantic/Canary', state: 'ready', items: [fixture(2)], count: 137, page: 1, pages: 6 };
  const html = renderToStaticMarkup(await page(history)({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
  for (const label of ['Historical Hotel 2', 'Historical site', 'Historical property', 'EW-2', messages(locale).serviceAlbarans.cancelled, messages(locale).serviceAlbarans.register.title]) assert.ok(html.includes(label));
  assert.ok(html.includes(`/app/orders/${id(10002)}/albarans/${id(2)}/print`));
  assert.ok(html.includes(`/app/orders/${id(10002)}`)); assert.ok(html.includes('/app/albarans?page=2'));
  assert.match(html, /method="get"/); assert.doesNotMatch(html, /PRIVATE|999|name="page"|requestId|cancellation_reason|unit_price/);
  assert.match(html, /md:grid-cols/); assert.match(html, /break-words/);
});
test('unavailable and invalid-filter notices are distinct from successful empty results', async () => {
  const base = { filters: normalize({}), timeZone: 'Atlantic/Canary' };
  for (const state of ['unavailable', 'invalidFilters']) {
    const html = renderToStaticMarkup(await page({ ...base, state })({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) }));
    assert.match(html, /role="alert"/); assert.ok(!html.includes(messages('en').serviceAlbarans.register.empty));
  }
  const html = renderToStaticMarkup(await page({ ...base, state: 'ready', items: [], count: 0, page: 1, pages: 1 })({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) }));
  assert.ok(html.includes(messages('en').serviceAlbarans.register.empty)); assert.doesNotMatch(html, /role="alert"/);
});
const capabilities = load('src/lib/auth/capabilities.ts');
const entitlements = load('src/features/entitlements/feature-catalog.ts');
const Navigation = load('src/components/dashboard/AppNavigation.tsx', {
  '@/i18n/navigation': { Link, usePathname: () => '/app/albarans' },
  '@/components/dashboard/LogoutButton': { LogoutButton: () => null },
  '@/lib/auth/capabilities': capabilities,
  '@/features/entitlements/feature-catalog': entitlements,
}).AppNavigation;
for (const role of ['owner', 'manager', 'staff']) test(`${role}: navigation follows POS capability and printing entitlement only`, () => {
  for (const pos of [false, true]) for (const printing of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(Navigation, { role, capabilities: pos ? ['pos'] : [], entitlements: { printing: { enabled: printing } }, locale: 'es', mode: 'desktop', navigationLabel: 'Menu', text: messages('es').auth.dashboard }));
    assert.equal(html.includes('href="/app/albarans"'), printing && (role !== 'staff' || pos));
    if (html.includes('href="/app/albarans"')) assert.ok(html.includes('Albaranes de servicio'));
  }
});
test('canonical print guard denies absent printing or absent POS, without catching redirects', async () => {
  for (const denied of ['printing', 'pos', null]) {
    const calls = [];
    const guard = load('src/features/printing/server/access.ts', {
      '@/features/entitlements/feature-catalog': entitlements,
      '@/features/entitlements/server/resolver': { requireEntitlement: async (_locale, feature) => { calls.push(feature); if (denied === 'printing') throw Error('DENIED'); } },
      '@/lib/auth/require-capability': { requireOperationalCapability: async (_locale, feature) => { calls.push(feature); if (denied === 'pos') throw Error('DENIED'); return { permitted: true }; } },
    });
    if (denied) await assert.rejects(guard.requirePrintAccess('en'), /DENIED/);
    else assert.equal((await guard.requirePrintAccess('en')).permitted, true);
    assert.equal(calls[0], 'printing');
  }
});
test('five languages provide the same register keys and loading feedback', () => {
  const keys = Object.keys(messages('en').serviceAlbarans.register).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(messages(locale).serviceAlbarans.register).sort(), keys);
    assert.ok(messages(locale).auth.dashboard.albarans);
  }
  assert.match(read('src/app/[locale]/app/(dashboard)/albarans/loading.tsx'), /role="status" aria-busy="true"/);
});
