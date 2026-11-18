import "server-only";

import type { BillingSimplifiedTicketProps } from "@/components/billing/BillingSimplifiedTicket";
import { getBillingSimplifiedDraft } from "@/features/billing/server/queries";
import { billingSimplifiedDraftDocument } from "@/features/billing/simplified-document";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import type { PaymentMethod, PaymentRecordStatus } from "@/features/payments/types";
import { requirePosAccess } from "@/features/pos/server/access";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Amount = number | string;
type OrderRow = {
  id: string; organization_id: string; customer_id: string; order_number: string;
  currency: string; subtotal: Amount; discount_amount: Amount; total: Amount;
  is_active: boolean; production_status: string; location_id: string | null;
};
type PaymentRow = {
  id: string; organization_id: string; order_id: string; amount: Amount;
  status: PaymentRecordStatus; method: PaymentMethod; channel: string;
  pos_session_id: string | null; recorded_by: string | null; confirmed_by: string | null;
  paid_at: string; refunded_from_payment_id: string | null;
};
type SummaryRow = { total_due: Amount; total_paid: Amount; balance_due: Amount; payment_status: string };
type LinkRow = { organization_id: string; invoice_id: string; order_id: string; is_active: boolean };
type InvoiceRow = {
  id: string; organization_id: string; customer_id: string; document_status: string; fiscal_document_type: string;
};
type SessionRow = { id: string; organization_id: string; location_id: string | null; status: string };

export type BillingPosOrderContext = {
  orderId: string;
  currency: string;
  orderTotal: number;
  posPaidTotal: number;
  outstanding: number;
  payments: Array<{ id: string; amount: number; method: PaymentMethod; status: "confirmed" | "refunded" }>;
  activeInvoice: { id: string; documentStatus: string; fiscalDocumentType: string } | null;
};
export type BillingSimplifiedPosBlockReason =
  | "order_unavailable" | "read_failed" | "billing_schema_unavailable" | "invalid_amounts"
  | "payment_not_pos" | "pos_registration_unverified" | "payment_reconciliation_failed"
  | "not_fully_paid" | "payment_exceeds_order" | "invoice_conflict" | "invoice_already_issued"
  | "simplified_draft_required" | "ordinary_draft_present" | "draft_order_mismatch"
  | "billing_totals_mismatch" | "unsupported_tax_model" | "recipient_mismatch";
export type BillingSimplifiedPosBridgeResult =
  | { status: "blocked"; reason: BillingSimplifiedPosBlockReason; context: BillingPosOrderContext | null }
  | { status: "preview"; context: BillingPosOrderContext;
      ticket: Omit<BillingSimplifiedTicketProps, "demonstration"> & { preview: true } };

// Persisted amounts have cent precision. Reject malformed/fractional-cent
// inputs instead of rounding a new financial value. Only integer cents are added.
function cents(value: Amount): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const result = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}
const sumCents = (values: number[]) => values.reduce((sum, value) => Number.isSafeInteger(sum + value) ? sum + value : NaN, 0);

