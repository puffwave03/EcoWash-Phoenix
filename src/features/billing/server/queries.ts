import "server-only";
import { BILLING_PAGE_SIZE, billingPage, decodeBillingCursor, normalizeBillingFilters, type BillingFilters } from "@/features/billing/pagination";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";

import { notFound } from "next/navigation";
import type {
  BillingCustomerContext,
  BillingCustomerFiscalField,
  BillingDocumentStatus,
  BillingInvoice,
  BillingInvoiceListEntry,
  BillingHistorySummary,
  BillingInvoiceDetail,
  BillingInvoiceItem,
  BillingPayment,
  BillingPaymentStatus,
  BillingSettings,
  BillingIssuerRequiredField,
  CustomerBillingOverview,
  EligibleBillingOrder,
} from "@/features/billing/types";
import { BILLING_ISSUER_REQUIRED_FIELDS } from "@/features/billing/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvoiceRow = {
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  currency: string;
  customer_address_line1: string | null;
  customer_address_line2: string | null;
  customer_city: string | null;
  customer_country_code: string | null;
  customer_email: string | null;
  customer_id: string;
  customer_name: string;
  customer_postal_code: string | null;
  customer_tax_id: string | null;
  discount_total: number;
  document_status: BillingDocumentStatus;
  due_date: string | null;
  id: string;
  invoice_number: string | null;
  issue_date: string;
  issued_at: string | null;
  issuer_address_line1: string | null;
  issuer_address_line2: string | null;
  issuer_city: string | null;
  issuer_country_code: string | null;
  issuer_email: string | null;
  issuer_legal_name: string | null;
  issuer_logo_path: string | null;
  issuer_phone: string | null;
  issuer_postal_code: string | null;
  issuer_region: string | null;
  issuer_tax_id: string | null;
  notes: string | null;
  prices_include_tax: boolean;
  sequence_number: number | null;
  series: string;
  subtotal: number;
  tax_total: number;
  taxable_base: number;
  total: number;
};

type InvoiceOrderRow = { invoice_id: string; order_id: string };
type OrderNumberRow = { id: string; order_number: string };
type PaymentRow = {
  amount: number;
  id: string;
  method: BillingPayment["method"];
  order_id: string;
  paid_at: string;
  status: BillingPayment["status"];
};

type SettingsRow = {
  default_series: string;
  default_tax_rate: number;
  issuer_address_line1: string | null;
  issuer_address_line2: string | null;
  issuer_city: string | null;
  issuer_country_code: string | null;
  issuer_email: string | null;
  issuer_legal_name: string | null;
  issuer_phone: string | null;
  issuer_postal_code: string | null;
  issuer_region: string | null;
  issuer_tax_id: string | null;
};

type BillingAutofillRow = {
  business_address: string | null;
  commercial_name: string | null;
  support_email: string | null;
  support_phone: string | null;
};

type BillingCustomerRow = {
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_country_code: string | null;
  billing_postal_code: string | null;
  customer_code: string | null;
  customer_type: "individual" | "business";
  display_name: string;
  id: string;
  tax_id: string | null;
};

type EligibleOrderRow = {
  created_at: string;
  currency: string;
  customer_active: boolean;
  customer_id: string;
  customer_name: string;
  id: string;
  order_number: string;
  total: number;
};

type InvoiceItemRow = {
  description: string;
  discount_amount: number;
  display_order: number;
  id: string;
  line_subtotal: number;
  line_total: number;
  quantity: number;
  source_order_id: string | null;
  tax_amount: number;
  taxable_base: number;
  tax_rate: number;
  unit_price: number;
  unit_type: BillingInvoiceItem["unitType"];
};

