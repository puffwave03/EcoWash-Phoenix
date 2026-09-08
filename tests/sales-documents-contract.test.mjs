import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260908000100_accounting_sales_documents_001.sql";
const receiptPolicyMigrationPath = "supabase/migrations/20260908000200_accounting_sales_documents_001_receipt_select_policy.sql";
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function functionBody(sql, name, next) {
  const start = sql.indexOf(`create function public.${name}`);
  const end = next ? sql.indexOf(`create function public.${next}`, start) : sql.length;
  assert.ok(start >= 0 && end > start, `${name} must exist`);
  return sql.slice(start, end);
}

test("1 receipt persistence is additive, tenant scoped and has no drafts", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /create table public\.operational_receipts/);
  assert.match(sql, /organization_id uuid not null/);
  assert.match(sql, /foreign key \(organization_id, order_id\)/);
  assert.match(sql, /foreign key \(organization_id, customer_id\)/);
  assert.match(sql, /operational_receipt_status as enum \('issued', 'cancelled'\)/);
  assert.doesNotMatch(sql, /operational_receipt_status[^;]*draft/);
});

test("2-7 definitive numbering is annual, series-scoped, atomic and never MAX based", async () => {
  const sql = await source(migrationPath);
  const issue = functionBody(sql, "issue_operational_receipt", "cancel_operational_receipt");
  assert.match(sql, /primary key \(organization_id, sequence_year, series\)/);
  assert.match(issue, /for update/);
  assert.match(issue, /insert into public\.operational_receipt_number_counters/);
  assert.match(issue, /on conflict \(organization_id, sequence_year, series\)[\s\S]*next_value = public\.operational_receipt_number_counters\.next_value \+ 1/);
  assert.match(issue, /returning next_value - 1 into allocated_sequence/);
  assert.match(issue, /receipt_series \|\| '-' \|\| receipt_year::text \|\| '-' \|\| lpad\(allocated_sequence::text, 6, '0'\)/);
  assert.doesNotMatch(sql, /max\s*\(/i);
});

test("5-6 repeat and concurrent issue reuse the current issued receipt without consuming a number", async () => {
  const sql = await source(migrationPath);
  const issue = functionBody(sql, "issue_operational_receipt", "cancel_operational_receipt");
  assert.doesNotMatch(sql, /unique \(organization_id, order_id\)/);
  assert.match(sql, /create unique index operational_receipts_issued_order_unique[\s\S]*\(organization_id, order_id\)[\s\S]*where document_status = 'issued'/);
  assert.match(issue, /from public\.orders[\s\S]*for update/);
  assert.match(issue, /where receipt\.organization_id = org_id[\s\S]*receipt\.order_id = target_order_id[\s\S]*receipt\.document_status = 'issued'/);
  assert.match(issue, /if existing_receipt\.id is not null then[\s\S]*return query select existing_receipt\.id, existing_receipt\.receipt_number/);
  assert.doesNotMatch(issue, /operational_receipt_cancelled/);
  assert.ok(issue.indexOf("receipt.document_status = 'issued'") < issue.indexOf("insert into public.operational_receipt_number_counters"));
});

test("8-11 issued snapshots and numbers are immutable, cancellation is controlled and non-destructive", async () => {
  const sql = await source(migrationPath);
  const cancel = functionBody(sql, "cancel_operational_receipt", "record_sales_document_event");
  assert.match(sql, /operational_receipt_snapshot_immutable/);
  assert.match(sql, /operational_receipt_delete_forbidden/);
  assert.match(sql, /new\.receipt_number is distinct from old\.receipt_number/);
  assert.match(sql, /new\.snapshot is distinct from old\.snapshot/);
  assert.match(cancel, /document_status = 'cancelled'/);
  assert.match(cancel, /cancellation_reason = normalized_reason/);
  assert.doesNotMatch(cancel, /delete from public\.operational_receipts/);
  assert.doesNotMatch(cancel, /update public\.(orders|payments|invoices)/);
  assert.match(sql, /operational_receipts_number_unique unique \(organization_id, receipt_number\)/);
});

test("11b cancelled receipts remain historical and allow a newly numbered issued receipt", async () => {
  const sql = await source(migrationPath);
  const issue = functionBody(sql, "issue_operational_receipt", "cancel_operational_receipt");
  assert.match(sql, /where document_status = 'issued'/);
  assert.match(issue, /receipt\.document_status = 'issued'/);
  assert.match(issue, /insert into public\.operational_receipt_number_counters[\s\S]*returning next_value - 1 into allocated_sequence/);
  assert.match(issue, /insert into public\.operational_receipts/);
  assert.doesNotMatch(issue, /document_status = 'cancelled'/);
});

test("12-14 receipt issue redirects to persisted snapshot reprint while ticket and labels stay live", async () => {
  const [actions, issuePage, receiptPage, receiptDocument, ticketPage, labelsPage] = await Promise.all([
    source("src/features/sales-documents/server/actions.ts"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/accounting/documents/receipts/[receiptId]/print/page.tsx"),
    source("src/components/sales-documents/OperationalReceiptDocument.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/print/ticket/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/print/labels/page.tsx"),
  ]);
  const issueAction = actions.slice(
    actions.indexOf("export async function issueOperationalReceipt"),
    actions.indexOf("export async function cancelOperationalReceiptAction"),
  );
  assert.match(issueAction, /supabase\.rpc\("issue_operational_receipt"/);
  assert.doesNotMatch(issueAction, /revalidatePath/);
  assert.match(issuePage, /issueOperationalReceipt\(locale, orderId\)/);
  assert.match(issuePage, /documents\/receipts\/\$\{receipt\.id\}\/print/);
  assert.ok(issuePage.indexOf("issueOperationalReceipt(locale, orderId)") < issuePage.indexOf("redirect("));
  assert.match(receiptPage, /getOperationalReceipt\(locale, receiptId\)/);
  assert.match(receiptDocument, /receipt\.snapshot/);
  assert.doesNotMatch(receiptDocument, /getPrintOrderContext|getOrderById|listOrderItems/);
  for (const page of [ticketPage, labelsPage]) {
    assert.match(page, /getPrintOrderContext\(locale, orderId\)/);
    assert.match(page, /OrderPrintDocument/);
  }
});

test("15-16 registry combines receipts with canonical invoices without copying invoices", async () => {
  const [queries, sql] = await Promise.all([
    source("src/features/sales-documents/server/queries.ts"),
    source(migrationPath),
  ]);
  assert.match(queries, /from\("operational_receipts"\)/);
  assert.match(queries, /from\("invoices"\)/);
  assert.match(queries, /\.in\("document_status", \["issued", "cancelled"\]\)/);
  assert.doesNotMatch(sql, /create table public\.sales_documents/);
  assert.doesNotMatch(functionBody(sql, "issue_operational_receipt", "cancel_operational_receipt"), /from public\.invoices/);
});

test("17-18 viewed and print_requested history is append-only", async () => {
  const [sql, printButton, tracker, receiptPage, invoicePage] = await Promise.all([
    source(migrationPath),
    source("src/components/printing/PrintButton.tsx"),
    source("src/components/sales-documents/SalesDocumentViewTracker.tsx"),
    source("src/app/[locale]/app/(dashboard)/accounting/documents/receipts/[receiptId]/print/page.tsx"),
    source("src/app/[locale]/app/(dashboard)/billing/[invoiceId]/print/page.tsx"),
  ]);
  assert.match(sql, /sales_document_event_type as enum \('viewed', 'print_requested'\)/);
  assert.match(sql, /sales_document_events_append_only/);
  assert.match(sql, /before update or delete on public\.sales_document_events/);
  assert.match(tracker, /^"use client"/);
  assert.match(tracker, /useEffect/);
  assert.match(tracker, /useRef\(false\)/);
  assert.match(tracker, /if \(recordedRef\.current\) return/);
  assert.match(tracker, /void viewedAction\(\)/);
  for (const page of [receiptPage, invoicePage]) {
    assert.match(page, /<SalesDocumentViewTracker viewedAction=/);
    assert.match(page, /"viewed"/);
    assert.doesNotMatch(page, /await recordSalesDocumentEvent\([^\n]*"viewed"/);
  }
  assert.match(printButton, /await printRequestedAction\?\.\(\)/);
  assert.doesNotMatch(sql, /event_type[^;]*printed/);
});

test("19 tenant and access boundaries are explicit in tables, RPCs and queries", async () => {
  const [sql, actions, queries] = await Promise.all([source(migrationPath), source("src/features/sales-documents/server/actions.ts"), source("src/features/sales-documents/server/queries.ts")]);
  assert.match(sql, /app_current_organization_id\(\)/g);
  assert.match(sql, /has_operational_capability\(org_id, 'pos'/);
  assert.match(sql, /organization_entitlement_is_enabled\(org_id, 'printing'/);
  assert.match(actions, /requirePrintAccess\(locale\)/);
  assert.match(queries, /\.eq\("organization_id", membership\.organization\.id\)/g);
});

test("19b receipt SELECT policy uses the authenticated entitlement boundary", async () => {
  const sql = await source(receiptPolicyMigrationPath);
  assert.match(sql, /drop policy if exists operational_receipts_select_print_access on public\.operational_receipts/);
  assert.match(sql, /create policy operational_receipts_select_print_access on public\.operational_receipts[\s\S]*for select to authenticated/);
  assert.match(sql, /public\.is_organization_member\(organization_id\)/);
  assert.match(sql, /public\.has_operational_capability\(organization_id, 'pos'::public\.operational_capability\)/);
  assert.match(sql, /public\.has_organization_entitlement\(organization_id, 'printing'\)/);
  assert.doesNotMatch(sql, /organization_entitlement_is_enabled/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*organization_entitlement_is_enabled/i);
});

test("20-23 accounting, payments, Billing model and fiscal scope remain untouched", async () => {
  const [sql, accountingQuery, accountingSummary] = await Promise.all([source(migrationPath), source("src/features/accounting/server/queries.ts"), source("src/features/accounting/summary.ts")]);
  assert.doesNotMatch(`${accountingQuery}\n${accountingSummary}`, /operational_receipts|sales_document_events/);
  assert.doesNotMatch(sql, /(insert into|update|delete from) public\.(payments|orders|invoices|invoice_items|invoice_orders)/i);
  assert.doesNotMatch(sql, /billing_invoice_number_counters|issue_billing_invoice|cancel_billing_invoice/);
  assert.doesNotMatch(sql, /veri.?factu|fiscal_event|fiscal_receipt/i);
});

test("24 all five locales expose the sales-document registry and receipt vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.accountingWorkspace.documentsLink, "string");
    assert.equal(typeof messages.salesDocuments.registry.kinds.receipt, "string");
    assert.equal(typeof messages.salesDocuments.registry.kinds.invoice, "string");
    assert.equal(typeof messages.salesDocuments.notFiscal, "string");
  }
});
