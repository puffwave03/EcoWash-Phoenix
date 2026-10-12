import "server-only";

import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LocationSettingsRow = {
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  phone: string | null;
  is_active: boolean;
};

const LOCATION_SELECT = "id, name, address_line1, address_line2, city, region, postal_code, country_code, phone, is_active";

export async function listOwnerLocations(locale: string): Promise<LocationSettingsRow[]> {
  const { membership } = await requireOwner(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("locations")
    .select(LOCATION_SELECT)
    .eq("organization_id", membership.organization.id)
    .is("deleted_at", null)
    .order("name")
    .order("id")
    .returns<LocationSettingsRow[]>();
  if (error) throw new Error("location_settings_unavailable");
  return data ?? [];
}

export async function getOwnerLocation(locale: string, locationId: string): Promise<LocationSettingsRow> {
  const { membership } = await requireOwner(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("locations")
    .select(LOCATION_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("id", locationId)
    .is("deleted_at", null)
    .maybeSingle<LocationSettingsRow>();
  if (error || !data) notFound();
  return data;
}
