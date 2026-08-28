"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getOnlinePaymentProvider } from "@/features/online-payments/providers";
import type { OnlinePaymentCheckout } from "@/features/online-payments/types";
import { requireCustomerPortalAccess } from "@/features/portal/server/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function orderUrl(locale: string, orderId: string, result: "cancelled" | "failed" | "returned") {
  const url = new URL(`/${locale}/portal/orders/${orderId}`, siteConfig.url);
  url.searchParams.set("payment", result);
  return url.toString();
}

function safeIdempotencyKey(value: FormDataEntryValue | null) {
  const key = String(value ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)
    ? key
    : randomUUID();
}

export async function createOnlineCheckoutAction(
  locale: string,
  orderId: string,
  formData: FormData,
) {
  const access = await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("create_customer_online_payment_attempt", {
      target_idempotency_key: safeIdempotencyKey(formData.get("idempotencyKey")),
      target_order_id: orderId,
    })
    .single<{
      amount: number;
      attempt_id: string;
      currency: string;
      provider: string;
      provider_session_id: string | null;
    }>();

  if (error || !data) {
    console.error("Online checkout authorization failed", error?.code);
    redirect(orderUrl(locale, orderId, "failed"));
  }

  const checkout: OnlinePaymentCheckout = {
    amount: Number(data.amount),
    attemptId: data.attempt_id,
    currency: data.currency,
    provider: data.provider,
    providerSessionId: data.provider_session_id,
  };
  const provider = getOnlinePaymentProvider(checkout.provider);
  const admin = createSupabaseAdminClient();

  if (!provider.configured) {
    console.error("Online checkout provider unavailable", checkout.provider);
    redirect(orderUrl(locale, orderId, "failed"));
  }

  let hosted;
  try {
    hosted = await provider.createCheckout({
      amount: checkout.amount,
      attemptId: checkout.attemptId,
      cancelUrl: orderUrl(locale, orderId, "cancelled"),
      currency: checkout.currency,
      customerReference: access.customerId,
      orderReference: orderId,
      successUrl: orderUrl(locale, orderId, "returned"),
    });
  } catch (providerError) {
    console.error("Online checkout creation failed", providerError instanceof Error ? providerError.message : "unknown");
    await admin.rpc("mark_online_payment_attempt_creation_failed", {
      target_attempt_id: checkout.attemptId,
      target_failure_code: "checkout_creation_failed",
    });
    redirect(orderUrl(locale, orderId, "failed"));
  }

  const { error: attachError } = await admin.rpc("attach_online_payment_provider_session", {
    target_attempt_id: checkout.attemptId,
    target_expires_at: hosted.expiresAt,
    target_provider: checkout.provider,
    target_provider_session_id: hosted.id,
  });

  if (attachError) {
    console.error("Online checkout session attach failed", attachError.code);
    await admin.rpc("mark_online_payment_attempt_creation_failed", {
      target_attempt_id: checkout.attemptId,
      target_failure_code: "checkout_session_attach_failed",
    });
    redirect(orderUrl(locale, orderId, "failed"));
  }

  redirect(hosted.url);
}
