import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260828000200_payments_online_001_customer_checkout.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function body(sql, name, next) {
  const start = sql.indexOf(`create function public.${name}`);
  const end = next ? sql.indexOf(`create function public.${next}`, start + 1) : sql.length;
  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return sql.slice(start, end);
}

test("1 online attempts are external workflow state, not a parallel ledger", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.online_payment_attempts/);
  assert.match(sql, /canonical_payment_id uuid references public\.payments/);
  assert.doesNotMatch(sql, /create table public\.(online_payments|invoice_payments)/);
});

test("2 online payments use a separate centralized entitlement disabled by default", async () => {
  const [sql, catalog] = await Promise.all([source(migrationPath), source("src/features/entitlements/feature-catalog.ts")]);
  assert.match(sql, /'payments\.online', 'commerce'/);
  assert.match(catalog, /onlinePayments: "payments\.online"/);
  assert.doesNotMatch(sql, /insert into public\.organization_entitlements/);
});

test("3 tenant provider configuration stores references but no secrets", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.organization_online_payment_configs/);
  assert.match(sql, /merchant_account_reference text/);
  assert.doesNotMatch(sql, /(?:api|webhook|private|client)_secret|secret_key|access_token/i);
});

test("4 Portal availability requires active identity, tenant, entitlement and provider", async () => {
  const availability = body(await source(migrationPath), "get_customer_portal_online_payment_availability", "create_customer_online_payment_attempt");
  assert.match(availability, /access\.user_id = auth\.uid\(\)/);
  assert.match(availability, /access\.is_active/);
  assert.match(availability, /customer\.is_active/);
  assert.match(availability, /platform_service_status = 'active'/);
  assert.match(availability, /'payments\.online'/);
  assert.match(availability, /config\.enabled/);
});

test("5 checkout resolves customer, order, amount and currency server-side", async () => {
  const create = body(await source(migrationPath), "create_customer_online_payment_attempt", "attach_online_payment_provider_session");
  assert.match(create, /orders\.customer_id = portal_access\.customer_id/);
  assert.match(create, /orders\.organization_id = portal_access\.organization_id/);
  assert.match(create, /outstanding := round\(greatest\(target_order\.total - paid_total, 0\), 2\)/);
  assert.match(create, /target_order\.currency/);
  assert.doesNotMatch(create, /target_amount|target_currency/);
});

test("6 cross-customer and cross-tenant orders are denied", async () => {
  const create = body(await source(migrationPath), "create_customer_online_payment_attempt", "attach_online_payment_provider_session");
  assert.match(create, /orders\.organization_id = portal_access\.organization_id/);
  assert.match(create, /orders\.customer_id = portal_access\.customer_id/);
  assert.match(create, /online_payment_order_invalid/);
});

test("7 zero balance, cancelled orders and inactive orders cannot start checkout", async () => {
  const create = body(await source(migrationPath), "create_customer_online_payment_attempt", "attach_online_payment_provider_session");
  assert.match(create, /orders\.is_active/);
  assert.match(create, /production_status <> 'cancelled'/);
  assert.match(create, /outstanding <= 0[\s\S]*online_payment_no_balance/);
});

test("8 checkout double-click and retry safety use transaction locks and idempotency", async () => {
  const sql = await source(migrationPath);
  const create = body(sql, "create_customer_online_payment_attempt", "attach_online_payment_provider_session");
  assert.match(sql, /online_payment_attempts_idempotency_idx[\s\S]*organization_id, idempotency_key/);
  assert.match(sql, /online_payment_attempts_one_pending_order_idx/);
  assert.match(create, /pg_advisory_xact_lock/);
  assert.match(create, /existing_attempt\.id/);
});

test("9 hosted checkout boundary is provider-neutral and isolated", async () => {
  const [contract, factory] = await Promise.all([
    source("src/features/online-payments/providers/provider.ts"),
    source("src/features/online-payments/providers/index.ts"),
  ]);
  for (const method of ["createCheckout", "validateWebhook", "verifyPayment"]) assert.match(contract, new RegExp(method));
  assert.match(factory, /UnconfiguredOnlinePaymentProvider/);
  assert.doesNotMatch(factory, /stripe|redsys|sumup/i);
});

