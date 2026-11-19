import { BillingInvoiceView } from "@/components/billing/BillingInvoiceView";
import { SalesDocumentViewTracker } from "@/components/sales-documents/SalesDocumentViewTracker";
import { getBillingInvoice } from "@/features/billing/server/queries";
import { recordSalesDocumentEvent } from "@/features/sales-documents/server/actions";
import { redirect } from "next/navigation";
import { billingSimplifiedUiEnabled } from "@/features/billing/server/simplified-ui-access";
import { getBillingSimplifiedUiOrderForInvoice } from "@/features/billing/server/simplified-ui";

export default async function BillingInvoicePrintPage({ params }: {
  params: Promise<{ invoiceId: string; locale: string }>;
}) {
  const { invoiceId, locale } = await params;
  if (await billingSimplifiedUiEnabled()) {
    const orderId = await getBillingSimplifiedUiOrderForInvoice(locale, invoiceId);
    if (orderId) redirect(`/${locale}/app/billing/simplified?orderId=${orderId}`);
  }
  const detail = await getBillingInvoice(locale, invoiceId);
  const tracksHistory = detail.invoice.documentStatus !== "draft";
  return <>
    {tracksHistory ? <SalesDocumentViewTracker viewedAction={recordSalesDocumentEvent.bind(null, locale, "invoice", invoiceId, "viewed")} /> : null}
    <BillingInvoiceView
      detail={detail}
      locale={locale}
      printRequestedAction={tracksHistory ? recordSalesDocumentEvent.bind(null, locale, "invoice", invoiceId, "print_requested") : undefined}
      printMode
    />
  </>;
}
