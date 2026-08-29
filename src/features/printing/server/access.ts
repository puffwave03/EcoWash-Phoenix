import "server-only";

import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requireOperationalCapability } from "@/lib/auth/require-capability";

export async function requirePrintAccess(locale: string) {
  await requireEntitlement(locale, FEATURES.printing);
  return requireOperationalCapability(locale, "pos");
}
