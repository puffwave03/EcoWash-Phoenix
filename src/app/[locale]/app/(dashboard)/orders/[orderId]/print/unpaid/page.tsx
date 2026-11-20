import { OperationalOrderTicket } from "@/components/billing/BillingSimplifiedTicket";
import { PrintButton } from "@/components/printing/PrintButton";
import { getTranslations } from "next-intl/server";
import { getPrintOrderContext } from "@/features/printing/server/queries";
import { requirePrintAccess } from "@/features/printing/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unpaidTicketData } from "@/features/printing/unpaid-ticket";
import { ticketText } from "@/features/printing/ticket-settings";

// Intentionally no receipt issue, invoice, numbering or financial mutation.
export default async function UnpaidOrderTicketPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  const { membership } = await requirePrintAccess(locale);
  const context = await getPrintOrderContext(locale, orderId);
  const ticket = unpaidTicketData(context);
  if (!ticket) return <p role="alert">{ticketText(locale).blocked}</p>;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizations").select("ticket_footer, ticket_special_message")
    .eq("id", membership.organization.id).single<{ ticket_footer: string | null; ticket_special_message: string | null }>();
  if (error) return <p role="alert">{ticketText(locale).unavailable}</p>;
  const t = await getTranslations({ locale, namespace: "common.salesDocuments" });
  return <>
    <div className="print-preview-toolbar print:hidden"><PrintButton label={t("print")} /></div>
    <OperationalOrderTicket data={ticket.data} locale={locale} timeZone={context.timezone}
      presentation={{ branding: { logoPath: context.branding.brand.logoPath ?? null, logoUrl: context.branding.brand.logoPath ?? null },
        serviceConditions: data.ticket_footer, specialMessage: data.ticket_special_message, scheduleByOrder: { [context.order.id]: ticket.schedule },
        payment: { paidAmount: context.paymentSummary.totalPaid, outstandingAmount: context.paymentSummary.balanceDue } }} />
  </>;
}
