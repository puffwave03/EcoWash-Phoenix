export type AuthLanding = "context" | "denied" | "platform" | "portal" | "tenant";

export function resolveAuthLanding(contexts: {
  hasPortalAccess: boolean;
  isPlatformAdmin: boolean;
  tenantMemberships: readonly unknown[];
}): AuthLanding {
  if (contexts.isPlatformAdmin && contexts.tenantMemberships.length > 0) return "context";
  if (contexts.isPlatformAdmin) return "platform";
  if (contexts.tenantMemberships.length > 0) return "tenant";
  if (contexts.hasPortalAccess) return "portal";
  return "denied";
}