test("10 deterministic adapter is test-only and signed", async () => {
  const adapter = await source("src/features/online-payments/providers/test.ts");
  assert.match(adapter, /process\.env\.NODE_ENV !== "test"/);
  assert.match(adapter, /createHmac\("sha256"/);
  assert.match(adapter, /timingSafeEqual/);
  assert.match(adapter, /test_payment_requires_signed_webhook/);
});

test("11 browser redirect never confirms a payment", async () => {
  const [action, page] = await Promise.all([
    source("src/features/online-payments/server/actions.ts"),
    source("src/app/[locale]/portal/orders/[orderId]/page.tsx"),
  ]);
  assert.match(action, /successUrl: orderUrl\(locale, orderId, "returned"\)/);
  assert.doesNotMatch(`${action}\n${page}`, /success=true|settle_online_payment_attempt/);
});

test("12 webhook validates raw signed input before service-role settlement", async () => {
  const route = await source("src/app/api/payments/online/[provider]/webhook/route.ts");
  const validate = route.indexOf("validateWebhook(rawBody, request.headers)");
  const settle = route.indexOf('admin.rpc("settle_online_payment_attempt"');
  assert.ok(validate >= 0 && settle > validate);
  assert.match(route, /request\.text\(\)/);
  assert.doesNotMatch(route, /request\.json\(\)/);
});

test("13 invalid webhook signatures are rejected without payload logging", async () => {
  const [route, adapter] = await Promise.all([
    source("src/app/api/payments/online/[provider]/webhook/route.ts"),
    source("src/features/online-payments/providers/test.ts"),
  ]);
  assert.match(adapter, /online_payment_webhook_signature_invalid/);
  assert.match(route, /status: 400/);
  assert.doesNotMatch(route, /console\.(log|error)\([^\n]*(rawBody|event)/);
});

test("14 duplicate and reordered provider events are idempotent", async () => {
  const sql = await source(migrationPath);
  const settle = body(sql, "settle_online_payment_attempt", null);
  assert.match(sql, /online_payment_provider_events_unique unique \(provider, provider_event_id\)/);
  assert.match(settle, /if exists \([\s\S]*provider_event_id = target_provider_event_id[\s\S]*return/);
  assert.match(settle, /status not in \('pending', 'failed', 'cancelled', 'expired'\)/);
});

test("15 one external payment reference creates at most one canonical payment", async () => {
  const sql = await source(migrationPath);
  const settle = body(sql, "settle_online_payment_attempt", null);
  assert.match(sql, /online_payment_attempts_provider_payment_idx/);
  assert.match(sql, /payments_online_provider_reference_idx/);
  assert.equal((settle.match(/insert into public\.payments/g) ?? []).length, 1);
});

test("16 successful settlement writes the existing canonical ledger as online card", async () => {
  const [initial, hotfix] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260829000100_payments_online_001_1_settlement_enum_cast.sql"),
  ]);
  const settle = body(initial, "settle_online_payment_attempt", null);
  assert.match(settle, /insert into public\.payments/);
  assert.match(settle, /'card'/);
  assert.match(settle, /'online'/);
  assert.match(settle, /target_provider/);
  assert.match(settle, /target_provider_payment_reference/);
  assert.match(hotfix, /::public\.payment_record_status/);
  assert.match(hotfix, /create or replace function public\.settle_online_payment_attempt/);
});

test("17 concurrent POS settlement revalidates balance under an order lock", async () => {
  const settle = body(await source(migrationPath), "settle_online_payment_attempt", null);
  assert.match(settle, /from public\.orders orders[\s\S]*for update/);
  assert.match(settle, /payment\.status = 'confirmed'/);
  assert.match(settle, /payment\.status = 'refunded'/);
  assert.match(settle, /normalized_amount <= outstanding/);
});

test("18 externally successful overpayment is preserved pending reconciliation", async () => {
  const settle = body(await source(migrationPath), "settle_online_payment_attempt", null);
  assert.match(settle, /'reconciliation_required'/);
  assert.match(settle, /then 'confirmed' else 'pending'/);
  assert.match(settle, /outstanding_changed/);
  assert.doesNotMatch(settle, /insert into public\.payments[\s\S]*status[\s\S]*'refunded'/i);
});

test("19 failed, cancelled and expired attempts create no canonical payment", async () => {
  const outcome = body(await source(migrationPath), "record_online_payment_attempt_outcome", "settle_online_payment_attempt");
  assert.match(outcome, /'failed', 'cancelled', 'expired'/);
  assert.doesNotMatch(outcome, /insert into public\.payments/);
});

test("20 Customer Account, Billing and Portal remain canonical confirmed-minus-refunded consumers", async () => {
  const [account, billing, portal] = await Promise.all([
    source("supabase/migrations/20260826000100_customer_account_001_financial_summary.sql"),
    source("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql"),
    source("supabase/migrations/20260824000100_portal_002_customer_financial_account.sql"),
  ]);
  for (const consumer of [account, billing, portal]) {
    assert.match(consumer, /payments?/);
    assert.match(consumer, /status = 'confirmed'/);
    assert.match(consumer, /status = 'refunded'/);
  }
});

test("21 Portal CTA is entitlement/configuration gated and sends no trusted amount", async () => {
  const [view, action] = await Promise.all([
    source("src/components/portal/CustomerPortalViews.tsx"),
    source("src/features/online-payments/server/actions.ts"),
  ]);
  assert.match(view, /onlinePayment\.availability\.eligible/);
  assert.match(view, /name="idempotencyKey"/);
  assert.doesNotMatch(view, /name="(amount|currency)"/);
  assert.doesNotMatch(action, /formData\.get\("(amount|currency)"\)/);
});

test("22 no raw card or authentication data is collected or persisted", async () => {
  const files = await Promise.all([
    source(migrationPath),
    source("src/components/portal/CustomerPortalViews.tsx"),
    source("src/features/online-payments/providers/provider.ts"),
  ]);
  assert.doesNotMatch(files.join("\n"), /\b(PAN|CVV|PIN|magnetic stripe|full card number|card authentication secret)\b/i);
  assert.doesNotMatch(files[1], /type="password"|autocomplete="cc-/i);
});

test("23 tenant RLS prevents customers reading another customer's attempts and forbids writes", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /online_payment_attempts_select_customer_or_management[\s\S]*access\.customer_id = online_payment_attempts\.customer_id[\s\S]*access\.user_id = auth\.uid\(\)/);
  assert.match(sql, /revoke all on public\.online_payment_attempts from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.online_payment_attempts to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all) on public\.online_payment_attempts/i);
});

test("24 settlement and provider mutation RPCs are service-role only with fixed search paths", async () => {
  const sql = await source(migrationPath);
  assert.match(body(sql, "settle_online_payment_attempt", null), /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /grant execute on function public\.settle_online_payment_attempt[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.settle_online_payment_attempt[^;]*to authenticated/);
  assert.equal((sql.match(/security definer/g) ?? []).length, 6);
  assert.equal((sql.match(/set search_path = public/g) ?? []).length, 7);
});

test("25 all five locales expose customer and Platform Admin online-payment vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.portal.onlinePayments.payNow, "string");
    assert.equal(typeof messages.portal.onlinePayments.received, "string");
    assert.equal(typeof messages.portal.onlinePayments.notCompleted, "string");
    assert.equal(typeof messages.platform.features.labels.onlinePayments, "string");
  }
});

test("26 migration is additive and never mutates historical orders, invoices or payment rows", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /\b(delete from|truncate)\b/i);
  assert.doesNotMatch(sql, /update public\.(orders|invoices|payments)/i);
  assert.doesNotMatch(sql, /drop (table|column)/i);
  assert.match(sql, /alter table public\.payments drop constraint payments_channel_check/);
});
