import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  APP_ROLES,
  type AppRole,
  type CurrentMembership,
  type MembershipAccessIssue,
} from "@/lib/auth/types";
import {
  effectiveOperationalCapabilities,
  isOperationalCapability,
} from "@/lib/auth/capabilities";

type RawOrganization = {
  id: string;
  name: string;
  status: "active" | "inactive";
  timezone: string;
};

type RawMembership = {
  id: string;
  is_active: boolean;
  operational_capabilities: string[];
  organization: RawOrganization | RawOrganization[] | null;
  role: string;
};

export type CurrentMembershipResult =
  | { issue: MembershipAccessIssue; membership: null }
  | { issue: null; membership: CurrentMembership };

function isAppRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

function normalizeOrganization(
  value: RawMembership["organization"],
): RawOrganization | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function getCurrentMembership(
  profileId: string,
): Promise<CurrentMembershipResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, role, is_active, operational_capabilities, organization:organizations!inner(id, name, status, timezone)")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .returns<RawMembership[]>();

  if (error || !data || data.length === 0) {
    return { issue: "no_membership", membership: null };
  }

  if (data.length > 1) {
    return { issue: "multiple_memberships", membership: null };
  }

  const row = data[0];
  const organization = normalizeOrganization(row.organization);

  if (!isAppRole(row.role)) {
    return { issue: "invalid_role", membership: null };
  }

  if (!organization || organization.status !== "active") {
    return { issue: "inactive_organization", membership: null };
  }

  return {
    issue: null,
    membership: {
      capabilities: effectiveOperationalCapabilities(
        row.role,
        (row.operational_capabilities ?? []).filter(isOperationalCapability),
      ),
      id: row.id,
      organization,
      role: row.role,
    },
  };
}
