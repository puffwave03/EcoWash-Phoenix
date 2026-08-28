import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function body(sql, name, next) {
  const start = sql.indexOf(`create function public.${name}`);
  const end = next ? sql.indexOf(`create function public.${next}`, start) : sql.length;
  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return sql.slice(start, end);
}

test("1 open till records tenant, location, actor, opening cash and time", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.pos_sessions/);
  for (const field of ["organization_id", "location_id", "opened_by", "opened_at", "opening_cash"]) assert.match(sql, new RegExp(field));
  assert.match(body(sql, "open_pos_session", "record_pos_payment"), /insert into public\.pos_sessions/);
});

test("2 duplicate open till is transactionally rejected", async () => {
  const sql = await source(migrationPath);
  const open = body(sql, "open_pos_session", "record_pos_payment");
  assert.match(sql, /pos_sessions_one_open_till_idx[\s\S]*where status = 'open'/);
  assert.match(open, /pg_advisory_xact_lock/);
  assert.match(open, /pos_session_already_open/);
});

test("3 cash payment uses the canonical payments ledger and an open till", async () => {
  const pay = body(await source(migrationPath), "record_pos_payment", "record_pos_refund");
  assert.match(pay, /insert into public\.payments/);
  assert.match(pay, /target_method = 'cash'[\s\S]*pos_cash_requires_open_session/);
  assert.match(pay, /target_session\.status <> 'open'/);
});

test("4 card payment is provider-neutral manual only", async () => {
  const pay = body(await source(migrationPath), "record_pos_payment", "record_pos_refund");
  assert.match(pay, /'manual'/);
  assert.match(pay, /'recorded_manual'/);
  assert.match(pay, /pos_provider_not_supported/);
});

test("5 partial payment is allowed up to the live outstanding amount", async () => {
  const pay = body(await source(migrationPath), "record_pos_payment", "record_pos_refund");
  assert.match(pay, /normalized_amount > round\(target_order\.total - paid_total, 2\)/);
  assert.doesNotMatch(pay, /normalized_amount = target_order\.total/);
});

