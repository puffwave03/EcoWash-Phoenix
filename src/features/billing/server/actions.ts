"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTaxRate } from "@/features/billing/tax-rate";

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

export async function createBillingDraftAction(locale: string, customerId: string, formData: FormData) {
  await requireOwnerOrManager(locale);
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("issue_billing_invoice", { target_invoice_id: invoiceId });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing/${invoiceId}?saved=issued`);
}

export async function cancelBillingInvoiceAction(locale: string, invoiceId: string, customerId: string, formData: FormData) {
  await requireOwnerOrManager(locale);
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
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_billing_draft", { target_invoice_id: invoiceId });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, customerId, invoiceId);
  redirect(`/${locale}/app/billing`);
}
