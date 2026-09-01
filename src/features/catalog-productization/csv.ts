import type { AppLocale } from "../../i18n/routing.ts";
import type { CatalogImportRow } from "./types.ts";

const catalogLocales = ["it", "es", "en", "fr", "de"] as const satisfies readonly AppLocale[];

export const CATALOG_CSV_HEADERS = [
  "service_id", "service_code", "canonical_name", "canonical_description",
  ...catalogLocales.flatMap((locale) => [`service_name_${locale}`, `service_description_${locale}`]),
  "category_key", ...catalogLocales.map((locale) => `category_name_${locale}`),
  "unit_type", "manual_sort_order", "catalog_order_mode", "active_or_archived",
  "customer_visible", "customer_orderable", "featured", "media_reference",
] as const;

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCatalogCsv(rows: CatalogImportRow[], mediaPaths: Map<string, string | null>) {
  const lines = rows.map((row) => CATALOG_CSV_HEADERS.map((header) => {
    if (header === "service_id") return row.serviceId;
    if (header === "service_code") return row.serviceCode;
    if (header === "canonical_name") return row.canonicalName;
    if (header === "canonical_description") return row.canonicalDescription;
    if (header === "category_key") return row.categoryKey;
    if (header === "unit_type") return row.unitType;
    if (header === "manual_sort_order") return row.manualSortOrder;
    if (header === "catalog_order_mode") return row.orderMode;
    if (header === "active_or_archived") return row.status;
    if (header === "customer_visible") return row.customerVisible;
    if (header === "customer_orderable") return row.customerOrderable;
    if (header === "featured") return row.featured;
    if (header === "media_reference") return mediaPaths.get(row.serviceId) ?? "";
    const serviceLocale = catalogLocales.find((locale) => header === `service_name_${locale}` || header === `service_description_${locale}`);
    if (serviceLocale) return header.startsWith("service_name_") ? row.translations[serviceLocale]?.name ?? "" : row.translations[serviceLocale]?.description ?? "";
    const categoryLocale = catalogLocales.find((locale) => header === `category_name_${locale}`);
    return categoryLocale ? row.categoryTranslations[categoryLocale] ?? "" : "";
  }).map(escapeCsv).join(","));
  return `\uFEFF${CATALOG_CSV_HEADERS.join(",")}\r\n${lines.join("\r\n")}\r\n`;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
