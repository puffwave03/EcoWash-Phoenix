import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/types";

type ProfileRow = {
  display_name: string;
  id: string;
  locale: string | null;
};

export async function getCurrentProfile(
  userId: string,
): Promise<CurrentProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, locale")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error?.message.includes("organization_suspended")) {
    throw new Error("organization_suspended");
  }

  if (error || !data) {
    return null;
  }

  return {
    displayName: data.display_name,
    id: data.id,
    locale: data.locale,
  };
}