const INVOICE_SELECT = "id, customer_id, invoice_number, series, sequence_number, document_status, issue_date, due_date, currency, subtotal, discount_total, taxable_base, tax_total, total, prices_include_tax, notes, cancellation_reason, issuer_legal_name, issuer_tax_id, issuer_address_line1, issuer_address_line2, issuer_city, issuer_region, issuer_postal_code, issuer_country_code, issuer_email, issuer_phone, issuer_logo_path, customer_name, customer_tax_id, customer_address_line1, customer_address_line2, customer_city, customer_postal_code, customer_country_code, customer_email, issued_at, cancelled_at, created_at";
const SETTINGS_SELECT = "issuer_legal_name, issuer_tax_id, issuer_address_line1, issuer_address_line2, issuer_city, issuer_region, issuer_postal_code, issuer_country_code, issuer_email, issuer_phone, default_series, default_tax_rate";

function number(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function present(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function derivePayment(documentStatus: BillingDocumentStatus, total: number, paid: number): BillingPaymentStatus {
  if (documentStatus === "draft") return "draft";
  if (documentStatus === "cancelled") return "cancelled";
  if (paid <= 0) return "unpaid";
  if (paid < total) return "partially_paid";
  return "paid";
}

function paymentTotals(payments: PaymentRow[]) {
  const confirmed = payments.filter((payment) => payment.status === "confirmed").reduce((sum, payment) => sum + number(payment.amount), 0);
  const refunded = payments.filter((payment) => payment.status === "refunded").reduce((sum, payment) => sum + number(payment.amount), 0);
  return Math.round((confirmed - refunded) * 100) / 100;
}

function mapInvoice(
  row: InvoiceRow,
  links: InvoiceOrderRow[],
  orderNumbers: Map<string, string>,
  payments: PaymentRow[],
): BillingInvoice {
  const orderIds = links.map((link) => link.order_id);
  const paidTotal = paymentTotals(payments.filter((payment) => orderIds.includes(payment.order_id)));
  const total = number(row.total);

  return {
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    currency: row.currency,
    customerAddressLine1: row.customer_address_line1,
    customerAddressLine2: row.customer_address_line2,
    customerCity: row.customer_city,
    customerCountryCode: row.customer_country_code,
    customerEmail: row.customer_email,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPostalCode: row.customer_postal_code,
    customerTaxId: row.customer_tax_id,
    discountTotal: number(row.discount_total),
    documentStatus: row.document_status,
    dueDate: row.due_date,
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    issuedAt: row.issued_at,
    issuerAddressLine1: row.issuer_address_line1,
    issuerAddressLine2: row.issuer_address_line2,
    issuerCity: row.issuer_city,
    issuerCountryCode: row.issuer_country_code,
    issuerEmail: row.issuer_email,
    issuerLegalName: row.issuer_legal_name,
    issuerLogoPath: row.issuer_logo_path,
    issuerPhone: row.issuer_phone,
    issuerPostalCode: row.issuer_postal_code,
    issuerRegion: row.issuer_region,
    issuerTaxId: row.issuer_tax_id,
    notes: row.notes,
    orderIds,
    orderNumbers: orderIds.map((id) => orderNumbers.get(id) ?? id),
    outstanding: Math.round(Math.max(total - paidTotal, 0) * 100) / 100,
    paidTotal,
    paymentStatus: derivePayment(row.document_status, total, paidTotal),
    pricesIncludeTax: row.prices_include_tax,
    sequenceNumber: row.sequence_number,
    series: row.series,
    subtotal: number(row.subtotal),
    taxTotal: number(row.tax_total),
    taxableBase: number(row.taxable_base),
    total,
  };
}

async function hydrateInvoices(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: InvoiceRow[],
) {
  if (rows.length === 0) return [];
  const invoiceIds = rows.map((row) => row.id);
  const { data: linkData, error: linkError } = await supabase
    .from("invoice_orders")
    .select("invoice_id, order_id")
    .in("invoice_id", invoiceIds)
    .returns<InvoiceOrderRow[]>();
  if (linkError) throw linkError;
  const links = linkData ?? [];
  const orderIds = [...new Set(links.map((link) => link.order_id))];
  if (orderIds.length === 0) return rows.map((row) => mapInvoice(row, [], new Map(), []));

  const [ordersResult, paymentsResult] = await Promise.all([
    supabase.from("orders").select("id, order_number").in("id", orderIds).returns<OrderNumberRow[]>(),
    supabase.from("payments").select("id, order_id, amount, method, status, paid_at").in("order_id", orderIds).returns<PaymentRow[]>(),
  ]);
  if (ordersResult.error) throw ordersResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  const orderNumbers = new Map((ordersResult.data ?? []).map((order) => [order.id, order.order_number]));

  return rows.map((row) => mapInvoice(
    row,
    links.filter((link) => link.invoice_id === row.id),
    orderNumbers,
    paymentsResult.data ?? [],
  ));
}

export async function getBillingSettings(locale: string): Promise<BillingSettings> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const [settingsResult, brandingResult] = await Promise.all([
    supabase
      .from("organization_billing_settings")
      .select(SETTINGS_SELECT)
      .eq("organization_id", membership.organization.id)
      .maybeSingle<SettingsRow>(),
    supabase
      .from("organization_branding")
      .select("commercial_name, business_address, support_email, support_phone")
      .eq("organization_id", membership.organization.id)
      .maybeSingle<BillingAutofillRow>(),
  ]);

  const settings = settingsResult.data ?? null;
  const branding = brandingResult.data ?? null;
  const autofilledFields: BillingIssuerRequiredField[] = [];
  const issuerLegalName = present(settings?.issuer_legal_name) || present(branding?.commercial_name) || membership.organization.name;
  const issuerAddressLine1 = present(settings?.issuer_address_line1) || present(branding?.business_address);
  if (!present(settings?.issuer_legal_name) && issuerLegalName) autofilledFields.push("issuerLegalName");
  if (!present(settings?.issuer_address_line1) && issuerAddressLine1) autofilledFields.push("issuerAddressLine1");
  const issuerTaxId = present(settings?.issuer_tax_id);
  const issuerCity = present(settings?.issuer_city);
  const issuerPostalCode = present(settings?.issuer_postal_code);
  const issuerCountryCode = present(settings?.issuer_country_code);
  const persistedRequired: Record<BillingIssuerRequiredField, string> = {
    issuerAddressLine1: present(settings?.issuer_address_line1),
    issuerCity: present(settings?.issuer_city),
    issuerCountryCode: present(settings?.issuer_country_code),
    issuerLegalName: present(settings?.issuer_legal_name),
    issuerPostalCode: present(settings?.issuer_postal_code),
    issuerTaxId: present(settings?.issuer_tax_id),
  };
  const isIssueReady = Boolean(
    present(settings?.issuer_legal_name)
    && issuerTaxId
    && present(settings?.issuer_address_line1)
    && issuerCity
    && issuerPostalCode
    && issuerCountryCode,
  );

  return {
    autofilledFields,
    defaultSeries: settings?.default_series ?? "A",
    defaultTaxRate: number(settings?.default_tax_rate ?? 0),
    issuerAddressLine1,
    issuerAddressLine2: settings?.issuer_address_line2 ?? "",
    issuerCity,
    issuerCountryCode,
    issuerEmail: present(settings?.issuer_email) || present(branding?.support_email),
    issuerLegalName,
    issuerPhone: present(settings?.issuer_phone) || present(branding?.support_phone),
    issuerPostalCode,
    issuerRegion: settings?.issuer_region ?? "",
    issuerTaxId,
    isIssueReady,
    missingRequiredFields: BILLING_ISSUER_REQUIRED_FIELDS.filter((field) => !persistedRequired[field]),
    organizationName: membership.organization.name,
  };
}

export async function getBillingCustomerContext(locale: string, customerId: string): Promise<BillingCustomerContext> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, customer_type, display_name, tax_id, billing_address_line1, billing_city, billing_postal_code, billing_country_code")
    .eq("organization_id", membership.organization.id)
    .eq("id", customerId)
    .maybeSingle<BillingCustomerRow>();
  if (error || !data) notFound();

  const missingRequiredFields: BillingCustomerFiscalField[] = [];
  if (!present(data.billing_address_line1)) missingRequiredFields.push("billingAddressLine1");
  if (!present(data.billing_city)) missingRequiredFields.push("billingCity");
  if (!present(data.billing_postal_code)) missingRequiredFields.push("billingPostalCode");
  if (!present(data.billing_country_code)) missingRequiredFields.push("billingCountryCode");
  if (data.customer_type === "business" && !present(data.tax_id)) missingRequiredFields.push("taxId");

  return {
    billingAddressLine1: present(data.billing_address_line1),
    billingCity: present(data.billing_city),
    billingCountryCode: present(data.billing_country_code),
    billingPostalCode: present(data.billing_postal_code),
    customerId: data.id,
    customerName: data.display_name,
    customerType: data.customer_type,
    isFiscalReady: missingRequiredFields.length === 0,
    isSharedWalkIn: data.customer_code === "WALKIN-SHARED",
    isWalkIn: data.customer_code?.startsWith("WALKIN-") ?? false,
    missingRequiredFields,
    taxId: present(data.tax_id),
  };
}