// Advisory read only. Multi-query reads are not an issuance lock or an atomic
// eligibility decision. No creation, payment, numbering or fiscal RPC is called.
export async function getBillingSimplifiedPosPreview(locale: string, orderId: string): Promise<BillingSimplifiedPosBridgeResult> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const posAccess = await requirePosAccess(locale);
  const orgId = membership.organization.id;
  const blocked = (reason: BillingSimplifiedPosBlockReason, context: BillingPosOrderContext | null = null): BillingSimplifiedPosBridgeResult => ({ status: "blocked", reason, context });
  if (posAccess.membership.organization.id !== orgId) return blocked("order_unavailable");
  const supabase = await createSupabaseServerClient();

  try {
    const orderResult = await supabase.from("orders")
      .select("id, organization_id, customer_id, order_number, currency, subtotal, discount_amount, total, is_active, production_status, location_id")
      .eq("organization_id", orgId).eq("id", orderId).maybeSingle<OrderRow>();
    if (orderResult.error) throw orderResult.error;
    const order = orderResult.data;
    if (!order || order.organization_id !== orgId || order.id !== orderId
      || !order.is_active || order.production_status === "cancelled") return blocked("order_unavailable");
    const total = cents(order.total), subtotal = cents(order.subtotal), discount = cents(order.discount_amount);
    if (total === null || subtotal === null || discount === null || subtotal - discount !== total) return blocked("invalid_amounts");

    // Paginate the ledger instead of treating the Data API's row cap as a
    // complete history. A failed/partial read never becomes a zero balance.
    const payments: PaymentRow[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await supabase.from("payments")
        .select("id, organization_id, order_id, amount, method, status, channel, pos_session_id, recorded_by, confirmed_by, paid_at, refunded_from_payment_id")
        .eq("organization_id", orgId).eq("order_id", orderId).order("id").range(offset, offset + 199).returns<PaymentRow[]>();
      if (page.error) throw page.error;
      if (!Array.isArray(page.data)) return blocked("read_failed");
      payments.push(...page.data);
      if (page.data.length < 200) break;
    }
    const [summaryResult, linkResult, customerResult] = await Promise.all([
      supabase.rpc("get_order_payment_summary", { target_order_id: orderId }).single<SummaryRow>(),
      supabase.from("invoice_orders").select("organization_id, invoice_id, order_id, is_active")
        .eq("organization_id", orgId).eq("order_id", orderId).eq("is_active", true).limit(2).returns<LinkRow[]>(),
      supabase.from("customers").select("id, organization_id, customer_code")
        .eq("organization_id", orgId).eq("id", order.customer_id)
        .maybeSingle<{ id: string; organization_id: string; customer_code: string | null }>(),
    ]);
    for (const result of [summaryResult, linkResult, customerResult]) if (result.error) throw result.error;
    if (!summaryResult.data || !Array.isArray(linkResult.data) || !customerResult.data) return blocked("read_failed");
    if (payments.some((payment) => payment.organization_id !== orgId || payment.order_id !== orderId)
      || customerResult.data.organization_id !== orgId || customerResult.data.id !== order.customer_id
      || linkResult.data.some((link) => link.organization_id !== orgId || link.order_id !== orderId || !link.is_active)) return blocked("read_failed");
    if (new Set(payments.map((payment) => payment.id)).size !== payments.length) return blocked("payment_reconciliation_failed");
    if (linkResult.data.length > 1) return blocked("invoice_conflict");

    let active: InvoiceRow | null = null;
    if (linkResult.data.length) {
      const result = await supabase.from("invoices").select("id, organization_id, customer_id, document_status, fiscal_document_type")
        .eq("organization_id", orgId).eq("id", linkResult.data[0].invoice_id).maybeSingle<InvoiceRow>();
      if (result.error) throw result.error;
      active = result.data;
      if (!active || active.organization_id !== orgId || active.id !== linkResult.data[0].invoice_id
        || active.customer_id !== order.customer_id) return blocked("invoice_conflict");
    }
    if (payments.some((payment) => !["pending", "void", "confirmed", "refunded"].includes(payment.status))) return blocked("read_failed");
    const facts = payments.filter((payment) => payment.status === "confirmed" || payment.status === "refunded");
    if (facts.some((payment) => payment.channel !== "pos")) return blocked("payment_not_pos");
    if (facts.some((payment) => cents(payment.amount) === null || cents(payment.amount)! <= 0)) return blocked("invalid_amounts");
    if (facts.some((payment) => !payment.pos_session_id || !payment.recorded_by || !payment.confirmed_by
      || !Number.isFinite(Date.parse(payment.paid_at)))) return blocked("pos_registration_unverified");
    const sessionIds = [...new Set(facts.map((payment) => payment.pos_session_id!))];
    if (sessionIds.length) {
      const sessions = await supabase.from("pos_sessions").select("id, organization_id, location_id, status")
        .eq("organization_id", orgId).in("id", sessionIds).returns<SessionRow[]>();
      if (sessions.error) throw sessions.error;
      if (!Array.isArray(sessions.data) || sessions.data.length !== sessionIds.length
        || new Set(sessions.data.map((session) => session.id)).size !== sessionIds.length
        || sessions.data.some((session) => session.organization_id !== orgId || !sessionIds.includes(session.id)
          || !["open", "closed"].includes(session.status)
          || (order.location_id !== null && session.location_id !== null && session.location_id !== order.location_id))) return blocked("pos_registration_unverified");
    }
    for (const refund of facts.filter((payment) => payment.status === "refunded")) {
      const original = facts.find((payment) => payment.id === refund.refunded_from_payment_id && payment.status === "confirmed");
      if (!original || original.method !== refund.method) return blocked("payment_reconciliation_failed");
      const refunded = sumCents(facts.filter((payment) => payment.status === "refunded" && payment.refunded_from_payment_id === original.id).map((payment) => cents(payment.amount)!));
      if (refunded > cents(original.amount)!) return blocked("payment_reconciliation_failed");
    }
    const paid = sumCents(facts.map((payment) => cents(payment.amount)! * (payment.status === "refunded" ? -1 : 1)));
    const summary = summaryResult.data;
    if (!Number.isSafeInteger(paid) || paid < 0 || cents(summary.total_due) !== total || cents(summary.total_paid) !== paid
      || cents(summary.balance_due) !== Math.max(total - paid, 0)) return blocked("payment_reconciliation_failed");
    const context: BillingPosOrderContext = {
      orderId, currency: order.currency, orderTotal: total / 100, posPaidTotal: paid / 100,
      outstanding: Math.max(total - paid, 0) / 100,
      payments: facts.map((payment) => ({ id: payment.id, amount: cents(payment.amount)! / 100,
        method: payment.method, status: payment.status as "confirmed" | "refunded" })),
      activeInvoice: active ? { id: active.id, documentStatus: active.document_status, fiscalDocumentType: active.fiscal_document_type } : null,
    };
    if (active?.document_status === "issued") return blocked("invoice_already_issued", context);
    if (paid > total) return blocked("payment_exceeds_order", context);
    if (paid !== total || !facts.some((payment) => payment.status === "confirmed") || summary.payment_status !== "paid") return blocked("not_fully_paid", context);
    if (!active) return blocked("simplified_draft_required", context);
    if (active.document_status !== "draft") return blocked("invoice_conflict", context);
    if (active.fiscal_document_type !== "simplificada") return blocked("ordinary_draft_present", context);

    const detail = await getBillingSimplifiedDraft(locale, active.id);
    const invoice = detail.invoice;
    if (invoice.id !== active.id || invoice.customerId !== order.customer_id || invoice.currency !== order.currency
      || invoice.orderIds.length !== 1 || invoice.orderIds[0] !== orderId
      || detail.items.some((item) => item.sourceOrderId !== orderId)) return blocked("draft_order_mismatch", context);
    if (!invoice.pricesIncludeTax || !detail.items.length
      || detail.items.some((item) => !Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100)
      || new Set(detail.items.map((item) => item.taxRate)).size !== 1) return blocked("unsupported_tax_model", context);
    for (const [header, field] of [
      [invoice.subtotal, "lineSubtotal"], [invoice.discountTotal, "discountAmount"],
      [invoice.taxableBase, "taxableBase"], [invoice.taxTotal, "taxAmount"], [invoice.total, "lineTotal"],
    ] as const) {
      const values = detail.items.map((item) => cents(item[field]));
      if (cents(header) === null || values.some((value) => value === null)
        || sumCents(values as number[]) !== cents(header)) return blocked("billing_totals_mismatch", context);
    }
    if (cents(invoice.total) !== total || cents(invoice.subtotal) !== subtotal || cents(invoice.discountTotal) !== discount
      || cents(invoice.taxableBase)! + cents(invoice.taxTotal)! !== total
      || detail.items.some((item) => cents(item.lineSubtotal)! - cents(item.discountAmount)! !== cents(item.lineTotal)
        || cents(item.taxableBase)! + cents(item.taxAmount)! !== cents(item.lineTotal))) return blocked("billing_totals_mismatch", context);
    const isSharedWalkIn = customerResult.data.customer_code === "WALKIN-SHARED";
    if (isSharedWalkIn ? [invoice.customerName, invoice.customerTaxId, invoice.customerAddressLine1,
      invoice.customerAddressLine2, invoice.customerCity, invoice.customerPostalCode, invoice.customerCountryCode,
      invoice.customerEmail].some((value) => value !== null) : !invoice.customerName?.trim()) return blocked("recipient_mismatch", context);
    const document = billingSimplifiedDraftDocument(detail);
    const logoPath = document.issuer.logoPath;
    const logoUrl = logoPath ? supabase.storage.from("brand-media").getPublicUrl(logoPath).data.publicUrl : null;
    return { status: "preview", context, ticket: {
      document, locale, timeZone: membership.organization.timezone, preview: true,
      presentation: { isSharedWalkIn, branding: { logoPath, logoUrl },
        payment: { paidAmount: paid / 100, outstandingAmount: context.outstanding } },
    } };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    return blocked(code === "42703" || code === "PGRST204" ? "billing_schema_unavailable" : "read_failed");
  }
}
