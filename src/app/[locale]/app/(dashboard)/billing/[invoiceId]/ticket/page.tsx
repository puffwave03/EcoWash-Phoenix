import { getFiscalTicketDocument } from "@/features/billing/server/fiscal-ticket-queries";
import { FiscalTicketDocument } from "@/components/billing/FiscalTicketDocument";
import { requirePrintAccess } from "@/features/printing/server/access";
import { getCustomerCopyPreference } from "@/features/printer-settings/server/document-preference-queries";
import { resolveCustomerCopyFormat } from "@/features/printer-settings/document-preferences";
import { recordSalesDocumentEvent } from "@/features/sales-documents/server/actions";

export default async function FiscalTicketPage({ params, searchParams }: {
  params: Promise<{ invoiceId: string; locale: string }>;
  searchParams?: Promise<{ format?: string | string[] }>;
}) {
  const { locale, invoiceId } = await params;
  await requirePrintAccess(locale);
  const { detail, snapshot, timezone } = await getFiscalTicketDocument(locale, invoiceId);
  const preference = await getCustomerCopyPreference(locale, snapshot.location_id);
  const format = resolveCustomerCopyFormat((await searchParams)?.format, preference?.paperFormat);
  return <FiscalTicketDocument detail={detail} snapshot={snapshot} locale={locale} timezone={timezone}
    format={format} printRequestedAction={recordSalesDocumentEvent.bind(null, locale, "invoice", invoiceId, "print_requested")} />;
}
