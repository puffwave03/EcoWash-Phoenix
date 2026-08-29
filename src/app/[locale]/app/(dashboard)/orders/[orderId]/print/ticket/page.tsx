import { OrderPrintDocument } from "@/components/printing/OrderPrintDocument";
import { getPrintOrderContext } from "@/features/printing/server/queries";

export default async function OrderTicketPrintPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  const context = await getPrintOrderContext(locale, orderId);
  return <OrderPrintDocument context={context} locale={locale} mode="ticket" />;
}
