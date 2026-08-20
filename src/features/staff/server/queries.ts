import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/require-role";
import {
  effectiveOperationalCapabilities,
  isOperationalCapability,
} from "@/lib/auth/capabilities";
import type { AppRole } from "@/lib/auth/types";
import type { StaffMember } from "@/features/staff/types";

type MembershipRow = {
  created_at: string;
  id: string;
  invited_by_profile: { display_name: string } | { display_name: string }[] | null;
  is_active: boolean;
  operational_capabilities: string[];
  profile: { display_name: string } | { display_name: string }[] | null;
  profile_id: string;
  role: AppRole;
};

function relationName(value: { display_name?: string } | { display_name?: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;

  return row?.display_name ?? null;
}

type StaffAuthDetails = {
  email: string;
  isInvitePending: boolean;
};

async function authDetailsByProfileId(profileIds: string[]) {
  if (!hasSupabaseAdminConfig()) return new Map<string, StaffAuthDetails>();

  const admin = createSupabaseAdminClient();
  const entries = await Promise.all(
    profileIds.map(async (profileId) => {
      const { data, error } = await admin.auth.admin.getUserById(profileId);

      if (error || !data.user?.email) return null;

      return [profileId, {
        email: data.user.email,
        isInvitePending: !data.user.email_confirmed_at,
      }] as const;
    }),
  );

  return new Map(
    entries.filter(
      (entry): entry is readonly [string, StaffAuthDetails] => Boolean(entry),
    ),
  );
}

export async function getStaffAccess(locale: string) {
  return requireOwner(locale);
}

export async function listStaffMembers(locale: string): Promise<StaffMember[]> {
  const access = await getStaffAccess(locale);
  const supabase = hasSupabaseAdminConfig()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, profile_id, role, is_active, operational_capabilities, created_at, profile:profiles!organization_memberships_profile_id_fkey(display_name), invited_by_profile:profiles!organization_memberships_invited_by_fkey(display_name)")
    .eq("organization_id", access.membership.organization.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<MembershipRow[]>();

  if (error || !data) {
    console.error("Staff list query failed", error?.code);
    return [];
  }

  const authDetails = await authDetailsByProfileId(data.map((row) => row.profile_id));

  return data.map((row) => {
    const details = authDetails.get(row.profile_id);

    return {
      capabilities: effectiveOperationalCapabilities(
        row.role,
        (row.operational_capabilities ?? []).filter(isOperationalCapability),
      ),
      createdAt: row.created_at,
      email: details?.email ?? null,
      id: row.id,
      invitedByName: relationName(row.invited_by_profile),
      isActive: row.is_active,
      isCurrentUser: row.profile_id === access.profile.id,
      isInvitePending: details?.isInvitePending ?? false,
      name: relationName(row.profile) ?? details?.email ?? "",
      profileId: row.profile_id,
      role: row.role,
    };
  });
}
