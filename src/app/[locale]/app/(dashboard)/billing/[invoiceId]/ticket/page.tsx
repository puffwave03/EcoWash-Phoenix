import { getTenantBranding } from "@/features/branding/server/queries";
import { getOrderById } from "@/features/orders/server/queries";
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
  const access = await requirePrintAccess(locale);
  const { detail, snapshot, timezone } = await getFiscalTicketDocument(locale, invoiceId);
  const preference = await getCustomerCopyPreference(locale, snapshot.location_id);
  const format = resolveCustomerCopyFormat((await searchParams)?.format, preference?.paperFormat);
  const enriched = Object.hasOwn(snapshot, "customer_notes");
  const [branding, order] = enriched ? await Promise.all([
    getTenantBranding(access.membership.organization.id),
    detail.invoice.orderIds[0] ? getOrderById(locale, detail.invoice.orderIds[0]) : Promise.resolve(null),
  ]) : [null, null];
  const header = branding ? { branding, organizationName: access.membership.organization.name, locationName: null } : undefined;
  return <FiscalTicketDocument header={header} orderCreatedAt={order?.createdAt} detail={detail} snapshot={snapshot} locale={locale} timezone={timezone}
    format={format} printRequestedAction={recordSalesDocumentEvent.bind(null, locale, "invoice", invoiceId, "print_requested")} />;
}
