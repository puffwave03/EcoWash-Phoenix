"use server";

import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { loadShopDeliveryOptions as queryShopDeliveryOptions, listShopServices } from "@/features/shop-terminal/server/queries";
import type { ShopCatalogSelection, ShopCustomerState, ShopDeliveryOptions, ShopSubmitState } from "@/features/shop-terminal/types";
import type { ShopCodeResolveResult } from "@/features/shop-terminal/types";
import { parsePhoenixCode } from "@/features/barcode/payload";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { isDiscreteServiceUnit, type ServiceUnitType } from "@/features/services/types";
import { organizationDateTimeLocalToIso } from "@/lib/organization-timezone";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER = /^[a-z]{2,12}-\d{1,12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\d\s.-]{3,32}$/;
const DATE_TIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function resolveShopCodeAction(locale: string, raw: string): Promise<ShopCodeResolveResult> {
  const { membership } = await requireShopTerminalAccess(locale);
  await requireEntitlement(locale, FEATURES.barcode);
  const input = raw.trim();
  const orderNumber = ORDER_NUMBER.test(input) ? input.toUpperCase() : null;
  const orderId = ORDER_ID.test(input) ? input : null;
  const parsed = orderNumber || orderId ? null : parsePhoenixCode(input);
  if (!orderNumber && !orderId && !parsed) return { error: "invalid", orderId: null, orderNumber: null };

  const supabase = await createSupabaseServerClient();
  const orderQuery = supabase.from("orders")
    .select("id, order_number")
    .eq("organization_id", membership.organization.id);
  const { data: order, error: orderError } = await (orderNumber
    ? orderQuery.eq("order_number", orderNumber)
    : orderQuery.eq("id", orderId ?? parsed!.orderId))
    .maybeSingle<{ id: string; order_number: string }>();
  if (orderError || !order) {
    if (orderError) console.error("Shop code order resolution failed", orderError.code);
    return { error: "not_found", orderId: null, orderNumber: null };
  }

  if (parsed?.kind === "label") {
    const { data: item, error: itemError } = await supabase.from("order_items")
      .select("id, quantity, unit_type")
      .eq("organization_id", membership.organization.id)
      .eq("order_id", order.id)
      .eq("id", parsed.itemId)
      .eq("is_active", true)
      .maybeSingle<{ id: string; quantity: number; unit_type: ServiceUnitType }>();
    const expectedUnitIndex = item && !isDiscreteServiceUnit(item.unit_type) ? 0 : parsed.unitIndex;
    const validDiscreteUnit = item && isDiscreteServiceUnit(item.unit_type)
      ? parsed.unitIndex >= 1 && parsed.unitIndex <= Math.max(1, Math.trunc(Number(item.quantity)))
      : parsed.unitIndex === 0;
    if (itemError || !item || expectedUnitIndex !== parsed.unitIndex || !validDiscreteUnit) {
      if (itemError) console.error("Shop code label resolution failed", itemError.code);
      return { error: "not_found", orderId: null, orderNumber: null };
    }
  }

  return { error: null, orderId: order.id, orderNumber: order.order_number };
}

export async function loadShopServicesAction(
  locale: string,
  customerId: string,
  locationId: string | null,
): Promise<ShopCatalogSelection> {
  if (!UUID.test(customerId) || (locationId && !UUID.test(locationId))) return { segmentName: null, services: [] };
  return listShopServices(locale, customerId, locationId);
}

export async function loadShopDeliveryOptionsAction(locale: string, customerId: string): Promise<ShopDeliveryOptions> {
  if (!UUID.test(customerId)) return { billing: null, properties: [] };
  return queryShopDeliveryOptions(locale, customerId);
}

