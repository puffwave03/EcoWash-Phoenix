import "server-only";

import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import type { ShopCatalogSelection, ShopCustomer, ShopDeliveryAddress, ShopDeliveryOptions, ShopOperationalOptions, ShopRecentOrder, ShopService } from "@/features/shop-terminal/types";
import { loadCatalogPresentation } from "@/features/catalog-productization/server/queries";
import { sortCatalogPresentation } from "@/features/catalog-productization/presentation";
import { listAssignableStaff } from "@/features/logistics/server/queries";

type ServiceRow = {
  amount: number;
  category: string | null;
  code: string | null;
  currency: string;
  description: string | null;
  id: string;
  name: string;
  price_is_from: boolean;
  pricing_segment_name: string | null;
  pricing_source: "base" | "segment";
  unit_type: ShopService["unitType"];
};

function serviceImageUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string | null,
) {
  if (!path) return null;
  if (path.startsWith("/")) return path;
  return supabase.storage.from("brand-media").getPublicUrl(path).data.publicUrl;
}

type DeliveryCustomerRow = {
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_country_code: string | null;
  billing_postal_code: string | null;
  customer_code: string | null;
  display_name: string;
  phone: string | null;
};

type DeliveryPropertyRow = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  country_code: string | null;
  id: string;
  name: string;
  postal_code: string | null;
};

function deliveryAddress(row: {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  country_code: string | null;
  postal_code: string | null;
}): ShopDeliveryAddress {
  return {
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    city: row.city ?? "",
    contactName: row.contact_name ?? "",
    contactPhone: row.contact_phone ?? "",
    countryCode: row.country_code ?? "ES",
    postalCode: row.postal_code ?? "",
  };
}

export async function listShopOperationalOptions(locale: string): Promise<ShopOperationalOptions> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const [assignments, locations] = await Promise.all([
    listAssignableStaff(locale),
    supabase.from("locations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .is("deleted_at", null),
  ]);
  if (locations.error) console.error("Shop active location count failed", locations.error.code);
  return {
    deliveryAssignments: assignments.delivery,
    productionAssignments: !locations.error && locations.count === 1 ? assignments.all : [],
  };
}

export async function loadShopDeliveryOptions(locale: string, customerId: string): Promise<ShopDeliveryOptions> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const customerResult = await supabase.from("customers")
    .select("customer_code, display_name, phone, billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_country_code")
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId)
    .eq("is_active", true)
    .maybeSingle<DeliveryCustomerRow>();
  if (customerResult.error || !customerResult.data) {
    if (customerResult.error) console.error("Shop delivery customer query failed", customerResult.error.code);
    return { billing: null, properties: [] };
  }
  if (customerResult.data.customer_code === "WALKIN-SHARED") return { billing: null, properties: [] };

  const propertiesResult = await supabase.from("properties")
    .select("id, name, address_line1, address_line2, city, postal_code, country_code, contact_name, contact_phone")
    .eq("organization_id", membership.organization.id)
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<DeliveryPropertyRow[]>();
  if (propertiesResult.error) console.error("Shop delivery properties query failed", propertiesResult.error.code);
  const customer = customerResult.data;
  const billing = customer.billing_address_line1 ? deliveryAddress({
    address_line1: customer.billing_address_line1,
    address_line2: customer.billing_address_line2,
    city: customer.billing_city,
    contact_name: customer.display_name,
    contact_phone: customer.phone,
    country_code: customer.billing_country_code,
    postal_code: customer.billing_postal_code,
  }) : null;
  return {
    billing,
    properties: (propertiesResult.data ?? []).map((property) => ({
      ...deliveryAddress(property),
      id: property.id,
      name: property.name,
    })),
  };
}

export async function listShopCustomers(locale: string): Promise<ShopCustomer[]> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("customers")
    .select("id, customer_code, display_name, email, phone, updated_at")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .or("customer_code.is.null,customer_code.not.like.WALKIN-%")
    .order("updated_at", { ascending: false })
    .limit(80)
    .returns<{ customer_code: string | null; display_name: string; email: string | null; id: string; phone: string | null; updated_at: string }[]>();

  if (error) {
    console.error("Shop customer query failed", error.code);
    return [];
  }

  return (data ?? []).map((customer) => ({
    email: customer.email,
    id: customer.id,
    isWalkIn: false,
    name: customer.display_name,
    phone: customer.phone,
    updatedAt: customer.updated_at,
  }));
}