test("6 mixed payment is multiple real rows, never a mixed method", async () => {
  const [sql, types] = await Promise.all([source(migrationPath), source("src/features/payments/types.ts")]);
  assert.match(types, /"cash", "card", "bank_transfer", "other"/);
  assert.doesNotMatch(`${sql}\n${types}`, /['"]mixed['"]/);
});

test("7 due-order outstanding uses confirmed minus refunded canonical rows", async () => {
  const due = body(await source(migrationPath), "list_pos_orders_due", "get_pos_receipt_data");
  assert.match(due, /payment\.status = 'confirmed'/);
  assert.match(due, /payment\.status = 'refunded'/);
  assert.match(due, /greatest\(orders\.total - totals\.paid, 0\)/);
});

test("8 overpayment is rejected server-side", async () => {
  assert.match(body(await source(migrationPath), "record_pos_payment", "record_pos_refund"), /pos_payment_exceeds_outstanding/);
});

test("9 concurrent payment and till close use row locks", async () => {
  const sql = await source(migrationPath);
  assert.match(body(sql, "record_pos_payment", "record_pos_refund"), /from public\.pos_sessions[\s\S]*for update[\s\S]*from public\.orders[\s\S]*for update/);
  assert.match(body(sql, "close_pos_session", "list_pos_orders_due"), /from public\.pos_sessions[\s\S]*for update/);
});

test("10 idempotent retry uses a tenant unique key and validates the original request", async () => {
  const sql = await source(migrationPath);
  const pay = body(sql, "record_pos_payment", "record_pos_refund");
  assert.match(sql, /unique index payments_pos_idempotency_idx[\s\S]*organization_id, idempotency_key/);
  assert.match(pay, /existing_payment\.order_id <> target_order_id/);
  assert.match(pay, /return existing_payment\.id/);
});

test("11 refund is a canonical row linked to the original payment", async () => {
  const refund = body(await source(migrationPath), "record_pos_refund", "get_pos_session_summary");
  assert.match(refund, /refunded_from_payment_id/);
  assert.match(refund, /source_payment\.id/);
  assert.match(refund, /'refunded'/);
});

test("12 refund above remaining refundable amount is rejected under lock", async () => {
  const refund = body(await source(migrationPath), "record_pos_refund", "get_pos_session_summary");
  assert.match(refund, /status = 'confirmed'[\s\S]*for update/);
  assert.match(refund, /source_payment\.amount - already_refunded/);
  assert.match(refund, /pos_refund_exceeds_refundable/);
});

test("13 cash refund decreases till expected cash", async () => {
  const summary = body(await source(migrationPath), "get_pos_session_summary", "close_pos_session");
  assert.match(summary, /payment\.method = 'cash' and payment\.status = 'refunded'/);
  assert.match(summary, /session\.opening_cash[\s\S]*\+[\s\S]*- coalesce/);
});

test("14 expected cash equals opening plus cash receipts minus cash refunds", async () => {
  const summary = body(await source(migrationPath), "get_pos_session_summary", "close_pos_session");
  assert.match(summary, /session\.opening_cash/);
  assert.match(summary, /payment\.status = 'confirmed'/);
  assert.match(summary, /payment\.status = 'refunded'/);
});

test("15 close till stores an immutable reconciliation snapshot", async () => {
  const close = body(await source(migrationPath), "close_pos_session", "list_pos_orders_due");
  assert.match(close, /status = 'closed'/);
  assert.match(close, /closed_by = auth\.uid\(\)/);
  assert.match(close, /expected_cash = calculated_expected/);
  assert.match(close, /counted_cash = round\(target_counted_cash, 2\)/);
});

test("16 counted difference is calculated by the database", async () => {
  assert.match(body(await source(migrationPath), "close_pos_session", "list_pos_orders_due"), /difference = round\(target_counted_cash - calculated_expected, 2\)/);
});

test("17 closed till rejects new linked transactions", async () => {
  for (const name of ["record_pos_payment", "record_pos_refund"]) {
    assert.match(body(await source(migrationPath), name, name === "record_pos_payment" ? "record_pos_refund" : "get_pos_session_summary"), /target_session\.status <> 'open'[\s\S]*pos_session_not_open/);
  }
});

test("18 Owner receives POS capability through the existing role architecture", async () => {
  const capability = await source("supabase/migrations/20260820000100_ux_ops_001_8_access_capabilities.sql");
  assert.match(capability, /membership\.role in \('owner', 'manager'\)/);
});

test("19 Manager receives POS capability through the existing role architecture", async () => {
  const access = body(await source(migrationPath), "require_pos_access", "open_pos_session");
  assert.match(access, /has_pos_capability/);
  assert.match(await source("src/lib/auth/capabilities.ts"), /role === "owner" \|\| role === "manager"/);
});

test("20 Staff with explicit POS capability can pass the shared access guard", async () => {
  const [sql, capabilities] = await Promise.all([source(migrationPath), source("src/lib/auth/capabilities.ts")]);
  assert.match(sql, /alter type public\.operational_capability add value if not exists 'pos'/);
  assert.match(capabilities, /"pos"/);
  assert.match(body(sql, "require_pos_access", "open_pos_session"), /has_pos_capability/);
});

test("21 Staff without POS capability is denied and new Staff is not auto-granted", async () => {
  const capabilities = await source("src/lib/auth/capabilities.ts");
  assert.match(capabilities, /DEFAULT_STAFF_OPERATIONAL_CAPABILITIES[\s\S]*capability !== "pos"/);
  assert.match(body(await source(migrationPath), "require_pos_access", "open_pos_session"), /pos_not_authorized/);
});

test("22 disabled POS entitlement denies route actions and database mutations", async () => {
  const [sql, access, actions] = await Promise.all([source(migrationPath), source("src/features/pos/server/access.ts"), source("src/features/pos/server/actions.ts")]);
  assert.match(body(sql, "require_pos_access", "open_pos_session"), /organization_entitlement_is_enabled[\s\S]*'pos'/);
  assert.match(access, /requireEntitlement\(locale, FEATURES\.pos\)/);
  assert.equal((actions.match(/requirePosAccess\(locale\)/g) ?? []).length, 4);
});

test("23 disabling POS preserves all existing financial and till data", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(payments|pos_sessions|orders|invoices)/i);
  assert.doesNotMatch(sql, /update\s+public\.(payments|orders|invoices)/i);
  assert.doesNotMatch(sql, /drop\s+(table|column)/i);
});

