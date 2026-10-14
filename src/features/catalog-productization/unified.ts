import { CATALOG_CSV_HEADERS, parseCsv } from "./csv";
import { CATALOG_ORDER_MODES, type CatalogImportRow } from "./types";
import { SERVICE_UNIT_TYPES } from "../services/types";

export type UnifiedImportMode = "prices_only" | "catalog_and_prices";
export type UnifiedPrice = {
  amount: string;
  currency: string;
  isFrom: boolean;
  validTo: string | null;
};
export type ExistingUnifiedPrice = {
  amount: number;
  currency: string;
  is_from: boolean;
  valid_from: string;
  valid_to: string | null;
};
export type UnifiedRow = CatalogImportRow & {
  catalogChanged: boolean;
  price: UnifiedPrice | null;
  skip: boolean;
  skipReason: string | null;
};
export type ParsedUnifiedRow = { row: UnifiedRow; rowNumber: number; errors: string[] };
export type UnifiedPreviewItem = {
  code: string;
  row: number;
  catalog: "create" | "update" | "unchanged";
  price: "create" | "close_and_create" | "unchanged" | "none";
  name: string;
  unitType: string;
  previousAmount: string | null;
  newAmount: string | null;
  previousIsFrom: boolean | null;
  newIsFrom: boolean | null;
  effectiveDate: string;
  skipped: string | null;
  errors: string[];
};
export type UnifiedImportState = {
  error: string | null;
  payload: string | null;
  preview: {
    catalogCreates: number;
    catalogUpdates: number;
    priceCreates: number;
    priceClosures: number;
    unchanged: number;
    imported: number;
    skipped: number;
    errors: number;
    items: UnifiedPreviewItem[];
  } | null;
  success: boolean;
};

