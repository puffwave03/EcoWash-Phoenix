"use server";

import { revalidatePath } from "next/cache";
import { getCatalogExportData } from "@/features/catalog-productization/server/queries";
import { MAX_UNIFIED_CSV_BYTES, parseUnifiedCatalogCsv, planUnifiedPrice, validIsoDate, type ExistingUnifiedPrice, type ParsedUnifiedRow, type UnifiedImportMode, type UnifiedImportState, type UnifiedPreviewItem, type UnifiedRow } from "@/features/catalog-productization/unified";
import type { CatalogImportRow } from "@/features/catalog-productization/types";
import { routing } from "@/i18n/routing";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const empty: UnifiedImportState = { error: null, payload: null, preview: null, success: false };
type PriceRow = ExistingUnifiedPrice & {
  id: string;
  service_id: string;
};

function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone,
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function comparableCatalog(row: CatalogImportRow) {
  return JSON.stringify([
    row.canonicalName, row.canonicalDescription, row.categoryKey, row.categoryTranslations,
    row.customerOrderable, row.customerVisible, row.featured, row.manualSortOrder,
    row.orderMode, row.serviceCode, row.status, row.translations, row.unitType,
  ]);
}

async function readSnapshot(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await supabase.rpc("get_unified_catalog_snapshot");
  if (error || typeof data !== "string") throw new Error("snapshot_unavailable");
  return data;
}

async function validate(
  locale: string, mode: UnifiedImportMode, effectiveDate: string, parsed: ParsedUnifiedRow[],
) {
  const { membership } = await requireOwnerOrManager(locale);
  const organizationId = membership.organization.id;
  const currency = membership.organization.defaultCurrency;
  const today = localDate(membership.organization.timezone);
  const supabase = await createSupabaseServerClient();
  const before = await readSnapshot(supabase);
  const { rows: currentRows } = await getCatalogExportData(locale);
  const byCode = new Map(currentRows.filter((row) => row.serviceCode).map((row) => [row.serviceCode, row]));
  const { data: persistedCategories, error: categoryError } = await supabase
    .from("organization_portal_categories")
    .select("category_key, is_active")
    .eq("organization_id", organizationId);
  if (categoryError || !persistedCategories) throw new Error("catalog_unavailable");
  const activeCategories = new Set(persistedCategories.filter((row) => row.is_active).map((row) => row.category_key));
  const pricesByService = new Map<string, PriceRow[]>();
  for (const ids of chunks(currentRows.map((row) => row.serviceId), 100)) {
    let cursor: string | null = null;
    for (;;) {
      let query = supabase.from("service_prices")
        .select("id, service_id, amount, currency, is_from, valid_from, valid_to")
        .eq("organization_id", organizationId).in("service_id", ids)
        .is("location_id", null).eq("is_active", true).order("id").limit(500);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query.returns<PriceRow[]>();
      if (error || !data) throw new Error("prices_unavailable");
      for (const price of data) {
        const rows = pricesByService.get(price.service_id) ?? [];
        rows.push(price);
        pricesByService.set(price.service_id, rows);
      }
      if (data.length < 500) break;
      cursor = data[data.length - 1].id;
    }
  }
  const after = await readSnapshot(supabase);
  if (before !== after) throw new Error("stale_preview");

  const dateError = !validIsoDate(effectiveDate) || effectiveDate < today;
  const orderMode = parsed.find((entry) => !entry.row.skip)?.row.orderMode;
  const items: UnifiedPreviewItem[] = [];
  const rows: UnifiedRow[] = [];
  for (const entry of parsed) {
    const errors = [...entry.errors];
    if (dateError) errors.push("effective_date");
    if (mode === "catalog_and_prices" && !entry.row.skip && entry.row.orderMode !== orderMode) errors.push("catalog_order_mode");
    const original = byCode.get(entry.row.serviceCode);
    let catalog: UnifiedPreviewItem["catalog"] = "unchanged";
    let effective = entry.row;
    if (entry.row.skip) {
      // An archived row or an explicitly documented exclusion has no write path.
    } else if (mode === "catalog_and_prices") {
      if (!activeCategories.has(entry.row.categoryKey)) errors.push("unknown_category");
      if (!original && !entry.row.canonicalName) errors.push("required_name");
      effective = original ? {
        ...entry.row,
        canonicalName: entry.row.canonicalName || original.canonicalName,
        canonicalDescription: entry.row.canonicalDescription || original.canonicalDescription,
        categoryTranslations: { ...original.categoryTranslations, ...entry.row.categoryTranslations },
        translations: { ...original.translations, ...entry.row.translations },
      } : entry.row;
      catalog = !original ? "create" : comparableCatalog(effective) === comparableCatalog(original) ? "unchanged" : "update";
    } else if (!original) errors.push("unknown_service_code");
    else if (original.status !== "active") errors.push("inactive_service");
    else if (original.unitType !== entry.row.unitType) errors.push("unit_type_mismatch");
    effective = { ...effective, catalogChanged: catalog !== "unchanged" };

    const active = original ? pricesByService.get(original.serviceId) ?? [] : [];
    const planned = planUnifiedPrice(active, effective.skip ? null : effective.price, effectiveDate, today, currency);
    errors.push(...planned.errors);
    const priceAction = planned.action;
    const previous = planned.previous;
    items.push({ code: effective.serviceCode, row: entry.rowNumber, catalog, price: priceAction,
      name: original?.canonicalName || effective.canonicalName, unitType: original?.unitType || effective.unitType,
      previousAmount: previous ? `${Number(previous.amount).toFixed(2)} ${previous.currency}` : null,
      newAmount: effective.price ? `${Number(effective.price.amount).toFixed(2)} ${effective.price.currency}` : null,
      previousIsFrom: previous?.is_from ?? null, newIsFrom: effective.price?.isFrom ?? null,
      effectiveDate, skipped: effective.skip ? effective.skipReason : mode === "prices_only" && !effective.price ? "blank_price" : null,
      errors });
    rows.push(effective);
  }
  const preview = {
    catalogCreates: items.filter((item) => item.catalog === "create" && !item.errors.length).length,
    catalogUpdates: items.filter((item) => item.catalog === "update" && !item.errors.length).length,
    priceCreates: items.filter((item) => ["create", "close_and_create"].includes(item.price) && !item.errors.length).length,
    priceClosures: items.filter((item) => item.price === "close_and_create" && !item.errors.length).length,
    unchanged: items.filter((item) => !item.skipped && item.catalog === "unchanged" && ["unchanged", "none"].includes(item.price) && !item.errors.length).length,
    imported: items.filter((item) => !item.skipped && !item.errors.length).length,
    skipped: items.filter((item) => item.skipped && !item.errors.length).length,
    errors: items.filter((item) => item.errors.length).length,
    items,
  };
  return { preview, rows, snapshot: before };
}

