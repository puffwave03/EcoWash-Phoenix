import "server-only";

import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requirePosAccess } from "@/features/pos/server/access";

export async function requireShopTerminalAccess(locale: string) {
  await requireEntitlement(locale, FEATURES.shopTerminal);
  return requirePosAccess(locale);
}
