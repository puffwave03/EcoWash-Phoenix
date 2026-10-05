import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20261005000400_data_retention_scale_001k_a_export_readers.sql";

test("001K-A Sales and Expenses routes use dedicated streamed readers", async () => {
  const [salesRoute, expensesRoute, readers] = await Promise.all([
    read("src/app/[locale]/app/(dashboard)/accounting/export/sales/route.ts"),
    read("src/app/[locale]/app/(dashboard)/accounting/export/expenses/route.ts"),
    read("src/features/accounting/server/export-readers.ts"),
  ]);
  assert.doesNotMatch(salesRoute, /getAccountingWorkspace/);
  assert.doesNotMatch(expensesRoute, /getAccountingWorkspace/);
  assert.match(salesRoute, /accountingSalesCsvChunks/);
  assert.match(expensesRoute, /accountingExpensesCsvChunks/);
  assert.match(readers, /new ReadableStream/);
  assert.match(readers, /CSV_CHUNK_ROWS = 64/);
  assert.match(readers, /EXPORT_PAGE_SIZE = 250/);
  assert.doesNotMatch(readers, /\.range\(|offset/i);
  assert.match(readers, /for \(;;\)/);
  assert.doesNotMatch(readers, /maxRows|MAX_ROWS|totalRowCap|slice\(0/);
});

test("Sales traversal preserves date/type/id order and source date semantics", async () => {
  const [migration, readers] = await Promise.all([
    read(migrationPath),
    read("src/features/accounting/server/export-readers.ts"),
  ]);
  assert.match(migration, /orders\.created_at as event_date/);
  assert.match(migration, /payments\.paid_at as event_date/);
  assert.match(migration, /order by events\.event_date desc, events\.event_type asc, events\.event_id asc/);
  assert.match(migration, /orders\.created_at desc, orders\.id asc/);
  assert.match(migration, /payments\.paid_at desc, payments\.id asc/);
  assert.match(migration, /target_cursor_event_date/);
  assert.match(migration, /target_cursor_event_type/);
  assert.match(migration, /target_cursor_event_id/);
  assert.match(readers, /"sale" \| "payment" \| "refund"/);
  assert.match(readers, /target_limit: EXPORT_PAGE_SIZE/);
});

test("Sales reader preserves canonical Order, Quick Drop, payment, and currency semantics", async () => {
  const migration = await read(migrationPath);
  assert.match(migration, /orders\.is_active/);
  assert.match(migration, /orders\.production_status <> 'cancelled'/);
  assert.match(migration, /history\.metadata @> '\{"source":"quick_drop"\}'::jsonb/);
  assert.match(migration, /and not exists \([\s\S]*?public\.order_items item[\s\S]*?item\.is_active/);
  assert.match(migration, /payments\.status = 'confirmed'/);
  assert.match(migration, /payments\.status = 'refunded'/);
  assert.doesNotMatch(migration, /payments\.status = '(pending|void)'/);
  assert.match(migration, /payments\.amount as amount/);
  assert.match(migration, /orders\.currency as currency/);
});

test("Expenses traversal is tenant-scoped, keyset ordered, bounded, and includes all lifecycle states", async () => {
  const readers = await read("src/features/accounting/server/export-readers.ts");
  const expenseReader = readers.slice(readers.indexOf("export async function* accountingExpensePages"), readers.indexOf("async function* expenseRows"));
  assert.match(expenseReader, /from\("expenses"\)/);
  assert.match(expenseReader, /\.eq\("organization_id", organizationId\)/);
  assert.match(expenseReader, /\.gte\("expense_date", period\.startDate\)/);
  assert.match(expenseReader, /\.lt\("expense_date", period\.endDateExclusive\)/);
  assert.match(expenseReader, /\.order\("expense_date", \{ ascending: true \}\)/);
  assert.match(expenseReader, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(expenseReader, /expense_date\.gt\.\$\{cursor\.date\}.*id\.gt\.\$\{cursor\.id\}/);
  assert.match(expenseReader, /\.limit\(EXPORT_PAGE_SIZE\)/);
  assert.doesNotMatch(expenseReader, /\.range\(|from\("orders"\)|from\("payments"\)|from\("pos_sessions"\)/);
  assert.match(expenseReader, /if \(postedOnly\) query = query\.eq\("status", "posted"\)/);
  assert.match(readers, /expenseRows\(supabase, organizationId, period, locationId, false\)/);
  assert.match(readers, /"draft" \| "posted" \| "void"/);
});

test("explicit location scope is validated directly and fails closed", async () => {
  const [readers, salesRoute, expensesRoute, request, migration] = await Promise.all([
    read("src/features/accounting/server/export-readers.ts"),
    read("src/app/[locale]/app/(dashboard)/accounting/export/sales/route.ts"),
    read("src/app/[locale]/app/(dashboard)/accounting/export/expenses/route.ts"),
    read("src/features/accounting/server/export-request.ts"),
    read(migrationPath),
  ]);
  assert.match(readers, /requireOwnerOrManager\(locale\)/);
  assert.match(readers, /\.eq\("organization_id", organizationId\)[\s\S]*?\.eq\("id", requestedLocationId\)[\s\S]*?\.eq\("is_active", true\)[\s\S]*?\.is\("deleted_at", null\)/);
  assert.match(request, /InvalidAccountingExportLocationError[\s\S]*?status: 400/);
  assert.match(salesRoute, /accountingExportRequest/);
  assert.match(expensesRoute, /accountingExportRequest/);
  assert.match(migration, /public\.app_current_organization_id\(\)/);
  assert.match(migration, /has_organization_role\(org_id, array\['owner', 'manager'\]/);
  assert.match(migration, /accounting_export_location_invalid/);
  assert.doesNotMatch(salesRoute + expensesRoute + migration, /target_organization_id|organization_id\s*:\s*url\./);
  assert.match(readers, /locationId: requestedLocationId/);
});

test("CSV schemas, BOM, injection protection, and private attachment headers remain", async () => {
  const [readers, workspace, salesRoute, expensesRoute] = await Promise.all([
    read("src/features/accounting/server/export-readers.ts"),
    read("src/features/accounting/workspace.ts"),
    read("src/app/[locale]/app/(dashboard)/accounting/export/sales/route.ts"),
    read("src/app/[locale]/app/(dashboard)/accounting/export/expenses/route.ts"),
  ]);
  assert.match(readers, /\["date", "type", "order_reference", "customer", "location", "payment_method", "amount", "currency"\]/);
  assert.match(readers, /\["expense_date", "supplier", "category", "description", "reference", "location", "gross", "tax_amount", "tax_rate", "currency", "status"\]/);
  assert.match(readers, /yield `\\uFEFF\$\{line\(headers\)\}`/);
  assert.match(workspace, /const safe = \/\^\[=\+\\-@\]\//);
  assert.match(readers, /csvValue/);
  for (const route of [salesRoute, expensesRoute]) {
    assert.match(route, /accountingCsvResponse/);
  }
  assert.match(readers, /"Cache-Control": "private, no-store"/);
  assert.match(readers, /"Content-Disposition": `attachment; filename=/);
  assert.match(readers, /"Content-Type": "text\/csv; charset=utf-8"/);
});

test("migration contains exactly four approved read indexes and no other schema changes", async () => {
  const sql = await read(migrationPath);
  const indexes = [...sql.matchAll(/create index ([a-z0-9_]+)\s+on public\.([a-z_]+)\s*\(([^;]+)\);/gi)]
    .map((match) => [match[1], match[2], match[3].replace(/\s+/g, " ").trim()]);
  assert.deepEqual(indexes, [
    ["orders_org_created_id_export_idx", "orders", "organization_id, created_at desc, id asc"],
    ["payments_org_paid_id_export_idx", "payments", "organization_id, paid_at desc, id asc"],
    ["expenses_org_date_id_export_idx", "expenses", "organization_id, expense_date asc, id asc"],
    ["expenses_org_location_date_id_export_idx", "expenses", "organization_id, location_id, expense_date asc, id asc"],
  ]);
  assert.equal((sql.match(/create function /gi) ?? []).length, 1);
  assert.match(sql, /returns table \([\s\S]*event_date[\s\S]*event_type[\s\S]*event_id/);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /create table|alter table|create trigger|create policy|enable row level security|insert into|update public\.|delete from|fiscal|verifactu|export_job/i);
});
