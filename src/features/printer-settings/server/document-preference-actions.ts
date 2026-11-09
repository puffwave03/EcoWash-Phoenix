"use server";

import { revalidatePath } from "next/cache";
import { requirePrinterSettingsAccess } from "@/features/printer-settings/server/access";
import { isCustomerCopyFormat, type DocumentPreferenceState } from "@/features/printer-settings/document-preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveDocumentPrintPreferenceAction(
  locale: string, _state: DocumentPreferenceState, formData: FormData,
): Promise<DocumentPreferenceState> {
  await requirePrinterSettingsAccess(locale);
  const locationId = String(formData.get("locationId") ?? "");
  const paperFormat = formData.get("paperFormat");
  const profileId = String(formData.get("printerProfileId") ?? "");
  if (!UUID.test(locationId) || !isCustomerCopyFormat(paperFormat) || (profileId !== "" && !UUID.test(profileId))) {
    return { error: "validation", success: false };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_document_print_preference", {
    target_location_id: locationId, target_document_type: "customer-copy",
    target_paper_format: paperFormat, target_printer_profile_id: profileId || null,
  });
  if (error || typeof data !== "string") {
    console.error("Document print preference save failed", error?.code);
    return { error: error?.code === "22023" ? "validation"
      : error?.code === "PGRST202" || error?.code === "42883" ? "unavailable" : "generic", success: false };
  }
  revalidatePath(`/${locale}/app/settings/printers`);
  revalidatePath(`/${locale}/app/orders`, "layout");
  return { error: null, success: true };
}
