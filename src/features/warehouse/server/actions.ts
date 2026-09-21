"use server";

import { revalidatePath } from "next/cache";
import type {
  WarehousePositionActionState,
  WarehousePositionType,
} from "@/features/warehouse/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITION_TYPES: WarehousePositionType[] = ["shelf", "rack", "hanger", "cabinet", "other"];
const initialState: WarehousePositionActionState = { fieldErrors: {}, formError: null, success: false };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(
  formError: WarehousePositionActionState["formError"] = null,
  fieldErrors: Record<string, string> = {},
): WarehousePositionActionState {
  return { fieldErrors, formError, success: false };
}

function revalidateWarehouse(locale: string) {
  revalidatePath(`/${locale}/app/settings/warehouse`);
}

function saveError(code: string | undefined) {
  if (code === "23505") return fail("duplicate");
  if (code === "22023") return fail("location");
  return fail("generic");
}

export async function saveWarehousePositionAction(
  locale: string,
  _state: WarehousePositionActionState = initialState,
  formData: FormData,
): Promise<WarehousePositionActionState> {
  void _state;
  const positionId = value(formData, "positionId") || null;
  const locationId = value(formData, "locationId");
  const code = value(formData, "code");
  const name = value(formData, "name");
  const description = value(formData, "description");
  const positionType = value(formData, "positionType") as WarehousePositionType;
  const fieldErrors: Record<string, string> = {};

  if (positionId && !UUID.test(positionId)) fieldErrors.positionId = "invalid";
  if (!UUID.test(locationId)) fieldErrors.locationId = "invalid";
  if (!code || code.length > 64) fieldErrors.code = "invalid";
  if (name.length > 160) fieldErrors.name = "invalid";
  if (description.length > 500) fieldErrors.description = "invalid";
  if (!POSITION_TYPES.includes(positionType)) fieldErrors.positionType = "invalid";
  if (Object.keys(fieldErrors).length) return fail(null, fieldErrors);

  const { membership } = await requireOwnerOrManager(locale);
  const admin = createSupabaseAdminClient();

  if (positionId) {
    const { data: existing, error: existingError } = await admin.from("warehouse_positions")
      .select("location_id")
      .eq("organization_id", membership.organization.id)
      .eq("id", positionId)
      .maybeSingle<{ location_id: string }>();
    if (existingError) return fail("generic");
    if (!existing) return fail("notFound");
    if (existing.location_id !== locationId) return fail("location");

    const { data, error } = await admin.from("warehouse_positions")
      .update({
        code,
        description: description || null,
        name: name || null,
        position_type: positionType,
      })
      .eq("organization_id", membership.organization.id)
      .eq("id", positionId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error) return saveError(error.code);
    if (!data) return fail("notFound");
  } else {
    const { data: location, error: locationError } = await admin.from("locations")
      .select("id")
      .eq("organization_id", membership.organization.id)
      .eq("id", locationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (locationError) return fail("generic");
    if (!location) return fail("location");

    const { error } = await admin.from("warehouse_positions").insert({
      code,
      description: description || null,
      is_active: true,
      location_id: locationId,
      name: name || null,
      organization_id: membership.organization.id,
      position_type: positionType,
    });
    if (error) return saveError(error.code);
  }

  revalidateWarehouse(locale);
  return { ...initialState, success: true };
}

export async function setWarehousePositionActiveAction(
  locale: string,
  _state: WarehousePositionActionState = initialState,
  formData: FormData,
): Promise<WarehousePositionActionState> {
  void _state;
  const positionId = value(formData, "positionId");
  const isActiveValue = value(formData, "isActive");
  if (!UUID.test(positionId) || !["true", "false"].includes(isActiveValue)) {
    return fail(null, { positionId: "invalid" });
  }

  const { membership } = await requireOwnerOrManager(locale);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("warehouse_positions")
    .update({ is_active: isActiveValue === "true" })
    .eq("organization_id", membership.organization.id)
    .eq("id", positionId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return fail(error.code === "22023" ? "location" : "generic");
  if (!data) return fail("notFound");

  revalidateWarehouse(locale);
  return { ...initialState, success: true };
}
