"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FEATURES, type FeatureKey } from "@/features/entitlements/feature-catalog";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DISRUPTIVE_FEATURES = new Set<FeatureKey>([
  FEATURES.billingInvoicing,
  FEATURES.segmentPriceOverrides,
  FEATURES.fullWhiteLabel,
]);

function text(formData: FormData, name: string, max = 160) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function optionalTimestamp(formData: FormData, name: string) {
  const value = text(formData, name, 40);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "invalid" : parsed.toISOString();
}

function finish(locale: string, organizationId: string, result: "saved" | "error") {
  redirect(`/${locale}/platform/organizations/${organizationId}?result=${result}`);
}

export async function savePlatformEntitlementAction(
  locale: string,
  organizationId: string,
  formData: FormData,
) {
  await requirePlatformAdmin(locale);
  const featureKey = text(formData, "featureKey", 100) as FeatureKey;
  const enabled = text(formData, "enabled", 10) === "true";
  if (!Object.values(FEATURES).includes(featureKey)) finish(locale, organizationId, "error");
  if (!enabled && DISRUPTIVE_FEATURES.has(featureKey)
    && formData.get("confirmImpact") !== "confirmed") {
    finish(locale, organizationId, "error");
  }
  const limitText = text(formData, "limitValue", 20);
  const limitValue = limitText ? Number(limitText) : null;
  const validFrom = optionalTimestamp(formData, "validFrom");
  const validUntil = optionalTimestamp(formData, "validUntil");
  if ((limitValue !== null && (!Number.isSafeInteger(limitValue) || limitValue < 0))
    || validFrom === "invalid" || validUntil === "invalid") {
    finish(locale, organizationId, "error");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("platform_set_organization_entitlement", {
    target_enabled: enabled,
    target_feature_key: featureKey,
    target_limit_value: limitValue,
    target_organization_id: organizationId,
    target_source: text(formData, "source", 64) || "platform_admin",
    target_valid_from: validFrom,
    target_valid_until: validUntil,
  });
  if (error) finish(locale, organizationId, "error");
  revalidatePath(`/${locale}/platform`);
  revalidatePath(`/${locale}/platform/organizations`);
  revalidatePath(`/${locale}/platform/organizations/${organizationId}`);
  finish(locale, organizationId, "saved");
}

export async function savePlatformCommercialLabelAction(
  locale: string,
  organizationId: string,
  formData: FormData,
) {
  await requirePlatformAdmin(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("platform_set_organization_commercial_label", {
    target_commercial_plan_label: text(formData, "commercialPlanLabel", 80) || null,
    target_organization_id: organizationId,
  });
  if (error) finish(locale, organizationId, "error");
  revalidatePath(`/${locale}/platform/organizations/${organizationId}`);
  finish(locale, organizationId, "saved");
}

export async function savePlatformServiceStatusAction(
  locale: string,
  organizationId: string,
  formData: FormData,
) {
  await requirePlatformAdmin(locale);
  const status = text(formData, "status", 20);
  if (!(["active", "suspended"] as const).includes(status as "active" | "suspended")) {
    finish(locale, organizationId, "error");
  }
  if (status === "suspended" && formData.get("confirmSuspension") !== "confirmed") {
    finish(locale, organizationId, "error");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("platform_set_organization_service_status", {
    target_organization_id: organizationId,
    target_status: status,
  });
  if (error) finish(locale, organizationId, "error");
  revalidatePath(`/${locale}/platform`);
  revalidatePath(`/${locale}/platform/organizations`);
  revalidatePath(`/${locale}/platform/organizations/${organizationId}`);
  finish(locale, organizationId, "saved");
}
