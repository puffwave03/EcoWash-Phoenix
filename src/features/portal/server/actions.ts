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

function isEmailRateLimitError(error: {
  code?: string;
  error_code?: string;
  message?: string;
  status?: number;
  statusCode?: number;
}) {
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

async function existingUserIdByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });

    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 100) return null;

    page += 1;
  }

  return null;
}

async function currentPortalAccess(customerId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customer_portal_access")
    .select("id, email, is_active")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle<{ email: string; id: string; is_active: boolean }>();

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

  let userId: string | null;

  try {
    userId = await existingUserIdByEmail(email);
  } catch (error) {
    console.error("Customer portal user lookup failed", error);
    return fail("invite");
  }

  if (!userId) {
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: email.split("@")[0] },
      redirectTo: portalRedirectUrl(locale),
    });

    if (error || !data.user) {
      console.error("Customer portal invite failed", error?.code ?? error?.status ?? "unknown");
      return fail(error && isEmailRateLimitError(error) ? "rateLimit" : "invite");
    }

    userId = data.user.id;
  } else {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: portalRedirectUrl(locale),
      },
    });

    if (error) {
      console.error("Customer portal access link failed", error.code ?? error.status ?? "unknown");
      return fail(isEmailRateLimitError(error) ? "rateLimit" : "invite");
    }
  }

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

    if (intent === "resend") {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: portalAccess.email,
        options: {
          emailRedirectTo: portalRedirectUrl(locale),
        },
      });

      if (error) {
        console.error("Customer portal access link resend failed", error.code ?? error.status ?? "unknown");
        return fail(isEmailRateLimitError(error) ? "rateLimit" : "invite");
      }

      revalidateCustomer(locale, customerId);
      return { fieldErrors: {}, formError: null, success: true, successKey: "resend" };
    }

    if (intent === "resetPassword") {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.resetPasswordForEmail(portalAccess.email, {
        redirectTo: portalRedirectUrl(locale, `/${locale}/update-password`),
      });

      if (error) {
        console.error("Customer portal password reset failed", error.code ?? error.status ?? "unknown");
        return fail(isEmailRateLimitError(error) ? "rateLimit" : "resetPassword");
      }

      revalidateCustomer(locale, customerId);
      return { fieldErrors: {}, formError: null, success: true, successKey: "resetPassword" };
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
