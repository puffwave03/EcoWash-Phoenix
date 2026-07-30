"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderActionState } from "@/features/orders/types";
import {
  optionalDbValue,
  parseOrderForm,
  parseOrderItemForm,
  parseProductionStatus,
} from "@/features/orders/validation";

const initialState: OrderActionState = { fieldErrors: {}, formError: null };

function fail(
  formError: OrderActionState["formError"] = "generic",
  fieldErrors: Record<string, string> = {},
) {
  return { fieldErrors, formError };
}

function revalidateOrders(locale: string, orderId?: string) {
  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/orders`);
  if (orderId) revalidatePath(`/${locale}/app/orders/${orderId}`);
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
  formData: FormData,
) {
  const targetStatus = parseProductionStatus(String(formData.get("targetStatus") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 600);

  if (!targetStatus) return;

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_order_status", {
    target_order_id: orderId,
    target_reason: optionalDbValue(reason),
    target_status: targetStatus,
  });

  if (error) console.error("Order status transition failed", error.code);

  revalidateOrders(locale, orderId);
}
