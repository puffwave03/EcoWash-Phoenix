"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classifyLocationSaveResult, parseLocationSettings } from "@/features/location-settings/validation";

export type LocationSettingsState = { status: "idle" | "saved" | "invalid" | "unavailable" | "failure" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveOwnerLocationAction(
  locale: string,
  locationId: string,
  _state: LocationSettingsState,
  formData: FormData,
): Promise<LocationSettingsState> {
  await requireOwner(locale);
  if (!UUID.test(locationId)) return { status: "unavailable" };
  const parsed = parseLocationSettings(formData);
  if (!parsed.valid) return { status: "invalid" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_owner_location_settings", {
    target_location_id: locationId,
    target_name: parsed.input.name,
    target_address_line1: parsed.input.addressLine1,
    target_address_line2: parsed.input.addressLine2,
    target_city: parsed.input.city,
    target_region: parsed.input.region,
    target_postal_code: parsed.input.postalCode,
    target_country_code: parsed.input.countryCode,
    target_phone: parsed.input.phone,
  });
  const status = classifyLocationSaveResult(data, error);
  if (status !== "saved") return { status };

  revalidatePath(`/${locale}/app/settings/locations`);
  revalidatePath(`/${locale}/app/settings/locations/${locationId}`);
  return { status: "saved" };
}
