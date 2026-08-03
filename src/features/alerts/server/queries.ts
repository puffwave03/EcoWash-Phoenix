import "server-only";

import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OperationalAlert,
  OperationalAlertsData,
  OperationalAlertSeverity,
  OperationalAlertType,
} from "@/features/alerts/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { PaymentRecordStatus } from "@/features/payments/types";
import {
  isOpenProductionStatus,
  moneyString,
  paymentTotals,
  relationName,
  relationOne,
  todayWindow,
} from "@/features/operations/server/helpers";

type OrderRow = {
  assigned_to: string | null;
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
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
  assigned_to: string | null;
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  id: string;
  order: LogisticsOrderRelation | LogisticsOrderRelation[] | null;
  scheduled_at: string | null;
  status: FulfillmentStatus;
};

const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;

function isOpenOrder(order: OrderRow) {
  return order.is_active && isOpenProductionStatus(order.production_status);
}

function isLateOrder(order: OrderRow, now: Date) {
  return isOpenOrder(order) && Boolean(order.due_at) && new Date(order.due_at as string) < now;
}

function alertBase(order: OrderRow, type: OperationalAlertType, severity: OperationalAlertSeverity, timestamp: string | null): OperationalAlert {
  return {
    assignedToName: relationName(order.assigned_to_profile),
    customerName: relationName(order.customer) ?? "",
    id: `${type}-${order.id}`,
    missingAmount: null,
    orderId: order.id,
    orderNumber: order.order_number,
    paymentStatus: null,
    propertyName: relationName(order.property),
    severity,
    status: order.production_status,
    timestamp,
    type,
  };
}

function logisticsAlert(
  row: LogisticsRow,
  type: OperationalAlertType,
  severity: OperationalAlertSeverity,
): OperationalAlert | null {
  const order = relationOne(row.order);

  if (!order) return null;

  return {
    assignedToName: relationName(row.assigned_to_profile),
    customerName: relationName(order.customer) ?? "",
    id: `${type}-${row.id}`,
    missingAmount: null,
    orderId: order.id,
    orderNumber: order.order_number,
    paymentStatus: null,
    propertyName: relationName(order.property),
    severity,
    status: row.status,
    timestamp: row.scheduled_at,
    type,
  };
}

function alertSort(a: OperationalAlert, b: OperationalAlert) {
  const severityRank: Record<OperationalAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const severityDiff = severityRank[a.severity] - severityRank[b.severity];

  if (severityDiff !== 0) return severityDiff;

  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

  return aTime - bTime;
}

function summarize(alerts: OperationalAlert[]) {
  return {
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    info: alerts.filter((alert) => alert.severity === "info").length,
    total: alerts.length,
    warning: alerts.filter((alert) => alert.severity === "warning").length,
  };
}

function isUpcoming(value: string | null, now: Date) {
  if (!value) return false;
  const scheduledAt = new Date(value).getTime();
  const nowMs = now.getTime();

  return scheduledAt >= nowMs && scheduledAt <= nowMs + UPCOMING_WINDOW_MS;
}

function isOverdue(value: string | null, now: Date) {
  return value ? new Date(value) < now : false;
}

function requireOwnerOrManager(role: string, locale: string) {
  if (role === "staff") {
    redirect(`/${locale}/app/access-denied`);
  }
}

