"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OrderStorageActionState, OrderStorageMode } from "@/features/warehouse/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  await requireOwnerOrManager(locale);
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_order_storage_assignment", {
    target_order_id: orderId,
    target_position_id: positionId,
    target_package_count: packageCount,
    target_storage_mode: storageMode,
  });
  if (error) {
    const formError = error.message.includes("warehouse_storage_order_location_invalid")
      ? "orderLocation" : error.message.includes("warehouse_storage_position_invalid")
        ? "position" : "generic";
    return { ...initialState, formError };
  }
  if (!data) return { ...initialState, formError: "generic" };

  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/warehouse`);
  return { ...initialState, success: true };
}

export async function returnCancelledOrderFromWarehouseAction(
  locale: string,
  orderId: string,
  formData: FormData,
): Promise<void> {
  await requireOwnerOrManager(locale);
  if (!UUID.test(orderId) || formData.get("confirmed") !== "yes") {
    redirect(`/${locale}/app/warehouse?returnError=1`);
  }
  const note = value(formData, "note");
  if (note.length > 500) redirect(`/${locale}/app/warehouse?returnError=1`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("return_cancelled_order_from_warehouse", {
    target_order_id: orderId,
    target_note: note || null,
  });
  if (error) {
    console.error("Cancelled Warehouse return failed", error.code);
    redirect(`/${locale}/app/warehouse?returnError=1`);
  }

  revalidatePath(`/${locale}/app/warehouse`);
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  redirect(`/${locale}/app/warehouse?returned=1`);
}
