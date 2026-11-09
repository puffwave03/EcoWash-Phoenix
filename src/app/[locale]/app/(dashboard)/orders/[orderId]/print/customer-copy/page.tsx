import { PaymentReadErrorNotice } from "@/components/payments/PaymentReadErrorNotice";
import { PaymentReadError } from "@/features/payments/read-error";
import { OrderPrintDocument } from "@/components/printing/OrderPrintDocument";
import { getPrintOrderContext } from "@/features/printing/server/queries";
import { resolveCustomerCopyFormat } from "@/features/printer-settings/document-preferences";
import { getCustomerCopyPreference } from "@/features/printer-settings/server/document-preference-queries";

export default async function OrderCustomerCopyPrintPage({ params, searchParams }: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams?: Promise<{ format?: string | string[] }>;
}) {
  const { locale, orderId } = await params;
  const context = await getPrintOrderContext(locale, orderId).catch((error: unknown) => {
    if (error instanceof PaymentReadError) return null;
    throw error;
  });
  if (!context) return <PaymentReadErrorNotice locale={locale} orderId={orderId} />;
  const preference = await getCustomerCopyPreference(locale, context.order.locationId);
  const format = (await searchParams)?.format;
  // Manual navigation never writes settings or selects a physical printer.
  const customerCopyFormat = resolveCustomerCopyFormat(format, preference?.paperFormat);
  return <OrderPrintDocument context={context} customerCopyFormat={customerCopyFormat} locale={locale} mode="customer-copy" />;
}
