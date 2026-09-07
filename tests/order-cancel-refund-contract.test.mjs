import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getNetCollected, getRefundableAmount } from "../src/features/payments/refunds.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql";

function payment(overrides = {}) {
  return {
    amount: 13,
    createdAt: "2026-09-07T10:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111",
    method: "card",
    paidAt: "2026-09-07T10:00:00.000Z",
    proofPhotoId: null,
    recordedByName: "Operator",
    reference: null,
    refundedFromPaymentId: null,
    status: "confirmed",
    ...overrides,
  };
}

function functionBody(sql, name, next) {
  const start = sql.indexOf(`create function public.${name}`);
  const end = sql.indexOf(`create function public.${next}`, start);
  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return sql.slice(start, end);
}

test("A-B POS access is the UI refund boundary without expanding staff privileges", async () => {
  const [page, access, capabilities] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/pos/server/access.ts"),
    source("src/lib/auth/capabilities.ts"),
  ]);
  assert.match(page, /const canUsePos = entitlementEnabled\(entitlements, FEATURES\.pos\)[\s\S]*hasOperationalCapability\(access\.membership, "pos"\)/);
  assert.match(page, /canManageCorrections=\{canUsePos\}/);
  assert.match(access, /requireEntitlement\(locale, FEATURES\.pos\)/);
  assert.match(access, /requireOperationalCapability\(locale, "pos"\)/);
  assert.match(capabilities, /DEFAULT_STAFF_OPERATIONAL_CAPABILITIES[\s\S]*capability !== "pos"/);
});

test("C-E cancelled-paid net warning tracks partial and full refunds", () => {
  const confirmed = payment();
  const partialRefund = payment({
    amount: 5,
    id: "22222222-2222-4222-8222-222222222222",
    refundedFromPaymentId: confirmed.id,
    status: "refunded",
  });
  const fullRefund = payment({
    amount: 8,
    id: "33333333-3333-4333-8333-333333333333",
    refundedFromPaymentId: confirmed.id,
    status: "refunded",
  });

  assert.equal(getNetCollected([confirmed]), 13);
  assert.equal(getNetCollected([confirmed, partialRefund]), 8);
  assert.equal(getNetCollected([confirmed, partialRefund, fullRefund]), 0);
});

test("F-G refunds remain separate rows and the confirmed source stays immutable", () => {
  const confirmed = payment();
  const refund = payment({ amount: 5, refundedFromPaymentId: confirmed.id, status: "refunded" });
  const rows = [confirmed, refund];
  assert.equal(rows[0].status, "confirmed");
  assert.equal(rows[1].status, "refunded");
  assert.equal(rows[1].refundedFromPaymentId, rows[0].id);
  assert.equal(getRefundableAmount(confirmed, rows), 8);
});

test("H refund UI and canonical RPC both cap refunds at the remaining amount", async () => {
  const [panel, sql] = await Promise.all([
    source("src/components/payments/PaymentsPanel.tsx"),
    source(migrationPath),
  ]);
  const refund = functionBody(sql, "record_pos_refund", "get_pos_session_summary");
  assert.match(panel, /max=\{refundableAmount\}/);
  assert.match(panel, /getRefundableAmount\(payment, payments\)/);
  assert.match(refund, /source_payment\.amount - already_refunded/);
  assert.match(refund, /pos_refund_exceeds_refundable/);
});

test("I cash refunds retain the canonical open POS session requirement", async () => {
  const [page, panel, sql] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/components/payments/PaymentsPanel.tsx"),
    source(migrationPath),
  ]);
  const refund = functionBody(sql, "record_pos_refund", "get_pos_session_summary");
  assert.match(page, /getCurrentPosSession\(locale\)/);
  assert.match(panel, /payment\.method === "cash" && !posSessionId/);
  assert.match(refund, /source_payment\.method = 'cash'[\s\S]*pos_cash_refund_requires_open_session/);
  assert.match(refund, /target_session\.status <> 'open'[\s\S]*pos_session_not_open/);
});

test("J order refunds use record_pos_refund and expose no legacy refund or void action", async () => {
  const [page, panel, action, validation] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/components/payments/PaymentsPanel.tsx"),
    source("src/features/pos/server/actions.ts"),
    source("src/features/pos/validation.ts"),
  ]);
  assert.match(page, /refundPosPaymentAction\.bind\(null, locale\)/);
  assert.match(action, /supabase\.rpc\("record_pos_refund"/);
  assert.match(action, /refresh\(locale, parsed\.input\.orderId \?\? undefined\)/);
  assert.match(validation, /orderId: orderId \|\| null/);
  assert.doesNotMatch(`${page}\n${panel}`, /refundPaymentAction|voidPaymentAction|refund_payment|void_payment|actions\.void/);
});

test("cancelled-paid warning is prominent and translated in all supported locales", async () => {
  const panel = await source("src/components/payments/PaymentsPanel.tsx");
  assert.match(panel, /isOrderCancelled && netCollected > 0/);
  assert.match(panel, /role="alert"/);
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.match(messages.orders.payments.cancelledPaidWarning, /\{amount\}/);
    assert.equal(typeof messages.orders.payments.cashRefundRequiresTill, "string");
  }
});
