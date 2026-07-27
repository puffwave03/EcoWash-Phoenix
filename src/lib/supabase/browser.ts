"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const { anonKey, url } = getSupabaseConfig();

  return createBrowserClient(url, anonKey);
}
