import "server-only";

import { requirePrintAccess } from "@/features/printing/server/access";
import { requirePrinterSettingsAccess } from "@/features/printer-settings/server/access";
import type {
  PrinterLocation,
  PrinterProfile,
  PrinterProfileDefaults,
  PrinterPurpose,
} from "@/features/printer-settings/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PrinterProfileRow = {
  connection_mode: PrinterProfile["connectionMode"];
  device_identifier: string | null;
  display_name: string;
  enabled: boolean;
  id: string;
  is_default: boolean;
  label_copies: number | null;
  label_gap_mm: number | null;
  label_height_mm: number | null;
  label_margin_mm: number | null;
  label_orientation: PrinterProfile["labelOrientation"];
  label_width_mm: number | null;
  location_id: string;
  location: { name: string } | { name: string }[] | null;
  paper_format: PrinterProfile["paperFormat"];
  purpose: PrinterPurpose;
};

const PROFILE_SELECT = "id, location_id, display_name, purpose, enabled, connection_mode, paper_format, device_identifier, is_default, label_width_mm, label_height_mm, label_orientation, label_copies, label_margin_mm, label_gap_mm, location:locations!printer_profiles_location_same_organization(name)";

function mapProfile(row: PrinterProfileRow): PrinterProfile {
  const location = Array.isArray(row.location) ? row.location[0] : row.location;
  return {
    connectionMode: row.connection_mode,
    deviceIdentifier: row.device_identifier,
    displayName: row.display_name,
    enabled: row.enabled,
    id: row.id,
    isDefault: row.is_default,
    labelCopies: row.label_copies,
    labelGapMm: row.label_gap_mm === null ? null : Number(row.label_gap_mm),
    labelHeightMm: row.label_height_mm === null ? null : Number(row.label_height_mm),
    labelMarginMm: row.label_margin_mm === null ? null : Number(row.label_margin_mm),
    labelOrientation: row.label_orientation,
    labelWidthMm: row.label_width_mm === null ? null : Number(row.label_width_mm),
    locationId: row.location_id,
    locationName: location?.name ?? "",
    paperFormat: row.paper_format,
    purpose: row.purpose,
  };
}

export async function listPrinterSettingsLocations(locale: string): Promise<PrinterLocation[]> {
  const { membership } = await requirePrinterSettingsAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("locations").select("id, name")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")
    .limit(100)
    .returns<PrinterLocation[]>();
  if (error) throw new Error("Printer locations are temporarily unavailable");
  return data ?? [];
}

export async function listPrinterProfiles(locale: string): Promise<PrinterProfile[]> {
  const { membership } = await requirePrinterSettingsAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("printer_profiles").select(PROFILE_SELECT)
    .eq("organization_id", membership.organization.id)
    .order("location_id")
    .order("purpose")
    .order("display_name")
    .returns<PrinterProfileRow[]>();
  if (error) {
    console.error("Printer profiles query failed", error.code);
    return [];
  }
  return (data ?? []).map(mapProfile);
}

export async function getDefaultPrinterProfiles(
  locale: string,
  locationId: string | null,
): Promise<PrinterProfileDefaults> {
  if (!locationId) return {};
  const { membership } = await requirePrintAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("printer_profiles").select(PROFILE_SELECT)
    .eq("organization_id", membership.organization.id)
    .eq("location_id", locationId)
    .eq("enabled", true)
    .eq("is_default", true)
    .returns<PrinterProfileRow[]>();
  if (error) {
    console.error("Default printer profiles query failed", error.code);
    return {};
  }
  return Object.fromEntries((data ?? []).map((row) => [row.purpose, mapProfile(row)])) as PrinterProfileDefaults;
}
