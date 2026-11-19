import { BillingInvoiceView } from "@/components/billing/BillingInvoiceView";
import { getBillingInvoice } from "@/features/billing/server/queries";
import { redirect } from "next/navigation";
import { billingSimplifiedUiEnabled } from "@/features/billing/server/simplified-ui-access";
import { getBillingSimplifiedUiOrderForInvoice } from "@/features/billing/server/simplified-ui";

export default async function BillingInvoicePage({ params }: {
  params: Promise<{ invoiceId: string; locale: string }>;
}) {
  const { invoiceId, locale } = await params;
  if (await billingSimplifiedUiEnabled()) {
    const orderId = await getBillingSimplifiedUiOrderForInvoice(locale, invoiceId);
    if (orderId) redirect(`/${locale}/app/billing/simplified?orderId=${orderId}`);
  }
  const detail = await getBillingInvoice(locale, invoiceId);
  return <BillingInvoiceView detail={detail} locale={locale} />;
}
