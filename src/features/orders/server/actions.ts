"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import { hasOperationalCapability } from "@/lib/auth/capabilities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderActionState, ProductionStatus } from "@/features/orders/types";
import {
  isUuid,
  optionalDbValue,
  parseOrderForm,
  parseOrderItemForm,
  parseProductionStatus,
} from "@/features/orders/validation";
import { FINAL_PRODUCTION_STATUSES } from "@/features/orders/workflow";

const initialState: OrderActionState = { fieldErrors: {}, formError: null, success: false };
const ASSIGNMENT_ROLES = ["owner", "manager"] as const;
type ProductionTransitionSurface = "order" | "production" | "quality";

function transitionLeavesSurface(
  surface: ProductionTransitionSurface,
  targetStatus: ProductionStatus,
) {
  if (surface === "production") {
    return FINAL_PRODUCTION_STATUSES.includes(targetStatus);
  }

  if (surface === "quality") {
    return targetStatus === "ready" || FINAL_PRODUCTION_STATUSES.includes(targetStatus);
  }

  return false;
}

function productionSurfacePath(locale: string, surface: ProductionTransitionSurface) {
  if (surface === "quality") return `/${locale}/app/work/quality`;

  return `/${locale}/app/work/production`;
}

function fail(
  formError: OrderActionState["formError"] = "generic",
  fieldErrors: Record<string, string> = {},
): OrderActionState {
  return { fieldErrors, formError, success: false };
}

function revalidateOrders(locale: string, orderId?: string) {
  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/orders`);
  revalidatePath(`/${locale}/app/production`);
  revalidatePath(`/${locale}/app/work`);
  revalidatePath(`/${locale}/app/work/production`);
  revalidatePath(`/${locale}/app/work/quality`);
  if (orderId) {
    revalidatePath(`/${locale}/app/orders/${orderId}`);
    revalidatePath(`/${locale}/app/work/production/${orderId}`);
    revalidatePath(`/${locale}/app/work/quality/${orderId}`);
  }
}

function optionalAssignment(value: FormDataEntryValue | null) {
  const assignedTo = String(value ?? "").trim();

  return assignedTo === "" || isUuid(assignedTo) ? assignedTo : null;
}

export async function createOrderAction(
  locale: string,
  _state: OrderActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { input, fieldErrors, valid } = parseOrderForm(formData);
  if (!valid) return fail(null, fieldErrors);

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("create_order", {
      target_customer_id: input.customerId,
      target_customer_notes: optionalDbValue(input.customerNotes),
      target_due_at: optionalDbValue(input.dueAt),
      target_internal_notes: optionalDbValue(input.internalNotes),
      target_location_id: optionalDbValue(input.locationId),
      target_priority: input.priority,
      target_property_id: optionalDbValue(input.propertyId),
    })
    .single<{ id: string; order_number: string }>();

  if (error || !data) {
    console.error("Order create failed", error?.code ?? "unknown");
    return fail("generic");
  }

  revalidateOrders(locale, data.id);
  redirect(`/${locale}/app/orders/${data.id}`);
}

export async function updateOrderAction(
  locale: string,
  orderId: string,
  _state: OrderActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { input, fieldErrors, valid } = parseOrderForm(formData);
  if (!valid) return fail(null, fieldErrors);

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_order_details", {
    target_customer_notes: optionalDbValue(input.customerNotes),
    target_due_at: optionalDbValue(input.dueAt),
    target_internal_notes: optionalDbValue(input.internalNotes),
    target_order_id: orderId,
    target_priority: input.priority,
  });

  if (error) {
    console.error("Order update failed", error.code);
    return fail("generic");
  }

  revalidateOrders(locale, orderId);
  redirect(`/${locale}/app/orders/${orderId}`);
}

export async function updateOrderAssignmentAction(
  locale: string,
  orderId: string,
  _state: OrderActionState = initialState,
  formData: FormData,
) {
  void _state;

  const assignedTo = optionalAssignment(formData.get("assignedTo"));
  if (assignedTo === null) return { fieldErrors: { assignedTo: "invalid" }, formError: null, success: false };

  const { membership } = await requireMembership(locale);
  if (!ASSIGNMENT_ROLES.includes(membership.role as (typeof ASSIGNMENT_ROLES)[number])) {
    return fail("generic");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_order_assignment", {
    target_assigned_to: optionalDbValue(assignedTo),
    target_order_id: orderId,
  });

  if (error) {
    console.error("Order assignment update failed", error.code);
    return fail("generic");
  }

  revalidateOrders(locale, orderId);
  return { fieldErrors: {}, formError: null, success: true };
}

export async function saveOrderItemAction(
  locale: string,
  orderId: string,
  _state: OrderActionState = initialState,
  formData: FormData,
) {
  void _state;

  formData.set("orderId", orderId);
  const { input, fieldErrors, valid } = parseOrderItemForm(formData);
  if (!valid) return fail(null, fieldErrors);

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_order_item", {
    target_description: optionalDbValue(input.description),
    target_item_id: optionalDbValue(input.itemId),
    target_notes: optionalDbValue(input.notes),
    target_order_id: input.orderId,
    target_quantity: input.quantity,
    target_service_id: optionalDbValue(input.serviceId),
    target_unit_price: input.unitPrice,
    target_unit_type: input.unitType,
  });

  if (error) {
    console.error("Order item save failed", error.code);
    return fail("generic");
  }

  revalidateOrders(locale, orderId);
  return initialState;
}

export async function removeOrderItemAction(
  locale: string,
  orderId: string,
  itemId: string,
) {
  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_order_item", {
    target_item_id: itemId,
    target_order_id: orderId,
  });

  if (error) console.error("Order item remove failed", error.code);

  revalidateOrders(locale, orderId);
}

export async function updateOrderDiscountAction(
  locale: string,
  orderId: string,
  formData: FormData,
) {
  const discount = Number(String(formData.get("discountAmount") ?? "0"));
  if (!Number.isFinite(discount) || discount < 0) return;

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_order_discount", {
    target_discount_amount: Math.round(discount * 100) / 100,
    target_order_id: orderId,
  });

  if (error) console.error("Order discount update failed", error.code);

  revalidateOrders(locale, orderId);
}

export async function transitionOrderStatusAction(
  locale: string,
  orderId: string,
  surface: ProductionTransitionSurface,
  formData: FormData,
) {
  const targetStatus = parseProductionStatus(String(formData.get("targetStatus") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 600);

  if (!targetStatus) return;

  const { membership, profile } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("assigned_to, production_status")
    .eq("organization_id", membership.organization.id)
    .eq("id", orderId)
    .maybeSingle<{ assigned_to: string | null; production_status: ProductionStatus }>();

  const requiredCapability = order && ["quality_check", "packing"].includes(order.production_status)
    ? "quality"
    : "production";

  if (
    orderError ||
    !order ||
    !hasOperationalCapability(membership, requiredCapability) ||
    (membership.role === "staff" && order.assigned_to !== profile.id)
  ) {
    if (orderError) console.error("Order transition authorization failed", orderError.code);
    return;
  }

  const { error } = await supabase.rpc("transition_order_status", {
    target_order_id: orderId,
    target_reason: optionalDbValue(reason),
    target_status: targetStatus,
  });

  if (error) {
    if (error.message.includes("quick_drop_detail_required")) {
      redirect(`/${locale}/app/orders/${orderId}#items`);
    }
    console.error("Order status transition failed", error.code);
    return;
  }

  revalidateOrders(locale, orderId);

  if (transitionLeavesSurface(surface, targetStatus)) {
    redirect(productionSurfacePath(locale, surface));
  }
}
