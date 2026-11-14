import "server-only";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { requirePrintAccess } from "@/features/printing/server/access";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPaymentLinkId, parsePosBillingDocuments, type PosBillingDocuments } from "@/features/billing/payment-link";

export async function requirePosBillingAccess(locale: string) {
  await requireShopTerminalAccess(locale);
  await requirePrintAccess(locale);
  return requireEntitlement(locale, FEATURES.billingInvoicing);
}
export async function getPosBillingPaymentDocuments(locale: string, orderId: string): Promise<PosBillingDocuments> {
  await requirePosBillingAccess(locale);
  if (!isPaymentLinkId(orderId)) return { state: "unavailable" };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_pos_billing_payment_documents", { target_order_id: orderId });
    return error ? { state: "unavailable" } : parsePosBillingDocuments(data);
  } catch {
    return { state: "unavailable" };
  }
}
