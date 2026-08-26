import { BillingInvoiceView } from "@/components/billing/BillingInvoiceView";
import { getBillingInvoice } from "@/features/billing/server/queries";

export default async function BillingInvoicePrintPage({ params }: {
  params: Promise<{ invoiceId: string; locale: string }>;
}) {
  const { invoiceId, locale } = await params;
  const detail = await getBillingInvoice(locale, invoiceId);
  return <BillingInvoiceView detail={detail} locale={locale} printMode />;
}
