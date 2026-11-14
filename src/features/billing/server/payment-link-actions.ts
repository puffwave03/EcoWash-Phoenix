"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePosBillingAccess } from "./payment-link";
import { fiscalTicketRecipient } from "@/features/billing/fiscal-ticket";
import { isPaymentLinkId } from "@/features/billing/payment-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function issuePosBillingPaymentDocument(locale: string, orderId: string, form: FormData) {
  await requirePosBillingAccess(locale);
  const returnTo = `/${locale}/app/orders/${encodeURIComponent(orderId)}/print/customer-copy?format=80mm`;
  const paymentId = String(form.get("paymentId") ?? "");
  const event = form.get("event");
  const recipient = fiscalTicketRecipient(form.get("recipient"));
  const performed = String(form.get("servicePerformedOn") ?? "");
  if (!isPaymentLinkId(orderId) || !isPaymentLinkId(paymentId) || !recipient || !["advance", "final"].includes(String(event))
    || form.get("confirmed") !== "on" || form.get("laundryScope") !== "on"
    || (event === "final" && !/^\d{4}-\d{2}-\d{2}$/.test(performed))) redirect(`${returnTo}&result=confirmation`);
  const supabase = await createSupabaseServerClient();
  let confirmed = false;
  try {
    const { data, error } = await supabase.rpc("issue_pos_billing_payment_document", {
      target_order_id: orderId, target_payment_id: paymentId, target_event: event,
      target_recipient: recipient, target_confirmed: true, target_laundry_scope: true,
      target_service_performed_on: event === "final" ? performed : null,
    });
    confirmed = !error && Array.isArray(data) && data.length === 1 && typeof data[0]?.invoice_id === "string";
  } catch {
    // Do not resubmit intake or charge money to recover an uncertain issue.
  }
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  redirect(`${returnTo}&result=${confirmed ? "issued" : "uncertain"}`);
}
