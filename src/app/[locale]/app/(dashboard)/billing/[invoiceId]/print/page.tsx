import { BillingInvoiceView } from "@/components/billing/BillingInvoiceView";
import { SalesDocumentViewTracker } from "@/components/sales-documents/SalesDocumentViewTracker";
import { getBillingInvoice } from "@/features/billing/server/queries";
import { recordSalesDocumentEvent } from "@/features/sales-documents/server/actions";

export default async function BillingInvoicePrintPage({ params }: {
  params: Promise<{ invoiceId: string; locale: string }>;
}) {
  const { invoiceId, locale } = await params;
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
