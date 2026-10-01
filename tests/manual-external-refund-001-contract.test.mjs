import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseManualExternalRefund } from "../src/features/payments/manual-external-refund-validation.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20260930000500_manual_external_refund_001.sql";
const key = "11111111-1111-4111-8111-111111111111";
const paymentId = "22222222-2222-4222-8222-222222222222";

function parsed(overrides = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    amount: "12.50", idempotencyKey: key, notes: "", paymentId,
    reason: "Customer reimbursement", reference: "Refund transfer 456", ...overrides,
  })) form.set(name, value);
  return parseManualExternalRefund(form);
}

test("server derives tenant and restricts source to confirmed manual external bank transfer or other", async () => {
  const sql = await source(migration);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /has_organization_role\(org_id, array\['owner','manager'\]/);
  assert.match(sql, /payment\.id = target_payment_id\s+and payment\.organization_id = org_id\s+and payment\.status = 'confirmed'\s+for update/);
  assert.match(sql, /source_payment\.channel <> 'manual_external'/);
  assert.match(sql, /source_payment\.method not in \('bank_transfer', 'other'\)/);
  assert.match(sql, /orders\.id = source_payment\.order_id and orders\.organization_id = org_id/);
  assert.doesNotMatch(sql, /orders\.is_active|orders\.production_status|require_pos_access/);
  assert.match(sql, /revoke all on function public\.record_manual_external_refund[\s\S]*grant execute on function public\.record_manual_external_refund[\s\S]*to authenticated/);
});

test("partial and repeated refunds are bounded under a source row lock with complete replay checks", async () => {
  const sql = await source(migration);
  assert.match(sql, /for update;[\s\S]*select \* into existing_payment/);
  assert.match(sql, /payment\.organization_id = org_id and payment\.idempotency_key = target_idempotency_key/);
  for (const field of [
    "refunded_from_payment_id", "order_id", "amount", "status", "channel", "method",
    "reference", "refund_reason", "notes", "pos_session_id", "provider",
    "provider_reference", "external_status",
  ]) assert.match(sql, new RegExp(`existing_payment\\.${field}`));
  assert.match(sql, /manual_external_refund_idempotency_conflict/);
  assert.match(sql, /sum\(payment\.amount\)[\s\S]*payment\.refunded_from_payment_id = source_payment\.id\s+and payment\.status = 'refunded'/);
  assert.match(sql, /normalized_amount > round\(source_payment\.amount - already_refunded, 2\)/);
  assert.match(sql, /normalized_amount <= 0/);
  assert.doesNotMatch(sql, /update public\.payments|delete from public\.payments|alter table public\.payments/i);
});

