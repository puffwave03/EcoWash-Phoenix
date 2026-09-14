import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveOrderDisplayStatus } from "../src/features/orders/display-status.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260913000200_order_final_handoff_001.sql";

function functionBody(sql, name, nextName = null) {
  const create = new RegExp(`create(?: or replace)? function public\\.${name}\\(`, "i");
  const start = sql.search(create);
  assert.notEqual(start, -1, `${name} must exist`);
  if (!nextName) return sql.slice(start);
  const remainder = sql.slice(start + 1);
  const next = remainder.search(new RegExp(`create(?: or replace)? function public\\.${nextName}\\(`, "i"));
  assert.notEqual(next, -1, `${nextName} must follow ${name}`);
  return sql.slice(start, start + 1 + next);
}

test("1-4 canonical append-only handoff persistence is tenant scoped and singular", async () => {
  const sql = await source(migrationPath);
  const table = sql.slice(sql.indexOf("create table public.order_customer_handoffs"), sql.indexOf("create index order_customer_handoffs_completed_idx"));

  for (const column of ["organization_id uuid not null", "order_id uuid not null", "location_id uuid", "completed_at timestamptz not null", "completed_by uuid not null", "balance_due_at_handoff numeric(12,2) not null", "balance_currency text not null", "unpaid_balance_acknowledged boolean not null", "created_at timestamptz not null default now()"])
    assert.match(table, new RegExp(column.replace(/[().]/g, "\\$&")));
  assert.match(table, /foreign key \(organization_id, order_id\)[\s\S]*references public\.orders \(organization_id, id\)/);
  assert.match(table, /foreign key \(organization_id, location_id\)[\s\S]*references public\.locations \(organization_id, id\)/);
  assert.match(table, /unique \(organization_id, order_id\)/);
  assert.match(sql, /alter table public\.order_customer_handoffs enable row level security/);
});

test("5-7 direct writes are denied and records are immutable", async () => {
  const sql = await source(migrationPath);
  const guard = functionBody(sql, "protect_order_customer_handoff_history", "complete_customer_handoff");

  assert.match(guard, /tg_op = 'INSERT'[\s\S]*current_setting\('app\.customer_handoff_mutation', true\)[\s\S]*customer_handoff_rpc_required/);
  assert.match(guard, /customer_handoff_delete_forbidden/);
  assert.match(guard, /customer_handoff_immutable/);
  assert.match(sql, /before insert or update or delete on public\.order_customer_handoffs/);
  assert.match(sql, /revoke all on table public\.order_customer_handoffs from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
});

test("8-12 RPC derives tenant, actor and parent under lock and enforces POS access", async () => {
  const sql = await source(migrationPath);
  const rpc = functionBody(sql, "complete_customer_handoff", "create_or_update_delivery");

  assert.match(rpc, /actor_id uuid := auth\.uid\(\)/);
  assert.match(rpc, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(rpc, /perform public\.require_pos_access\(org_id\)/);
  assert.match(rpc, /orders\.id = target_order_id\s+and orders\.organization_id = org_id\s+for update/);
  assert.match(rpc, /not target_order\.is_active or target_order\.production_status = 'cancelled'/);
  assert.match(rpc, /target_order\.production_status <> 'completed'/);
  assert.doesNotMatch(rpc, /target_organization_id|target_location_id|target_completed_at|target_completed_by|target_balance|target_currency/);
});

test("13-17 final delivery conflicts reject while absent, not-required or cancelled delivery permits handoff", async () => {
  const sql = await source(migrationPath);
  const rpc = functionBody(sql, "complete_customer_handoff", "create_or_update_delivery");

  assert.match(rpc, /delivery\.organization_id = org_id\s+and delivery\.order_id = target_order_id\s+and delivery\.status in \('scheduled', 'in_progress', 'completed'\)/);
  assert.match(rpc, /customer_handoff_delivery_conflict/);
  assert.doesNotMatch(rpc, /delivery\.status in \([^)]*'cancelled'/);
  assert.doesNotMatch(rpc, /delivery\.status in \([^)]*'not_required'/);
});

test("18-22 balance and currency use canonical server data with explicit unpaid acknowledgement", async () => {
  const sql = await source(migrationPath);
  const rpc = functionBody(sql, "complete_customer_handoff", "create_or_update_delivery");

  assert.match(rpc, /from public\.get_order_payment_summary\(target_order_id\) summary/);
  assert.match(rpc, /current_balance > 0 and not coalesce\(target_confirm_unpaid, false\)/);
  assert.match(rpc, /customer_handoff_unpaid_confirmation_required/);
  assert.match(rpc, /current_balance,\s+target_order\.currency,\s+current_balance > 0/);
  assert.doesNotMatch(rpc, /(insert into|update|delete from) public\.(payments|payment_refunds|invoices|operational_receipts)/i);
});

test("23-25 idempotency and concurrency retain one immutable canonical record", async () => {
  const sql = await source(migrationPath);
  const rpc = functionBody(sql, "complete_customer_handoff", "create_or_update_delivery");

  assert.ok(rpc.indexOf("for update") < rpc.indexOf("from public.order_customer_handoffs handoff"));
  assert.match(rpc, /if canonical_handoff\.id is not null then\s+return canonical_handoff/);
  assert.match(sql, /constraint order_customer_handoffs_order_unique unique \(organization_id, order_id\)/);
  assert.match(rpc, /perform set_config\('app\.customer_handoff_mutation', 'on', true\)/);
});

test("26-27 inverse delivery guards prevent creation and advancement after handoff", async () => {
  const sql = await source(migrationPath);
  const createDelivery = functionBody(sql, "create_or_update_delivery", "transition_delivery_status");
  const transitionDelivery = functionBody(sql, "transition_delivery_status");

  for (const body of [createDelivery, transitionDelivery]) {
    assert.match(body, /from public\.order_customer_handoffs handoff/);
    assert.match(body, /handoff\.organization_id = org_id/);
    assert.match(body, /customer_handoff_already_completed/);
  }
  assert.match(transitionDelivery, /target_status in \('in_progress', 'completed'\)/);
  assert.doesNotMatch(sql.slice(0, sql.indexOf("create or replace function public.create_or_update_delivery")), /update public\.deliveries|delete from public\.deliveries/i);
});

test("28 display status recognizes handoff but never pickup, payment or receipt as final fulfillment", () => {
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "received", customerHandoffCompleted: true }), "received");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", pickupStatus: "completed" }), "ready_for_customer_pickup");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", customerHandoffCompleted: true }), "completed");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", customerHandoffCompleted: true, deliveryStatus: "scheduled" }), "delivery_scheduled");
  assert.equal(deriveOrderDisplayStatus({ productionStatus: "completed", customerHandoffCompleted: true, deliveryStatus: "completed" }), "completed");
});

