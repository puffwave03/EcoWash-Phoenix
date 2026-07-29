import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DashboardActivityItem,
  DashboardBalanceItem,
  DashboardFinancialSummary,
  DashboardLogisticsItem,
  DashboardOrderQueueItem,
  DashboardOverview,
  CurrencyAmount,
} from "@/features/dashboard/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus, PaymentRecordStatus } from "@/features/payments/types";

type OrderRow = {
  created_at: string;
  currency: string;
  customer: { display_name: string } | { display_name: string }[] | null;
  due_at: string | null;
  id: string;
  is_active: boolean;
  on_hold_reason: string | null;
  order_number: string;
  priority: "normal" | "express";
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
  total: number;
};

type PaymentRow = {
  amount: number;
  created_at: string;
  id: string;
  order_id: string;
  recorded_by_profile: { display_name: string } | { display_name: string }[] | null;
  status: PaymentRecordStatus;
};

type HistoryRow = {
  changed_at: string;
  changed_by_profile: { display_name: string } | { display_name: string }[] | null;
  id: string;
  order: { order_number: string } | { order_number: string }[] | null;
  order_id: string;
  reason: string | null;
  to_status: ProductionStatus;
};

type LogisticsRow = {
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  city: string | null;
  completed_at: string | null;
  id: string;
  order: { customer: { display_name: string } | { display_name: string }[] | null; order_number: string } | { customer: { display_name: string } | { display_name: string }[] | null; order_number: string }[] | null;
  order_id: string;
  scheduled_at: string | null;
  status: FulfillmentStatus;
};

type PhotoRow = {
  created_at: string;
  id: string;
  order: { order_number: string } | { order_number: string }[] | null;
  order_id: string;
  uploaded_by_profile: { display_name: string } | { display_name: string }[] | null;
};

const OPEN_STATUSES: ProductionStatus[] = [
  "draft",
  "received",
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
  "ready",
  "on_hold",
];

const DEFAULT_ORGANIZATION_TIME_ZONE = "Atlantic/Canary";

type ZonedDateParts = {
  day: number;
  month: number;
  year: number;
};

type ZonedDateTimeParts = ZonedDateParts & {
  hour: number;
  minute: number;
  second: number;
};

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayName(value: { display_name?: string; name?: string } | { display_name?: string; name?: string }[] | null) {
  const row = relationOne(value);
  return row?.display_name ?? row?.name ?? null;
}

function numericDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  const part = parts.find((item) => item.type === type);
  const value = part ? Number(part.value) : NaN;

  if (!Number.isFinite(value)) {
    throw new Error(`Missing timezone date part: ${type}`);
  }

  return value;
}

function zonedParts(value: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(value);

  return {
    day: numericDateTimePart(parts, "day"),
    hour: numericDateTimePart(parts, "hour"),
    minute: numericDateTimePart(parts, "minute"),
    month: numericDateTimePart(parts, "month"),
    second: numericDateTimePart(parts, "second"),
    year: numericDateTimePart(parts, "year"),
  };
}

function timeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - value.getTime();
}

function zonedLocalDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
) {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const firstPass = new Date(utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone));

  return new Date(utcGuess - timeZoneOffsetMs(firstPass, timeZone));
}

function tomorrowParts(year: number, month: number, day: number): ZonedDateParts {
  const next = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

  return {
    day: next.getUTCDate(),
    month: next.getUTCMonth() + 1,
    year: next.getUTCFullYear(),
  };
}

function safeTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_ORGANIZATION_TIME_ZONE;
  }
}

function nowWindow(timeZone: string) {
  const resolvedTimeZone = safeTimeZone(timeZone);
  const now = new Date();
  const today = zonedParts(now, resolvedTimeZone);
  const tomorrow = tomorrowParts(today.year, today.month, today.day);
  const start = zonedLocalDateTimeToUtc(resolvedTimeZone, today.year, today.month, today.day);
  const end = new Date(
    zonedLocalDateTimeToUtc(resolvedTimeZone, tomorrow.year, tomorrow.month, tomorrow.day).getTime() - 1,
  );

  return { end, now, start };
}

function isOpen(order: OrderRow) {
  return order.is_active && OPEN_STATUSES.includes(order.production_status);
}

function isLate(order: OrderRow, now: Date) {
  return isOpen(order) && Boolean(order.due_at) && new Date(order.due_at as string) < now;
}

