import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DailyCloseData,
  DailyCloseGroupKey,
  DailyCloseItem,
} from "@/features/daily-close/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus, PaymentRecordStatus } from "@/features/payments/types";

type OrderRow = {
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  completed_at: string | null;
  currency: string;
  customer: { display_name: string } | { display_name: string }[] | null;
  due_at: string | null;
  id: string;
  is_active: boolean;
  order_number: string;
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
  total: number;
};

type PaymentRow = {
  amount: number;
  order_id: string;
  status: PaymentRecordStatus;
};

type LogisticsOrderRelation = {
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  order_number: string;
  property: { name: string } | { name: string }[] | null;
};

type LogisticsRow = {
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  completed_at: string | null;
  id: string;
  order: LogisticsOrderRelation | LogisticsOrderRelation[] | null;
  scheduled_at: string | null;
  status: FulfillmentStatus;
};

const DEFAULT_ORGANIZATION_TIME_ZONE = "Atlantic/Canary";
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

function relationName(value: { display_name?: string; name?: string } | { display_name?: string; name?: string }[] | null) {
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

function todayWindow(timeZone: string) {
  const resolvedTimeZone = safeTimeZone(timeZone);
  const now = new Date();
  const today = zonedParts(now, resolvedTimeZone);
  const tomorrow = tomorrowParts(today.year, today.month, today.day);
  const start = zonedLocalDateTimeToUtc(resolvedTimeZone, today.year, today.month, today.day);
  const end = new Date(
    zonedLocalDateTimeToUtc(resolvedTimeZone, tomorrow.year, tomorrow.month, tomorrow.day).getTime() - 1,
  );

  return { end, now, start, timeZone: resolvedTimeZone };
}

function moneyString(amount: number) {
  return (Math.round(amount * 100) / 100).toFixed(2);
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

  return { balanceDue, paymentStatus };
}

function isOpen(order: OrderRow) {
  return order.is_active && OPEN_STATUSES.includes(order.production_status);
}

function isLateOrder(order: OrderRow, now: Date) {
  return isOpen(order) && Boolean(order.due_at) && new Date(order.due_at as string) < now;
}

function orderItem(order: OrderRow, timestamp: string | null, isLate: boolean): DailyCloseItem {
  return {
    assignedToName: relationName(order.assigned_to_profile),
    customerName: relationName(order.customer) ?? "",
    id: order.id,
    isLate,
    kind: "order",
    missingAmount: null,
    orderId: order.id,
    orderNumber: order.order_number,
    paymentStatus: null,
    propertyName: relationName(order.property),
    status: order.production_status,
    timestamp,
  };
}

function paymentItem(order: OrderRow, payments: PaymentRow[]): DailyCloseItem | null {
  const totals = paymentTotals(order, payments);

  if (totals.balanceDue <= 0 || order.production_status === "cancelled") return null;

  return {
    ...orderItem(order, order.due_at, false),
    kind: "payment",
    missingAmount: `${moneyString(totals.balanceDue)} ${order.currency}`,
    paymentStatus: totals.paymentStatus,
  };
}

function logisticsItem(row: LogisticsRow, kind: "pickup" | "delivery", now: Date): DailyCloseItem | null {
  const order = relationOne(row.order);

  if (!order) return null;

  return {
    assignedToName: relationName(row.assigned_to_profile),
    customerName: relationName(order.customer) ?? "",
    id: row.id,
    isLate: row.status === "scheduled" && Boolean(row.scheduled_at) && new Date(row.scheduled_at as string) < now,
    kind,
    missingAmount: null,
    orderId: order.id,
    orderNumber: order.order_number,
    paymentStatus: null,
    propertyName: relationName(order.property),
    status: row.status,
    timestamp: row.scheduled_at ?? row.completed_at,
  };
}

function sortByAttention(a: DailyCloseItem, b: DailyCloseItem) {
  if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

  return aTime - bTime;
}

function summary(groups: Record<DailyCloseGroupKey, DailyCloseItem[]>) {
  return {
    anomalies: groups.anomalies.length,
    completedToday: groups.completedToday.length,
    incompleteDeliveries: groups.incompleteDeliveries.length,
    incompletePickups: groups.incompletePickups.length,
    lateOrders: groups.lateOrders.length,
    onHoldOrders: groups.onHoldOrders.length,
    openOrders: groups.openOrders.length,
    paymentIssues: groups.paymentIssues.length,
  };
}

export async function getDailyCloseData(locale: string): Promise<DailyCloseData> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { end, now, start, timeZone } = todayWindow(membership.organization.timezone);
  const [ordersResult, paymentsResult, pickupsResult, deliveriesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, production_status, due_at, completed_at, total, currency, is_active, customer:customers!orders_customer_same_organization!inner(display_name), property:properties!orders_property_same_customer(name), assigned_to_profile:profiles!orders_assigned_to_fkey(display_name)")
      .eq("organization_id", membership.organization.id)
      .neq("production_status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(300)
      .returns<OrderRow[]>(),
    supabase
      .from("payments")
      .select("order_id, amount, status")
      .eq("organization_id", membership.organization.id)
      .limit(900)
      .returns<PaymentRow[]>(),
    supabase
      .from("pickups")
      .select("id, status, scheduled_at, completed_at, assigned_to_profile:profiles!pickups_assigned_to_fkey(display_name), order:orders!pickups_order_same_org!inner(id, order_number, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(150)
      .returns<LogisticsRow[]>(),
    supabase
      .from("deliveries")
      .select("id, status, scheduled_at, completed_at, assigned_to_profile:profiles!deliveries_assigned_to_fkey(display_name), order:orders!deliveries_order_same_org!inner(id, order_number, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(150)
      .returns<LogisticsRow[]>(),
  ]);

  if (ordersResult.error) console.error("Daily close orders query failed", ordersResult.error.code);
  if (paymentsResult.error) console.error("Daily close payments query failed", paymentsResult.error.code);
  if (pickupsResult.error) console.error("Daily close pickups query failed", pickupsResult.error.code);
  if (deliveriesResult.error) console.error("Daily close deliveries query failed", deliveriesResult.error.code);

  const orders = ordersResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const openOrders = orders.filter(isOpen);
  const completedToday = orders
    .filter((order) => order.production_status === "completed" && order.completed_at)
    .filter((order) => {
      const completedAt = new Date(order.completed_at as string);

      return completedAt >= start && completedAt <= end;
    })
    .map((order) => orderItem(order, order.completed_at, false))
    .sort(sortByAttention);
  const lateOrders = openOrders
    .filter((order) => isLateOrder(order, now))
    .map((order) => orderItem(order, order.due_at, true))
    .sort(sortByAttention);
  const onHoldOrders = openOrders
    .filter((order) => order.production_status === "on_hold")
    .map((order) => orderItem(order, order.due_at, isLateOrder(order, now)))
    .sort(sortByAttention);
  const incompletePickups = (pickupsResult.data ?? [])
    .flatMap((row) => {
      const item = logisticsItem(row, "pickup", now);

      return item ? [item] : [];
    })
    .sort(sortByAttention);
  const incompleteDeliveries = (deliveriesResult.data ?? [])
    .flatMap((row) => {
      const item = logisticsItem(row, "delivery", now);

      return item ? [item] : [];
    })
    .sort(sortByAttention);
  const paymentIssues = orders
    .flatMap((order) => {
      const item = paymentItem(order, payments);

      return item ? [item] : [];
    })
    .sort(sortByAttention);
  const anomalyMap = new Map<string, DailyCloseItem>();

  for (const item of [...lateOrders, ...onHoldOrders, ...incompletePickups, ...incompleteDeliveries, ...paymentIssues]) {
    if (item.isLate || item.status === "on_hold" || item.kind === "payment") {
      anomalyMap.set(`${item.kind}-${item.id}`, { ...item, kind: "anomaly" });
    }
  }

  const groups = {
    anomalies: Array.from(anomalyMap.values()).sort(sortByAttention),
    completedToday,
    incompleteDeliveries,
    incompletePickups,
    lateOrders,
    onHoldOrders,
    openOrders: openOrders.map((order) => orderItem(order, order.due_at, isLateOrder(order, now))).sort(sortByAttention),
    paymentIssues,
  };

  return {
    groups,
    summary: summary(groups),
    timeZone,
  };
}