test("29 order list and detail consume canonical handoff evidence and expose the guarded UI", async () => {
  const [list, page, panel, action, query] = await Promise.all([
    source("src/features/orders/server/queries.ts"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/components/orders/CustomerHandoffPanel.tsx"),
    source("src/features/handoffs/server/actions.ts"),
    source("src/features/handoffs/server/queries.ts"),
  ]);

  assert.match(list, /from\("order_customer_handoffs"\)[\s\S]*\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(list, /customerHandoffCompleted: handoffOrderIds\.has\(order\.id\)/);
  assert.match(page, /displayStatus === "ready_for_customer_pickup"/);
  assert.match(page, /hasOperationalCapability\(access\.membership, "pos"\)/);
  assert.match(panel, /window\.confirm\(text\.confirmation\)/);
  assert.match(panel, /name="confirmUnpaid" required/);
  assert.match(panel, /formatOrganizationDateTime\(handoff\.completedAt, locale, timeZone\)/);
  assert.match(action, /rpc\("complete_customer_handoff"/);
  assert.match(query, /throw new Error\("customer_handoff_query_failed"\)/);
});

test("30 Daily Close treats handoffs as required, tenant-local, deduplicated final fulfillment evidence", async () => {
  const [dailyClose, types] = await Promise.all([
    source("src/features/daily-close/server/queries.ts"),
    source("src/features/daily-close/types.ts"),
  ]);
  const start = dailyClose.indexOf("const handoffsPromise");
  const finalCount = dailyClose.slice(start, dailyClose.indexOf('if (accountingResult.status === "fulfilled")', start));

  assert.match(types, /"handoffs"/);
  assert.match(finalCount, /from\("order_customer_handoffs"\)/);
  assert.match(finalCount, /\.eq\("organization_id", organizationId\)/);
  assert.match(finalCount, /\.gte\("completed_at", day\.start\.toISOString\(\)\)/);
  assert.match(finalCount, /\.lt\("completed_at", endExclusive\.toISOString\(\)\)/);
  assert.match(finalCount, /failedSources\.push\("handoffs"\)/);
  assert.match(finalCount, /const completedOrderIds = new Set/);
  assert.match(finalCount, /completedOrderIds\.add\(handoff\.order_id\)/);
  assert.match(finalCount, /orderSummary\.finalFulfillmentCompleted = completedOrderIds\.size/);
  assert.doesNotMatch(finalCount, /completedPickups.*finalFulfillmentCompleted|payment.*finalFulfillmentCompleted|receipt.*finalFulfillmentCompleted/i);
});

test("all five locales contain handoff UX and required-source labels", async () => {
  for (const locale of ["de", "en", "es", "fr", "it"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const key of ["title", "readOnlyTitle", "completeAction", "confirmation", "currentOperator", "currentTime", "unpaidWarning", "acknowledgement", "notes", "completedAt", "operator", "balanceAtHandoff", "unpaidAcknowledged"])
      assert.equal(typeof messages.orders.handoff[key], "string", `${locale} orders.handoff.${key}`);
    assert.match(messages.orders.handoff.unpaidWarning, /\{amount\}/);
    assert.equal(typeof messages.dailyClose.sourceLabels.handoffs, "string");
  }
});

test("migration contains no backfill, synthetic handoff, or historical/financial rewrite", async () => {
  const sql = await source(migrationPath);
  const beforeRpc = sql.slice(0, sql.indexOf("create function public.complete_customer_handoff"));

  assert.doesNotMatch(beforeRpc, /insert into public\.order_customer_handoffs/);
  assert.doesNotMatch(sql, /do \$\$|truncate/i);
  assert.doesNotMatch(sql, /update public\.(orders|order_status_history|payments)|delete from public\.(orders|order_status_history|payments)/i);
  assert.doesNotMatch(sql, /insert into public\.order_status_history/);
});