export async function listShopRecentOrders(locale: string): Promise<ShopRecentOrder[]> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, t] = await Promise.all([supabase.from("orders")
    .select("id, order_number, total, walk_in_name, customer:customers!orders_customer_same_organization!inner(customer_code, display_name)")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(6)
    .returns<{ customer: { customer_code: string | null; display_name: string } | { customer_code: string | null; display_name: string }[]; id: string; order_number: string; total: number; walk_in_name: string | null }[]>(),
    getTranslations({ locale, namespace: "common.shopTerminal.labels" }),
  ]);

  if (error) {
    console.error("Shop recent order query failed", error.code);
    return [];
  }

  return (data ?? []).map((order) => {
    const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    return {
      customerName: order.walk_in_name ?? (customer?.customer_code === "WALKIN-SHARED" ? t("occasionalCustomer") : customer?.display_name ?? ""),
      id: order.id,
      orderNumber: order.order_number,
      total: Number(order.total),
    };
  });
}

export async function listShopServices(
  locale: string,
  customerId: string,
  locationId: string | null,
): Promise<ShopCatalogSelection> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const [servicesResult, categoriesResult, customerResult] = await Promise.all([
    supabase.rpc("list_shop_terminal_services", {
      target_customer_id: customerId,
      target_location_id: locationId,
    }).returns<ServiceRow[]>(),
    supabase.from("organization_portal_categories")
      .select("category_key, portal_title")
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .returns<{ category_key: string; portal_title: string | null }[]>(),
    supabase.from("customers")
      .select("catalog_segment_id")
      .eq("organization_id", membership.organization.id)
      .eq("id", customerId)
      .eq("is_active", true)
      .maybeSingle<{ catalog_segment_id: string | null }>(),
  ]);

  if (servicesResult.error || categoriesResult.error || customerResult.error || !customerResult.data) {
    console.error("Shop service query failed", servicesResult.error?.code ?? categoriesResult.error?.code ?? customerResult.error?.code);
    return { segmentName: null, services: [] };
  }

  const segmentResult = customerResult.data.catalog_segment_id
    ? await supabase.from("catalog_segments")
      .select("name")
      .eq("organization_id", membership.organization.id)
      .eq("id", customerResult.data.catalog_segment_id)
      .eq("is_active", true)
      .maybeSingle<{ name: string }>()
    : { data: null, error: null };
  if (segmentResult.error) console.error("Shop customer segment query failed", segmentResult.error.code);

  const services = (servicesResult.data ?? []) as unknown as ServiceRow[];
  const mediaResult = services.length > 0
    ? await supabase.from("services")
      .select("id, portal_image_path, portal_sort_order")
      .eq("organization_id", membership.organization.id)
      .in("id", services.map((service) => service.id))
      .returns<{ id: string; portal_image_path: string | null; portal_sort_order: number }[]>()
    : { data: [], error: null };
  if (mediaResult.error) console.error("Shop service media query failed", mediaResult.error.code);

  const categoryTitles = new Map((categoriesResult.data ?? []).map((category) => [category.category_key, category.portal_title]));
  const imagePaths = new Map((mediaResult.data ?? []).map((service) => [service.id, service.portal_image_path]));
  const presentation = await loadCatalogPresentation(supabase, locale, services.map((service) => service.id));
  const mode = presentation.values().next().value?.orderMode ?? "manual";
  const mapped = services.map((service) => ({
    amount: Number(service.amount),
    category: presentation.get(service.id)?.categoryTitle ?? (service.category ? categoryTitles.get(service.category) || null : null),
    categoryKey: service.category,
    code: service.code,
    currency: service.currency,
    description: presentation.get(service.id)?.description ?? service.description,
    id: service.id,
    imageUrl: serviceImageUrl(supabase, imagePaths.get(service.id) ?? null),
    name: presentation.get(service.id)?.name ?? service.name,
    priceIsFrom: service.price_is_from,
    pricingSegmentName: service.pricing_segment_name,
    pricingSource: service.pricing_source,
    unitType: service.unit_type,
  }));
  return {
    segmentName: segmentResult.data?.name ?? null,
    services: sortCatalogPresentation(mapped, presentation, locale, mode),
  };
}