test("refund is a separate server-timed sessionless fact with reimbursement evidence", async () => {
  const sql = await source(migration);
  assert.match(sql, /normalized_reason is null or char_length\(normalized_reason\) > 600/);
  assert.match(sql, /normalized_reference is null or char_length\(normalized_reference\) > 180/);
  assert.match(sql, /source_payment\.method = 'other' and normalized_notes is null/);
  assert.match(sql, /normalized_reference = source_payment\.reference/);
  assert.match(sql, /recorded_at timestamptz := now\(\)/);
  assert.match(sql, /source_payment\.method, 'refunded',[\s\S]*recorded_at, normalized_reference, normalized_notes, auth\.uid\(\), auth\.uid\(\),\s+source_payment\.id, normalized_reason, recorded_at,\s+null, 'manual_external', null, null, null, target_idempotency_key/);
  assert.doesNotMatch(sql, /target_method|target_paid_at|target_refunded_at|target_pos_session_id|target_provider|refund_payment\(|void_payment\(|record_pos_refund\(/);
  assert.equal(parsed().valid, true);
  for (const invalid of [
    { amount: "0" }, { amount: "-1" }, { amount: "0.001" },
    { paymentId: "bad" }, { idempotencyKey: "bad" }, { reason: " " },
    { reference: " " }, { notes: "x".repeat(601) },
  ]) assert.equal(parsed(invalid).valid, false);
});

test("Order detail exposes a separate Owner/Manager reimbursement form even on cancelled orders", async () => {
  const [page, panel, form, action] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/components/payments/PaymentsPanel.tsx"),
    source("src/components/payments/ManualExternalRefundForm.tsx"),
    source("src/features/payments/server/manual-external-refund-actions.ts"),
  ]);
  assert.match(page, /manualExternalRefund: recordManualExternalRefundAction\.bind\(null, locale, order\.id\)/);
  assert.match(page, /canRecordManualExternal=\{canManageAssignments\}/);
  assert.match(page, /access\.membership\.role === "owner" \|\| access\.membership\.role === "manager"/);
  assert.match(panel, /canRecordManualExternal && payment\.channel === "manual_external" && payment\.status === "confirmed" && refundableAmount > 0/);
  assert.doesNotMatch(panel, /canRecordManualExternal && !isOrderCancelled && payment\.channel === "manual_external"/);
  assert.match(form, /required=\{notesRequired\}/);
  assert.match(form, /payment\.method === "other"/);
  assert.match(form, /max=\{refundableAmount\}/);
  assert.doesNotMatch(form, /name="method"|name="sessionId"|provider/);
  assert.match(action, /const access = await requireOwnerOrManager\(locale\)/);
  assert.match(action, /\.eq\("organization_id", access\.membership\.organization\.id\)[\s\S]*\.eq\("channel", "manual_external"\)[\s\S]*source\?\.method === "other"/);
  assert.match(action, /supabase\.rpc\("record_manual_external_refund"/);
  for (const route of ["orders/${orderId}", "daily-close", "accounting", "customers", "billing"]) {
    assert.ok(action.includes("revalidatePath(`/${locale}/app/" + route + "`);"));
  }
});

test("Daily Close, accounting, POS, provider and receipt boundaries stay intact", async () => {
  const [sql, gate, close, accounting, customer, pos, receipt, online, panel] = await Promise.all([
    source(migration),
    source("supabase/migrations/20260920000100_daily_close_post_close_gate_001.sql"),
    source("supabase/migrations/20260920000200_portal_after_close_intake_001.sql"),
    source("src/features/accounting/summary.ts"),
    source("supabase/migrations/20260826000100_customer_account_001_financial_summary.sql"),
    source("supabase/migrations/20260930000300_pos_refund_channel_session_boundary_001.sql"),
    source("supabase/migrations/20260930000400_manual_external_payment_001.sql"),
    source("supabase/migrations/20260828000200_payments_online_001_customer_checkout.sql"),
    source("src/components/payments/PaymentsPanel.tsx"),
  ]);
  assert.match(gate, /if new\.channel <> 'online' then[\s\S]*assert_business_day_open/);
  assert.match(close, /payment\.method <> 'cash'[\s\S]*payment\.pos_session_id is null[\s\S]*non_session_non_cash_activity/);
  assert.match(close, /payment\.pos_session_id = session\.id[\s\S]*payment\.method = 'cash'/);
  assert.match(accounting, /result\.collectedNet = round\(result\.collectedGross - result\.refunds\)/);
  assert.match(customer, /confirmed_total - payment_totals\.refunded_total/);
  assert.match(pos, /source_payment\.channel <> 'pos'/);
  assert.match(panel, /payment\.channel === "pos" && refundableAmount > 0/);
  assert.match(receipt, /and payment\.channel = 'pos'/);
  assert.match(online, /'online',\s+target_provider/);
  assert.doesNotMatch(sql, /get_pos_receipt_data|record_pos_refund|record_payment|refund_payment|void_payment|online_payment_attempts|update public\.payments|delete from public\.payments/i);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    const copy = messages.orders.payments.manualExternalRefund;
    for (const key of ["description", "reason", "reference", "notesRequired", "record", "success"]) {
      assert.equal(typeof copy[key], "string");
      assert.ok(copy[key].length > 0);
    }
  }
});

test("duplicate reimbursement reference has its own localized error and other failures stay generic", async () => {
  const [action, form, sql] = await Promise.all([
    source("src/features/payments/server/manual-external-refund-actions.ts"),
    source("src/components/payments/ManualExternalRefundForm.tsx"),
    source(migration),
  ]);
  assert.match(action, /error\.message\?\.includes\("manual_external_refund_reference_not_distinct"\)\s+\? "referenceNotDistinct"\s+: "generic"/);
  assert.match(action, /isBusinessDayClosedError\(error\)\s+\? "closedDay"/);
  assert.match(form, /state\.formError === "referenceNotDistinct" \? text\.referenceNotDistinct : text\.error/);
  assert.match(sql, /normalized_reference = source_payment\.reference[\s\S]*manual_external_refund_reference_not_distinct/);
  assert.match(sql, /normalized_amount > round\(source_payment\.amount - already_refunded, 2\)/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    const copy = messages.orders.payments.manualExternalRefund;
    assert.equal(typeof copy.referenceNotDistinct, "string");
    assert.ok(copy.referenceNotDistinct.length > 30);
    assert.notEqual(copy.referenceNotDistinct, copy.error);
  }
});
