import "server-only";
import { SALES_DOCUMENT_PAGE_SIZE, decodeSalesDocumentCursor, salesDocumentPage } from "@/features/sales-documents/pagination";

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

const RECEIPT_SELECT = "id, order_id, customer_id, receipt_number, series, sequence_year, sequence_number, document_status, issued_at, cancelled_at, cancellation_reason, currency, amount, snapshot_version, snapshot, customer:customers!operational_receipts_customer_same_org(display_name)";

function mapReceipt(row: ReceiptRow, timeZone: string, logoUrl?: string | null): OperationalReceipt {
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
    timeZone,
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
  return mapReceipt(data, membership.organization.timezone, logoUrl);
}

type SalesDocumentRow = {
  id: string; kind: SalesDocument["kind"]; document_number: string; status: SalesDocument["status"];
  issued_at: string; customer: string; order_numbers: string[]; amount: number; currency: string;
};

export async function listSalesDocuments(locale: string, rawCursor?: string) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.printing);
  const supabase = await createSupabaseServerClient();
  let cursor = decodeSalesDocumentCursor(rawCursor);
  const load = async () => {
    const result = await supabase.rpc("list_sales_documents_page", {
      target_cursor_issued_at: cursor?.issuedAt ?? null,
      target_cursor_document_number: cursor?.documentNumber ?? null,
      target_cursor_kind: cursor?.kind ?? null, target_cursor_id: cursor?.id ?? null,
      target_direction: cursor?.direction ?? "older", target_limit: SALES_DOCUMENT_PAGE_SIZE + 1,
    }).returns<SalesDocumentRow[]>();
    if (result.error) throw result.error;
    if (!Array.isArray(result.data)) throw new Error("sales_documents_history_invalid_response");
    return result.data as SalesDocumentRow[];
  };
  let data = await load();
  if (!data.length && cursor) {
    cursor = null;
    data = await load();
  }
  const rows: SalesDocument[] = data.map((row) => ({
    id: row.id, kind: row.kind, documentNumber: row.document_number, status: row.status,
    issuedAt: row.issued_at, customer: row.customer, orderNumbers: row.order_numbers,
    amount: Number(row.amount), currency: row.currency,
  }));
  return salesDocumentPage(rows, cursor);
}
