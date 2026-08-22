"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperationalCapability } from "@/lib/auth/require-capability";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAssignableStaffForCapability } from "@/features/logistics/server/queries";
import type {
  FulfillmentStatus,
  LogisticsActionState,
} from "@/features/logistics/types";
import {
  optionalDbValue,
  parseFulfillmentStatus,
  parseLogisticsForm,
} from "@/features/logistics/validation";
import type { AppRole } from "@/lib/auth/types";

const initialState: LogisticsActionState = { fieldErrors: {}, formError: null, success: false };
const ASSIGNMENT_ROLES: AppRole[] = ["owner", "manager"];
type LogisticsTransitionSurface = "order" | "workspace";

function transitionLeavesLogisticsSurface(
  surface: LogisticsTransitionSurface,
  targetStatus: FulfillmentStatus,
) {
  return surface === "workspace" && ["completed", "cancelled"].includes(targetStatus);
}

function logisticsWorkspacePath(locale: string, kind: "deliveries" | "pickups") {
  return `/${locale}/app/work/${kind}`;
}

function fail(fieldErrors: Record<string, string> = {}, formError: string | null = "generic") {
  return { fieldErrors, formError, success: false };
}

function revalidateOrder(locale: string, orderId: string) {
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/delivery`);
  revalidatePath(`/${locale}/app/work`);
  revalidatePath(`/${locale}/app/work/deliveries`);
  revalidatePath(`/${locale}/app/work/pickups`);
}

async function existingAssignment(table: "deliveries" | "pickups", organizationId: string, orderId: string, recordId: string) {
  if (!recordId) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(table)
    .select("assigned_to")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .eq("id", recordId)
    .maybeSingle<{ assigned_to: string | null }>();

  if (error) {
    console.error("Logistics assignment lookup failed", error.code);
    return null;
  }

  return data?.assigned_to ?? null;
}

async function assignmentForRole({
  capability,
  inputAssignedTo,
  locale,
  orderId,
  organizationId,
  recordId,
  role,
  table,
}: {
  capability: "delivery" | "pickup";
  inputAssignedTo: string;
  locale: string;
  orderId: string;
  organizationId: string;
  recordId: string;
  role: AppRole;
  table: "deliveries" | "pickups";
}) {
  if (ASSIGNMENT_ROLES.includes(role)) {
    if (!inputAssignedTo) return { assignedTo: null, valid: true };

    return {
      assignedTo: inputAssignedTo,
      valid: await isAssignableStaffForCapability(locale, inputAssignedTo, capability),
    };
  }

  return {
    assignedTo: await existingAssignment(table, organizationId, orderId, recordId),
    valid: true,
  };
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

  const { membership } = await requireOperationalCapability(locale, "pickup");
  const assignment = await assignmentForRole({
    capability: "pickup",
    inputAssignedTo: input.assignedTo,
    locale,
    orderId,
    organizationId: membership.organization.id,
    recordId: input.recordId,
    role: membership.role,
    table: "pickups",
  });
  if (!assignment.valid) return fail({ assignedTo: "invalid" }, null);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_or_update_pickup", {
    target_address_line1: optionalDbValue(input.addressLine1),
    target_address_line2: optionalDbValue(input.addressLine2),
    target_assigned_to: optionalDbValue(assignment.assignedTo ?? ""),
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
  return { fieldErrors: {}, formError: null, success: true };
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

  const { membership } = await requireOperationalCapability(locale, "delivery");
  const assignment = await assignmentForRole({
    capability: "delivery",
    inputAssignedTo: input.assignedTo,
    locale,
    orderId,
    organizationId: membership.organization.id,
    recordId: input.recordId,
    role: membership.role,
    table: "deliveries",
  });
  if (!assignment.valid) return fail({ assignedTo: "invalid" }, null);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_or_update_delivery", {
    target_address_line1: optionalDbValue(input.addressLine1),
    target_address_line2: optionalDbValue(input.addressLine2),
    target_assigned_to: optionalDbValue(assignment.assignedTo ?? ""),
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
  return { fieldErrors: {}, formError: null, success: true };
}

export async function transitionPickupAction(
  locale: string,
  orderId: string,
  surface: LogisticsTransitionSurface,
  formData: FormData,
) {
  const pickupId = String(formData.get("recordId") ?? "");
  const targetStatus = parseFulfillmentStatus(String(formData.get("targetStatus") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 600);

  if (!pickupId || !targetStatus) return;

  const { membership, profile } = await requireOperationalCapability(locale, "pickup");
  const supabase = await createSupabaseServerClient();
  const { data: pickup, error: pickupError } = await supabase
    .from("pickups")
    .select("assigned_to")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .eq("id", pickupId)
    .maybeSingle<{ assigned_to: string | null }>();

  if (
    pickupError ||
    !pickup ||
    (membership.role === "staff" && pickup.assigned_to !== profile.id)
  ) {
    if (pickupError) console.error("Pickup transition authorization failed", pickupError.code);
    return;
  }

  const { error } = await supabase.rpc("transition_pickup_status", {
    target_pickup_id: pickupId,
    target_reason: optionalDbValue(reason),
    target_status: targetStatus,
  });

  if (error) {
    console.error("Pickup transition failed", error.code);
    return;
  }

  revalidateOrder(locale, orderId);
  revalidatePath(`/${locale}/app/work/pickups/${pickupId}`);

  if (transitionLeavesLogisticsSurface(surface, targetStatus)) {
    redirect(logisticsWorkspacePath(locale, "pickups"));
  }
}

export async function transitionDeliveryAction(
  locale: string,
  orderId: string,
  surface: LogisticsTransitionSurface,
  formData: FormData,
) {
  const deliveryId = String(formData.get("recordId") ?? "");
  const targetStatus = parseFulfillmentStatus(String(formData.get("targetStatus") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 600);

  if (!deliveryId || !targetStatus) return;

  const { membership, profile } = await requireOperationalCapability(locale, "delivery");
  const supabase = await createSupabaseServerClient();
  const { data: delivery, error: deliveryError } = await supabase
    .from("deliveries")
    .select("assigned_to")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .eq("id", deliveryId)
    .maybeSingle<{ assigned_to: string | null }>();

  if (
    deliveryError ||
    !delivery ||
    (membership.role === "staff" && delivery.assigned_to !== profile.id)
  ) {
    if (deliveryError) console.error("Delivery transition authorization failed", deliveryError.code);
    return;
  }

  const { error } = await supabase.rpc("transition_delivery_status", {
    target_delivery_id: deliveryId,
    target_reason: optionalDbValue(reason),
    target_status: targetStatus,
  });

  if (error) {
    console.error("Delivery transition failed", error.code);
    return;
  }

  revalidateOrder(locale, orderId);
  revalidatePath(`/${locale}/app/work/deliveries/${deliveryId}`);

  if (transitionLeavesLogisticsSurface(surface, targetStatus)) {
    redirect(logisticsWorkspacePath(locale, "deliveries"));
  }
}
