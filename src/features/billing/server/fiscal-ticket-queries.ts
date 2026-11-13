import "server-only";

import { notFound } from "next/navigation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fiscalTicketSnapshot } from "@/features/billing/fiscal-ticket";
import { getBillingInvoice } from "@/features/billing/server/queries";

export async function fiscalTicketEnabled(locale: string) {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organization_billing_settings")
    .select("fiscal_ticket_phase_a_enabled").eq("organization_id", membership.organization.id)
    .maybeSingle<{ fiscal_ticket_phase_a_enabled: boolean }>();
  // A pending local migration must not disrupt the existing ordinary workflow.
  if (error && ["42703", "PGRST204"].includes(error.code)) return false;
  if (error) throw error;
  return data?.fiscal_ticket_phase_a_enabled === true;
}

export async function getFiscalTicketPreview(locale: string, orderId: string) {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) notFound();
  if (!await fiscalTicketEnabled(locale)) return { state: "disabled" as const };
  const supabase = await createSupabaseServerClient();
  const org = membership.organization.id;
  const [order, payments, links] = await Promise.all([
    supabase.from("orders").select("id, order_number, customer_id, total, currency, production_status")
      .eq("organization_id", org).eq("id", orderId)
      .maybeSingle<{ id: string; order_number: string; customer_id: string; total: number; currency: string; production_status: string }>(),
    supabase.from("payments").select("id, amount, status, channel")
      .eq("organization_id", org).eq("order_id", orderId).neq("status", "void").limit(2)
      .returns<Array<{ id: string; amount: number; status: string; channel: string }>>(),
    supabase.from("invoice_orders").select("invoice_id")
      .eq("organization_id", org).eq("order_id", orderId).limit(2)
      .returns<Array<{ invoice_id: string }>>(),
  ]);
  if (order.error || payments.error || links.error) return { state: "unavailable" as const };
  if (!order.data) notFound();
  if (links.data?.length) {
    const existing = await supabase.from("invoices").select("id, fiscal_ticket_order_snapshot")
      .eq("organization_id", org).eq("document_status", "issued")
      .in("id", links.data.map((link) => link.invoice_id)).limit(2)
      .returns<Array<{ id: string; fiscal_ticket_order_snapshot: unknown }>>();
    if (existing.error) return { state: "unavailable" as const };
    const document = existing.data?.find((row) => fiscalTicketSnapshot(row.fiscal_ticket_order_snapshot));
    return document ? { state: "issued" as const, invoiceId: document.id } : { state: "blocked" as const };
  }
  const payment = payments.data?.[0];
  if (payments.data?.length !== 1 || !payment || payment.status !== "confirmed" || payment.channel !== "pos"
    || Number(payment.amount) !== Number(order.data.total) || order.data.production_status !== "received"
    || order.data.currency !== "EUR") return { state: "blocked" as const };
  const customer = await supabase.from("customers")
    .select("customer_type, display_name, tax_id, billing_address_line1, billing_city, billing_postal_code, billing_country_code")
    .eq("organization_id", org).eq("id", order.data.customer_id)
    .maybeSingle<{ customer_type: string; display_name: string; tax_id: string | null; billing_address_line1: string | null; billing_city: string | null; billing_postal_code: string | null; billing_country_code: string | null }>();
  if (customer.error || !customer.data) return { state: "unavailable" as const };
  return { state: "ready" as const, order: order.data, payment, customer: customer.data };
}

export async function getFiscalTicketDocument(locale: string, invoiceId: string) {
  const detail = await getBillingInvoice(locale, invoiceId);
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("invoices").select("fiscal_ticket_order_snapshot")
    .eq("organization_id", membership.organization.id).eq("id", invoiceId)
    .maybeSingle<{ fiscal_ticket_order_snapshot: unknown }>();
  if (error) throw error;
  const snapshot = fiscalTicketSnapshot(data?.fiscal_ticket_order_snapshot);
  if (!snapshot || !detail.fullPrepayment) notFound();
  return { detail, snapshot, timezone: membership.organization.timezone };
}
