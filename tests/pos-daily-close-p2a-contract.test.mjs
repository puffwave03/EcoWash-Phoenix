import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildAccountingSummary } from "../src/features/accounting/summary.ts";

const migrationPath = "supabase/migrations/20260919000200_pos_daily_close_001_p2a.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = await source(migrationPath);

function accounting(payments, orders = [{ activeItemCount: 1, createdAt: "2026-09-19T09:00:00Z", currency: "EUR", id: "order", isQuickDrop: false, locationId: null, subtotal: 100, total: 90 }]) {
  return buildAccountingSummary({
    locationId: null,
    paymentPeriod: { startDate: "2026-09-19", endDateExclusive: "2026-09-20" },
    periodPayments: payments,
    posSessionPayments: payments,
    posSessions: [],
    receivableConfirmedPayments: payments,
    salesOrders: orders,
    salesPeriod: { startDate: "2026-09-19", endDateExclusive: "2026-09-20" },
    timezone: "Atlantic/Canary",
  }).currencies[0];
}

test("1 valid organization-wide close creation is represented by a nullable location", () => {
  assert.match(migration, /location_id uuid,/);
  assert.match(migration, /values \(\s*org_id,\s*target_business_date,\s*target_location_id,/);
});

test("2 valid location-specific close validates active tenant ownership", () => {
  assert.match(migration, /location\.organization_id = org_id[\s\S]*location\.id = target_location_id[\s\S]*location\.is_active[\s\S]*location\.deleted_at is null/);
});

test("3 duplicate exact scope and date is rejected with a stable blocker", () => {
  assert.match(migration, /location_id is not distinct from target_location_id/);
  assert.match(migration, /'code', 'already_closed'/);
});

test("4 organization-wide uniqueness uses NULLS NOT DISTINCT", () => {
  assert.match(migration, /unique nulls not distinct\s*\(organization_id, business_date, location_id\)/);
});

test("5 an identical idempotent request returns the persisted close", () => {
  assert.match(migration, /existing_close\.request_fingerprint <> request_hash/);
  assert.match(migration, /'status', 'existing'[\s\S]*existing_close\.snapshot_hash/);
});

test("6 a changed semantic request reusing a key is rejected", () => {
  assert.match(migration, /'status', 'validation', 'code', 'idempotency_conflict'/);
});

test("7 future business dates are rejected in tenant local time", () => {
  assert.match(migration, /target_business_date > \(now\(\) at time zone org_timezone\)::date/);
  assert.match(migration, /'future_business_date'/);
});

test("8 cross-tenant locations cannot pass canonical validation", () => {
  assert.match(migration, /where location\.organization_id = org_id\s+and location\.id = target_location_id/);
});

test("9 inactive and deleted locations are rejected", () => {
  assert.match(migration, /location\.is_active\s+and location\.deleted_at is null/);
});

test("10 applicable open POS sessions are hard blockers", () => {
  assert.match(migration, /open_session_blocker[\s\S]*session\.status = 'open'/);
  assert.match(migration, /select 'open_pos_session'::text/);
});

test("11 null-location facts block only a location-specific close", () => {
  assert.match(migration, /'null_location_in_location_close'[\s\S]*target_location_id is not null/);
  assert.match(migration, /'null_location_organization_wide'[\s\S]*target_location_id is null/);
});

test("12 canonical financial totals preserve Accounting definitions", () => {
  const value = accounting([{ amount: 90, channel: "pos", currency: "EUR", id: "payment", locationId: null, method: "cash", orderId: "order", paidAt: "2026-09-19T10:00:00Z", posSessionId: "session", status: "confirmed" }]);
  assert.deepEqual({ gross: value.salesGross, net: value.salesNet, collected: value.collectedNet }, { gross: 100, net: 90, collected: 90 });
  assert.match(migration, /'collectedNet', collected_gross - refunds/);
});

test("13 refunds remain separate facts and reduce collected net", () => {
  const value = accounting([
    { amount: 90, channel: "pos", currency: "EUR", id: "payment", locationId: null, method: "cash", orderId: "order", paidAt: "2026-09-19T10:00:00Z", posSessionId: "session", status: "confirmed" },
    { amount: 15, channel: "pos", currency: "EUR", id: "refund", locationId: null, method: "cash", orderId: "order", paidAt: "2026-09-19T11:00:00Z", posSessionId: "session", status: "refunded" },
  ]);
  assert.deepEqual({ gross: value.collectedGross, refunds: value.refunds, net: value.collectedNet }, { gross: 90, refunds: 15, net: 75 });
});

test("14 cancelled orders cannot inflate sales", () => {
  assert.match(migration, /orders\.is_active\s+and orders\.production_status <> 'cancelled'/);
});

test("15 completed delivery is a final fulfillment fact", () => {
  assert.match(migration, /final_fulfillment[\s\S]*from public\.deliveries delivery[\s\S]*delivery\.status = 'completed'/);
});

test("16 canonical customer handoff is a final fulfillment fact", () => {
  assert.match(migration, /select handoff\.order_id, 'customer_handoff'::text[\s\S]*from public\.order_customer_handoffs handoff/);
});

test("17 inbound pickup completion is not final fulfillment", () => {
  const finalSection = migration.slice(migration.indexOf("final_fulfillment as"), migration.indexOf("open_session_blocker as"));
  assert.doesNotMatch(finalSection, /public\.pickups/);
});

test("18 immutable rows reject normal updates", () => {
  assert.match(migration, /raise exception 'daily_close_immutable'/);
});

test("19 immutable rows reject normal deletes", () => {
  assert.match(migration, /raise exception 'daily_close_delete_forbidden'/);
});

test("20 later operational events cannot mutate a stored snapshot", () => {
  assert.match(migration, /snapshot jsonb not null/);
  assert.match(migration, /before insert or update or delete on public\.daily_closes/);
  assert.doesNotMatch(migration, /update public\.daily_closes/);
});

test("21 RLS enforces tenant-isolated visibility", () => {
  assert.match(migration, /alter table public\.daily_closes enable row level security/);
  assert.match(migration, /has_organization_role\(organization_id, array\['owner', 'manager'\]/);
});

test("22 owner and manager have authorized read behavior", async () => {
  const query = await source("src/features/daily-close/server/persisted-queries.ts");
  assert.match(query, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /\.eq\("organization_id", membership\.organization\.id\)/);
});

test("23 unauthorized actors and direct writes are denied", () => {
  assert.match(migration, /daily_close_not_authorized/);
  assert.match(migration, /revoke all on table public\.daily_closes from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)/);
});

test("24 snapshot hashes are deterministic over persisted JSONB content", () => {
  assert.match(migration, /digest\(calculated_snapshot::text, 'sha256'\)/);
  assert.match(migration, /snapshot_hash text not null/);
});

test("25 request fingerprint is server-derived from semantic inputs", () => {
  assert.match(migration, /semantic_request := jsonb_build_object\([\s\S]*'organizationId', org_id[\s\S]*'businessDate', target_business_date[\s\S]*'locationId', target_location_id[\s\S]*'note', normalized_note/);
  assert.match(migration, /request_hash := encode\(extensions\.digest\(semantic_request::text, 'sha256'\)/);
});

test("26 application input cannot supply tenant, totals, boundaries, snapshot or hashes", async () => {
  const [actions, types] = await Promise.all([
    source("src/features/daily-close/server/actions.ts"),
    source("src/features/daily-close/persisted-types.ts"),
  ]);
  const requestType = types.slice(types.indexOf("export type DailyCloseRequest"), types.indexOf("export type DailyCloseResult"));
  for (const forbidden of ["organizationId", "timezone", "boundary", "total", "snapshot", "hash", "blocker"]) assert.doesNotMatch(requestType, new RegExp(forbidden, "i"));
  assert.match(actions, /\.rpc\("close_daily_close"/);
  assert.match(actions, /target_business_date:[\s\S]*target_idempotency_key:[\s\S]*target_location_id:[\s\S]*target_note:/);
});

test("concurrent duplicate closes are serialized and operational facts stay atomic", () => {
  assert.equal((migration.match(/pg_advisory_xact_lock/g) ?? []).length, 2);
  assert.match(migration, /lock table public\.organizations[\s\S]*public\.order_customer_handoffs in share mode/);
});

test("migration is additive and does not rewrite existing business data", () => {
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from|update public\.(orders|payments|pos_sessions|pickups|deliveries))\b/i);
});