async function loadOperationalAlerts(locale: string): Promise<OperationalAlertsData> {
  const { membership } = await requireMembership(locale);
  requireOwnerOrManager(membership.role, locale);

  const supabase = await createSupabaseServerClient();
  const { now, timeZone } = todayWindow(membership.organization.timezone);
  const [ordersResult, paymentsResult, pickupsResult, deliveriesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, production_status, due_at, total, currency, assigned_to, is_active, customer:customers!orders_customer_same_organization!inner(display_name), property:properties!orders_property_same_customer(name), assigned_to_profile:profiles!orders_assigned_to_fkey(display_name)")
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
      .select("id, status, scheduled_at, assigned_to, assigned_to_profile:profiles!pickups_assigned_to_fkey(display_name), order:orders!pickups_order_same_org!inner(id, order_number, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(150)
      .returns<LogisticsRow[]>(),
    supabase
      .from("deliveries")
      .select("id, status, scheduled_at, assigned_to, assigned_to_profile:profiles!deliveries_assigned_to_fkey(display_name), order:orders!deliveries_order_same_org!inner(id, order_number, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))")
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(150)
      .returns<LogisticsRow[]>(),
  ]);

  if (ordersResult.error) console.error("Operational alerts orders query failed", ordersResult.error.code);
  if (paymentsResult.error) console.error("Operational alerts payments query failed", paymentsResult.error.code);
  if (pickupsResult.error) console.error("Operational alerts pickups query failed", pickupsResult.error.code);
  if (deliveriesResult.error) console.error("Operational alerts deliveries query failed", deliveriesResult.error.code);

  const orders = ordersResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const pickups = pickupsResult.data ?? [];
  const deliveries = deliveriesResult.data ?? [];
  const alerts: OperationalAlert[] = [];

  for (const order of orders.filter(isOpenOrder)) {
    if (isLateOrder(order, now)) {
      alerts.push(alertBase(order, "late_order", "critical", order.due_at));
    }

    if (order.production_status === "on_hold") {
      alerts.push(alertBase(order, "on_hold_order", isLateOrder(order, now) ? "critical" : "warning", order.due_at));
    }

    if (!order.assigned_to) {
      alerts.push(alertBase(order, "unassigned_order", "warning", order.due_at));
    }

    const totals = paymentTotals(order, payments);
    if (totals.balanceDue > 0) {
      alerts.push({
        ...alertBase(order, "payment_issue", "warning", order.due_at),
        missingAmount: `${moneyString(totals.balanceDue)} ${order.currency}`,
        paymentStatus: totals.paymentStatus,
      });
    }
  }

  for (const pickup of pickups) {
    if (isOverdue(pickup.scheduled_at, now)) {
      const alert = logisticsAlert(pickup, "pickup_overdue", "critical");
      if (alert) alerts.push(alert);
    } else if (isUpcoming(pickup.scheduled_at, now)) {
      const alert = logisticsAlert(pickup, "pickup_due_soon", pickup.status === "in_progress" ? "info" : "warning");
      if (alert) alerts.push(alert);
    }

    if (pickup.status === "in_progress" && !pickup.assigned_to) {
      const alert = logisticsAlert(pickup, "operational_anomaly", "warning");
      if (alert) alerts.push(alert);
    }
  }

  for (const delivery of deliveries) {
    if (isOverdue(delivery.scheduled_at, now)) {
      const alert = logisticsAlert(delivery, "delivery_overdue", "critical");
      if (alert) alerts.push(alert);
    } else if (isUpcoming(delivery.scheduled_at, now)) {
      const alert = logisticsAlert(delivery, "delivery_due_soon", delivery.status === "in_progress" ? "info" : "warning");
      if (alert) alerts.push(alert);
    }

    if (delivery.status === "in_progress" && !delivery.assigned_to) {
      const alert = logisticsAlert(delivery, "operational_anomaly", "warning");
      if (alert) alerts.push(alert);
    }
  }

  const uniqueAlerts = Array.from(new Map(alerts.map((alert) => [alert.id, alert])).values()).sort(alertSort);

  return {
    alerts: uniqueAlerts,
    summary: summarize(uniqueAlerts),
    timeZone,
  };
}

export async function getOperationalAlerts(locale: string) {
  return loadOperationalAlerts(locale);
}

export async function getOperationalAlertCount(locale: string) {
  try {
    const data = await loadOperationalAlerts(locale);

    return data.summary.total;
  } catch (error) {
    console.error("Operational alerts count failed", error instanceof Error ? error.name : "unknown");
    return 0;
  }
}
