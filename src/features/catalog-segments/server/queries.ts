import "server-only";

import { getCatalogAdminSettings } from "@/features/catalog-admin/server/queries";
import { loadCatalogPresentation } from "@/features/catalog-productization/server/queries";
import type { AppLocale } from "@/i18n/routing";
import type {
  CatalogSegment,
  CatalogSegmentAdminSettings,
  CatalogSegmentCustomer,
  CustomerSegmentAssignment,
} from "@/features/catalog-segments/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SegmentRow = {
  description: string | null;
  display_order: number;
  id: string;
  is_active: boolean;
  name: string;
  portal_visible: boolean;
};

type ServiceLinkRow = {
  display_order: number;
  featured: boolean;
  segment_id: string;
  service_id: string;
};

type CategoryLinkRow = {
  category_key: string;
  display_order: number;
  segment_id: string;
};

type CustomerRow = {
  catalog_segment_id: string | null;
  display_name: string;
  id: string;
  is_active: boolean;
};

export async function getCatalogSegmentAdminSettings(locale: string): Promise<CatalogSegmentAdminSettings> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const catalog = await getCatalogAdminSettings(locale);
  const [presentation, segmentsResult, servicesResult, categoriesResult, customersResult] = await Promise.all([
    loadCatalogPresentation(supabase, locale, catalog.services.map((service) => service.id)),
    supabase
      .from("catalog_segments")
      .select("id, name, description, is_active, portal_visible, display_order")
      .eq("organization_id", membership.organization.id)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .returns<SegmentRow[]>(),
    supabase
      .from("catalog_segment_services")
      .select("segment_id, service_id, display_order, featured")
      .eq("organization_id", membership.organization.id)
      .order("display_order", { ascending: true })
      .returns<ServiceLinkRow[]>(),
    supabase
      .from("catalog_segment_categories")
      .select("segment_id, category_key, display_order")
      .eq("organization_id", membership.organization.id)
      .order("display_order", { ascending: true })
      .returns<CategoryLinkRow[]>(),
    supabase
      .from("customers")
      .select("id, display_name, is_active, catalog_segment_id")
      .eq("organization_id", membership.organization.id)
      .order("display_name", { ascending: true })
      .limit(500)
      .returns<CustomerRow[]>(),
  ]);

  const error = segmentsResult.error || servicesResult.error || categoriesResult.error || customersResult.error;
  if (error || !catalog.available) {
    console.error("Catalog segment administration query unavailable", error?.code ?? "catalog");
    return { available: false, categories: catalog.categories, customers: [], segments: [], services: catalog.services };
  }

  const customers: CatalogSegmentCustomer[] = (customersResult.data ?? []).map((customer) => ({
    catalogSegmentId: customer.catalog_segment_id,
    displayName: customer.display_name,
    id: customer.id,
    isActive: customer.is_active,
  }));
  const segments: CatalogSegment[] = (segmentsResult.data ?? []).map((segment) => ({
    categoryLinks: (categoriesResult.data ?? [])
      .filter((link) => link.segment_id === segment.id)
      .map((link) => ({ categoryKey: link.category_key, displayOrder: link.display_order })),
    customerIds: customers.filter((customer) => customer.catalogSegmentId === segment.id).map((customer) => customer.id),
    description: segment.description ?? "",
    displayOrder: segment.display_order,
    id: segment.id,
    isActive: segment.is_active,
    name: segment.name,
    portalVisible: segment.portal_visible,
    serviceLinks: (servicesResult.data ?? [])
      .filter((link) => link.segment_id === segment.id)
      .map((link) => ({
        displayOrder: link.display_order,
        featured: link.featured,
        serviceId: link.service_id,
      })),
  }));
  const localizedCategoryTitles = new Map<string, string>();
  for (const service of catalog.services) {
    const categoryKey = service.portalCategoryKey ?? service.internalCategory;
    const categoryTitle = presentation.get(service.id)?.categoryTitle;
    if (categoryKey && categoryTitle) localizedCategoryTitles.set(categoryKey, categoryTitle);
  }
  const requestedLocale = locale as AppLocale;

  return {
    available: true,
    categories: catalog.categories.map((category) => ({
      ...category,
      portalTitle: localizedCategoryTitles.get(category.categoryKey)
        ?? category.translations[requestedLocale]
        ?? category.translations.en
        ?? category.portalTitle,
    })),
    customers,
    segments,
    services: catalog.services.map((service) => ({
      ...service,
      name: presentation.get(service.id)?.name
        ?? service.translations[requestedLocale]?.name
        ?? service.translations.en?.name
        ?? service.name,
    })),
  };
}

export async function getCustomerSegmentAssignment(
  locale: string,
  customerId: string,
): Promise<CustomerSegmentAssignment> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const [customerResult, segmentsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("catalog_segment_id")
      .eq("organization_id", membership.organization.id)
      .eq("id", customerId)
      .maybeSingle<{ catalog_segment_id: string | null }>(),
    supabase
      .from("catalog_segments")
      .select("id, name")
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string }>>(),
  ]);

  if (customerResult.error || segmentsResult.error) {
    console.error("Customer segment assignment query unavailable", customerResult.error?.code ?? segmentsResult.error?.code);
    return { currentSegmentId: null, segments: [] };
  }

  return {
    currentSegmentId: customerResult.data?.catalog_segment_id ?? null,
    segments: segmentsResult.data ?? [],
  };
}
