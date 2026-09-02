import "server-only";

import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderHistory,
  OrderItem,
  OrderListFilters,
  ProductionStatus,
} from "@/features/orders/types";

type OrderRow = {
  assigned_to: string | null;
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  completed_at: string | null;
  created_at: string;
  currency: string;
  customer: { customer_code: string | null; display_name: string } | { customer_code: string | null; display_name: string }[] | null;
  customer_id: string;
  customer_notes: string | null;
  discount_amount: number;
  due_at: string | null;
  id: string;
  internal_notes: string | null;
  is_active: boolean;
  order_number: string;
  priority: Order["priority"];
  production_status: ProductionStatus;
  property: { name: string } | { name: string }[] | null;
  property_id: string | null;
  subtotal: number;
  total: number;
  walk_in_name: string | null;
  walk_in_phone: string | null;
};

type ItemRow = {
  description: string;
  id: string;
  is_active: boolean;
  line_total: number;
  notes: string | null;
  quantity: number;
  service_id: string | null;
  unit_price: number;
  unit_type: OrderItem["unitType"];
};

type HistoryRow = {
  changed_at: string;
  changed_by_profile: { display_name: string } | { display_name: string }[] | null;
  from_status: ProductionStatus | null;
  id: string;
  reason: string | null;
  to_status: ProductionStatus;
};

export type OrderSelectOption = {
  id: string;
  label: string;
};

export type PropertySelectOption = {
  customerId: string;
  id: string;
  label: string;
};

export type AssignmentOption = {
  id: string;
  label: string;
};

export type ProductionQueueOrder = Pick<
  Order,
  "assignedTo" | "assignedToName" | "customerName" | "dueAt" | "id" | "orderNumber" | "priority" | "productionStatus" | "propertyName"
>;

const ORDER_SELECT =
  "id, order_number, customer_id, property_id, production_status, priority, due_at, completed_at, customer_notes, internal_notes, subtotal, discount_amount, total, currency, assigned_to, is_active, created_at, walk_in_name, walk_in_phone, customer:customers!orders_customer_same_organization!inner(customer_code, display_name), property:properties!orders_property_same_customer(name), assigned_to_profile:profiles!orders_assigned_to_fkey(display_name)";
const PRODUCTION_QUEUE_SELECT =
  "id, order_number, production_status, priority, due_at, assigned_to, walk_in_name, customer:customers!orders_customer_same_organization!inner(customer_code, display_name), property:properties!orders_property_same_customer(name), assigned_to_profile:profiles!orders_assigned_to_fkey(display_name)";
const ITEM_SELECT =
  "id, service_id, description, unit_type, quantity, unit_price, line_total, notes, is_active";
const HISTORY_SELECT =
  "id, from_status, to_status, reason, changed_at, changed_by_profile:profiles(display_name)";

