import "server-only";

import type { BillingSimplifiedTicketProps } from "@/components/billing/BillingSimplifiedTicket";
import { getBillingCustomerContext, getBillingSettings, getBillingSimplifiedIssued } from "@/features/billing/server/queries";
import { getBillingSimplifiedPosPreview } from "@/features/billing/server/simplified-pos-bridge";
import { requireBillingSimplifiedUiAccess } from "@/features/billing/server/simplified-ui-access";
import { billingSimplifiedIssuedDocument } from "@/features/billing/simplified-document";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Order = { id: string; organization_id: string; customer_id: string; order_number: string };
export type BillingSimplifiedUiState =
  | { status: "empty" }
  | { status: "blocked"; reason: string; order?: Order }
  | { status: "ready"; order: Order }
  | { status: "issued_unavailable"; order: Order; invoiceId: string }
  | { status: "draft"; order: Order; invoiceId: string; ticket: BillingSimplifiedTicketProps }
  | { status: "issued"; order: Order; invoiceId: string; ticket: BillingSimplifiedTicketProps };

// A read-only adapter. Payment/tax eligibility stays in the bridge and SQL.
export async function getBillingSimplifiedUiState(locale: string, selection: { orderId?: string; orderNumber?: string }): Promise<BillingSimplifiedUiState> {
  const { membership } = await requireBillingSimplifiedUiAccess(locale);
  if (!selection.orderId && !selection.orderNumber) return { status: "empty" };
  if (selection.orderId && !UUID.test(selection.orderId)) return { status: "blocked", reason: "invalid_input" };
  if (selection.orderNumber && (selection.orderNumber.length > 80 || !selection.orderNumber.trim())) return { status: "blocked", reason: "invalid_input" };
  const supabase = await createSupabaseServerClient();
  const orgId = membership.organization.id;
  let query = supabase.from("orders").select("id, organization_id, customer_id, order_number").eq("organization_id", orgId);
  query = selection.orderId ? query.eq("id", selection.orderId) : query.eq("order_number", selection.orderNumber!.trim());
  const result = await query.maybeSingle<Order>();
  if (result.error) return { status: "blocked", reason: "read_failed" };
  const order = result.data;
  if (!order || order.organization_id !== orgId) return { status: "blocked", reason: "order_unavailable" };
  const customer = await getBillingCustomerContext(locale, order.customer_id);

  const bridge = await getBillingSimplifiedPosPreview(locale, order.id);
  if (bridge.status === "blocked" && bridge.reason === "invoice_already_issued"
    && bridge.context?.activeInvoice?.fiscalDocumentType === "simplificada") {
    // Refresh/return from history never issues. Render only a persisted snapshot.
    const invoiceId = bridge.context.activeInvoice.id;
    try {
      const detail = await getBillingSimplifiedIssued(locale, invoiceId);
      const recipientFields = [detail.invoice.customerName, detail.invoice.customerTaxId,
        detail.invoice.customerAddressLine1, detail.invoice.customerAddressLine2, detail.invoice.customerCity,
        detail.invoice.customerPostalCode, detail.invoice.customerCountryCode, detail.invoice.customerEmail];
      if (detail.invoice.orderIds.length !== 1 || detail.invoice.orderIds[0] !== order.id
        || detail.invoice.customerId !== order.customer_id
        || (customer.isSharedWalkIn ? recipientFields.some((field) => field !== null) : !detail.invoice.customerName?.trim())) {
        return { status: "blocked", reason: "invoice_conflict", order };
      }
      const document = billingSimplifiedIssuedDocument(detail);
      const logoPath = document.issuer.logoPath;
      const logoUrl = logoPath ? supabase.storage.from("brand-media").getPublicUrl(logoPath).data.publicUrl : null;
      return { status: "issued", order, invoiceId, ticket: {
        document, locale, timeZone: membership.organization.timezone,
        presentation: { branding: { logoPath, logoUrl }, isSharedWalkIn: customer.isSharedWalkIn,
          payment: { paidAmount: detail.invoice.paidTotal, outstandingAmount: detail.invoice.outstanding } },
      } };
    } catch {
      return { status: "issued_unavailable", order, invoiceId };
    }
  }
  if (bridge.status === "blocked" && bridge.reason !== "simplified_draft_required") return { status: "blocked", reason: bridge.reason, order };
  if (!customer.isSharedWalkIn && (!customer.isFiscalReady || !customer.customerName.trim())) return { status: "blocked", reason: "customer_incomplete", order };
  const settings = await getBillingSettings(locale);
  if (!settings.isIssueReady) return { status: "blocked", reason: "issuer_incomplete", order };
  if (bridge.status === "preview") {
    if (customer.isSharedWalkIn ? bridge.ticket.document.recipient !== null || bridge.ticket.presentation?.isSharedWalkIn !== true
      : !bridge.ticket.document.recipient?.name?.trim()) return { status: "blocked", reason: "recipient_mismatch", order };
    return { status: "draft", order, invoiceId: bridge.ticket.document.document.id, ticket: bridge.ticket };
  }
  return { status: "ready", order };
}

// Existing history links keep their URL; only enabled local simplified records
// are redirected to the guarded view. Ordinary detail rendering is unchanged.
export async function getBillingSimplifiedUiOrderForInvoice(locale: string, invoiceId: string): Promise<string | null> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  if (!UUID.test(invoiceId)) return null;
  const supabase = await createSupabaseServerClient();
  const orgId = membership.organization.id;
  const invoice = await supabase.from("invoices").select("fiscal_document_type")
    .eq("organization_id", orgId).eq("id", invoiceId).maybeSingle<{ fiscal_document_type: string }>();
  if (invoice.error) throw invoice.error;
  if (invoice.data?.fiscal_document_type !== "simplificada") return null;
  await requireBillingSimplifiedUiAccess(locale);
  const link = await supabase.from("invoice_orders").select("order_id")
    .eq("organization_id", orgId).eq("invoice_id", invoiceId).eq("is_active", true).maybeSingle<{ order_id: string }>();
  if (link.error) throw link.error;
  return link.data?.order_id ?? null;
}
