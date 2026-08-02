import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  FulfillmentStatus,
  LogisticsRecord,
  OrderLogistics,
} from "@/features/logistics/types";
import type { AssignmentOption } from "@/features/orders/server/queries";

type LogisticsRow = {
  address_line1: string | null;
  address_line2: string | null;
  assigned_to: string | null;
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  cancellation_reason: string | null;
  city: string | null;
  completed_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  country_code: string | null;
  fee: number;
  id: string;
  notes: string | null;
  postal_code: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  status: LogisticsRecord["status"];
};

type DeliveryTaskKind = "delivery" | "pickup";

type DeliveryTaskOrderRelation = {
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  order_number: string;
  property: { name: string } | { name: string }[] | null;
};

type DeliveryTaskRow = Pick<
  LogisticsRow,
  | "address_line1"
  | "address_line2"
  | "assigned_to"
  | "assigned_to_profile"
  | "city"
  | "completed_at"
  | "contact_phone"
  | "country_code"
  | "id"
  | "postal_code"
  | "scheduled_at"
  | "started_at"
  | "status"
> & {
  order: DeliveryTaskOrderRelation | DeliveryTaskOrderRelation[] | null;
};

export type DeliveryQueueTask = {
  assignedTo: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  assignedToName: string | null;
  city: string | null;
  completedAt: string | null;
  contactPhone: string | null;
  countryCode: string | null;
  customerName: string;
  id: string;
  kind: DeliveryTaskKind;
  orderId: string;
  orderNumber: string;
  postalCode: string | null;
  propertyName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  status: FulfillmentStatus;
};

function relationName(value: { display_name?: string; name?: string } | { display_name?: string; name?: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;

  return row?.display_name ?? row?.name ?? null;
}

function taskOrderRelation(value: DeliveryTaskRow["order"]) {
  return Array.isArray(value) ? value[0] : value;
}

function mapLogistics(row: LogisticsRow): LogisticsRecord {
  return {
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    assignedTo: row.assigned_to,
    assignedToName: relationName(row.assigned_to_profile),
    cancellationReason: row.cancellation_reason,
    city: row.city,
    completedAt: row.completed_at,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    countryCode: row.country_code,
    fee: row.fee,
    id: row.id,
    notes: row.notes,
    postalCode: row.postal_code,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    status: row.status,
  };
}

const PICKUP_SELECT =
  "id, status, scheduled_at, started_at, completed_at, assigned_to, address_line1, address_line2, city, postal_code, country_code, contact_name, contact_phone, notes, cancellation_reason, fee, assigned_to_profile:profiles!pickups_assigned_to_fkey(display_name)";
const DELIVERY_SELECT =
  "id, status, scheduled_at, started_at, completed_at, assigned_to, address_line1, address_line2, city, postal_code, country_code, contact_name, contact_phone, notes, cancellation_reason, fee, assigned_to_profile:profiles!deliveries_assigned_to_fkey(display_name)";
const PICKUP_TASK_SELECT =
  "id, status, scheduled_at, started_at, completed_at, assigned_to, address_line1, address_line2, city, postal_code, country_code, contact_phone, assigned_to_profile:profiles!pickups_assigned_to_fkey(display_name), order:orders!pickups_order_same_org!inner(id, order_number, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))";
const DELIVERY_TASK_SELECT =
  "id, status, scheduled_at, started_at, completed_at, assigned_to, address_line1, address_line2, city, postal_code, country_code, contact_phone, assigned_to_profile:profiles!deliveries_assigned_to_fkey(display_name), order:orders!deliveries_order_same_org!inner(id, order_number, customer:customers!orders_customer_same_organization(display_name), property:properties!orders_property_same_customer(name))";

function mapDeliveryTask(row: DeliveryTaskRow, kind: DeliveryTaskKind): DeliveryQueueTask | null {
  const order = taskOrderRelation(row.order);

  if (!order) return null;

  return {
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    assignedTo: row.assigned_to,
    assignedToName: relationName(row.assigned_to_profile),
    city: row.city,
    completedAt: row.completed_at,
    contactPhone: row.contact_phone,
    countryCode: row.country_code,
    customerName: relationName(order.customer) ?? "",
    id: row.id,
    kind,
    orderId: order.id,
    orderNumber: order.order_number,
    postalCode: row.postal_code,
    propertyName: relationName(order.property),
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    status: row.status,
  };
}

export async function getOrderLogistics(locale: string, orderId: string): Promise<OrderLogistics> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const [pickupResult, deliveryResult] = await Promise.all([
    supabase
      .from("pickups")
      .select(PICKUP_SELECT)
      .eq("organization_id", membership.organization.id)
      .eq("order_id", orderId)
      .neq("status", "cancelled")
      .maybeSingle<LogisticsRow>(),
    supabase
      .from("deliveries")
      .select(DELIVERY_SELECT)
      .eq("organization_id", membership.organization.id)
      .eq("order_id", orderId)
      .neq("status", "cancelled")
      .maybeSingle<LogisticsRow>(),
  ]);

  if (pickupResult.error) console.error("Pickup query failed", pickupResult.error.code);
  if (deliveryResult.error) console.error("Delivery query failed", deliveryResult.error.code);

  return {
    delivery: deliveryResult.data ? mapLogistics(deliveryResult.data) : null,
    pickup: pickupResult.data ? mapLogistics(pickupResult.data) : null,
  };
}

export async function listDeliveryQueueTasks(locale: string): Promise<DeliveryQueueTask[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const [pickupResult, deliveryResult] = await Promise.all([
    supabase
      .from("pickups")
      .select(PICKUP_TASK_SELECT)
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress", "completed"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(100)
      .returns<DeliveryTaskRow[]>(),
    supabase
      .from("deliveries")
      .select(DELIVERY_TASK_SELECT)
      .eq("organization_id", membership.organization.id)
      .in("status", ["scheduled", "in_progress", "completed"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(100)
      .returns<DeliveryTaskRow[]>(),
  ]);

  if (pickupResult.error) console.error("Delivery queue pickup query failed", pickupResult.error.code);
  if (deliveryResult.error) console.error("Delivery queue delivery query failed", deliveryResult.error.code);

  const pickups = pickupResult.data?.flatMap((row) => {
    const task = mapDeliveryTask(row, "pickup");

    return task ? [task] : [];
  }) ?? [];
  const deliveries = deliveryResult.data?.flatMap((row) => {
    const task = mapDeliveryTask(row, "delivery");

    return task ? [task] : [];
  }) ?? [];

  return [...pickups, ...deliveries].sort((a, b) => {
    if (a.status === "in_progress" && b.status !== "in_progress") return -1;
    if (a.status !== "in_progress" && b.status === "in_progress") return 1;

    const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;

    return aTime - bTime;
  });
}

export async function listAssignableStaff(locale: string): Promise<AssignmentOption[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("profile_id, profile:profiles(display_name)")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .eq("role", "staff")
    .order("profile_id", { ascending: true })
    .returns<{ profile: { display_name: string } | { display_name: string }[] | null; profile_id: string }[]>();

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.profile_id,
    label: relationName(row.profile) ?? row.profile_id,
  }));
}
