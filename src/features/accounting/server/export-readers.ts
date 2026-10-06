import "server-only";

import { accountingPeriodBounds, type AccountingPeriod } from "@/features/accounting/summary";
import { csvValue } from "@/features/accounting/workspace";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EXPORT_PAGE_SIZE = 250;
const CSV_CHUNK_ROWS = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SALES_HEADERS = ["date", "type", "order_reference", "customer", "location", "payment_method", "amount", "currency"];
const EXPENSE_HEADERS = ["expense_date", "supplier", "category", "description", "reference", "location", "gross", "tax_amount", "tax_rate", "currency", "status"];
const ACCOUNTANT_EXPENSE_HEADERS = ["expense_date", "document_date", "supplier", "category", "description", "reference", "location", "gross", "tax_amount", "tax_rate", "currency", "payment_status", "paid_date", "payment_method", "status"];

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export class InvalidAccountingExportLocationError extends Error {
  constructor() {
    super("accounting_export_location_invalid");
  }
}

export async function getAccountingExportContext(locale: string, requestedLocationId: string | null) {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const organizationId = membership.organization.id;

  if (requestedLocationId !== null) {
    if (!UUID.test(requestedLocationId)) throw new InvalidAccountingExportLocationError();
    const { data, error } = await supabase.from("locations").select("id")
      .eq("organization_id", organizationId)
      .eq("id", requestedLocationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (error || !data) throw new InvalidAccountingExportLocationError();
  }

  return {
    locationId: requestedLocationId,
    organizationId,
    supabase,
    timezone: membership.organization.timezone,
  };
}

function line(values: unknown[]) {
  return `${values.map(csvValue).join(",")}\r\n`;
}

export async function* csvChunks(headers: string[], rows: AsyncIterable<unknown[]>, metrics?: { rowCount: number }): AsyncGenerator<string> {
  yield `\uFEFF${line(headers)}`;
  let buffer = "";
  let bufferedRows = 0;
  for await (const row of rows) {
    if (metrics) metrics.rowCount += 1;
    buffer += line(row);
    bufferedRows += 1;
    if (bufferedRows >= CSV_CHUNK_ROWS) {
      yield buffer;
      buffer = "";
      bufferedRows = 0;
    }
  }
  if (buffer) yield buffer;
}

export function accountingCsvResponse(chunks: AsyncIterable<string>, filename: string) {
  const iterator = chunks[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export type SalesEvent = {
  amount: number | string;
  currency: string;
  customer: string;
  event_date: string;
  event_id: string;
  event_type: "sale" | "payment" | "refund";
  location: string | null;
  order_reference: string;
  payment_method: string | null;
};

export type SalesPageReader = (args: {
  start: string;
  endExclusive: string;
  locationId: string | null;
  cursor: { date: string; id: string; type: SalesEvent["event_type"] } | null;
  limit: number;
}) => Promise<SalesEvent[]>;

export async function* accountingSalesPages(
  supabase: SupabaseServerClient,
  period: AccountingPeriod,
  timezone: string,
  locationId: string | null,
  workerPageReader?: SalesPageReader,
): AsyncGenerator<SalesEvent[]> {
  const bounds = accountingPeriodBounds(period, timezone);
  let cursor: { date: string; id: string; type: SalesEvent["event_type"] } | null = null;
  for (;;) {
    const result = workerPageReader ? null : await supabase.rpc("list_accounting_sales_export_page", {
      target_cursor_event_date: cursor?.date ?? null,
      target_cursor_event_id: cursor?.id ?? null,
      target_cursor_event_type: cursor?.type ?? null,
      target_end_exclusive: bounds.end,
      target_limit: EXPORT_PAGE_SIZE,
      target_location_id: locationId,
      target_start: bounds.start,
    }).returns<SalesEvent[]>() as unknown as { data: SalesEvent[] | null; error: { code?: string } | null };
    if (result?.error) throw new Error(`accounting_sales_export_failed:${result.error.code}`);
    const rows: SalesEvent[] = workerPageReader
      ? await workerPageReader({ start: bounds.start, endExclusive: bounds.end, locationId, cursor, limit: EXPORT_PAGE_SIZE })
      : result?.data ?? [];
    if (rows.length) yield rows;
    if (rows.length < EXPORT_PAGE_SIZE) return;
    const last = rows[rows.length - 1];
    cursor = { date: last.event_date, id: last.event_id, type: last.event_type };
  }
}

async function* salesRows(
  supabase: SupabaseServerClient,
  period: AccountingPeriod,
  timezone: string,
  locationId: string | null,
  workerPageReader?: SalesPageReader,
): AsyncGenerator<unknown[]> {
  for await (const page of accountingSalesPages(supabase, period, timezone, locationId, workerPageReader)) {
    for (const row of page) {
      yield [row.event_date, row.event_type, row.order_reference, row.customer, row.location, row.payment_method, Number(row.amount).toFixed(2), row.currency];
    }
  }
}

export async function* accountingSalesCsvChunks(
  supabase: SupabaseServerClient,
  period: AccountingPeriod,
  timezone: string,
  locationId: string | null,
  workerPageReader?: SalesPageReader,
  metrics?: { rowCount: number },
): AsyncGenerator<string> {
  yield* csvChunks(SALES_HEADERS, salesRows(supabase, period, timezone, locationId, workerPageReader), metrics);
}

export type ExpenseExportRow = {
  category_id: string;
  currency: string;
  description: string;
  document_date: string | null;
  expense_date: string;
  gross_amount: number | string;
  id: string;
  location_id: string | null;
  paid_date: string | null;
  payment_method: string | null;
  payment_status: string;
  status: "draft" | "posted" | "void";
  supplier_id: string | null;
  supplier_reference: string | null;
  tax_amount: number | string | null;
  tax_rate: number | string | null;
};

type NamedRow = { id: string; name: string };
type SupplierNameRow = { display_name: string; id: string };

async function namesById<T extends NamedRow>(
  supabase: SupabaseServerClient,
  table: "expense_categories" | "locations",
  organizationId: string,
  ids: string[],
) {
  if (!ids.length) return new Map<string, string>();
  const { data, error } = await supabase.from(table).select("id, name")
    .eq("organization_id", organizationId).in("id", ids).returns<T[]>();
  if (error) throw new Error(`accounting_expenses_export_lookup_failed:${error.code}`);
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}

async function suppliersById(supabase: SupabaseServerClient, organizationId: string, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data, error } = await supabase.from("suppliers").select("id, display_name")
    .eq("organization_id", organizationId).in("id", ids).returns<SupplierNameRow[]>();
  if (error) throw new Error(`accounting_expenses_export_lookup_failed:${error.code}`);
  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}

export async function* accountingExpensePages(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  locationId: string | null,
  postedOnly = false,
): AsyncGenerator<ExpenseExportRow[]> {
  let cursor: { date: string; id: string } | null = null;
  for (;;) {
    let query = supabase.from("expenses")
      .select("id, expense_date, document_date, supplier_id, category_id, description, supplier_reference, location_id, gross_amount, tax_amount, tax_rate, currency, payment_status, paid_date, payment_method, status")
      .eq("organization_id", organizationId)
      .gte("expense_date", period.startDate)
      .lt("expense_date", period.endDateExclusive)
      .order("expense_date", { ascending: true })
      .order("id", { ascending: true })
      .limit(EXPORT_PAGE_SIZE);
    if (locationId) query = query.eq("location_id", locationId);
    if (postedOnly) query = query.eq("status", "posted");
    if (cursor) query = query.or(`expense_date.gt.${cursor.date},and(expense_date.eq.${cursor.date},id.gt.${cursor.id})`);
    const { data, error } = await query.returns<ExpenseExportRow[]>();
    if (error) throw new Error(`accounting_expenses_export_failed:${error.code}`);
    const rows = data ?? [];
    if (!rows.length) return;
    yield rows;
    if (rows.length < EXPORT_PAGE_SIZE) return;
    const last = rows[rows.length - 1];
    cursor = { date: last.expense_date, id: last.id };
  }
}

async function* expenseRows(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  locationId: string | null,
  postedOnly: boolean,
): AsyncGenerator<unknown[]> {
  for await (const rows of accountingExpensePages(supabase, organizationId, period, locationId, postedOnly)) {

    const categoryIds = [...new Set(rows.map((row) => row.category_id))];
    const supplierIds = [...new Set(rows.flatMap((row) => row.supplier_id ? [row.supplier_id] : []))];
    const locationIds = [...new Set(rows.flatMap((row) => row.location_id ? [row.location_id] : []))];
    const [categories, suppliers, locations] = await Promise.all([
      namesById<NamedRow>(supabase, "expense_categories", organizationId, categoryIds),
      suppliersById(supabase, organizationId, supplierIds),
      namesById<NamedRow>(supabase, "locations", organizationId, locationIds),
    ]);
    for (const row of rows) {
      const common = [
        row.expense_date,
        row.supplier_id ? suppliers.get(row.supplier_id) ?? "" : "",
        categories.get(row.category_id) ?? "",
        row.description,
        row.supplier_reference ?? "",
        row.location_id ? locations.get(row.location_id) ?? "" : "",
        Number(row.gross_amount).toFixed(2),
        row.tax_amount === null ? "" : Number(row.tax_amount).toFixed(2),
        row.tax_rate === null ? "" : Number(row.tax_rate).toFixed(4),
        row.currency,
      ];
      yield postedOnly
        ? [row.expense_date, row.document_date ?? "", ...common.slice(1), row.payment_status, row.paid_date ?? "", row.payment_method ?? "", row.status]
        : [...common, row.status];
    }
  }
}

export async function* accountingExpensesCsvChunks(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  locationId: string | null,
): AsyncGenerator<string> {
  yield* csvChunks(EXPENSE_HEADERS, expenseRows(supabase, organizationId, period, locationId, false));
}

export async function* accountantExpensesCsvChunks(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  locationId: string | null,
  metrics?: { rowCount: number },
): AsyncGenerator<string> {
  yield* csvChunks(ACCOUNTANT_EXPENSE_HEADERS, expenseRows(supabase, organizationId, period, locationId, true), metrics);
}
