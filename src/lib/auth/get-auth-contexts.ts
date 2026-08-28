import "server-only";

import { APP_ROLES, type AppRole } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RawOrganization = {
  id: string;
  name: string;
  platform_service_status: "active" | "suspended";
  status: "active" | "inactive";
};

type RawMembership = {
  id: string;
  organization: RawOrganization | RawOrganization[] | null;
  role: string;
};

export type TenantAuthContext = {
  membershipId: string;
  organization: {
    id: string;
    name: string;
  };
  role: AppRole;
};

export type AuthContexts = {
  hasPortalAccess: boolean;
  isPlatformAdmin: boolean;
  tenantMemberships: TenantAuthContext[];
};

function organizationFrom(value: RawMembership["organization"]) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function isAppRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

export async function getAuthContexts(userId: string): Promise<AuthContexts> {
  const supabase = await createSupabaseServerClient();
  const [platformResult, membershipResult, portalResult] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase
      .from("organization_memberships")
      .select("id, role, organization:organizations!inner(id, name, status, platform_service_status)")
      .eq("profile_id", userId)
      .eq("is_active", true)
      .returns<RawMembership[]>(),
    supabase
      .from("customer_portal_access")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1),
  ]);

  const tenantMemberships = (membershipResult.data ?? []).flatMap((membership) => {
    const organization = organizationFrom(membership.organization);

    if (
      !organization
      || organization.status !== "active"
      || organization.platform_service_status !== "active"
      || !isAppRole(membership.role)
    ) {
      return [];
    }

    return [{
      membershipId: membership.id,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      role: membership.role,
    }];
  });

  return {
    hasPortalAccess: (portalResult.data?.length ?? 0) > 0,
    isPlatformAdmin: !platformResult.error && platformResult.data === true,
    tenantMemberships,
  };
}
