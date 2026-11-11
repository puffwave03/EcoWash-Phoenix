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
function load(path, imports = {}) {
  const compiledModule = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, Buffer, URLSearchParams, console: { error() {} }, require(name) {
    if (name === 'server-only') return {};
    if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return compiledModule.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const customerId = id(301);
const pagination = load('src/features/customer-account/pagination.ts');
const timezone = load('src/lib/organization-timezone.ts');
const rows = {
  summary: [{ average_order_value: '35.00', confirmed_payments: '25.00', currency: 'EUR', gross_order_value: '35.00', last_order_at: '2026-07-01T00:30:00Z', last_payment_at: '2026-07-01T23:30:00Z', net_paid: '20.00', order_count: 1, outstanding_balance: '15.00', outstanding_order_count: 1, outstanding_order_value: '35.00', refunded_payments: '5.00' }],
  orders: [{ id: id(501), order_number: 'EW-TEST', currency: 'EUR', created_at: '2026-07-01T00:30:00Z', production_status: 'completed', payment_status: 'partially_paid', total: '35.00', total_paid: '20.00', balance_due: '15.00', property_id: null, property_name: null }],
  payments: [{ id: id(601), order_id: id(501), order_number: 'EW-TEST', currency: 'EUR', method: 'card', paid_at: '2026-07-01T23:30:00Z', created_at: '2026-07-01T23:30:01Z', amount: '25.00', status: 'confirmed', refunded_from_payment_id: null }],
};
const group = name => name === 'get_customer_account_summary' ? 'summary' : name.includes('orders') ? 'orders' : 'payments';
function access(role = 'owner', timeZone = 'Atlantic/Canary') {
  const denied = Error('AUTHORIZATION_REDIRECT');
  const result = { membership: { role, organization: { id: id(101), timezone: timeZone } } };
  const guards = load('src/lib/auth/require-role.ts', {
    'next/navigation': { redirect() { throw denied; } },
    '@/lib/auth/require-membership': { requireMembership: async () => {
      if (role === 'unauthenticated') throw denied;
      return result;
    } },
  });
  return { ...guards, denied, result };
}
function query({ role = 'owner', fail, reject, invalid, empty = false, clientFailure = false, source = rows } = {}) {
  const requests = []; let clients = 0;
  const guards = access(role);
  const client = { rpc(name, args) {
    requests.push({ name, args });
    return { returns() {
      const key = group(name);
      if (reject === key) return Promise.reject(Error('PRIVATE_TRANSPORT_DETAIL'));
      return Promise.resolve({ error: fail === key ? { code: 'XX000', message: 'PRIVATE_RPC_DETAIL' } : null,
        data: invalid === key ? null : empty ? [] : source[key] });
    } };
  } };
  const api = load('src/features/customer-account/server/queries.ts', {
    '@/lib/auth/require-role': guards,
    '@/lib/supabase/server': { createSupabaseServerClient: async () => {
      clients++;
      if (clientFailure) throw Error('PRIVATE_CLIENT_DETAIL');
      return client;
    } },
    '@/features/customer-account/pagination': pagination,
  });
  return { read: api.getCustomerAccountFinancials, requests, clients: () => clients, denied: guards.denied };
}
const readAccount = (api, period = 'recent', orderCursor, paymentCursor) => api.read('en', customerId, period, orderCursor, paymentCursor);

test('ready maps the canonical amounts and timestamps without recomputing or mutating source data', async () => {
  const before = JSON.stringify(rows);
  const api = query(); const result = await readAccount(api);
  assert.equal(result.state, 'ready');
  assert.equal(result.summaries[0].outstandingBalance, 15);
  assert.equal(result.summaries[0].refundedPayments, 5);
  assert.equal(result.orders[0].totalPaid, 20); assert.equal(result.orders[0].total, 35);
  assert.equal(result.payments[0].amount, 25);
  assert.equal(result.orders[0].createdAt, rows.orders[0].created_at);
  assert.equal(result.payments[0].paidAt, rows.payments[0].paid_at);
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(api.requests.map(r => r.name), ['get_customer_account_summary', 'list_customer_account_orders', 'list_customer_account_payments']);
  assert.ok(api.requests.every(r => r.args.target_customer_id === customerId));
  assert.equal(api.requests[1].args.target_limit, 8); assert.equal(api.requests[2].args.target_limit, 12);
});
test('successful empty arrays are explicitly ready, with the existing empty navigation', async () => {
  const result = await readAccount(query({ empty: true }));
  assert.equal(result.state, 'ready');
  assert.deepEqual(plain([result.summaries, result.orders, result.payments]), [[], [], []]);
  assert.equal(result.pagination.orders.olderCursor, null);
});
for (const key of ['summary', 'orders', 'payments']) {
  for (const period of ['recent', 'all']) test(`${period}: ${key} RPC error makes all financial data unavailable`, async () => {
    const result = await readAccount(query({ fail: key }), period);
    assert.equal(result.state, 'unavailable');
    for (const name of ['summaries', 'orders', 'payments']) assert.equal(Object.hasOwn(result, name), false);
    assert.equal(Object.hasOwn(result.pagination, 'orders'), false);
    assert.equal(Object.hasOwn(result.pagination, 'payments'), false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|XX000/);
  });
  test(`${key} transport rejection becomes unavailable`, async () => {
    assert.equal((await readAccount(query({ reject: key }))).state, 'unavailable');
  });
  test(`${key} missing response is unavailable rather than a successful empty history`, async () => {
    assert.equal((await readAccount(query({ invalid: key }))).state, 'unavailable');
  });
}
test('client creation transport failure is handled without replacing the access guard', async () => {
  assert.equal((await readAccount(query({ clientFailure: true }))).state, 'unavailable');
});
for (const role of ['owner', 'manager']) test(`${role} remains authorised using the real role guard`, async () => {
  assert.equal((await readAccount(query({ role }))).state, 'ready');
});
for (const role of ['staff', 'customer', 'unauthenticated']) test(`${role} denial propagates before client creation or RPC reads`, async () => {
  const api = query({ role });
  await assert.rejects(readAccount(api), error => error === api.denied);
  assert.equal(api.clients(), 0); assert.equal(api.requests.length, 0);
});
const cursor = (kind, direction = 'older', target = customerId) => Buffer.from(JSON.stringify({
  v: 1, customerId: target, period: 'all', direction, id: id(700), createdAt: '2026-07-01T00:00:00Z',
  ...(kind === 'payments' ? { paidAt: '2026-07-01T00:00:00Z' } : {}),
})).toString('base64url');
test('unavailable preserves validated cursors for GET recovery and rejects another customer cursor', async () => {
  const a = cursor('orders'); const b = cursor('payments');
  const result = await readAccount(query({ fail: 'payments' }), 'all', a, b);
  assert.deepEqual(plain(result.pagination), { orderCursor: a, paymentCursor: b });
  const rejected = await readAccount(query({ fail: 'summary' }), 'all', cursor('orders', 'older', id(999)), 'invalid');
  assert.deepEqual(plain(rejected.pagination), { orderCursor: null, paymentCursor: null });
});
for (const direction of ['older', 'newer']) test(`keyset ${direction} still uses the same customer, raw UTC positions, ordering and page size`, async () => {
  const api = query(); const a = cursor('orders', direction); const b = cursor('payments', direction);
  const result = await readAccount(api, 'all', a, b);
  assert.equal(result.state, 'ready');
  assert.deepEqual(api.requests.map(r => r.name), ['get_customer_account_summary', 'list_customer_account_orders_page', 'list_customer_account_payments_page']);
  for (const request of api.requests.slice(1)) {
    assert.equal(request.args.target_cursor_created_at, '2026-07-01T00:00:00Z');
    assert.equal(request.args.target_direction, direction); assert.equal(request.args.target_limit, 26);
    assert.equal(request.args.target_customer_id, customerId);
    assert.equal(Object.hasOwn(request.args, 'organization_id'), false);
  }
  assert.equal(api.requests[2].args.target_cursor_paid_at, '2026-07-01T00:00:00Z');
  assert.equal(result.pagination.orderCursor, a); assert.equal(result.pagination.paymentCursor, b);
});

const messages = locale => JSON.parse(read(`src/i18n/${locale}/common.json`));
const translate = async ({ locale, namespace }) => {
  const dictionary = namespace.split('.').slice(1).reduce((value, key) => value[key], messages(locale));
  const raw = key => key.split('.').reduce((value, part) => value[part], dictionary);
  const t = (key, values = {}) => {
    const value = raw(key); assert.equal(typeof value, 'string', `${locale}:${key}`);
    return value.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
  };
  t.raw = raw; return t;
};
const marker = name => function IndependentSection() { return React.createElement('div', { 'data-independent': name }, name); };
const Link = ({ locale, href, children, ...props }) => React.createElement('a', { ...props, href: `/${locale}${href}` }, children);
const defaults = {
  customer: { id: customerId, customerType: 'business', displayName: 'Customer A', isActive: true, updatedAt: '2026-06-01T00:00:00Z' },
  properties: [], segmentAssignment: { segments: [] }, billingOverview: { recentInvoices: [] },
  eligibility: null, portalAccess: null, previewUrl: null, period: 'all', albaranPage: '3', timeZone: 'Atlantic/Canary',
};
async function render(financials, locale = 'en', options = {}) {
  const calls = [];
  const View = load('src/components/customers/CustomerAccountView.tsx', {
    'next-intl/server': { getTranslations: translate },
    '@/components/Button': { Button: ({ children }) => React.createElement('button', null, children) },
    '@/components/Card': { Card: ({ children, ...props }) => React.createElement('div', props, children) },
    '@/components/DisclosureSection': load('src/components/DisclosureSection.tsx'),
    '@/components/operational/OperationalUi': load('src/components/operational/OperationalUi.tsx'),
    '@/components/billing/CustomerBillingSection': { CustomerBillingSection: marker('billing') },
    '@/components/customers/CustomerPortalAccessPanel': { CustomerPortalAccessPanel: marker('portal') },
    '@/components/customers/CustomerLifecycleControl': { CustomerLifecycleControl: marker('lifecycle') },
    '@/components/customers/CustomerSegmentAssignmentPanel': { CustomerSegmentAssignmentPanel: marker('segment') },
    '@/components/properties/PropertyList': { PropertyList: marker('properties') },
    '@/components/service-albarans/CustomerServiceAlbaranHistory': { CustomerServiceAlbaranHistory: marker('albarans') },
    '@/features/catalog-segments/server/actions': { assignCustomerSegmentAction: async () => {} },
    '@/features/customers/server/actions': { deactivateCustomerAction: async () => {}, reactivateCustomerAction: async () => {} },
    '@/features/portal/server/actions': { inviteCustomerPortalAction: async () => {}, manageCustomerPortalAccessAction: async () => {} },
    '@/i18n/navigation': { Link }, '@/lib/number-format': load('src/lib/number-format.ts'),
    '@/features/customer-account/pagination': pagination,
    '@/lib/organization-timezone': { formatOrganizationDateTime(...args) { calls.push(args); return timezone.formatOrganizationDateTime(...args); } },
  }).CustomerAccountView;
  const html = renderToStaticMarkup(await View({ ...defaults, ...options, financials, locale }));
  return { html, calls };
}
for (const locale of ['it', 'es', 'en', 'fr', 'de']) test(`${locale}: accessible unavailable notice, real GET reload, no false empty/zero/pagination and independent sections preserved`, async () => {
  const financials = await readAccount(query({ fail: 'orders' }), 'all', cursor('orders'), cursor('payments'));
  const { html, calls } = await render(financials, locale); const text = messages(locale).customerAccount;
  assert.match(html, /role="alert"/);
  assert.ok(html.includes(text.financial.unavailable)); assert.ok(html.includes(text.financial.reload));
  for (const value of [text.financial.empty, text.orders.empty, text.payments.empty, text.financial.outstanding, text.lastActivity]) assert.equal(html.includes(value), false, value);
  assert.doesNotMatch(html, /id="customer-(orders|payments)"|<dl|PRIVATE_RPC_DETAIL|XX000|method="post"/);
  assert.equal(calls.length, 0);
  const href = html.match(new RegExp(`<a[^>]+href="([^\"]+#financial-summary)"`))?.[1];
  assert.ok(href); const url = new URL(href.replaceAll('&amp;', '&'), 'https://local.test');
  assert.equal(url.pathname, `/${locale}/app/customers/${customerId}`);
  assert.equal(url.searchParams.get('period'), 'all'); assert.equal(url.searchParams.get('albaranPage'), '3');
  assert.equal(url.searchParams.get('orderCursor'), cursor('orders')); assert.equal(url.searchParams.get('paymentCursor'), cursor('payments'));
  for (const name of ['billing', 'portal', 'lifecycle', 'segment', 'properties', 'albarans']) assert.ok(html.includes(`data-independent="${name}"`));
  assert.ok(html.includes('Customer A')); assert.ok(html.includes('id="account-admin"'));
});
test('a genuinely empty ready account retains all three existing EmptyState messages', async () => {
  const { html } = await render(await readAccount(query({ empty: true })));
  const text = messages('en').customerAccount;
  for (const value of [text.financial.empty, text.orders.empty, text.payments.empty]) assert.ok(html.includes(value));
  assert.equal(html.includes(text.financial.unavailable), false);
});
for (const locale of ['it', 'es', 'en', 'fr', 'de']) test(`${locale}: real view formats order dates without time, payments and last activity with time in the supplied IANA zone`, async () => {
  const financials = await readAccount(query()); const before = JSON.stringify(financials);
  for (const timeZone of ['America/Los_Angeles', 'Europe/Rome', 'Asia/Tokyo', 'Atlantic/Canary']) {
    const { html, calls } = await render(financials, locale, { timeZone });
    const orderDate = new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium' }).format(new Date(rows.orders[0].created_at));
    const paymentDate = new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(rows.payments[0].paid_at));
    assert.ok(html.includes(orderDate)); assert.ok(html.includes(paymentDate));
    assert.ok(html.includes(`${messages(locale).customerAccount.lastActivity}: ${paymentDate}`));
    assert.ok(calls.every(call => call[2] === timeZone));
    assert.ok(calls.some(call => call[3].timeStyle === undefined)); assert.ok(calls.some(call => call[3].timeStyle === 'short'));
  }
  assert.equal(JSON.stringify(financials), before);
});
for (const [instant, timeZone, expected] of [
  ['2026-07-01T00:30:00Z', 'America/Los_Angeles', '30 Jun 2026, 17:30'],
  ['2026-07-01T23:30:00Z', 'Asia/Tokyo', '2 Jul 2026, 08:30'],
  ['2026-03-29T00:30:00Z', 'Europe/Rome', '29 Mar 2026, 01:30'],
  ['2026-03-29T01:30:00Z', 'Europe/Rome', '29 Mar 2026, 03:30'],
  ['2026-10-25T00:30:00Z', 'Europe/Rome', '25 Oct 2026, 02:30'],
  ['2026-10-25T02:30:00Z', 'Europe/Rome', '25 Oct 2026, 03:30'],
]) test(`view timezone: ${instant} → ${timeZone} ${expected}`, async () => {
  const financials = await readAccount(query());
  financials.payments[0].paidAt = instant;
  financials.summaries[0].lastPaymentAt = instant;
  const { html } = await render(financials, 'en', { timeZone });
  // Explicit expected wall-clock date/time, independent of the shared formatter.
  const formatted = new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant));
  assert.equal(formatted, expected);
  assert.ok(html.includes(new Intl.DateTimeFormat('en', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(instant))));
});
test('page obtains timezone from the authorised membership, ignoring user timezone parameters', async () => {
  const Page = load('src/app/[locale]/app/(dashboard)/customers/[customerId]/page.tsx', {
    '@/components/customers/CustomerAccountView': { CustomerAccountView: 'customer-view' },
    '@/features/billing/server/queries': { getCustomerBillingOverview: async () => null },
    '@/features/catalog-segments/server/queries': { getCustomerSegmentAssignment: async () => ({ segments: [] }) },
    '@/features/customer-account/server/queries': { getCustomerAccountFinancials: async () => ({ state: 'unavailable', pagination: { orderCursor: null, paymentCursor: null } }) },
    '@/features/customer-account/validation': load('src/features/customer-account/validation.ts', { '@/features/customer-account/types': { CUSTOMER_ACCOUNT_PERIODS: ['recent', 'year', 'all'] } }),
    '@/features/customer-lifecycle/server/queries': { getCustomerLifecycleEligibility: async () => null },
    '@/features/customers/server/queries': { getCustomerById: async () => defaults.customer, listPropertiesByCustomer: async () => [] },
    '@/features/portal/server/preview': { createStagingCustomerPreviewPath: () => null },
    '@/features/portal/server/queries': { getCustomerPortalAccessSummary: async () => null },
    '@/lib/auth/require-role': access('manager', 'Asia/Tokyo'),
    '@/features/entitlements/feature-catalog': load('src/features/entitlements/feature-catalog.ts'),
    '@/features/entitlements/server/resolver': { hasEntitlement: async () => false },
  }).default;
  const tree = await Page({ params: Promise.resolve({ locale: 'en', customerId }), searchParams: Promise.resolve({ period: 'all', timeZone: 'UTC' }) });
  assert.equal(tree.props.timeZone, 'Asia/Tokyo'); assert.equal(tree.props.financials.state, 'unavailable');
});
test('foreign-tenant customer lookup still filters by server membership and fails closed', async () => {
  const filters = []; const notFound = Error('NOT_FOUND');
  const api = load('src/features/customers/server/queries.ts', {
    'next/navigation': { notFound() { throw notFound; } },
    '@/lib/auth/require-membership': { requireMembership: async () => access().result },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ from(table) {
      assert.equal(table, 'customers');
      const builder = { select() { return builder; }, eq(...args) { filters.push(args); return builder; }, maybeSingle: async () => ({ data: null, error: null }) };
      return builder;
    } }) },
    '@/features/customers/pagination': {},
  });
  await assert.rejects(api.getCustomerById('en', id(999)), error => error === notFound);
  assert.deepEqual(filters, [['organization_id', id(101)], ['id', id(999)]]);
});
test('all five locales provide the financial-read warning and reload label', () => {
  for (const locale of ['it', 'es', 'en', 'fr', 'de']) {
    const text = messages(locale).customerAccount.financial;
    assert.ok(text.unavailable.length > 20); assert.ok(text.reload.length > 3);
  }
});
