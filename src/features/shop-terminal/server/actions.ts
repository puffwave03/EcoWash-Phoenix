"use server";

import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { listShopServices } from "@/features/shop-terminal/server/queries";
import type { ShopCustomerState, ShopService, ShopSubmitState } from "@/features/shop-terminal/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\d\s.-]{3,32}$/;

export async function loadShopServicesAction(
  locale: string,
  customerId: string,
  locationId: string | null,
): Promise<ShopService[]> {
  if (!UUID.test(customerId) || (locationId && !UUID.test(locationId))) return [];
  return listShopServices(locale, customerId, locationId);
}

export async function createShopCustomerAction(
  locale: string,
  _state: ShopCustomerState,
  formData: FormData,
): Promise<ShopCustomerState> {
  const name = String(formData.get("displayName") ?? "").trim().slice(0, 160);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const isWalkIn = formData.get("customerKind") === "walk_in";
  if (!name || (phone && !PHONE.test(phone)) || (email && !EMAIL.test(email))) {
    return { customer: null, error: "validation" };
  }

  const { membership, user } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("customers").insert({
    billing_country_code: "ES",
    created_by: user.id,
    customer_code: isWalkIn ? `WALKIN-${crypto.randomUUID().toUpperCase()}` : null,
    customer_type: "individual",
    display_name: name,
    email: email || null,
    is_active: true,
    notes: isWalkIn ? "Occasional customer created at the shop terminal." : null,
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
  if (!UUID.test(customerId) || !UUID.test(idempotencyKey) || (locationId && !UUID.test(locationId))
    || (sessionId && !UUID.test(sessionId)) || !Number.isFinite(discountAmount)
    || !Array.isArray(payload.items) || payload.items.length < 1 || !Array.isArray(payload.payments)) {
    return { error: "validation", result: null };
  }

  await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_shop_terminal_order", {
    target_customer_id: customerId,
    target_customer_notes: typeof payload.customerNotes === "string" ? payload.customerNotes.slice(0, 600) : null,
    target_discount_amount: Math.round(discountAmount * 100) / 100,
    target_due_at: typeof payload.dueAt === "string" && payload.dueAt ? payload.dueAt : null,
    target_idempotency_key: idempotencyKey,
    target_internal_notes: typeof payload.internalNotes === "string" ? payload.internalNotes.slice(0, 600) : null,
    target_items: payload.items,
    target_location_id: locationId,
    target_payments: payload.payments,
    target_pos_session_id: sessionId,
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
      dueAt: typeof payload.dueAt === "string" && payload.dueAt ? payload.dueAt : null,
      orderId: data.order_id,
      orderNumber: data.order_number,
      outstanding: Number(data.outstanding),
      paid: Number(data.paid),
      subtotal: Number(data.subtotal),
      total: Number(data.total),
    },
  };
}
