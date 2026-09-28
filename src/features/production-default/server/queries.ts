import "server-only";

import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type LocationRow = {
  default_production_assignee_id: string | null;
  id: string;
  name: string;
};

type StaffRow = {
  operational_capabilities: string[];
  profile: { display_name: string } | { display_name: string }[] | null;
  profile_id: string;
};

export async function getProductionDefaultSettings(locale: string) {
  const { membership } = await requireOwnerOrManager(locale);
  const admin = createSupabaseAdminClient();
  const [locationsResult, staffResult] = await Promise.all([
    admin.from("locations")
      .select("id, name, default_production_assignee_id")
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name")
      .limit(100)
      .returns<LocationRow[]>(),
    admin.from("organization_memberships")
      .select("profile_id, operational_capabilities, profile:profiles!organization_memberships_profile_id_fkey(display_name)")
      .eq("organization_id", membership.organization.id)
      .eq("is_active", true)
      .eq("role", "staff")
      .order("profile_id")
      .limit(500)
      .returns<StaffRow[]>(),
  ]);

  if (locationsResult.error || staffResult.error) {
    throw new Error("production_default_settings_unavailable");
  }

  return {
    locations: locationsResult.data ?? [],
    staff: (staffResult.data ?? [])
      .filter((row) => row.operational_capabilities.includes("production"))
      .map((row) => ({
        id: row.profile_id,
        name: (Array.isArray(row.profile) ? row.profile[0] : row.profile)?.display_name ?? row.profile_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
