import "server-only";

import { redirect } from "next/navigation";
import type { EntitlementAccess, FeatureKey } from "@/features/entitlements/feature-catalog";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EntitlementRow = {
  enabled: boolean;
  feature_key: FeatureKey;
  limit_value: number | null;
};

export async function getCurrentEntitlements(
  locale: string,
  features: readonly FeatureKey[],
): Promise<EntitlementAccess> {
  await requireMembership(locale);
  if (features.length === 0) return {};

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("list_current_organization_entitlements", { target_feature_keys: [...new Set(features)] })
    .returns<EntitlementRow[]>();

  if (error) {
    console.error("Entitlement resolution failed", error.code);
    return {};
  }

  return ((data ?? []) as EntitlementRow[]).reduce<EntitlementAccess>((access, row) => {
    access[row.feature_key] = {
      enabled: row.enabled,
      limit: row.limit_value === null ? null : Number(row.limit_value),
    };
    return access;
  }, {});
}

export async function hasEntitlement(locale: string, feature: FeatureKey) {
  const access = await getCurrentEntitlements(locale, [feature]);
  return access[feature]?.enabled === true;
}

export async function requireEntitlement(locale: string, feature: FeatureKey) {
  if (!await hasEntitlement(locale, feature)) {
    redirect(`/${locale}/app/feature-unavailable`);
  }
}
