import { getTranslations } from "next-intl/server";
import { BillingSimplifiedTicket, OperationalOrderTicket } from "@/components/billing/BillingSimplifiedTicket";
import { PrintButton } from "@/components/printing/PrintButton";
import { recBlockedMessage } from "@/features/printing/rec-copy";
import { getOrderRecDocument } from "@/features/printing/server/rec-document";

export default async function OrderRecPrintPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  const document = await getOrderRecDocument(locale, orderId);
  if (document.status === "blocked") return <p role="alert">{recBlockedMessage(locale, document.state)}</p>;
  const t = await getTranslations({ locale, namespace: "common.salesDocuments" });
  return <>
    <div className="print-preview-toolbar print:hidden"><PrintButton label={t("print")} /></div>
    {document.status === "unpaid"
      ? <OperationalOrderTicket data={document.data} locale={locale} timeZone={document.timeZone} presentation={document.presentation} />
      : <BillingSimplifiedTicket {...document.ticket} />}
  </>;
}
