import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { hasOperationalCapability } from "@/lib/auth/capabilities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import {
  relationName,
  relationOne,
  todayWindow,
} from "@/features/operations/server/helpers";
import type {
  MyDayActivity,
  MyDayActivityKind,
  MyDayActivityPriority,
  MyDayData,
} from "@/features/work/types";

type OrderRow = {
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  customer: { display_name: string } | { display_name: string }[] | null;
  due_at: string | null;
  id: string;
  is_active: boolean;
  order_number: string;
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
};

type LogisticsOrderRelation = {
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  is_active: boolean;
  order_number: string;
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
};

type LogisticsRow = {
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  city: string | null;
  id: string;
  order: LogisticsOrderRelation | LogisticsOrderRelation[] | null;
  scheduled_at: string | null;
  status: FulfillmentStatus;
};

const PRODUCTION_STATUSES: ProductionStatus[] = [
  "received",
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
];
const ACTIVE_PRODUCTION_STATUSES: ProductionStatus[] = [
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
];
const QUALITY_STATUSES: ProductionStatus[] = ["quality_check", "packing"];
const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;

function activityPriority(
  timestamp: string | null,
  isInProgress: boolean,
  now: Date,
): MyDayActivityPriority {
  if (timestamp && new Date(timestamp) < now) return "overdue";
  if (isInProgress) return "in_progress";
  if (timestamp && new Date(timestamp).getTime() <= now.getTime() + UPCOMING_WINDOW_MS) {
    return "upcoming";
  }
  if (timestamp) return "scheduled";

  return "assigned";
}

function productionActivity(row: OrderRow, now: Date): MyDayActivity {
  const kind: MyDayActivityKind = QUALITY_STATUSES.includes(row.production_status)
    ? "quality"
    : "production";
  const isInProgress = ACTIVE_PRODUCTION_STATUSES.includes(row.production_status);

  return {
    assignedToName: relationName(row.assigned_to_profile),
    city: null,
    customerName: relationName(row.customer) ?? "",
    id: `order-${row.id}`,
    isInProgress,
    kind,
    orderId: row.id,
    orderNumber: row.order_number,
    priority: activityPriority(row.due_at, isInProgress, now),
    propertyName: relationName(row.property),
    timestamp: row.due_at,
    workflowStatus: row.production_status,
  };
}

function logisticsActivity(
  row: LogisticsRow,
  kind: "pickup" | "delivery",
  now: Date,
): MyDayActivity | null {
  const order = relationOne(row.order);

  if (!order || !order.is_active || ["completed", "cancelled"].includes(order.production_status)) {
    return null;
  }

  const isInProgress = row.status === "in_progress";

  return {
    assignedToName: relationName(row.assigned_to_profile),
    city: row.city,
    customerName: relationName(order.customer) ?? "",
    id: `${kind}-${row.id}`,
    isInProgress,
    kind,
    orderId: order.id,
    orderNumber: order.order_number,
    priority: activityPriority(row.scheduled_at, isInProgress, now),
    propertyName: relationName(order.property),
    timestamp: row.scheduled_at,
    workflowStatus: row.status,
  };
}

function activitySort(a: MyDayActivity, b: MyDayActivity) {
  const priorityRank: Record<MyDayActivityPriority, number> = {
    overdue: 0,
    in_progress: 1,
    upcoming: 2,
    scheduled: 3,
    assigned: 4,
  };
  const kindRank: Record<MyDayActivityKind, number> = {
    pickup: 0,
    production: 1,
    quality: 2,
    delivery: 3,
  };
  const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];

  if (priorityDiff !== 0) return priorityDiff;

  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : Number.MAX_SAFE_INTEGER;

  if (aTime !== bTime) return aTime - bTime;

  return kindRank[a.kind] - kindRank[b.kind];
}

function summarize(activities: MyDayActivity[]) {
  return {
    delivery: activities.filter((activity) => activity.kind === "delivery").length,
    pickup: activities.filter((activity) => activity.kind === "pickup").length,
    production: activities.filter((activity) => activity.kind === "production").length,
    quality: activities.filter((activity) => activity.kind === "quality").length,
    total: activities.length,
    urgent: activities.filter((activity) => ["overdue", "upcoming"].includes(activity.priority)).length,
  };
}

