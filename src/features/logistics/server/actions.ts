"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LogisticsActionState } from "@/features/logistics/types";
import {
  optionalDbValue,
  parseFulfillmentStatus,
  parseLogisticsForm,
} from "@/features/logistics/validation";

const initialState: LogisticsActionState = { fieldErrors: {}, formError: null };

function fail(fieldErrors: Record<string, string> = {}, formError: string | null = "generic") {
  return { fieldErrors, formError };
}

function revalidateOrder(locale: string, orderId: string) {
  revalidatePath(`/${locale}/app/orders/${orderId}`);
}

export async function savePickupAction(
  locale: string,
  orderId: string,
  _state: LogisticsActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { fieldErrors, input, valid } = parseLogisticsForm(formData);
  if (!valid) return fail(fieldErrors, null);

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_or_update_pickup", {
    target_address_line1: optionalDbValue(input.addressLine1),
    target_address_line2: optionalDbValue(input.addressLine2),
    target_assigned_to: optionalDbValue(input.assignedTo),
    target_city: optionalDbValue(input.city),
    target_contact_name: optionalDbValue(input.contactName),
    target_contact_phone: optionalDbValue(input.contactPhone),
    target_country_code: optionalDbValue(input.countryCode),
    target_fee: input.fee,
    target_notes: optionalDbValue(input.notes),
    target_order_id: orderId,
    target_pickup_id: optionalDbValue(input.recordId),
    target_postal_code: optionalDbValue(input.postalCode),
    target_scheduled_at: optionalDbValue(input.scheduledAt),
  });

  if (error) {
    console.error("Pickup save failed", error.code);
    return fail();
  }

  revalidateOrder(locale, orderId);
  return initialState;
}

export async function saveDeliveryAction(
  locale: string,
  orderId: string,
  _state: LogisticsActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { fieldErrors, input, valid } = parseLogisticsForm(formData);
  if (!valid) return fail(fieldErrors, null);

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_or_update_delivery", {
    target_address_line1: optionalDbValue(input.addressLine1),
    target_address_line2: optionalDbValue(input.addressLine2),
    target_assigned_to: optionalDbValue(input.assignedTo),
    target_city: optionalDbValue(input.city),
    target_contact_name: optionalDbValue(input.contactName),
    target_contact_phone: optionalDbValue(input.contactPhone),
    target_country_code: optionalDbValue(input.countryCode),
    target_fee: input.fee,
    target_notes: optionalDbValue(input.notes),
    target_order_id: orderId,
    target_delivery_id: optionalDbValue(input.recordId),
    target_postal_code: optionalDbValue(input.postalCode),
    target_scheduled_at: optionalDbValue(input.scheduledAt),
  });

  if (error) {
    console.error("Delivery save failed", error.code);
    return fail();
  }

  revalidateOrder(locale, orderId);
  return initialState;
}

export async function transitionPickupAction(locale: string, orderId: string, formData: FormData) {
  const pickupId = String(formData.get("recordId") ?? "");
  const targetStatus = parseFulfillmentStatus(String(formData.get("targetStatus") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 600);

  if (!pickupId || !targetStatus) return;

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_pickup_status", {
    target_pickup_id: pickupId,
    target_reason: optionalDbValue(reason),
    target_status: targetStatus,
  });

  if (error) console.error("Pickup transition failed", error.code);
  revalidateOrder(locale, orderId);
}

export async function transitionDeliveryAction(locale: string, orderId: string, formData: FormData) {
  const deliveryId = String(formData.get("recordId") ?? "");
  const targetStatus = parseFulfillmentStatus(String(formData.get("targetStatus") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 600);

  if (!deliveryId || !targetStatus) return;

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_delivery_status", {
    target_delivery_id: deliveryId,
    target_reason: optionalDbValue(reason),
    target_status: targetStatus,
  });

  if (error) console.error("Delivery transition failed", error.code);
  revalidateOrder(locale, orderId);
}
