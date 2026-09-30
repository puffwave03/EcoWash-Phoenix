import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = "supabase/migrations/20260930000300_pos_refund_channel_session_boundary_001.sql";

test("POS refund RPC accepts only confirmed same-tenant POS sources", async () => {
  const sql = await source(migration);
  assert.match(sql, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(sql, /perform public\.require_pos_access\(org_id\)/);
  assert.match(sql, /payment\.id = target_payment_id and payment\.organization_id = org_id and payment\.status = 'confirmed'\s+for update/);
  assert.match(sql, /if source_payment\.id is null then[\s\S]*pos_payment_invalid/);
  assert.match(sql, /if source_payment\.channel <> 'pos' then[\s\S]*pos_payment_invalid/);
  assert.doesNotMatch(sql, /source_payment\.channel in \('pos', 'online'\)|source_payment\.channel in \('pos', 'order'\)/);
});

test("every method needs an open authorized same-organization session", async () => {
  const sql = await source(migration);
  assert.match(sql, /if target_pos_session_id is null then\s+raise exception 'pos_session_not_open'/);
  assert.match(sql, /session\.id = target_pos_session_id and session\.organization_id = org_id\s+for update/);
  assert.match(sql, /target_session\.id is null or target_session\.status <> 'open'/);
  assert.match(sql, /target_session\.opened_by <> auth\.uid\(\)/);
  assert.match(sql, /source_payment\.pos_session_id is not null[\s\S]*pos_location_mismatch/);
  assert.doesNotMatch(sql, /source_payment\.method = 'cash' and target_session\.id is null/);
});

test("refund stays a separate bounded, idempotent POS fact without historical mutation", async () => {
  const sql = await source(migration);
  assert.match(sql, /existing_payment\.refunded_from_payment_id <> target_payment_id/);
  assert.match(sql, /existing_payment\.pos_session_id is distinct from target_pos_session_id/);
  assert.match(sql, /source_payment\.amount - already_refunded/);
  assert.match(sql, /pos_refund_exceeds_refundable/);
  assert.match(sql, /refunded_from_payment_id, refund_reason, refunded_at/);
  assert.match(sql, /source_payment\.method, 'refunded'/);
  assert.match(sql, /source_payment\.id,[\s\S]*target_pos_session_id, 'pos'/);
  assert.doesNotMatch(sql, /alter table|update public\.payments|delete from public\.payments|refund_payment|void_payment|settle_online_payment_attempt/i);
});

test("Order detail exposes POS refunds only for POS sources with an open till", async () => {
  const [query, types, panel, page, action] = await Promise.all([
    source("src/features/payments/server/queries.ts"),
    source("src/features/payments/types.ts"),
    source("src/components/payments/PaymentsPanel.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/pos/server/actions.ts"),
  ]);
  assert.match(query, /\.select\("id, amount, channel, method/);
  assert.match(query, /channel: row\.channel/);
  assert.match(types, /channel: "order" \| "pos" \| "online"/);
  assert.match(panel, /payment\.channel === "pos" && refundableAmount > 0/);
  assert.match(panel, /const requiresSession = !posSessionId/);
  assert.match(panel, /disabled=\{pending \|\| requiresSession\}/);
  assert.match(page, /getCurrentPosSession\(locale\)/);
  assert.match(page, /posSessionId=\{posSession\?\.id \?\? null\}/);
  assert.match(action, /supabase\.rpc\("record_pos_refund"/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.match(messages.orders.payments.posRefundRequiresTill, /POS/);
  }
});

test("POS workspace remains current-session scoped and online settlement stays separate", async () => {
  const [query, workspace, summary, online, provider, oldPos] = await Promise.all([
    source("src/features/pos/server/queries.ts"),
    source("src/components/pos/PosWorkspace.tsx"),
    source("supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql"),
    source("supabase/migrations/20260828000200_payments_online_001_customer_checkout.sql"),
    source("src/features/online-payments/providers/provider.ts"),
    source("supabase/migrations/20260827000400_pos_001_cash_register_foundation.sql"),
  ]);
  assert.match(query, /\.eq\("pos_session_id", sessionId\)/);
  assert.match(workspace, /\{session \? <Card[\s\S]*payment\.channel === "pos"[\s\S]*sessionId=\{session\.id\}/);
  assert.match(summary, /payment\.method = 'cash' and payment\.status = 'refunded'/);
  assert.match(summary, /session\.opening_cash[\s\S]*- coalesce\(sum\(payment\.amount\) filter \(where payment\.method = 'cash' and payment\.status = 'refunded'\)/);
  assert.match(online, /'online',\s+target_provider/);
  assert.doesNotMatch(provider, /refundPayment/);
  assert.match(oldPos, /revoke execute on function public\.refund_payment/);
  assert.match(oldPos, /revoke execute on function public\.void_payment/);
});
