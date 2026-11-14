import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { terminal, button, labels, customer, pendingAttempt } from './helpers/shop-terminal-harness.mjs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, imports = {}) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, FormData, encodeURIComponent, require(name) {
      if (name === 'server-only') return {};
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      if (Object.hasOwn(imports, name)) return imports[name];
      throw Error(`Unexpected import ${name}`);
    },
  });
  return module.exports;
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const order = { id: id(1), total: 9, order_number: 'EW-SYNTHETIC' };
const payment = { id: id(2), status: 'confirmed', channel: 'pos', amount: 9 };
const ready = { state: 'ready', preview: { order, payment, customer: { customer_type: 'individual' } }, copyHref: `/app/orders/${order.id}/print/customer-copy?format=80mm` };
const redirect = href => { throw Object.assign(Error('REDIRECT'), { href }); };
function resolver(options = {}) {
  let previewReads = 0;
  const { getTerminalCustomerDocument } = load('src/features/shop-terminal/server/customer-document.ts', {
    '@/features/shop-terminal/server/access': { requireShopTerminalAccess: async () => {
      if (options.denied) throw Error('TENANT_OR_ROLE_DENIED');
      return { membership: { role: options.role ?? 'owner' } };
    } },
    '@/features/printing/server/access': { requirePrintAccess: async () => { if (options.noPrint) throw Error('PRINT_DENIED'); } },
    '@/features/printing/server/queries': { getPrintOrderContext: async (_locale, orderId) => {
      if (orderId !== order.id) throw Error('NOT_FOUND');
      return { order, payments: options.payments ?? [payment] };
    } },
    '@/features/entitlements/server/resolver': { hasEntitlement: async () => !options.noBilling },
    '@/features/entitlements/feature-catalog': { FEATURES: { billingInvoicing: 'billing.invoicing' } },
    '@/features/billing/server/fiscal-ticket-queries': {
      findIssuedFiscalTicketForOrder: async () => options.recovered ?? { state: 'none' },
      getFiscalTicketPreview: async () => { previewReads++; return options.preview ?? { state: 'ready', order, payment }; },
    },
  });
  return { call: (orderId = order.id) => getTerminalCustomerDocument('it', orderId), reads: () => previewReads };
}
test('eligible full POS payment resolves the persisted order/payment without writes', async () => {
  const r = await resolver().call(); assert.equal(r.state, 'ready'); assert.equal(r.preview.payment.id, payment.id);
});
for (const [name, payments] of [['PAGA DOPO', []], ['partial', [{ ...payment, amount: 3 }]], ['mixed', [payment, { ...payment, id: id(9) }]], ['refund', [{ ...payment, status: 'refunded' }]]]) {
  test(`${name}: preserve operational copy and never select prepayment issuance`, async () => {
    const r = await resolver({ payments, preview: { state: 'blocked' } }).call();
    assert.equal(r.state, 'operational'); assert.ok(r.copyHref.endsWith('format=80mm'));
  });
}
for (const options of [{ role: 'staff' }, { noBilling: true }]) test(`existing Terminal access does not acquire Billing rights: ${JSON.stringify(options)}`, async () => {
  const r = resolver(options); assert.equal((await r.call()).state, 'operational'); assert.equal(r.reads(), 0);
});
test('disabled tenant has operational output; fiscal read errors remain distinct', async () => {
  assert.equal((await resolver({ preview: { state: 'disabled' } }).call()).state, 'operational');
  assert.equal((await resolver({ preview: { state: 'unavailable' } }).call()).state, 'unavailable');
  assert.equal((await resolver({ preview: { state: 'blocked' } }).call()).state, 'blocked');
});
test('tenant, Terminal and print authorization failures propagate without fiscal side effects', async () => {
  for (const options of [{ denied: true }, { noPrint: true }]) await assert.rejects(resolver(options).call());
  await assert.rejects(resolver().call(id(99)), /NOT_FOUND/);
});
test('existing invoice is recovered before reconsidering present-day payment eligibility', async () => {
  const r = await resolver({ payments: [], preview: { state: 'issued', invoiceId: id(3) } }).call();
  assert.equal(r.state, 'issued'); assert.equal(r.invoiceId, id(3));
});
test('existing invoice recovery wins over disabled issuance and failed fiscal lookups stay explicit', async () => {
  const r = resolver({ recovered: { state: 'issued', invoiceId: id(3) }, preview: { state: 'disabled' } });
  assert.equal((await r.call()).invoiceId, id(3)); assert.equal(r.reads(), 0);
  assert.equal((await resolver({ recovered: { state: 'unavailable' } }).call()).state, 'unavailable');
});
function terminalAction(document = ready, outcome = { state: 'issued', invoiceId: id(3) }) {
  const calls = [];
  const a = load('src/features/shop-terminal/server/customer-document-actions.ts', {
    'next/navigation': { redirect },
    './customer-document': { getTerminalCustomerDocument: async () => document },
    '@/features/billing/fiscal-ticket': load('src/features/billing/fiscal-ticket.ts'),
    '@/features/billing/server/fiscal-ticket-actions': { requestFullPrepaymentTicket: async (...args) => { calls.push(args); return outcome; } },
  });
  const form = new FormData();
  for (const [k, v] of Object.entries({ recipient: 'consumer', paymentId: id(99), serviceNotPerformed: 'on', laundryScope: 'on', organization_id: id(99) })) form.set(k, v);
  return { form, calls, call: () => a.issueTerminalCustomerDocument('it', order.id, form) };
}
test('Terminal delegates once to the existing Billing action with a server-read payment ID', async () => {
  const a = terminalAction(); await assert.rejects(a.call(), e => e.href === `/it/app/billing/${id(3)}/ticket?format=80mm`);
  assert.equal(a.calls.length, 1); assert.equal(a.calls[0][1], order.id); assert.equal(a.calls[0][2].get('paymentId'), payment.id);
});
test('unchecked confirmations, invalid recipient and ineligible states never invoke Billing', async () => {
  for (const field of ['recipient', 'serviceNotPerformed', 'laundryScope']) {
    const a = terminalAction(); a.form.delete(field); await assert.rejects(a.call(), e => e.href.endsWith('result=confirmation')); assert.equal(a.calls.length, 0);
  }
  for (const state of ['operational', 'blocked', 'unavailable']) {
    const a = terminalAction({ state }); await assert.rejects(a.call()); assert.equal(a.calls.length, 0);
  }
});
test('uncertain issuance preserves the saved order and returns to a GET-only recovery path', async () => {
  const a = terminalAction(ready, { state: 'uncertain' });
  await assert.rejects(a.call(), e => e.href === `/it/app/shop/customer-document?orderId=${order.id}&result=uncertain`);
  assert.equal(a.calls.length, 1);
  const recovered = terminalAction({ state: 'issued', invoiceId: id(3) });
  for (let i = 0; i < 2; i++) await assert.rejects(recovered.call(), e => e.href.includes(`/billing/${id(3)}/ticket`));
  assert.equal(recovered.calls.length, 0);
});
function page(document) {
  return load('src/app/[locale]/app/(dashboard)/shop/customer-document/page.tsx', {
    'next/navigation': { redirect },
    'next-intl/server': { getTranslations: async () => key => key },
    '@/i18n/navigation': { Link: ({ children, href }) => React.createElement('a', { href }, children) },
    '@/features/shop-terminal/server/customer-document': { getTerminalCustomerDocument: async () => document },
    '@/features/shop-terminal/server/customer-document-actions': { issueTerminalCustomerDocument: async () => { throw Error('GET_MUST_NOT_ISSUE'); } },
    '@/lib/number-format': load('src/lib/number-format.ts'),
  }).default;
}
test('PAGA DOPO automatically opens non-fiscal 80mm copy; uncertain result never silently redirects there', async () => {
  const document = { state: 'operational', copyHref: ready.copyHref };
  await assert.rejects(page(document)({ params: Promise.resolve({ locale: 'it' }), searchParams: Promise.resolve({ orderId: order.id }) }), e => e.href === '/it' + ready.copyHref);
  const html = renderToStaticMarkup(await page(document)({ params: Promise.resolve({ locale: 'it' }), searchParams: Promise.resolve({ orderId: order.id, result: 'uncertain' }) }));
  assert.ok(html.includes('uncertain')); assert.ok(html.includes('operationalCopy'));
});
test('Terminal fiscal confirmation has no preselected declarations or recipient and no GET emission', async () => {
  const html = renderToStaticMarkup(await page(ready)({ params: Promise.resolve({ locale: 'it' }), searchParams: Promise.resolve({ orderId: order.id }) }));
  assert.equal(html.includes('checked=""'), false); assert.ok(html.includes('chooseRecipient'));
  const blank = html.match(/<option[^>]*value=""[^>]*>/)?.[0]; assert.ok(blank?.includes('selected=""')); assert.ok(html.includes('serviceNotPerformed')); assert.ok(html.includes('laundryScope'));
});
const helpers = load('src/features/billing/fiscal-ticket.ts');
test('notes snapshot is backward compatible, allowlisted, and rejects non-text customer notes', () => {
  const base = { order_number: 'EW-1', due_at: null, location_id: null };
  assert.equal(Object.hasOwn(helpers.fiscalTicketSnapshot(base), 'customer_notes'), false);
  for (const note of [null, '', 'Frozen notes']) assert.equal(helpers.fiscalTicketSnapshot({ ...base, customer_notes: note }).customer_notes, note);
  assert.equal(helpers.fiscalTicketSnapshot({ ...base, customer_notes: 42 }), null);
  assert.equal(Object.hasOwn(helpers.fiscalTicketSnapshot({ ...base, internal_notes: 'SECRET' }), 'internal_notes'), false);
});
for (const locale of ['it', 'es', 'en', 'fr', 'de']) test(`shared customer layout uses only frozen Billing values and notes in ${locale}`, async () => {
  const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
  const money = load('src/lib/number-format.ts'); const time = load('src/lib/organization-timezone.ts');
  const copy = load('src/components/printing/OrderPrintDocument.tsx', {
    'next/image': { default: props => React.createElement('img', props) },
    'next-intl/server': { getTranslations: async () => key => key.split('.').reduce((v, k) => v[k], messages.print) },
    '@/lib/number-format': money, '@/lib/organization-timezone': time,
    '@/components/printing/PrintButton': {}, '@/features/printing/labels': {}, '@/i18n/navigation': {},
    '@/components/barcode/ScannableQrCode': {}, '@/features/barcode/payload': {},
  });
  const fiscal = load('src/components/billing/FiscalTicketDocument.tsx', {
    'next-intl/server': { getTranslations: async () => key => messages.billing.fiscalTicket[key] },
    '@/components/billing/PrintInvoiceButton': { PrintInvoiceButton: () => React.createElement('button', {}, 'Print') },
    '@/lib/number-format': money, '@/lib/organization-timezone': time,
    '@/features/billing/tax-rate': load('src/features/billing/tax-rate.ts'),
    '@/components/printing/OrderPrintDocument': copy, './FiscalTicketDocument.module.css': { default: {} },
  });
  const detail = { invoice: { invoiceNumber: '2026-S-000001', currency: 'EUR', createdAt: '2026-11-14T10:00:00Z', issuedAt: '2026-11-14T10:00:00Z', issuerLegalName: 'SYNTHETIC ISSUER', issuerTaxId: 'TEST-ISSUER', customerName: 'SYNTHETIC CUSTOMER', subtotal: 10, discountTotal: 1, total: 9, taxableBase: 8.41, taxTotal: .59, paidTotal: 88888, outstanding: 12345, notes: 'PRIVATE_INTERNAL' }, items: [{ id: id(4), description: 'Shirts', quantity: 2, unitType: 'piece', unitPrice: 5, lineTotal: 9, taxableBase: 8.41, taxAmount: .59, taxRate: 7 }] };
  const snapshot = { order_number: 'EW-SYNTHETIC', due_at: '2026-11-15T15:00:00Z', location_id: null, customer_notes: 'FROZEN CUSTOMER <script>alert(1)</script>' };
  const header = { branding: { brand: { name: 'SYNTHETIC BRAND', logoPath: null } }, organizationName: 'SYNTHETIC', locationName: null };
  for (const format of ['80mm', '58mm', 'a4']) {
    const html = renderToStaticMarkup(await fiscal.FiscalTicketDocument({ detail, snapshot, header, locale, timezone: 'Atlantic/Canary', format }));
    for (const v of ['2026-S-000001', 'SYNTHETIC BRAND', 'TEST-ISSUER', 'SYNTHETIC CUSTOMER', 'EW-SYNTHETIC', 'FROZEN CUSTOMER', 'IGIC 7%', `order-print-customer-${format}`]) assert.ok(html.includes(v), v);
    for (const v of ['PRIVATE_INTERNAL', '88888', '12345', '<script>']) assert.equal(html.includes(v), false, v);
    assert.ok(html.includes(messages.billing.fiscalTicket.commercialAtIssue));
    assert.equal(html.includes(messages.print.customerCopy.notFiscal), false);
  }
});
test('successful intake opens the persisted order document once, only after confirmation and cleanup', async () => {
  const ui = terminal(); ui.props.canPrint = true;
  const request = ui.start(); assert.equal(ui.calls.navigate, undefined);
  ui.response.resolve({ error: null, result: { customerId: customer.id, customerName: 'SYNTHETIC', orderId: id(1), orderNumber: 'EW-1', isWalkIn: false, total: 9, paid: 9, outstanding: 0 } });
  await request.settled; ui.render(); ui.runEffect('const submittedCustomerId');
  assert.deepEqual(ui.calls.navigate, [`/app/shop/customer-document?orderId=${id(1)}`]);
  assert.equal(ui.calls.submit.length, 1);
  ui.render(); ui.runEffect('const submittedCustomerId'); assert.equal(ui.calls.navigate.length, 1);
});
test('lost intake response recovers the original order document without creating another order or payment', async () => {
  const ui = terminal({ restored: pendingAttempt }); ui.props.canPrint = true;
  ui.props.statusResult = { status: 'completed', orderId: id(1), orderNumber: 'EW-1' };
  await button(ui.render(), labels.submissionCheck).props.onClick();
  assert.deepEqual(ui.calls.navigate, [`/app/shop/customer-document?orderId=${id(1)}`]);
  assert.equal(ui.calls.submit.length, 0); assert.equal(ui.calls.status.length, 1);
});
