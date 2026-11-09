import type { PrinterProfile } from "@/features/printer-settings/types";

// Document formats are independent of physical printer purposes and connections.
export const CUSTOMER_COPY_FORMATS = ["a4", "58mm", "80mm"] as const;
export type CustomerCopyFormat = (typeof CUSTOMER_COPY_FORMATS)[number];
export type DocumentPrintPreference = {
  locationId: string;
  documentType: "customer-copy";
  paperFormat: CustomerCopyFormat;
  printerProfileId: string | null;
};
export type DocumentPreferenceState = {
  error: "validation" | "generic" | "unavailable" | null;
  success: boolean;
};

export function isCustomerCopyFormat(value: unknown): value is CustomerCopyFormat {
  return typeof value === "string" && CUSTOMER_COPY_FORMATS.some((format) => format === value);
}

export function resolveCustomerCopyFormat(override: unknown, savedFormat: unknown): CustomerCopyFormat {
  return isCustomerCopyFormat(override) ? override : isCustomerCopyFormat(savedFormat) ? savedFormat : "a4";
}

export function isCustomerCopyProfileCompatible(profile: PrinterProfile, locationId: string, format: CustomerCopyFormat) {
  if (!profile.enabled || profile.locationId !== locationId || profile.purpose === "label") return false;
  if (format === "a4") return profile.paperFormat === "browser_pdf" || profile.paperFormat === "ticket_a4";
  return profile.purpose === "receipt" && profile.paperFormat === (format === "58mm" ? "receipt_58mm" : "receipt_80mm");
}
