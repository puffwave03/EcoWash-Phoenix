import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20261007000100_billing_eligible_order_selector_001.sql');
const query = read('src/features/billing/server/queries.ts');
const page = read('src/app/[locale]/app/(dashboard)/billing/new/page.tsx');
const form = read('src/components/billing/BillingCreateForm.tsx');

function discover(rows, phrase = '', customerId = null, orderId = null) {
  const search = phrase.trim().toLowerCase();
  const matches = rows.filter((row) => row.org === 'tenant-a' && row.active && row.status !== 'cancelled'
    && !row.linked && row.code !== 'WALKIN-SHARED'
    && (!customerId || row.customerId === customerId) && (!orderId || row.id === orderId)
    && (!search || [row.number, row.name, row.code].some((value) => value?.toLowerCase().includes(search))));
  matches.sort((a, b) => b.created - a.created || b.id.localeCompare(a.id));
  return { visible: matches.slice(0, 100), hasMore: matches.length > 100 };
}

const order = (n, overrides = {}) => ({ id: String(n).padStart(5, '0'), org: 'tenant-a', active: true,
  status: 'received', linked: false, code: 'C-1', name: 'Ada', customerId: 'c-1', number: `O-${n}`,
  created: n, ...overrides });

test('database eligibility and search precede deterministic bounded result', () => {
  assert.match(sql, /from public\.orders o\s+join public\.customers c[\s\S]*where o\.organization_id = org_id[\s\S]*and o\.is_active[\s\S]*and o\.production_status <> 'cancelled'[\s\S]*and c\.customer_code is distinct from 'WALKIN-SHARED'[\s\S]*and not exists \([\s\S]*public\.invoice_orders io[\s\S]*io\.is_active[\s\S]*and \(normalized_query = ''\s+or strpos[\s\S]*order by o\.created_at desc, o\.id desc\s+limit target_limit/s);
  assert.match(sql, /length\(normalized_query\) > 100/);
  assert.match(sql, /lower\(btrim\(coalesce\(target_query, ''\)\)\)/);
  assert.doesNotMatch(sql, /\bilike\b|\blike\b/i);
  assert.match(query, /target_limit: 101/);
  assert.match(query, /hasMore: rows\.length > 100/);
  assert.match(query, /orders: rows\.slice\(0, 100\)/);
  assert.match(query, /if \(error\) throw error/);
  assert.doesNotMatch(query.slice(query.indexOf('export async function listEligibleBillingOrders'), query.indexOf('export async function getCustomerBillingOverview')), /from\("invoice_orders"\)|from\("orders"\)|new Set/);
});

test('many recent ineligible rows cannot hide older eligible orders', () => {
  const rows = Array.from({ length: 160 }, (_, i) => order(i, { linked: i >= 40 }));
  const result = discover(rows);
  assert.equal(result.visible.length, 40);
  assert.equal(result.visible[0].id, order(39).id);
  assert.equal(result.visible.at(-1).id, order(0).id);
});

test('default and searched results use a 100-row window with a sentinel', () => {
  const rows = Array.from({ length: 130 }, (_, i) => order(i, { name: 'Older Client' }));
  for (const phrase of ['', ' older client ']) {
    const result = discover(rows, phrase);
    assert.equal(result.visible.length, 100);
    assert.equal(result.visible[0].id, order(129).id);
    assert.equal(result.visible.at(-1).id, order(30).id);
    assert.equal(result.hasMore, true);
  }
  assert.equal(discover([order(1), order(2, { created: 1 })]).visible[0].id, order(2).id);
  assert.match(page, /discovery\.hasMore[\s\S]*create\.search\.more/);
  assert.match(form, /hasMore \? text\.shown : text\.available/);
});

test('search runs across old order number, customer name and code with literal punctuation', () => {
  const rows = Array.from({ length: 145 }, (_, i) => order(i));
  rows[0] = order(0, { number: 'OLD_100%', name: 'Rare Customer', code: 'Z-99' });
  for (const phrase of ['old_100%', 'rare customer', 'z-99']) {
    const result = discover(rows, phrase);
    assert.deepEqual(result.visible.map((row) => row.id), [order(0).id]);
  }
  assert.equal(discover(rows, '_').visible.length, 1);
  assert.match(sql, /strpos\(lower\(o\.order_number\), normalized_query\)[\s\S]*strpos\(lower\(c\.display_name\), normalized_query\)[\s\S]*strpos\(lower\(coalesce\(c\.customer_code, ''\)\), normalized_query\)/);
});

test('canonical exclusions retain inactive customer history and tenant isolation', () => {
  const rows = [order(1, { linked: true }), order(2, { status: 'cancelled' }),
    order(3, { active: false }), order(4, { code: 'WALKIN-SHARED' }),
    order(5, { org: 'tenant-b' }), order(6, { customerActive: false })];
  assert.deepEqual(discover(rows).visible.map((row) => row.id), [order(6).id]);
  assert.doesNotMatch(sql, /c\.is_active\s*=|and c\.is_active\b/);
  assert.match(sql, /c\.organization_id = org_id/);
});

test('exact old order/customer entry remains scoped and preselected', () => {
  const rows = Array.from({ length: 150 }, (_, i) => order(i, { customerId: i === 0 ? 'old-customer' : 'c-1' }));
  assert.deepEqual(discover(rows, '', 'old-customer', order(0).id).visible.map((row) => row.id), [order(0).id]);
  assert.deepEqual(discover(rows, '', 'c-1', order(0).id).visible, []);
  assert.match(sql, /target_customer_id is null or o\.customer_id = target_customer_id/);
  assert.match(sql, /target_order_id is null or o\.id = target_order_id/);
  assert.match(query, /target_query: orderId \? "" : search\.trim\(\)\.slice\(0, 100\)/);
  assert.match(page, /listEligibleBillingOrders\(locale, query\.customerId, query\.orderId, search\)/);
  assert.match(page, /query\.source === "shop" && query\.orderId/);
  assert.match(form, /defaultChecked=\{order\.id === selectedOrderId\}/);
});

test('RPC derives organization and requires Billing owner or manager access', () => {
  assert.match(sql, /create function public\.list_eligible_billing_orders\(\s*target_query text, target_customer_id uuid, target_order_id uuid, target_limit integer/);
  assert.match(sql, /security definer set search_path = public/);
  assert.match(sql, /org_id := public\.app_current_organization_id\(\)/);
  assert.match(sql, /has_organization_role\(org_id, array\['owner', 'manager'\]::public\.app_role\[\]\)/);
  assert.match(sql, /organization_entitlement_is_enabled\(org_id, 'billing\.invoicing', now\(\)\)/);
  assert.match(sql, /revoke all on function public\.list_eligible_billing_orders\(text, uuid, uuid, integer\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.list_eligible_billing_orders\(text, uuid, uuid, integer\) to authenticated/);
  assert.doesNotMatch(sql, /target_organization_id|service_role|\b(insert|update|delete|create table|create index|alter table)\b/i);
  assert.match(query, /await requireOwnerOrManager\(locale\)/);
  assert.match(query, /await requireEntitlement\(locale, FEATURES\.billingInvoicing\)/);
});

test('search state and draft creation semantics remain narrow', () => {
  assert.match(page, /method="get" role="search"/);
  assert.match(page, /name="customerId" type="hidden"/);
  assert.match(page, /name="q"/);
  assert.match(page, /search \? t\("create\.search\.empty"\) : undefined/);
  assert.match(form, /const key = `\$\{order\.customerId\}:\$\{order\.currency\}`/);
  assert.match(form, /createBillingDraftAction\.bind\(null, locale, first\.customerId\)/);
  assert.match(form, /name="orderId" type="checkbox"/);
  const action = read('src/features/billing/server/actions.ts');
  assert.match(action, /create_billing_draft/);
  const foundation = read('supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql');
  assert.match(foundation, /create function public\.create_billing_draft/i);
});

test('all five locales provide discovery, empty state and bounded result labels', () => {
  for (const locale of ['it', 'es', 'en', 'fr', 'de']) {
    const messages = JSON.parse(read(`src/i18n/${locale}/common.json`));
    for (const key of ['label', 'placeholder', 'apply', 'clear', 'more', 'empty']) {
      assert.ok(messages.billing.create.search[key]?.trim(), `${locale}: ${key}`);
    }
    assert.match(messages.billing.create.form.shown, /\{count\}/);
  }
});
