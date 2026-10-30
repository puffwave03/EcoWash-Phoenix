import { getTranslations } from "next-intl/server";
import { BillingInvoiceView } from "@/components/billing/BillingInvoiceView";
import { getBillingInvoice } from "@/features/billing/server/queries";

export default async function BillingInvoicePage({ params, searchParams }: {
  params: Promise<{ invoiceId: string; locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ invoiceId, locale }, query] = await Promise.all([params, searchParams]);
  const detail = await getBillingInvoice(locale, invoiceId);
  const invalidDraftMessage = query.error === "invalidDraft"
    ? (await getTranslations({ locale, namespace: "common.billing" }))("errors.invalidDraft")
    : null;
  return <>
    {invalidDraftMessage ? <p role="alert" className="mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{invalidDraftMessage}</p> : null}
    <BillingInvoiceView detail={detail} locale={locale} />
  </>;
}
