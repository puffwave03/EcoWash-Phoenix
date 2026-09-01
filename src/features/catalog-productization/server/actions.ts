"use server";

import { revalidatePath } from "next/cache";
import { parseCsv, CATALOG_CSV_HEADERS } from "@/features/catalog-productization/csv";
import { getCatalogExportData } from "@/features/catalog-productization/server/queries";
import { CATALOG_ORDER_MODES, type CatalogImportPreviewItem, type CatalogImportRow, type CatalogImportState, type CategoryTranslations, type CatalogTranslations } from "@/features/catalog-productization/types";
import { SERVICE_UNIT_TYPES } from "@/features/services/types";
import { routing } from "@/i18n/routing";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const initialState: CatalogImportState = { error: null, payload: null, preview: null, success: false };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bool(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function rowRecord(headers: string[], values: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()]));
}

function parseRow(record: Record<string, string>, rowNumber: number) {
  const errors: string[] = [];
  const manualSortOrder = Number(record.manual_sort_order);
  const customerVisible = bool(record.customer_visible);
  const customerOrderable = bool(record.customer_orderable);
  const featured = bool(record.featured);
  if (record.service_id && !UUID.test(record.service_id)) errors.push("service_id");
  if (!record.category_key || !/^[a-z0-9_]{1,64}$/.test(record.category_key)) errors.push("category_key");
  if (!SERVICE_UNIT_TYPES.includes(record.unit_type as (typeof SERVICE_UNIT_TYPES)[number])) errors.push("unit_type");
  if (!Number.isInteger(manualSortOrder) || manualSortOrder < 0 || manualSortOrder > 100000) errors.push("manual_sort_order");
  if (!CATALOG_ORDER_MODES.includes(record.catalog_order_mode as (typeof CATALOG_ORDER_MODES)[number])) errors.push("catalog_order_mode");
  if (!['active', 'archived'].includes(record.active_or_archived)) errors.push("active_or_archived");
  if (customerVisible === null) errors.push("customer_visible");
  if (customerOrderable === null) errors.push("customer_orderable");
  if (featured === null) errors.push("featured");
  if (record.canonical_name.length > 160 || record.canonical_description.length > 1000 || record.service_code.length > 80) errors.push("length");
  const translations: CatalogTranslations = {};
  const categoryTranslations: CategoryTranslations = {};
  for (const locale of routing.locales) {
    const name = record[`service_name_${locale}`] ?? "";
    const description = record[`service_description_${locale}`] ?? "";
    if (name.length > 160 || description.length > 1000) errors.push(`translation_${locale}`);
    if (name) translations[locale] = { description, name };
    const categoryTitle = record[`category_name_${locale}`] ?? "";
    if (categoryTitle.length > 120) errors.push(`category_translation_${locale}`);
    if (categoryTitle) categoryTranslations[locale] = categoryTitle;
  }
  const row: CatalogImportRow = {
    canonicalDescription: record.canonical_description,
    canonicalName: record.canonical_name,
    categoryKey: record.category_key,
    categoryTranslations,
    customerOrderable: customerOrderable ?? false,
    customerVisible: customerVisible ?? false,
    featured: featured ?? false,
    manualSortOrder: Number.isInteger(manualSortOrder) ? manualSortOrder : 0,
    orderMode: CATALOG_ORDER_MODES.includes(record.catalog_order_mode as (typeof CATALOG_ORDER_MODES)[number]) ? record.catalog_order_mode as CatalogImportRow["orderMode"] : "manual",
    serviceCode: record.service_code,
    serviceId: record.service_id,
    status: record.active_or_archived === "archived" ? "archived" : "active",
    translations,
    unitType: SERVICE_UNIT_TYPES.includes(record.unit_type as (typeof SERVICE_UNIT_TYPES)[number]) ? record.unit_type as CatalogImportRow["unitType"] : "piece",
  };
  return { errors, row, rowNumber };
}

