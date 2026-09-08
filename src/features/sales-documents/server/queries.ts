import "server-only";

import { notFound } from "next/navigation";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requirePrintAccess } from "@/features/printing/server/access";
import type { OperationalReceipt, OperationalReceiptSnapshot, SalesDocument } from "@/features/sales-documents/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReceiptRow = {
  amount: number;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  currency: string;
  customer_id: string;
  customer: { display_name: string } | { display_name: string }[] | null;
  document_status: OperationalReceipt["documentStatus"];
  id: string;
  issued_at: string;
  order_id: string;
  receipt_number: string;
  sequence_number: number;
  sequence_year: number;
  series: string;
  snapshot: OperationalReceiptSnapshot;
  snapshot_version: number;
};

type InvoiceRow = {
  currency: string;
  customer_name: string;
  document_status: "issued" | "cancelled";
  id: string;
  invoice_number: string;
  issued_at: string;
  total: number;
};

type InvoiceOrderRow = {
  invoice_id: string;
  order: { order_number: string } | { order_number: string }[] | null;
};

const RECEIPT_SELECT = "id, order_id, customer_id, receipt_number, series, sequence_year, sequence_number, document_status, issued_at, cancelled_at, cancellation_reason, currency, amount, snapshot_version, snapshot, customer:customers!operational_receipts_customer_same_org(display_name)";

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapReceipt(row: ReceiptRow, logoUrl?: string | null): OperationalReceipt {
  return {
    amount: Number(row.amount),
    cancellationReason: row.cancellation_reason,
    cancelledAt: row.cancelled_at,
    currency: row.currency,
    customerId: row.customer_id,
    documentStatus: row.document_status,
    id: row.id,
    issuedAt: row.issued_at,
    orderId: row.order_id,
    receiptNumber: row.receipt_number,
    sequenceNumber: Number(row.sequence_number),
    sequenceYear: row.sequence_year,
    series: row.series,
    snapshot: {
      ...row.snapshot,
      organization: { ...row.snapshot.organization, logoUrl },
    },
    snapshotVersion: row.snapshot_version,
  };
}

export async function getOperationalReceipt(locale: string, receiptId: string): Promise<OperationalReceipt> {
  const { membership } = await requirePrintAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("operational_receipts").select(RECEIPT_SELECT)
    .eq("organization_id", membership.organization.id).eq("id", receiptId).maybeSingle<ReceiptRow>();
  if (error || !data || data.snapshot_version !== 1) notFound();
  const logoPath = data.snapshot.organization.logoPath;
  const logoUrl = logoPath ? supabase.storage.from("brand-media").getPublicUrl(logoPath).data.publicUrl : null;
  return mapReceipt(data, logoUrl);
}

export async function listSalesDocuments(locale: string): Promise<SalesDocument[]> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.printing);
  const supabase = await createSupabaseServerClient();
  const [receiptResult, invoiceResult] = await Promise.all([
    supabase.from("operational_receipts").select(RECEIPT_SELECT).eq("organization_id", membership.organization.id)
      .order("issued_at", { ascending: false }).limit(100).returns<ReceiptRow[]>(),
    supabase.from("invoices").select("id, invoice_number, document_status, issued_at, customer_name, total, currency")
      .eq("organization_id", membership.organization.id).in("document_status", ["issued", "cancelled"])
      .order("issued_at", { ascending: false }).limit(100).returns<InvoiceRow[]>(),
  ]);
  if (receiptResult.error || invoiceResult.error) throw new Error("sales_documents_query_failed");
  const invoiceIds = (invoiceResult.data ?? []).map((invoice) => invoice.id);
  const { data: orderLinks, error: orderLinksError } = invoiceIds.length
    ? await supabase.from("invoice_orders").select("invoice_id, order:orders!invoice_orders_order_same_organization(order_number)")
      .eq("organization_id", membership.organization.id).in("invoice_id", invoiceIds).returns<InvoiceOrderRow[]>()
    : { data: [] as InvoiceOrderRow[], error: null };
  if (orderLinksError) throw new Error("sales_documents_orders_query_failed");
  const invoiceOrders = new Map<string, string[]>();
  for (const link of orderLinks ?? []) {
    const orderNumber = relation(link.order)?.order_number;
    if (orderNumber) invoiceOrders.set(link.invoice_id, [...(invoiceOrders.get(link.invoice_id) ?? []), orderNumber]);
  }

  return [
    ...(receiptResult.data ?? []).map<SalesDocument>((receipt) => ({
      amount: Number(receipt.amount), currency: receipt.currency, customer: relation(receipt.customer)?.display_name ?? "",
      documentNumber: receipt.receipt_number, id: receipt.id, issuedAt: receipt.issued_at, kind: "receipt",
      orderNumbers: [receipt.snapshot.order.orderNumber], status: receipt.document_status,
    })),
    ...(invoiceResult.data ?? []).map<SalesDocument>((invoice) => ({
      amount: Number(invoice.total), currency: invoice.currency, customer: invoice.customer_name,
      documentNumber: invoice.invoice_number, id: invoice.id, issuedAt: invoice.issued_at, kind: "invoice",
      orderNumbers: invoiceOrders.get(invoice.id) ?? [], status: invoice.document_status,
    })),
  ].sort((left, right) => right.issuedAt.localeCompare(left.issuedAt) || left.documentNumber.localeCompare(right.documentNumber));
}
