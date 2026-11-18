import "server-only";

import type { BillingSimplifiedTicketProps } from "@/components/billing/BillingSimplifiedTicket";
import { getBillingSimplifiedIssued } from "@/features/billing/server/queries";
import { billingSimplifiedIssuedDocument } from "@/features/billing/simplified-document";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requirePosAccess } from "@/features/pos/server/access";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Failure = "invalid_input" | "invoice_unavailable" | "issue_blocked" | "issue_schema_unavailable";
export type BillingSimplifiedIssueResult =
  | { status: "blocked"; reason: Failure }
  | { status: "issued"; invoiceId: string; invoiceNumber: string;
      // A read failure does not undo a committed issue. Retry retrieves the
      // same persisted identity; presentation is always a separate read.
      ticket: BillingSimplifiedTicketProps | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No Server Action/route. SQL is authoritative for locks, current full-payment
// eligibility, retry identity and numbering. No client financial payload exists.
export async function issueBillingSimplifiedInvoice(locale: string, invoiceId: string): Promise<BillingSimplifiedIssueResult> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const access = await requirePosAccess(locale);
  if (!UUID.test(invoiceId)) return { status: "blocked", reason: "invalid_input" };
  if (access.membership.organization.id !== membership.organization.id) return { status: "blocked", reason: "invoice_unavailable" };
  const supabase = await createSupabaseServerClient();
  const { data: target, error: readError } = await supabase.from("invoices")
    .select("id, organization_id, fiscal_document_type, document_status")
    .eq("organization_id", membership.organization.id).eq("id", invoiceId)
    .maybeSingle<{ id: string; organization_id: string; fiscal_document_type: string; document_status: string }>();
  if (readError || !target || target.id !== invoiceId || target.organization_id !== membership.organization.id
    || target.fiscal_document_type !== "simplificada" || !["draft", "issued"].includes(target.document_status)) {
    return { status: "blocked", reason: "invoice_unavailable" };
  }
  const { data, error } = await supabase.rpc("issue_billing_invoice", { target_invoice_id: invoiceId })
    .returns<Array<{ invoice_id: string; invoice_number: string }>>();
  if (error || !Array.isArray(data) || data.length !== 1 || data[0].invoice_id !== invoiceId || !data[0].invoice_number?.trim()) {
    return { status: "blocked", reason: error?.code === "PGRST202" || error?.code === "42883"
      ? "issue_schema_unavailable" : "issue_blocked" };
  }
  const issued = { status: "issued" as const, invoiceId, invoiceNumber: data[0].invoice_number };
  try {
    const detail = await getBillingSimplifiedIssued(locale, invoiceId);
    if (detail.invoice.id !== invoiceId || detail.invoice.invoiceNumber !== issued.invoiceNumber) return { ...issued, ticket: null };
    const document = billingSimplifiedIssuedDocument(detail);
    const logoPath = document.issuer.logoPath;
    const logoUrl = logoPath ? supabase.storage.from("brand-media").getPublicUrl(logoPath).data.publicUrl : null;
    return { ...issued, ticket: { document, locale, timeZone: membership.organization.timezone,
      presentation: { isSharedWalkIn: document.recipient === null, branding: { logoPath, logoUrl },
        payment: { paidAmount: detail.invoice.paidTotal, outstandingAmount: detail.invoice.outstanding } } } };
  } catch {
    return { ...issued, ticket: null };
  }
}
