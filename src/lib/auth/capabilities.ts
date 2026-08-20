import type { AppRole } from "@/lib/auth/types";

export const OPERATIONAL_CAPABILITIES = [
  "pickup",
  "production",
  "quality",
  "delivery",
  "supervision",
] as const;

export type OperationalCapability = (typeof OPERATIONAL_CAPABILITIES)[number];

export const STAFF_OPERATIONAL_CAPABILITIES = OPERATIONAL_CAPABILITIES.filter(
  (capability) => capability !== "supervision",
);

export function isOperationalCapability(value: string): value is OperationalCapability {
  return OPERATIONAL_CAPABILITIES.includes(value as OperationalCapability);
}

export function effectiveOperationalCapabilities(
  role: AppRole,
  capabilities: readonly OperationalCapability[],
): OperationalCapability[] {
  if (role === "owner" || role === "manager") return [...OPERATIONAL_CAPABILITIES];

  return STAFF_OPERATIONAL_CAPABILITIES.filter((capability) => capabilities.includes(capability));
}

export function hasOperationalCapability(
  membership: { capabilities: readonly OperationalCapability[]; role: AppRole },
  capability: OperationalCapability,
) {
  return effectiveOperationalCapabilities(membership.role, membership.capabilities).includes(capability);
}
