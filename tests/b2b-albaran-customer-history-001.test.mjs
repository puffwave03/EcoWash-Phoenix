import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
  runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, URLSearchParams, Buffer, console: { error() {} }, require(name) {
    if (name === 'server-only') return {};
    if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected dependency ${name}`);
  } });
  return compiledModule.exports;
}
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const timezone = load('src/lib/organization-timezone.ts');
const register = load('src/features/service-albarans/register.ts', { '@/lib/organization-timezone': timezone });
const capabilities = load('src/lib/auth/capabilities.ts');
const features = load('src/features/entitlements/feature-catalog.ts');
const accountPagination = load('src/features/customer-account/pagination.ts');
const customers = [
  { id: id(301), organization_id: id(101), customer_type: 'business' },
  { id: id(302), organization_id: id(101), customer_type: 'business' },
  { id: id(303), organization_id: id(101), customer_type: 'individual' },
  { id: id(601), organization_id: id(102), customer_type: 'business' },
];
const document = n => ({ id: id(n), organization_id: id(101), customer_id: id(301), order_id: id(501), document_number: `ALB-2026-${String(n).padStart(6, '0')}`, document_status: n === 2 ? 'issued' : 'cancelled', issued_at: n <= 2 ? `2026-07-01T23:30:0${n}Z` : '2026-07-01T23:30:00Z', snapshot_version: 1, customer_name: 'Same historical name', order_number: 'EW-HISTORICAL', property_name: null, location_name: 'Site', total: 999, cancellation_reason: 'PRIVATE_REASON' });
const documents = [...Array.from({ length: 137 }, (_, n) => document(n + 1)), { ...document(800), customer_id: id(302) }, { ...document(900), organization_id: id(102), customer_id: id(601) }];

function api({ role = 'owner', printing = true, denied = false, permitted = true, organization = id(101), source = documents, fail = '', transport = false } = {}) {
  const requests = []; let clients = 0;
  const client = createClient('http://127.0.0.1:57321', 'synthetic-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, options) => {
    const url = new URL(input); const table = url.pathname.split('/').at(-1); requests.push({ table, url, options });
    if (transport) throw Error('synthetic transport failure');
    if (fail === table) return new Response(JSON.stringify({ code: '42501', message: 'synthetic failure' }), { status: 403 });
    let data = table === 'customers' ? customers : source;
    for (const key of ['organization_id', 'customer_id', 'id']) {
      const filter = url.searchParams.get(key);
      if (filter) data = data.filter(row => `eq.${row[key]}` === filter);
    }
    if (table === 'customers') return new Response(JSON.stringify(data.map(row => ({ customer_type: row.customer_type }))));
    const count = data.length; const offset = Number(url.searchParams.get('offset') ?? 0); const limit = Number(url.searchParams.get('limit'));
    if (offset > 0 && offset >= count) return new Response(JSON.stringify({ code: 'PGRST103' }), { status: 416 });
    const fields = ['id', 'order_id', 'document_number', 'document_status', 'issued_at', 'snapshot_version', 'customer_name', 'property_name', 'location_name', 'order_number'];
    data = [...data].sort((a, b) => b.issued_at.localeCompare(a.issued_at) || b.id.localeCompare(a.id)).slice(offset, offset + limit);
    return new Response(JSON.stringify(data.map(row => Object.fromEntries(fields.map(key => [key, row[key]])))), { headers: { 'content-range': `${offset}-${offset + data.length - 1}/${count}` } });
  } } });
  const createSupabaseServerClient = async () => { clients++; return client; };
  const shared = load('src/features/service-albarans/server/register-queries.ts', {
    '@/features/printing/server/access': { requirePrintAccess: async () => { throw Error('Customer must use its non-redirecting gate'); } },
    '@/features/service-albarans/register': register,
    '@/lib/supabase/server': { createSupabaseServerClient },
  });
  const result = load('src/features/service-albarans/server/customer-history-queries.ts', {
    '@/features/entitlements/feature-catalog': features,
    '@/features/entitlements/server/resolver': { hasEntitlement: async (_locale, feature) => { assert.equal(feature, 'printing'); return printing; } },
    '@/features/service-albarans/server/register-queries': shared,
    '@/lib/auth/capabilities': { hasOperationalCapability: (membership, capability) => permitted && capabilities.hasOperationalCapability(membership, capability) },
    '@/lib/auth/require-membership': { requireMembership: async () => { if (denied) throw Error('AUTH_REDIRECT'); return { membership: { role, capabilities: ['pos'], organization: { id: organization, timezone: 'Atlantic/Canary' } } }; } },
    '@/lib/supabase/server': { createSupabaseServerClient },
  });
  return { list: result.getCustomerServiceAlbaranHistory, requests, clients: () => clients };
}

test('Business customer: shared server query uses persisted customer and tenant IDs, with all statuses', async () => {
  const instance = api(); const history = await instance.list('en', id(301));
  assert.equal(history.state, 'ready'); assert.equal(history.count, 137); assert.equal(history.items.length, 25);
  assert.ok(history.items.some(row => row.document_status === 'issued'));
  assert.ok(history.items.some(row => row.document_status === 'cancelled'));
  const lookup = instance.requests[0]; assert.equal(lookup.table, 'customers'); assert.equal(lookup.url.searchParams.get('id'), `eq.${id(301)}`);
  for (const { table, url, options } of instance.requests) {
    assert.equal(url.searchParams.get('organization_id'), `eq.${id(101)}`);
    if (table === 'service_albarans') {
      assert.equal(url.searchParams.get('customer_id'), `eq.${id(301)}`);
      assert.equal(url.searchParams.get('order'), 'issued_at.desc,id.desc'); assert.equal(url.searchParams.get('limit'), '25');
      assert.equal(url.searchParams.has('or'), false); assert.equal(url.searchParams.has('document_status'), false);
      assert.equal(new Headers(options.headers).get('Prefer'), 'count=exact');
      assert.doesNotMatch(url.searchParams.get('select'), /\*|total|price|payment|notes|cancellation_reason/);
    }
  }
});
test('all 137 customer documents remain reachable with deterministic tie ordering and no duplicates', async () => {
  const instance = api(); const ids = [];
  for (let page = 1; page <= 6; page++) {
    const history = await instance.list('en', id(301), String(page));
    assert.equal(history.state, 'ready'); assert.equal(history.count, 137); assert.equal(history.pages, 6); ids.push(...history.items.map(row => row.id));
  }
  const expected = documents.filter(row => row.customer_id === id(301)).sort((a, b) => b.issued_at.localeCompare(a.issued_at) || b.id.localeCompare(a.id)).map(row => row.id);
  assert.deepEqual(ids, expected); assert.equal(new Set(ids).size, 137);
});
test('same customer name never merges another customer, and changed names do not affect identity', async () => {
  const first = await api().list('en', id(301)); const second = await api().list('en', id(302));
  assert.equal(first.count, 137); assert.equal(second.count, 1); assert.equal(second.items[0].id, id(800));
});
test('cancelled original and reissued document keep their original numbers, status and order association', async () => {
  const history = await api({ source: [document(1), document(2)] }).list('en', id(301));
  assert.equal(history.items[0].document_number, 'ALB-2026-000002'); assert.equal(history.items[0].document_status, 'issued');
  assert.equal(history.items[1].document_number, 'ALB-2026-000001'); assert.equal(history.items[1].document_status, 'cancelled');
  assert.ok(history.items.every(row => row.order_id === id(501)));
});
test('Business without documents is ready and empty; query/transport errors are unavailable', async () => {
  const empty = await api({ source: [] }).list('en', id(301)); assert.equal(empty.state, 'ready'); assert.equal(empty.count, 0);
  for (const options of [{ fail: 'customers' }, { fail: 'service_albarans' }, { transport: true }]) assert.equal((await api(options).list('en', id(301))).state, 'unavailable');
});
test('Individual and unknown customers are hidden without querying documents', async () => {
  for (const customerId of [id(303), id(888)]) {
    const instance = api(); assert.equal((await instance.list('en', customerId)).state, 'hidden');
    assert.ok(instance.requests.every(request => request.table === 'customers'));
  }
});
test('foreign tenant customer is hidden; tenant B can read only its own history', async () => {
  const instance = api(); assert.equal((await instance.list('en', id(601))).state, 'hidden');
  assert.ok(instance.requests.every(request => request.table === 'customers'));
  const other = await api({ organization: id(102) }).list('en', id(601)); assert.equal(other.count, 1); assert.equal(other.items[0].id, id(900));
});
test('missing printing, capability, invalid ID and Staff role never query documents or expose counts', async () => {
  for (const options of [{ printing: false }, { permitted: false }, { role: 'staff' }]) {
    const instance = api(options); const result = await instance.list('en', id(301));
    assert.equal(result.state, 'hidden'); assert.equal(instance.clients(), 0); assert.ok(!('count' in result));
  }
  const instance = api(); assert.equal((await instance.list('en', 'invalid')).state, 'hidden'); assert.equal(instance.clients(), 0);
});
test('Owner and Manager remain authorized; authentication redirects propagate before read-error handling', async () => {
  for (const role of ['owner', 'manager']) assert.equal((await api({ role }).list('en', id(301))).state, 'ready');
  const instance = api({ denied: true }); await assert.rejects(instance.list('en', id(301)), /AUTH_REDIRECT/); assert.equal(instance.clients(), 0);
});
test('invalid and out-of-range page recovery preserves customer scope on every request', async () => {
  const instance = api(); const result = await instance.list('en', id(301), '999'); assert.equal(result.page, 6); assert.equal(result.items.length, 12);
  for (const request of instance.requests.filter(r => r.table === 'service_albarans')) assert.equal(request.url.searchParams.get('customer_id'), `eq.${id(301)}`);
  assert.equal((await api().list('en', id(301), '-1')).page, 1);
});

const messages = locale => JSON.parse(read(`src/i18n/${locale}/common.json`));
const translate = async ({ locale, namespace }) => {
  const dictionary = namespace.split('.').slice(1).reduce((v, key) => v[key], messages(locale));
  const raw = key => key.split('.').reduce((v, part) => v[part], dictionary);
  const t = (key, values = {}) => { const text = raw(key); assert.equal(typeof text, 'string', `${locale}:${key}`); return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name])); };
  t.raw = raw; return t;
};
const Link = ({ href, locale, children, ...props }) => React.createElement('a', { ...props, href: `/${locale}${href}` }, children);
const Card = ({ children, ...props }) => React.createElement('div', props, children);
const ui = load('src/components/operational/OperationalUi.tsx');
async function render(history, locale = 'en') {
  const Component = load('src/components/service-albarans/CustomerServiceAlbaranHistory.tsx', {
    'next-intl/server': { getTranslations: translate }, '@/components/Card': { Card }, '@/components/operational/OperationalUi': ui,
    '@/features/customer-account/pagination': accountPagination,
    '@/features/service-albarans/server/customer-history-queries': { getCustomerServiceAlbaranHistory: async () => history },
    '@/i18n/navigation': { Link }, '@/lib/organization-timezone': timezone,
  }).CustomerServiceAlbaranHistory;
  return renderToStaticMarkup(await Component({ locale, customerId: id(301), period: 'all', orderCursor: 'order-cursor', paymentCursor: 'payment-cursor' }));
}
const ready = () => ({ state: 'ready', items: [document(2), document(1)], count: 137, page: 2, pages: 6, timeZone: 'Atlantic/Canary' });
for (const locale of ['it', 'es', 'en', 'fr', 'de']) test(`${locale}: historical status, organization time, order/A4 links, non-fiscal text and no mutations`, async () => {
  const html = await render(ready(), locale); const m = messages(locale).serviceAlbarans;
  for (const value of ['ALB-2026-000001', 'ALB-2026-000002', 'EW-HISTORICAL', m.issued, m.cancelled, m.notFiscal, m.register.title]) assert.ok(html.includes(value));
  const date = timezone.formatOrganizationDateTime(document(2).issued_at, locale, 'Atlantic/Canary'); assert.ok(html.includes(date));
  assert.ok(html.includes(`/${locale}/app/orders/${id(501)}/albarans/${id(1)}/print`)); assert.ok(html.includes(`/${locale}/app/orders/${id(501)}`));
  assert.doesNotMatch(html, /PRIVATE_REASON|999|<form|name="requestId"|window\.print/);
  assert.match(html, /sm:grid-cols/); assert.match(html, /min-h-11/);
});
test('customer pagination preserves independent period/order/payment navigation and its own anchor', async () => {
  const html = await render(ready()); const links = [...html.matchAll(/href="([^"]*#customer-service-albarans)"/g)].map(m => new URL(m[1].replaceAll('&amp;', '&'), 'http://local'));
  assert.equal(links.length, 2); assert.deepEqual(links.map(url => url.searchParams.get('albaranPage')), [null, '3']);
  for (const url of links) { assert.equal(url.pathname, `/en/app/customers/${id(301)}`); assert.equal(url.searchParams.get('period'), 'all'); assert.equal(url.searchParams.get('orderCursor'), 'order-cursor'); assert.equal(url.searchParams.get('paymentCursor'), 'payment-cursor'); }
});
test('hidden section renders nothing, while database failure and empty history remain distinct', async () => {
  assert.equal(await render({ state: 'hidden' }), '');
  const failed = await render({ state: 'unavailable' }); assert.match(failed, /role="alert"/); assert.ok(!failed.includes(messages('en').serviceAlbarans.customerHistory.empty));
  const empty = await render({ ...ready(), items: [], count: 0, page: 1, pages: 1 }); assert.ok(empty.includes(messages('en').serviceAlbarans.customerHistory.empty)); assert.doesNotMatch(empty, /role="alert"/);
});
test('five languages have identical customer-history keys and all original print vocabulary', () => {
  for (const locale of ['it', 'es', 'en', 'fr', 'de']) {
    assert.deepEqual(Object.keys(messages(locale).serviceAlbarans.customerHistory).sort(), ['empty', 'unavailable']);
    assert.ok(messages(locale).serviceAlbarans.notFiscal); assert.ok(messages(locale).serviceAlbarans.register.openA4);
  }
});

test('CustomerAccountView integrates the history only for Business and retains the other sections', async () => {
  const History = () => null; const stub = () => null; const action = async () => {};
  const View = load('src/components/customers/CustomerAccountView.tsx', {
    'next-intl/server': { getTranslations: translate }, '@/components/Button': { Button: stub }, '@/components/Card': { Card },
    '@/components/DisclosureSection': { DisclosureSection: stub }, '@/components/billing/CustomerBillingSection': { CustomerBillingSection: stub },
    '@/components/customers/CustomerPortalAccessPanel': { CustomerPortalAccessPanel: stub }, '@/components/customers/CustomerLifecycleControl': { CustomerLifecycleControl: stub },
    '@/components/customers/CustomerSegmentAssignmentPanel': { CustomerSegmentAssignmentPanel: stub }, '@/components/operational/OperationalUi': ui,
    '@/components/properties/PropertyList': { PropertyList: stub }, '@/components/service-albarans/CustomerServiceAlbaranHistory': { CustomerServiceAlbaranHistory: History },
    '@/features/catalog-segments/server/actions': { assignCustomerSegmentAction: action }, '@/features/customers/server/actions': { deactivateCustomerAction: action, reactivateCustomerAction: action },
    '@/features/portal/server/actions': { inviteCustomerPortalAction: action, manageCustomerPortalAccessAction: action }, '@/i18n/navigation': { Link },
    '@/lib/number-format': load('src/lib/number-format.ts'), '@/features/customer-account/pagination': accountPagination,
  }).CustomerAccountView;
  for (const customerType of ['business', 'individual']) {
    const tree = await View({ albaranPage: '3', customer: { id: id(301), customerType, displayName: 'Business A', isActive: true, updatedAt: '2026-11-11T10:00:00Z' }, locale: 'en', period: 'all', financials: { summaries: [], orders: [], payments: [], pagination: { orderCursor: 'order', paymentCursor: 'payment', orders: {}, payments: {} } }, properties: [], segmentAssignment: { segments: [] }, billingOverview: null, eligibility: null, portalAccess: null, previewUrl: null });
    const histories = []; const ids = [];
    function walk(node) { React.Children.forEach(node, child => { if (!React.isValidElement(child)) return; if (child.type === History) histories.push(child); if (child.props.id) ids.push(child.props.id); walk(child.props.children); }); }
    walk(tree);
    assert.equal(histories.length, customerType === 'business' ? 1 : 0);
    if (histories.length) { assert.equal(histories[0].props.page, '3'); assert.equal(histories[0].props.customerId, id(301)); }
    for (const section of ['customer-orders', 'customer-payments', 'customer-properties', 'account-admin']) assert.ok(ids.includes(section));
  }
});
