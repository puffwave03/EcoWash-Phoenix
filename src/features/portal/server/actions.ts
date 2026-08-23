"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";
import { requireMembership } from "@/lib/auth/require-membership";
import type { CustomerPortalActionState } from "@/features/portal/types";

const initialState: CustomerPortalActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
  successKey: null,
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthFailure = {
  code?: string;
  error_code?: string;
  message?: string;
  name?: string;
  status?: number;
  statusCode?: number;
};

function fail(
  formError: string | null = "generic",
  fieldErrors: Record<string, string> = {},
): CustomerPortalActionState {
  return { fieldErrors, formError, success: false, successKey: null };
}

function canManageCustomerPortal(role: string) {
  return role === "owner" || role === "manager";
}

function revalidateCustomer(locale: string, customerId: string) {
  revalidatePath(`/${locale}/app/customers/${customerId}`);
}

function revalidateOrder(locale: string, orderId: string) {
  revalidatePath(`/${locale}/app/orders/${orderId}`);
}

function portalRedirectUrl(locale: string, nextPath = `/${locale}/portal`) {
  const redirectUrl = new URL(`/${locale}/auth/callback`, siteConfig.url);
  redirectUrl.searchParams.set("next", nextPath);

  return redirectUrl.toString();
}

function isEmailRateLimitError(error: unknown) {
  const failure = authFailure(error);
  const code = failure.code ?? failure.error_code ?? "";
  const message = failure.message?.toLowerCase() ?? "";
  const status = failure.status ?? failure.statusCode;

  return (
    code === "over_email_send_rate_limit"
    || status === 429
    || (message.includes("email") && message.includes("rate limit"))
    || message.includes("email rate limit exceeded")
    || message.includes("rate limit exceeded")
    || message.includes("too many")
  );
}

function authFailure(error: unknown): AuthFailure {
  if (!error || typeof error !== "object") return {};

  return error as AuthFailure;
}

function isExistingAuthUser(error: unknown) {
  const { code, message, status } = authFailure(error);
  const normalizedMessage = message?.toLowerCase() ?? "";

  return code === "email_exists"
    || code === "user_already_exists"
    || (status === 422 && normalizedMessage.includes("already"));
}

function isAuthUnavailable(error: unknown) {
  const { name, status } = authFailure(error);

  return name === "AuthRetryableFetchError"
    || status === 0
    || (typeof status === "number" && status >= 500);
}

function isEmailDeliveryFailure(error: unknown) {
  const { code, error_code: errorCode, status, statusCode } = authFailure(error);

  return (code === "unexpected_failure" || errorCode === "unexpected_failure")
    && (status ?? statusCode) === 500;
}

function emailActionError(error: unknown, fallback: string) {
  if (isEmailRateLimitError(error)) return "rateLimit";
  if (isEmailDeliveryFailure(error)) return "emailDelivery";
  if (isAuthUnavailable(error)) return "authUnavailable";

  return fallback;
}

function logAuthFailure(context: string, error: unknown) {
  const { code, error_code: errorCode, name, status, statusCode } = authFailure(error);

  console.error(context, {
    code: code ?? errorCode ?? "unknown",
    name: name ?? "unknown",
    status: status ?? statusCode ?? "unknown",
  });
}

async function currentPortalAccess(customerId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_portal_access")
    .select("id, email, is_active, user_id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle<{ email: string; id: string; is_active: boolean; user_id: string }>();

  if (error) throw error;

  return data;
}

export async function inviteCustomerPortalAction(
  locale: string,
  customerId: string,
  _state: CustomerPortalActionState = initialState,
  formData: FormData,
): Promise<CustomerPortalActionState> {
  void _state;

  const access = await requireMembership(locale);
  if (!canManageCustomerPortal(access.membership.role)) return fail("unauthorized");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return fail(null, { email: "invalid" });
  if (!hasSupabaseAdminConfig()) return fail("configuration");

  const admin = createSupabaseAdminClient();
  let userId: string | null = null;
  let accessEmailPending = false;

  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: email.split("@")[0] },
      redirectTo: portalRedirectUrl(locale),
    });

    if (!error && data.user) {
      userId = data.user.id;
    } else if (isExistingAuthUser(error)) {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        email,
        options: { redirectTo: portalRedirectUrl(locale) },
        type: "magiclink",
      });

      if (linkError || !linkData.user) {
        logAuthFailure("Existing customer Portal Auth lookup failed", linkError);
        return fail(isAuthUnavailable(linkError) ? "authUnavailable" : "invite");
      }

      userId = linkData.user.id;
      accessEmailPending = true;
    } else {
      logAuthFailure("Customer portal invite failed", error);
      return fail(emailActionError(error, "invite"));
    }
  } catch (error) {
    logAuthFailure("Customer portal Auth request failed", error);
    return fail(emailActionError(error, "invite"));
  }

  if (!userId) return fail("invite");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("upsert_customer_portal_access", {
    target_customer_id: customerId,
    target_email: email,
    target_user_id: userId,
  });

  if (error) {
    console.error("Customer portal access upsert failed", error.code);
    return fail("access");
  }

  if (accessEmailPending) {
    try {
      const { error: accessEmailError } = await admin.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: portalRedirectUrl(locale),
          shouldCreateUser: false,
        },
      });

      if (accessEmailError) {
        logAuthFailure("Existing customer Portal access email failed", accessEmailError);
        return fail(emailActionError(accessEmailError, "invite"));
      }
    } catch (accessEmailError) {
      logAuthFailure("Existing customer Portal access email request failed", accessEmailError);
      return fail(emailActionError(accessEmailError, "invite"));
    }
  }

  revalidateCustomer(locale, customerId);
  return { fieldErrors: {}, formError: null, success: true, successKey: "invite" };
}

