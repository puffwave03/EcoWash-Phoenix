"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseBillingServiceDeclaration } from "@/features/billing/service-declaration";
import { parseTaxRate } from "@/features/billing/tax-rate";
import { validateBillingDocumentSelection } from "@/features/billing/document-type";
import { parseBillingSimplifiedSeries } from "@/features/billing/simplified-series";
import { prepareSimplifiedBillingRequest, requestedRecipientSnapshot } from "@/features/billing/server/simplified-preparation";
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
  if (message?.includes("billing_exact_reconciliation_required") || message?.includes("billing_final_payment_links_invalid")) return "advanceBlocked";
  if (message?.includes("billing_advance_") || message?.includes("billing_final_")) return "advanceBlocked";
  if (message?.includes("billing_advance_workflow_required")) return "advanceBlocked";
  if (message?.includes("billing_service_date")) return "serviceDate";
  if (message?.includes("billing_simplified_declaration_required") || message?.includes("billing_simplified_operation_not_eligible")
    || message?.includes("billing_simplified_fiscal_history_review_required")) return "serviceDeclaration";
  if (message?.includes("billing_simplified_issuance_disabled") || message?.includes("billing_simplified_series_required")) return "simplifiedUnavailable";
  if (message?.includes("billing_recipient_invalid")) return "customer";
  if (message?.includes("billing_series_reserved") || message?.includes("billing_simplified_series_used")) return "simplifiedSeriesUsed";
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
  redirect(`/${locale}/app/billing?saved=settings`);
}

