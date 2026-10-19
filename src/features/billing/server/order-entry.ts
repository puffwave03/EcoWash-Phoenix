import "server-only";

import { notFound } from "next/navigation";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EligibleBillingOrder } from "@/features/billing/types";
import { getBillingSettings, listEligibleBillingOrders } from "@/features/billing/server/queries";

type BillingOrderEntry =
  | { kind: "prepare"; customerId: string; href: string; simplifiedOrder?: EligibleBillingOrder }
  | { kind: "draft" | "issued"; href: string }
  | { kind: "unavailable"; reason: "sharedWalkIn" | "ineligible" };

// Navigation only. Eligibility and draft creation remain canonical to Billing.
export async function getBillingOrderEntry(locale: string, orderId: string): Promise<BillingOrderEntry> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const organizationId = membership.organization.id;
  const order = await supabase.from("orders").select("customer_id, id, is_active, production_status, currency, total, order_number, created_at")
    .eq("organization_id", organizationId).eq("id", orderId)
    .maybeSingle<{ customer_id: string; id: string; is_active: boolean; production_status: string; currency: string; total: number; order_number: string; created_at: string }>();
  if (order.error) throw order.error;
  if (!order.data) notFound();
  const customerId = order.data.customer_id;
  const [customer, link] = await Promise.all([
    supabase.from("customers").select("customer_code")
      .eq("organization_id", organizationId).eq("id", customerId)
      .maybeSingle<{ customer_code: string | null }>(),
    supabase.from("invoice_orders").select("invoice_id")
      .eq("organization_id", organizationId).eq("order_id", orderId)
      .eq("billing_link_role", "final").eq("is_active", true)
      .maybeSingle<{ invoice_id: string }>(),
  ]);
  if (customer.error) throw customer.error;
  if (link.error) throw link.error;
  if (!customer.data) notFound();
  if (link.data) {
    const invoice = await supabase.from("invoices").select("id, document_status, fiscal_document_type")
      .eq("organization_id", organizationId).eq("id", link.data.invoice_id)
      .maybeSingle<{ id: string; document_status: string; fiscal_document_type?: string }>();
    if (invoice.error) throw invoice.error;
    if (!invoice.data || !["draft", "issued"].includes(invoice.data.document_status)) {
      throw new Error("billing_order_entry_invalid_document");
    }
    if (customer.data.customer_code === "WALKIN-SHARED" && invoice.data.fiscal_document_type !== "simplified") {
      return { kind: "unavailable", reason: "sharedWalkIn" };
    }
    return { kind: invoice.data.document_status as "draft" | "issued", href: `/app/billing/${invoice.data.id}` };
  }
  if (customer.data.customer_code === "WALKIN-SHARED") {
    const settings = await getBillingSettings(locale);
    if (!settings.simplifiedIssuanceReady) return { kind: "unavailable", reason: "sharedWalkIn" };
    const row = order.data;
    if (!row.is_active || ["draft", "cancelled"].includes(row.production_status)) return { kind: "unavailable", reason: "ineligible" };
    return { kind: "prepare", customerId, href: `/app/billing/new?orderId=${encodeURIComponent(orderId)}`,
      simplifiedOrder: { id: orderId, customerId, customerName: "", customerActive: true,
        currency: row.currency, total: Number(row.total), createdAt: row.created_at, orderNumber: row.order_number } };
  }
  // Cancelled documents have inactive links. Reuse the existing selector rather
  // than extending eligibility (or treating a read failure as an empty result).
  const { orders } = await listEligibleBillingOrders(locale, customerId, orderId);
  if (!orders.some((candidate) => candidate.id === orderId && candidate.customerId === customerId)) {
    return { kind: "unavailable", reason: "ineligible" };
  }
  return { kind: "prepare", customerId, href: `/app/billing/new?orderId=${encodeURIComponent(orderId)}` };
}
