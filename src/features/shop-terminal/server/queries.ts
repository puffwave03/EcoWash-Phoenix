import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import type { ShopCustomer, ShopRecentOrder, ShopService } from "@/features/shop-terminal/types";

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

export async function listShopCustomers(locale: string): Promise<ShopCustomer[]> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("customers")
    .select("id, customer_code, display_name, email, phone, updated_at")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
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
    isWalkIn: customer.customer_code?.startsWith("WALKIN-") ?? false,
    name: customer.display_name,
    phone: customer.phone,
    updatedAt: customer.updated_at,
  }));
}

export async function listShopRecentOrders(locale: string): Promise<ShopRecentOrder[]> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("orders")
    .select("id, order_number, total, customer:customers!orders_customer_same_organization!inner(display_name)")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(6)
    .returns<{ customer: { display_name: string } | { display_name: string }[]; id: string; order_number: string; total: number }[]>();

  if (error) {
    console.error("Shop recent order query failed", error.code);
    return [];
  }

  return (data ?? []).map((order) => ({
    customerName: (Array.isArray(order.customer) ? order.customer[0] : order.customer)?.display_name ?? "",
    id: order.id,
    orderNumber: order.order_number,
    total: Number(order.total),
  }));
}

export async function listShopServices(
  locale: string,
  customerId: string,
  locationId: string | null,
): Promise<ShopService[]> {
  const { membership } = await requireShopTerminalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const [servicesResult, categoriesResult] = await Promise.all([
    supabase.rpc("list_shop_terminal_services", {
      target_customer_id: customerId,
      target_location_id: locationId,
    }).returns<ServiceRow[]>(),
    supabase.from("organization_portal_categories")
      .select("category_key, portal_title")
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .returns<{ category_key: string; portal_title: string | null }[]>(),
  ]);

  if (servicesResult.error || categoriesResult.error) {
    console.error("Shop service query failed", servicesResult.error?.code ?? categoriesResult.error?.code);
    return [];
  }

  const services = (servicesResult.data ?? []) as unknown as ServiceRow[];
  const mediaResult = services.length > 0
    ? await supabase.from("services")
      .select("id, portal_image_path")
      .eq("organization_id", membership.organization.id)
      .in("id", services.map((service) => service.id))
      .returns<{ id: string; portal_image_path: string | null }[]>()
    : { data: [], error: null };
  if (mediaResult.error) console.error("Shop service media query failed", mediaResult.error.code);

  const categoryTitles = new Map((categoriesResult.data ?? []).map((category) => [category.category_key, category.portal_title]));
  const imagePaths = new Map((mediaResult.data ?? []).map((service) => [service.id, service.portal_image_path]));
  return services.map((service) => ({
    amount: Number(service.amount),
    category: service.category ? categoryTitles.get(service.category) || null : null,
    categoryKey: service.category,
    code: service.code,
    currency: service.currency,
    description: service.description,
    id: service.id,
    imageUrl: serviceImageUrl(supabase, imagePaths.get(service.id) ?? null),
    name: service.name,
    priceIsFrom: service.price_is_from,
    pricingSegmentName: service.pricing_segment_name,
    pricingSource: service.pricing_source,
    unitType: service.unit_type,
  }));
}
