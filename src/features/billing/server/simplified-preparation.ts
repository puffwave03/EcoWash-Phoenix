import "server-only";

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assessSimplifiedOperation, snapshotSimplifiedRecipient } from "@/features/billing/simplified-operation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function single(form: FormData, field: string): string | null {
  const values = form.getAll(field);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}

function requestedRecipient(form: FormData): unknown {
  const mode = single(form, "recipientMode");
  if (mode === "anonymous") {
    // Explicitly choosing anonymous discards form identity fields. The strict
    // snapshot contains NULL only; hidden/stale fields never become fiscal data.
    return { mode };
  }
  if (mode !== "identified") return null;
  return { mode, name: single(form, "recipientName"), taxId: single(form, "recipientTaxId"),
    addressLine1: single(form, "recipientAddressLine1"), city: single(form, "recipientCity"),
    postalCode: single(form, "recipientPostalCode"), countryCode: single(form, "recipientCountryCode") };
}

export function requestedRecipientSnapshot(form: FormData) {
  return snapshotSimplifiedRecipient(requestedRecipient(form));
}

// Exact conversion of a canonical NUMERIC amount, not a tax/price calculation.
function canonicalCents(amount: unknown): number {
  if (typeof amount !== "string" && typeof amount !== "number") return NaN;
  const parts = /^(0|[1-9]\d{0,11})(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!parts) return NaN;
  const cents = Number(parts[1]) * 100 + Number((parts[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : NaN;
}

type AuthorizedContext = { organizationId: string; role: string };
type OrderRow = { organization_id: string; id: string; currency: string; total: number | string; is_active: boolean; production_status: string };
type SettingsRow = { fiscal_territory_code: string | null; declared_tax_regime_code: string | null; simplified_invoicing_enabled: boolean };
type LinkRow = { invoice_id: string; is_active: boolean };
type DocumentRow = { id: string; document_status: "draft" | "issued" | "cancelled" };

// Called only AFTER the canonical action authenticates and checks entitlement.
// Context comes from requireOwnerOrManager, never from a hidden form/customer ID.
// This module has no "use server" export and is not a client-callable endpoint.
export async function prepareSimplifiedBillingRequest(context: AuthorizedContext, form: FormData) {
  const orderId = single(form, "orderId");
  if (!orderId || !UUID.test(orderId)) return { kind: "invalid_request" } as const;
  if (!context.organizationId || !["owner", "manager"].includes(context.role)) {
    throw new Error("billing_not_authorized");
  }

  const supabase = await createSupabaseServerClient();
  const order = await supabase.from("orders")
    .select("id, organization_id, currency, total, is_active, production_status")
    .eq("organization_id", context.organizationId).eq("id", orderId).maybeSingle<OrderRow>();
  if (order.error) throw order.error;
  if (!order.data) notFound();
  // Defend against an invalid read response as well as retaining tenant filters.
  if (order.data.organization_id !== context.organizationId || order.data.id !== orderId) notFound();

  const [settings, items, links, payments] = await Promise.all([
    supabase.from("organization_billing_settings")
      .select("fiscal_territory_code, declared_tax_regime_code, simplified_invoicing_enabled")
      .eq("organization_id", context.organizationId).maybeSingle<SettingsRow>(),
    supabase.from("order_items").select("id")
      .eq("organization_id", context.organizationId).eq("order_id", orderId).eq("is_active", true)
      .returns<{ id: string }[]>(),
    supabase.from("invoice_orders").select("invoice_id, is_active")
      .eq("organization_id", context.organizationId).eq("order_id", orderId).returns<LinkRow[]>(),
    supabase.from("payments").select("id, status")
      .eq("organization_id", context.organizationId).eq("order_id", orderId)
      .returns<{ id: string; status: string }[]>(),
  ]);
  for (const result of [settings, items, links, payments]) if (result.error) throw result.error;
  if (!Array.isArray(items.data) || !Array.isArray(links.data) || !Array.isArray(payments.data)) {
    throw new Error("billing_simplified_invalid_read_response");
  }

  let existingDocument: "none" | "cancelled" = "none";
  if (links.data.length > 0) {
    const ids = [...new Set(links.data.map((link) => link.invoice_id))];
    const documents = await supabase.from("invoices").select("id, document_status")
      .eq("organization_id", context.organizationId).in("id", ids).returns<DocumentRow[]>();
    if (documents.error) throw documents.error;
    if (!Array.isArray(documents.data) || documents.data.length !== ids.length) {
      throw new Error("billing_order_entry_invalid_document");
    }
    const active = links.data.filter((link) => link.is_active);
    if (active.length > 1) throw new Error("billing_order_entry_invalid_document");
    const existing = active[0] && documents.data.find((document) => document.id === active[0].invoice_id);
    if (existing && ["draft", "issued"].includes(existing.document_status)) {
      // A lookup can race with another operator. No creation follows this read;
      // the canonical RPC/unique index remain the final write authority.
      return { kind: "existing_document", invoiceId: existing.id } as const;
    }
    if (active.length > 0 || documents.data.some((document) => document.document_status !== "cancelled")) {
      throw new Error("billing_order_entry_invalid_document");
    }
    existingDocument = "cancelled";
  }

  const assessment = assessSimplifiedOperation({
    organizationId: context.organizationId, orderOrganizationId: order.data.organization_id,
    role: context.role, billingEntitled: true,
    territory: settings.data?.fiscal_territory_code ?? null,
    regime: settings.data?.declared_tax_regime_code ?? null,
    // Existing profile fields are declarations, not an approved operation/date
    // contract. Neither submitted flags nor names/catalog codes supply it.
    fiscalContextVerified: false, operationScope: "unverified", statutoryExclusions: "unverified",
    currency: order.data.currency, totalCents: canonicalCents(order.data.total),
    activeOrder: order.data.is_active, orderStatus: order.data.production_status, itemCount: items.data.length,
    existingFiscalDocument: existingDocument, recipientRequirement: "unverified",
    fiscalDate: null, fiscalDateVerified: false,
    paymentContext: payments.data.length === 0 ? "no_advance" : "unverified",
  }, requestedRecipient(form));
  // Draft persistence is distinct from fiscal approval/issuance. The action
  // sends this explicit snapshot through the canonical six-argument overload.
  return { kind: "assessed", orderId, assessment } as const;
}
