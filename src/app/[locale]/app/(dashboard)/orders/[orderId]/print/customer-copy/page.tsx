import { PosBillingCustomerCopy } from "@/components/billing/PosBillingCustomerCopy";
import { getPosBillingPaymentDocuments } from "@/features/billing/server/payment-link";
import { hasEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { PaymentReadErrorNotice } from "@/components/payments/PaymentReadErrorNotice";
import { PaymentReadError } from "@/features/payments/read-error";
import { OrderPrintDocument } from "@/components/printing/OrderPrintDocument";
import { getPrintOrderContext } from "@/features/printing/server/queries";
import { resolveCustomerCopyFormat } from "@/features/printer-settings/document-preferences";
import { getCustomerCopyPreference } from "@/features/printer-settings/server/document-preference-queries";

export default async function OrderCustomerCopyPrintPage({ params, searchParams }: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams?: Promise<{ format?: string | string[]; result?: string }>;
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
  const [billing, terminal] = await Promise.all([
    hasEntitlement(locale, FEATURES.billingInvoicing), hasEntitlement(locale, FEATURES.shopTerminal),
  ]);
  if (billing && terminal) {
    const data = await getPosBillingPaymentDocuments(locale, orderId);
    return <PosBillingCustomerCopy context={context} data={data} locale={locale} format={customerCopyFormat} result={(await searchParams)?.result} />;
  }
  return <OrderPrintDocument context={context} customerCopyFormat={customerCopyFormat} locale={locale} mode="customer-copy" />;
}
