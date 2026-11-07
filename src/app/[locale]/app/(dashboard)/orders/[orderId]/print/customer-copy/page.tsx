import { OrderPrintDocument } from "@/components/printing/OrderPrintDocument";
import { getPrintOrderContext } from "@/features/printing/server/queries";

export default async function OrderCustomerCopyPrintPage({ params, searchParams }: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams?: Promise<{ format?: string | string[] }>;
}) {
  const { locale, orderId } = await params;
  const context = await getPrintOrderContext(locale, orderId);
  const format = (await searchParams)?.format;
  // Navigation-only allowlist; never use a query parameter as a printer profile.
  const customerCopyFormat = format === "a4" || format === "58mm" || format === "80mm" ? format : "a4";
  return <OrderPrintDocument context={context} customerCopyFormat={customerCopyFormat} locale={locale} mode="customer-copy" />;
}
