import "server-only";

import type { AccountingPeriod } from "@/features/accounting/summary";
import { csvChunks, type SupabaseServerClient } from "@/features/accounting/server/export-readers";

const PAGE_SIZE = 250;
const HEADERS = [
  "report_type", "business_date", "scope_type", "location_id", "location_name", "closed_at", "closed_by",
  "tenant_timezone", "snapshot_schema_version", "calculation_version", "snapshot_hash",
  "orders_created", "production_completed", "final_fulfillment_completed",
  "pos_currency", "pos_session_count", "pos_opening_cash", "pos_expected_cash",
  "pos_counted_cash", "pos_variance", "warning_count", "blocker_count", "currency_metrics_json",
];
const PAYMENT_KEYS = [
  "orderCount", "salesGross", "salesNet", "discountTotal", "outstanding",
  "outstandingOrderCount", "confirmedPaymentCount", "collectedGross", "refunds",
  "collectedNet", "cashCollected", "cardCollected", "bankTransferCollected",
  "otherCollected", "onlineCollected",
] as const;

type CloseRow = {
  business_date: string;
  calculation_version: string;
  closed_at: string;
  closed_by: string;
  id: string;
  location: { name: string } | { name: string }[] | null;
  location_id: string | null;
  snapshot: unknown;
  snapshot_hash: string;
  snapshot_schema_version: number;
  tenant_timezone: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function metric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function issueCount(value: unknown) {
  return Array.isArray(value) ? value.length : "";
}

function currencyMetrics(value: unknown) {
  if (!Array.isArray(value)) return "";
  const result: Record<string, number | string>[] = [];
  for (const item of value) {
    const source = record(item);
    if (typeof source?.currency !== "string" || !source.currency) return "";
    const metrics: Record<string, number | string> = { currency: source.currency };
    for (const key of PAYMENT_KEYS) {
      const number = metric(source[key]);
      if (number === "") return "";
      metrics[key] = number;
    }
    result.push(metrics);
  }
  return JSON.stringify(result.sort((left, right) => String(left.currency).localeCompare(String(right.currency))));
}

function registerRow(close: CloseRow): unknown[] {
  const snapshot = record(close.snapshot);
  const orders = record(snapshot?.orders);
  const fulfillment = record(snapshot?.finalFulfillment);
  const pos = record(snapshot?.pos);
  const location = Array.isArray(close.location) ? close.location[0] : close.location;
  return [
    "operational_daily_close_non_fiscal", close.business_date, close.location_id ? "location" : "organization",
    close.location_id ?? "", location?.name ?? "", close.closed_at, close.closed_by,
    close.tenant_timezone, close.snapshot_schema_version, close.calculation_version, close.snapshot_hash,
    metric(orders?.created), metric(orders?.productionCompleted), metric(fulfillment?.completedOrderCount),
    typeof pos?.currency === "string" ? pos.currency : "", metric(pos?.sessionCount),
    metric(pos?.openingCash), metric(pos?.expectedCash), metric(pos?.countedCash), metric(pos?.variance),
    issueCount(snapshot?.warnings), issueCount(snapshot?.blockers), currencyMetrics(snapshot?.payments),
  ];
}

async function* registerRows(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  locationId: string | null,
): AsyncGenerator<unknown[]> {
  let cursor: { businessDate: string; closedAt: string; id: string } | null = null;
  for (;;) {
    let query = supabase.from("daily_closes")
      .select("id, business_date, location_id, closed_at, closed_by, tenant_timezone, snapshot_schema_version, calculation_version, snapshot_hash, snapshot, location:locations!daily_closes_location_same_org(name)")
      .eq("organization_id", organizationId)
      .gte("business_date", period.startDate)
      .lt("business_date", period.endDateExclusive)
      .order("business_date", { ascending: true })
      .order("closed_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (locationId) query = query.eq("location_id", locationId);
    if (cursor) query = query.or(
      `business_date.gt.${cursor.businessDate},and(business_date.eq.${cursor.businessDate},closed_at.gt.${cursor.closedAt}),and(business_date.eq.${cursor.businessDate},closed_at.eq.${cursor.closedAt},id.gt.${cursor.id})`,
    );
    const { data, error } = await query.returns<CloseRow[]>();
    if (error) throw new Error(`daily_close_register_failed:${error.code}`);
    const rows = data ?? [];
    for (const close of rows) yield registerRow(close);
    if (rows.length < PAGE_SIZE) return;
    const last = rows[rows.length - 1];
    cursor = { businessDate: last.business_date, closedAt: last.closed_at, id: last.id };
  }
}

export async function* dailyCloseRegisterCsvChunks(
  supabase: SupabaseServerClient,
  organizationId: string,
  period: AccountingPeriod,
  locationId: string | null,
  metrics?: { rowCount: number },
): AsyncGenerator<string> {
  yield* csvChunks(HEADERS, registerRows(supabase, organizationId, period, locationId), metrics);
}