export async function previewUnifiedCatalogAction(
  locale: string, _state: UnifiedImportState = empty, formData: FormData,
): Promise<UnifiedImportState> {
  void _state;
  await requireOwnerOrManager(locale);
  const mode = String(formData.get("mode") ?? "");
  const effectiveDate = String(formData.get("effectiveDate") ?? "");
  const file = formData.get("catalogFile");
  if (mode !== "prices_only" && mode !== "catalog_and_prices") return { ...empty, error: "mode" };
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_UNIFIED_CSV_BYTES) return { ...empty, error: "file" };
  try {
    const csv = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    const parsed = parseUnifiedCatalogCsv(csv, mode);
    const checked = await validate(locale, mode, effectiveDate, parsed);
    const payload = JSON.stringify({ csv, mode, effectiveDate, snapshot: checked.snapshot });
    if (new TextEncoder().encode(payload).length > 1_800_000) return { ...empty, error: "file", preview: checked.preview };
    return {
      error: null,
      payload: checked.preview.errors ? null : payload,
      preview: checked.preview,
      success: false,
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "preview" };
  }
}

export async function confirmUnifiedCatalogAction(
  locale: string, _state: UnifiedImportState = empty, formData: FormData,
): Promise<UnifiedImportState> {
  void _state;
  await requireOwnerOrManager(locale);
  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "")) as {
      csv: string; mode: UnifiedImportMode; effectiveDate: string; snapshot: string;
    };
    if (typeof payload.csv !== "string" || new TextEncoder().encode(payload.csv).length > MAX_UNIFIED_CSV_BYTES
      || !["prices_only", "catalog_and_prices"].includes(payload.mode)
      || typeof payload.snapshot !== "string" || !/^[0-9a-f]{32}$/.test(payload.snapshot)) {
      throw new Error("payload");
    }
    const parsed = parseUnifiedCatalogCsv(payload.csv, payload.mode);
    const checked = await validate(locale, payload.mode, payload.effectiveDate, parsed);
    if (checked.snapshot !== payload.snapshot) return { ...empty, error: "stale_preview" };
    if (checked.preview.errors) return { ...empty, error: "validation", preview: checked.preview };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("apply_unified_catalog_import", {
      target_mode: payload.mode,
      target_effective_date: payload.effectiveDate,
      target_rows: checked.rows,
      expected_snapshot: payload.snapshot,
    });
    if (error) {
      console.error("Unified catalog import failed", error.code);
      return { ...empty, error: error.code === "40001" ? "stale_preview" : "apply" };
    }
    for (const activeLocale of routing.locales) {
      revalidatePath(`/${activeLocale}/app/settings/catalog`);
      revalidatePath(`/${activeLocale}/app/services`);
      revalidatePath(`/${activeLocale}/app/shop`);
      revalidatePath(`/${activeLocale}/portal/requests/new`);
    }
    return { ...empty, success: true };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "payload" };
  }
}