export async function manageCustomerPortalAccessAction(
  locale: string,
  customerId: string,
  _state: CustomerPortalActionState = initialState,
  formData: FormData,
): Promise<CustomerPortalActionState> {
  void _state;

  const access = await requireMembership(locale);
  if (!canManageCustomerPortal(access.membership.role)) return fail("unauthorized");

  const intent = String(formData.get("intent") ?? "");

  try {
    const portalAccess = await currentPortalAccess(customerId, access.membership.organization.id);

    if (!portalAccess) return fail("access");

    if (intent === "disable" || intent === "enable") {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.rpc("update_customer_portal_access", {
        target_access_id: portalAccess.id,
        target_is_active: intent === "enable",
      });

      if (error) {
        console.error("Customer portal access status update failed", error.code);
        return fail("access");
      }

      revalidateCustomer(locale, customerId);
      return {
        fieldErrors: {},
        formError: null,
        success: true,
        successKey: intent,
      };
    }

    if (!portalAccess.is_active) return fail("accessDisabled");

    if (intent === "resend" || intent === "resetPassword") {
      const admin = createSupabaseAdminClient();
      const operation = intent === "resend" ? "signInWithOtp" : "resetPasswordForEmail";
      const { data: authUser, error: userError } = await admin.auth.admin.getUserById(
        portalAccess.user_id,
      );

      if (userError || !authUser.user?.email) {
        logAuthFailure("Customer Portal Auth user lookup failed", userError);
        return fail(isAuthUnavailable(userError) ? "authUnavailable" : "invite");
      }

      if (authUser.user.email.toLowerCase() !== portalAccess.email.toLowerCase()) {
        console.error("Customer Portal Auth email mismatch");
        return fail("invite");
      }

      let emailError;

      try {
        ({ error: emailError } = intent === "resend"
          ? await admin.auth.signInWithOtp({
              email: authUser.user.email,
              options: {
                emailRedirectTo: portalRedirectUrl(locale),
                shouldCreateUser: false,
              },
            })
          : await admin.auth.resetPasswordForEmail(authUser.user.email, {
              redirectTo: portalRedirectUrl(locale, `/${locale}/update-password`),
            }));
      } catch (error) {
        logAuthFailure(`Customer Portal ${operation} request failed`, error);
        return fail(emailActionError(
          error,
          intent === "resend" ? "invite" : "resetPassword",
        ));
      }

      if (emailError) {
        logAuthFailure(`Customer Portal ${operation} failed`, emailError);
        return fail(emailActionError(
          emailError,
          intent === "resend" ? "invite" : "resetPassword",
        ));
      }

      revalidateCustomer(locale, customerId);
      return {
        fieldErrors: {},
        formError: null,
        success: true,
        successKey: intent,
      };
    }
  } catch (error) {
    console.error("Customer portal access management failed", error);
    return fail("error");
  }

  return fail("error");
}

export async function setOrderPhotoCustomerVisibilityAction(
  locale: string,
  orderId: string,
  photoId: string,
  formData: FormData,
) {
  const access = await requireMembership(locale);
  if (!canManageCustomerPortal(access.membership.role)) return;

  const customerVisible = String(formData.get("customerVisible") ?? "") === "true";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_order_photo_customer_visibility", {
    target_customer_visible: customerVisible,
    target_photo_id: photoId,
  });

  if (error) console.error("Order photo customer visibility failed", error.code);
  revalidateOrder(locale, orderId);
}