function relationName(value: { display_name?: string; name?: string } | { display_name?: string; name?: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;

  return row?.display_name ?? row?.name ?? null;
}

function orderCustomerName(row: Pick<OrderRow, "customer" | "walk_in_name">, occasionalCustomer: string) {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  return customer?.customer_code === "WALKIN-SHARED"
    ? row.walk_in_name || occasionalCustomer
    : customer?.display_name ?? "";
}

function mapOrder(row: OrderRow, occasionalCustomer: string): Order {
  return {
    assignedTo: row.assigned_to,
    assignedToName: relationName(row.assigned_to_profile),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    currency: row.currency,
    customerId: row.customer_id,
    customerName: orderCustomerName(row, occasionalCustomer),
    customerNotes: row.customer_notes,
    discountAmount: row.discount_amount,
    dueAt: row.due_at,
    id: row.id,
    internalNotes: row.internal_notes,
    isActive: row.is_active,
    isSharedWalkIn: (Array.isArray(row.customer) ? row.customer[0] : row.customer)?.customer_code === "WALKIN-SHARED",
    orderNumber: row.order_number,
    priority: row.priority,
    productionStatus: row.production_status,
    propertyId: row.property_id,
    propertyName: relationName(row.property),
    subtotal: row.subtotal,
    total: row.total,
    walkInName: row.walk_in_name,
    walkInPhone: row.walk_in_phone,
  };
}

function mapProductionQueueOrder(row: Pick<OrderRow, "assigned_to" | "assigned_to_profile" | "customer" | "due_at" | "id" | "order_number" | "priority" | "production_status" | "property" | "walk_in_name">, occasionalCustomer: string): ProductionQueueOrder {
  return {
    assignedTo: row.assigned_to,
    assignedToName: relationName(row.assigned_to_profile),
    customerName: orderCustomerName(row, occasionalCustomer),
    dueAt: row.due_at,
    id: row.id,
    orderNumber: row.order_number,
    priority: row.priority,
    productionStatus: row.production_status,
    propertyName: relationName(row.property),
  };
}

function mapItem(row: ItemRow): OrderItem {
  return {
    description: row.description,
    id: row.id,
    isActive: row.is_active,
    lineTotal: row.line_total,
    notes: row.notes,
    quantity: row.quantity,
    serviceId: row.service_id,
    unitPrice: row.unit_price,
    unitType: row.unit_type,
  };
}

function mapHistory(row: HistoryRow): OrderHistory {
  return {
    changedAt: row.changed_at,
    changedByName: relationName(row.changed_by_profile),
    fromStatus: row.from_status,
    id: row.id,
    reason: row.reason,
    toStatus: row.to_status,
  };
}

export async function listOrders(
  locale: string,
  filters: OrderListFilters,
): Promise<Order[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("organization_id", membership.organization.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.status !== "all") query = query.eq("production_status", filters.status);
  if (filters.priority !== "all") query = query.eq("priority", filters.priority);
  if (filters.active === "active") query = query.neq("production_status", "cancelled").eq("is_active", true);
  if (filters.active === "cancelled") query = query.eq("production_status", "cancelled");
  if (filters.query) {
    const search = filters.query.replaceAll("%", "").replaceAll(",", " ");
    query = query.or(`order_number.ilike.%${search}%`);
  }

  const [{ data, error }, t] = await Promise.all([
    query.returns<OrderRow[]>(),
    getTranslations({ locale, namespace: "common.shopTerminal.labels" }),
  ]);

  if (error || !data) {
    console.error("Order list query failed", error?.code);
    return [];
  }

  return data.map((row) => mapOrder(row, t("occasionalCustomer")));
}

export async function listProductionQueueOrders(locale: string): Promise<ProductionQueueOrder[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, t] = await Promise.all([supabase
    .from("orders")
    .select(PRODUCTION_QUEUE_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .not("production_status", "in", "(completed,cancelled)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Pick<OrderRow, "assigned_to" | "assigned_to_profile" | "customer" | "due_at" | "id" | "order_number" | "priority" | "production_status" | "property" | "walk_in_name">[]>(),
    getTranslations({ locale, namespace: "common.shopTerminal.labels" }),
  ]);

  if (error || !data) {
    console.error("Production queue query failed", error?.code);
    return [];
  }

  return data.map((row) => mapProductionQueueOrder(row, t("occasionalCustomer")));
}

export async function getOrderById(locale: string, orderId: string) {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, t] = await Promise.all([supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("id", orderId)
    .maybeSingle<OrderRow>(), getTranslations({ locale, namespace: "common.shopTerminal.labels" })]);

  if (error || !data) notFound();

  return mapOrder(data, t("occasionalCustomer"));
}

export async function listOrderItems(locale: string, orderId: string) {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_items")
    .select(ITEM_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<ItemRow[]>();

  if (error || !data) {
    console.error("Order items query failed", error?.code);
    return [];
  }

  return data.map(mapItem);
}

export async function getOrderHistory(locale: string, orderId: string) {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_status_history")
    .select(HISTORY_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false })
    .returns<HistoryRow[]>();

  if (error || !data) {
    console.error("Order history query failed", error?.code);
    return [];
  }

  return data.map(mapHistory);
}

export async function listCustomersForOrder(locale: string): Promise<OrderSelectOption[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, display_name")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .order("display_name", { ascending: true })
    .returns<{ id: string; display_name: string }[]>();

  if (error || !data) return [];

  return data.map((customer) => ({ id: customer.id, label: customer.display_name }));
}

export async function listPropertiesForCustomer(locale: string): Promise<PropertySelectOption[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, customer_id, name")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<{ customer_id: string; id: string; name: string }[]>();

  if (error || !data) return [];

  return data.map((property) => ({
    customerId: property.customer_id,
    id: property.id,
    label: property.name,
  }));
}

export async function listActiveMembershipsForAssignment(locale: string): Promise<AssignmentOption[]> {
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
