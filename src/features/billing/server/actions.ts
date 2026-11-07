"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTaxRate } from "@/features/billing/tax-rate";
import { validateBillingDocumentSelection } from "@/features/billing/document-type";
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
  if (message?.includes("billing_invalid_draft")) return "invalidDraft";
  if (message?.includes("billing_recipient_invalid")) return "customer";
  if (message?.includes("billing_series_reserved") || message?.includes("billing_simplified_series_used")) return "settingsInvalid";
  if (message?.includes("issuer_configuration")) return "issuer";
  if (message?.includes("customer_configuration")) return "customer";
  if (message?.includes("already_invoiced")) return "duplicate";
  if (message?.includes("not_authorized")) return "unauthorized";
  if (message?.includes("invalid_orders") || message?.includes("without_items")) return "orders";
  return "generic";
}

function revalidateBilling(locale: string, customerId?: string | null, invoiceId?: string) {
  revalidatePath(`/${locale}/app/billing`);
  if (invoiceId) revalidatePath(`/${locale}/app/billing/${invoiceId}`);
  if (customerId) revalidatePath(`/${locale}/app/customers/${customerId}`);
}

export async function saveBillingSettingsAction(locale: string, formData: FormData) {
  const { membership } = await requireOwner(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const series = value(formData, "defaultSeries", 13).toUpperCase();
  const taxRateInput = value(formData, "defaultTaxRate", 16);
  const taxRate = taxRateInput ? parseTaxRate(taxRateInput) : null;
  if (!/^[A-Z0-9-]{1,12}$/.test(series) || taxRate === null) {
    redirect(`/${locale}/app/billing?error=settingsInvalid`);
  }
  const supabase = await createSupabaseServerClient();
  // The canonical RPC replaces all issuer fields. Read persisted values, without
  // branding fallbacks, so a blank/omitted field cannot accidentally erase them.
  const { data: existing, error: readError } = await supabase
    .from("organization_billing_settings")
    .select("issuer_legal_name, issuer_tax_id, issuer_address_line1, issuer_address_line2, issuer_city, issuer_region, issuer_postal_code, issuer_country_code, issuer_email, issuer_phone")
    .eq("organization_id", membership.organization.id)
    .maybeSingle<Record<string, string | null>>();
  if (readError) redirect(`/${locale}/app/billing?error=generic`);
  const issuer: Record<string, string> = {};
  for (const [field, column, max] of [
    ["issuerLegalName", "issuer_legal_name", 180],
    ["issuerTaxId", "issuer_tax_id", 80],
    ["issuerAddressLine1", "issuer_address_line1", 180],
    ["issuerAddressLine2", "issuer_address_line2", 180],
    ["issuerCity", "issuer_city", 100],
    ["issuerRegion", "issuer_region", 100],
    ["issuerPostalCode", "issuer_postal_code", 24],
    ["issuerCountryCode", "issuer_country_code", 3],
    ["issuerEmail", "issuer_email", 254],
    ["issuerPhone", "issuer_phone", 40],
  ] as const) {
    issuer[`target_${column}`] = value(formData, field, max) || existing?.[column] || "";
  }
  issuer.target_issuer_country_code = issuer.target_issuer_country_code.toUpperCase();
  if (issuer.target_issuer_country_code && issuer.target_issuer_country_code.length !== 2) {
    redirect(`/${locale}/app/billing?error=settingsInvalid`);
  }
  const { error } = await supabase.rpc("upsert_organization_billing_settings", {
    ...issuer,
    target_default_series: series,
    target_default_tax_rate: taxRate,
  });
  if (error) redirect(`/${locale}/app/billing?error=${billingError(error.message)}`);
  revalidateBilling(locale);
  redirect(`/${locale}/app/billing?saved=issuerSettings#issuer-save-feedback`);
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
    .select("id, customer_code, customer_type, tax_id, billing_address_line1, billing_city, billing_postal_code, billing_country_code")
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId)
    .maybeSingle<{
      billing_address_line1: string | null;
      billing_city: string | null;
      billing_country_code: string | null;
      billing_postal_code: string | null;
      customer_code: string | null;
      customer_type: "individual" | "business";
      id: string;
      tax_id: string | null;
    }>();
  if (customerError || !customer) redirect(`/${locale}/app/billing/new?error=customer`);
  if (customer.customer_code === "WALKIN-SHARED") {
    redirect(`/${locale}/app/billing/new?customerId=${customerId}&orderId=${orderId}&source=shop&error=customer`);
  }

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
  const selection = validateBillingDocumentSelection(formData.getAll("fiscalDocumentType"));
  if (!selection.allowed) {
    redirect(`/${locale}/app/billing/new?customerId=${encodeURIComponent(customerId)}&error=${selection.reason}`);
  }
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

export async function updateBillingDraftAction(locale: string, invoiceId: string, customerId: string | null, formData: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const taxRate = parseTaxRate(value(formData, "taxRate", 16));
  const supabase = await createSupabaseServerClient();
  const payload = {
    target_due_date: nullable(value(formData, "dueDate", 10)),
    target_invoice_id: invoiceId,
    target_issue_date: value(formData, "issueDate", 10),
    target_notes: nullable(value(formData, "notes", 2000)),
    target_series: value(formData, "series", 12),
    target_tax_rate: taxRate,
  };
  const { error } = await supabase.rpc("update_billing_draft", payload);
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing/${invoiceId}?saved=draft`);
}

export async function issueBillingInvoiceAction(locale: string, invoiceId: string, customerId: string | null) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("issue_billing_invoice", { target_invoice_id: invoiceId });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing/${invoiceId}?saved=issued`);
}

export async function cancelBillingInvoiceAction(locale: string, invoiceId: string, customerId: string | null, formData: FormData) {
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

export async function deleteBillingDraftAction(locale: string, invoiceId: string, customerId: string | null) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_billing_draft", { target_invoice_id: invoiceId });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing`);
}
