"use server";

import { revalidatePath } from "next/cache";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requirePrintAccess } from "@/features/printing/server/access";
import type { SalesDocumentEventType, SalesDocumentKind } from "@/features/sales-documents/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IssuedReceiptRow = { receipt_id: string; receipt_number: string };

export async function issueOperationalReceipt(locale: string, orderId: string) {
  await requirePrintAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("issue_operational_receipt", { target_order_id: orderId }).single<IssuedReceiptRow>();
  if (error || !data) throw new Error(`operational_receipt_issue_failed:${error?.code ?? "unknown"}`);
  return { id: data.receipt_id, receiptNumber: data.receipt_number };
}

export async function cancelOperationalReceiptAction(locale: string, receiptId: string, formData: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.printing);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_operational_receipt", { target_reason: reason, target_receipt_id: receiptId });
  if (error) throw new Error(`operational_receipt_cancel_failed:${error.code}`);
  revalidatePath(`/${locale}/app/accounting/documents`);
  revalidatePath(`/${locale}/app/accounting/documents/receipts/${receiptId}/print`);
}

export async function recordSalesDocumentEvent(
  locale: string,
  kind: SalesDocumentKind,
  documentId: string,
  eventType: SalesDocumentEventType,
) {
  if (kind === "receipt") await requirePrintAccess(locale);
  else {
    await requireOwnerOrManager(locale);
    await requireEntitlement(locale, FEATURES.billingInvoicing);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_sales_document_event", {
    target_document_id: documentId,
    target_document_kind: kind,
    target_event_type: eventType,
  });
  if (error) throw new Error(`sales_document_event_failed:${error.code}`);
}
