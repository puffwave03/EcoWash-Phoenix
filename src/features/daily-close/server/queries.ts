import "server-only";

import { buildReceivableBalances } from "@/features/accounting/summary";
import { getAccountingSummary } from "@/features/accounting/server/queries";
import { addLocalDays } from "@/features/accounting/workspace";
import type {
  DailyCloseData,
  DailyCloseGroupKey,
  DailyCloseItem,
  DailyCloseLocation,
  DailyCloseSource,
} from "@/features/daily-close/types";
import {
  attentionCutoff,
  isInBusinessDay,
  resolveDailyCloseBusinessDay,
} from "@/features/daily-close/preview";
import { isOperationalLogisticsParent } from "@/features/logistics/lifecycle";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  moneyString,
  relationName,
  relationOne,
  todayWindow,
} from "@/features/operations/server/helpers";

type DbError = { code?: string };
type PageResult<T> = PromiseLike<{ data: T[] | null; error: DbError | null }>;

type OrderRow = {
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  currency: string;
  customer: { display_name: string } | { display_name: string }[] | null;
  due_at: string | null;
  id: string;
  is_active: boolean;
  location_id: string | null;
  order_number: string;
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
  total: number;
};

type PaymentRow = {
  amount: number;
  order_id: string;
  status: "confirmed";
};

type PaymentLocationRow = {
  id: string;
  method: string;
  order: { location_id: string | null } | { location_id: string | null }[] | null;
  pos_session_id: string | null;
};

type CashWithoutSessionRow = {
  id: string;
  order: { location_id: string | null } | { location_id: string | null }[] | null;
};

type LogisticsOrderRelation = {
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  is_active: boolean;
  location_id: string | null;
  order_number: string;
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
};

type LogisticsRow = {
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  completed_at: string | null;
  id: string;
  order: LogisticsOrderRelation | LogisticsOrderRelation[] | null;
  order_id: string;
  scheduled_at: string | null;
  status: FulfillmentStatus;
};

type CustomerHandoffRow = {
  completed_at: string;
  id: string;
  location_id: string | null;
  order_id: string;
  order: Pick<LogisticsOrderRelation, "id" | "is_active" | "production_status"> | Pick<LogisticsOrderRelation, "id" | "is_active" | "production_status">[] | null;
};

type PosSessionRow = {
  closed_at: string | null;
  difference: number | null;
  id: string;
  location_id: string | null;
  opened_at: string;
  status: "closed" | "open";
};

type DailyCloseFilters = {
  businessDate?: string;
  locationId?: string;
};

const ORDER_SELECT = "id, order_number, production_status, due_at, completed_at, cancelled_at, created_at, total, currency, is_active, location_id, customer:customers!orders_customer_same_organization!inner(display_name), property:properties!orders_property_same_customer(name), assigned_to_profile:profiles!orders_assigned_to_fkey(display_name)";
const LOGISTICS_SELECT = "id, order_id, status, scheduled_at, completed_at, assigned_to_profile:profiles!pickups_assigned_to_fkey(display_name), order:orders!pickups_order_same_org!inner(id, order_number, production_status, is_active, location_id, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))";
const DELIVERY_SELECT = "id, order_id, status, scheduled_at, completed_at, assigned_to_profile:profiles!deliveries_assigned_to_fkey(display_name), order:orders!deliveries_order_same_org!inner(id, order_number, production_status, is_active, location_id, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))";

