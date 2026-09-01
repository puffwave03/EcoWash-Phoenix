import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalogAdminSettings } from "@/features/catalog-admin/server/queries";
import type { CatalogImportRow, CatalogPresentation } from "@/features/catalog-productization/types";

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

export async function getCatalogExportData(locale: string) {
  const settings = await getCatalogAdminSettings(locale);
  const categories = new Map(settings.categories.map((category) => [category.categoryKey, category]));
  const rows: CatalogImportRow[] = settings.services.map((service) => {
    const category = categories.get(service.portalCategoryKey ?? service.internalCategory ?? "");
    return {
      canonicalDescription: service.internalDescription ?? "",
      canonicalName: service.name,
      categoryKey: service.portalCategoryKey ?? service.internalCategory ?? "",
      categoryTranslations: category?.translations ?? {},
      customerOrderable: service.customerOrderable,
      customerVisible: service.portalVisible,
      featured: service.portalFeatured,
      manualSortOrder: service.portalSortOrder,
      orderMode: settings.orderMode,
      serviceCode: service.code ?? "",
      serviceId: service.id,
      status: service.isActive ? "active" : "archived",
      translations: service.translations,
      unitType: service.unitType,
    };
  });
  return {
    mediaPaths: new Map(settings.services.map((service) => [service.id, service.portalImagePath])),
    rows,
    settings,
  };
}
