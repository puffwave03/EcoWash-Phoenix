import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOrderCode } from "../src/features/barcode/payload.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260829000600_quick_drop_001a_canonical_intake.sql";

test("1 Quick Drop creates one canonical order and no parallel order engine", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /from public\.create_order\(/);
  assert.match(sql, /update public\.orders orders/);
  assert.doesNotMatch(sql, /create table|quick_drop_orders/i);
});

test("2 pending detail is an explicit canonical history source with received status", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /production_status = 'received'/);
  assert.match(sql, /received_at = now\(\)/);
  assert.match(sql, /jsonb_build_object\('source', 'quick_drop'\)/);
  assert.match(sql, /from_status, to_status[\s\S]*'draft',[\s\S]*'received'/);
});

test("3 regular and canonical walk-in customers use the same tenant-safe customer validation", async () => {
  const [quickDrop, canonicalOrders, customerAction] = await Promise.all([
    source(migrationPath),
    source("supabase/migrations/20260728000200_app_006_orders_workflow.sql"),
    source("src/features/shop-terminal/server/actions.ts"),
  ]);
  assert.match(quickDrop, /target_customer_id/);
  assert.match(canonicalOrders, /where id = target_customer_id[\s\S]*organization_id = org_id[\s\S]*is_active/);
  assert.match(customerAction, /WALKIN-/);
  assert.doesNotMatch(quickDrop, /anonymous|shared.customer/i);
});

test("4 creation writes no fake item, price, discount, payment or invoice", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /insert into public\.(order_items|payments|invoices|invoice_items|invoice_orders)/i);
  assert.doesNotMatch(sql, /save_order_item|record_pos_payment|update_order_discount/);
  assert.match(sql, /target_due_at,[\s\S]*null,[\s\S]*nullif\(btrim\(target_note\), ''\)/);
});

test("5 pending financial state is explicitly unpriced until active items exist", async () => {
  const [action, query] = await Promise.all([
    source("src/features/quick-drop/server/actions.ts"),
    source("src/features/quick-drop/server/queries.ts"),
  ]);
  assert.match(action, /financialState: "unpriced"/);
  assert.match(query, /itemResult\.count[\s\S]*pendingDetail \? "unpriced" : "priced"/);
  assert.match(query, /eq\("is_active", true\)/);
});

test("6 later detailing preserves the order and reuses canonical pricing", async () => {
  const [query, actions, pricing] = await Promise.all([
    source("src/features/quick-drop/server/queries.ts"),
    source("src/features/orders/server/actions.ts"),
    source("supabase/migrations/20260827000100_pricing_segments_001_segment_price_overrides.sql"),
  ]);
  assert.match(query, /eq\("order_id", orderId\)/);
  assert.match(actions, /rpc\("save_order_item"/);
  assert.match(pricing, /create trigger order_items_resolve_effective_price/);
  assert.match(pricing, /public\.resolve_effective_service_price/);
  const migration = await source(migrationPath);
  assert.match(migration, /quick_drop_detail_required/);
  assert.match(migration, /not exists \([\s\S]*from public\.order_items item[\s\S]*item\.order_id = old\.id[\s\S]*item\.is_active/);
  assert.match(migration, /new\.production_status not in \('received', 'on_hold', 'cancelled'\)/);
});

test("7 one physical receipt is idempotent and conflicting reuse fails", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /shop_terminal_submissions/);
  assert.match(sql, /'kind', 'quick_drop'/);
  assert.match(sql, /existing_submission\.request_fingerprint <> fingerprint/);
  assert.match(sql, /quick_drop_idempotency_conflict/);
});

test("8 tenant, customer, location and order reads remain organization scoped", async () => {
  const [sql, query] = await Promise.all([
    source(migrationPath),
    source("src/features/quick-drop/server/queries.ts"),
  ]);
  assert.match(sql, /require_shop_terminal_access\(org_id\)/);
  assert.match(sql, /target_location_id is null/);
  assert.match(query, /eq\("organization_id", organizationId\)/g);
  assert.match(query, /eq\("id", orderId\)/);
});