async function pages<T>(query: (from: number, to: number) => PageResult<T>) {
  const rows: T[] = [];
  const size = 1000;

  for (let from = 0; ; from += size) {
    const { data, error } = await query(from, from + size - 1);
    if (error) throw new Error(error.code ?? "daily_close_query_failed");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function inLocation(locationId: string | null, selectedLocationId: string | null) {
  return !selectedLocationId || locationId === selectedLocationId;
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

function logisticsItem(row: LogisticsRow, kind: "pickup" | "delivery", now: Date): DailyCloseItem | null {
  const order = relationOne(row.order);

  if (
    !order ||
    !isOperationalLogisticsParent({
      isActive: order.is_active,
      productionStatus: order.production_status,
    })
  ) {
    return null;
  }

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

function isDueForClose(row: LogisticsRow, end: Date) {
  if (row.status === "in_progress") return true;

  return Boolean(row.scheduled_at && new Date(row.scheduled_at) <= end);
}

function sortByAttention(a: DailyCloseItem, b: DailyCloseItem) {
  if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

  return aTime - bTime;
}

function emptyGroups(): Record<DailyCloseGroupKey, DailyCloseItem[]> {
  return {
    anomalies: [],
    completedToday: [],
    incompleteDeliveries: [],
    incompletePickups: [],
    lateOrders: [],
    onHoldOrders: [],
    openOrders: [],
    paymentIssues: [],
  };
}

export async function getDailyCloseData(locale: string, filters: DailyCloseFilters = {}): Promise<DailyCloseData> {
  const { membership } = await requireOwnerOrManager(locale);
  const organizationId = membership.organization.id;
  const timeZone = membership.organization.timezone;
  const currentWindow = todayWindow(membership.organization.timezone);
  const resolvedDay = resolveDailyCloseBusinessDay(filters.businessDate, timeZone);
  const day = resolvedDay.businessDate === resolvedDay.currentBusinessDate
    ? { ...resolvedDay, end: currentWindow.end, start: currentWindow.start }
    : resolvedDay;
  const endExclusive = new Date(day.end.getTime() + 1);
  const supabase = await createSupabaseServerClient();
  const failedSources: DailyCloseSource[] = [];

  let locations: DailyCloseLocation[] = [];
  try {
    locations = await pages<DailyCloseLocation>((from, to) => supabase.from("locations").select("id, name")
      .eq("organization_id", organizationId).eq("is_active", true).is("deleted_at", null)
      .order("name").order("id").range(from, to).returns<DailyCloseLocation[]>());
  } catch (error) {
    failedSources.push("locations");
    console.error("Daily close locations source failed", error instanceof Error ? error.message : "unknown");
  }
  const requestedLocationId = filters.locationId || null;
  const invalidLocation = Boolean(requestedLocationId && !locations.some((location) => location.id === requestedLocationId));
  const selectedLocationId = invalidLocation ? null : requestedLocationId;

  const period = { startDate: day.businessDate, endDateExclusive: addLocalDays(day.businessDate, 1) };

  const ordersPromise = (async () => {
    const [created, productionCompleted, cancelled, open] = await Promise.all([
      pages<OrderRow>((from, to) => supabase.from("orders").select(ORDER_SELECT)
        .eq("organization_id", organizationId).gte("created_at", day.start.toISOString()).lt("created_at", endExclusive.toISOString())
        .order("created_at").order("id").range(from, to).returns<OrderRow[]>()),
      pages<OrderRow>((from, to) => supabase.from("orders").select(ORDER_SELECT)
        .eq("organization_id", organizationId).gte("completed_at", day.start.toISOString()).lt("completed_at", endExclusive.toISOString())
        .order("completed_at").order("id").range(from, to).returns<OrderRow[]>()),
      pages<OrderRow>((from, to) => supabase.from("orders").select(ORDER_SELECT)
        .eq("organization_id", organizationId).gte("cancelled_at", day.start.toISOString()).lt("cancelled_at", endExclusive.toISOString())
        .order("cancelled_at").order("id").range(from, to).returns<OrderRow[]>()),
      pages<OrderRow>((from, to) => supabase.from("orders").select(ORDER_SELECT)
        .eq("organization_id", organizationId).eq("is_active", true)
        .in("production_status", ["draft", "received", "washing", "drying", "ironing", "quality_check", "packing", "ready", "on_hold"])
        .lt("created_at", endExclusive.toISOString()).order("created_at").order("id").range(from, to).returns<OrderRow[]>()),
    ]);
    const confirmedPayments: PaymentRow[] = [];
    for (const ids of chunks(created.map((order) => order.id))) {
      confirmedPayments.push(...await pages<PaymentRow>((from, to) => supabase.from("payments")
        .select("order_id, amount, status").eq("organization_id", organizationId)
        .in("order_id", ids).eq("status", "confirmed").order("paid_at").range(from, to).returns<PaymentRow[]>()));
    }
    return { cancelled, confirmedPayments, created, open, productionCompleted };
  })();

  const logisticsPromise = (async () => {
    const [openPickups, openDeliveries, completedPickups, completedDeliveries] = await Promise.all([
      pages<LogisticsRow>((from, to) => supabase.from("pickups").select(LOGISTICS_SELECT)
        .eq("organization_id", organizationId).in("status", ["scheduled", "in_progress"])
        .order("scheduled_at", { ascending: true, nullsFirst: false }).order("id").range(from, to).returns<LogisticsRow[]>()),
      pages<LogisticsRow>((from, to) => supabase.from("deliveries").select(DELIVERY_SELECT)
        .eq("organization_id", organizationId).in("status", ["scheduled", "in_progress"])
        .order("scheduled_at", { ascending: true, nullsFirst: false }).order("id").range(from, to).returns<LogisticsRow[]>()),
      pages<LogisticsRow>((from, to) => supabase.from("pickups").select(LOGISTICS_SELECT)
        .eq("organization_id", organizationId).eq("status", "completed")
        .gte("completed_at", day.start.toISOString()).lt("completed_at", endExclusive.toISOString())
        .order("completed_at").order("id").range(from, to).returns<LogisticsRow[]>()),
      pages<LogisticsRow>((from, to) => supabase.from("deliveries").select(DELIVERY_SELECT)
        .eq("organization_id", organizationId).eq("status", "completed")
        .gte("completed_at", day.start.toISOString()).lt("completed_at", endExclusive.toISOString())
        .order("completed_at").order("id").range(from, to).returns<LogisticsRow[]>()),
    ]);
    return { completedDeliveries, completedPickups, openDeliveries, openPickups };
  })();

  const accountingPromise = (async () => {
    const [summary, paymentLocations] = await Promise.all([
      getAccountingSummary(locale, {
        locationId: selectedLocationId,
        paymentPeriod: period,
        salesPeriod: period,
      }),
      pages<PaymentLocationRow>((from, to) => supabase.from("payments")
        .select("id, method, pos_session_id, order:orders!payments_order_same_org!inner(location_id)")
        .eq("organization_id", organizationId).in("status", ["confirmed", "refunded"])
        .gte("paid_at", day.start.toISOString()).lt("paid_at", endExclusive.toISOString())
        .order("paid_at").order("id").range(from, to).returns<PaymentLocationRow[]>()),
    ]);
    return { paymentLocations, summary };
  })();

  const posPromise = (async () => {
    const [sessions, lingeringOpen, cashWithoutSession] = await Promise.all([
      pages<PosSessionRow>((from, to) => supabase.from("pos_sessions")
        .select("id, location_id, opened_at, closed_at, status, difference").eq("organization_id", organizationId)
        .gte("opened_at", day.start.toISOString()).lt("opened_at", endExclusive.toISOString())
        .order("opened_at").order("id").range(from, to).returns<PosSessionRow[]>()),
      pages<PosSessionRow>((from, to) => supabase.from("pos_sessions")
        .select("id, location_id, opened_at, closed_at, status, difference").eq("organization_id", organizationId)
        .eq("status", "open").lt("opened_at", day.start.toISOString())
        .order("opened_at").order("id").range(from, to).returns<PosSessionRow[]>()),
      pages<CashWithoutSessionRow>((from, to) => supabase.from("payments")
        .select("id, order:orders!payments_order_same_org!inner(location_id)")
        .eq("organization_id", organizationId).eq("method", "cash").in("status", ["confirmed", "refunded"])
        .is("pos_session_id", null).gte("paid_at", day.start.toISOString()).lt("paid_at", endExclusive.toISOString())
        .order("paid_at").order("id").range(from, to).returns<CashWithoutSessionRow[]>()),
    ]);
    return { cashWithoutSession, lingeringOpen, sessions };
  })();

  const handoffsPromise = pages<CustomerHandoffRow>((from, to) => supabase
    .from("order_customer_handoffs")
    .select("id, order_id, location_id, completed_at, order:orders!order_customer_handoffs_order_same_org!inner(id, production_status, is_active)")
    .eq("organization_id", organizationId)
    .gte("completed_at", day.start.toISOString())
    .lt("completed_at", endExclusive.toISOString())
    .order("completed_at")
    .order("id")
    .range(from, to)
    .returns<CustomerHandoffRow[]>());

  const [ordersResult, logisticsResult, accountingResult, posResult, handoffsResult] = await Promise.allSettled([
    ordersPromise,
    logisticsPromise,
    accountingPromise,
    posPromise,
    handoffsPromise,
  ]);
  if (ordersResult.status === "rejected") failedSources.push("orders");
  if (logisticsResult.status === "rejected") failedSources.push("logistics");
  if (accountingResult.status === "rejected") failedSources.push("payments");
  if (posResult.status === "rejected") failedSources.push("pos");
  if (handoffsResult.status === "rejected") failedSources.push("handoffs");
  for (const result of [ordersResult, logisticsResult, accountingResult, posResult, handoffsResult]) {
    if (result.status === "rejected") console.error("Daily close canonical source failed", result.reason instanceof Error ? result.reason.message : "unknown");
  }

  const groups = emptyGroups();
  const cutoff = attentionCutoff(day);
  const end = day.end;
  let unassignedLocationFacts = 0;
  let cashVarianceSessions = 0;
  let nonSessionNonCashActivity = 0;
  let orderSummary: DailyCloseData["orders"] = null;
  let logisticsSummary: DailyCloseData["logistics"] = null;
  let paymentSummary: DailyCloseData["payments"] = null;
  let posReadiness: DailyCloseData["pos"] = null;

  if (ordersResult.status === "fulfilled") {
    const value = ordersResult.value;
    const created = value.created.filter((row) => inLocation(row.location_id, selectedLocationId));
    const productionCompleted = value.productionCompleted.filter((row) => inLocation(row.location_id, selectedLocationId));
    const cancelled = value.cancelled.filter((row) => inLocation(row.location_id, selectedLocationId));
    const open = value.open.filter((row) => inLocation(row.location_id, selectedLocationId));
    const late = open.filter((order) => Boolean(order.due_at) && new Date(order.due_at as string) < cutoff);
    const onHold = open.filter((order) => order.production_status === "on_hold");
    const unassignedOrderIds = new Set([...value.created, ...value.productionCompleted, ...value.cancelled, ...value.open]
      .filter((row) => row.location_id === null).map((row) => row.id));
    unassignedLocationFacts += unassignedOrderIds.size;

    groups.completedToday = productionCompleted.map((order) => orderItem(order, order.completed_at, false)).sort(sortByAttention);
    groups.openOrders = open.map((order) => orderItem(order, order.due_at, late.includes(order))).sort(sortByAttention);
    groups.lateOrders = late.map((order) => orderItem(order, order.due_at, true)).sort(sortByAttention);
    groups.onHoldOrders = onHold.map((order) => orderItem(order, order.due_at, late.includes(order))).sort(sortByAttention);
    orderSummary = {
      cancelled: cancelled.length,
      created: created.length,
      finalFulfillmentCompleted: null,
      late: late.length,
      onHold: onHold.length,
      open: open.length,
      productionCompleted: productionCompleted.length,
    };
  }

  if (logisticsResult.status === "fulfilled") {
    const value = logisticsResult.value;
    const allDuePickups = value.openPickups.filter((row) => isDueForClose(row, end));
    const allDueDeliveries = value.openDeliveries.filter((row) => isDueForClose(row, end));
    const duePickups = allDuePickups.filter((row) => inLocation(relationOne(row.order)?.location_id ?? null, selectedLocationId));
    const dueDeliveries = allDueDeliveries.filter((row) => inLocation(relationOne(row.order)?.location_id ?? null, selectedLocationId));
    groups.incompletePickups = duePickups.flatMap((row) => {
      const item = logisticsItem(row, "pickup", cutoff);
      return item ? [item] : [];
    }).sort(sortByAttention);
    groups.incompleteDeliveries = dueDeliveries.flatMap((row) => {
      const item = logisticsItem(row, "delivery", cutoff);
      return item ? [item] : [];
    }).sort(sortByAttention);
    const unassignedLogisticsIds = new Set([...allDuePickups, ...allDueDeliveries, ...value.completedPickups, ...value.completedDeliveries]
      .filter((row) => relationOne(row.order)?.location_id === null)
      .map((row) => row.id));
    unassignedLocationFacts += unassignedLogisticsIds.size;

    logisticsSummary = {
      deliveriesDueOpen: groups.incompleteDeliveries.length,
      inProgress: [...groups.incompletePickups, ...groups.incompleteDeliveries].filter((item) => item.status === "in_progress").length,
      overdueDeliveries: groups.incompleteDeliveries.filter((item) => item.isLate).length,
      overduePickups: groups.incompletePickups.filter((item) => item.isLate).length,
      pickupsDueOpen: groups.incompletePickups.length,
    };
  }

  if (orderSummary && logisticsResult.status === "fulfilled" && handoffsResult.status === "fulfilled") {
    const completedOrderIds = new Set(logisticsResult.value.completedDeliveries
      .filter((delivery) => {
        const order = relationOne(delivery.order);
        return order?.is_active
          && order.production_status === "completed"
          && inLocation(order.location_id, selectedLocationId)
          && isInBusinessDay(delivery.completed_at, day);
      })
      .map((delivery) => delivery.order_id));

    for (const handoff of handoffsResult.value) {
      const order = relationOne(handoff.order);
      if (order?.is_active
        && order.production_status === "completed"
        && inLocation(handoff.location_id, selectedLocationId)
        && isInBusinessDay(handoff.completed_at, day)) {
        completedOrderIds.add(handoff.order_id);
      }
    }

    orderSummary.finalFulfillmentCompleted = completedOrderIds.size;
    unassignedLocationFacts += handoffsResult.value.filter((handoff) => handoff.location_id === null).length;
  }

  if (accountingResult.status === "fulfilled") {
    const accounting = accountingResult.value.summary;
    const scopedPaymentLocations = accountingResult.value.paymentLocations
      .filter((row) => inLocation(relationOne(row.order)?.location_id ?? null, selectedLocationId));
    paymentSummary = accounting.currencies.map((currency) => ({
      bankTransferCollected: currency.bankTransferCollected,
      cardCollected: currency.cardCollected,
      cashCollected: currency.cashCollected,
      collectedGross: currency.collectedGross,
      collectedNet: currency.collectedNet,
      confirmedPaymentCount: currency.paymentCount,
      currency: currency.currency,
      onlineCollected: currency.onlineCollected,
      otherCollected: currency.otherCollected,
      outstanding: currency.outstanding,
      outstandingOrderCount: currency.outstandingOrderCount,
      refundCount: currency.refundCount,
      refunds: currency.refunds,
    }));

    if (ordersResult.status === "fulfilled") {
      const outstandingIds = new Set(accounting.currencies.flatMap((currency) => currency.outstandingOrderIds));
      const created = ordersResult.value.created.filter((order) => outstandingIds.has(order.id));
      const balances = buildReceivableBalances(
        created.map((order) => ({ id: order.id, total: Number(order.total) })),
        ordersResult.value.confirmedPayments.map((payment) => ({
          amount: Number(payment.amount),
          orderId: payment.order_id,
          status: payment.status,
        })),
      );
      groups.paymentIssues = created.map((order) => {
        const due = balances.get(order.id) ?? 0;
        const paid = Number(order.total) - due;
        return {
          ...orderItem(order, order.created_at, false),
          kind: "payment" as const,
          missingAmount: `${moneyString(due)} ${order.currency}`,
          paymentStatus: paid > 0 ? "partially_paid" as const : "unpaid" as const,
        };
      }).sort(sortByAttention);
    }
    unassignedLocationFacts += accountingResult.value.paymentLocations
      .filter((row) => relationOne(row.order)?.location_id === null).length;
    nonSessionNonCashActivity = scopedPaymentLocations
      .filter((row) => row.method !== "cash" && row.pos_session_id === null).length;
  }

  if (posResult.status === "fulfilled") {
    const sessions = posResult.value.sessions.filter((row) => inLocation(row.location_id, selectedLocationId));
    const lingeringOpen = posResult.value.lingeringOpen.filter((row) => inLocation(row.location_id, selectedLocationId));
    const cashWithoutSession = posResult.value.cashWithoutSession.filter((row) => inLocation(relationOne(row.order)?.location_id ?? null, selectedLocationId));
    const openIds = new Set([...sessions.filter((row) => row.status === "open"), ...lingeringOpen].map((row) => row.id));
    cashVarianceSessions = sessions.filter((row) => Number(row.difference ?? 0) !== 0).length;
    const accountingCurrencies = accountingResult.status === "fulfilled" ? accountingResult.value.summary.currencies : [];
    posReadiness = {
      cashPaymentsWithoutSession: cashWithoutSession.length,
      closedSessions: sessions.filter((row) => row.status === "closed").length,
      currencies: accountingCurrencies.map((currency) => ({
        countedCash: currency.posCountedCash,
        currency: currency.currency,
        expectedCash: currency.posExpectedCash,
        variance: currency.posDifference,
      })),
      openSessions: openIds.size,
    };
    unassignedLocationFacts += new Set([...posResult.value.sessions, ...posResult.value.lingeringOpen]
      .filter((row) => row.location_id === null).map((row) => row.id)).size;
    unassignedLocationFacts += posResult.value.cashWithoutSession
      .filter((row) => relationOne(row.order)?.location_id === null).length;
  }

  const anomalyMap = new Map<string, DailyCloseItem>();
  for (const item of [...groups.lateOrders, ...groups.onHoldOrders, ...groups.incompletePickups, ...groups.incompleteDeliveries, ...groups.paymentIssues]) {
    if (item.isLate || item.status === "on_hold" || item.kind === "payment") {
      anomalyMap.set(`${item.kind}-${item.id}`, { ...item, kind: "anomaly" });
    }
  }
  groups.anomalies = [...anomalyMap.values()].sort(sortByAttention);

  const blockers: DailyCloseData["blockers"] = [];
  if (failedSources.length) blockers.push({ key: "source_unavailable", sources: failedSources });
  if (invalidLocation) blockers.push({ key: "invalid_location" });
  if (day.isFuture) blockers.push({ key: "future_business_date" });
  if (posReadiness?.openSessions) blockers.push({ count: posReadiness.openSessions, key: "open_pos_session" });
  if (posReadiness?.cashPaymentsWithoutSession) blockers.push({ count: posReadiness.cashPaymentsWithoutSession, key: "cash_without_session" });
  if (unassignedLocationFacts) blockers.push({ count: unassignedLocationFacts, key: "unassigned_location" });

  return {
    blockers,
    businessDate: day.businessDate,
    cashVarianceSessions,
    complete: failedSources.length === 0,
    currentBusinessDate: day.currentBusinessDate,
    failedSources,
    groups,
    isFutureBusinessDate: day.isFuture,
    locations,
    logistics: logisticsSummary,
    nonSessionNonCashActivity,
    orders: orderSummary,
    payments: paymentSummary,
    pos: posReadiness,
    selectedLocationId,
    timeZone,
    unassignedLocationFacts,
  };
}
