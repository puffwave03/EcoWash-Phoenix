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
  runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module: compiledModule, exports: compiledModule.exports, encodeURIComponent, require(name) {
      if (name === 'server-only') return {};
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      if (Object.hasOwn(imports, name)) return imports[name];
      throw Error(`Unexpected import ${name}`);
    },
  });
  return compiledModule.exports;
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const helpers = load('src/features/billing/fiscal-ticket.ts');
const money = load('src/lib/number-format.ts');
const timezone = load('src/lib/organization-timezone.ts');
const snapshot = { order_number: 'EW-SYNTHETIC', due_at: '2026-11-14T15:00:00Z', location_id: id(30) };
const features = { FEATURES: { billingInvoicing: 'billing.invoicing' } };
const fail = message => { throw Error(message); };
function api(options = {}) {
  const requests = [];
  const tables = {
    organization_billing_settings: [{ organization_id: id(1), fiscal_ticket_phase_a_enabled: true }],
    orders: [{ id: id(2), organization_id: id(1), order_number: 'EW-SYNTHETIC', customer_id: id(3), total: 9, currency: 'EUR', production_status: 'received' }],
    payments: [{ id: id(4), order_id: id(2), organization_id: id(1), amount: 9, status: 'confirmed', channel: 'pos' }],
    invoice_orders: [], invoices: [],
    customers: [{ id: id(3), organization_id: id(1), customer_type: 'individual', display_name: 'SYNTHETIC' }],
    ...options.tables,
  };
  const client = createClient('http://127.0.0.1:57321', 'synthetic-key', { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(input); const table = url.pathname.split('/').at(-1); requests.push(url);
    if (options.error === table) return new Response(JSON.stringify({ code: options.code ?? '42501', message: 'PRIVATE_DATABASE_ERROR' }), { status: 400 });
    let rows = tables[table]; assert.ok(rows, table);
    for (const key of ['id', 'organization_id', 'order_id', 'document_status']) {
      const filter = url.searchParams.get(key);
      if (filter?.startsWith('eq.')) rows = rows.filter(row => `eq.${row[key]}` === filter);
      if (filter?.startsWith('in.')) rows = rows.filter(row => filter.slice(3).includes(row[key]));
    }
    if (url.searchParams.get('status') === 'neq.void') rows = rows.filter(row => row.status !== 'void');
    rows = rows.slice(0, Number(url.searchParams.get('limit') ?? rows.length));
    return new Response(JSON.stringify(rows));
  } } });
  const imports = {
    'next/navigation': { notFound: () => fail('NOT_FOUND') },
    '@/lib/auth/require-role': { requireOwnerOrManager: async () => {
      if (options.denied) fail('ROLE_DENIED');
      return { membership: { organization: { id: id(1), timezone: 'Atlantic/Canary' } } };
    } },
    '@/features/entitlements/feature-catalog': features,
    '@/features/entitlements/server/resolver': { requireEntitlement: async () => { if (options.noEntitlement) fail('ENTITLEMENT_DENIED'); } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => client },
    '@/features/billing/fiscal-ticket': helpers,
    '@/features/billing/server/queries': { getBillingInvoice: async () => ({ fullPrepayment: true }) },
  };
  return { ...load('src/features/billing/server/fiscal-ticket-queries.ts', imports), requests };
}
test('recipient and immutable order snapshot reject unsupported or malformed data', () => {
  for (const value of ['consumer', 'consumer_identified', 'business']) assert.equal(helpers.fiscalTicketRecipient(value), value);
  for (const value of [null, 'ordinary', '', [], {}]) assert.equal(helpers.fiscalTicketRecipient(value), null);
  assert.equal(helpers.fiscalTicketSnapshot(snapshot).order_number, snapshot.order_number);
  for (const value of [null, [], {}, { ...snapshot, order_number: '' }, { ...snapshot, due_at: 'invalid' }, { ...snapshot, location_id: 9 }]) assert.equal(helpers.fiscalTicketSnapshot(value), null);
});
test('flag is fail-closed before migration or configuration, and does not swallow other database errors', async () => {
  for (const code of ['42703', 'PGRST204']) assert.equal(await api({ error: 'organization_billing_settings', code }).fiscalTicketEnabled('en'), false);
  assert.equal(await api({ tables: { organization_billing_settings: [] } }).fiscalTicketEnabled('en'), false);
  await assert.rejects(api({ error: 'organization_billing_settings' }).fiscalTicketEnabled('en'));
});
test('role and entitlement enforced before any database read', async () => {
  for (const options of [{ denied: true }, { noEntitlement: true }]) {
    const a = api(options); await assert.rejects(a.getFiscalTicketPreview('en', id(2))); assert.equal(a.requests.length, 0);
  }
});
test('preview uses server tenant context for every read and the one existing POS payment', async () => {
  const a = api(); const result = await a.getFiscalTicketPreview('en', id(2));
  assert.equal(result.state, 'ready'); assert.equal(result.payment.id, id(4)); assert.equal(result.order.total, 9);
  assert.ok(a.requests.every(url => url.searchParams.get('organization_id') === `eq.${id(1)}`));
  assert.ok(a.requests.filter(url => /payments|invoice_orders/.test(url.pathname)).every(url => url.searchParams.get('limit') === '2'));
});
for (const [name, tables] of Object.entries({
  partial: { payments: [{ id: id(4), organization_id: id(1), order_id: id(2), amount: 3, status: 'confirmed', channel: 'pos' }] },
  pending: { payments: [{ id: id(4), organization_id: id(1), order_id: id(2), amount: 9, status: 'pending', channel: 'pos' }] },
  external: { payments: [{ id: id(4), organization_id: id(1), order_id: id(2), amount: 9, status: 'confirmed', channel: 'manual_external' }] },
  empty: { payments: [] },
})) test(`preview blocks ${name} instead of offering a charge or pretending it is full payment`, async () => {
  assert.equal((await api({ tables }).getFiscalTicketPreview('en', id(2))).state, 'blocked');
});
test('read errors differ from missing orders; other tenant order cannot be previewed', async () => {
  assert.equal((await api({ error: 'payments' }).getFiscalTicketPreview('en', id(2))).state, 'unavailable');
  await assert.rejects(api().getFiscalTicketPreview('en', id(99)), /NOT_FOUND/);
  await assert.rejects(api().getFiscalTicketPreview('en', 'bad-id'), /NOT_FOUND/);
});
test('uncertain outcome recovers issued canonical ticket; ordinary history remains blocked', async () => {
  const links = [{ organization_id: id(1), order_id: id(2), invoice_id: id(5) }];
  const invoice = { id: id(5), organization_id: id(1), document_status: 'issued', fiscal_ticket_order_snapshot: snapshot };
  assert.equal((await api({ tables: { invoice_orders: links, invoices: [invoice] } }).getFiscalTicketPreview('en', id(2))).invoiceId, id(5));
  assert.equal((await api({ tables: { invoice_orders: links, invoices: [{ ...invoice, fiscal_ticket_order_snapshot: null }] } }).getFiscalTicketPreview('en', id(2))).state, 'blocked');
});
function action(options = {}) {
  const calls = []; const paths = [];
  const a = load('src/features/billing/server/fiscal-ticket-actions.ts', {
    'next/navigation': { redirect: href => { throw Object.assign(Error('REDIRECT'), { href }); } },
    'next/cache': { revalidatePath: path => paths.push(path) },
    '@/lib/auth/require-role': { requireOwnerOrManager: async () => { if (options.denied) fail('ROLE_DENIED'); } },
    '@/features/entitlements/server/resolver': { requireEntitlement: async () => { if (options.noEntitlement) fail('ENTITLEMENT_DENIED'); } },
    '@/features/entitlements/feature-catalog': features,
    '@/features/billing/fiscal-ticket': helpers,
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ rpc: (name, args) => {
      calls.push({ name, args }); return { single: async () => {
        if (options.transport) fail('PRIVATE_TRANSPORT_ERROR');
        return { data: options.error ? null : { invoice_id: id(5), invoice_number: '2026-S-000001' }, error: options.error };
      } };
    } }) },
  });
  const form = new FormData(); for (const [key, value] of Object.entries({ recipient: 'consumer', paymentId: id(4), serviceNotPerformed: 'on', laundryScope: 'on' })) form.set(key, value);
  return { call: () => a.issueFullPrepaymentTicketAction('en', id(2), form), form, calls, paths };
}
test('explicit confirmations required; action does not accept unauthorized users', async () => {
  for (const key of ['serviceNotPerformed', 'laundryScope', 'recipient']) {
    const a = action(); a.form.delete(key); await assert.rejects(a.call(), e => e.href.endsWith('result=confirmation')); assert.equal(a.calls.length, 0);
  }
  for (const o of [{ denied: true }, { noEntitlement: true }]) { const a = action(o); await assert.rejects(a.call()); assert.equal(a.calls.length, 0); }
});
test('single issue request targets existing payment, then opens persisted invoice, with no new charge', async () => {
  const a = action(); await assert.rejects(a.call(), e => e.href === `/en/app/billing/${id(5)}/ticket`);
  assert.equal(a.calls.length, 1); assert.equal(a.calls[0].name, 'issue_billing_full_prepayment_ticket');
  assert.equal(a.calls[0].args.target_payment_id, id(4)); assert.equal('organization_id' in a.calls[0].args, false); assert.equal(a.paths.length, 2);
});
test('database and transport failures never auto-retry or expose SQL; recovery is a GET', async () => {
  for (const o of [{ error: { message: 'PRIVATE_SQL' } }, { transport: true }]) {
    const a = action(o); await assert.rejects(a.call(), e => e.href.endsWith('result=uncertain') && !e.href.includes('PRIVATE'));
    assert.equal(a.calls.length, 1); assert.equal(a.paths.length, 0);
  }
});
const translations = locale => JSON.parse(read(`src/i18n/${locale}/common.json`)).billing.fiscalTicket;
for (const locale of ['it', 'en', 'es', 'fr', 'de']) test(`persisted fiscal ticket renders in ${locale}, independently of current balances, for all existing formats`, async () => {
  const t = translations(locale);
  assert.deepEqual(Object.keys(t).sort(), Object.keys(translations('en')).sort()); assert.ok(Object.values(t).every(value => typeof value === 'string' && value.length > 0));
  const { FiscalTicketDocument } = load('src/components/billing/FiscalTicketDocument.tsx', {
    'next-intl/server': { getTranslations: async () => key => { assert.ok(t[key]); return t[key]; } },
    '@/components/billing/PrintInvoiceButton': { PrintInvoiceButton: ({ label }) => React.createElement('button', {}, label) },
    '@/lib/number-format': money, '@/lib/organization-timezone': timezone,
    '@/features/billing/tax-rate': load('src/features/billing/tax-rate.ts'),
    './FiscalTicketDocument.module.css': { default: { ticket: 'ticket', a4: 'a4', roll58: 'roll58', roll80: 'roll80' } },
  });
  const detail = { invoice: { id: id(5), issuerLegalName: 'SYNTHETIC LAUNDRY', issuerTaxId: 'TEST-ISSUER', issuerAddressLine1: 'Test road', invoiceNumber: '2026-S-000001', issuedAt: '2026-11-13T10:00:00Z', currency: 'EUR', taxableBase: 8.41, taxTotal: .59, total: 9, outstanding: 12345, paidTotal: 88888, notes: 'PRIVATE_INTERNAL_NOTES' },
    items: [{ id: id(9), description: 'Two shirts', quantity: 2, unitPrice: 4.5, lineTotal: 9, taxableBase: 8.41, taxRate: 7, taxAmount: .59 }] };
  for (const format of ['a4', '58mm', '80mm']) {
    const html = renderToStaticMarkup(await FiscalTicketDocument({ detail, snapshot, locale, timezone: 'Atlantic/Canary', format }));
    for (const text of ['SYNTHETIC LAUNDRY', 'TEST-ISSUER', '2026-S-000001', 'EW-SYNTHETIC', 'Two shirts', 'IGIC 7%', t.commercialAtIssue]) assert.ok(html.includes(text), text);
    for (const text of ['PRIVATE_INTERNAL_NOTES', '12345', '88888', 'REC-']) assert.equal(html.includes(text), false);
    assert.ok(html.includes(money.formatCurrency(8.41, 'EUR', locale).replaceAll('\u00a0', ' ')));
  }
});
test('print route reuses format preference and print gate, and never issues on GET', async () => {
  let printed = 0; let authorized = 0;
  const page = load('src/app/[locale]/app/(dashboard)/billing/[invoiceId]/ticket/page.tsx', {
    '@/features/billing/server/fiscal-ticket-queries': { getFiscalTicketDocument: async () => ({ detail: {}, snapshot, timezone: 'Atlantic/Canary' }) },
    '@/components/billing/FiscalTicketDocument': { FiscalTicketDocument: 'ticket' },
    '@/features/printing/server/access': { requirePrintAccess: async () => { authorized++; } },
    '@/features/printer-settings/server/document-preference-queries': { getCustomerCopyPreference: async (_locale, location) => { assert.equal(location, snapshot.location_id); return { paperFormat: '58mm' }; } },
    '@/features/printer-settings/document-preferences': load('src/features/printer-settings/document-preferences.ts'),
    '@/features/sales-documents/server/actions': { recordSalesDocumentEvent: async (...args) => { assert.equal(args[1], 'invoice'); assert.equal(args[3], 'print_requested'); printed++; } },
  }).default;
  for (const [format, expected] of [[undefined, '58mm'], ['80mm', '80mm'], ['invalid', '58mm']]) {
    const doc = await page({ params: Promise.resolve({ locale: 'en', invoiceId: id(5) }), searchParams: Promise.resolve({ format }) });
    assert.equal(doc.props.format, expected); assert.equal(printed, 0);
  }
  assert.equal(authorized, 3);
});

