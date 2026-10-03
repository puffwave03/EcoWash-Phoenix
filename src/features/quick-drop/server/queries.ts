import "server-only";

import { getTranslations } from "next-intl/server";
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
  walk_in_name: string | null;
  walk_in_phone: string | null;
};

export async function getQuickDropOrderOrNull(locale: string, orderId: string): Promise<QuickDropOrder | null> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const organizationId = membership.organization.id;
  const [orderResult, itemResult, sourceResult] = await Promise.all([
    supabase.from("orders")
      .select("id, order_number, customer_id, production_status, received_at, due_at, subtotal, discount_amount, total, walk_in_name, walk_in_phone")
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
    walkInName: orderResult.data.walk_in_name,
    walkInPhone: orderResult.data.walk_in_phone,
  };
}

export async function getQuickDropOrder(locale: string, orderId: string): Promise<QuickDropOrder> {
  const order = await getQuickDropOrderOrNull(locale, orderId);
  if (!order) notFound();
  return order;
}

type PendingOrderRow = {
  customer_code: string | null;
  display_name: string;
  id: string;
  order_number: string;
  received_at: string;
  walk_in_name: string | null;
};

export async function listPendingQuickDrops(locale: string): Promise<PendingQuickDrop[]> {
  await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_pending_quick_drops").returns<PendingOrderRow[]>();
  if (error || !Array.isArray(data)) {
    console.error("Pending Quick Drop list query failed", error?.code ?? "invalid_response");
    return [];
  }

  const t = await getTranslations({ locale, namespace: "common.shopTerminal.labels" });
  return data.map((order) => ({
    customerName: order.walk_in_name ?? (order.customer_code === "WALKIN-SHARED" ? t("occasionalCustomer") : order.display_name),
    id: order.id,
    orderNumber: order.order_number,
    receivedAt: order.received_at,
  }));
}