test("9 creation/discovery reuse Terminal access while ordinary order reads retain membership access", async () => {
  const [action, access, query] = await Promise.all([
    source("src/features/quick-drop/server/actions.ts"),
    source("src/features/shop-terminal/server/access.ts"),
    source("src/features/quick-drop/server/queries.ts"),
  ]);
  assert.match(action, /requireShopTerminalAccess\(locale\)/);
  assert.match(access, /requireEntitlement\(locale, FEATURES\.shopTerminal\)/);
  assert.match(access, /requirePosAccess\(locale\)/);
  const orderRead = query.slice(query.indexOf("getQuickDropOrderOrNull"), query.indexOf("export async function getQuickDropOrder("));
  const terminalList = query.slice(query.indexOf("listPendingQuickDrops"));
  assert.match(orderRead, /requireMembership\(locale\)/);
  assert.doesNotMatch(orderRead, /requireShopTerminalAccess/);
  assert.match(terminalList, /requireShopTerminalAccess\(locale\)/);
});

test("10 stable BARCODE-001 order reference is returned immediately", async () => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const action = await source("src/features/quick-drop/server/actions.ts");
  assert.match(action, /createOrderCode\(data\.order_id\)/);
  assert.equal(createOrderCode(orderId), createOrderCode(orderId));
  assert.equal(createOrderCode(orderId), `PHX1:O:${orderId}`);
});

test("11 normal Shop Terminal submission remains unchanged", async () => {
  const sql = await source(migrationPath);
  assert.doesNotMatch(sql, /create or replace function public\.submit_shop_terminal_order|drop function public\.submit_shop_terminal_order/i);
});

test("12 migration is additive, least-privilege and changes no historical rows", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /security definer[\s\S]*set search_path = public/);
  assert.match(sql, /revoke all on function public\.create_quick_drop_order/);
  assert.match(sql, /grant execute on function public\.create_quick_drop_order[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /\b(delete|truncate|drop table|alter table)\b/i);
});

test("13 Terminal exposes one secondary Quick Drop entry for the selected canonical customer", async () => {
  const [page, workspace, panel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
  ]);
  assert.match(page, /createQuickDrop: createQuickDropAction\.bind\(null, locale\)/);
  assert.match(workspace, /customer=\{selectedCustomer \? \{ id: selectedCustomer\.id, name: selectedCustomer\.name \} : null\}/);
  assert.match(panel, /text\.action/);
});

test("14 intake stays minimal and uses the active Terminal location", async () => {
  const [workspace, panel] = await Promise.all([
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
  ]);
  assert.match(workspace, /locationId=\{session\?\.locationId \?\? null\}/);
  for (const field of ["customerId", "idempotencyKey", "locationId", "note", "dueAt"]) assert.match(panel, new RegExp(field));
  const submission = panel.slice(panel.indexOf("function submit"), panel.indexOf("return ("));
  assert.doesNotMatch(submission, /serviceId|unitPrice|payment|discount|invoice/i);
});

