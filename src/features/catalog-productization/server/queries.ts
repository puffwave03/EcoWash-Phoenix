import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SERVICE_CATEGORY_KEYS } from "@/features/services/catalog";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppLocale } from "@/i18n/routing";
import type { ServiceUnitType } from "@/features/services/types";
import type { CatalogImportRow, CatalogOrderMode, CatalogPresentation, CatalogTranslations, CategoryTranslations } from "@/features/catalog-productization/types";

type PresentationRow = {
  category_sort_order: number;
  category_title: string;
  display_description: string | null;
  display_name: string;
  manual_sort_order: number;
  order_mode: CatalogPresentation["orderMode"];
  service_id: string;
};

export async function loadCatalogPresentation(
  supabase: SupabaseClient,
  locale: string,
  serviceIds: string[],
): Promise<Map<string, CatalogPresentation>> {
  if (serviceIds.length === 0) return new Map<string, CatalogPresentation>();
  const { data, error } = await supabase.rpc("get_catalog_presentation", {
    target_locale: locale,
    target_service_ids: serviceIds,
  }).returns<PresentationRow[]>();
  if (error) {
    console.error("Catalog presentation query failed", error.code);
    return new Map<string, CatalogPresentation>();
  }
  const presentation = new Map<string, CatalogPresentation>();
  for (const row of (data ?? []) as unknown as PresentationRow[]) {
    presentation.set(row.service_id, {
      categorySortOrder: row.category_sort_order,
      categoryTitle: row.category_title,
      description: row.display_description,
      manualSortOrder: row.manual_sort_order,
      name: row.display_name,
      orderMode: row.order_mode,
      serviceId: row.service_id,
    });
  }
  return presentation;
}

type ExportService = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit_type: ServiceUnitType;
  is_active: boolean;
  portal_category_key: string | null;
  portal_sort_order: number;
  portal_visible: boolean;
  customer_orderable: boolean;
  portal_featured: boolean;
  portal_image_path: string | null;
};

type ExportCategory = { category_key: string; is_active: boolean };
type ServiceTranslation = { service_id: string; locale: AppLocale; name: string; description: string | null };
type CategoryTranslation = { category_key: string; locale: AppLocale; title: string };

const PAGE_SIZE = 500;
const TRANSLATION_CHUNK_SIZE = 100;

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function getCatalogExportData(locale: string) {
  const { membership } = await requireOwnerOrManager(locale);
  const organizationId = membership.organization.id;
  const supabase = await createSupabaseServerClient();
  const organizationResult = await supabase.from("organizations").select("catalog_order_mode")
    .eq("id", organizationId).single<{ catalog_order_mode: CatalogOrderMode }>();
  if (organizationResult.error || !organizationResult.data) throw new Error("catalog_export_unavailable");

  const services: ExportService[] = [];
  let serviceCursor: string | null = null;
  for (;;) {
    let query = supabase.from("services")
      .select("id, code, name, description, category, unit_type, is_active, portal_category_key, portal_sort_order, portal_visible, customer_orderable, portal_featured, portal_image_path")
      .eq("organization_id", organizationId).order("id").limit(PAGE_SIZE);
    if (serviceCursor) query = query.gt("id", serviceCursor);
    const { data, error } = await query.returns<ExportService[]>();
    if (error || !data) throw new Error("catalog_export_unavailable");
    services.push(...data);
    if (data.length < PAGE_SIZE) break;
    serviceCursor = data[data.length - 1].id;
  }

  const categories = new Map<string, { categoryKey: string; isActive: boolean }>(
    SERVICE_CATEGORY_KEYS.map((categoryKey) => [categoryKey, { categoryKey, isActive: true }]),
  );
  let categoryCursor: string | null = null;
  for (;;) {
    let query = supabase.from("organization_portal_categories")
      .select("category_key, is_active")
      .eq("organization_id", organizationId).order("category_key").limit(PAGE_SIZE);
    if (categoryCursor) query = query.gt("category_key", categoryCursor);
    const { data, error } = await query.returns<ExportCategory[]>();
    if (error || !data) throw new Error("catalog_export_unavailable");
    for (const category of data) categories.set(category.category_key, {
      categoryKey: category.category_key, isActive: category.is_active,
    });
    if (data.length < PAGE_SIZE) break;
    categoryCursor = data[data.length - 1].category_key;
  }

  const serviceTranslations = new Map<string, CatalogTranslations>();
  for (const ids of chunks(services.map((service) => service.id), TRANSLATION_CHUNK_SIZE)) {
    const { data, error } = await supabase.from("service_catalog_translations")
      .select("service_id, locale, name, description")
      .eq("organization_id", organizationId).in("service_id", ids).returns<ServiceTranslation[]>();
    if (error || !data) throw new Error("catalog_export_unavailable");
    for (const translation of data) {
      const values = serviceTranslations.get(translation.service_id) ?? {};
      values[translation.locale] = { name: translation.name, description: translation.description ?? "" };
      serviceTranslations.set(translation.service_id, values);
    }
  }

  const categoryTranslations = new Map<string, CategoryTranslations>();
  for (const keys of chunks([...categories.keys()], TRANSLATION_CHUNK_SIZE)) {
    const { data, error } = await supabase.from("category_catalog_translations")
      .select("category_key, locale, title")
      .eq("organization_id", organizationId).in("category_key", keys).returns<CategoryTranslation[]>();
    if (error || !data) throw new Error("catalog_export_unavailable");
    for (const translation of data) {
      const values = categoryTranslations.get(translation.category_key) ?? {};
      values[translation.locale] = translation.title;
      categoryTranslations.set(translation.category_key, values);
    }
  }

  services.sort((left, right) => left.portal_sort_order - right.portal_sort_order || left.id.localeCompare(right.id));
  const rows: CatalogImportRow[] = services.map((service) => {
    const categoryKey = service.portal_category_key ?? service.category ?? "";
    return {
      canonicalDescription: service.description ?? "",
      canonicalName: service.name,
      categoryKey,
      categoryTranslations: categoryTranslations.get(categoryKey) ?? {},
      customerOrderable: service.customer_orderable,
      customerVisible: service.portal_visible,
      featured: service.portal_featured,
      manualSortOrder: service.portal_sort_order,
      orderMode: organizationResult.data.catalog_order_mode,
      serviceCode: service.code ?? "",
      serviceId: service.id,
      status: service.is_active ? "active" : "archived",
      translations: serviceTranslations.get(service.id) ?? {},
      unitType: service.unit_type,
    };
  });
  return {
    mediaPaths: new Map(services.map((service) => [service.id, service.portal_image_path])),
    rows,
    settings: { categories: [...categories.values()], orderMode: organizationResult.data.catalog_order_mode },
  };
}
