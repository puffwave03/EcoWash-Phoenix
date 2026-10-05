import "server-only";

import type { AccountingPeriod } from "@/features/accounting/summary";
import {
  addAccountantPostedExpense,
  addAccountantSalesEvent,
  type AccountantCurrencyTotals,
} from "@/features/accounting/accountant-summary";
import {
  accountingExpensePages,
  accountingSalesPages,
  csvChunks,
  type SupabaseServerClient,
} from "@/features/accounting/server/export-readers";

const SUMMARY_HEADERS = [
  "report_type", "generated_at", "period_start", "period_end", "timezone", "location_scope",
  "currency", "order_count", "sales_net", "payment_count", "collected_gross", "refund_count",
  "refunds", "collected_net", "cash_collected", "card_collected", "bank_transfer_collected",
  "other_collected", "online_collected", "posted_expense_count", "posted_expenses",
  "operational_result", "sales_date_basis", "payments_date_basis", "expenses_date_basis",
  "daily_close_date_basis",
];

async function* summaryRows(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  endDate: string,
  timezone: string,
  locationId: string | null,
): AsyncGenerator<unknown[]> {
  const totals = new Map<string, AccountantCurrencyTotals>();
  for await (const page of accountingSalesPages(supabase, period, timezone, locationId)) {
    const paymentIds = page.filter((event) => event.event_type === "payment").map((event) => event.event_id);
    const channels = new Map<string, string>();
    if (paymentIds.length) {
      const { data, error } = await supabase.from("payments").select("id, channel")
        .eq("organization_id", organizationId).in("id", paymentIds)
        .returns<{ id: string; channel: string }[]>();
      if (error || (data?.length ?? 0) !== paymentIds.length) {
        throw new Error(`accounting_summary_payment_channel_failed:${error?.code ?? "missing"}`);
      }
      for (const row of data ?? []) channels.set(row.id, row.channel);
    }
    for (const event of page) {
      addAccountantSalesEvent(totals, event, channels.get(event.event_id));
    }
  }

  for await (const page of accountingExpensePages(supabase, organizationId, period, locationId, true)) {
    for (const expense of page) {
      addAccountantPostedExpense(totals, expense);
    }
  }

  const generatedAt = new Date().toISOString();
  for (const [currency, total] of [...totals].sort(([left], [right]) => left.localeCompare(right))) {
    yield [
      "accounting_support_non_fiscal", generatedAt, period.startDate, endDate, timezone,
      locationId ?? "all", currency, total.orderCount, (total.salesNet / 100).toFixed(2),
      total.paymentCount, (total.collectedGross / 100).toFixed(2), total.refundCount,
      (total.refunds / 100).toFixed(2), ((total.collectedGross - total.refunds) / 100).toFixed(2),
      (total.cashCollected / 100).toFixed(2), (total.cardCollected / 100).toFixed(2),
      (total.bankTransferCollected / 100).toFixed(2), (total.otherCollected / 100).toFixed(2),
      (total.onlineCollected / 100).toFixed(2), total.postedExpenseCount,
      (total.postedExpenses / 100).toFixed(2), ((total.salesNet - total.postedExpenses) / 100).toFixed(2),
      "orders.created_at", "payments.paid_at", "expenses.expense_date", "daily_closes.business_date",
    ];
  }
}

export async function* accountingSummaryCsvChunks(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  endDate: string,
  timezone: string,
  locationId: string | null,
): AsyncGenerator<string> {
  yield* csvChunks(SUMMARY_HEADERS, summaryRows(supabase, organizationId, period, endDate, timezone, locationId));
}
