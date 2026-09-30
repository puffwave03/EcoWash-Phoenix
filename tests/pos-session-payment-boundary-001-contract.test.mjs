import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260930000200_pos_session_payment_boundary_001.sql");
const workspace = read("src/components/pos/PosWorkspace.tsx");
const methods = ["cash", "card", "bank_transfer", "other"];

test("the replacement RPC requires an open same-organization session for every POS method", () => {
  assert.match(migration, /create or replace function public\.record_pos_payment\(/);
  assert.match(migration, /target_method public\.payment_method/);
  const paymentTypes = read("src/features/payments/types.ts");
  for (const method of methods) assert.match(paymentTypes, new RegExp(`"${method}"`));
  const required = migration.indexOf("if target_pos_session_id is null then");
  const sessionLookup = migration.indexOf("select * into target_session");
  const paymentInsert = migration.indexOf("insert into public.payments");
  assert.ok(required > 0 && required < sessionLookup && sessionLookup < paymentInsert);
  assert.match(migration, /if target_pos_session_id is null then\s+raise exception 'pos_session_not_open'/);
  assert.doesNotMatch(migration, /target_method = 'cash' and target_session\.id is null/);
  assert.match(migration, /where session\.id = target_pos_session_id and session\.organization_id = org_id\s+for update/);
  assert.match(migration, /if target_session\.id is null or target_session\.status <> 'open' then\s+raise exception 'pos_session_not_open'/);
  assert.match(migration, /target_session\.opened_by <> auth\.uid\(\)[\s\S]*pos_session_not_assigned/);
  assert.match(migration, /target_order\.location_id <> target_session\.location_id[\s\S]*pos_location_mismatch/);
});

test("valid POS inserts retain channel, idempotency, authorization and manual provider semantics", () => {
  assert.match(migration, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(migration, /perform public\.require_pos_access\(org_id\)/);
  assert.match(migration, /payment\.idempotency_key = target_idempotency_key[\s\S]*return existing_payment\.id/);
  assert.match(migration, /normalized_amount > round\(target_order\.total - paid_total, 2\)/);
  assert.match(migration, /target_pos_session_id, 'pos'/);
  assert.match(migration, /target_method = 'card'[\s\S]*'manual'[\s\S]*'recorded_manual'/);
});

test("standalone POS presents an open-till explanation and no payment form while closed", () => {
  assert.match(workspace, /!session \? <p[^>]*role="status">\{text\.session\.paymentRequiresOpen\}<\/p>/);
  assert.match(workspace, /session \? <PaymentForm action=\{actions\.pay\}/);
  assert.match(workspace, /<OpenSessionForm action=\{actions\.open\}/);
  assert.match(workspace, /canSeeHistory \? <Card/);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    assert.ok(JSON.parse(read(`src/i18n/${locale}/common.json`)).pos.session.paymentRequiresOpen);
  }
});

test("Shop Terminal paid-now retains its session gate and Pay Later creates no payment", () => {
  const terminal = read("supabase/migrations/20260928000200_production_default_assignee_001.sql");
  const terminalUi = read("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(terminal, /jsonb_array_length\(coalesce\(target_payments, '\[\]'::jsonb\)\) > 0[\s\S]*target_pos_session_id is null[\s\S]*perform public\.record_pos_payment\(/);
  assert.match(terminalUi, /intent === "later" \? null : session\?\.id \?\? null/);
  assert.match(terminalUi, /intent === "split"[\s\S]*: \[\];/);
  assert.match(terminalUi, /value="later"/);
});

test("provider settlement, refund and Daily Close remain outside this migration", () => {
  const online = read("supabase/migrations/20260829000100_payments_online_001_1_settlement_enum_cast.sql");
  const webhook = read("src/app/api/payments/online/[provider]/webhook/route.ts");
  const daily = read("supabase/migrations/20260920000200_portal_after_close_intake_001.sql");
  const gate = read("supabase/migrations/20260920000100_daily_close_post_close_gate_001.sql");
  assert.match(online, /create or replace function public\.settle_online_payment_attempt/);
  assert.match(online, /'online',\s+target_provider/);
  assert.doesNotMatch(online, /pos_session_id/);
  assert.match(webhook, /admin\.rpc\("settle_online_payment_attempt"/);
  assert.match(gate, /if new\.channel <> 'online' then/);
  assert.doesNotMatch(migration, /record_pos_refund|alter table|update public\.payments|delete from public\.payments|settle_online_payment_attempt|close_daily_close/i);
  assert.match(daily, /'non_session_non_cash_activity', \(select count from non_session_non_cash\)/);
  assert.match(daily, /'open_pos_session'.*open_session_blocker/);
  assert.match(daily, /'cash_without_valid_session'.*cash_without_session_blocker/);
});
