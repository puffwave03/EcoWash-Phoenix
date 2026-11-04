import { getTranslations } from "next-intl/server";
import { BillingInvoiceView } from "@/components/billing/BillingInvoiceView";
import { getBillingInvoice } from "@/features/billing/server/queries";

// Only these public feedback codes may select a translation; never use a raw URL key.
const billingErrorKeys = [
  "settingsInvalid", "generic", "issuer", "customer", "duplicate", "unauthorized",
  "orders", "documentType", "simplifiedUnavailable", "simplifiedSeriesInvalid",
  "simplifiedSeriesUsed", "simplifiedSeriesSettings", "invalidDraft",
  "fullPrepaymentBlocked", "advanceBlocked", "serviceDate", "serviceDeclaration",
  "issueUncertain",
] as const;

export default async function BillingInvoicePage({ params, searchParams }: {
  params: Promise<{ invoiceId: string; locale: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [{ invoiceId, locale }, query] = await Promise.all([params, searchParams]);
  const detail = await getBillingInvoice(locale, invoiceId);
  const errorKey = billingErrorKeys.find(key => key === query.error) ?? "generic";
  const errorMessage = query.error
    ? (await getTranslations({ locale, namespace: "common.billing" }))(`errors.${errorKey}`)
    : null;
  return <>
    {errorMessage ? <p role="alert" className="mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</p> : null}
    <BillingInvoiceView detail={detail} locale={locale} />
  </>;
}
