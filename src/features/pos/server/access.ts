import "server-only";

import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requireOperationalCapability } from "@/lib/auth/require-capability";

export async function requirePosAccess(locale: string) {
  await requireEntitlement(locale, FEATURES.pos);
  return requireOperationalCapability(locale, "pos");
}
