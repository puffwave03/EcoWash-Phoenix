"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UpdatePasswordActionState = {
  errorKey:
    | "configuration"
    | "expired"
    | "missingFields"
    | "mismatch"
    | "weakPassword"
    | "updateFailed"
    | null;
};

const initialUpdatePasswordState: UpdatePasswordActionState = {
  errorKey: null,
};
const recoveryCookieName = "ecowash-password-recovery";

function safeLocale(value: FormDataEntryValue | null) {
  return routing.locales.includes(value as (typeof routing.locales)[number])
    ? String(value)
    : routing.defaultLocale;
}

function passwordIsStrongEnough(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function updatePasswordAction(
  state: UpdatePasswordActionState = initialUpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordActionState> {
  void state;

  const locale = safeLocale(formData.get("locale"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const cookieStore = await cookies();
  const hasRecoverySession = cookieStore.get(recoveryCookieName)?.value === "1";

  if (!password || !confirmPassword) {
    return { errorKey: "missingFields" };
  }

  if (!hasRecoverySession) {
    return { errorKey: "expired" };
  }

  if (password !== confirmPassword) {
    return { errorKey: "mismatch" };
  }

  if (!passwordIsStrongEnough(password)) {
    return { errorKey: "weakPassword" };
  }

  let supabase;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Password update configuration error", error);

    return { errorKey: "configuration" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errorKey: "expired" };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Password update failed", error.code);

    return { errorKey: "updateFailed" };
  }

  await supabase.auth.signOut();
  cookieStore.delete(recoveryCookieName);

  redirect(`/${locale}/login?status=passwordUpdated`);
}