function paymentTotals(order: OrderRow, payments: PaymentRow[]) {
  let confirmed = 0;
  let refunded = 0;
  let voidCount = 0;

  for (const payment of payments) {
    if (payment.order_id !== order.id) continue;
    if (payment.status === "confirmed") confirmed += payment.amount;
    if (payment.status === "refunded") refunded += payment.amount;
    if (payment.status === "void") voidCount += 1;
  }

  const totalPaid = Math.round((confirmed - refunded) * 100) / 100;
  const balanceDue = Math.round(Math.max(order.total - totalPaid, 0) * 100) / 100;
  let paymentStatus: DerivedPaymentStatus = "unpaid";

  if (order.total <= 0) paymentStatus = "paid";
  else if (totalPaid <= 0 && refunded > 0) paymentStatus = "refunded";
  else if (totalPaid <= 0 && confirmed === 0 && voidCount > 0) paymentStatus = "void";
  else if (totalPaid <= 0) paymentStatus = "unpaid";
  else if (totalPaid < order.total) paymentStatus = "partially_paid";
  else paymentStatus = "paid";

  return { balanceDue, paymentStatus, totalPaid };
}

function moneyString(amount: number) {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

function orderQueueItem(order: OrderRow, payments: PaymentRow[], now: Date, readyAt: string | null): DashboardOrderQueueItem {
  const totals = paymentTotals(order, payments);

  return {
    balanceDue: moneyString(totals.balanceDue),
    currency: order.currency,
    customerName: displayName(order.customer) ?? "",
    dueAt: order.due_at,
    id: order.id,
    isLate: isLate(order, now),
    orderNumber: order.order_number,
    priority: order.priority,
    productionStatus: order.production_status,
    propertyName: displayName(order.property),
    readyAt,
    total: moneyString(order.total),
  };
}

function orderNumber(value: { order_number: string } | { order_number: string }[] | null) {
  return relationOne(value)?.order_number ?? "";
}

function logisticsItem(row: LogisticsRow, kind: "pickup" | "delivery"): DashboardLogisticsItem {
  const order = relationOne(row.order);
  return {
    assignedToName: displayName(row.assigned_to_profile),
    city: row.city,
    customerName: displayName(order?.customer ?? null) ?? "",
    id: row.id,
    kind,
    orderId: row.order_id,
    orderNumber: order?.order_number ?? "",
    scheduledAt: row.scheduled_at,
    status: row.status,
  };
}

function sortOperational(a: DashboardOrderQueueItem, b: DashboardOrderQueueItem) {
  if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
  if (a.priority !== b.priority) return a.priority === "express" ? -1 : 1;
  const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  return aDue - bDue;
}

function groupBalanceDueByCurrency(balances: DashboardBalanceItem[]): CurrencyAmount[] {
  const totals = new Map<string, number>();

  for (const item of balances) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + Number(item.balanceDue));
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ amount: moneyString(amount), currency }));
}

function canViewFinancialAggregates(role: string) {
  return role === "owner" || role === "manager";
}

