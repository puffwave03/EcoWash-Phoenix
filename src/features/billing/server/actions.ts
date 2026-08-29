"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTaxRate } from "@/features/billing/tax-rate";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, name: string, max = 1000) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function nullable(valueToNormalize: string) {
  return valueToNormalize || null;
}

function billingError(message: string | undefined) {
  if (message?.includes("issuer_configuration")) return "issuer";
  if (message?.includes("customer_configuration")) return "customer";
  if (message?.includes("already_invoiced")) return "duplicate";
  if (message?.includes("not_authorized")) return "unauthorized";
  if (message?.includes("invalid_orders") || message?.includes("without_items")) return "orders";
  return "generic";
}

function revalidateBilling(locale: string, customerId?: string, invoiceId?: string) {
  revalidatePath(`/${locale}/app/billing`);
  if (invoiceId) revalidatePath(`/${locale}/app/billing/${invoiceId}`);
  if (customerId) revalidatePath(`/${locale}/app/customers/${customerId}`);
}

export async function saveBillingSettingsAction(locale: string, formData: FormData) {
  await requireOwner(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const taxRate = parseTaxRate(value(formData, "defaultTaxRate", 16));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("upsert_organization_billing_settings", {
    target_default_series: value(formData, "defaultSeries", 12),
    target_default_tax_rate: taxRate ?? -1,
    target_issuer_address_line1: value(formData, "issuerAddressLine1", 180),
    target_issuer_address_line2: value(formData, "issuerAddressLine2", 180),
    target_issuer_city: value(formData, "issuerCity", 100),
    target_issuer_country_code: value(formData, "issuerCountryCode", 2).toUpperCase(),
    target_issuer_email: value(formData, "issuerEmail", 254),
    target_issuer_legal_name: value(formData, "issuerLegalName", 180),
    target_issuer_phone: value(formData, "issuerPhone", 40),
    target_issuer_postal_code: value(formData, "issuerPostalCode", 24),
    target_issuer_region: value(formData, "issuerRegion", 100),
    target_issuer_tax_id: value(formData, "issuerTaxId", 80),
  });
  if (error) redirect(`/${locale}/app/billing?error=${billingError(error.message)}`);
  revalidateBilling(locale);
  redirect(`/${locale}/app/billing?saved=settings`);
}

export async function saveBillingCustomerFiscalAction(
  locale: string,
  customerId: string,
  orderId: string,
  formData: FormData,
) {
  if (!UUID.test(customerId) || !UUID.test(orderId)) redirect(`/${locale}/app/billing/new?error=orders`);
  const { membership, user } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, customer_type, tax_id, billing_address_line1, billing_city, billing_postal_code, billing_country_code")
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId)
    .maybeSingle<{
      billing_address_line1: string | null;
      billing_city: string | null;
      billing_country_code: string | null;
      billing_postal_code: string | null;
      customer_type: "individual" | "business";
      id: string;
      tax_id: string | null;
    }>();
  if (customerError || !customer) redirect(`/${locale}/app/billing/new?error=customer`);

  const updates: Record<string, string> = {};
  const required = [
    ["billing_address_line1", "billingAddressLine1", customer.billing_address_line1, 180],
    ["billing_city", "billingCity", customer.billing_city, 100],
    ["billing_postal_code", "billingPostalCode", customer.billing_postal_code, 24],
    ["billing_country_code", "billingCountryCode", customer.billing_country_code, 2],
  ] as const;
  for (const [column, field, current, max] of required) {
    if (!current?.trim()) {
      const next = value(formData, field, max);
      if (!next || (field === "billingCountryCode" && next.length !== 2)) {
        redirect(`/${locale}/app/billing/new?customerId=${customerId}&orderId=${orderId}&source=shop&error=customer`);
      }
      updates[column] = field === "billingCountryCode" ? next.toUpperCase() : next;
    }
  }
  if (customer.customer_type === "business" && !customer.tax_id?.trim()) {
    const taxId = value(formData, "taxId", 80);
    if (!taxId) redirect(`/${locale}/app/billing/new?customerId=${customerId}&orderId=${orderId}&source=shop&error=customer`);
    updates.tax_id = taxId;
  }

  if (Object.keys(updates).length) {
    const { error } = await supabase
      .from("customers")
      .update({ ...updates, updated_by: user.id })
      .eq("organization_id", membership.organization.id)
      .eq("id", customerId);
    if (error) redirect(`/${locale}/app/billing/new?customerId=${customerId}&orderId=${orderId}&source=shop&error=customer`);
  }

  revalidateBilling(locale, customerId);
  revalidatePath(`/${locale}/app/billing/new`);
  redirect(`/${locale}/app/billing/new?customerId=${customerId}&orderId=${orderId}&source=shop&saved=customer`);
}

export async function createBillingDraftAction(locale: string, customerId: string, formData: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const orderIds = formData.getAll("orderId").map(String);
  const taxRate = parseTaxRate(value(formData, "taxRate", 16));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_billing_draft", {
    target_notes: nullable(value(formData, "notes", 2000)),
    target_order_ids: orderIds,
    target_series: value(formData, "series", 12),
    target_tax_rate: taxRate,
  });
  if (error || !data) {
    redirect(`/${locale}/app/billing/new?customerId=${customerId}&error=${billingError(error?.message)}`);
  }
  revalidateBilling(locale, customerId, data);
  redirect(`/${locale}/app/billing/${data}`);
}

export async function updateBillingDraftAction(locale: string, invoiceId: string, customerId: string, formData: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const taxRate = parseTaxRate(value(formData, "taxRate", 16));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_billing_draft", {
    target_due_date: nullable(value(formData, "dueDate", 10)),
    target_invoice_id: invoiceId,
    target_issue_date: value(formData, "issueDate", 10),
    target_notes: nullable(value(formData, "notes", 2000)),
    target_series: value(formData, "series", 12),
    target_tax_rate: taxRate,
  });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing/${invoiceId}?saved=draft`);
}

export async function issueBillingInvoiceAction(locale: string, invoiceId: string, customerId: string) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("issue_billing_invoice", { target_invoice_id: invoiceId });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing/${invoiceId}?saved=issued`);
}

export async function cancelBillingInvoiceAction(locale: string, invoiceId: string, customerId: string, formData: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_billing_invoice", {
    target_invoice_id: invoiceId,
    target_reason: value(formData, "reason", 500),
  });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing/${invoiceId}?saved=cancelled`);
}

export async function deleteBillingDraftAction(locale: string, invoiceId: string, customerId: string) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_billing_draft", { target_invoice_id: invoiceId });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing`);
}
