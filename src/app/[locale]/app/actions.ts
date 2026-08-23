"use server";

import { redirect, RedirectType } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogoutActionState = {
  failed: boolean;
};

const initialLogoutState: LogoutActionState = {
  failed: false,
};

function safeLocale(value: FormDataEntryValue | null) {
  return routing.locales.includes(value as (typeof routing.locales)[number])
    ? String(value)
    : routing.defaultLocale;
}

export async function logoutAction(
  state: LogoutActionState = initialLogoutState,
  formData: FormData,
): Promise<LogoutActionState> {
  void state;

  const locale = safeLocale(formData.get("locale"));

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { failed: true };
    }
  } catch {
    return { failed: true };
  }

  redirect(`/${locale}/login`, RedirectType.replace);
}
