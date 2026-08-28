"use server";

import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { resolveAuthLanding } from "@/lib/auth/context-routing";
import { getAuthContexts } from "@/lib/auth/get-auth-contexts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginActionState = {
  errorKey: "invalidCredentials" | "missingFields" | "configuration" | null;
};

const initialLoginState: LoginActionState = {
  errorKey: null,
};

function safeLocale(value: FormDataEntryValue | null) {
  return routing.locales.includes(value as (typeof routing.locales)[number])
    ? String(value)
    : routing.defaultLocale;
}

export async function loginAction(
  state: LoginActionState = initialLoginState,
  formData: FormData,
): Promise<LoginActionState> {
  void state;

  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { errorKey: "missingFields" };
  }

  let supabase;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Supabase login configuration error", error);

    return { errorKey: "configuration" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { errorKey: "invalidCredentials" };
  }

  if (data.user) {
    const contexts = await getAuthContexts(data.user.id);
    const landing = resolveAuthLanding(contexts);

    if (landing === "context") {
      redirect(`/${locale}/auth/context`);
    }

    if (landing === "platform") {
      redirect(`/${locale}/platform`);
    }

    if (landing === "tenant") {
      redirect(`/${locale}/app`);
    }

    if (landing === "portal") {
      redirect(`/${locale}/portal`);
    }
  }

  redirect(`/${locale}/app`);
}
