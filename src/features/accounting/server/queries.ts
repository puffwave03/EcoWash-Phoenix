import "server-only";

import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  accountingPeriodBounds,
  buildAccountingSummary,
  type AccountingOrderFact,
  type AccountingPaymentFact,
  type AccountingPeriod,
  type AccountingPosSessionFact,
  type AccountingSummary,
} from "@/features/accounting/summary";

type DbError = { code?: string; message?: string };
type PageResult<T> = PromiseLike<{ data: T[] | null; error: DbError | null }>;

type OrderRow = {
  created_at: string;
  currency: string;
  id: string;
  location_id: string | null;
  subtotal: number;
  total: number;
};

type PaymentRow = {
  amount: number;
  channel: AccountingPaymentFact["channel"];
  id: string;
  method: AccountingPaymentFact["method"];
  order_id: string;
  order: { currency: string; location_id: string | null } | { currency: string; location_id: string | null }[] | null;
  paid_at: string;
  pos_session_id: string | null;
  status: AccountingPaymentFact["status"];
};

type PosSessionRow = {
  counted_cash: number | null;
  difference: number | null;
  expected_cash: number | null;
  id: string;
  location_id: string | null;
  opened_at: string;
  opening_cash: number;
  status: AccountingPosSessionFact["status"];
};

export type AccountingSummaryFilter = {
  locationId?: string | null;
  paymentPeriod: AccountingPeriod;
  salesPeriod: AccountingPeriod;
};

async function pages<T>(query: (from: number, to: number) => PageResult<T>) {
  const result: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await query(from, from + size - 1);
    if (error) throw new Error(`accounting_query_failed:${error.code ?? "unknown"}`);
    const rows = data ?? [];
    result.push(...rows);
    if (rows.length < size) return result;
  }
}

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function paymentFact(row: PaymentRow): AccountingPaymentFact {
  const order = relation(row.order);
  if (!order) throw new Error("accounting_payment_order_missing");
  return {
    amount: Number(row.amount),
    channel: row.channel,
    currency: order.currency,
    id: row.id,
    locationId: order.location_id,
    method: row.method,
    orderId: row.order_id,
    paidAt: row.paid_at,
    posSessionId: row.pos_session_id,
    status: row.status,
  };
}

export async function getAccountingSummary(locale: string, filter: AccountingSummaryFilter): Promise<AccountingSummary> {
  const { membership } = await requireOwnerOrManager(locale);
  const organizationId = membership.organization.id;
  const timezone = membership.organization.timezone;
  const locationId = filter.locationId ?? null;
  const salesBounds = accountingPeriodBounds(filter.salesPeriod, timezone);
  const paymentBounds = accountingPeriodBounds(filter.paymentPeriod, timezone);
  const supabase = await createSupabaseServerClient();

  const { data: organization, error: organizationError } = await supabase.from("organizations")
    .select("default_currency").eq("id", organizationId).single<{ default_currency: string }>();
  if (organizationError || !organization) throw new Error("accounting_organization_invalid");

  if (locationId) {
    const { data, error } = await supabase.from("locations").select("id")
      .eq("organization_id", organizationId).eq("id", locationId).eq("is_active", true).is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (error || !data) throw new Error("accounting_location_invalid");
  }

  const orderRows = await pages<OrderRow>((from, to) => {
    let query = supabase.from("orders").select("id, location_id, subtotal, total, currency, created_at")
      .eq("organization_id", organizationId).eq("is_active", true).neq("production_status", "cancelled")
      .gte("created_at", salesBounds.start).lt("created_at", salesBounds.end)
      .order("created_at").order("id").range(from, to);
    if (locationId) query = query.eq("location_id", locationId);
    return query;
  });
  const orderIds = orderRows.map((order) => order.id);
  const quickDropIds = new Set<string>();
  const itemCounts = new Map<string, number>();
  const receivablePayments: AccountingPaymentFact[] = [];
  for (const ids of chunks(orderIds)) {
    const [sources, items, payments] = await Promise.all([
      pages<{ order_id: string }>((from, to) => supabase.from("order_status_history").select("order_id")
        .eq("organization_id", organizationId).in("order_id", ids).contains("metadata", { source: "quick_drop" }).range(from, to)),
      pages<{ order_id: string }>((from, to) => supabase.from("order_items").select("order_id")
        .eq("organization_id", organizationId).in("order_id", ids).eq("is_active", true).range(from, to)),
      pages<PaymentRow>((from, to) => supabase.from("payments")
        .select("id, order_id, amount, method, status, paid_at, channel, pos_session_id, order:orders!payments_order_same_org!inner(currency, location_id)")
        .eq("organization_id", organizationId).in("order_id", ids).eq("status", "confirmed").range(from, to)),
    ]);
    for (const source of sources) quickDropIds.add(source.order_id);
    for (const item of items) itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + 1);
    receivablePayments.push(...payments.map(paymentFact));
  }

  const periodPaymentRows = await pages<PaymentRow>((from, to) => {
    let query = supabase.from("payments")
      .select("id, order_id, amount, method, status, paid_at, channel, pos_session_id, order:orders!payments_order_same_org!inner(currency, location_id, is_active, production_status)")
      .eq("organization_id", organizationId).gte("paid_at", paymentBounds.start).lt("paid_at", paymentBounds.end)
      .eq("order.is_active", true).neq("order.production_status", "cancelled")
      .order("paid_at").order("id").range(from, to);
    if (locationId) query = query.eq("order.location_id", locationId);
    return query;
  });

  const posRows = await pages<PosSessionRow>((from, to) => {
    let query = supabase.from("pos_sessions")
      .select("id, location_id, opened_at, opening_cash, status, expected_cash, counted_cash, difference")
      .eq("organization_id", organizationId).gte("opened_at", paymentBounds.start).lt("opened_at", paymentBounds.end)
      .order("opened_at").order("id").range(from, to);
    if (locationId) query = query.eq("location_id", locationId);
    return query;
  });
  const posPaymentRows: PaymentRow[] = [];
  for (const ids of chunks(posRows.map((session) => session.id))) {
    posPaymentRows.push(...await pages<PaymentRow>((from, to) => supabase.from("payments")
      .select("id, order_id, amount, method, status, paid_at, channel, pos_session_id, order:orders!payments_order_same_org!inner(currency, location_id)")
      .eq("organization_id", organizationId).in("pos_session_id", ids).range(from, to)));
  }

  const salesOrders: AccountingOrderFact[] = orderRows.map((order) => ({
    activeItemCount: itemCounts.get(order.id) ?? 0,
    createdAt: order.created_at,
    currency: order.currency,
    id: order.id,
    isQuickDrop: quickDropIds.has(order.id),
    locationId: order.location_id,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
  }));
  const defaultCurrency = organization.default_currency;
  const posSessions: AccountingPosSessionFact[] = posRows.map((session) => ({
    countedCash: session.counted_cash === null ? null : Number(session.counted_cash),
    currency: defaultCurrency,
    difference: session.difference === null ? null : Number(session.difference),
    expectedCash: session.expected_cash === null ? null : Number(session.expected_cash),
    id: session.id,
    locationId: session.location_id,
    openedAt: session.opened_at,
    openingCash: Number(session.opening_cash),
    status: session.status,
  }));

  return buildAccountingSummary({
    locationId,
    paymentPeriod: filter.paymentPeriod,
    periodPayments: periodPaymentRows.map(paymentFact),
    posSessionPayments: posPaymentRows.map(paymentFact),
    posSessions,
    receivableConfirmedPayments: receivablePayments,
    salesOrders,
    salesPeriod: filter.salesPeriod,
    timezone,
  });
}
