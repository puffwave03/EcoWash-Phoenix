import "server-only";

import { SERVICE_CATEGORY_KEYS, type ServiceCategoryKey } from "@/features/services/catalog";
import type { BrandFocalPosition } from "@/features/branding/types";
import type {
  CatalogAdminCategory,
  CatalogAdminService,
  CatalogAdminSettings,
} from "@/features/catalog-admin/types";
import { listServices } from "@/features/services/server/queries";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServiceRow = {
  customer_orderable: boolean;
  id: string;
  portal_category_key: ServiceCategoryKey | null;
  portal_description: string | null;
  portal_featured: boolean;
  portal_image_path: string | null;
  portal_sort_order: number;
  portal_visible: boolean;
};

type CategoryRow = {
  category_key: ServiceCategoryKey;
  focal_position: BrandFocalPosition;
  image_path: string | null;
  portal_featured: boolean;
  portal_sort_order: number;
  portal_title: string | null;
  portal_visible: boolean;
};

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
  const [internalServices, servicesResult, categoriesResult] = await Promise.all([
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
      .select("category_key, image_path, focal_position, portal_visible, portal_featured, portal_sort_order, portal_title")
      .eq("organization_id", membership.organization.id)
      .order("portal_sort_order", { ascending: true })
      .returns<CategoryRow[]>(),
  ]);

  if (servicesResult.error || categoriesResult.error) {
    console.error("Catalog administration query unavailable", servicesResult.error?.code ?? categoriesResult.error?.code);
    return { available: false, categories: [], services: [] };
  }

  const rowsByKey = new Map((categoriesResult.data ?? []).map((row) => [row.category_key, row]));
  const categories: CatalogAdminCategory[] = SERVICE_CATEGORY_KEYS.map((categoryKey, index) => {
    const row = rowsByKey.get(categoryKey);
    return {
      categoryKey,
      focalPosition: row?.focal_position ?? "center",
      imagePath: row?.image_path ?? null,
      imageUrl: storageUrl(supabase, row?.image_path ?? null),
      portalFeatured: row?.portal_featured ?? false,
      portalSortOrder: row?.portal_sort_order ?? index,
      portalTitle: row?.portal_title ?? "",
      portalVisible: row?.portal_visible ?? true,
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
    };
  });

  return { available: true, categories, services };
}
