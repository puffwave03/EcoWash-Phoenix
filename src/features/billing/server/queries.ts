import "server-only";

import { notFound } from "next/navigation";
import type {
  BillingDocumentStatus,
  BillingInvoice,
  BillingInvoiceDetail,
  BillingInvoiceItem,
  BillingPayment,
  BillingPaymentStatus,
  BillingSettings,
  CustomerBillingOverview,
  EligibleBillingOrder,
} from "@/features/billing/types";
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

type EligibleOrderRow = {
  created_at: string;
  currency: string;
  customer: { display_name: string; is_active: boolean } | { display_name: string; is_active: boolean }[] | null;
  customer_id: string;
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

const INVOICE_SELECT = "id, customer_id, invoice_number, series, sequence_number, document_status, issue_date, due_date, currency, subtotal, discount_total, taxable_base, tax_total, total, notes, cancellation_reason, issuer_legal_name, issuer_tax_id, issuer_address_line1, issuer_address_line2, issuer_city, issuer_region, issuer_postal_code, issuer_country_code, issuer_email, issuer_phone, issuer_logo_path, customer_name, customer_tax_id, customer_address_line1, customer_address_line2, customer_city, customer_postal_code, customer_country_code, customer_email, issued_at, cancelled_at, created_at";
const SETTINGS_SELECT = "issuer_legal_name, issuer_tax_id, issuer_address_line1, issuer_address_line2, issuer_city, issuer_region, issuer_postal_code, issuer_country_code, issuer_email, issuer_phone, default_series, default_tax_rate";

function number(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
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
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_billing_settings")
    .select(SETTINGS_SELECT)
    .eq("organization_id", membership.organization.id)
    .maybeSingle<SettingsRow>();

  const settings = data ?? null;
  return {
    defaultSeries: settings?.default_series ?? "A",
    defaultTaxRate: number(settings?.default_tax_rate ?? 0),
    issuerAddressLine1: settings?.issuer_address_line1 ?? "",
    issuerAddressLine2: settings?.issuer_address_line2 ?? "",
    issuerCity: settings?.issuer_city ?? "",
    issuerCountryCode: settings?.issuer_country_code ?? "",
    issuerEmail: settings?.issuer_email ?? "",
    issuerLegalName: settings?.issuer_legal_name ?? "",
    issuerPhone: settings?.issuer_phone ?? "",
    issuerPostalCode: settings?.issuer_postal_code ?? "",
    issuerRegion: settings?.issuer_region ?? "",
    issuerTaxId: settings?.issuer_tax_id ?? "",
    isIssueReady: Boolean(
      settings?.issuer_legal_name
      && settings.issuer_tax_id
      && settings.issuer_address_line1
      && settings.issuer_city
      && settings.issuer_postal_code
      && settings.issuer_country_code,
    ),
  };
}

export async function listBillingInvoices(locale: string): Promise<BillingInvoice[]> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("organization_id", membership.organization.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<InvoiceRow[]>();
  if (error) {
    console.error("Billing invoice list failed", error.code);
    return [];
  }
  try {
    return await hydrateInvoices(supabase, data ?? []);
  } catch (hydrateError) {
    console.error("Billing invoice hydration failed", hydrateError);
    return [];
  }
}

export async function getBillingInvoice(locale: string, invoiceId: string): Promise<BillingInvoiceDetail> {
  const { membership } = await requireOwnerOrManager(locale);
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

export async function listEligibleBillingOrders(locale: string, customerId?: string): Promise<EligibleBillingOrder[]> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const linksResult = await supabase.from("invoice_orders").select("order_id").eq("organization_id", membership.organization.id).eq("is_active", true).returns<{ order_id: string }[]>();
  const linked = new Set((linksResult.data ?? []).map((row) => row.order_id));
  let query = supabase
    .from("orders")
    .select("id, order_number, customer_id, created_at, currency, total, customer:customers!orders_customer_same_organization!inner(display_name, is_active)")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .neq("production_status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query.returns<EligibleOrderRow[]>();
  if (error) return [];

  return (data ?? []).filter((row) => !linked.has(row.id)).map((row) => {
    const customer = relation(row.customer);
    return {
      createdAt: row.created_at,
      currency: row.currency,
      customerActive: customer?.is_active ?? false,
      customerId: row.customer_id,
      customerName: customer?.display_name ?? "",
      id: row.id,
      orderNumber: row.order_number,
      total: number(row.total),
    };
  });
}

export async function getCustomerBillingOverview(locale: string, customerId: string): Promise<CustomerBillingOverview> {
  const [invoices, eligibleOrders] = await Promise.all([
    listBillingInvoices(locale),
    listEligibleBillingOrders(locale, customerId),
  ]);
  const customerInvoices = invoices.filter((invoice) => invoice.customerId === customerId);
  const currencies = [...new Set(customerInvoices.map((invoice) => invoice.currency))];

  return {
    eligibleOrderCount: eligibleOrders.length,
    recentInvoices: customerInvoices.slice(0, 5),
    summaries: currencies.map((currency) => {
      const rows = customerInvoices.filter((invoice) => invoice.currency === currency && invoice.documentStatus !== "cancelled");
      return {
        currency,
        invoiceCount: rows.length,
        issuedTotal: Math.round(rows.filter((invoice) => invoice.documentStatus === "issued").reduce((sum, invoice) => sum + invoice.total, 0) * 100) / 100,
        outstanding: Math.round(rows.filter((invoice) => invoice.documentStatus === "issued").reduce((sum, invoice) => sum + invoice.outstanding, 0) * 100) / 100,
        paidTotal: Math.round(rows.filter((invoice) => invoice.documentStatus === "issued").reduce((sum, invoice) => sum + invoice.paidTotal, 0) * 100) / 100,
      };
    }),
  };
}
