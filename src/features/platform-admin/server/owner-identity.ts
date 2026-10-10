import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
export type OwnerIdentityCheck = "ready" | "incomplete" | "mismatch";

export async function verifyOwnerIdentity(admin: AdminClient, ownerId: string, email: string): Promise<OwnerIdentityCheck> {
  const { data, error } = await admin.auth.admin.getUserById(ownerId);
  if (error || !data.user) return "incomplete";
  if (data.user.email?.trim().toLowerCase() !== email) return "mismatch";
  const hasEmailIdentity = data.user.identities?.some((identity) =>
    identity.provider === "email" &&
    String(identity.identity_data?.email ?? "").trim().toLowerCase() === email,
  );
  if (!hasEmailIdentity) return "incomplete";
  const profile = await admin.from("profiles").select("id").eq("id", ownerId).maybeSingle();
  if (profile.error || !profile.data) return "incomplete";
  return "ready";
}
