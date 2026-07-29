"use server";

import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeLocale(value: FormDataEntryValue | null) {
  return routing.locales.includes(value as (typeof routing.locales)[number])
    ? String(value)
    : routing.defaultLocale;
}

function resetRedirectUrl(locale: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for password reset redirects.");
  }

  return new URL(`/${locale}/update-password`, siteUrl).toString();
}

type PasswordResetError = {
  code?: string;
  error_code?: string;
  message?: string;
  name?: string;
  status?: number;
  statusCode?: number;
};

function isEmailRateLimitError(error: PasswordResetError) {
  const code = error.code ?? error.error_code ?? "";
  const message = error.message?.toLowerCase() ?? "";
  const status = error.status ?? error.statusCode;

  return (
    code === "over_email_send_rate_limit"
    || status === 429
    || (message.includes("email") && message.includes("rate limit"))
    || message.includes("email rate limit exceeded")
    || message.includes("rate limit exceeded")
    || message.includes("too many")
  );
}

function passwordResetErrorMeta(error: PasswordResetError) {
  return {
    code: error.code ?? error.error_code,
    name: error.name,
    status: error.status ?? error.statusCode,
  };
}

export async function requestPasswordResetAction(formData: FormData) {
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(`/${locale}/forgot-password?status=missingEmail`);
  }

  let redirectTo: string;
  let supabase;

  try {
    redirectTo = resetRedirectUrl(locale);
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Password reset configuration error", error);
    redirect(`/${locale}/forgot-password?status=configuration`);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    const errorMeta = passwordResetErrorMeta(error);

    console.error("Password reset request failed", errorMeta);

    if (isEmailRateLimitError(error)) {
      redirect(`/${locale}/forgot-password?status=rateLimited`);
    }

    redirect(`/${locale}/forgot-password?status=temporaryError`);
  }

  redirect(`/${locale}/forgot-password?status=sent`);
}