export async function reserveBillingSimplifiedSeriesAction(locale: string, formData: FormData) {
  await requireOwner(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const series = parseBillingSimplifiedSeries(formData.getAll("simplifiedSeries"));
  if (!series) redirect(`/${locale}/app/billing?error=simplifiedSeriesInvalid`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reserve_billing_simplified_series", { target_series: series });
  if (error) {
    const code = error.message?.includes("billing_simplified_series_used") ? "simplifiedSeriesUsed"
      : error.message?.includes("billing_settings_required") ? "simplifiedSeriesSettings"
      : error.message?.includes("billing_simplified_series_invalid") ? "simplifiedSeriesInvalid"
      : billingError(error.message);
    redirect(`/${locale}/app/billing?error=${code}`);
  }
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
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const selection = validateBillingDocumentSelection(formData.getAll("fiscalDocumentType"));
  if (!selection.allowed) {
    redirect(`/${locale}/app/billing/new?customerId=${encodeURIComponent(customerId)}&error=${selection.reason}`);
  }
  if (selection.documentType === "simplified") {
    const preparation = await prepareSimplifiedBillingRequest({
      organizationId: membership.organization.id, role: membership.role,
    }, formData);
    if (preparation.kind === "existing_document") {
      redirect(`/${locale}/app/billing/${preparation.invoiceId}`);
    }
    if (preparation.kind === "assessed") {
      if (!preparation.assessment.recipientSnapshot) {
        redirect(`/${locale}/app/billing/new?error=customer`);
      }
      if (preparation.assessment.reasons.includes("invalid_order") || preparation.assessment.reasons.includes("invalid_amount")) {
        redirect(`/${locale}/app/billing/new?error=orders`);
      }
    }
    if (preparation.kind !== "assessed" || !preparation.assessment.recipientSnapshot) {
      redirect(`/${locale}/app/billing/new?error=simplifiedUnavailable`);
    }
    // Persist an unnumbered draft only. Fiscal assessment/issuance may remain
    // blocked; no submitted profile/date/enable flag is sent as authorization.
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_billing_draft", {
      target_order_ids: [preparation.orderId], target_series: null, target_tax_rate: null,
      target_notes: nullable(value(formData, "notes", 2000)),
      target_fiscal_document_type: "simplified",
      target_recipient_snapshot: preparation.assessment.recipientSnapshot,
    });
    if (error || !data) {
      // A concurrent request may have won. Read back once; never retry a write.
      if (error?.message?.includes("already_invoiced")) {
        const recovered = await prepareSimplifiedBillingRequest({ organizationId: membership.organization.id, role: membership.role }, formData);
        if (recovered.kind === "existing_document") redirect(`/${locale}/app/billing/${recovered.invoiceId}`);
      }
      redirect(`/${locale}/app/billing/new?error=${billingError(error?.message)}`);
    }
    revalidateBilling(locale, null, data);
    redirect(`/${locale}/app/billing/${data}`);
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
  const hasRecipient = formData.getAll("recipientMode").length > 0;
  const snapshot = hasRecipient ? requestedRecipientSnapshot(formData) : null;
  if (hasRecipient && !snapshot) redirect(`/${locale}/app/billing/${invoiceId}?error=customer`);
  const { error } = await supabase.rpc("update_billing_draft", hasRecipient
    ? { ...payload, target_recipient_snapshot: snapshot } : payload);
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

// Explicit service declaration: the DB owns tenant, date, eligibility, locks and
// numbering. Lost responses lead to ONE canonical read, never an automatic write.
export async function issueSimplifiedBillingInvoiceAction(locale: string, invoiceId: string, form: FormData) {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  if (!UUID.test(invoiceId)) redirect(`/${locale}/app/billing?error=orders`);
  const declaration = parseBillingServiceDeclaration(form);
  if (!declaration) redirect(`/${locale}/app/billing/${invoiceId}?error=serviceDeclaration`);
  const supabase = await createSupabaseServerClient();
  let failed = false;
  let message: string | undefined;
  try {
    const result = await supabase.rpc("issue_billing_invoice", {
      target_invoice_id: invoiceId, target_service_performed_on: declaration.servicePerformedOn,
      target_operation_scope: declaration.operationScope, target_recipient_requirement: declaration.recipientRequirement,
      target_confirmed: true,
    });
    failed = Boolean(result.error);
    message = result.error?.message;
  } catch {
    failed = true;
  }
  // Both success and uncertain responses are verified against persisted state.
  let completed = false;
  try {
    const result = await supabase.from("invoices").select("id, organization_id, fiscal_document_type, document_status, invoice_number")
      .eq("organization_id", membership.organization.id).eq("id", invoiceId)
      .maybeSingle<{ id: string; organization_id: string; fiscal_document_type: string; document_status: string; invoice_number: string | null }>();
    const row = result.data;
    completed = !result.error && row?.id === invoiceId && row.organization_id === membership.organization.id
      && row.fiscal_document_type === "simplified" && row.document_status === "issued" && Boolean(row.invoice_number);
  } catch { /* Keep uncertainty visible; no second RPC or number allocation. */ }
  if (completed) {
    revalidateBilling(locale, null, invoiceId);
    redirect(`/${locale}/app/billing/${invoiceId}?saved=issued`);
  }
  redirect(`/${locale}/app/billing/${invoiceId}?error=${failed && message ? billingError(message) : "issueUncertain"}`);
}

export async function declareBillingAdvanceAction(locale: string, invoiceId: string, paymentId: string, form: FormData) {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  if (!UUID.test(invoiceId) || !UUID.test(paymentId)) redirect(`/${locale}/app/billing?error=orders`);
  if (form.get("preServiceConfirmed") !== "confirmed") redirect(`/${locale}/app/billing/${invoiceId}?error=serviceDeclaration`);
  const supabase = await createSupabaseServerClient();
  const { data: link, error: linkError } = await supabase.from("invoice_orders")
    .select("order_id").eq("organization_id", membership.organization.id)
    .eq("invoice_id", invoiceId).eq("billing_link_role", "final")
    .eq("is_active", true).maybeSingle<{ order_id: string }>();
  if (linkError || !link) redirect(`/${locale}/app/billing/${invoiceId}?error=orders`);
  const { error } = await supabase.rpc("declare_billing_advance_event", {
    target_order_id: link.order_id, target_payment_id: paymentId, target_confirmed: true,
  });
  if (error) redirect(`/${locale}/app/billing/${invoiceId}?error=${billingError(error.message)}`);
  revalidateBilling(locale, null, invoiceId);
  redirect(`/${locale}/app/billing/${invoiceId}?saved=advanceDeclared`);
}

export async function issueBillingAdvanceAction(locale: string, invoiceId: string, paymentId: string, form: FormData) {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  if (!UUID.test(invoiceId) || !UUID.test(paymentId)) redirect(`/${locale}/app/billing?error=orders`);
  const operationScope = value(form, "operationScope", 80);
  const recipientRequirement = value(form, "fiscalRecipientRequirement", 80);
  if (form.get("advanceIssueConfirmed") !== "confirmed"
    || operationScope !== "local_laundry_dry_cleaning"
    || !["consumer", "consumer_identified", "business"].includes(recipientRequirement)) {
    redirect(`/${locale}/app/billing/${invoiceId}?error=serviceDeclaration`);
  }
  const supabase = await createSupabaseServerClient();
  let message: string | undefined;
  try {
    const result = await supabase.rpc("issue_billing_advance_invoice", {
      target_final_draft_id: invoiceId, target_payment_id: paymentId,
      target_operation_scope: operationScope,
      target_recipient_requirement: recipientRequirement,
      target_confirmed: true,
    });
    message = result.error?.message;
  } catch { /* Resolve from the immutable payment attribution below. */ }
  const { data: link, error: linkError } = await supabase.from("billing_invoice_payment_links")
    .select("invoice_id").eq("organization_id", membership.organization.id)
    .eq("payment_id", paymentId).eq("billing_link_role", "advance")
    .maybeSingle<{ invoice_id: string }>();
  if (!linkError && link) {
    const { data: issued, error } = await supabase.from("invoices")
      .select("id").eq("organization_id", membership.organization.id)
      .eq("id", link.invoice_id).eq("document_status", "issued")
      .eq("billing_event_kind", "advance").maybeSingle<{ id: string }>();
    if (!error && issued) {
      revalidateBilling(locale, null, invoiceId);
      redirect(`/${locale}/app/billing/${issued.id}?saved=issued`);
    }
  }
  redirect(`/${locale}/app/billing/${invoiceId}?error=${message ? billingError(message) : "issueUncertain"}`);
}

export async function issueBillingFinalAfterAdvancesAction(locale: string, invoiceId: string, form: FormData) {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  if (!UUID.test(invoiceId)) redirect(`/${locale}/app/billing?error=orders`);
  const paymentId = value(form, "balancePaymentId", 36);
  const declaration = parseBillingServiceDeclaration(form);
  if (!UUID.test(paymentId) || !declaration) redirect(`/${locale}/app/billing/${invoiceId}?error=serviceDeclaration`);
  const supabase = await createSupabaseServerClient();
  let message: string | undefined;
  try {
    const result = await supabase.rpc("issue_billing_final_after_advances", {
      target_final_draft_id: invoiceId, target_balance_payment_id: paymentId,
      target_service_performed_on: declaration.servicePerformedOn,
      target_operation_scope: declaration.operationScope,
      target_recipient_requirement: declaration.recipientRequirement,
      target_confirmed: true,
    });
    message = result.error?.message;
  } catch { /* Resolve committed state below, without resubmitting. */ }
  const [invoiceResult, linkResult] = await Promise.all([
    supabase.from("invoices").select("id").eq("organization_id", membership.organization.id)
      .eq("id", invoiceId).eq("document_status", "issued")
      .maybeSingle<{ id: string }>(),
    supabase.from("billing_invoice_payment_links").select("payment_id")
      .eq("organization_id", membership.organization.id).eq("invoice_id", invoiceId)
      .eq("payment_id", paymentId).eq("billing_link_role", "final")
      .maybeSingle<{ payment_id: string }>(),
  ]);
  if (!invoiceResult.error && invoiceResult.data && !linkResult.error && linkResult.data) {
    revalidateBilling(locale, null, invoiceId);
    redirect(`/${locale}/app/billing/${invoiceId}?saved=issued`);
  }
  redirect(`/${locale}/app/billing/${invoiceId}?error=${message ? billingError(message) : "issueUncertain"}`);
}
