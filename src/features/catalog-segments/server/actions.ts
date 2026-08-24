"use server";

import { revalidatePath } from "next/cache";
import type {
  CatalogSegmentActionState,
  CatalogSegmentStarter,
} from "@/features/catalog-segments/types";
import {
  parseCatalogSegmentForm,
  parseCustomerSegmentAssignment,
} from "@/features/catalog-segments/validation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const initialState: CatalogSegmentActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

const STARTER_CATEGORIES: Record<Exclude<CatalogSegmentStarter, "none">, string[]> = {
  hotel: ["bed_linen", "home_textiles", "professional_services"],
  privateCustomer: ["laundry_by_weight", "ironing", "dry_cleaning", "home_textiles", "rugs_bulky"],
  restaurant: ["professional_services"],
  vacationRental: ["bed_linen", "home_textiles", "laundry_by_weight", "rugs_bulky"],
};

const STARTER_KEYWORDS: Record<Exclude<CatalogSegmentStarter, "none">, RegExp> = {
  hotel: /linen|sheet|saban|lenzuol|drap|toall|towel|asciug|serviett|bathrobe|accappato|albornoz|uniform/i,
  privateCustomer: /laundry|lavand|stir|planch|iron|dry clean|secco|duvet|edred|piumon|rug|alfombr|tappet|curtain|cortin|tend/i,
  restaurant: /tablecloth|mantel|tovagli|napkin|servillet|serviett|kitchen|cocina|cucina|apron|delantal|grembiul|uniform/i,
  vacationRental: /sheet|saban|lenzuol|pillow|almohad|cusc|towel|toall|asciug|bathrobe|accappato|albornoz|duvet|edred|piumon|blanket|manta|curtain|cortin|tend|rug|alfombr|tappet|kg/i,
};

function revalidateSegments(locale: string, customerIds: string[] = []) {
  revalidatePath(`/${locale}/app/settings/catalog/segments`);
  revalidatePath(`/${locale}/portal`);
  revalidatePath(`/${locale}/portal/requests/new`);
  customerIds.forEach((customerId) => revalidatePath(`/${locale}/app/customers/${customerId}`));
}

async function starterSelections(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  starter: Exclude<CatalogSegmentStarter, "none">,
) {
  const [categoriesResult, servicesResult] = await Promise.all([
    supabase
      .from("organization_portal_categories")
      .select("category_key, portal_sort_order")
      .eq("organization_id", organizationId)
      .eq("portal_visible", true)
      .in("category_key", STARTER_CATEGORIES[starter])
      .returns<Array<{ category_key: string; portal_sort_order: number }>>(),
    supabase
      .from("services")
      .select("id, name, portal_sort_order")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("portal_visible", true)
      .eq("customer_orderable", true)
      .limit(500)
      .returns<Array<{ id: string; name: string; portal_sort_order: number }>>(),
  ]);

  return {
    categories: (categoriesResult.data ?? []).map((category) => ({
      category_key: category.category_key,
      display_order: category.portal_sort_order,
    })),
    services: (servicesResult.data ?? [])
      .filter((service) => STARTER_KEYWORDS[starter].test(service.name))
      .map((service) => ({
        display_order: service.portal_sort_order,
        featured: false,
        service_id: service.id,
      })),
  };
}

export async function saveCatalogSegmentAction(
  locale: string,
  _state: CatalogSegmentActionState = initialState,
  formData: FormData,
): Promise<CatalogSegmentActionState> {
  void _state;
  const parsed = parseCatalogSegmentForm(formData);
  if (!parsed.valid) return { ...initialState, fieldErrors: parsed.fieldErrors };

  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  let categories = parsed.input.categories;
  let services = parsed.input.services;

  if (!parsed.input.segmentId && parsed.input.starter !== "none") {
    const suggested = await starterSelections(
      supabase,
      membership.organization.id,
      parsed.input.starter,
    );
    categories = suggested.categories;
    services = suggested.services;
  }

  const { error } = await supabase.rpc("save_catalog_segment", {
    target_categories: categories,
    target_customer_ids: parsed.input.customerIds,
    target_description: parsed.input.description || null,
    target_display_order: parsed.input.displayOrder,
    target_is_active: parsed.input.isActive,
    target_name: parsed.input.name,
    target_organization_id: membership.organization.id,
    target_portal_visible: parsed.input.portalVisible,
    target_segment_id: parsed.input.segmentId,
    target_services: services,
  });

  if (error) {
    console.error("Catalog segment save failed", error.code);
    const formError = error.code === "23505"
      ? "duplicate"
      : ["42883", "42P01", "42703"].includes(error.code)
        ? "migration"
        : "generic";
    return { ...initialState, formError };
  }

  revalidateSegments(locale, parsed.input.customerIds);
  return { ...initialState, success: true };
}

export async function assignCustomerSegmentAction(
  locale: string,
  customerId: string,
  _state: CatalogSegmentActionState = initialState,
  formData: FormData,
): Promise<CatalogSegmentActionState> {
  void _state;
  const parsed = parseCustomerSegmentAssignment(formData);
  if (!parsed.valid) return { ...initialState, fieldErrors: { catalogSegmentId: "invalid" } };

  const { membership, user } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();

  if (parsed.segmentId) {
    const { data: segment, error: segmentError } = await supabase
      .from("catalog_segments")
      .select("id")
      .eq("organization_id", membership.organization.id)
      .eq("id", parsed.segmentId)
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();
    if (segmentError || !segment) return { ...initialState, formError: "generic" };
  }

  const { error } = await supabase
    .from("customers")
    .update({ catalog_segment_id: parsed.segmentId, updated_by: user.id })
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId);

  if (error) {
    console.error("Customer segment assignment failed", error.code);
    return { ...initialState, formError: error.code === "42703" ? "migration" : "generic" };
  }

  revalidateSegments(locale, [customerId]);
  return { ...initialState, success: true };
}
