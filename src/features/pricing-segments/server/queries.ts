import "server-only";

import { getCatalogSegmentAdminSettings } from "@/features/catalog-segments/server/queries";
import type { SegmentPrice, SegmentPricingSettings } from "@/features/pricing-segments/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PriceRow = {
  amount: number;
  currency: string;
  id: string;
  is_active: boolean;
  location_id: string | null;
  segment_id: string;
  service_id: string;
  valid_from: string;
  valid_to: string | null;
};

export async function getSegmentPricingSettings(locale: string): Promise<SegmentPricingSettings> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const [catalog, pricesResult, locationsResult, organizationResult] = await Promise.all([
    getCatalogSegmentAdminSettings(locale),
    supabase
      .from("catalog_segment_prices")
      .select("id, segment_id, service_id, location_id, amount, currency, valid_from, valid_to, is_active")
      .eq("organization_id", membership.organization.id)
      .order("valid_from", { ascending: false })
      .returns<PriceRow[]>(),
    supabase
      .from("locations")
      .select("id, name")
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string }>>(),
    supabase
      .from("organizations")
      .select("default_currency")
      .eq("id", membership.organization.id)
      .single<{ default_currency: string }>(),
  ]);

  const dateParts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: membership.organization.timezone,
    year: "numeric",
  }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value;
  const currentDate = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;

  if (!catalog.available || pricesResult.error || locationsResult.error || organizationResult.error) {
    console.error("Segment pricing administration query unavailable", pricesResult.error?.code ?? locationsResult.error?.code ?? organizationResult.error?.code ?? "catalog");
    return { ...catalog, available: false, currency: "EUR", locations: [], prices: [], today: currentDate };
  }

  const prices: SegmentPrice[] = (pricesResult.data ?? []).map((price) => ({
    amount: Number(price.amount),
    currency: price.currency,
    id: price.id,
    isActive: price.is_active,
    locationId: price.location_id,
    segmentId: price.segment_id,
    serviceId: price.service_id,
    validFrom: price.valid_from,
    validTo: price.valid_to,
  }));

  return {
    ...catalog,
    currency: organizationResult.data.default_currency,
    locations: locationsResult.data ?? [],
    prices,
    today: currentDate,
  };
}
