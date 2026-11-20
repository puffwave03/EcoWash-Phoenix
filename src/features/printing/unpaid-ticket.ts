import type { PrintOrderContext } from "./types";
import type { TicketPaperData } from "@/components/billing/BillingSimplifiedTicket";
import type { TicketSchedule } from "./ticket-settings";

// Read-only adaptation. In particular a fully refunded order is NOT an unpaid
// order eligible for this path. Partial collections belong to a separate phase.
export function unpaidTicketData(context: PrintOrderContext): { data: TicketPaperData; schedule: TicketSchedule } | null {
  const { order, items, payments, paymentSummary, branding, logistics } = context;
  if (!order.isActive || order.productionStatus === "cancelled" || !items.length
    || context.quickDropFinancialState === "unpriced"
    || payments.some((p) => p.status === "confirmed" || p.status === "refunded")
    || paymentSummary.paymentStatus !== "unpaid" || paymentSummary.totalPaid !== 0
    || paymentSummary.totalDue !== order.total || paymentSummary.balanceDue !== order.total
    || !/^[A-Z]{3}$/.test(order.currency)
    || ![order.subtotal, order.discountAmount, order.total].every((n) => Number.isFinite(n) && n >= 0)
    || items.some((i) => !i.description.trim() || ![i.quantity, i.unitPrice, i.lineTotal].every(Number.isFinite))) return null;
  const scheduled = (record: typeof logistics.pickup) => record && record.status !== "cancelled" && record.status !== "not_required" ? record.scheduledAt : null;
  return {
    schedule: { readyAt: order.dueAt, pickupAt: scheduled(logistics.pickup), deliveryAt: scheduled(logistics.delivery) },
    data: {
      issuer: { legalName: branding.brand.name || context.organizationName, logoPath: branding.brand.logoPath ?? null,
        addressLine1: branding.support.address, addressLine2: null, taxId: null, city: null, region: null,
        postalCode: null, countryCode: null, email: branding.support.email, phone: branding.support.phone },
      recipient: { name: order.customerName, taxId: null, addressLine1: null, addressLine2: null, city: null,
        postalCode: null, countryCode: null, email: null },
      orders: [{ id: order.id, number: order.orderNumber }],
      items: items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, unitType: i.unitType,
        unitPrice: i.unitPrice, lineTotal: i.lineTotal, discountAmount: null })),
      totals: { currency: order.currency, subtotal: order.subtotal, discount: order.discountAmount, total: order.total },
    },
  };
}
