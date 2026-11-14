"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fiscalTicketRecipient } from "@/features/billing/fiscal-ticket";

export async function requestFullPrepaymentTicket(locale: string, orderId: string, form: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const recipient = fiscalTicketRecipient(form.get("recipient"));
  if (!recipient || form.get("serviceNotPerformed") !== "on" || form.get("laundryScope") !== "on") {
    return { state: "confirmation" as const };
  }
  const supabase = await createSupabaseServerClient();
  let result: { invoice_id: string; invoice_number: string } | null = null;
  let failed = false;
  try {
    const response = await supabase.rpc("issue_billing_full_prepayment_ticket", {
      target_order_id: orderId, target_payment_id: String(form.get("paymentId") ?? ""),
      target_recipient_requirement: recipient, target_service_not_performed: true,
      target_laundry_scope_confirmed: true,
    }).single<{ invoice_id: string; invoice_number: string }>();
    result = response.data;
    failed = Boolean(response.error);
  } catch {
    failed = true;
  }
  // Never retry an uncertain mutation. The GET recovers the canonical document;
  // an explicit later submit uses the same payment attribution, not a new charge.
  if (failed || !result) return { state: "uncertain" as const };
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/billing`);
  return { state: "issued" as const, invoiceId: result.invoice_id };
}

export async function issueFullPrepaymentTicketAction(locale: string, orderId: string, form: FormData) {
  const result = await requestFullPrepaymentTicket(locale, orderId, form);
  const returnTo = `/${locale}/app/billing/full-prepayment?orderId=${encodeURIComponent(orderId)}`;
  if (result.state !== "issued") redirect(`${returnTo}&result=${result.state}`);
  redirect(`/${locale}/app/billing/${result.invoiceId}/ticket`);
}