test('order entry exposes the new explicit route only with its gate open, retaining ordinary Billing', async () => {
  for (const enabled of [false, true]) {
    const { BillingOrderEntry } = load('src/components/billing/BillingOrderEntry.tsx', {
      'next-intl/server': { getTranslations: async () => key => key },
      '@/features/billing/server/order-entry': { getBillingOrderEntry: async () => ({ kind: 'prepare', href: '/app/billing/new?orderId=test' }) },
      '@/features/billing/server/fiscal-ticket-queries': { fiscalTicketEnabled: async () => enabled },
      '@/i18n/navigation': { Link: ({ children, href }) => React.createElement('a', { href }, children) },
    });
    const html = renderToStaticMarkup(await BillingOrderEntry({ locale: 'en', orderId: id(2) }));
    assert.ok(html.includes('/app/billing/new?orderId=test'));
    assert.equal(html.includes('/app/billing/full-prepayment?orderId='), enabled);
  }
});
test('preparation GET requires unchecked confirmations and never emits, charges or retries', async () => {
  let state = 'ready';
  const page = load('src/app/[locale]/app/(dashboard)/billing/full-prepayment/page.tsx', {
    'next-intl/server': { getTranslations: async () => key => { const value = translations('en')[key]; assert.ok(value, key); return value; } },
    '@/i18n/navigation': { Link: ({ children, href }) => React.createElement('a', { href }, children) },
    '@/features/billing/server/fiscal-ticket-queries': { getFiscalTicketPreview: async () => ({ state, invoiceId: id(5), order: { id: id(2), order_number: 'EW-SYNTHETIC', total: 9 }, payment: { id: id(4) }, customer: { customer_type: 'individual' } }) },
    '@/features/billing/server/fiscal-ticket-actions': { issueFullPrepaymentTicketAction: () => fail('MUST_NOT_ISSUE_ON_GET') },
    '@/lib/number-format': money,
  }).default;
  const render = async () => renderToStaticMarkup(await page({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ orderId: id(2) }) }));
  const html = await render();
  for (const name of ['serviceNotPerformed', 'laundryScope']) {
    const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
    assert.ok(input?.includes('required=""'));
    assert.ok(input.includes('type="checkbox"'));
  }
  assert.equal(html.includes('checked=""'), false); assert.ok(html.includes(`value="${id(4)}"`));
  for (const next of ['disabled','unavailable','blocked','issued']) { state = next; assert.equal((await render()).includes('<form'), false); }
});
