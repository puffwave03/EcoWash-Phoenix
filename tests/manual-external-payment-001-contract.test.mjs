import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseManualExternalPayment } from "../src/features/payments/manual-external-validation.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260930000400_manual_external_payment_001.sql";
const key = "11111111-1111-4111-8111-111111111111";

function documentlessForm(method) {
  return { amount: "15.00", idempotencyKey: key, method, notes: "", reference: "Verified transfer 123" };
}

function parsed(method, overrides = {}) {
  const input = new FormData();
  for (const [name, value] of Object.entries({ ...documentlessForm(method), ...overrides })) input.set(name, value);
  return parseManualExternalPayment(input);
}

test("channel constraint is additive and historical rows remain untouched", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /drop constraint payments_channel_check[\s\S]*channel in \('order', 'pos', 'online', 'manual_external'\)/);
  assert.doesNotMatch(sql, /update public\.payments|delete from public\.payments|create type public\.payment_channel|alter column channel set default/i);
});

test("manual external RPC has owner-manager tenant boundary and canonical ledger controls", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create function public\.record_manual_external_payment\(/);
  assert.match(sql, /security definer\s+set search_path = public/);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /has_organization_role\(org_id, array\['owner','manager'\]/);
  assert.match(sql, /orders\.id = target_order_id and orders\.organization_id = org_id\s+for update/);
  assert.match(sql, /not target_order\.is_active or target_order\.production_status = 'cancelled'/);
  assert.match(sql, /normalized_amount numeric\(12,2\) := round\(target_amount, 2\)/);
  assert.match(sql, /normalized_amount <= 0/);
  assert.match(sql, /target_method not in \('bank_transfer', 'other'\)/);
  assert.match(sql, /normalized_reference is null/);
  assert.match(sql, /target_method = 'other' and normalized_notes is null/);
  assert.match(sql, /target_idempotency_key is null/);
  assert.match(sql, /payment\.organization_id = org_id and payment\.idempotency_key = target_idempotency_key/);
  assert.match(sql, /manual_external_idempotency_conflict/);
  assert.match(sql, /payment\.status = 'confirmed'[\s\S]*payment\.status = 'refunded'/);
  assert.match(sql, /normalized_amount > round\(target_order\.total - paid_total, 2\)/);
  assert.match(sql, /recorded_by, confirmed_by, pos_session_id, channel, provider, provider_reference,[\s\S]*external_status, idempotency_key/);
  assert.match(sql, /normalized_reference, normalized_notes, auth\.uid\(\), auth\.uid\(\),\s+null, 'manual_external', null, null, null, target_idempotency_key/);
  assert.match(sql, /target_method, 'confirmed', now\(\)/);
  assert.doesNotMatch(sql, /target_paid_at|target_pos_session_id|online_payment_attempts|settle_online_payment_attempt|refund_payment\(/);
});

test("form validation permits only bank transfer and other with evidence", () => {
  assert.equal(parsed("bank_transfer").valid, true);
  assert.equal(parsed("other", { notes: "Verified external voucher" }).valid, true);
  for (const method of ["cash", "card"]) assert.equal(parsed(method).valid, false);
  assert.equal(parsed("bank_transfer", { reference: "  " }).valid, false);
  assert.equal(parsed("other").valid, false);
  assert.equal(parsed("bank_transfer", { amount: "0" }).valid, false);
  assert.equal(parsed("bank_transfer", { amount: "0.001" }).valid, false);
  assert.equal(parsed("bank_transfer", { idempotencyKey: "invalid" }).valid, false);
});

test("Order detail is the new write surface with owner-manager authorization", async () => {
  const [page, panel, ui, action] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/components/payments/PaymentsPanel.tsx"),
    source("src/components/payments/ManualExternalPaymentForm.tsx"),
    source("src/features/payments/server/manual-external-actions.ts"),
  ]);
  assert.match(page, /manualExternal: recordManualExternalPaymentAction\.bind\(null, locale, order\.id\)/);
  assert.match(page, /canRecordManualExternal=\{canManageAssignments\}/);
  assert.match(panel, /canRecordManualExternal && !isOrderCancelled && summary\.balanceDue > 0/);
  assert.match(ui, /value="bank_transfer"[\s\S]*value="other"/);
  assert.doesNotMatch(ui, /value="cash"|value="card"|sessionId|provider|paidAt/);
  assert.match(ui, /name="reference" required/);
  assert.match(ui, /required=\{method === "other"\}/);
  assert.match(action, /await requireOwnerOrManager\(locale\)/);
  assert.match(action, /supabase\.rpc\("record_manual_external_payment"/);
  assert.match(action, /revalidatePath\(`\/\$\{locale\}\/app\/orders\/\$\{orderId\}`\)/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.orders.payments.manualExternal.record, "string");
  }
});

test("existing financial, till and provider boundaries remain separate", async () => {
  const [sql, gate, close, pos, refund, online, terminal, accounting, customer, printing] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260920000100_daily_close_post_close_gate_001.sql"),
    source("supabase/migrations/20260920000200_portal_after_close_intake_001.sql"),
    source("supabase/migrations/20260930000200_pos_session_payment_boundary_001.sql"),
    source("supabase/migrations/20260930000300_pos_refund_channel_session_boundary_001.sql"),
    source("supabase/migrations/20260828000200_payments_online_001_customer_checkout.sql"),
    source("supabase/migrations/20260829000200_shop_terminal_001_counter_experience.sql"),
    source("src/features/accounting/summary.ts"),
    source("supabase/migrations/20260826000100_customer_account_001_financial_summary.sql"),
    source("src/components/printing/OrderPrintDocument.tsx"),
  ]);
  assert.match(gate, /if new\.channel <> 'online' then[\s\S]*assert_business_day_open/);
  assert.match(close, /payment\.method <> 'cash'[\s\S]*payment\.pos_session_id is null[\s\S]*non_session_non_cash_activity/);
  assert.match(close, /payment\.pos_session_id = session\.id[\s\S]*payment\.method = 'cash'/);
  assert.match(pos, /target_pos_session_id is null[\s\S]*target_pos_session_id, 'pos'/);
  assert.match(refund, /source_payment\.channel <> 'pos'/);
  assert.match(online, /'online',\s+target_provider/);
  assert.match(terminal, /perform public\.record_pos_payment\(/);
  assert.doesNotMatch(terminal, /record_manual_external_payment/);
  assert.match(accounting, /collectedNet = collectedGross - refunds/);
  assert.match(customer, /confirmed_total - payment_totals\.refunded_total/);
  assert.match(printing, /function paymentMethodTotals\(context: PrintOrderContext\)[\s\S]*totals\.set\(payment\.method/);
  assert.doesNotMatch(sql, /grant execute on function public\.(record_payment|refund_payment|void_payment)/);
});

test("POS receipt lookup cannot present an external payment as POS", async () => {
  const sql = await source(migrationPath);
  const receipt = sql.slice(sql.indexOf("create or replace function public.get_pos_receipt_data("));
  assert.match(receipt, /where payment\.id = target_payment_id and payment\.organization_id = org_id\s+and payment\.channel = 'pos'/);
  assert.match(receipt, /perform public\.require_pos_access\(org_id\)/);
});
