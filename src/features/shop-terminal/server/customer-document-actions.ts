"use server";

import { redirect } from "next/navigation";
import { getTerminalCustomerDocument } from "./customer-document";
import { fiscalTicketRecipient } from "@/features/billing/fiscal-ticket";
import { requestFullPrepaymentTicket } from "@/features/billing/server/fiscal-ticket-actions";

export async function issueTerminalCustomerDocument(locale: string, orderId: string, form: FormData) {
  const returnTo = `/${locale}/app/shop/customer-document?orderId=${encodeURIComponent(orderId)}`;
  const document = await getTerminalCustomerDocument(locale, orderId);
  if (document.state === "issued") redirect(`/${locale}/app/billing/${document.invoiceId}/ticket?format=80mm`);
  const recipient = fiscalTicketRecipient(form.get("recipient"));
  if (document.state !== "ready" || !recipient
    || form.get("serviceNotPerformed") !== "on" || form.get("laundryScope") !== "on") {
    redirect(`${returnTo}&result=confirmation`);
  }
  // The payment ID is re-read from persisted, tenant-scoped records; never trust
  // a browser amount/payment/organization or replay the Terminal's intake RPC.
  form.set("paymentId", document.preview.payment.id);
  const result = await requestFullPrepaymentTicket(locale, document.preview.order.id, form);
  if (result.state !== "issued") redirect(`${returnTo}&result=${result.state}`);
  redirect(`/${locale}/app/billing/${result.invoiceId}/ticket?format=80mm`);
}