type BillingListRow = {
  id: string; created_at: string; invoice_number: string | null; customer_name: string;
  issue_date: string; currency: string; total: number; paid_total: number;
  outstanding: number; payment_status: BillingPaymentStatus; order_numbers: string[];
};

export async function listBillingInvoices(locale: string, filters: BillingFilters, rawCursor?: string) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const normalized = normalizeBillingFilters(filters.q, filters.status);
  let cursor = decodeBillingCursor(rawCursor, normalized);
  const load = async () => {
    const result = await supabase.rpc("list_billing_invoices_page", {
      target_query: normalized.q, target_status: normalized.status,
      target_cursor_created_at: cursor?.createdAt ?? null, target_cursor_id: cursor?.id ?? null,
      target_direction: cursor?.direction ?? "older", target_limit: BILLING_PAGE_SIZE + 1,
    }).returns<BillingListRow[]>();
    if (result.error) throw result.error;
    if (!Array.isArray(result.data)) throw new Error("billing_history_invalid_response");
    return result.data as BillingListRow[];
  };
  let data = await load();
  if (!data.length && cursor) {
    cursor = null;
    data = await load();
  }
  const rows: BillingInvoiceListEntry[] = data.map((row) => ({
    id: row.id, createdAt: row.created_at, invoiceNumber: row.invoice_number,
    customerName: row.customer_name, issueDate: row.issue_date, currency: row.currency,
    total: number(row.total), paidTotal: number(row.paid_total), outstanding: number(row.outstanding),
    paymentStatus: row.payment_status, orderNumbers: row.order_numbers,
  }));
  return billingPage(rows, cursor, normalized);
}

