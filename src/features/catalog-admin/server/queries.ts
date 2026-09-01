import "server-only";

import { SERVICE_CATEGORY_KEYS } from "@/features/services/catalog";
import type { BrandFocalPosition } from "@/features/branding/types";
import type {
  CatalogAdminCategory,
  CatalogAdminService,
  CatalogAdminSettings,
} from "@/features/catalog-admin/types";
import { listServices } from "@/features/services/server/queries";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppLocale } from "@/i18n/routing";
import type { CatalogOrderMode } from "@/features/catalog-productization/types";

type ServiceRow = {
  customer_orderable: boolean;
  id: string;
  portal_category_key: string | null;
  portal_description: string | null;
  portal_featured: boolean;
  portal_image_path: string | null;
  portal_sort_order: number;
  portal_visible: boolean;
};

type CategoryRow = {
  category_key: string;
  focal_position: BrandFocalPosition;
  image_path: string | null;
  is_active: boolean;
  portal_featured: boolean;
  portal_sort_order: number;
  portal_title: string | null;
  portal_visible: boolean;
};

type ServiceTranslationRow = { description: string | null; locale: AppLocale; name: string; service_id: string };
type CategoryTranslationRow = { category_key: string; locale: AppLocale; title: string };

function storageUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string | null,
) {
  if (!path) return null;
  if (path.startsWith("/")) return path;
  return supabase.storage.from("brand-media").getPublicUrl(path).data.publicUrl;
}

export async function getCatalogAdminSettings(locale: string): Promise<CatalogAdminSettings> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const [internalServices, servicesResult, categoriesResult, serviceTranslationsResult, categoryTranslationsResult, organizationResult] = await Promise.all([
    listServices(locale, "all"),
    supabase
      .from("services")
      .select("id, portal_visible, customer_orderable, portal_featured, portal_category_key, portal_sort_order, portal_description, portal_image_path")
      .eq("organization_id", membership.organization.id)
      .order("portal_sort_order", { ascending: true })
      .limit(500)
      .returns<ServiceRow[]>(),
    supabase
      .from("organization_portal_categories")
      .select("category_key, image_path, focal_position, is_active, portal_visible, portal_featured, portal_sort_order, portal_title")
      .eq("organization_id", membership.organization.id)
      .order("portal_sort_order", { ascending: true })
      .returns<CategoryRow[]>(),
    supabase.from("service_catalog_translations")
      .select("service_id, locale, name, description")
      .eq("organization_id", membership.organization.id)
      .returns<ServiceTranslationRow[]>(),
    supabase.from("category_catalog_translations")
      .select("category_key, locale, title")
      .eq("organization_id", membership.organization.id)
      .returns<CategoryTranslationRow[]>(),
    supabase.from("organizations")
      .select("catalog_order_mode")
      .eq("id", membership.organization.id)
      .maybeSingle<{ catalog_order_mode: CatalogOrderMode }>(),
  ]);

  if (servicesResult.error || categoriesResult.error || serviceTranslationsResult.error || categoryTranslationsResult.error || organizationResult.error || !organizationResult.data) {
    console.error("Catalog administration query unavailable", servicesResult.error?.code ?? categoriesResult.error?.code ?? serviceTranslationsResult.error?.code ?? categoryTranslationsResult.error?.code ?? organizationResult.error?.code);
    return { available: false, categories: [], orderMode: "manual", services: [] };
  }

  const serviceTranslations = new Map<string, CatalogAdminService["translations"]>();
  for (const translation of serviceTranslationsResult.data ?? []) {
    const current = serviceTranslations.get(translation.service_id) ?? {};
    current[translation.locale] = { description: translation.description ?? "", name: translation.name };
    serviceTranslations.set(translation.service_id, current);
  }
  const categoryTranslations = new Map<string, CatalogAdminCategory["translations"]>();
  for (const translation of categoryTranslationsResult.data ?? []) {
    const current = categoryTranslations.get(translation.category_key) ?? {};
    current[translation.locale] = translation.title;
    categoryTranslations.set(translation.category_key, current);
  }

  const rowsByKey = new Map((categoriesResult.data ?? []).map((row) => [row.category_key, row]));
  const categoryKeys = [...new Set([...SERVICE_CATEGORY_KEYS, ...(categoriesResult.data ?? []).map((row) => row.category_key)])];
  const activeServiceCounts = new Map<string, number>();
  for (const service of internalServices.filter((item) => item.isActive)) {
    const categoryKey = (servicesResult.data ?? []).find((row) => row.id === service.id)?.portal_category_key ?? service.category;
    if (categoryKey) activeServiceCounts.set(categoryKey, (activeServiceCounts.get(categoryKey) ?? 0) + 1);
  }
  const categories: CatalogAdminCategory[] = categoryKeys.map((categoryKey, index) => {
    const row = rowsByKey.get(categoryKey);
    return {
      activeServiceCount: activeServiceCounts.get(categoryKey) ?? 0,
      categoryKey,
      focalPosition: row?.focal_position ?? "center",
      imagePath: row?.image_path ?? null,
      imageUrl: storageUrl(supabase, row?.image_path ?? null),
      isActive: row?.is_active ?? true,
      portalFeatured: row?.portal_featured ?? false,
      portalSortOrder: row?.portal_sort_order ?? index,
      portalTitle: row?.portal_title ?? "",
      portalVisible: row?.portal_visible ?? true,
      translations: categoryTranslations.get(categoryKey) ?? {},
    };
  }).sort((left, right) => left.portalSortOrder - right.portalSortOrder);

  const internalById = new Map(internalServices.map((service) => [service.id, service]));
  const services: CatalogAdminService[] = (servicesResult.data ?? []).flatMap((row) => {
    const service = internalById.get(row.id);
    if (!service) return [];
    return {
      amount: service.amount,
      code: service.code,
      customerOrderable: row.customer_orderable,
      currency: service.currency,
      id: row.id,
      internalCategory: service.category,
      internalDescription: service.description,
      isActive: service.isActive,
      name: service.name,
      portalCategoryKey: row.portal_category_key,
      portalDescription: row.portal_description ?? "",
      portalFeatured: row.portal_featured,
      portalImagePath: row.portal_image_path,
      portalImageUrl: storageUrl(supabase, row.portal_image_path),
      portalSortOrder: row.portal_sort_order,
      portalVisible: row.portal_visible,
      priceIsFrom: service.priceIsFrom,
      unitType: service.unitType,
      translations: serviceTranslations.get(row.id) ?? {},
    };
  });

  return { available: true, categories, orderMode: organizationResult.data.catalog_order_mode, services };
}