export async function getDashboardOverview(locale: string): Promise<DashboardOverview> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { end, now, start } = nowWindow(membership.organization.timezone);
  const includeFinancialAggregates = canViewFinancialAggregates(membership.role);
  const paymentsTodayQuery = includeFinancialAggregates
    ? supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organization.id)
      .eq("status", "confirmed")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
    : Promise.resolve({ count: 0, error: null });

  const [
    ordersResult,
    paymentsResult,
    historyResult,
    paymentsTodayResult,
    pickupsTodayResult,
    deliveriesTodayResult,
    latePickupsResult,
    lateDeliveriesResult,
    completedPickupsResult,
    completedDeliveriesResult,
    photosResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, production_status, priority, due_at, total, currency, created_at, is_active, on_hold_reason, customer:customers(display_name), property:properties(name)")
      .eq("organization_id", membership.organization.id)
      .neq("production_status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<OrderRow[]>(),
    supabase
      .from("payments")
      .select("id, order_id, amount, status, created_at, recorded_by_profile:profiles!payments_recorded_by_fkey(display_name)")
      .eq("organization_id", membership.organization.id)
      .order("created_at", { ascending: false })
      .limit(600)
      .returns<PaymentRow[]>(),
    supabase
      .from("order_status_history")
      .select("id, order_id, to_status, reason, changed_at, order:orders(order_number), changed_by_profile:profiles(display_name)")
      .eq("organization_id", membership.organization.id)
      .order("changed_at", { ascending: false })
      .limit(80)
      .returns<HistoryRow[]>(),
    paymentsTodayQuery,
    supabase
      .from("pickups")
      .select("id, order_id, status, scheduled_at, completed_at, city, order:orders(order_number, customer:customers(display_name)), assigned_to_profile:profiles(display_name)")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(12)
      .returns<LogisticsRow[]>(),
    supabase
      .from("deliveries")
      .select("id, order_id, status, scheduled_at, completed_at, city, order:orders(order_number, customer:customers(display_name)), assigned_to_profile:profiles(display_name)")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(12)
      .returns<LogisticsRow[]>(),
    supabase
      .from("pickups")
      .select("id, order_id, status, scheduled_at, completed_at, city, order:orders(order_number, customer:customers(display_name)), assigned_to_profile:profiles(display_name)")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .lt("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(8)
      .returns<LogisticsRow[]>(),
    supabase
      .from("deliveries")
      .select("id, order_id, status, scheduled_at, completed_at, city, order:orders(order_number, customer:customers(display_name)), assigned_to_profile:profiles(display_name)")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .lt("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(8)
      .returns<LogisticsRow[]>(),
    supabase
      .from("pickups")
      .select("id, order_id, status, scheduled_at, completed_at, city, order:orders(order_number, customer:customers(display_name)), assigned_to_profile:profiles(display_name)")
      .eq("organization_id", membership.organization.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10)
      .returns<LogisticsRow[]>(),
    supabase
      .from("deliveries")
      .select("id, order_id, status, scheduled_at, completed_at, city, order:orders(order_number, customer:customers(display_name)), assigned_to_profile:profiles(display_name)")
      .eq("organization_id", membership.organization.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10)
      .returns<LogisticsRow[]>(),
    supabase
      .from("order_photos")
      .select("id, order_id, created_at, order:orders(order_number), uploaded_by_profile:profiles!order_photos_uploaded_by_fkey(display_name)")
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<PhotoRow[]>(),
  ]);

  if (ordersResult.error) console.error("Dashboard orders query failed", ordersResult.error.code);
  if (paymentsResult.error) console.error("Dashboard payments query failed", paymentsResult.error.code);
  if (historyResult.error) console.error("Dashboard history query failed", historyResult.error.code);
  if (paymentsTodayResult.error) console.error("Dashboard payments today query failed", paymentsTodayResult.error.code);

  const orders = ordersResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const history = historyResult.data ?? [];
  const readyByOrder = new Map(history.filter((row) => row.to_status === "ready").map((row) => [row.order_id, row.changed_at]));
  const holdByOrder = new Map(history.filter((row) => row.to_status === "on_hold").map((row) => [row.order_id, row.changed_at]));
  const openOrders = orders.filter(isOpen);
  const balances: DashboardBalanceItem[] = orders
    .filter((order) => order.production_status !== "cancelled")
    .map((order) => ({ order, totals: paymentTotals(order, payments) }))
    .filter(({ totals }) => totals.balanceDue > 0)
    .map(({ order, totals }) => ({
      balanceDue: moneyString(totals.balanceDue),
      currency: order.currency,
      customerName: displayName(order.customer) ?? "",
      dueAt: order.due_at,
      id: order.id,
      orderNumber: order.order_number,
      paymentStatus: totals.paymentStatus,
      productionStatus: order.production_status,
      total: moneyString(order.total),
      totalPaid: moneyString(totals.totalPaid),
    }))
    .sort((a, b) => {
      const aReady = a.productionStatus === "ready" || a.productionStatus === "completed";
      const bReady = b.productionStatus === "ready" || b.productionStatus === "completed";
      if (aReady !== bReady) return aReady ? -1 : 1;
      const aLate = a.dueAt ? new Date(a.dueAt) < now : false;
      const bLate = b.dueAt ? new Date(b.dueAt) < now : false;
      if (aLate !== bLate) return aLate ? -1 : 1;
      return Number(b.balanceDue) - Number(a.balanceDue);
    })
    .slice(0, 8);

  const productionQueue = openOrders
    .map((order) => orderQueueItem(order, payments, now, readyByOrder.get(order.id) ?? null))
    .sort(sortOperational)
    .slice(0, 10);

  const readyQueue = orders
    .filter((order) => order.production_status === "ready")
    .map((order) => orderQueueItem(order, payments, now, readyByOrder.get(order.id) ?? null))
    .sort((a, b) => new Date(a.readyAt ?? a.dueAt ?? 0).getTime() - new Date(b.readyAt ?? b.dueAt ?? 0).getTime())
    .slice(0, 8);

  const onHoldQueue = orders
    .filter((order) => order.production_status === "on_hold")
    .map((order) => ({
      customerName: displayName(order.customer) ?? "",
      holdAt: holdByOrder.get(order.id) ?? null,
      id: order.id,
      orderNumber: order.order_number,
      reason: order.on_hold_reason,
    }))
    .slice(0, 8);

  const activity: DashboardActivityItem[] = [
    ...history.slice(0, 15).map((row) => ({
      actorName: displayName(row.changed_by_profile),
      descriptionKey: "status" as const,
      id: `status-${row.id}`,
      orderId: row.order_id,
      orderNumber: orderNumber(row.order),
      timestamp: row.changed_at,
    })),
    ...(includeFinancialAggregates ? payments.slice(0, 15).map((payment) => ({
      actorName: displayName(payment.recorded_by_profile),
      descriptionKey: "payment" as const,
      id: `payment-${payment.id}`,
      orderId: payment.order_id,
      orderNumber: orders.find((order) => order.id === payment.order_id)?.order_number ?? "",
      timestamp: payment.created_at,
    })) : []),
    ...(completedPickupsResult.data ?? []).map((row) => ({
      actorName: displayName(row.assigned_to_profile),
      descriptionKey: "pickup" as const,
      id: `pickup-${row.id}`,
      orderId: row.order_id,
      orderNumber: relationOne(row.order)?.order_number ?? "",
      timestamp: row.completed_at ?? row.scheduled_at ?? "",
    })),
    ...(completedDeliveriesResult.data ?? []).map((row) => ({
      actorName: displayName(row.assigned_to_profile),
      descriptionKey: "delivery" as const,
      id: `delivery-${row.id}`,
      orderId: row.order_id,
      orderNumber: relationOne(row.order)?.order_number ?? "",
      timestamp: row.completed_at ?? row.scheduled_at ?? "",
    })),
    ...(photosResult.data ?? []).slice(0, 10).map((photo) => ({
      actorName: displayName(photo.uploaded_by_profile),
      descriptionKey: "photo" as const,
      id: `photo-${photo.id}`,
      orderId: photo.order_id,
      orderNumber: orderNumber(photo.order),
      timestamp: photo.created_at,
    })),
  ]
    .filter((event) => Boolean(event.timestamp))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);

  const financialSummary: DashboardFinancialSummary | null = includeFinancialAggregates
    ? {
      partiallyPaidOrders: balances.filter((item) => item.paymentStatus === "partially_paid").length,
      paymentsToday: paymentsTodayResult.count ?? 0,
      recentCorrections: payments.filter((payment) => payment.status === "void" || payment.status === "refunded").slice(0, 20).length,
      unpaidOrders: balances.filter((item) => item.paymentStatus === "unpaid").length,
    }
    : null;

  return {
    activity,
    financialSummary,
    logisticsAttention: [
      ...(latePickupsResult.data ?? []).map((row) => logisticsItem(row, "pickup")),
      ...(lateDeliveriesResult.data ?? []).map((row) => logisticsItem(row, "delivery")),
    ].slice(0, 8),
    paymentBalances: balances,
    productionQueue,
    readyQueue,
    summary: {
      balanceDueTotals: includeFinancialAggregates ? groupBalanceDueByCurrency(balances) : null,
      expressOpenOrders: openOrders.filter((order) => order.priority === "express").length,
      lateOpenOrders: openOrders.filter((order) => isLate(order, now)).length,
      onHoldOrders: openOrders.filter((order) => order.production_status === "on_hold").length,
      openOrders: openOrders.length,
      readyOrders: openOrders.filter((order) => order.production_status === "ready").length,
    },
    todayDeliveries: (deliveriesTodayResult.data ?? []).map((row) => logisticsItem(row, "delivery")),
    todayPickups: (pickupsTodayResult.data ?? []).map((row) => logisticsItem(row, "pickup")),
    onHoldQueue,
  };
}
