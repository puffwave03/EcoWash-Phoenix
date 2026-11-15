import "server-only";
import { ticketUnicoEnabled } from "@/features/billing/server/ticket-unico";
import { getPosBillingPaymentDocuments } from "@/features/billing/server/payment-link";

import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { requirePrintAccess } from "@/features/printing/server/access";
import { getPrintOrderContext } from "@/features/printing/server/queries";
import { hasEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { findIssuedFiscalTicketForOrder, getFiscalTicketPreview } from "@/features/billing/server/fiscal-ticket-queries";

// GET-only resolution. Never submit intake, record money, or issue a document here.
export async function getTerminalCustomerDocument(locale: string, orderId: string) {
  const { membership } = await requireShopTerminalAccess(locale);
  await requirePrintAccess(locale);
  const context = await getPrintOrderContext(locale, orderId);
  const copyHref = `/app/orders/${encodeURIComponent(context.order.id)}/print/customer-copy?format=80mm`;
  if (await ticketUnicoEnabled(locale)) {
    const fiscal = await getPosBillingPaymentDocuments(locale, orderId);
    return { state: fiscal.state === "unavailable" ? "unavailable" as const : "operational" as const, copyHref };
  }
  if (!["owner", "manager"].includes(membership.role)
    || !await hasEntitlement(locale, FEATURES.billingInvoicing)) {
    return { state: "operational" as const, copyHref };
  }
  const issued = await findIssuedFiscalTicketForOrder(locale, orderId);
  if (issued.state === "issued") return { state: "issued" as const, invoiceId: issued.invoiceId };
  if (issued.state === "unavailable") return { state: "unavailable" as const, copyHref };
  const preview = await getFiscalTicketPreview(locale, orderId);
  if (preview.state === "issued") return { state: "issued" as const, invoiceId: preview.invoiceId };
  // Disabled tenants retain operational printing. PAGA DOPO has no advance.
  // Ordinary histories and read failures must not masquerade as fiscal success.
  if (preview.state === "disabled") return { state: "operational" as const, copyHref };
  if (preview.state === "unavailable") return { state: "unavailable" as const, copyHref };
  if (preview.state === "blocked") {
    const payments = context.payments.filter((payment) => payment.status !== "void");
    // No prepayment fiscal path for deferred, partial, refunded or mixed intake.
    if (payments.length !== 1 || payments[0].status !== "confirmed"
      || Number(payments[0].amount) !== Number(context.order.total)) {
      return { state: "operational" as const, copyHref };
    }
    return { state: "blocked" as const, copyHref };
  }
  return { state: "ready" as const, preview, copyHref };
}
