export const PRINTER_PURPOSES = ["receipt", "label", "ticket"] as const;
export const PRINTER_CONNECTION_MODES = ["browser", "network", "local_bridge", "vendor_adapter"] as const;
export const PRINTER_PAPER_FORMATS = ["receipt_58mm", "receipt_80mm", "browser_pdf", "label_custom", "ticket_a4"] as const;
export const PRINTER_ORIENTATIONS = ["portrait", "landscape"] as const;

export type PrinterPurpose = (typeof PRINTER_PURPOSES)[number];
export type PrinterConnectionMode = (typeof PRINTER_CONNECTION_MODES)[number];
export type PrinterPaperFormat = (typeof PRINTER_PAPER_FORMATS)[number];
export type PrinterOrientation = (typeof PRINTER_ORIENTATIONS)[number];

export type PrinterLocation = { id: string; name: string };

export type PrinterProfile = {
  connectionMode: PrinterConnectionMode;
  deviceIdentifier: string | null;
  displayName: string;
  enabled: boolean;
  id: string;
  isDefault: boolean;
  labelCopies: number | null;
  labelGapMm: number | null;
  labelHeightMm: number | null;
  labelMarginMm: number | null;
  labelOrientation: PrinterOrientation | null;
  labelWidthMm: number | null;
  locationId: string;
  locationName: string;
  paperFormat: PrinterPaperFormat;
  purpose: PrinterPurpose;
};

export type PrinterProfileDefaults = Partial<Record<PrinterPurpose, PrinterProfile>>;

export type PrinterSettingsActionState = {
  error: "generic" | "validation" | null;
  savedProfileId: string | null;
  success: boolean;
};
