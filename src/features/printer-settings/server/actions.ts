"use server";

import { revalidatePath } from "next/cache";
import { requirePrinterSettingsAccess } from "@/features/printer-settings/server/access";
import {
  PRINTER_CONNECTION_MODES,
  PRINTER_ORIENTATIONS,
  PRINTER_PAPER_FORMATS,
  PRINTER_PURPOSES,
  type PrinterConnectionMode,
  type PrinterOrientation,
  type PrinterPaperFormat,
  type PrinterPurpose,
  type PrinterSettingsActionState,
} from "@/features/printer-settings/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const initialState: PrinterSettingsActionState = { error: null, savedProfileId: null, success: false };

function finiteNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function savePrinterProfileAction(
  locale: string,
  _state: PrinterSettingsActionState = initialState,
  formData: FormData,
): Promise<PrinterSettingsActionState> {
  void _state;
  const profileIdValue = String(formData.get("profileId") ?? "");
  const profileId = profileIdValue && UUID.test(profileIdValue) ? profileIdValue : null;
  const locationId = String(formData.get("locationId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 120);
  const purpose = String(formData.get("purpose") ?? "") as PrinterPurpose;
  const connectionMode = String(formData.get("connectionMode") ?? "") as PrinterConnectionMode;
  const paperFormat = String(formData.get("paperFormat") ?? "") as PrinterPaperFormat;
  const deviceIdentifier = String(formData.get("deviceIdentifier") ?? "").trim().slice(0, 240);
  const enabled = formData.get("enabled") === "true";
  const isDefault = formData.get("isDefault") === "true";
  const labelWidthMm = finiteNumber(formData.get("labelWidthMm"), 50);
  const labelHeightMm = finiteNumber(formData.get("labelHeightMm"), 30);
  const labelCopies = finiteNumber(formData.get("labelCopies"), 1);
  const labelMarginMm = finiteNumber(formData.get("labelMarginMm"), 2);
  const labelGapMm = finiteNumber(formData.get("labelGapMm"), 3);
  const labelOrientation = String(formData.get("labelOrientation") ?? "portrait") as PrinterOrientation;
  const allowedFormat = purpose === "receipt"
    ? ["receipt_58mm", "receipt_80mm", "browser_pdf"].includes(paperFormat)
    : purpose === "label"
      ? ["label_custom", "browser_pdf"].includes(paperFormat)
      : ["ticket_a4", "browser_pdf"].includes(paperFormat);

  if (!UUID.test(locationId) || !displayName
    || !PRINTER_PURPOSES.includes(purpose)
    || !PRINTER_CONNECTION_MODES.includes(connectionMode)
    || !PRINTER_PAPER_FORMATS.includes(paperFormat)
    || !allowedFormat || (isDefault && !enabled)
    || (purpose === "label" && (
      !PRINTER_ORIENTATIONS.includes(labelOrientation)
      || labelWidthMm < 10 || labelWidthMm > 200
      || labelHeightMm < 10 || labelHeightMm > 300
      || !Number.isInteger(labelCopies) || labelCopies < 1 || labelCopies > 20
      || labelMarginMm < 0 || labelMarginMm > 20
      || labelGapMm < 0 || labelGapMm > 20
    ))) {
    return { error: "validation", savedProfileId: null, success: false };
  }

  await requirePrinterSettingsAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_printer_profile", {
    target_connection_mode: connectionMode,
    target_device_identifier: deviceIdentifier,
    target_display_name: displayName,
    target_enabled: enabled,
    target_is_default: isDefault,
    target_label_copies: purpose === "label" ? labelCopies : null,
    target_label_gap_mm: purpose === "label" ? labelGapMm : null,
    target_label_height_mm: purpose === "label" ? labelHeightMm : null,
    target_label_margin_mm: purpose === "label" ? labelMarginMm : null,
    target_label_orientation: purpose === "label" ? labelOrientation : null,
    target_label_width_mm: purpose === "label" ? labelWidthMm : null,
    target_location_id: locationId,
    target_paper_format: paperFormat,
    target_profile_id: profileId,
    target_purpose: purpose,
  });

  if (error || typeof data !== "string") {
    console.error("Printer profile save failed", error?.code);
    return { error: "generic", savedProfileId: null, success: false };
  }

  revalidatePath(`/${locale}/app/settings/printers`);
  revalidatePath(`/${locale}/app/orders`, "layout");
  return { error: null, savedProfileId: data, success: true };
}
