import { OperationalReceiptDocument } from "@/components/sales-documents/OperationalReceiptDocument";
import { SalesDocumentViewTracker } from "@/components/sales-documents/SalesDocumentViewTracker";
import { recordSalesDocumentEvent } from "@/features/sales-documents/server/actions";
import { getOperationalReceipt } from "@/features/sales-documents/server/queries";

export default async function OperationalReceiptPrintPage({ params }: { params: Promise<{ locale: string; receiptId: string }> }) {
  const { locale, receiptId } = await params;
  const receipt = await getOperationalReceipt(locale, receiptId);
  return <>
    <SalesDocumentViewTracker viewedAction={recordSalesDocumentEvent.bind(null, locale, "receipt", receiptId, "viewed")} />
    <OperationalReceiptDocument locale={locale} printRequestedAction={recordSalesDocumentEvent.bind(null, locale, "receipt", receiptId, "print_requested")} receipt={receipt} />
  </>;
}