export async function createShopCustomerAction(
  locale: string,
  _state: ShopCustomerState,
  formData: FormData,
): Promise<ShopCustomerState> {
  const isWalkIn = formData.get("customerKind") === "walk_in";
  const name = String(formData.get("displayName") ?? "").trim().slice(0, 160);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  if ((!isWalkIn && !name) || (phone && !PHONE.test(phone)) || (email && (!EMAIL.test(email) || isWalkIn))) {
    return { customer: null, error: "validation" };
  }

  const { membership, user } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  if (isWalkIn) {
    const { data: sharedCustomerId, error } = await supabase.rpc("resolve_shared_walk_in_customer");
    if (error || typeof sharedCustomerId !== "string") {
      console.error("Shared walk-in customer resolution failed", error?.code);
      return { customer: null, error: "generic" };
    }
    return {
      customer: {
        email: null,
        id: sharedCustomerId,
        isWalkIn: true,
        name,
        phone: phone || null,
        updatedAt: new Date().toISOString(),
      },
      error: null,
    };
  }

  const { data, error } = await supabase.from("customers").insert({
    billing_country_code: "ES",
    created_by: user.id,
    customer_code: null,
    customer_type: "individual",
    display_name: name,
    email: email || null,
    is_active: true,
    notes: null,
    organization_id: membership.organization.id,
    phone: phone || null,
    preferred_locale: routing.locales.includes(locale as (typeof routing.locales)[number]) ? locale : "es",
    updated_by: user.id,
  }).select("id, customer_code, display_name, email, phone, updated_at").single<{
    customer_code: string | null; display_name: string; email: string | null; id: string; phone: string | null; updated_at: string;
  }>();

  if (error || !data) {
    console.error("Shop customer create failed", error?.code);
    return { customer: null, error: "generic" };
  }

  revalidatePath(`/${locale}/app/shop`);
  return { customer: { email: data.email, id: data.id, isWalkIn: data.customer_code?.startsWith("WALKIN-") ?? false, name: data.display_name, phone: data.phone, updatedAt: data.updated_at }, error: null };
}

type SubmitPayload = {
  customerId?: unknown;
  customerName?: unknown;
  customerNotes?: unknown;
  discountAmount?: unknown;
  dueAt?: unknown;
  idempotencyKey?: unknown;
  internalNotes?: unknown;
  items?: unknown;
  locationId?: unknown;
  payments?: unknown;
  sessionId?: unknown;
  isWalkIn?: unknown;
  walkInName?: unknown;
  walkInPhone?: unknown;
  productionAssigneeId?: unknown;
  deliveryRequested?: unknown;
  delivery?: {
    addressLine1?: unknown;
    addressLine2?: unknown;
    assignedTo?: unknown;
    city?: unknown;
    contactName?: unknown;
    contactPhone?: unknown;
    countryCode?: unknown;
    notes?: unknown;
    postalCode?: unknown;
    scheduledAt?: unknown;
  };
};

