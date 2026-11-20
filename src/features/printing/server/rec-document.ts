import "server-only";

import type { BillingSimplifiedTicketProps, TicketPaperData } from "@/components/billing/BillingSimplifiedTicket";
import { getBillingSimplifiedIssued } from "@/features/billing/server/queries";
import { billingSimplifiedIssuedDocument } from "@/features/billing/simplified-document";
import { BILLING_ISSUER_REQUIRED_FIELDS } from "@/features/billing/types";
import { requirePrintAccess } from "@/features/printing/server/access";
import { getPrintOrderContext } from "@/features/printing/server/queries";
import { resolveOrderRecState, type RecState } from "@/features/printing/server/rec-state";
import { unpaidTicketData } from "@/features/printing/unpaid-ticket";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BlockedRecState = Exclude<RecState["state"], "unpaid" | "simplified_issued">;
export type RecDocument =
  | { status: "blocked"; state: BlockedRecState }
  | { status: "unpaid"; data: TicketPaperData; timeZone: string; presentation: BillingSimplifiedTicketProps["presentation"] }
  | { status: "simplified_issued"; ticket: BillingSimplifiedTicketProps };

const blocked = (state: BlockedRecState = "unknown"): RecDocument => ({ status: "blocked", state });
const validZone = (locale: string, timeZone: string) => {
  try { new Intl.DateTimeFormat(locale, { timeZone }); return Boolean(timeZone); } catch { return false; }
};
// Compare persisted cent-precision amounts; never rebuild prices or tax.
function cents(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// Read-only selection and presentation. No receipt history, print callback,
// draft/issue action or payment operation belongs to this route.
export async function getOrderRecDocument(locale: string, orderId: string): Promise<RecDocument> {
  const { membership } = await requirePrintAccess(locale);
  // Keep role/Billing/POS denials outside the read-error fallback.
  const state = await resolveOrderRecState(locale, orderId);
  if (state.orderId !== orderId) return blocked();
  if (state.state !== "unpaid" && state.state !== "simplified_issued") return blocked(state.state);

  try {
    const client = await createSupabaseServerClient();
    const orgId = membership.organization.id;
    const read = await client.from("orders").select("id, organization_id, customer_id")
      .eq("organization_id", orgId).eq("id", orderId)
      .maybeSingle<{ id: string; organization_id: string; customer_id: string }>();
    const order = read.data;
    if (read.error || !order || order.id !== orderId || order.organization_id !== orgId
      || typeof order.customer_id !== "string" || !order.customer_id) return blocked();

    if (state.state === "unpaid") {
      if (state.economic.status !== "unpaid" || state.billing.status !== "none"
        || state.print.source !== "operational_order" || state.print.documentId !== null) return blocked();
      const context = await getPrintOrderContext(locale, orderId);
      const ticket = unpaidTicketData(context);
      if (!ticket || context.order.id !== orderId || context.order.customerId !== order.customer_id
        || context.order.total !== state.economic.total || context.paymentSummary.totalPaid !== state.economic.collectedNet
        || context.paymentSummary.balanceDue !== state.economic.outstanding || !validZone(locale, context.timezone)) return blocked();
      const lines = context.items.map((item) => cents(item.lineTotal));
      if (lines.some((value) => value === null) || cents(context.order.subtotal) === null
        || sum(lines as number[]) !== cents(context.order.subtotal)
        || new Set(context.items.map((item) => item.id)).size !== context.items.length) return blocked();
      const settings = await client.from("organizations").select("id, ticket_footer, ticket_special_message")
        .eq("id", orgId).single<{ id: string; ticket_footer: string | null; ticket_special_message: string | null }>();
      if (settings.error || !settings.data || settings.data.id !== orgId
        || ![settings.data.ticket_footer, settings.data.ticket_special_message].every((value) => value === null || typeof value === "string")) return blocked();
      // Legacy context readers can hide payment errors. They provide display
      // data only; a second strict resolver read must still prove unpaid.
      const current = await resolveOrderRecState(locale, orderId);
      if (current.orderId !== orderId || current.state !== "unpaid" || current.economic.status !== "unpaid"
        || current.billing.status !== "none" || current.economic.total !== state.economic.total
        || current.economic.collectedNet !== state.economic.collectedNet
        || current.economic.outstanding !== state.economic.outstanding) return blocked();
      const logoPath = context.branding.brand.logoPath ?? null;
      return { status: "unpaid", data: ticket.data, timeZone: context.timezone, presentation: {
        branding: { logoPath, logoUrl: logoPath }, serviceConditions: settings.data.ticket_footer,
        specialMessage: settings.data.ticket_special_message, scheduleByOrder: { [orderId]: ticket.schedule },
        payment: { paidAmount: current.economic.collectedNet, outstandingAmount: current.economic.outstanding },
      } };
    }

    if (state.billing.status !== "simplified_issued" || state.billing.snapshot !== "identified"
      || state.print.source !== "billing_snapshot" || state.print.documentId !== state.billing.invoiceId) return blocked();
    const detail = await getBillingSimplifiedIssued(locale, state.billing.invoiceId);
    const invoice = detail.invoice;
    const document = billingSimplifiedIssuedDocument(detail);
    if (invoice.id !== state.billing.invoiceId || invoice.invoiceNumber !== state.billing.invoiceNumber
      || invoice.customerId !== order.customer_id || invoice.orderIds.length !== 1 || invoice.orderIds[0] !== orderId
      || detail.items.some((item) => item.sourceOrderId !== orderId)) return blocked();
    // Validate the persisted snapshot's readability, never current issuance
    // eligibility, current issuer settings, or order activity/payment status.
    const timeZone = document.presentation?.timeZone ?? membership.organization.timezone;
    if (!validZone(locale, timeZone) || !/^[A-Z]{3}$/.test(invoice.currency)
      || BILLING_ISSUER_REQUIRED_FIELDS.some((field) => !invoice[field]?.trim()) || !invoice.series?.trim()
      || ![invoice.subtotal, invoice.discountTotal, invoice.taxableBase, invoice.taxTotal, invoice.total].every(Number.isFinite)
      || detail.items.some((item) => !item.description?.trim()
        || ![item.quantity, item.unitPrice, item.discountAmount, item.lineTotal, item.taxRate].every(Number.isFinite))) return blocked();
    for (const [header, field] of [
      [invoice.subtotal, "lineSubtotal"], [invoice.discountTotal, "discountAmount"],
      [invoice.taxableBase, "taxableBase"], [invoice.taxTotal, "taxAmount"], [invoice.total, "lineTotal"],
    ] as const) {
      const lines = detail.items.map((item) => cents(item[field]));
      if (cents(header) === null || lines.some((value) => value === null)
        || sum(lines as number[]) !== cents(header)) return blocked();
    }
    if (cents(invoice.subtotal)! - cents(invoice.discountTotal)! !== cents(invoice.total)
      || cents(invoice.taxableBase)! + cents(invoice.taxTotal)! !== cents(invoice.total)
      || detail.items.some((item) => cents(item.lineSubtotal)! - cents(item.discountAmount)! !== cents(item.lineTotal)
        || cents(item.taxableBase)! + cents(item.taxAmount)! !== cents(item.lineTotal))) return blocked();
    // Historical recipient presentation is defined only by the issued fields.
    // Anonymous snapshots must omit every identity field; named snapshots keep
    // their stored name and optional details, irrespective of today's customer.
    const recipientFields = [invoice.customerName, invoice.customerTaxId, invoice.customerAddressLine1,
      invoice.customerAddressLine2, invoice.customerCity, invoice.customerPostalCode, invoice.customerCountryCode, invoice.customerEmail];
    if (recipientFields.some((value) => value !== null && typeof value !== "string")) return blocked();
    const anonymousRecipient = invoice.customerName === null;
    if (anonymousRecipient ? recipientFields.some((value) => value !== null) : !invoice.customerName?.trim()) return blocked();
    const logoPath = document.issuer.logoPath;
    const logoUrl = logoPath ? client.storage.from("brand-media").getPublicUrl(logoPath).data.publicUrl : null;
    return { status: "simplified_issued", ticket: {
      document, locale, timeZone, presentation: { branding: { logoPath, logoUrl }, isSharedWalkIn: anonymousRecipient,
        // Never use the issued reader's best-effort payment hydration as proof.
        ...("collectedNet" in state.economic ? { payment: {
          paidAmount: state.economic.collectedNet, outstandingAmount: state.economic.outstanding,
        } } : {}),
      },
    } };
  } catch {
    return blocked();
  }
}