export async function getBillingHistorySummary(locale: string): Promise<BillingHistorySummary> {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_billing_history_summary").single<{
    invoice_count: number; draft_count: number; currency: string; issued_total: number; outstanding: number;
  }>();
  if (error) throw error;
  if (!data) throw new Error("billing_summary_missing");
  return { invoiceCount: number(data.invoice_count), draftCount: number(data.draft_count),
    currency: data.currency, issuedTotal: number(data.issued_total), outstanding: number(data.outstanding) };
}

export async function getBillingInvoice(locale: string, invoiceId: string): Promise<BillingInvoiceDetail> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const [invoiceResult, itemsResult] = await Promise.all([
    supabase.from("invoices").select(INVOICE_SELECT).eq("organization_id", membership.organization.id).eq("id", invoiceId).maybeSingle<InvoiceRow>(),
    supabase.from("invoice_items").select("id, source_order_id, description, unit_type, quantity, unit_price, line_subtotal, discount_amount, taxable_base, tax_rate, tax_amount, line_total, display_order").eq("organization_id", membership.organization.id).eq("invoice_id", invoiceId).order("display_order").returns<InvoiceItemRow[]>(),
  ]);
  if (invoiceResult.error || !invoiceResult.data) notFound();
  const invoices = await hydrateInvoices(supabase, [invoiceResult.data]);
  const invoice = invoices[0];
  if (!invoice) notFound();
  const { data: paymentData } = invoice.orderIds.length
    ? await supabase.from("payments").select("id, order_id, amount, method, status, paid_at").in("order_id", invoice.orderIds).order("paid_at", { ascending: false }).returns<PaymentRow[]>()
    : { data: [] as PaymentRow[] };

  return {
    invoice,
    items: (itemsResult.data ?? []).map((item) => ({
      description: item.description,
      discountAmount: number(item.discount_amount),
      displayOrder: item.display_order,
      id: item.id,
      lineSubtotal: number(item.line_subtotal),
      lineTotal: number(item.line_total),
      quantity: number(item.quantity),
      sourceOrderId: item.source_order_id,
      taxAmount: number(item.tax_amount),
      taxableBase: number(item.taxable_base),
      taxRate: number(item.tax_rate),
      unitPrice: number(item.unit_price),
      unitType: item.unit_type,
    })),
    payments: (paymentData ?? []).map((payment) => ({
      amount: number(payment.amount),
      id: payment.id,
      method: payment.method,
      orderId: payment.order_id,
      paidAt: payment.paid_at,
      status: payment.status,
    })),
  };
}

