import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCustomerPortalAccess } from "@/features/portal/server/queries";
import type {
  OnlinePaymentAttemptSummary,
  OnlinePaymentAvailability,
  OnlinePaymentStatus,
} from "@/features/online-payments/types";

type AvailabilityRow = {
  amount: number;
  currency: string;
  eligible: boolean;
  entitlement_enabled: boolean;
  provider: string | null;
  provider_configured: boolean;
};

type AttemptRow = {
  amount: number;
  currency: string;
  status: OnlinePaymentStatus;
};

export async function getCustomerOnlinePaymentAvailability(
  locale: string,
  orderId: string,
): Promise<OnlinePaymentAvailability> {
  await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("get_customer_portal_online_payment_availability", { target_order_id: orderId })
    .single<AvailabilityRow>();

  if (error || !data) {
    console.error("Online payment availability failed", error?.code);
    return {
      amount: 0,
      currency: "EUR",
      eligible: false,
      entitlementEnabled: false,
      provider: null,
      providerConfigured: false,
    };
  }

  return {
    amount: Number(data.amount),
    currency: data.currency,
    eligible: data.eligible,
    entitlementEnabled: data.entitlement_enabled,
    provider: data.provider,
    providerConfigured: data.provider_configured,
  };
}

export async function getLatestCustomerOnlinePaymentAttempt(
  locale: string,
  orderId: string,
): Promise<OnlinePaymentAttemptSummary | null> {
  const access = await requireCustomerPortalAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("online_payment_attempts")
    .select("amount, currency, status")
    .eq("organization_id", access.organizationId)
    .eq("customer_id", access.customerId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AttemptRow>();

  if (error) {
    console.error("Online payment attempt query failed", error.code);
    return null;
  }

  return data ? {
    amount: Number(data.amount),
    currency: data.currency,
    status: data.status,
  } : null;
}