export async function getMyDayData(locale: string): Promise<MyDayData> {
  const access = await requireMembership(locale);
  const { membership, profile, user } = access;
  const supabase = await createSupabaseServerClient();
  const { end, now, timeZone } = todayWindow(membership.organization.timezone);
  const isSupervision = membership.role === "owner" || membership.role === "manager";
  const availableKinds: MyDayActivityKind[] = [
    ...(hasOperationalCapability(membership, "pickup") ? ["pickup" as const] : []),
    ...(hasOperationalCapability(membership, "production") ? ["production" as const] : []),
    ...(hasOperationalCapability(membership, "quality") ? ["quality" as const] : []),
    ...(hasOperationalCapability(membership, "delivery") ? ["delivery" as const] : []),
  ];

  let ordersQuery = supabase
    .from("orders")
    .select("id, order_number, production_status, due_at, is_active, customer:customers!orders_customer_same_organization!inner(display_name), property:properties!orders_property_same_customer(name), assigned_to_profile:profiles!orders_assigned_to_fkey(display_name)")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .in("production_status", PRODUCTION_STATUSES)
    .not("assigned_to", "is", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(150);
  let pickupsQuery = supabase
    .from("pickups")
    .select("id, status, scheduled_at, city, assigned_to_profile:profiles!pickups_assigned_to_fkey(display_name), order:orders!pickups_order_same_org!inner(id, order_number, production_status, is_active, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))")
    .eq("organization_id", membership.organization.id)
    .in("status", ["scheduled", "in_progress"])
    .not("assigned_to", "is", null)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(150);
  let deliveriesQuery = supabase
    .from("deliveries")
    .select("id, status, scheduled_at, city, assigned_to_profile:profiles!deliveries_assigned_to_fkey(display_name), order:orders!deliveries_order_same_org!inner(id, order_number, production_status, is_active, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))")
    .eq("organization_id", membership.organization.id)
    .in("status", ["scheduled", "in_progress"])
    .not("assigned_to", "is", null)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(150);

  if (!isSupervision) {
    ordersQuery = ordersQuery.eq("assigned_to", profile.id);
    pickupsQuery = pickupsQuery.eq("assigned_to", profile.id);
    deliveriesQuery = deliveriesQuery.eq("assigned_to", profile.id);
  }

  const [ordersResult, pickupsResult, deliveriesResult] = await Promise.all([
    ordersQuery.returns<OrderRow[]>(),
    pickupsQuery.returns<LogisticsRow[]>(),
    deliveriesQuery.returns<LogisticsRow[]>(),
  ]);

  if (ordersResult.error) console.error("My Day orders query failed", ordersResult.error.code);
  if (pickupsResult.error) console.error("My Day pickups query failed", pickupsResult.error.code);
  if (deliveriesResult.error) console.error("My Day deliveries query failed", deliveriesResult.error.code);

  const orders = (ordersResult.data ?? [])
    .filter((order) => {
      const isActiveWork = ACTIVE_PRODUCTION_STATUSES.includes(order.production_status);

      return isActiveWork || !order.due_at || new Date(order.due_at) <= end;
    })
    .map((order) => productionActivity(order, now));
  const pickups = (pickupsResult.data ?? []).flatMap((row) => {
    if (row.status !== "in_progress" && row.scheduled_at && new Date(row.scheduled_at) > end) return [];
    const activity = logisticsActivity(row, "pickup", now);

    return activity ? [activity] : [];
  });
  const deliveries = (deliveriesResult.data ?? []).flatMap((row) => {
    if (row.status !== "in_progress" && row.scheduled_at && new Date(row.scheduled_at) > end) return [];
    const activity = logisticsActivity(row, "delivery", now);

    return activity ? [activity] : [];
  });
  const activities = [...orders, ...pickups, ...deliveries]
    .filter((activity) => availableKinds.includes(activity.kind))
    .sort(activitySort);

  return {
    activities,
    availableKinds,
    generatedAt: now.toISOString(),
    isSupervision,
    nextActivity: activities[0] ?? null,
    profileName: profile.displayName || user.email || "",
    summary: summarize(activities),
    timeZone,
  };
}
