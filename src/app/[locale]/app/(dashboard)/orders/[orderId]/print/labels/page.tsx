import { PaymentReadErrorNotice } from "@/components/payments/PaymentReadErrorNotice";
import { PaymentReadError } from "@/features/payments/read-error";
import { OrderPrintDocument } from "@/components/printing/OrderPrintDocument";
import { getPrintOrderContext } from "@/features/printing/server/queries";

export default async function OrderLabelsPrintPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  const context = await getPrintOrderContext(locale, orderId).catch((error: unknown) => {
    if (error instanceof PaymentReadError) return null;
    throw error;
  });
  if (!context) return <PaymentReadErrorNotice locale={locale} orderId={orderId} />;
  return <OrderPrintDocument context={context} locale={locale} mode="labels" />;
}