export async function listEligibleBillingOrders(locale: string, customerId?: string, orderId?: string, search = ""): Promise<{ orders: EligibleBillingOrder[]; hasMore: boolean }> {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_eligible_billing_orders", {
    target_query: orderId ? "" : search.trim().slice(0, 100),
    target_customer_id: customerId || null,
    target_order_id: orderId || null,
    target_limit: 101,
  }).returns<EligibleOrderRow[]>();
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("billing_eligible_orders_invalid_response");

  const rows = data as EligibleOrderRow[];
  return {
    hasMore: rows.length > 100,
    orders: rows.slice(0, 100).map((row) => ({
      createdAt: row.created_at,
      currency: row.currency,
      customerActive: row.customer_active,
      customerId: row.customer_id,
      customerName: row.customer_name,
      id: row.id,
      orderNumber: row.order_number,
      total: number(row.total),
    })),
  };
}

export async function getCustomerBillingOverview(locale: string, customerId: string): Promise<CustomerBillingOverview> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const supabase = await createSupabaseServerClient();
  const [recent, summary] = await Promise.all([
    supabase.from("invoices").select(INVOICE_SELECT)
      .eq("organization_id", membership.organization.id).eq("customer_id", customerId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .limit(5).returns<InvoiceRow[]>(),
    supabase.rpc("get_customer_billing_history_summary", { target_customer_id: customerId })
      .returns<Pick<CustomerBillingOverview, "eligibleOrderCount" | "summaries">>(),
  ]);
  if (recent.error) throw recent.error;
  if (summary.error) throw summary.error;
  if (!summary.data || !("summaries" in summary.data) || !Array.isArray(summary.data.summaries)) throw new Error("customer_billing_summary_missing");
  return {
    eligibleOrderCount: number(summary.data.eligibleOrderCount),
    recentInvoices: await hydrateInvoices(supabase, recent.data ?? []),
    summaries: summary.data.summaries.map((row) => ({
      currency: row.currency, invoiceCount: number(row.invoiceCount), issuedTotal: number(row.issuedTotal),
      paidTotal: number(row.paidTotal), outstanding: number(row.outstanding),
    })),
  };
}
