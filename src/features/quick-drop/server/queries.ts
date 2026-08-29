import "server-only";

import { notFound } from "next/navigation";
import { createOrderCode } from "@/features/barcode/payload";
import type { ProductionStatus } from "@/features/orders/types";
import type { PendingQuickDrop, QuickDropOrder } from "@/features/quick-drop/types";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth/require-membership";

type QuickDropOrderRow = {
  customer_id: string;
  discount_amount: number;
  due_at: string | null;
  id: string;
  order_number: string;
  production_status: ProductionStatus;
  received_at: string | null;
  subtotal: number;
  total: number;
};

export async function getQuickDropOrderOrNull(locale: string, orderId: string): Promise<QuickDropOrder | null> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const organizationId = membership.organization.id;
  const [orderResult, itemResult, sourceResult] = await Promise.all([
    supabase.from("orders")
      .select("id, order_number, customer_id, production_status, received_at, due_at, subtotal, discount_amount, total")
      .eq("organization_id", organizationId)
      .eq("id", orderId)
      .eq("is_active", true)
      .maybeSingle<QuickDropOrderRow>(),
    supabase.from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("order_id", orderId)
      .eq("is_active", true),
    supabase.from("order_status_history")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("order_id", orderId)
      .contains("metadata", { source: "quick_drop" })
      .limit(1),
  ]);

  if (orderResult.error || itemResult.error || sourceResult.error
    || !orderResult.data || !orderResult.data.received_at || !sourceResult.data?.length) {
    if (orderResult.error || itemResult.error || sourceResult.error) {
      console.error("Quick Drop order query failed", orderResult.error?.code ?? itemResult.error?.code ?? sourceResult.error?.code);
    }
    return null;
  }

  const pendingDetail = (itemResult.count ?? 0) === 0;
  return {
    customerId: orderResult.data.customer_id,
    detailState: pendingDetail ? "pending_detail" : "detailed",
    dueAt: orderResult.data.due_at,
    financialState: pendingDetail ? "unpriced" : "priced",
    id: orderResult.data.id,
    orderCode: createOrderCode(orderResult.data.id),
    orderNumber: orderResult.data.order_number,
    receivedAt: orderResult.data.received_at,
  };
}

export async function getQuickDropOrder(locale: string, orderId: string): Promise<QuickDropOrder> {
  const order = await getQuickDropOrderOrNull(locale, orderId);
  if (!order) notFound();
  return order;
}

type PendingOrderRow = {
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  order_number: string;
  received_at: string | null;
};

export async function listPendingQuickDrops(locale: string): Promise<PendingQuickDrop[]> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const organizationId = membership.organization.id;
  const { data: sources, error: sourceError } = await supabase.from("order_status_history")
    .select("order_id")
    .eq("organization_id", organizationId)
    .contains("metadata", { source: "quick_drop" })
    .order("changed_at", { ascending: false })
    .limit(50)
    .returns<{ order_id: string }[]>();
  if (sourceError || !sources?.length) {
    if (sourceError) console.error("Pending Quick Drop source query failed", sourceError.code);
    return [];
  }

  const orderIds = [...new Set(sources.map((source) => source.order_id))];
  const [ordersResult, itemsResult] = await Promise.all([
    supabase.from("orders")
      .select("id, order_number, received_at, customer:customers!orders_customer_same_organization!inner(display_name)")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("production_status", "received")
      .in("id", orderIds)
      .order("received_at", { ascending: false })
      .returns<PendingOrderRow[]>(),
    supabase.from("order_items")
      .select("order_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("order_id", orderIds)
      .returns<{ order_id: string }[]>(),
  ]);
  if (ordersResult.error || itemsResult.error) {
    console.error("Pending Quick Drop list query failed", ordersResult.error?.code ?? itemsResult.error?.code);
    return [];
  }

  const detailedIds = new Set((itemsResult.data ?? []).map((item) => item.order_id));
  return (ordersResult.data ?? []).filter((order) => order.received_at && !detailedIds.has(order.id)).map((order) => ({
    customerName: Array.isArray(order.customer) ? order.customer[0]?.display_name ?? "" : order.customer?.display_name ?? "",
    id: order.id,
    orderNumber: order.order_number,
    receivedAt: order.received_at!,
  }));
}
