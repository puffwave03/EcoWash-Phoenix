"use server";

import { revalidatePath } from "next/cache";
import type { OrderStorageActionState, OrderStorageMode } from "@/features/warehouse/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_MODES: OrderStorageMode[] = ["folded", "hanging", "mixed", "other"];
const initialState: OrderStorageActionState = { fieldErrors: {}, formError: null, success: false };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveOrderStorageAssignmentAction(
  locale: string,
  orderId: string,
  _state: OrderStorageActionState = initialState,
  formData: FormData,
): Promise<OrderStorageActionState> {
  void _state;
  const { membership } = await requireOwnerOrManager(locale);
  const positionId = value(formData, "positionId");
  const packageCountValue = value(formData, "packageCount");
  const storageMode = value(formData, "storageMode") as OrderStorageMode;
  const packageCount = Number(packageCountValue);
  const fieldErrors: Record<string, string> = {};

  if (!UUID.test(orderId)) fieldErrors.orderId = "invalid";
  if (!UUID.test(positionId)) fieldErrors.positionId = "invalid";
  if (!/^\d+$/.test(packageCountValue) || !Number.isSafeInteger(packageCount) || packageCount < 1 || packageCount > 2_147_483_647) {
    fieldErrors.packageCount = "invalid";
  }
  if (!STORAGE_MODES.includes(storageMode)) fieldErrors.storageMode = "invalid";
  if (Object.keys(fieldErrors).length) return { ...initialState, fieldErrors };

  const admin = createSupabaseAdminClient();
  const { data: order, error: orderError } = await admin.from("orders")
    .select("id, location_id")
    .eq("organization_id", membership.organization.id)
    .eq("id", orderId)
    .maybeSingle<{ id: string; location_id: string | null }>();
  if (orderError) return { ...initialState, formError: "generic" };
  if (!order) return { ...initialState, formError: "notFound" };
  if (!order.location_id) return { ...initialState, formError: "orderLocation" };

  const [{ data: location, error: locationError }, { data: position, error: positionError }] = await Promise.all([
    admin.from("locations")
      .select("id")
      .eq("organization_id", membership.organization.id)
      .eq("id", order.location_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>(),
    admin.from("warehouse_positions")
      .select("id")
      .eq("organization_id", membership.organization.id)
      .eq("location_id", order.location_id)
      .eq("id", positionId)
      .eq("is_active", true)
      .maybeSingle<{ id: string }>(),
  ]);
  if (locationError || positionError) return { ...initialState, formError: "generic" };
  if (!location) return { ...initialState, formError: "orderLocation" };
  if (!position) return { ...initialState, formError: "position" };

  const { data: existing, error: existingError } = await admin.from("order_storage")
    .select("id, warehouse_position_id")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .maybeSingle<{ id: string; warehouse_position_id: string }>();
  if (existingError) return { ...initialState, formError: "generic" };

  if (existing) {
    const update: {
      entered_at?: string;
      package_count: number;
      storage_mode: OrderStorageMode;
      warehouse_position_id: string;
    } = {
      package_count: packageCount,
      storage_mode: storageMode,
      warehouse_position_id: positionId,
    };
    if (existing.warehouse_position_id !== positionId) update.entered_at = new Date().toISOString();

    const { data, error } = await admin.from("order_storage")
      .update(update)
      .eq("organization_id", membership.organization.id)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error) return { ...initialState, formError: error.code === "22023" ? "position" : "generic" };
    if (!data) return { ...initialState, formError: "notFound" };
  } else {
    const { error } = await admin.from("order_storage").insert({
      location_id: order.location_id,
      order_id: orderId,
      organization_id: membership.organization.id,
      package_count: packageCount,
      storage_mode: storageMode,
      warehouse_position_id: positionId,
    });
    if (error) return { ...initialState, formError: error.code === "22023" ? "position" : "generic" };
  }

  revalidatePath(`/${locale}/app/orders/${orderId}`);
  return { ...initialState, success: true };
}
