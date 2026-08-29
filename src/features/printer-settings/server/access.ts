import "server-only";

import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

export async function requirePrinterSettingsAccess(locale: string) {
  const access = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.printing);
  return access;
}
