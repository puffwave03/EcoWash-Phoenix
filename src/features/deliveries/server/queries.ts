import "server-only";

import { notFound } from "next/navigation";
import type {
  DeliveryPriority,
  DeliveryTask,
  DeliveryWorkspaceData,
} from "@/features/deliveries/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import {
  relationName,
  relationOne,
  todayWindow,
} from "@/features/operations/server/helpers";
import { requireOperationalCapability } from "@/lib/auth/require-capability";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DeliveryOrderRelation = {
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  is_active: boolean;
  order_number: string;
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
};

type DeliveryRow = {
  address_line1: string | null;
  address_line2: string | null;
  assigned_to: string | null;
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  country_code: string | null;
  id: string;
  notes: string | null;
  order: DeliveryOrderRelation | DeliveryOrderRelation[] | null;
  postal_code: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  status: FulfillmentStatus;
};

const DELIVERY_WORKSPACE_SELECT =
  "id, status, scheduled_at, started_at, assigned_to, address_line1, address_line2, city, postal_code, country_code, contact_name, contact_phone, notes, assigned_to_profile:profiles!deliveries_assigned_to_fkey(display_name), order:orders!deliveries_order_same_org!inner(id, order_number, production_status, is_active, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))";
const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;

function deliveryPriority(row: DeliveryRow, now: Date): DeliveryPriority {
  if (row.scheduled_at && new Date(row.scheduled_at) < now) return "overdue";
  if (row.status === "in_progress") return "in_progress";
  if (
    row.scheduled_at &&
    new Date(row.scheduled_at).getTime() <= now.getTime() + UPCOMING_WINDOW_MS
  ) {
    return "upcoming";
  }
  if (row.scheduled_at) return "scheduled";

  return "assigned";
}

function isOperationalOrder(order: DeliveryOrderRelation | null) {
  return Boolean(
    order &&
      order.is_active &&
      !["completed", "cancelled"].includes(order.production_status),
  );
}

function mapDelivery(row: DeliveryRow, now: Date): DeliveryTask | null {
  const order = relationOne(row.order);

  if (!order || !row.assigned_to) return null;

  return {
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    assignedTo: row.assigned_to,
    assignedToName: relationName(row.assigned_to_profile),
    city: row.city,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    countryCode: row.country_code,
    customerName: relationName(order.customer) ?? "",
    id: row.id,
    notes: row.notes,
    orderId: order.id,
    orderNumber: order.order_number,
    postalCode: row.postal_code,
    priority: deliveryPriority(row, now),
    propertyName: relationName(order.property),
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    status: row.status,
  };
}

function deliverySort(a: DeliveryTask, b: DeliveryTask) {
  const priorityRank: Record<DeliveryPriority, number> = {
    overdue: 0,
    in_progress: 1,
    upcoming: 2,
    scheduled: 3,
    assigned: 4,
  };
  const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];

  if (priorityDiff !== 0) return priorityDiff;

  const aTime = a.scheduledAt
    ? new Date(a.scheduledAt).getTime()
    : Number.MAX_SAFE_INTEGER;
  const bTime = b.scheduledAt
    ? new Date(b.scheduledAt).getTime()
    : Number.MAX_SAFE_INTEGER;

  if (aTime !== bTime) return aTime - bTime;

  return a.orderNumber.localeCompare(b.orderNumber);
}

export async function getDeliveryWorkspaceData(
  locale: string,
): Promise<DeliveryWorkspaceData> {
  const { membership, profile } = await requireOperationalCapability(locale, "delivery");
  const supabase = await createSupabaseServerClient();
  const { end, now, timeZone } = todayWindow(membership.organization.timezone);
  const isSupervision = membership.role === "owner" || membership.role === "manager";
  let query = supabase
    .from("deliveries")
    .select(DELIVERY_WORKSPACE_SELECT)
    .eq("organization_id", membership.organization.id)
    .in("status", ["scheduled", "in_progress"])
    .not("assigned_to", "is", null)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(150);

  if (!isSupervision) query = query.eq("assigned_to", profile.id);

  const { data, error } = await query.returns<DeliveryRow[]>();

  if (error) console.error("Delivery workspace query failed", error.code);

  const tasks = (data ?? [])
    .filter((row) => {
      if (!isOperationalOrder(relationOne(row.order))) return false;
      if (row.status === "in_progress" || !row.scheduled_at) return true;

      return new Date(row.scheduled_at) <= end;
    })
    .flatMap((row) => {
      const delivery = mapDelivery(row, now);

      return delivery ? [delivery] : [];
    })
    .sort(deliverySort);

  return {
    generatedAt: now.toISOString(),
    isSupervision,
    nextDelivery: tasks[0] ?? null,
    summary: {
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      overdue: tasks.filter((task) => task.priority === "overdue").length,
      toDo: tasks.filter((task) => task.status === "scheduled").length,
      total: tasks.length,
    },
    tasks,
    timeZone,
  };
}

export async function getDeliveryWorkspaceTask(locale: string, deliveryId: string) {
  const { membership, profile } = await requireOperationalCapability(locale, "delivery");
  const supabase = await createSupabaseServerClient();
  const isSupervision = membership.role === "owner" || membership.role === "manager";
  let query = supabase
    .from("deliveries")
    .select(DELIVERY_WORKSPACE_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("id", deliveryId)
    .in("status", ["scheduled", "in_progress"]);

  if (!isSupervision) query = query.eq("assigned_to", profile.id);

  const { data, error } = await query.maybeSingle<DeliveryRow>();

  if (error || !data) notFound();
  if (!isOperationalOrder(relationOne(data.order))) notFound();

  const task = mapDelivery(data, new Date());

  if (!task) notFound();

  return {
    isSupervision,
    task,
    timeZone: membership.organization.timezone,
  };
}
