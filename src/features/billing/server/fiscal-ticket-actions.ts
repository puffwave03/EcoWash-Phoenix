"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fiscalTicketRecipient } from "@/features/billing/fiscal-ticket";

export async function issueFullPrepaymentTicketAction(locale: string, orderId: string, form: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const recipient = fiscalTicketRecipient(form.get("recipient"));
  const returnTo = `/${locale}/app/billing/full-prepayment?orderId=${encodeURIComponent(orderId)}`;
  if (!recipient || form.get("serviceNotPerformed") !== "on" || form.get("laundryScope") !== "on") {
    redirect(`${returnTo}&result=confirmation`);
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
  if (failed || !result) redirect(`${returnTo}&result=uncertain`);
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/billing`);
  redirect(`/${locale}/app/billing/${result.invoice_id}/ticket`);
}
