"use server";

import { revalidatePath } from "next/cache";
import type { SegmentPriceActionState } from "@/features/pricing-segments/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";

const initialState: SegmentPriceActionState = { fieldErrors: {}, formError: null, success: false };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveSegmentPriceAction(
  locale: string,
  _state: SegmentPriceActionState = initialState,
  formData: FormData,
): Promise<SegmentPriceActionState> {
  void _state;
  const priceId = value(formData, "priceId") || null;
  const segmentId = value(formData, "segmentId");
  const serviceId = value(formData, "serviceId");
  const locationId = value(formData, "locationId") || null;
  const currency = value(formData, "currency").toUpperCase();
  const validFrom = value(formData, "validFrom");
  const validTo = value(formData, "validTo") || null;
  const amountValue = value(formData, "amount");
  const amount = Number(amountValue);
  const fieldErrors: Record<string, string> = {};

  if (priceId && !UUID.test(priceId)) fieldErrors.priceId = "invalid";
  if (!UUID.test(segmentId)) fieldErrors.segmentId = "invalid";
  if (!UUID.test(serviceId)) fieldErrors.serviceId = "invalid";
  if (locationId && !UUID.test(locationId)) fieldErrors.locationId = "invalid";
  if (!amountValue || !Number.isFinite(amount) || amount < 0) fieldErrors.amount = "invalid";
  if (!/^[A-Z]{3}$/.test(currency)) fieldErrors.currency = "invalid";
  if (!DATE.test(validFrom)) fieldErrors.validFrom = "invalid";
  if (validTo && (!DATE.test(validTo) || validTo < validFrom)) fieldErrors.validTo = "invalid";
  if (Object.keys(fieldErrors).length) return { ...initialState, fieldErrors };

  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.segmentPriceOverrides);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_catalog_segment_price", {
    target_amount: amount,
    target_currency: currency,
    target_is_active: formData.get("isActive") === "on",
    target_location_id: locationId,
    target_organization_id: membership.organization.id,
    target_price_id: priceId,
    target_segment_id: segmentId,
    target_service_id: serviceId,
    target_valid_from: validFrom,
    target_valid_to: validTo,
  });

  if (error) {
    console.error("Segment price save failed", error.code);
    const formError = error.code === "23P01"
      ? "overlap"
      : error.code === "23505"
        ? "duplicate"
        : ["42883", "42P01", "42703"].includes(error.code)
          ? "migration"
          : "generic";
    return { ...initialState, formError };
  }

  revalidatePath(`/${locale}/app/settings/catalog/segments`);
  revalidatePath(`/${locale}/app/orders`);
  revalidatePath(`/${locale}/portal/requests/new`);
  return { ...initialState, success: true };
}