const PRICE_HEADERS = ["base_price", "currency", "price_is_from", "price_valid_from", "price_valid_to"];
const TRANSFER_HEADERS = ["import_action", "exclude_reason"];
export const MAX_UNIFIED_ROWS = 2000;
export const MAX_UNIFIED_CSV_BYTES = 1_000_000;
const LOCALES = ["it", "es", "en", "fr", "de"] as const;
const DECIMAL = /^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validIsoDate(value: string) {
  return ISO_DATE.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function validMoney(value: string) {
  return DECIMAL.test(value);
}

function csvMoney(value: string, delimiter: "," | ";") {
  if (validMoney(value)) return value;
  if (delimiter !== ";" || !/^(0|[1-9][0-9]{0,9}),[0-9]{1,2}$/.test(value)) return null;
  const [whole, fraction] = value.split(",");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function planUnifiedPrice(
  active: ExistingUnifiedPrice[], price: UnifiedPrice | null, effectiveDate: string, today: string,
  organizationCurrency: string,
): { action: UnifiedPreviewItem["price"]; previous: ExistingUnifiedPrice | null; errors: string[] } {
  const errors: string[] = [];
  if (price && price.currency !== organizationCurrency) {
    return { action: "none", previous: null, errors: ["currency_mismatch"] };
  }
  // The RPC versions global base prices in the organization's currency only.
  // An overlapping foreign-currency global row makes the proposed price
  // ambiguous; inclusive bounds must include the proposed finite end date.
  const scoped = active.filter((row) => row.currency === organizationCurrency);
  if (price && active.some((row) => row.currency !== organizationCurrency
    && (row.valid_to === null || row.valid_to >= effectiveDate)
    && (price.validTo === null || row.valid_from <= price.validTo))) {
    return { action: "none", previous: null, errors: ["cross_currency_price_conflict"] };
  }
  const applicable = scoped.filter((row) => row.valid_from <= effectiveDate
    && (row.valid_to === null || row.valid_to >= effectiveDate));
  if (applicable.length > 1) errors.push("price_overlap");
  const previous = applicable[0] ?? null;
  if (!price) return { action: "none", previous, errors };
  if (price.validTo && price.validTo < effectiveDate) errors.push("price_valid_to");
  const sameDay = scoped.find((row) => row.valid_from === effectiveDate);
  const sameValues = (row: ExistingUnifiedPrice) => Number(row.amount).toFixed(2) === Number(price.amount).toFixed(2)
    && row.currency === price.currency && row.is_from === price.isFrom && row.valid_to === price.validTo;
  if (sameDay) {
    if (!sameValues(sameDay)) errors.push("same_day_price_conflict");
    return { action: sameValues(sameDay) ? "unchanged" : "none", previous, errors };
  }
  if (previous && sameValues(previous)) return { action: "unchanged", previous, errors };
  if (scoped.some((row) => row.valid_from > effectiveDate
    || (row.valid_from > today && row.valid_from !== effectiveDate))) errors.push("future_price_conflict");
  return { action: previous ? "close_and_create" : "create", previous, errors };
}

function boolean(value: string) {
  return value === "true" ? true : value === "false" ? false : null;
}

function formula(value: string) {
  return /^[=+\-@\t\r\n]/.test(value);
}

function decodedText(value: string) {
  return /^'+[=+\-@\t\r\n]/.test(value) ? value.slice(1) : value;
}

function assertWellFormedCsv(text: string, delimiter: "," | ";") {
  let state: "start" | "plain" | "quoted" | "closed" = "start";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (state === "quoted") {
      if (character === '"' && text[index + 1] === '"') index += 1;
      else if (character === '"') state = "closed";
    } else if (character === delimiter || character === "\r" || character === "\n") {
      state = "start";
    } else if (character === '"' && state === "start") {
      state = "quoted";
    } else if (character === '"' || state === "closed") {
      throw new Error("csv_syntax");
    } else {
      state = "plain";
    }
  }
  if (state === "quoted") throw new Error("csv_syntax");
}

export function parseUnifiedCatalogCsv(text: string, mode: UnifiedImportMode): ParsedUnifiedRow[] {
  if (new TextEncoder().encode(text).length > MAX_UNIFIED_CSV_BYTES || text.includes("\0")) throw new Error("file");
  const normalized = text.replace(/^\uFEFF/, "");
  const header = normalized.split(/\r?\n/, 1)[0];
  const delimiter = header.includes(";") && !header.includes(",") ? ";" : ",";
  assertWellFormedCsv(normalized, delimiter);
  const table = parseCsv(normalized, delimiter);
  if (table.length < 2 || table.length - 1 > MAX_UNIFIED_ROWS) throw new Error("rows");
  const headers = table[0];
  const legacy = CATALOG_CSV_HEADERS.filter((header) => !PRICE_HEADERS.includes(header) && !TRANSFER_HEADERS.includes(header));
  const previous = CATALOG_CSV_HEADERS.filter((header) => !TRANSFER_HEADERS.includes(header));
  const expected = headers.length === legacy.length && mode === "catalog_and_prices" ? legacy
    : headers.length === previous.length ? previous : [...CATALOG_CSV_HEADERS];
  if (headers.length !== expected.length || expected.some((header, index) => headers[index] !== header)) throw new Error("columns");
  const seen = new Set<string>();
  return table.slice(1).map((cells, index) => {
    const errors: string[] = [];
    if (cells.length !== headers.length) errors.push("columns");
    const record = Object.fromEntries(headers.map((header, at) => [header, cells[at] ?? ""])) as Record<string, string>;
    const archivedSkip = mode === "prices_only" && record.active_or_archived === "archived";
    const code = record.service_code.trim();
    if ((!code && !archivedSkip) || code.length > 80 || /[\x00-\x1f\x7f]/.test(code) || formula(code)) errors.push("service_code");
    if (code && seen.has(code)) errors.push("duplicate_service_code");
    if (code) seen.add(code);
    const action = (record.import_action ?? "").trim();
    const reason = (record.exclude_reason ?? "").trim();
    if (action && action !== "include" && action !== "exclude") errors.push("import_action");
    if (action === "exclude" && (!reason || reason.length > 160 || formula(reason))) errors.push("exclude_reason");
    const skip = action === "exclude" || archivedSkip;
    const rawAmount = (record.base_price ?? "").trim();
    const amount = csvMoney(rawAmount, delimiter);
    const hasPrice = Boolean(rawAmount);
    if (hasPrice && amount === null) errors.push("base_price");
    const isFrom = hasPrice ? boolean((record.price_is_from ?? "").trim()) : null;
    if (hasPrice && isFrom === null) errors.push("price_is_from");
    const validTo = (record.price_valid_to ?? "").trim();
    const exportedValidFrom = (record.price_valid_from ?? "").trim();
    if (validTo && !validIsoDate(validTo)) errors.push("price_valid_to");
    if (exportedValidFrom && !validIsoDate(exportedValidFrom)) errors.push("price_valid_from");
    const currency = (record.currency ?? "").trim();
    if (hasPrice && !/^[A-Z]{3}$/.test(currency)) errors.push("currency");

    const translations: CatalogImportRow["translations"] = {};
    const categoryTranslations: CatalogImportRow["categoryTranslations"] = {};
    for (const locale of LOCALES) {
      const rawName = record[`service_name_${locale}`] ?? "";
      const rawDescription = record[`service_description_${locale}`] ?? "";
      const rawCategory = record[`category_name_${locale}`] ?? "";
      const name = decodedText(rawName);
      const description = decodedText(rawDescription);
      const category = decodedText(rawCategory);
      if (name.length > 160 || description.length > 1000 || category.length > 120
        || formula(rawName) || formula(rawDescription) || formula(rawCategory)) errors.push(`translation_${locale}`);
      if (name) translations[locale] = { name, description };
      if (category) categoryTranslations[locale] = category;
    }
    const status = record.active_or_archived;
    const sort = Number(record.manual_sort_order);
    const visible = boolean(record.customer_visible);
    const orderable = boolean(record.customer_orderable);
    const featured = boolean(record.featured);
    if (mode === "catalog_and_prices") {
      if (!/^[a-z0-9_]{1,64}$/.test(record.category_key)) errors.push("category_key");
      if (!SERVICE_UNIT_TYPES.includes(record.unit_type as CatalogImportRow["unitType"])) errors.push("unit_type");
      if (!Number.isInteger(sort) || sort < 0 || sort > 100000) errors.push("manual_sort_order");
      if (!CATALOG_ORDER_MODES.includes(record.catalog_order_mode as CatalogImportRow["orderMode"])) errors.push("catalog_order_mode");
      if (status !== "active" && status !== "archived") errors.push("active_or_archived");
      if (visible === null || orderable === null || featured === null) errors.push("flags");
      if (record.canonical_name.length > 160 || record.canonical_description.length > 1000
        || formula(record.canonical_name) || formula(record.canonical_description)) errors.push("catalog_text");
    }
    if (mode === "prices_only") {
      if (status !== "active" && status !== "archived") errors.push("active_or_archived");
      if (!SERVICE_UNIT_TYPES.includes(record.unit_type as CatalogImportRow["unitType"])) errors.push("unit_type");
    }
    return {
      rowNumber: index + 2,
      errors,
      row: {
        canonicalDescription: decodedText(record.canonical_description),
        canonicalName: decodedText(record.canonical_name),
        categoryKey: record.category_key,
        categoryTranslations,
        customerOrderable: orderable ?? false,
        customerVisible: visible ?? false,
        featured: featured ?? false,
        manualSortOrder: Number.isInteger(sort) ? sort : 0,
        orderMode: CATALOG_ORDER_MODES.includes(record.catalog_order_mode as CatalogImportRow["orderMode"])
          ? record.catalog_order_mode as CatalogImportRow["orderMode"] : "manual",
        serviceCode: code,
        // Exported UUIDs and media paths are never authority for import.
        serviceId: "",
        status: status === "archived" ? "archived" : "active",
        translations,
        unitType: SERVICE_UNIT_TYPES.includes(record.unit_type as CatalogImportRow["unitType"])
          ? record.unit_type as CatalogImportRow["unitType"] : "piece",
        catalogChanged: false,
        price: hasPrice && amount !== null && isFrom !== null ? { amount, currency, isFrom, validTo: validTo || null } : null,
        skip,
        skipReason: skip ? (reason || "archived") : null,
      },
    };
  });
}
