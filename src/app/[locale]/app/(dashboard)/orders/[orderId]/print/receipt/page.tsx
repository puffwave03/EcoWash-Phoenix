import { redirect } from "next/navigation";
import { issueOperationalReceipt } from "@/features/sales-documents/server/actions";

export default async function OrderReceiptPrintPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  const receipt = await issueOperationalReceipt(locale, orderId);
  redirect(`/${locale}/app/accounting/documents/receipts/${receipt.id}/print`);
}
