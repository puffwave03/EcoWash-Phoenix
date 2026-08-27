import "server-only";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { requireAuth } from "@/lib/auth/require-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requirePlatformAdmin(locale: string) {
  const user = await requireAuth(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_platform_admin");

  if (error || data !== true) {
    redirect(`/${locale}/app/access-denied`);
  }

  const profile = await getCurrentProfile(user.id);

  return { profile, user };
}