test("15 success stays inside Terminal and shows reference, customer, receipt time and optional due date", async () => {
  const panel = await source("src/components/quick-drop/QuickDropTerminalPanel.tsx");
  for (const value of ["result.order.orderNumber", "result.order.receivedAt", "result.order.dueAt"]) {
    assert.match(panel, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(panel, /customer\?\.name/);
  assert.match(panel, /text\.pendingDetail/);
  assert.match(panel, /text\.unpriced/);
});

test("16 immediate Quick Drop output is stable order QR plus ticket only", async () => {
  const [panel, printActions] = await Promise.all([
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
    source("src/components/printing/PrintOrderActions.tsx"),
  ]);
  assert.match(panel, /ScannableQrCode[\s\S]*payload=\{result\.order\.orderCode\}/);
  assert.match(panel, /modes=\{\["ticket"\]\}/);
  assert.match(panel, /text\.labelsDeferred/);
  assert.doesNotMatch(panel, /modes=\{\["labels"\]\}/);
  assert.match(printActions, /modes = \["receipt", "ticket", "labels"\]/);
});

test("17 pending Quick Drops are tenant-scoped and discoverable from Terminal", async () => {
  const [query, panel] = await Promise.all([
    source("src/features/quick-drop/server/queries.ts"),
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
  ]);
  assert.match(query, /listPendingQuickDrops/);
  assert.match(query, /eq\("organization_id", organizationId\)/g);
  assert.match(query, /detailedIds[\s\S]*!detailedIds\.has\(order\.id\)/);
  assert.match(panel, /pendingList/);
  assert.match(panel, /href=\{`\/app\/orders\/\$\{order\.id\}#items`\}/);
});

test("17a Quick Drop eligibility stays customer and active-location scoped with an accessible reason", async () => {
  const [page, workspace, panel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
  ]);
  assert.match(workspace, /customer=\{selectedCustomer \? \{ id: selectedCustomer\.id, name: selectedCustomer\.name \} : null\}/);
  assert.match(workspace, /locationId=\{session\?\.locationId \?\? null\}/);
  assert.match(panel, /customer \? <section/);
  assert.match(panel, /disabled=\{!locationId\}/);
  assert.match(panel, /disabled=\{isPending \|\| !locationId\}/);
  assert.match(panel, /aria-describedby=\{!locationId \? "quick-drop-location-required" : undefined\}/);
  assert.match(panel, /text\.locationRequired/);
  assert.match(page, /locationRequired: quickDropT\("locationRequired"\)/);
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.quickDrop.locationRequired, "string");
  }
});

test("18 later detail opens the same order item section and keeps canonical item save", async () => {
  const [panel, detail, actions] = await Promise.all([
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/orders/server/actions.ts"),
  ]);
  assert.match(panel, /result\.order\.id\}#items/);
  assert.match(detail, /saveOrderItemAction\.bind\(null, locale, order\.id\)/);
  assert.match(actions, /rpc\("save_order_item"/);
});

test("19 pending order detail never presents zero as paid, due or invoice-ready", async () => {
  const detail = await source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
  assert.match(detail, /pendingQuickDrop \? quickDropT\("unpriced"\) : paymentStatusLabels/);
  assert.match(detail, /pendingQuickDrop \? quickDropT\("unpriced"\) : formatCurrency\(order\.total/);
  assert.match(detail, /pendingQuickDrop \? <Card>[\s\S]*detailBeforeFinancial/);
  assert.doesNotMatch(detail, /pendingQuickDrop[\s\S]{0,100}invoice/);
});

test("20 production guard has a clear localized UX and returns attempted transitions to detail", async () => {
  const [detail, actions] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/orders/server/actions.ts"),
  ]);
  assert.match(detail, /pendingQuickDrop[\s\S]*quickDropT\("productionBlocked"\)/);
  assert.match(actions, /error\.message\.includes\("quick_drop_detail_required"\)/);
  assert.match(actions, /redirect\(`\/\$\{locale\}\/app\/orders\/\$\{orderId\}#items`\)/);
});

test("21 client and database both protect against duplicate receipt submission", async () => {
  const panel = await source("src/components/quick-drop/QuickDropTerminalPanel.tsx");
  assert.match(panel, /idempotencyKey\.current \?\?= crypto\.randomUUID\(\)/);
  assert.match(panel, /if \(!customer \|\| !locationId \|\| isPending\) return/);
  assert.match(panel, /disabled=\{isPending \|\| !locationId\}/);
});

test("22 all five locales expose the complete Quick Drop UX vocabulary", async () => {
  const expectedKeys = ["action", "cancel", "confirm", "confirming", "detailBeforeFinancial", "detailOrder", "dueAt", "errorGeneric", "errorValidation", "help", "labelsDeferred", "locationRequired", "newOrder", "newQuickDrop", "note", "notePlaceholder", "openOrder", "pendingDetail", "pendingList", "productionBlocked", "qrAria", "received", "success", "unpriced"];
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.deepEqual(Object.keys(messages.quickDrop).sort(), [...expectedKeys].sort());
  }
});