test("24 tenant and location isolation are enforced in every mutation", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /pos_sessions_location_same_org/);
  for (const name of ["open_pos_session", "record_pos_payment", "record_pos_refund", "close_pos_session"]) {
    assert.match(body(sql, name, name === "open_pos_session" ? "record_pos_payment" : name === "record_pos_payment" ? "record_pos_refund" : name === "record_pos_refund" ? "get_pos_session_summary" : "list_pos_orders_due"), /org_id/);
  }
  assert.match(body(sql, "require_pos_access", "open_pos_session"), /target_organization_id <> public\.app_current_organization_id\(\)/);
});

test("25 Customer Account remains on confirmed-minus-refunded payments", async () => {
  const account = await source("supabase/migrations/20260826000100_customer_account_001_financial_summary.sql");
  assert.match(account, /payments\.status = 'confirmed'/);
  assert.match(account, /payments\.status = 'refunded'/);
  assert.match(account, /confirmed_total - payment_totals\.refunded_total/);
});

test("26 Billing remains on the linked-order canonical payment ledger", async () => {
  const billing = await source("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
  assert.match(billing, /join public\.payments payment/);
  assert.match(billing, /payment\.order_id = invoice_order\.order_id/);
  assert.match(billing, /payment\.status = 'confirmed'/);
  assert.match(billing, /payment\.status = 'refunded'/);
});

test("27 POS navigation, route and order action share entitlement and capability gates", async () => {
  const [navigation, page, order] = await Promise.all([source("src/components/dashboard/AppNavigation.tsx"), source("src/app/[locale]/app/(dashboard)/pos/page.tsx"), source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx")]);
  assert.match(navigation, /entitlementEnabled\(entitlements, FEATURES\.pos\)/);
  assert.match(navigation, /canUse\("pos"\)/);
  assert.match(page, /requirePosAccess\(locale\)/);
  assert.match(order, /hasOperationalCapability\(access\.membership, "pos"\)/);
  assert.match(order, /\/app\/pos\?q=/);
});

test("28 receipt-ready fields and provider adapter boundary exist without card secrets", async () => {
  const [sql, provider, workspace] = await Promise.all([source(migrationPath), source("src/features/pos/providers/types.ts"), source("src/components/pos/PosWorkspace.tsx")]);
  for (const field of ["organization_name", "location_name", "order_number", "customer_name", "actor_name", "remaining_balance"]) assert.match(sql, new RegExp(field));
  for (const method of ["createPaymentIntent", "confirmPayment", "refundPayment", "getStatus"]) assert.match(provider, new RegExp(method));
  assert.doesNotMatch(`${sql}\n${provider}\n${workspace}`, /\b(PAN|CVV|magstripe|full card number|PIN)\b/);
});

test("29 all five locales expose complete POS and Staff capability vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.auth.dashboard.pos, "string");
    assert.equal(typeof messages.staff.capabilityLabels.pos, "string");
    assert.equal(typeof messages.pos.actions.pay, "string");
    assert.equal(typeof messages.pos.payments.manualCard, "string");
    assert.equal(typeof messages.pos.close.counted, "string");
  }
});

test("30 privileged functions have fixed search paths and least-privilege grants", async () => {
  const sql = await source(migrationPath);
  assert.equal((sql.match(/security definer/g) ?? []).length, 9);
  assert.equal((sql.match(/set search_path = public/g) ?? []).length, 10);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/);
  assert.doesNotMatch(sql, /service_role/i);
  for (const fn of ["open_pos_session", "record_pos_payment", "record_pos_refund", "get_pos_session_summary", "close_pos_session", "list_pos_orders_due", "get_pos_receipt_data"]) assert.match(sql, new RegExp(`grant execute on function public\\.${fn}`));
});

test("31 linked PostgreSQL resolves the current tenant without min(uuid)", async () => {
  const fix = await source("supabase/migrations/20260828000100_pos_001_1_fix_current_organization_uuid_aggregate.sql");
  assert.match(fix, /min\(membership\.organization_id::text\)::uuid/);
  assert.doesNotMatch(fix, /min\(membership\.organization_id\)/);
  assert.match(fix, /membership_count <> 1/);
  assert.match(fix, /platform_service_status = 'active'/);
  assert.match(fix, /security definer[\s\S]*set search_path = public/);
  assert.match(fix, /revoke all on function public\.app_current_organization_id\(\) from public, anon, authenticated/);
});