export async function submitShopOrderAction(
  locale: string,
  _state: ShopSubmitState,
  formData: FormData,
): Promise<ShopSubmitState> {
  let payload: SubmitPayload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "")) as SubmitPayload;
  } catch {
    return { error: "validation", result: null };
  }

  const customerId = typeof payload.customerId === "string" ? payload.customerId : "";
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : "";
  const locationId = typeof payload.locationId === "string" && payload.locationId ? payload.locationId : null;
  const sessionId = typeof payload.sessionId === "string" && payload.sessionId ? payload.sessionId : null;
  const discountAmount = Number(payload.discountAmount);
  const walkInName = typeof payload.walkInName === "string" ? payload.walkInName.trim().slice(0, 160) : null;
  const walkInPhone = typeof payload.walkInPhone === "string" ? payload.walkInPhone.trim().slice(0, 40) : null;
  const dueAt = typeof payload.dueAt === "string" ? payload.dueAt : "";
  const productionAssigneeId = typeof payload.productionAssigneeId === "string" && payload.productionAssigneeId ? payload.productionAssigneeId : null;
  const deliveryRequested = payload.deliveryRequested === true;
  const delivery = payload.delivery && typeof payload.delivery === "object" ? payload.delivery : null;
  const deliveryAssignedTo = typeof delivery?.assignedTo === "string" && delivery.assignedTo ? delivery.assignedTo : null;
  const deliveryScheduledAt = typeof delivery?.scheduledAt === "string" ? delivery.scheduledAt : "";
  const deliveryAddressLine1 = typeof delivery?.addressLine1 === "string" ? delivery.addressLine1.trim().slice(0, 240) : "";
  const deliveryContactPhone = typeof delivery?.contactPhone === "string" ? delivery.contactPhone.trim().slice(0, 40) : "";
  if (!UUID.test(customerId) || !UUID.test(idempotencyKey) || (locationId && !UUID.test(locationId))
    || (sessionId && !UUID.test(sessionId)) || !Number.isFinite(discountAmount)
    || !dueAt || Number.isNaN(Date.parse(dueAt)) || (productionAssigneeId && !UUID.test(productionAssigneeId))
    || (deliveryAssignedTo && !UUID.test(deliveryAssignedTo))
    || (deliveryRequested && (!delivery || !DATE_TIME_LOCAL.test(deliveryScheduledAt) || !deliveryAddressLine1))
    || (deliveryRequested && deliveryContactPhone && !PHONE.test(deliveryContactPhone))
    || (walkInPhone && !PHONE.test(walkInPhone))
    || !Array.isArray(payload.items) || payload.items.length < 1 || !Array.isArray(payload.payments)) {
    return { error: "validation", result: null };
  }

  const { membership } = await requireShopTerminalAccess(locale);
  const normalizedDeliveryScheduledAt = deliveryRequested
    ? organizationDateTimeLocalToIso(deliveryScheduledAt, membership.organization.timezone)
    : null;
  if (deliveryRequested && !normalizedDeliveryScheduledAt) {
    return { error: "validation", result: null };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_shop_terminal_order", {
    target_customer_id: customerId,
    target_customer_notes: typeof payload.customerNotes === "string" ? payload.customerNotes.slice(0, 600) : null,
    target_discount_amount: Math.round(discountAmount * 100) / 100,
    target_due_at: dueAt,
    target_idempotency_key: idempotencyKey,
    target_internal_notes: typeof payload.internalNotes === "string" ? payload.internalNotes.slice(0, 600) : null,
    target_items: payload.items,
    target_location_id: locationId,
    target_payments: payload.payments,
    target_pos_session_id: sessionId,
    target_walk_in_name: walkInName || null,
    target_walk_in_phone: walkInPhone || null,
    target_production_assignee_id: productionAssigneeId,
    target_delivery_requested: deliveryRequested,
    target_delivery_scheduled_at: normalizedDeliveryScheduledAt,
    target_delivery_assigned_to: deliveryRequested ? deliveryAssignedTo : null,
    target_delivery_address_line1: deliveryRequested ? deliveryAddressLine1 : null,
    target_delivery_address_line2: deliveryRequested && typeof delivery?.addressLine2 === "string" ? delivery.addressLine2.slice(0, 240) : null,
    target_delivery_city: deliveryRequested && typeof delivery?.city === "string" ? delivery.city.slice(0, 120) : null,
    target_delivery_postal_code: deliveryRequested && typeof delivery?.postalCode === "string" ? delivery.postalCode.slice(0, 40) : null,
    target_delivery_country_code: deliveryRequested && typeof delivery?.countryCode === "string" ? delivery.countryCode.slice(0, 2) : null,
    target_delivery_contact_name: deliveryRequested && typeof delivery?.contactName === "string" ? delivery.contactName.slice(0, 160) : null,
    target_delivery_contact_phone: deliveryRequested ? deliveryContactPhone || null : null,
    target_delivery_notes: deliveryRequested && typeof delivery?.notes === "string" ? delivery.notes.slice(0, 600) : null,
  }).single<{
    discount_amount: number; order_id: string; order_number: string; outstanding: number; paid: number; subtotal: number; total: number;
  }>();

  if (error || !data) {
    console.error("Shop order submit failed", error?.code);
    const known = error?.message.includes("session") ? "till" : error?.message.includes("discount") ? "discount" : "generic";
    return { error: known, result: null };
  }

  revalidatePath(`/${locale}/app/shop`);
  revalidatePath(`/${locale}/app/orders`);
  revalidatePath(`/${locale}/app/pos`);
  revalidatePath(`/${locale}/app/customers/${customerId}`);
  revalidatePath(`/${locale}/app/billing`);
  return {
    error: null,
    result: {
      customerId,
      customerName: typeof payload.customerName === "string" ? payload.customerName.slice(0, 160) : "",
      discountAmount: Number(data.discount_amount),
      dueAt,
      isWalkIn: payload.isWalkIn === true,
      orderId: data.order_id,
      orderNumber: data.order_number,
      outstanding: Number(data.outstanding),
      paid: Number(data.paid),
      subtotal: Number(data.subtotal),
      total: Number(data.total),
    },
  };
}
