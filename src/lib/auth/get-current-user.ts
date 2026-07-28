import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    email: user.email ?? null,
    id: user.id,
  };
}
