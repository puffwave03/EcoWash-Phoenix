"use server";

import { revalidatePath } from "next/cache";
import { createOrderCode } from "@/features/barcode/payload";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import type { QuickDropCreateResult } from "@/features/quick-drop/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE = /^[+()\d\s.-]{3,32}$/;

function optionalTimestamp(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export async function createQuickDropAction(locale: string, formData: FormData): Promise<QuickDropCreateResult> {
  const customerId = String(formData.get("customerId") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const walkInName = String(formData.get("walkInName") ?? "").trim().slice(0, 160);
  const walkInPhone = String(formData.get("walkInPhone") ?? "").trim().slice(0, 40);
  const dueAt = optionalTimestamp(formData.get("dueAt"));
  if (!UUID.test(customerId) || !UUID.test(idempotencyKey) || !UUID.test(locationId)
    || note.length > 600 || (walkInPhone && !PHONE.test(walkInPhone)) || dueAt === undefined) {
    return { error: "validation", order: null };
  }

  await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_quick_drop_order", {
    target_customer_id: customerId,
    target_due_at: dueAt,
    target_idempotency_key: idempotencyKey,
    target_location_id: locationId,
    target_note: note || null,
    target_walk_in_name: walkInName || null,
    target_walk_in_phone: walkInPhone || null,
  }).single<{ order_id: string; order_number: string; received_at: string }>();

  if (error || !data) {
    console.error("Quick Drop create failed", error?.code ?? "unknown");
    return { error: "generic", order: null };
  }

  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/orders`);
  revalidatePath(`/${locale}/app/orders/${data.order_id}`);
  revalidatePath(`/${locale}/app/shop`);
  return {
    error: null,
    order: {
      customerId,
      detailState: "pending_detail",
      dueAt,
      financialState: "unpriced",
      id: data.order_id,
      orderCode: createOrderCode(data.order_id),
      orderNumber: data.order_number,
      receivedAt: data.received_at,
      walkInName: walkInName || null,
      walkInPhone: walkInPhone || null,
    },
  };
}