async function validateRows(locale: string, parsedRows: ReturnType<typeof parseRow>[]) {
  const { rows: currentRows, settings } = await getCatalogExportData(locale);
  const currentById = new Map(currentRows.map((row) => [row.serviceId, row]));
  const currentByCode = new Map(currentRows.filter((row) => row.serviceCode).map((row) => [row.serviceCode, row]));
  const categoryKeys = new Map(settings.categories.map((category) => [category.categoryKey, category.isActive]));
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const effectiveRows: CatalogImportRow[] = [];
  const items: CatalogImportPreviewItem[] = [];
  for (const parsed of parsedRows) {
    const errors = [...parsed.errors];
    const current = parsed.row.serviceId ? currentById.get(parsed.row.serviceId) : parsed.row.serviceCode ? currentByCode.get(parsed.row.serviceCode) : undefined;
    if (parsed.row.serviceId && !current) errors.push("foreign_service_id");
    if (!categoryKeys.has(parsed.row.categoryKey) || (parsed.row.status === "active" && !categoryKeys.get(parsed.row.categoryKey))) errors.push("unknown_category");
    const codeOwner = parsed.row.serviceCode ? currentByCode.get(parsed.row.serviceCode) : undefined;
    if (current && codeOwner && codeOwner.serviceId !== current.serviceId) errors.push("conflicting_service_code");
    if (parsed.row.serviceId && seenIds.has(parsed.row.serviceId)) errors.push("duplicate_service_id");
    if (parsed.row.serviceCode && seenCodes.has(parsed.row.serviceCode)) errors.push("duplicate_service_code");
    if (parsed.row.serviceId) seenIds.add(parsed.row.serviceId);
    if (parsed.row.serviceCode) seenCodes.add(parsed.row.serviceCode);
    if (!current && !parsed.row.canonicalName && !Object.values(parsed.row.translations).some((translation) => translation?.name)) errors.push("required_name");
    const effective: CatalogImportRow = current ? {
      ...parsed.row,
      canonicalDescription: parsed.row.canonicalDescription || current.canonicalDescription,
      canonicalName: parsed.row.canonicalName || current.canonicalName,
      categoryTranslations: { ...current.categoryTranslations, ...parsed.row.categoryTranslations },
      serviceCode: parsed.row.serviceCode || current.serviceCode,
      serviceId: current.serviceId,
      translations: { ...current.translations, ...parsed.row.translations },
    } : { ...parsed.row, canonicalName: parsed.row.canonicalName || Object.values(parsed.row.translations).find((translation) => translation?.name)?.name || "" };
    const changed = !current || JSON.stringify(effective) !== JSON.stringify(current);
    const action = errors.length ? "error" : !current ? "create" : !changed ? "unchanged" : effective.status === "archived" && current.status !== "archived" ? "archive" : "update";
    items.push({ action, code: effective.serviceCode, errors, name: effective.canonicalName || Object.values(effective.translations)[0]?.name || "—", row: parsed.rowNumber });
    if (!errors.length && action !== "unchanged") effectiveRows.push(effective);
  }
  const modes = new Set(parsedRows.map((parsed) => parsed.row.orderMode));
  if (modes.size > 1) items.push({ action: "error", code: "", errors: ["conflicting_order_modes"], name: "Catalog", row: 0 });
  return {
    rows: effectiveRows,
    preview: {
      archives: items.filter((item) => item.action === "archive").length,
      creates: items.filter((item) => item.action === "create").length,
      errors: items.filter((item) => item.action === "error").length,
      items,
      unchanged: items.filter((item) => item.action === "unchanged").length,
      updates: items.filter((item) => item.action === "update").length,
    },
  };
}

export async function previewCatalogImportAction(locale: string, _state: CatalogImportState = initialState, formData: FormData): Promise<CatalogImportState> {
  void _state;
  await requireOwnerOrManager(locale);
  const file = formData.get("catalogFile");
  if (!(file instanceof File) || file.size < 1 || file.size > 1_000_000) return { ...initialState, error: "file" };
  const table = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
  if (table.length < 2 || table.length - 1 > 500) return { ...initialState, error: "rows" };
  const headers = table[0].map((header) => header.trim());
  const missingHeaders = CATALOG_CSV_HEADERS.filter((header) => !headers.includes(header));
  const invalidLocaleHeaders = headers.filter((header) => /^(service_name|service_description|category_name)_/.test(header) && !CATALOG_CSV_HEADERS.includes(header as (typeof CATALOG_CSV_HEADERS)[number]));
  if (missingHeaders.length || invalidLocaleHeaders.length) return { ...initialState, error: "columns" };
  const validation = await validateRows(locale, table.slice(1).map((values, index) => parseRow(rowRecord(headers, values), index + 2)));
  return {
    error: null,
    payload: validation.preview.errors === 0 ? JSON.stringify(validation.rows) : null,
    preview: validation.preview,
    success: false,
  };
}

export async function confirmCatalogImportAction(locale: string, _state: CatalogImportState = initialState, formData: FormData): Promise<CatalogImportState> {
  void _state;
  await requireOwnerOrManager(locale);
  let rows: CatalogImportRow[];
  try {
    rows = JSON.parse(String(formData.get("payload") ?? ""));
    if (!Array.isArray(rows) || rows.length > 500) throw new Error("invalid");
  } catch { return { ...initialState, error: "payload" }; }
  const records = rows.map((row, index) => parseRow({
    service_id: row.serviceId, service_code: row.serviceCode, canonical_name: row.canonicalName,
    canonical_description: row.canonicalDescription, category_key: row.categoryKey, unit_type: row.unitType,
    manual_sort_order: String(row.manualSortOrder), catalog_order_mode: row.orderMode,
    active_or_archived: row.status, customer_visible: String(row.customerVisible),
    customer_orderable: String(row.customerOrderable), featured: String(row.featured),
    ...Object.fromEntries(routing.locales.flatMap((activeLocale) => [[`service_name_${activeLocale}`, row.translations[activeLocale]?.name ?? ""], [`service_description_${activeLocale}`, row.translations[activeLocale]?.description ?? ""], [`category_name_${activeLocale}`, row.categoryTranslations[activeLocale] ?? ""]])),
  }, index + 2));
  const validation = await validateRows(locale, records);
  if (validation.preview.errors > 0) return { error: "validation", payload: null, preview: validation.preview, success: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("apply_catalog_import", { target_rows: validation.rows });
  if (error) { console.error("Catalog import apply failed", error.code); return { ...initialState, error: "apply" }; }
  for (const activeLocale of routing.locales) {
    revalidatePath(`/${activeLocale}/app/settings/catalog`);
    revalidatePath(`/${activeLocale}/app/shop`);
    revalidatePath(`/${activeLocale}/portal/requests/new`);
  }
  return { ...initialState, success: true };
}
