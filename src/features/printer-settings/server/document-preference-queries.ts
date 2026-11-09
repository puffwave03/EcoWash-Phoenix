import "server-only";

import { requirePrintAccess } from "@/features/printing/server/access";
import { requirePrinterSettingsAccess } from "@/features/printer-settings/server/access";
import { isCustomerCopyFormat, type DocumentPrintPreference } from "@/features/printer-settings/document-preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PreferenceRow = { location_id: string; paper_format: string; printer_profile_id: string | null };
const SELECT = "location_id, paper_format, printer_profile_id";
const missingTable = (code: string) => code === "42P01" || code === "PGRST205";

function mapPreferences(rows: PreferenceRow[]): DocumentPrintPreference[] {
  return rows.flatMap((row) => isCustomerCopyFormat(row.paper_format) ? [{
    locationId: row.location_id, documentType: "customer-copy" as const,
    paperFormat: row.paper_format, printerProfileId: row.printer_profile_id,
  }] : []);
}

export async function listDocumentPrintPreferences(locale: string) {
  const { membership } = await requirePrinterSettingsAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("document_print_preferences").select(SELECT)
    .eq("organization_id", membership.organization.id).eq("document_type", "customer-copy")
    .returns<PreferenceRow[]>();
  if (error) {
    if (!missingTable(error.code)) console.error("Document print preferences unavailable", error.code);
    return { available: false, preferences: [] as DocumentPrintPreference[] };
  }
  return { available: true, preferences: mapPreferences(data ?? []) };
}

// Call only after the order's existing access checks, using its canonical location.
export async function getCustomerCopyPreference(locale: string, locationId: string | null) {
  const { membership } = await requirePrintAccess(locale);
  if (!locationId) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("document_print_preferences").select(SELECT)
    .eq("organization_id", membership.organization.id).eq("location_id", locationId)
    .eq("document_type", "customer-copy").maybeSingle<PreferenceRow>();
  if (error) {
    if (!missingTable(error.code)) console.error("Customer copy preference unavailable; using A4", error.code);
    return null;
  }
  return data ? mapPreferences([data])[0] ?? null : null;
}
