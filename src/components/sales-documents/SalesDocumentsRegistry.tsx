import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { SalesDocument } from "@/features/sales-documents/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";

export type SalesDocumentsText = {
  amount: string;
  cancel: string;
  cancelReason: string;
  customer: string;
  empty: string;
  issuedAt: string;
  kinds: Record<SalesDocument["kind"], string>;
  open: string;
  orders: string;
  statuses: Record<SalesDocument["status"], string>;
};

export function SalesDocumentsRegistry({ cancelReceipt, documents, locale, text }: {
  cancelReceipt: (receiptId: string, formData: FormData) => Promise<void>;
  documents: SalesDocument[];
  locale: string;
  text: SalesDocumentsText;
}) {
  if (!documents.length) return <Card><p className="text-sm text-muted">{text.empty}</p></Card>;
  return <div className="space-y-3">{documents.map((document) => <Card className="space-y-4" key={`${document.kind}-${document.id}`}>
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-secondary">{text.kinds[document.kind]} · {text.statuses[document.status]}</p><h2 className="mt-1 text-lg font-semibold text-primary">{document.documentNumber}</h2></div>
      <div className="text-sm text-muted"><p>{text.customer}: {document.customer}</p><p>{text.orders}: {document.orderNumbers.join(", ")}</p><p>{text.issuedAt}: {new Date(document.issuedAt).toLocaleString(locale)}</p></div>
      <div className="text-right"><p className="font-semibold text-primary">{text.amount}: {formatCurrency(document.amount, document.currency, locale)}</p><Link className="mt-2 inline-flex min-h-11 items-center rounded-control border border-primary px-3 text-sm font-semibold text-primary" href={document.kind === "receipt" ? `/app/accounting/documents/receipts/${document.id}/print` : `/app/billing/${document.id}/print`} locale={locale}>{text.open}</Link></div>
    </div>
    {document.kind === "receipt" && document.status === "issued" ? <form action={cancelReceipt.bind(null, document.id)} className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row"><input className="min-h-11 flex-1 rounded-control border border-border px-3" name="reason" placeholder={text.cancelReason} required /><Button type="submit" variant="danger">{text.cancel}</Button></form> : null}
  </Card>)}</div>;
}
